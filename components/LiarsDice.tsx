'use client';

import { useState, useEffect, useCallback } from 'react';
import socketHandler, { createRoom, joinRoom, startGame, placeBid, challenge, cleanup } from '../lib/socket';
import { Player, Bid, GameStatus, GameMode, GameLogEntry } from '../types/game';
import { generateComputerMove } from '../utils/computerAI';
import { isValidBid, rollDice, isEndGameScenario, resolveChallengeOutcome } from '../utils/gameLogic';
import StartScreen from './StartScreen';
import JoinGame from './JoinGame';
import WaitingRoom from './WaitingRoom';
import GameBoard from './GameBoard';
import GameLog, { createLogEntry } from './GameLog';

type CreateRoomResponse = {
  success: boolean;
  roomCode?: string;
  playerId?: string;
  players?: Player[];
  error?: string;
  message?: string;
};

type GamePlayMode = 'singlePlayer' | 'multiplayer';

const LiarsDice: React.FC = () => {
  const [playerName, setPlayerName] = useState<string>('');
  const [roomCode, setRoomCode] = useState<string>('');
  const [playerId, setPlayerId] = useState<string>('');
  const [players, setPlayers] = useState<Player[]>([]);
  const [gameStatus, setGameStatus] = useState<GameStatus>('waiting');
  const [gameMode, setGameMode] = useState<GameMode>('start');
  const [currentBid, setCurrentBid] = useState<Bid | null>(null);
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState<number>(0);
  const [isEndGame, setIsEndGame] = useState<boolean>(false);
  const [lastAction, setLastAction] = useState<string>('Game started');
  const [gameLog, setGameLog] = useState<GameLogEntry[]>([createLogEntry('Game started')]);
  const [isReconnecting, setIsReconnecting] = useState<boolean>(false);
  const [isDisconnected, setIsDisconnected] = useState<boolean>(false);

  // Reset game state
  const resetGame = useCallback(() => {
    if (gameMode === 'multiplayer') {
      cleanup();
    }
    setPlayerName('');
    setRoomCode('');
    setPlayerId('');
    setPlayers([]);
    setGameStatus('waiting');
    setGameMode('start');
    setCurrentBid(null);
    setCurrentPlayerIndex(0);
    setIsEndGame(false);
    setLastAction('Game started');
    setGameLog([createLogEntry('Game started')]);
    setIsDisconnected(false);
    localStorage.removeItem('liarsDiceSession');
  }, [gameMode]);

  // Handle window close/refresh
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (gameMode === 'multiplayer') {
        cleanup();
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (gameMode === 'multiplayer') {
        cleanup();
      }
    };
  }, [gameMode]);

  // Try to restore session on mount
  useEffect(() => {
    const storedSession = localStorage.getItem('liarsDiceSession');
    if (storedSession) {
      try {
        const { roomCode: savedRoomCode, playerName: savedName } = JSON.parse(storedSession);
        if (savedRoomCode && savedName) {
          setIsReconnecting(true);
          socketHandler.reconnectToRoom(savedRoomCode, savedName)
            .then((response) => {
              if (response.success && response.players) {
                setRoomCode(savedRoomCode);
                setPlayerName(savedName);
                setPlayers(response.players);
                setGameMode('multiplayer');
                setGameStatus(response.gameState || 'waiting');
                if (response.currentPlayerIndex !== undefined) {
                  setCurrentPlayerIndex(response.currentPlayerIndex);
                }
                if (response.currentBid) {
                  setCurrentBid(response.currentBid);
                }
                // Update playerId with the current player's socket ID
                const currentPlayer = response.players.find(p => p.name === savedName);
                if (currentPlayer) {
                  setPlayerId(currentPlayer.id);
                }
                setGameLog(prev => [createLogEntry(`Reconnected to game`), ...prev]);
                setIsDisconnected(false);
              } else {
                throw new Error('Failed to restore session');
              }
            })
            .catch((error) => {
              console.error('Reconnection failed:', error);
              localStorage.removeItem('liarsDiceSession');
              resetGame();
            })
            .finally(() => {
              setIsReconnecting(false);
            });
        }
      } catch (error) {
        console.error('Failed to parse stored session:', error);
        localStorage.removeItem('liarsDiceSession');
        resetGame();
      }
    }
  }, [resetGame]);

  // Check for end game scenario whenever players change
  useEffect(() => {
    if (gameStatus === 'playing') {
      setIsEndGame(isEndGameScenario(players));
    }
  }, [players, gameStatus]);

  // Handle computer turns in single player mode
  useEffect(() => {
    if (gameMode === 'singlePlayer' && 
        gameStatus === 'playing' && 
        !players[currentPlayerIndex]?.isHuman) {
      const computerTurnTimeout = setTimeout(() => {
        const currentPlayer = players[currentPlayerIndex];
        const move = generateComputerMove(currentPlayer, players, currentBid, isEndGame);

        if (move.shouldChallenge) {
          handleChallenge();
        } else if (move.bid) {
          handlePlaceBid(move.bid.quantity, move.bid.value);
        }
      }, 1000);

      return () => clearTimeout(computerTurnTimeout);
    }
  }, [currentPlayerIndex, gameMode, gameStatus, players, currentBid, isEndGame]);

  // Start new round
  const startNewRound = useCallback(() => {
    setCurrentBid(null);
    setPlayers(prev => prev.map(p => ({
      ...p,
      dice: rollDice(p.diceCount)
    })));
  }, []);

  // Set up socket event callbacks
  useEffect(() => {
    if (gameMode === 'multiplayer') {
      socketHandler.updateCallbacks({
        onConnect: () => {
          console.log('Socket connected');
          setIsDisconnected(false);
        },

        onDisconnect: (reason) => {
          console.log('Socket disconnected:', reason);
          setIsDisconnected(true);
          if (reason === 'io server disconnect') {
            resetGame();
          }
        },

        onPlayerJoined: (player) => {
          setPlayers(prev => [...prev, player]);
          setGameLog(prev => [createLogEntry(`${player.name} joined the game`), ...prev]);
        },

        onPlayerLeft: (data) => {
          setPlayers(prev => prev.map(p => 
            p.id === data.playerId ? { ...p, connected: false } : p
          ));
          const player = players.find(p => p.id === data.playerId);
          if (player) {
            setGameLog(prev => [createLogEntry(`${player.name} left the game`), ...prev]);
          }
        },

        onPlayerReconnected: (data) => {
          setPlayers(prev => prev.map((p, i) => 
            i === data.playerIndex ? { ...p, connected: true } : p
          ));
          setGameLog(prev => [createLogEntry(`${data.playerName} reconnected`), ...prev]);
        },

        onPlayerDisconnected: (data) => {
          setPlayers(prev => prev.map((p, i) => 
            i === data.playerIndex ? { ...p, connected: false } : p
          ));
          setGameLog(prev => [createLogEntry(`${data.playerName} disconnected`), ...prev]);
        },

        onGameStarted: (gameState) => {
          setPlayers(gameState.players);
          setCurrentPlayerIndex(gameState.currentPlayerIndex);
          setGameStatus('playing');
          // Update playerId with the current player's socket ID
          const currentPlayer = gameState.players.find(p => p.name === playerName);
          if (currentPlayer) {
            setPlayerId(currentPlayer.id);
          }
          setGameLog(prev => [createLogEntry('Game started'), ...prev]);
        },

        onBidPlaced: (data) => {
          setCurrentBid(data.bid);
          setCurrentPlayerIndex(data.nextPlayerIndex);
          const actionMessage = `${data.playerName} bid ${data.bid.quantity}x${data.bid.value}`;
          setLastAction(actionMessage);
          setGameLog(prev => [createLogEntry(actionMessage), ...prev]);
        },

        onChallengeResult: (result) => {
          setPlayers(result.players);
          setCurrentBid(null);
          let actionMessage;
          if (result.outcome === 'succeeded') {
            // Challenge succeeded - bidder loses
            actionMessage = `${result.challengerName} challenged ${result.bidderName}'s bid of ${result.bid.quantity}x${result.bid.value} and won! There were only ${result.actualCount} ${result.bid.value}'s`;
          } else {
            // Challenge failed - challenger loses
            actionMessage = `${result.challengerName} challenged ${result.bidderName}'s bid of ${result.bid.quantity}x${result.bid.value} and lost! There were ${result.actualCount} ${result.bid.value}'s`;
          }
          setLastAction(actionMessage);
          setGameLog(prev => [createLogEntry(actionMessage), ...prev]);
        },

        onNewRound: (data) => {
          console.log('New round started, current player:', data.currentPlayerIndex);
          setPlayers(data.players);
          setCurrentPlayerIndex(data.currentPlayerIndex);
          setCurrentBid(data.currentBid);
        },

        onGameOver: (data) => {
          setGameStatus('gameOver');
          setGameLog(prev => [createLogEntry(`Game Over! ${data.winner.name} wins!`), ...prev]);
          localStorage.removeItem('liarsDiceSession');
        },

        onError: (error) => {
          console.error('Socket error:', error);
          alert(error);
        }
      });

      return () => {
        socketHandler.updateCallbacks({});
      };
    }
  }, [gameMode, players, startNewRound, resetGame, playerName]);

  /**
   * Handles creating a new game
   */
  const handleCreateGame = async (name: string) => {
    try {
      setPlayerName(name);
      const response = await createRoom(name) as CreateRoomResponse;
      
      if (response.success && response.roomCode && response.playerId && response.players) {
        setRoomCode(response.roomCode);
        setPlayerId(response.playerId);
        setPlayers(response.players);
        setGameStatus('waiting');
        setGameMode('multiplayer');
        localStorage.setItem('liarsDiceSession', JSON.stringify({ 
          roomCode: response.roomCode, 
          playerName: name,
          timestamp: Date.now()
        }));
      } else {
        throw new Error(response.error || response.message || "Failed to create room");
      }
    } catch (error: any) {
      console.error('Create game failed:', error);
      alert(error.message || "Failed to create room. Please try again.");
      resetGame();
    }
  };

  /**
   * Handles joining an existing game
   */
  const handleJoinGame = async (code: string, name: string) => {
    try {
      setPlayerName(name);
      const response = await joinRoom(code, name) as CreateRoomResponse;
      
      if (response.success && response.playerId && response.players) {
        setRoomCode(code);
        setPlayerId(response.playerId);
        setPlayers(response.players);
        setGameStatus('waiting');
        setGameMode('multiplayer');
        localStorage.setItem('liarsDiceSession', JSON.stringify({ 
          roomCode: code, 
          playerName: name,
          timestamp: Date.now()
        }));
      } else {
        throw new Error(response.error || response.message || "Failed to join room");
      }
    } catch (error: any) {
      console.error('Join game failed:', error);
      alert(error.message || "Failed to join room. Please try again.");
      resetGame();
    }
  };

  /**
   * Handles starting a single player game
   */
  const handleStartSinglePlayer = (playerCount: number) => {
    const computerPlayers = Array.from({ length: playerCount - 1 }, (_, i) => ({
      id: `computer-${i}`,
      name: `Computer ${i + 1}`,
      diceCount: 5,
      dice: rollDice(5),
      isHuman: false,
      connected: true
    }));

    const humanPlayer = {
      id: 'human',
      name: 'You',
      diceCount: 5,
      dice: rollDice(5),
      isHuman: true,
      connected: true
    };

    setPlayers([humanPlayer, ...computerPlayers]);
    setGameStatus('playing');
    setGameMode('singlePlayer');
    setCurrentPlayerIndex(0);
  };

  /**
   * Handles starting a multiplayer game
   */
  const handleStartMultiplayer = async () => {
    try {
      const response = await startGame(roomCode);
      if (!response.success) {
        throw new Error(response.message || "Failed to start game");
      }
      setGameStatus('playing');
    } catch (error: any) {
      console.error('Start game failed:', error);
      alert(error.message || "Failed to start game. Please try again.");
    }
  };

  /**
   * Handles placing a bid
   */
  const handlePlaceBid = (quantity: number, value: number) => {
    const bid = { quantity, value };
    
    if (!isValidBid(bid, currentBid, isEndGame)) {
      alert('Invalid bid!');
      return;
    }

    setCurrentBid(bid);
    
    if (gameMode === 'multiplayer') {
      placeBid(roomCode, bid).catch(error => {
        console.error('Place bid failed:', error);
        alert(error.message || "Failed to place bid. Please try again.");
      });
    } else {
      setCurrentPlayerIndex((prevIndex) => (prevIndex + 1) % players.length);
      const actionMessage = `${players[currentPlayerIndex].name} bid ${quantity}x${value}`;
      setLastAction(actionMessage);
      setGameLog(prev => [createLogEntry(actionMessage), ...prev]);
    }
  };

  /**
   * Handles challenging a bid
   */
  const handleChallenge = () => {
    if (!currentBid) return;

    if (gameMode === 'multiplayer') {
      challenge(roomCode).catch(error => {
        console.error('Challenge failed:', error);
        alert(error.message || "Failed to challenge. Please try again.");
      });
    } else {
      const outcome = resolveChallengeOutcome(
        players,
        currentPlayerIndex,
        currentBid,
        isEndGame
      );
      
      setPlayers(prev => prev.map((p, i) => 
        i === outcome.loserIndex
          ? { ...p, diceCount: p.diceCount - 1, dice: p.dice.slice(1) }
          : p
      ));

      const actionMessage = `${outcome.challengerName} challenged ${outcome.bidderName}'s bid of ${currentBid.quantity}x${currentBid.value}! ` +
        `There were ${outcome.actualCount} ${currentBid.value}'s. ${outcome.loserName} loses a die!`;
      setLastAction(actionMessage);
      setGameLog(prev => [createLogEntry(actionMessage), ...prev]);
      
      const remainingPlayers = players.filter(p => 
        p.diceCount > 1 || (p.diceCount === 1 && players[outcome.loserIndex].id !== p.id)
      );
      
      if (remainingPlayers.length === 1) {
        setGameStatus('gameOver');
        const winner = remainingPlayers[0];
        setGameLog(prev => [createLogEntry(`Game Over! ${winner.name} wins!`), ...prev]);
      } else {
        setCurrentBid(null);
        setCurrentPlayerIndex((outcome.loserIndex + 1) % players.length);
        startNewRound();
      }
    }
  };

  /**
   * Renders the appropriate component based on game state
   */
  const renderGameState = () => {
    if (isReconnecting) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">Reconnecting to game...</h2>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          </div>
        </div>
      );
    }

    if (isDisconnected && gameMode === 'multiplayer') {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">Disconnected from server</h2>
            <p className="text-muted-foreground mb-4">Attempting to reconnect...</p>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <button
              onClick={resetGame}
              className="mt-8 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
            >
              Return to Main Menu
            </button>
          </div>
        </div>
      );
    }

    if (gameMode === 'start') {
      return (
        <StartScreen
          onSelectSinglePlayer={handleStartSinglePlayer}
          onSelectMultiplayer={() => setGameMode('create')}
          onSelectJoinGame={() => setGameMode('join')}
        />
      );
    }

    if (gameMode === 'create' || gameMode === 'join') {
      return (
        <JoinGame
          mode={gameMode}
          onJoin={handleJoinGame}
          onCreate={handleCreateGame}
          onCancel={() => {
            resetGame();
            setGameMode('start');
          }}
        />
      );
    }

    if (gameStatus === 'waiting' && gameMode === 'multiplayer') {
      return (
        <WaitingRoom
          roomCode={roomCode}
          players={players.map(p => p.name)}
          onStartGame={handleStartMultiplayer}
          onCancel={resetGame}
        />
      );
    }

    if (gameStatus === 'playing' && (gameMode === 'singlePlayer' || gameMode === 'multiplayer')) {
      const playMode: GamePlayMode = gameMode === 'singlePlayer' ? 'singlePlayer' : 'multiplayer';
      return (
        <div className="container mx-auto p-4 space-y-6">
          <GameBoard
            players={players}
            currentBid={currentBid}
            currentPlayerIndex={currentPlayerIndex}
            playerId={playerId}
            isEndGame={isEndGame}
            gameMode={playMode}
            lastAction={lastAction}
            onPlaceBid={handlePlaceBid}
            onChallenge={handleChallenge}
          />
          <GameLog entries={gameLog} />
          {gameMode === 'multiplayer' && (
            <div className="fixed bottom-4 right-4">
              <button
                onClick={resetGame}
                className="px-4 py-2 bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90"
              >
                Leave Game
              </button>
            </div>
          )}
        </div>
      );
    }

    if (gameStatus === 'gameOver') {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-4xl font-bold mb-8 bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">
              Game Over!
            </h2>
            <div className="space-y-4">
              <button
                onClick={resetGame}
                className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
              >
                Return to Main Menu
              </button>
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="min-h-screen bg-background">
      {renderGameState()}
    </div>
  );
};

export default LiarsDice;
