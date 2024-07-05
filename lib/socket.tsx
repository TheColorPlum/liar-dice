// lib/socket.ts
import { io } from 'socket.io-client';

const socket = io('http://your-server-url');

export const joinRoom = (roomCode: string, playerName: string) => {
  socket.emit('joinRoom', { roomCode, playerName });
};

export const startGame = (roomCode: string) => {
  socket.emit('startGame', { roomCode });
};

export const placeBid = (roomCode: string, bid: { quantity: number, value: number }) => {
  socket.emit('placeBid', { roomCode, bid });
};

export const challenge = (roomCode: string) => {
  socket.emit('challenge', { roomCode });
};

export default socket;