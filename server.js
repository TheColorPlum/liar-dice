const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

const TOTAL_DICE = 5;
const DICE_SIDES = 6;

const rooms = new Map();

function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function rollDice(count) {
  return Array.from({ length: count }, () => Math.floor(Math.random() * DICE_SIDES) + 1);
}

function logRooms() {
  console.log("Current rooms:");
  rooms.forEach((room, code) => {
    console.log(`Room ${code}: ${room.players.length} players, state: ${room.gameState}`);
    console.log("Players:", room.players.map(p => ({ id: p.id, name: p.name, connected: p.connected })));
  });
}

io.on('connection', (socket) => {
  console.log('A user connected');
  console.log(`New connection: ${socket.id}`);

  socket.on('createRoom', ({ playerName }, callback) => {
    console.log(`Creating room for player: ${playerName}`);
    try {
      const roomCode = generateRoomCode();
      const newPlayer = { 
        id: socket.id, 
        name: playerName, 
        dice: [], 
        diceCount: TOTAL_DICE, 
        isHuman: true, 
        connected: true 
      };
      const room = { 
        players: [newPlayer],
        gameState: 'waiting',
        currentPlayerIndex: 0,
        currentBid: null
      };
      rooms.set(roomCode, room);
      socket.join(roomCode);
      console.log(`Room created: ${roomCode}, Player: ${playerName}, ID: ${socket.id}`);
      callback({ success: true, roomCode, playerId: socket.id, players: room.players });
      
      // Emit a room update to all clients in the room
      io.to(roomCode).emit('roomUpdate', { players: room.players });
    } catch (error) {
      console.error('Error in createRoom:', error);
      callback({ success: false, error: 'Failed to create room' });
    }
  });
  
  socket.on('reconnectToRoom', ({ roomCode, playerName }, callback) => {
    console.log(`Player ${playerName} attempting to reconnect to room ${roomCode}`);
    const room = rooms.get(roomCode);
    if (room) {
      const playerIndex = room.players.findIndex(p => p.name === playerName);
      if (playerIndex !== -1) {
        room.players[playerIndex].id = socket.id;
        room.players[playerIndex].connected = true;
        socket.join(roomCode);
        console.log(`Player ${playerName} reconnected to room ${roomCode}`);
        callback({ success: true, players: room.players });
        io.to(roomCode).emit('roomUpdate', { players: room.players });
      } else {
        callback({ success: false, error: 'Player not found in room' });
      }
    } else {
      callback({ success: false, error: 'Room not found' });
    }
  });
  
  socket.on('joinRoom', ({ roomCode, playerName }, callback) => {
    console.log(`Player ${playerName} attempting to join room ${roomCode}`);
    try {
      const room = rooms.get(roomCode);
      if (room && room.gameState === 'waiting') {
        const newPlayer = { 
          id: socket.id, 
          name: playerName, 
          dice: [], 
          diceCount: TOTAL_DICE, 
          isHuman: true, 
          connected: true 
        };
        room.players.push(newPlayer);
        socket.join(roomCode);
        console.log(`Player ${playerName} joined room ${roomCode}. Total players: ${room.players.length}`);
        io.to(roomCode).emit('playerJoined', newPlayer);
        callback({ success: true, playerId: socket.id, players: room.players });
      } else {
        console.log(`Failed to join room ${roomCode}. Room state: ${room ? room.gameState : 'not found'}`);
        callback({ success: false, message: 'Room not found or game already started' });
      }
    } catch (error) {
      console.error('Error in joinRoom:', error);
      callback({ success: false, message: 'Failed to join room' });
    }
  });
  
  socket.on('startGame', ({ roomCode }, callback) => {
    console.log(`Received startGame event for room ${roomCode}`);
    try {
      const room = rooms.get(roomCode);
      if (room && room.gameState === 'waiting' && room.players.length >= 2) {
        room.gameState = 'playing';
        room.currentPlayerIndex = 0;
        room.currentBid = null;
        
        room.players.forEach(player => {
          player.dice = rollDice(player.diceCount);
          player.connected = true;
        });

        // Randomly select the first player
        room.currentPlayerIndex = Math.floor(Math.random() * room.players.length);
        
        console.log(`Starting game in room ${roomCode}`);
        io.in(roomCode).emit('gameStarted', { 
          players: room.players, 
          currentPlayerIndex: room.currentPlayerIndex 
        });
        
        rooms.set(roomCode, room);
        callback({ success: true });
      } else {
        console.log(`Failed to start game in room ${roomCode}. Room state: ${room ? room.gameState : 'not found'}`);
        callback({ success: false, message: room ? 'Not enough players or game already started' : 'Room not found' });
      }
    } catch (error) {
      console.error('Error in startGame:', error);
      callback({ success: false, message: 'Failed to start game' });
    }
  });
  
  socket.on('placeBid', ({ roomCode, bid }, callback) => {
    console.log(`Received bid from room ${roomCode}: ${bid ? `${bid.quantity} ${bid.value}'s` : 'null'}`);
    try {
      const room = rooms.get(roomCode);
      console.log('Room state:', room ? room.gameState : 'Room not found');
      if (room && room.gameState === 'playing') {
        room.currentBid = bid;
        const currentPlayerIndex = room.players.findIndex(p => p.id === socket.id);
        console.log('Current player index:', currentPlayerIndex);
        console.log('Room players:', room.players.map(p => ({ id: p.id, name: p.name, connected: p.connected })));
        
        if (currentPlayerIndex === -1) {
          throw new Error('Player not found in room');
        }
        
        const currentPlayer = room.players[currentPlayerIndex];
        const nextPlayerIndex = (currentPlayerIndex + 1) % room.players.length;
        room.currentPlayerIndex = nextPlayerIndex;
        
        console.log(`Broadcasting bidPlaced event to room ${roomCode}. Next player index: ${nextPlayerIndex}`);
        io.to(roomCode).emit('bidPlaced', { 
          bid, 
          nextPlayerIndex,
          playerName: currentPlayer.name,
          playerId: currentPlayer.id
        });
  
        // Save the updated room state
        rooms.set(roomCode, room);
  
        callback({ success: true });
      } else {
        console.log(`Invalid bid placement. Room: ${roomCode}, State: ${room ? room.gameState : 'not found'}`);
        callback({ success: false, error: 'Invalid game state' });
      }
    } catch (error) {
      console.error('Error in placeBid:', error);
      callback({ success: false, error: error.message });
    }
  });

  socket.on('challenge', ({ roomCode }, callback) => {
    console.log(`Received challenge from room ${roomCode}`);
    try {
      const room = rooms.get(roomCode);
      if (room && room.gameState === 'playing') {
        const currentBid = room.currentBid;
        const totalValue = room.players.flatMap(player => player.dice).filter(die => die === currentBid.value || die === 1).length;
        const challengerIndex = room.currentPlayerIndex;
        const bidderIndex = (challengerIndex - 1 + room.players.length) % room.players.length;
  
        let loserIndex;
        let challengeOutcome;
        if (totalValue >= currentBid.quantity) {
          loserIndex = challengerIndex;
          challengeOutcome = 'failed';
        } else {
          loserIndex = bidderIndex;
          challengeOutcome = 'succeeded';
        }
  
        room.players[loserIndex].diceCount--;
  
        const challengeResult = {
          challengerName: room.players[challengerIndex].name,
          bidderName: room.players[bidderIndex].name,
          loserName: room.players[loserIndex].name,
          challengerIndex,
          bidderIndex,
          loserIndex,
          actualCount: totalValue,
          bid: currentBid,
          outcome: challengeOutcome,
          players: room.players
        };
  
        io.to(roomCode).emit('challengeResult', challengeResult);
  
        if (room.players[loserIndex].diceCount === 0) {
          room.players.splice(loserIndex, 1);
        }
  
        if (room.players.length <= 1) {
          room.gameState = 'gameOver';
          io.to(roomCode).emit('gameOver', { winner: room.players[0], reason: `${room.players[0].name} wins!` });
        } else {
          room.currentPlayerIndex = loserIndex % room.players.length;
          room.currentBid = null;
          
          // Randomize dice for all players
          room.players.forEach(player => {
            player.dice = rollDice(player.diceCount);
          });
  
          io.to(roomCode).emit('newRound', { 
            players: room.players, 
            currentPlayerIndex: room.currentPlayerIndex 
          });
        }
  
        rooms.set(roomCode, room);
        if (callback) callback({ success: true });
      } else {
        console.log(`Invalid challenge. Room: ${roomCode}, State: ${room ? room.gameState : 'not found'}`);
        if (callback) callback({ success: false, error: 'Invalid game state' });
      }
    } catch (error) {
      console.error('Error in challenge:', error);
      if (callback) callback({ success: false, error: error.message });
    }
  });
  
  socket.on('resetGame', ({ roomCode, players }, callback) => {
    console.log(`Received resetGame event for room ${roomCode}`);

    const room = rooms.get(roomCode);
    if (!room) {
      console.error(`Room ${roomCode} not found`);
      callback({ success: false, message: 'Room not found' });
      return;
    }

    try {
      // Update the room's game state
      room.players = players;
      room.currentPlayerIndex = 0;
      room.currentBid = null;
      room.gameState = 'playing';

      // Save the updated room state
      rooms.set(roomCode, room);

      // Broadcast the reset game state to all players in the room
      io.to(roomCode).emit('gameReset', {
        players: room.players,
        currentPlayerIndex: 0,
        gameStatus: 'playing'
      });

      console.log(`Game reset successfully for room ${roomCode}`);
      callback({ success: true });
    } catch (error) {
      console.error(`Error resetting game for room ${roomCode}:`, error);
      callback({ success: false, message: 'Error resetting game' });
    }
  });
  
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    for (const [roomCode, room] of rooms.entries()) {
      const playerIndex = room.players.findIndex(p => p.id === socket.id);
      if (playerIndex !== -1) {
        room.players[playerIndex].connected = false;
        console.log(`Player ${room.players[playerIndex].name} disconnected from room ${roomCode}`);
        io.to(roomCode).emit('playerDisconnected', { playerName: room.players[playerIndex].name, playerIndex });
        break;
      }
    }
    logRooms();
  });
});  

const PORT = process.env.PORT || 3002;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
