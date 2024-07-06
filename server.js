const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3001",
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

io.on('connection', (socket) => {
  console.log('A user connected');
  console.log(`New connection: ${socket.id}`);

  socket.on('createRoom', ({ playerName }, callback) => {
    console.log(`Creating room for player: ${playerName}`);
    try {
      const roomCode = generateRoomCode();
      const newPlayer = { id: socket.id, name: playerName, dice: [], diceCount: TOTAL_DICE, isHuman: true };
      rooms.set(roomCode, { 
        players: [newPlayer],
        gameState: 'waiting',
        currentPlayerIndex: 0,
        currentBid: null
      });
      socket.join(roomCode);
      console.log(`Room created: ${roomCode}, Player: ${playerName}, ID: ${socket.id}`);
      callback({ roomCode, playerId: socket.id });
    } catch (error) {
      console.error('Error in createRoom:', error);
      callback({ error: 'Failed to create room' });
    }
  });

  socket.on('joinRoom', ({ roomCode, playerName }, callback) => {
    console.log(`Player ${playerName} attempting to join room ${roomCode}`);
    try {
      const room = rooms.get(roomCode);
      if (room && room.gameState === 'waiting') {
        const newPlayer = { id: socket.id, name: playerName, dice: [], diceCount: TOTAL_DICE, isHuman: true };
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
    try {
      const room = rooms.get(roomCode);
      if (room) {
        room.gameState = 'playing';
        room.currentPlayerIndex = 0;
        room.currentBid = null;
        room.players.forEach(player => {
          player.dice = rollDice(player.diceCount);
        });
        io.to(roomCode).emit('gameStarted', { players: room.players, currentPlayerIndex: room.currentPlayerIndex });
        callback({ success: true });
      } else {
        callback({ success: false, message: 'Room not found' });
      }
    } catch (error) {
      console.error('Error in startGame:', error);
      callback({ success: false, message: 'Failed to start game' });
    }
  });

  socket.on('placeBid', ({ roomCode, bid }, callback) => {
    console.log(`Received bid from room ${roomCode}: ${bid.quantity} ${bid.value}'s`);
    try {
      const room = rooms.get(roomCode);
      if (room && room.gameState === 'playing') {
        room.currentBid = bid;
        const currentPlayerIndex = room.players.findIndex(p => p.id === socket.id);
        const currentPlayer = room.players[currentPlayerIndex];
        room.currentPlayerIndex = (currentPlayerIndex + 1) % room.players.length;
        
        console.log(`Broadcasting bidPlaced event to room ${roomCode}. Next player index: ${room.currentPlayerIndex}`);
        io.in(roomCode).emit('bidPlaced', { 
          bid, 
          nextPlayerIndex: room.currentPlayerIndex,
          playerName: currentPlayer.name,
          playerId: currentPlayer.id
        });
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

  socket.on('challenge', ({ roomCode }) => {
    try {
      const room = rooms.get(roomCode);
      if (room && room.gameState === 'playing') {
        const { currentBid, players } = room;
        const totalDice = players.flatMap(player => player.dice);
        const actualCount = totalDice.filter(die => die === currentBid.value || die === 1).length;

        const challengerIndex = room.currentPlayerIndex;
        const bidderIndex = (challengerIndex - 1 + players.length) % players.length;

        let loserIndex;
        let challengeOutcome;
        if (actualCount >= currentBid.quantity) {
          loserIndex = challengerIndex;
          challengeOutcome = 'failed';
        } else {
          loserIndex = bidderIndex;
          challengeOutcome = 'succeeded';
        }

        players[loserIndex].diceCount--;

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

        if (players[loserIndex].diceCount === 0) {
          players.splice(loserIndex, 1);
          if (loserIndex < room.currentPlayerIndex || (loserIndex === players.length && room.currentPlayerIndex === 0)) {
            room.currentPlayerIndex--;
          }
        }

        if (players.length <= 1) {
          room.gameState = 'gameOver';
          io.to(roomCode).emit('gameOver', { winner: players[0], challengeResult });
        } else {
          room.currentPlayerIndex = loserIndex % players.length;
          room.currentBid = null;
          players.forEach(player => {
            player.dice = rollDice(player.diceCount);
          });
          io.to(roomCode).emit('challengeResult', challengeResult);
          io.to(roomCode).emit('newRound', { players: room.players, currentPlayerIndex: room.currentPlayerIndex });
        }
      }
    } catch (error) {
      console.error('Error in challenge:', error);
      io.to(roomCode).emit('error', 'Failed to process challenge');
    }
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    for (const [roomCode, room] of rooms.entries()) {
      const playerIndex = room.players.findIndex(p => p.id === socket.id);
      if (playerIndex !== -1) {
        room.players.splice(playerIndex, 1);
        if (room.players.length === 1) {
          room.gameState = 'gameOver';
          io.to(roomCode).emit('gameOver', { 
            reason: 'Player disconnected', 
            winner: room.players[0]
          });
          rooms.delete(roomCode);
        } else if (room.players.length > 1) {
          if (playerIndex < room.currentPlayerIndex || (playerIndex === room.players.length && room.currentPlayerIndex === 0)) {
            room.currentPlayerIndex--;
          }
          room.currentPlayerIndex %= room.players.length;
          io.to(roomCode).emit('playerLeft', { 
            playerId: socket.id, 
            nextPlayerIndex: room.currentPlayerIndex 
          });
        }
        break;
      }
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});