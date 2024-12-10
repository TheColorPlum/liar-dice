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

// More permissive CORS for local development
const ALLOWED_ORIGINS = process.env.NODE_ENV === 'production' 
  ? ["https://lie-die.com", "http://lie-die.com", "https://www.lie-die.com", "http://www.lie-die.com"] 
  : ["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:3002"];

const io = new Server(server, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ["GET", "POST"],
    credentials: true,
    allowedHeaders: ["*"]
  },
  allowEIO3: true,
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000,
  connectTimeout: 60000,
  maxHttpBufferSize: 1e6,
  // Add secure WebSocket configuration for production
  ...(process.env.NODE_ENV === 'production' && {
    path: '/socket.io/',
    serveClient: false,
    cookie: false
  })
});

// Configure Express CORS to match Socket.IO settings
app.use(cors({
  origin: ALLOWED_ORIGINS,
  credentials: true,
  methods: ["GET", "POST"],
  allowedHeaders: ["*"]
}));

app.use(express.json());

const TOTAL_DICE = 5;
const DICE_SIDES = 6;
const DISCONNECT_TIMEOUT = 60000; // Increased to 60 seconds for initial disconnect
const RECONNECT_GRACE_PERIOD = 120000; // Increased to 120 seconds for reconnection attempts
const INACTIVE_ROOM_CLEANUP = 600000; // Increased to 10 minutes for inactive room cleanup
const CLEANUP_CHECK_INTERVAL = 60000; // Check every minute

const rooms = new Map();
const playerRooms = new Map(); // Track which room each player is in
const playerSockets = new Map(); // Track socket IDs for each player

function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function rollDice(count) {
  return Array.from({ length: count }, () => Math.floor(Math.random() * DICE_SIDES) + 1);
}

function getNextConnectedPlayerIndex(room, currentIndex) {
  if (!room || !room.players || room.players.length === 0) {
    return -1;
  }

  const connectedPlayers = room.players.filter(p => p.connected);
  if (connectedPlayers.length === 0) {
    return -1;
  }

  // If current player is the only one connected, return their index
  if (connectedPlayers.length === 1) {
    return room.players.findIndex(p => p.connected);
  }

  // Find next connected player
  let nextIndex = (currentIndex + 1) % room.players.length;
  const startIndex = nextIndex;

  do {
    if (room.players[nextIndex] && room.players[nextIndex].connected) {
      return nextIndex;
    }
    nextIndex = (nextIndex + 1) % room.players.length;
  } while (nextIndex !== startIndex);

  // If we couldn't find a next connected player, return the first connected player's index
  return room.players.findIndex(p => p.connected);
}

function checkRoomValidity(room) {
  if (!room) return false;
  
  const connectedPlayers = room.players.filter(p => p.connected).length;
  console.log(`Room ${room.code}: ${connectedPlayers} connected players, state: ${room.gameState}`);
  
  // Only end game if all but one player have been disconnected for longer than grace period
  if (connectedPlayers < 2 && room.gameState === 'playing') {
    const disconnectedPlayers = room.players.filter(p => !p.connected);
    const allDisconnectedExpired = disconnectedPlayers.every(p => {
      const timer = room.disconnectTimers.get(p.name);
      return timer && (Date.now() - timer.startTime) > (DISCONNECT_TIMEOUT + RECONNECT_GRACE_PERIOD);
    });

    if (allDisconnectedExpired) {
      room.gameState = 'gameOver';
      const winner = room.players.find(p => p.connected);
      if (winner) {
        console.log(`Game over in room ${room.code}. Winner: ${winner.name} (last player connected)`);
        io.to(room.code).emit('gameOver', { 
          winner: { id: winner.id, name: winner.name },
          reason: 'Other players disconnected'
        });
      }
      return false;
    }
  }
  
  if (connectedPlayers === 0) {
    if (!room.lastActive) {
      room.lastActive = Date.now();
      console.log(`Room ${room.code} marked inactive at ${new Date(room.lastActive).toISOString()}`);
    }
    return false;
  }
  
  if (room.lastActive) {
    console.log(`Room ${room.code} reactivated due to player connection`);
    room.lastActive = null;
  }
  return true;
}

