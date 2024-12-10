// lib/socket.ts
import { io } from 'socket.io-client';
import { SocketHandler } from '../utils/socketHandler';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'https://lie-die.com:3002';
console.log('Connecting to socket URL:', SOCKET_URL); // Debug log

// Get stored session data if it exists
const getStoredSession = () => {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem('liarsDiceSession');
  return stored ? JSON.parse(stored) : null;
};

// Store session data
const storeSession = (roomCode: string, playerName: string) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem('liarsDiceSession', JSON.stringify({ roomCode, playerName }));
};

// Clear session data
const clearSession = () => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('liarsDiceSession');
};

const socket = io(SOCKET_URL, {
  transports: ['websocket'],
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  secure: true,
  forceNew: false, // Changed to false to allow reconnection
  path: '/socket.io/',
  autoConnect: true
});

socket.on('connect_error', (error) => {
  console.error('Connection error details:', error);
  console.log('Current socket URL:', SOCKET_URL);
  console.log('Transport:', socket.io.engine.transport.name);
});

socket.on('connect', () => {
  console.log('Connected to server successfully');
  console.log('Socket ID:', socket.id);
  console.log('Transport:', socket.io.engine.transport.name);
  
  // Attempt to reconnect to room if session exists
  const session = getStoredSession();
  if (session) {
    socket.emit('reconnectToRoom', session, (response: any) => {
      if (!response.success) {
        clearSession(); // Clear invalid session
      }
    });
  }
});

const socketHandler = new SocketHandler(socket, {});

export const joinRoom = async (roomCode: string, playerName: string) => {
  try {
    if (!socket.connected) {
      console.log('Socket not connected, attempting to connect...');
      socket.connect();
      // Wait for connection
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Connection timeout')), 5000);
        socket.once('connect', () => {
          clearTimeout(timeout);
          resolve();
        });
      });
    }
    const result = await socketHandler.joinRoom(roomCode, playerName);
    if (result.success) {
      storeSession(roomCode, playerName);
    }
    return result;
  } catch (error) {
    console.error('Join room error:', error);
    return { success: false, message: 'Failed to connect to game server' };
  }
};

export const startGame = async (roomCode: string) => {
  try {
    if (!socket.connected) {
      console.log('Socket not connected, attempting to connect...');
      socket.connect();
      await new Promise<void>((resolve) => {
        socket.once('connect', () => resolve());
      });
    }
    return await socketHandler.startGame(roomCode);
  } catch (error) {
    console.error('Start game error:', error);
    return { success: false, message: 'Failed to start game' };
  }
};

export const placeBid = async (roomCode: string, bid: { quantity: number, value: number }) => {
  try {
    if (!socket.connected) {
      console.log('Socket not connected, attempting to connect...');
      socket.connect();
      await new Promise<void>((resolve) => {
        socket.once('connect', () => resolve());
      });
    }
    return await socketHandler.placeBid(roomCode, bid);
  } catch (error) {
    console.error('Place bid error:', error);
    return { success: false, error: 'Failed to place bid' };
  }
};

export const challenge = async (roomCode: string) => {
  try {
    if (!socket.connected) {
      console.log('Socket not connected, attempting to connect...');
      socket.connect();
      await new Promise<void>((resolve) => {
        socket.once('connect', () => resolve());
      });
    }
    return await socketHandler.challenge(roomCode);
  } catch (error) {
    console.error('Challenge error:', error);
    return { success: false, error: 'Failed to submit challenge' };
  }
};

// Add cleanup function for unmounting
export const cleanup = () => {
  clearSession();
  socket.disconnect();
};

export default socketHandler;
