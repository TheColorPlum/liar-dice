'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dice1, Dice2, Dice3, Dice4, Dice5, Dice6 } from 'lucide-react';

const TOTAL_DICE = 5;
const DICE_SIDES = 6;
const MIN_BID_VALUE = 2;
const MAX_END_GAME_BID = 12;

const DiceIcon = ({ value, hidden }: { value: number; hidden: boolean }) => {
  const DiceComponents = [Dice1, Dice2, Dice3, Dice4, Dice5, Dice6];
  const Component = DiceComponents[hidden ? 5 : value - 1];
  return <Component className="w-8 h-8 text-primary" />;
};

const StartScreen: React.FC<{ onSelectSinglePlayer: (players: number) => void; onSelectMultiplayer: () => void; onSelectJoinGame: () => void }> = 
({ onSelectSinglePlayer, onSelectMultiplayer, onSelectJoinGame }) => {
  const [playerCount, setPlayerCount] = useState(2);

  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <h1 className="text-4xl font-bold mb-8">Liar's Dice</h1>
      <div className="space-y-4">
        <div>
          <Select onValueChange={(value) => setPlayerCount(parseInt(value))} value={playerCount.toString()}>
            <SelectTrigger className="w-full mb-2">
              <SelectValue placeholder="Select number of players" />
            </SelectTrigger>
            <SelectContent>
              {[2, 3, 4, 5, 6].map(num => (
                <SelectItem key={num} value={num.toString()}>{num} players</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => onSelectSinglePlayer(playerCount)} className="w-full">Single Player</Button>
        </div>
        <Button onClick={onSelectMultiplayer} className="w-full">Multiplayer</Button>
        <Button onClick={onSelectJoinGame} className="w-full">Join Game</Button>
      </div>
    </div>
  );
};

const WaitingRoom: React.FC<{ roomCode: string; players: Array<{id: string; name: string}>; onStartGame: () => void; onCancel: () => void; isHost: boolean }> = 
({ roomCode, players, onStartGame, onCancel, isHost }) => {
  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <h2 className="text-2xl font-bold mb-4">Waiting Room</h2>
      <p className="mb-4">Room Code: <span className="font-bold">{roomCode}</span></p>
      <h3 className="text-xl mb-2">Players:</h3>
      <ul className="mb-4">
        {players.map((player) => (
          <li key={player.id}>{player.name}{player.id === players[0].id ? ' (Host)' : ''}</li>
        ))}
      </ul>
      <div className="space-x-4">
        {isHost && <Button onClick={onStartGame}>Start Game</Button>}
        <Button onClick={onCancel} variant="outline">Cancel</Button>
      </div>
    </div>
  );
};

const JoinGame: React.FC<{ onJoin: (code: string, name: string) => void; onCancel: () => void }> = ({ onJoin, onCancel }) => {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');

  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <h2 className="text-2xl font-bold mb-4">Join Game</h2>
      <Input 
        type="text" 
        value={code} 
        onChange={(e) => setCode(e.target.value)} 
        placeholder="Enter game code"
        className="mb-4"
      />
      <Input 
        type="text" 
        value={name} 
        onChange={(e) => setName(e.target.value)} 
        placeholder="Enter your name"
        className="mb-4"
      />
      <div className="space-x-4">
        <Button onClick={() => onJoin(code, name)} disabled={!code || !name}>Join</Button>
        <Button onClick={onCancel} variant="outline">Cancel</Button>
      </div>
    </div>
  );
};