// More frequent cleanup checks
setInterval(() => {
  const now = Date.now();
  console.log(`Running room cleanup check at ${new Date(now).toISOString()}`);
  for (const [roomCode, room] of rooms.entries()) {
    if (room.lastActive) {
      const inactiveTime = now - room.lastActive;
      const hasDisconnectedPlayers = room.players.some(p => !p.connected);
      const cleanupTimeout = hasDisconnectedPlayers ? 
        DISCONNECT_TIMEOUT + RECONNECT_GRACE_PERIOD : 
        INACTIVE_ROOM_CLEANUP;

      if (inactiveTime > cleanupTimeout) {
        console.log(`Cleaning up room ${roomCode} after ${Math.floor(inactiveTime / 1000)}s of inactivity`);
        // Remove player mappings
        room.players.forEach(player => {
          playerRooms.delete(player.name);
          playerSockets.delete(player.name);
        });
        rooms.delete(roomCode);
      }
    }
  }
}, CLEANUP_CHECK_INTERVAL);

function cleanupPlayerDisconnect(socket, room, playerIndex) {
  if (!room || !room.players || playerIndex < 0 || playerIndex >= room.players.length) {
    return;
  }

  const player = room.players[playerIndex];
  if (!player) return;

  player.connected = false;
  console.log(`Player ${player.name} disconnected from room ${room.code}`);
  
  // Clear any existing disconnect timer
  if (room.disconnectTimers.has(player.name)) {
    clearTimeout(room.disconnectTimers.get(player.name).timer);
    console.log(`Cleared existing disconnect timer for ${player.name}`);
  }
  
  // Set new disconnect timer with start time
  const timer = setTimeout(() => {
    if (!player.connected) {
      const playerStillExists = room.players.findIndex(p => p.name === player.name) !== -1;
      if (playerStillExists) {
        console.log(`Removing ${player.name} from room ${room.code} after ${(DISCONNECT_TIMEOUT + RECONNECT_GRACE_PERIOD)/1000}s disconnect timeout`);
        room.players.splice(playerIndex, 1);
        playerRooms.delete(player.name);
        playerSockets.delete(player.name);
        if (!checkRoomValidity(room)) {
          console.log(`Room ${room.code} marked for cleanup after removing ${player.name}`);
        }
      }
    }
  }, DISCONNECT_TIMEOUT + RECONNECT_GRACE_PERIOD);
  
  room.disconnectTimers.set(player.name, {
    timer,
    startTime: Date.now()
  });
  
  console.log(`Set disconnect timer for ${player.name} in room ${room.code}`);
  
  io.to(room.code).emit('playerDisconnected', { 
    playerName: player.name, 
    playerIndex,
    reconnectGracePeriod: RECONNECT_GRACE_PERIOD
  });
  
  if (room.gameState === 'playing' && room.currentPlayerIndex === playerIndex) {
    const nextIndex = getNextConnectedPlayerIndex(room, playerIndex);
    if (nextIndex !== -1 && nextIndex !== playerIndex) {
      room.currentPlayerIndex = nextIndex;
      const nextPlayer = room.players[nextIndex];
      if (nextPlayer) {
        console.log(`Turn passed to ${nextPlayer.name} after ${player.name} disconnected`);
        io.to(room.code).emit('bidPlaced', {
          bid: room.currentBid,
          nextPlayerIndex: nextIndex,
          playerName: nextPlayer.name,
          playerId: nextPlayer.id
        });
      }
    }
  }
}

