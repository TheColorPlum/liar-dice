const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();

let server;

// Only use HTTPS in production
if (process.env.NODE_ENV === 'production') {
  const https = require('https');
  const fs = require('fs');
  const sslOptions = {
    key: fs.readFileSync('/etc/letsencrypt/live/lie-die.com/privkey.pem'),
    cert: fs.readFileSync('/etc/letsencrypt/live/lie-die.com/fullchain.pem'),
    ca: fs.readFileSync('/etc/letsencrypt/live/lie-die.com/chain.pem')
  };
  server = https.createServer(sslOptions, app);
} else {
  server = createServer(app);
}

const io = new Server(server, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ["http://localhost:3000", "http://107.22.150.134:3000", "https://lie-die.com"],
    methods: ["GET", "POST"],
    credentials: true,
    transports: ['websocket']
  },
  pingTimeout: 60000, // 1 minute
  pingInterval: 25000, // 25 seconds
  allowEIO3: true
});

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ["http://localhost:3000", "http://107.22.150.134:3000", "https://lie-die.com"],
  credentials: true
}));
app.use(express.json());

const TOTAL_DICE = 5;
const DICE_SIDES = 6;
const DISCONNECT_TIMEOUT = 30000; // 30 seconds
const INACTIVE_ROOM_CLEANUP = 3600000; // 1 hour

const rooms = new Map();

function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function rollDice(count) {
  return Array.from({ length: count }, () => Math.floor(Math.random() * DICE_SIDES) + 1);
}

function getNextConnectedPlayerIndex(room, currentIndex) {
  const startIndex = currentIndex;
  let nextIndex = (currentIndex + 1) % room.players.length;
  
  // Try to find the next connected player
  while (nextIndex !== startIndex) {
    if (room.players[nextIndex].connected) {
      return nextIndex;
    }
    nextIndex = (nextIndex + 1) % room.players.length;
  }
  
  // If we've gone full circle, return current index if connected, otherwise first connected player
  return room.players[currentIndex].connected ? currentIndex : room.players.findIndex(p => p.connected);
}

function checkRoomValidity(room) {
  if (!room) return false;
  
  // Count connected players
  const connectedPlayers = room.players.filter(p => p.connected).length;
  
  // If less than 2 players are connected and game is in progress, end it
  if (connectedPlayers < 2 && room.gameState === 'playing') {
    room.gameState = 'gameOver';
    const winner = room.players.find(p => p.connected);
    if (winner) {
      io.to(room.code).emit('gameOver', { 
        winner: { id: winner.id, name: winner.name },
        reason: 'Other players disconnected'
      });
    }
    return false;
  }
  
  // If no players are connected and room is inactive, mark for cleanup
  if (connectedPlayers === 0) {
    room.lastActive = Date.now();
    return false;
  }
  
  return true;
}

// Periodically clean up inactive rooms
setInterval(() => {
  const now = Date.now();
  for (const [roomCode, room] of rooms.entries()) {
    if (room.lastActive && (now - room.lastActive > INACTIVE_ROOM_CLEANUP)) {
      rooms.delete(roomCode);
    }
  }
}, INACTIVE_ROOM_CLEANUP);

