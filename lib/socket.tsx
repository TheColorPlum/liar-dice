// lib/socket.ts
import { io } from 'socket.io-client';
import { SocketHandler } from '../utils/socketHandler';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3002';

const socket = io(SOCKET_URL, {
  transports: ['websocket'],
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  secure: SOCKET_URL.startsWith('https://'),
  forceNew: true,
  path: '/socket.io/',
  autoConnect: true
});

socket.on('connect_error', (error) => {
  console.log('Connection error:', error);
});

socket.on('connect', () => {
  console.log('Connected to server');
});

const socketHandler = new SocketHandler(socket, {});

export const joinRoom = async (roomCode: string, playerName: string) => {
  return await socketHandler.joinRoom(roomCode, playerName);
};

export const startGame = async (roomCode: string) => {
  return await socketHandler.startGame(roomCode);
};

export const placeBid = async (roomCode: string, bid: { quantity: number, value: number }) => {
  return await socketHandler.placeBid(roomCode, bid);
};

export const challenge = async (roomCode: string) => {
  return await socketHandler.challenge(roomCode);
};

export default socketHandler;
