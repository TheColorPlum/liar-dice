'use client';

import React, { useState, useCallback, useEffect } from 'react';
import GameBoard from './GameBoard';
import GameLog, { addLogEntry } from './GameLog';
import GameControls from './GameControls';
import StartScreen from './StartScreen';
import JoinGame from './JoinGame';
import WaitingRoom from './WaitingRoom';
import socketHandler from '../lib/socket';
import { generateComputerMove } from '../utils/computerAI';
import { isValidBid, rollDice, isEndGameScenario, resolveChallengeOutcome } from '../utils/gameLogic';
import { Player, Bid, GameStatus, GameMode, GameLogEntry, GAME_CONSTANTS } from '../types/game';

/**
 * Main component for the Liar's Dice game
 */
const LiarsDice: React.FC = () => {
  // Game state
  const [gameMode, setGameMode] = useState<GameMode>('start');
  const [gameStatus, setGameStatus] = useState<GameStatus>('waiting');
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState<number>(0);
  const [currentBid, setCurrentBid] = useState<Bid | null>(null);
  const [lastAction, setLastAction] = useState<string>('');
  const [isEndGame, setIsEndGame] = useState<boolean>(false);
  const [winner, setWinner] = useState<{id: string; name: string} | null>(null);
  const [gameLog, setGameLog] = useState<GameLogEntry[]>([]);
  const [joinMode, setJoinMode] = useState<'join' | 'create'>('join');

  // Multiplayer state
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState<string>('');
  const [connectionError, setConnectionError] = useState<string | null>(null);

  /**
   * Adds a message to the game log
   */
  const addToGameLog = useCallback((message: string, unique: boolean = false) => {
    setGameLog(prevLog => addLogEntry(prevLog, message, unique));
  }, []);

  /**
   * Initializes the socket connection and handlers
   */
  useEffect(() => {
    if (gameMode !== 'multiplayer') return;

    socketHandler.updateCallbacks({
      onConnect: () => setConnectionError(null),
      onDisconnect: (reason) => console.log('Disconnected:', reason),
      onError: (error) => setConnectionError(error),
      onGameStarted: (gameData) => {
        setGameStatus('playing');
        setPlayers(gameData.players);
        setCurrentPlayerIndex(gameData.currentPlayerIndex);
        addToGameLog('The game has started!');
      },
      onPlayerJoined: (player) => {
        setPlayers(prev => [...prev, player]);
        addToGameLog(`${player.name} joined the game.`);
      },
      onBidPlaced: ({ bid, nextPlayerIndex, playerName }) => {
        setCurrentBid(bid);
        setCurrentPlayerIndex(nextPlayerIndex);
        addToGameLog(`${playerName} bid ${bid.quantity} ${bid.value}'s`);
        setLastAction(`${players[nextPlayerIndex].name}'s turn`);
      },
      onChallengeResult: (result) => {
        setPlayers(result.players);
        addToGameLog(
          `Challenge ${result.outcome}! There were ${result.actualCount} ${result.bid.value}'s. ${result.loserName} lost a die.`,
          true
        );
      },
      onNewRound: ({ players, currentPlayerIndex, currentBid }) => {
        setPlayers(players);
        setCurrentPlayerIndex(currentPlayerIndex);
        setCurrentBid(currentBid); // This will be null from server
        setLastAction(`New round started. ${players[currentPlayerIndex].name}'s turn`);
        addToGameLog('New round started.');
      },
      onGameOver: ({ winner, reason }) => {
        setGameStatus('gameOver');
        setWinner(winner);
      },
      onGameReset: (gameData) => {
        setPlayers(gameData.players);
        setCurrentPlayerIndex(gameData.currentPlayerIndex);
        setGameStatus(gameData.gameStatus);
        setCurrentBid(null);
        setLastAction('Game reset. New game started.');
        addToGameLog('Game has been reset. All players now have 5 dice.');
        setWinner(null);
        setIsEndGame(false);
      }
    });

    return () => {
      socketHandler.updateCallbacks({});
    };
  }, [addToGameLog, players, gameMode]);

  /**
   * Handles computer player turns in single player mode
   */
  useEffect(() => {
    if (gameMode === 'singlePlayer' && gameStatus === 'playing') {
      const currentPlayer = players[currentPlayerIndex];
      if (currentPlayer && !currentPlayer.isHuman) {
        const timer = setTimeout(() => {
          const move = generateComputerMove(currentPlayer, players, currentBid, isEndGame);
          
          if (move.shouldChallenge) {
            handleChallenge();
          } else if (move.bid) {
            handleBid(move.bid.quantity, move.bid.value);
          }
        }, 1000);
        return () => clearTimeout(timer);
      }
    }
  }, [gameMode, gameStatus, currentPlayerIndex, players, currentBid, isEndGame]);

  /**
   * Monitors players state for end-game scenario
   */
  useEffect(() => {
    if (isEndGameScenario(players)) {
      setIsEndGame(true);
      addToGameLog('End game scenario: Only two players with one die each remain!');
    }
  }, [players, addToGameLog]);

  /**
   * Starts a new round of the game
   */
  const startNewRound = useCallback((startingPlayerIndex?: number) => {
    setPlayers(prevPlayers => 
      prevPlayers.map(player => ({
        ...player,
        dice: rollDice(player.diceCount)
      }))
    );

    setCurrentBid(null);
    setGameStatus('playing');
    setCurrentPlayerIndex(startingPlayerIndex ?? 0);
    setLastAction('New round started');
    addToGameLog('New round started.');
    setWinner(null);
  }, [addToGameLog]);

  /**
   * Handles placing a bid
   */
  const handleBid = async (quantity: number, value: number) => {
    const newBid = { quantity: isEndGame ? 1 : quantity, value };
    
    if (!isValidBid(newBid, currentBid, isEndGame)) {
      alert('Invalid bid. Please check the rules and try again.');
      return;
    }

    if (gameMode === 'multiplayer' && roomCode) {
      const response = await socketHandler.placeBid(roomCode, newBid);
      if (!response.success) {
        alert('Failed to place bid. Please try again.');
      }
    } else {
      const currentPlayer = players[currentPlayerIndex];
      setCurrentBid(newBid);
      addToGameLog(`${currentPlayer.name} bid ${newBid.quantity} ${newBid.value}'s`);
      const nextPlayerIndex = (currentPlayerIndex + 1) % players.length;
      setCurrentPlayerIndex(nextPlayerIndex);
      setLastAction(`${players[nextPlayerIndex].name}'s turn`);
    }
  };

  /**
   * Handles challenging a bid
   */
  const handleChallenge = async () => {
    if (gameMode === 'multiplayer' && roomCode) {
      const response = await socketHandler.challenge(roomCode);
      if (!response.success) {
        alert('Failed to challenge. Please try again.');
      }
    } else {
      const outcome = resolveChallengeOutcome(
        players,
        currentPlayerIndex,
        currentBid!,
        isEndGame
      );

      const updatedPlayers = [...players];
      const loserIndex = outcome.loserIndex;
      updatedPlayers[loserIndex].diceCount--;
      updatedPlayers[loserIndex].dice = updatedPlayers[loserIndex].dice.slice(0, updatedPlayers[loserIndex].diceCount);

      if (isEndGame) {
        addToGameLog(`Challenge ${outcome.outcome}! The total value was ${outcome.actualCount}. ${outcome.loserName} lost the game.`);
      } else {
        addToGameLog(`Challenge ${outcome.outcome}! There were ${outcome.actualCount} ${currentBid!.value}'s. ${outcome.loserName} lost a die.`);
      }

      if (updatedPlayers[loserIndex].diceCount === 0) {
        updatedPlayers.splice(loserIndex, 1);
      }

      setPlayers(updatedPlayers);
      
      if (updatedPlayers.length <= 1) {
        setGameStatus('gameOver');
        setWinner(updatedPlayers[0]);
      } else {
        // Ensure state is synchronized by using a callback
        setPlayers(currentPlayers => {
          startNewRound(loserIndex);
          return currentPlayers;
        });
      }
    }
  };

  /**
   * Resets the game to initial state
   */
  const handleReset = useCallback(() => {
    const initialPlayers = players.map(player => ({
      ...player,
      diceCount: GAME_CONSTANTS.TOTAL_DICE,
      dice: rollDice(GAME_CONSTANTS.TOTAL_DICE)
    }));

    if (gameMode === 'multiplayer' && roomCode) {
      socketHandler.resetGame(roomCode, initialPlayers);
    } else {
      setPlayers(initialPlayers);
      setCurrentBid(null);
      setGameStatus('playing');
      setCurrentPlayerIndex(0);
      setLastAction('Game reset. New game started.');
      addToGameLog('Game has been reset. All players now have 5 dice.');
      setWinner(null);
      setIsEndGame(false);
    }
  }, [players, gameMode, roomCode, addToGameLog]);

  /**
   * Handles starting a single player game
   */
  const handleSelectSinglePlayer = (playerCount: number) => {
    const newPlayers: Player[] = [
      { 
        id: '1', 
        name: 'You', 
        dice: rollDice(GAME_CONSTANTS.TOTAL_DICE), 
        diceCount: GAME_CONSTANTS.TOTAL_DICE, 
        isHuman: true, 
        connected: true 
      },
      ...Array(playerCount - 1).fill(null).map((_, i) => ({
        id: (i + 2).toString(),
        name: `Computer ${i + 1}`,
        dice: rollDice(GAME_CONSTANTS.TOTAL_DICE),
        diceCount: GAME_CONSTANTS.TOTAL_DICE,
        isHuman: false,
        connected: true
      }))
    ];

    setGameMode('singlePlayer');
    setPlayers(newPlayers);
    setGameStatus('playing');
    startNewRound();
  };

  /**
   * Handles starting a multiplayer game
   */
  const handleSelectMultiplayer = () => {
    setJoinMode('create');
    setGameMode('joinGame');
  };

  /**
   * Handles creating a new game
   */
  const handleCreateGame = async (name: string) => {
    setPlayerName(name);
    
    const response = await socketHandler.createRoom(name);
    if (response.success && response.roomCode && response.playerId && response.players) {
      setRoomCode(response.roomCode);
      setPlayerId(response.playerId);
      setPlayers(response.players);
      setGameStatus('waiting');
      setGameMode('multiplayer');
      localStorage.setItem('roomInfo', JSON.stringify({ roomCode: response.roomCode, playerName: name }));
    } else {
      alert("Failed to create room. Please try again.");
    }
  };

  /**
   * Handles joining an existing game
   */
  const handleJoinGame = async (code: string, name: string) => {
    const response = await socketHandler.joinRoom(code, name);
    if (response.success && response.playerId && response.players) {
      setRoomCode(code);
      setPlayerId(response.playerId);
      setPlayers(response.players);
      setPlayerName(name);
      setGameMode('multiplayer');
      addToGameLog(`You joined the game.`);
    } else {
      alert(response.message || 'Failed to join game');
    }
  };

  /**
   * Handles starting a multiplayer game
   */
  const handleStartGame = async () => {
    if (roomCode) {
      const response = await socketHandler.startGame(roomCode);
      if (!response.success) {
        setConnectionError(response.message || 'Failed to start game');
      }
    }
  };

  /**
   * Renders the appropriate component based on game state
   */
  if (gameMode === 'start') {
    return (
      <StartScreen
        onSelectSinglePlayer={handleSelectSinglePlayer}
        onSelectMultiplayer={handleSelectMultiplayer}
        onSelectJoinGame={() => {
          setJoinMode('join');
          setGameMode('joinGame');
        }}
      />
    );
  }

  if (gameMode === 'joinGame') {
    return (
      <JoinGame
        mode={joinMode}
        onJoin={handleJoinGame}
        onCreate={handleCreateGame}
        onCancel={() => setGameMode('start')}
      />
    );
  }

  if (gameMode === 'multiplayer' && gameStatus === 'waiting' && roomCode) {
    return (
      <WaitingRoom
        roomCode={roomCode}
        players={players.map(p => p.name)}
        onStartGame={handleStartGame}
        onCancel={() => setGameMode('start')}
      />
    );
  }

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h1 className="game-title">Liar's Dice</h1>
      
      {connectionError && gameMode === 'multiplayer' && (
        <div className="error-message bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
          <strong className="font-bold">Error:</strong>
          <span className="block sm:inline"> {connectionError}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
        <div>
          <GameBoard
            players={players}
            currentBid={currentBid}
            currentPlayerIndex={currentPlayerIndex}
            playerId={playerId}
            isEndGame={isEndGame}
            gameMode={gameMode === 'singlePlayer' ? 'singlePlayer' : 'multiplayer'}
            lastAction={lastAction}
            onPlaceBid={handleBid}
            onChallenge={handleChallenge}
          />
        </div>
        <GameLog entries={gameLog} />
      </div>

      <GameControls
        gameStatus={gameStatus}
        winner={winner}
        onReset={handleReset}
        onCancel={() => setGameMode('start')}
        isHost={playerId === players[0]?.id}
        onStartGame={handleStartGame}
        roomCode={roomCode}
      />
    </div>
  );
};

export default LiarsDice;