function cleanupPlayerDisconnect(socket, room, playerIndex) {
  const player = room.players[playerIndex];
  player.connected = false;
  
  // Clear any existing disconnect timer
  if (room.disconnectTimers.has(player.name)) {
    clearTimeout(room.disconnectTimers.get(player.name));
  }
  
  // Set new disconnect timer
  const timer = setTimeout(() => {
    if (!player.connected) {
      room.players.splice(playerIndex, 1);
      if (!checkRoomValidity(room)) {
        rooms.delete(room.code);
      }
    }
  }, DISCONNECT_TIMEOUT);
  
  room.disconnectTimers.set(player.name, timer);
  
  // Notify other players
  io.to(room.code).emit('playerDisconnected', { 
    playerName: player.name, 
    playerIndex 
  });
  
  // If it was this player's turn, move to the next player
  if (room.currentPlayerIndex === playerIndex) {
    const nextIndex = getNextConnectedPlayerIndex(room, playerIndex);
    if (nextIndex !== playerIndex) {
      room.currentPlayerIndex = nextIndex;
      io.to(room.code).emit('bidPlaced', {
        bid: room.currentBid,
        nextPlayerIndex: nextIndex,
        playerName: room.players[nextIndex].name,
        playerId: room.players[nextIndex].id
      });
    }
  }
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
        code: roomCode,
        players: [newPlayer],
        gameState: 'waiting',
        currentPlayerIndex: 0,
        currentBid: null,
        disconnectTimers: new Map(),
        lastActive: null
      };
      rooms.set(roomCode, room);
      socket.join(roomCode);
      console.log(`Room created: ${roomCode}, Player: ${playerName}, ID: ${socket.id}`);
      callback({ success: true, roomCode, playerId: socket.id, players: room.players });
      
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
        // Clear any existing disconnect timer
        if (room.disconnectTimers.has(playerName)) {
          clearTimeout(room.disconnectTimers.get(playerName));
          room.disconnectTimers.delete(playerName);
        }
        
        // Update player connection status
        room.players[playerIndex].id = socket.id;
        room.players[playerIndex].connected = true;
        room.lastActive = null; // Room is active again
        
        socket.join(roomCode);
        console.log(`Player ${playerName} reconnected to room ${roomCode}`);
        
        io.to(roomCode).emit('playerRejoined', { 
          playerName, 
          playerIndex 
        });
        
        callback({ 
          success: true, 
          players: room.players,
          gameState: room.gameState,
          currentPlayerIndex: room.currentPlayerIndex,
          currentBid: room.currentBid
        });
        
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

        // Randomly select the first connected player
        do {
          room.currentPlayerIndex = Math.floor(Math.random() * room.players.length);
        } while (!room.players[room.currentPlayerIndex].connected);
        
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
      if (!room || room.gameState !== 'playing') {
        throw new Error('Invalid game state');
      }

      const currentPlayerIndex = room.players.findIndex(p => p.id === socket.id);
      if (currentPlayerIndex === -1 || currentPlayerIndex !== room.currentPlayerIndex) {
        throw new Error('Not your turn');
      }

      room.currentBid = bid;
      const currentPlayer = room.players[currentPlayerIndex];
      const nextPlayerIndex = getNextConnectedPlayerIndex(room, currentPlayerIndex);
      room.currentPlayerIndex = nextPlayerIndex;
      
      console.log(`Broadcasting bidPlaced event to room ${roomCode}. Next player index: ${nextPlayerIndex}`);
      io.to(roomCode).emit('bidPlaced', { 
        bid, 
        nextPlayerIndex,
        playerName: currentPlayer.name,
        playerId: currentPlayer.id
      });

      rooms.set(roomCode, room);
      callback({ success: true });
    } catch (error) {
      console.error('Error in placeBid:', error);
      callback({ success: false, error: error.message });
    }
  });

  socket.on('challenge', ({ roomCode }, callback) => {
    console.log(`Received challenge from room ${roomCode}`);
    try {
      const room = rooms.get(roomCode);
      if (!room || room.gameState !== 'playing' || !room.currentBid) {
        throw new Error('Invalid game state');
      }

      const currentPlayerIndex = room.players.findIndex(p => p.id === socket.id);
      if (currentPlayerIndex === -1 || currentPlayerIndex !== room.currentPlayerIndex) {
        throw new Error('Not your turn');
      }

      const currentBid = room.currentBid;
      const totalValue = room.players.flatMap(player => player.dice)
        .filter(die => die === currentBid.value || die === 1).length;
      
      const challengerIndex = currentPlayerIndex;
      let bidderIndex = challengerIndex - 1;
      while (bidderIndex >= 0 && !room.players[bidderIndex].connected) {
        bidderIndex--;
      }
      if (bidderIndex < 0) {
        bidderIndex = room.players.length - 1;
        while (bidderIndex > challengerIndex && !room.players[bidderIndex].connected) {
          bidderIndex--;
        }
      }

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
        // Set the loser as the first bidder for the next round
        room.currentPlayerIndex = loserIndex % room.players.length;
        // Skip to next connected player if loser was removed
        if (!room.players[room.currentPlayerIndex]?.connected) {
          room.currentPlayerIndex = getNextConnectedPlayerIndex(room, room.currentPlayerIndex);
        }
        
        // Reset the bid state
        room.currentBid = null;
        
        // Randomize dice for all players
        room.players.forEach(player => {
          player.dice = rollDice(player.diceCount);
        });
  
        io.to(roomCode).emit('newRound', { 
          players: room.players, 
          currentPlayerIndex: room.currentPlayerIndex,
          currentBid: null
        });
      }
  
      rooms.set(roomCode, room);
      callback({ success: true });
    } catch (error) {
      console.error('Error in challenge:', error);
      callback({ success: false, error: error.message });
    }
  });
  
  socket.on('resetGame', ({ roomCode, players }, callback) => {
    console.log(`Received resetGame event for room ${roomCode}`);

    try {
      const room = rooms.get(roomCode);
      if (!room) {
        throw new Error('Room not found');
      }

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
      callback({ success: false, message: error.message });
    }
  });
  
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    for (const [roomCode, room] of rooms.entries()) {
      const playerIndex = room.players.findIndex(p => p.id === socket.id);
      if (playerIndex !== -1) {
        cleanupPlayerDisconnect(socket, room, playerIndex);
        break;
      }
    }
    logRooms();
  });
});

const PORT = process.env.PORT || 3002;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on ${process.env.NODE_ENV === 'production' ? 'https' : 'http'}://0.0.0.0:${PORT}`);
});