function logRooms() {
  console.log("\n=== Current Rooms Status ===");
  if (rooms.size === 0) {
    console.log("No active rooms");
    return;
  }
  
  rooms.forEach((room, code) => {
    const connectedPlayers = room.players.filter(p => p.connected).length;
    console.log(`\nRoom ${code}:`);
    console.log(`- State: ${room.gameState}`);
    console.log(`- Players: ${room.players.length} total, ${connectedPlayers} connected`);
    console.log("- Player details:", room.players.map(p => ({
      name: p.name,
      connected: p.connected,
      diceCount: p.diceCount
    })));
    if (room.lastActive) {
      const inactiveFor = Math.floor((Date.now() - room.lastActive) / 1000);
      console.log(`- Inactive for: ${inactiveFor}s`);
    }
  });
  console.log("\n=========================");
}

io.on('connection', (socket) => {
  console.log('A user connected');
  console.log(`New connection: ${socket.id}`);
  
  // Log connection details
  console.log('Transport type:', socket.conn.transport.name);
  console.log('Headers:', socket.handshake.headers);

  // Set up ping interval
  const pingInterval = setInterval(() => {
    socket.emit('ping_client');
  }, 10000);

  socket.on('pong_client', () => {
    console.log(`Pong received from ${socket.id}`);
  });

  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });

  socket.on('connect_error', (error) => {
    console.error('Connection error:', error);
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    clearInterval(pingInterval);
    
    // Find and handle player disconnect in any room
    for (const [roomCode, room] of rooms.entries()) {
      const playerIndex = room.players.findIndex(p => p.id === socket.id);
      if (playerIndex !== -1) {
        cleanupPlayerDisconnect(socket, room, playerIndex);
        break;
      }
    }
    logRooms();
  });

  socket.on('createRoom', ({ playerName }, callback) => {
    console.log(`Creating room for player: ${playerName}`);
    try {
      // Check if player is already in a room
      const existingRoomCode = playerRooms.get(playerName);
      if (existingRoomCode) {
        const existingRoom = rooms.get(existingRoomCode);
        if (existingRoom) {
          console.log(`Player ${playerName} already has room ${existingRoomCode}`);
          callback({ 
            success: false, 
            error: 'You already have an active room. Please reconnect to your existing room.' 
          });
          return;
        }
      }

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
        lastBidderIndex: null,
        disconnectTimers: new Map(),
        lastActive: null
      };
      rooms.set(roomCode, room);
      playerRooms.set(playerName, roomCode);
      playerSockets.set(playerName, socket.id);
      socket.join(roomCode);
      console.log(`Room created: ${roomCode}, Player: ${playerName}, ID: ${socket.id}`);
      callback({ success: true, roomCode, playerId: socket.id, players: room.players });
      
      io.to(roomCode).emit('roomUpdate', { players: room.players });
      logRooms();
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
          clearTimeout(room.disconnectTimers.get(playerName).timer);
          room.disconnectTimers.delete(playerName);
          console.log(`Cleared disconnect timer for ${playerName} during reconnection`);
        }
        
        // Update player's connection state and socket ID
        room.players[playerIndex].id = socket.id;
        room.players[playerIndex].connected = true;
        room.lastActive = null;
        
        // Update player mappings
        playerRooms.set(playerName, roomCode);
        playerSockets.set(playerName, socket.id);
        
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
        logRooms();
      } else {
        console.log(`Failed to reconnect ${playerName}: player not found in room ${roomCode}`);
        callback({ success: false, error: 'Player not found in room' });
      }
    } else {
      console.log(`Failed to reconnect ${playerName}: room ${roomCode} not found`);
      callback({ success: false, error: 'Room not found' });
      playerRooms.delete(playerName);
      playerSockets.delete(playerName);
    }
  });
  
  socket.on('joinRoom', ({ roomCode, playerName }, callback) => {
    console.log(`Player ${playerName} attempting to join room ${roomCode}`);
    try {
      // Check if player is already in a room
      const existingRoomCode = playerRooms.get(playerName);
      if (existingRoomCode) {
        const existingRoom = rooms.get(existingRoomCode);
        if (existingRoom) {
          console.log(`Player ${playerName} already has room ${existingRoomCode}`);
          callback({ 
            success: false, 
            message: 'You already have an active room. Please reconnect to your existing room.' 
          });
          return;
        }
      }

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
        playerRooms.set(playerName, roomCode);
        playerSockets.set(playerName, socket.id);
        socket.join(roomCode);
        console.log(`Player ${playerName} joined room ${roomCode}. Total players: ${room.players.length}`);
        io.to(roomCode).emit('playerJoined', newPlayer);
        callback({ success: true, playerId: socket.id, players: room.players });
        logRooms();
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
        room.lastBidderIndex = null;
        
        room.players.forEach(player => {
          player.dice = rollDice(player.diceCount);
          player.connected = true;
          // Update player's socket ID if they're the current socket
          if (player.name === socket.handshake.query.playerName) {
            player.id = socket.id;
          }
        });

        do {
          room.currentPlayerIndex = Math.floor(Math.random() * room.players.length);
        } while (!room.players[room.currentPlayerIndex].connected);
        
        console.log(`Starting game in room ${roomCode} with ${room.players.length} players`);
        console.log(`First player: ${room.players[room.currentPlayerIndex].name}`);
        
        io.in(roomCode).emit('gameStarted', { 
          players: room.players, 
          currentPlayerIndex: room.currentPlayerIndex 
        });
        
        rooms.set(roomCode, room);
        callback({ success: true });
        logRooms();
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
      room.lastBidderIndex = currentPlayerIndex; // Store the index of the player who made this bid
      const currentPlayer = room.players[currentPlayerIndex];
      const nextPlayerIndex = getNextConnectedPlayerIndex(room, currentPlayerIndex);
      
      if (nextPlayerIndex === -1) {
        throw new Error('No connected players available for next turn');
      }
      
      room.currentPlayerIndex = nextPlayerIndex;
      const nextPlayer = room.players[nextPlayerIndex];
      
      console.log(`Bid placed in room ${roomCode}: ${currentPlayer.name} bid ${bid.quantity} ${bid.value}'s`);
      console.log(`Next player: ${nextPlayer.name}`);
      
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

      const challengerIndex = room.players.findIndex(p => p.id === socket.id);
      if (challengerIndex === -1 || challengerIndex !== room.currentPlayerIndex) {
        throw new Error('Not your turn');
      }

      // Prevent self-challenges
      if (challengerIndex === room.lastBidderIndex) {
        throw new Error('Cannot challenge your own bid');
      }

      const currentBid = room.currentBid;
      const totalValue = room.players.flatMap(player => player.dice)
        .filter(die => die === currentBid.value || die === 1).length;
      
      // Use the stored lastBidderIndex to identify who made the last bid
      const bidderIndex = room.lastBidderIndex;
      if (bidderIndex === null || bidderIndex === undefined) {
        throw new Error('Cannot determine last bidder');
      }

      let loserIndex;
      let challengeOutcome;
      if (totalValue < currentBid.quantity) {
        loserIndex = bidderIndex;
        challengeOutcome = 'succeeded';
      } else {
        loserIndex = challengerIndex;
        challengeOutcome = 'failed';
      }
  
      // Store the loser's name and current dice count before potentially removing them
      const loserName = room.players[loserIndex].name;
      room.players[loserIndex].diceCount--;
  
      console.log(`Challenge in room ${roomCode}:`);
      console.log(`- Challenger: ${room.players[challengerIndex].name}`);
      console.log(`- Bidder: ${room.players[bidderIndex].name}`);
      console.log(`- Actual count: ${totalValue}`);
      console.log(`- Challenge ${challengeOutcome}`);
      console.log(`- Loser: ${loserName}`);
  
      const challengeResult = {
        challengerName: room.players[challengerIndex].name,
        bidderName: room.players[bidderIndex].name,
        loserName: loserName,
        challengerIndex,
        bidderIndex,
        loserIndex,
        actualCount: totalValue,
        bid: currentBid,
        outcome: challengeOutcome,
        players: room.players
      };
  
      io.to(roomCode).emit('challengeResult', challengeResult);
      
      // Emit room update immediately after challenge result
      io.to(roomCode).emit('roomUpdate', { players: room.players });
  
      // Store whether the player will be eliminated
      const willBeEliminated = room.players[loserIndex].diceCount === 0;
      
      // Remove player if they lost their last die
      if (willBeEliminated) {
        console.log(`Player ${loserName} eliminated from room ${roomCode}`);
        playerRooms.delete(loserName);
        playerSockets.delete(loserName);
        room.players.splice(loserIndex, 1);
      }
  
      // Check for game over
      const connectedPlayers = room.players.filter(p => p.connected);
      if (room.players.length <= 1 || connectedPlayers.length <= 1) {
        room.gameState = 'gameOver';
        // Find the winner - prefer connected players
        const winner = connectedPlayers.length > 0 ? 
          connectedPlayers[0] : 
          room.players[0];
        
        console.log(`Game over in room ${roomCode}. Winner: ${winner.name}`);
        io.to(roomCode).emit('gameOver', { 
          winner, 
          reason: connectedPlayers.length <= 1 ? 
            'Other players disconnected' : 
            `${winner.name} wins!`
        });

        // Clean up room mappings after game over
        room.players.forEach(player => {
          playerRooms.delete(player.name);
          playerSockets.delete(player.name);
        });
        rooms.delete(roomCode);
      } else {
        // Start new round
        room.currentBid = null;
        room.lastBidderIndex = null;
        
        // Roll new dice for all players
        room.players.forEach(player => {
          player.dice = rollDice(player.diceCount);
        });
        
        // Always set the loser as the first player of the next round
        // If they were eliminated, use the next available player after their position
        if (willBeEliminated) {
          room.currentPlayerIndex = loserIndex % room.players.length;
          // Ensure the selected player is connected
          if (!room.players[room.currentPlayerIndex]?.connected) {
            room.currentPlayerIndex = getNextConnectedPlayerIndex(room, room.currentPlayerIndex);
          }
        } else {
          room.currentPlayerIndex = loserIndex;
          // If the loser is disconnected, move to the next connected player
          if (!room.players[room.currentPlayerIndex]?.connected) {
            room.currentPlayerIndex = getNextConnectedPlayerIndex(room, room.currentPlayerIndex);
          }
        }
        
        console.log(`Starting new round in room ${roomCode}`);
        console.log(`First player: ${room.players[room.currentPlayerIndex].name}`);
  
        io.to(roomCode).emit('newRound', { 
          players: room.players, 
          currentPlayerIndex: room.currentPlayerIndex,
          currentBid: null
        });
      }
  
      rooms.set(roomCode, room);
      callback({ success: true });
      logRooms();
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

      room.players = players;
      room.currentPlayerIndex = 0;
      room.currentBid = null;
      room.lastBidderIndex = null;
      room.gameState = 'playing';

      rooms.set(roomCode, room);

      console.log(`Game reset in room ${roomCode}`);
      console.log(`- Players: ${players.length}`);
      console.log(`- First player: ${players[0].name}`);

      io.to(roomCode).emit('gameReset', {
        players: room.players,
        currentPlayerIndex: 0,
        gameStatus: 'playing'
      });

      callback({ success: true });
      logRooms();
    } catch (error) {
      console.error(`Error resetting game for room ${roomCode}:`, error);
      callback({ success: false, message: error.message });
    }
  });
});

const PORT = process.env.PORT || 3002;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Server running on ${process.env.NODE_ENV === 'production' ? 'https' : 'http'}://localhost:${PORT}`);
});