const LiarsDice = () => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [gameMode, setGameMode] = useState<'start' | 'singlePlayer' | 'multiplayer' | 'joinGame' | 'playing'>('start');
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [players, setPlayers] = useState<Array<{id: string; name: string; dice: number[]; diceCount: number; isHuman: boolean}>>([]);
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState<number>(0);
  const [currentBid, setCurrentBid] = useState<{quantity: number; value: number} | null>(null);
  const [gameStatus, setGameStatus] = useState<'waiting' | 'playing' | 'roundEnd' | 'gameOver'>('waiting');
  const [bidQuantity, setBidQuantity] = useState<string>('');
  const [bidValue, setBidValue] = useState<string>('');
  const [lastAction, setLastAction] = useState<string>('');
  const [isEndGame, setIsEndGame] = useState<boolean>(false);
  const [gameLog, setGameLog] = useState<Array<{id: number; message: string}>>([]);
  const [winner, setWinner] = useState<{id: string; name: string} | null>(null);
  const [lastBidPlayerId, setLastBidPlayerId] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState<string>('');

  const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';

  const addToGameLog = useCallback((entry: string) => {
    setGameLog(prevLog => [...prevLog, { id: Date.now(), message: entry }]);
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const computerTurn = () => {
    const currentPlayer = players[currentPlayerIndex];
    if (currentPlayer.isHuman) {
      console.error("Computer turn called for human player");
      return;
    }
    console.log(`Computer ${currentPlayer.name}'s turn`);
    const ownDice = currentPlayer.dice;
    const totalDice = players.reduce((sum, player) => sum + player.diceCount, 0);
    
    let newBid;
    if (!currentBid) {
      const mostCommonValue = [...Array(6)].map((_, i) => 
        ownDice.filter(d => d === i + 1 || d === 1).length
      ).indexOf(Math.max(...[...Array(6)].map((_, i) => 
        ownDice.filter(d => d === i + 1 || d === 1).length
      ))) + 1;
      
      newBid = { 
        quantity: Math.max(1, Math.floor(ownDice.filter(d => d === mostCommonValue || d === 1).length * 1.5)), 
        value: mostCommonValue 
      };
    } else {
      const ownCount = ownDice.filter(die => die === currentBid.value || die === 1).length;
      const estimatedTotal = Math.round(ownCount * (totalDice / currentPlayer.diceCount));
      const confidenceThreshold = 0.7;

      if (estimatedTotal < currentBid.quantity * confidenceThreshold) {
        console.log("Computer decides to challenge");
        challenge();
        return;
      } else {
        let attempts = 0;
        do {
          let newQuantity = currentBid.quantity;
          let newValue = currentBid.value;

          if (Math.random() < 0.7) {
            newQuantity++;
          } else {
            newValue = Math.min(newValue + 1, DICE_SIDES);
            if (newValue === currentBid.value) newQuantity++;
          }

          newBid = { quantity: newQuantity, value: newValue };
          attempts++;
          if (attempts > 10) break;  // Prevent infinite loop
        } while (!isValidBid(newBid));
      }
    }
    
    console.log(`Computer places bid: ${newBid.quantity} ${newBid.value}`);
    setCurrentBid(newBid);
    addToGameLog(`${currentPlayer.name} bid ${newBid.quantity} ${newBid.value}'s`);
    const nextPlayerIndex = (currentPlayerIndex + 1) % players.length;
    setCurrentPlayerIndex(nextPlayerIndex);
    
    if (!players[nextPlayerIndex].isHuman) {
      setTimeout(() => computerTurn(), 1000);
    }
  };

  useEffect(() => {
    const newSocket = io(socketUrl, {
      transports: ['websocket'],
      upgrade: false,
    });

    newSocket.on('connect', () => {
      setConnectionError(null);
      console.log('Connected to server');
    });

    newSocket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      setConnectionError('Error connecting to game server. Please try again later.');
    });

    newSocket.on('playerJoined', (newPlayer) => {
      setPlayers(prevPlayers => [...prevPlayers, newPlayer]);
      addToGameLog(`${newPlayer.name} joined the game.`);
    });

    newSocket.on('gameStarted', (gameData) => {
      setGameStatus('playing');
      setPlayers(gameData.players);
      setCurrentPlayerIndex(gameData.currentPlayerIndex);
      addToGameLog('The game has started!');
    });

    newSocket.on('bidPlaced', ({ bid, nextPlayerIndex, playerName, playerId }) => {
      console.log(`Received bidPlaced event. Bid: ${bid.quantity} ${bid.value}, Next player index: ${nextPlayerIndex}`);
      setCurrentBid(prevBid => {
        console.log(`Updating current bid from ${JSON.stringify(prevBid)} to ${JSON.stringify(bid)}`);
        return bid;
      });
      setCurrentPlayerIndex(prevIndex => {
        console.log(`Updating current player index from ${prevIndex} to ${nextPlayerIndex}`);
        return nextPlayerIndex;
      });
      
      // Add this condition to include the player's own bids
      if (playerId === newSocket.id) {
        playerName = 'You';
      }
      
      const logMessage = `${playerName} bid ${bid.quantity} ${bid.value}'s`;
      addToGameLog(logMessage);
      setLastAction(logMessage);
    });

    newSocket.on('challengeResult', (result) => {
      addToGameLog(`Challenge result: ${result.actualCount} ${result.bid.value}'s. ${result.loserName} lost a die.`);
    });

    newSocket.on('newRound', ({ players, currentPlayerIndex }) => {
      setPlayers(players);
      setCurrentBid(null);
      setCurrentPlayerIndex(currentPlayerIndex);
      setGameStatus('playing');
      addToGameLog('New round started.');
    });

    newSocket.on('gameOver', ({ winner, reason }) => {
      setGameStatus('gameOver');
      setWinner(winner);
      addToGameLog(reason ? `Game over: ${reason}` : `Game over! ${winner.name} wins!`);
    });

    newSocket.on('playerLeft', ({ playerId, nextPlayerIndex }) => {
      setPlayers(prevPlayers => prevPlayers.filter(p => p.id !== playerId));
      setCurrentPlayerIndex(nextPlayerIndex);
      addToGameLog(`A player has left the game.`);
    });

    setSocket(newSocket);

    return () => {
      if (newSocket.connected) {
        console.log('Disconnecting socket on cleanup');
        newSocket.disconnect();
      }
    };
  }, [socketUrl, addToGameLog]);

  useEffect(() => {
    if (gameMode === 'singlePlayer' && gameStatus === 'playing' && !players[currentPlayerIndex]?.isHuman) {
      const timer = setTimeout(computerTurn, 1000);
      return () => clearTimeout(timer);
    }
  }, [gameMode, gameStatus, currentPlayerIndex, players, computerTurn]);

  useEffect(() => {
    console.log(`Game state updated. Current player: ${currentPlayerIndex}, Current bid: ${JSON.stringify(currentBid)}`);
  }, [currentPlayerIndex, currentBid]);

  const handleSelectSinglePlayer = (playerCount: number) => {
    setGameMode('singlePlayer');
    const newPlayers = [
      { id: '1', name: 'You', dice: [], diceCount: TOTAL_DICE, isHuman: true },
      ...Array(playerCount - 1).fill(null).map((_, i) => ({
        id: (i + 2).toString(),
        name: `Computer ${i + 1}`,
        dice: [],
        diceCount: TOTAL_DICE,
        isHuman: false
      }))
    ];

    setPlayers(newPlayers);
    setGameStatus('playing');
    startNewRound();
  };

  const handleSelectMultiplayer = () => {
    setGameMode('multiplayer');
    const name = prompt("Enter your name:") || "Player";
    setPlayerName(name);
    if (socket) {
      console.log("Emitting createRoom event");
      socket.emit('createRoom', { playerName: name }, (response: { roomCode: string, playerId: string, error?: string }) => {
        console.log("Received createRoom response:", response);
        if (response.error) {
          console.error("Error creating room:", response.error);
          alert("Failed to create room. Please try again.");
          return;
        }
        setRoomCode(response.roomCode);
        setPlayerId(response.playerId);
        setPlayers([{ id: response.playerId, name: name, dice: [], diceCount: TOTAL_DICE, isHuman: true }]);
        setGameStatus('waiting');
      });
    }
  };

  const handleSelectJoinGame = () => {
    setGameMode('joinGame');
  };

  const handleJoinGame = (code: string, name: string) => {
    if (socket) {
      socket.emit('joinRoom', { roomCode: code, playerName: name }, (response: { success: boolean, playerId: string, players: any[], message?: string }) => {
        if (response.success) {
          setRoomCode(code);
          setPlayerId(response.playerId);
          setPlayers(response.players);
          setPlayerName(name);
          setGameMode('multiplayer');
        } else {
          alert(response.message || 'Failed to join game');
        }
      });
    }
  };

  const handleStartGame = () => {
    if (socket && roomCode) {
      socket.emit('startGame', { roomCode }, (response: { success: boolean, message?: string }) => {
        if (response.success) {
          setGameStatus('playing');
        } else {
          setConnectionError(response.message || 'Failed to start game');
        }
      });
    }
  };

  const handleCancel = () => {
    setGameMode('start');
    setRoomCode(null);
    setPlayers([]);
  };

  const startNewRound = () => {
    setPlayers(prevPlayers => prevPlayers.map(player => ({
      ...player,
      dice: Array.from({ length: player.diceCount }, () => Math.floor(Math.random() * DICE_SIDES) + 1)
    })));
    setCurrentBid(null);
    setGameStatus('playing');
    setCurrentPlayerIndex(0);
    setBidQuantity('');
    setBidValue('');
    setLastAction('New round started');
    addToGameLog('New round started.');
    setWinner(null);  // Reset the winner state
  
    // If it's single-player mode and the first player is not human, start computer turn
    if (gameMode === 'singlePlayer' && !players[0].isHuman) {
      setTimeout(computerTurn, 1000);
    }
  };

  const isValidBid = (newBid: {quantity: number, value: number}) => {
    if (newBid.quantity < 1 || newBid.value < MIN_BID_VALUE || newBid.value > DICE_SIDES) {
      return false;
    }
    if (!currentBid) return true;
    if (newBid.quantity < currentBid.quantity) return false;
    if (newBid.quantity === currentBid.quantity && newBid.value <= currentBid.value) return false;
    return true;
  };

  const placeBid = () => {
    const newBid = { 
      quantity: parseInt(bidQuantity), 
      value: parseInt(bidValue) 
    };
    if (!isValidBid(newBid)) {
      alert('Invalid bid. Please enter a higher bid.');
      return;
    }
    console.log(`Attempting to place bid: ${newBid.quantity} ${newBid.value}`);
    
    const currentPlayer = players[currentPlayerIndex];
    setLastBidPlayerId(currentPlayer.id);
    
    if (gameMode === 'multiplayer' && socket && roomCode) {
      console.log(`Emitting placeBid event to server. RoomCode: ${roomCode}`);
      socket.emit('placeBid', { roomCode, bid: newBid }, (response: any) => {
        console.log('Server response to placeBid:', response);
        if (!response.success) {
          console.error('Failed to place bid:', response.error);
          alert('Failed to place bid. Please try again.');
        }
        // Remove the local game log update from here
      });
    } else if (gameMode === 'singlePlayer') {
      setCurrentBid(newBid);
      const logMessage = `${currentPlayer.name} bid ${newBid.quantity} ${newBid.value}'s`;
      addToGameLog(logMessage);
      setLastAction(logMessage);
      
      const nextPlayerIndex = (currentPlayerIndex + 1) % players.length;
      console.log(`Next player index: ${nextPlayerIndex}`);
      setCurrentPlayerIndex(nextPlayerIndex);
      
      if (!players[nextPlayerIndex].isHuman) {
        setTimeout(() => computerTurn(), 1000);
      }
    }
    
    setBidQuantity('');
    setBidValue('');
  };

  const challenge = () => {
    if (gameMode === 'multiplayer' && socket && roomCode) {
      socket.emit('challenge', { roomCode });
    } else {
      console.log('Implementing single player challenge logic');
      const totalDice = players.flatMap(player => player.dice);
      const actualCount = totalDice.filter(die => die === currentBid!.value || die === 1).length;
      
      const challengerIndex = currentPlayerIndex;
      const bidderIndex = (challengerIndex - 1 + players.length) % players.length;
      
      let loserIndex;
      let challengeOutcome;
      if (actualCount >= currentBid!.quantity) {
        loserIndex = challengerIndex;
        challengeOutcome = 'failed';
      } else {
        loserIndex = bidderIndex;
        challengeOutcome = 'succeeded';
      }
      
      const updatedPlayers = [...players];
      updatedPlayers[loserIndex].diceCount--;
      
      const challengeResult = {
        challengerName: players[challengerIndex].name,
        bidderName: players[bidderIndex].name,
        loserName: players[loserIndex].name,
        challengerIndex,
        bidderIndex,
        loserIndex,
        actualCount,
        bid: currentBid,
        outcome: challengeOutcome
      };
      
      addToGameLog(`Challenge ${challengeOutcome}! There were ${actualCount} ${currentBid!.value}'s. ${challengeResult.loserName} lost a die.`);
      
      if (updatedPlayers[loserIndex].diceCount === 0) {
        updatedPlayers.splice(loserIndex, 1);
      }
      
      if (updatedPlayers.length <= 1) {
        setGameStatus('gameOver');
        setWinner(updatedPlayers[0]);
      } else {
        setPlayers(updatedPlayers);
        setCurrentPlayerIndex(loserIndex % updatedPlayers.length);
        setCurrentBid(null);
        startNewRound();
      }
    }
  };

  if (gameMode === 'start') {
    return (
      <StartScreen 
        onSelectSinglePlayer={handleSelectSinglePlayer}
        onSelectMultiplayer={handleSelectMultiplayer}
        onSelectJoinGame={handleSelectJoinGame}
      />
    );
  }

  if (gameMode === 'multiplayer' && gameStatus === 'waiting') {
    return (
      <WaitingRoom 
        roomCode={roomCode!}
        players={players}
        onStartGame={handleStartGame}
        onCancel={handleCancel}
        isHost={playerId === players[0]?.id}
      />
    );
  }

  if (gameMode === 'joinGame') {
    return <JoinGame onJoin={handleJoinGame} onCancel={handleCancel} />;
  }

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h1 className="text-4xl font-bold mb-8 text-center">Liar's Dice</h1>
      
      {connectionError && (
        <div className="error-message bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
          <strong className="font-bold">Error:</strong>
          <span className="block sm:inline"> {connectionError}</span>
        </div>
      )}
  
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
        <div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {players.map((player) => (
              <Card key={player.id}>
                <CardHeader>
                  <h2 className="text-xl font-semibold">{player.name}</h2>
                  <p>Dice: {player.diceCount}</p>
                </CardHeader>
                <CardContent className="flex flex-wrap justify-center items-center gap-2 p-4">
                  {((gameMode === 'singlePlayer' && player.isHuman) || (gameMode === 'multiplayer' && player.id === playerId)) ? (
                    player.dice.map((die, i) => (
                      <DiceIcon key={i} value={die} hidden={false} />
                    ))
                  ) : (
                    Array(player.diceCount).fill(0).map((_, i) => (
                      <DiceIcon key={i} value={6} hidden={true} />
                    ))
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
          <Card className="mb-8">
            <CardContent className="p-6">
              <h2 className="text-2xl font-semibold mb-4">
              Current Bid: {currentBid ? `${currentBid.quantity} ${currentBid.value}'s` : 'No bid'}
              </h2>
              <p className="text-lg mb-4">Last Action: {lastAction}</p>
              {gameStatus === 'playing' && (
                (gameMode === 'singlePlayer' && players[currentPlayerIndex]?.isHuman) || 
                (gameMode === 'multiplayer' && players[currentPlayerIndex]?.id === playerId)
              ) && (
                <div className="flex flex-wrap gap-4 items-end">
                  <Input
                    type="number"
                    placeholder="Quantity"
                    value={bidQuantity}
                    onChange={(e) => setBidQuantity(e.target.value)}
                    className="w-32"
                  />
                  <Select onValueChange={setBidValue} value={bidValue}>
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="Select value" />
                    </SelectTrigger>
                    <SelectContent>
                      {[2, 3, 4, 5, 6].map(value => (
                        <SelectItem key={value} value={value.toString()}>{value}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button onClick={placeBid}>Place Bid</Button>
                  {currentBid && <Button onClick={challenge} variant="outline">Challenge</Button>}
                </div>
              )}
              {gameStatus === 'playing' && (
                (gameMode === 'singlePlayer' && !players[currentPlayerIndex]?.isHuman) ||
                (gameMode === 'multiplayer' && players[currentPlayerIndex]?.id !== playerId)
              ) && (
                <p className="text-lg font-semibold animate-pulse">{players[currentPlayerIndex]?.name} is thinking...</p>
              )}
            </CardContent>
          </Card>
        </div>
        <Card>
          <CardHeader>
            <h2 className="text-2xl font-semibold">Game Log</h2>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px] w-full rounded-md border p-4">
              {gameLog.map((entry) => (
                <p key={entry.id} className="mb-2">{entry.message}</p>
              ))}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
      {gameStatus === 'gameOver' && winner && (
        <div className="text-center">
          <h2 className="text-3xl font-bold mb-4">Game Over! {winner.name} wins!</h2>
          <Button onClick={startNewRound}>Start New Round</Button>
        </div>
      )}
    </div>
  );
};

export default LiarsDice;