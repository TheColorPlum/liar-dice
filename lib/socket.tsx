// lib/socket.ts
import { io, Socket } from 'socket.io-client';
import { SocketHandler } from '../utils/socketHandler';

// In production, use the same domain without port since nginx handles the WebSocket proxy
const SOCKET_URL = process.env.NODE_ENV === 'production' 
  ? 'https://lie-die.com'  // Changed to use main domain in production
  : 'http://localhost:3002';

console.log('Socket configuration initialized for:', SOCKET_URL);

// Session management
const getStoredSession = () => {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem('liarsDiceSession');
  return stored ? JSON.parse(stored) : null;
};

const storeSession = (roomCode: string, playerName: string) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem('liarsDiceSession', JSON.stringify({ 
    roomCode, 
    playerName,
    timestamp: Date.now() 
  }));
};

const clearSession = () => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('liarsDiceSession');
};

// Connection state management
let isReconnecting = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 1000;
let activeRoom: { roomCode: string; playerName: string } | null = null;

// Get stored session for initial connection
const session = getStoredSession();
const initialPlayerName = session?.playerName || '';

// Initialize socket with auto-connect enabled and player name in query
const socket = io(SOCKET_URL, {
  path: '/socket.io/',  // Explicitly set the path
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
  reconnectionDelay: RECONNECT_DELAY,
  reconnectionDelayMax: 5000,
  timeout: 20000,
  autoConnect: true,
  forceNew: true,
  query: {
    playerName: initialPlayerName
  }
});

// Connection monitoring with server ping response
socket.on('ping_client', () => {
  console.log('Ping received from server');
  socket.emit('pong_client');
});

// Connection event handlers
socket.on('connect', () => {
  console.log('Connected successfully:', {
    socketId: socket.id,
    transport: socket.io.engine?.transport?.name,
    activeRoom
  });
  
  isReconnecting = false;
  reconnectAttempts = 0;

  // Handle session restoration with timeout
  const session = getStoredSession();
  if (session && Date.now() - session.timestamp < 3600000) { // 1 hour expiry
    console.log('Attempting to restore session:', session);
    const timeoutId = setTimeout(() => {
      console.log('Session restoration timed out');
      clearSession();
    }, 5000);

    socket.emit('reconnectToRoom', session, (response: any) => {
      clearTimeout(timeoutId);
      if (response.success) {
        console.log('Session restored successfully');
        activeRoom = {
          roomCode: session.roomCode,
          playerName: session.playerName
        };
      } else {
        console.log('Failed to restore session, clearing');
        clearSession();
        activeRoom = null;
      }
    });
  }
});

socket.on('connect_error', (error) => {
  console.error('Connection error:', {
    message: error.message,
    transport: socket.io.engine?.transport?.name,
    state: socket.connected,
    activeRoom,
    attempts: reconnectAttempts
  });

  if (!isReconnecting && activeRoom) {
    handleReconnection();
  }
});

socket.on('disconnect', (reason) => {
  console.log('Disconnected:', reason, 'Active room:', activeRoom);
  
  if ((reason === 'io server disconnect' || 
       reason === 'transport close' || 
       reason === 'ping timeout') && 
      activeRoom) {
    handleReconnection();
  }
});

// Enhanced reconnection logic with exponential backoff
const handleReconnection = () => {
  if (isReconnecting || reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    return;
  }

  isReconnecting = true;
  const attempt = () => {
    if (!socket.connected && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      reconnectAttempts++;
      const backoffDelay = Math.min(RECONNECT_DELAY * Math.pow(2, reconnectAttempts - 1), 5000);
      
      console.log(`Reconnection attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}`, {
        activeRoom,
        isReconnecting,
        backoffDelay,
        transport: socket.io.engine?.transport?.name
      });
      
      setTimeout(() => {
        if (!socket.connected) {
          // Update query with current player name before reconnecting
          if (activeRoom) {
            socket.io.opts.query = { playerName: activeRoom.playerName };
          }
          socket.connect();
          if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            attempt();
          } else {
            isReconnecting = false;
            console.error('Max reconnection attempts reached');
            clearSession();
            activeRoom = null;
          }
        }
      }, backoffDelay);
    }
  };

  attempt();
};

// Initialize socket handler with persistent callbacks
const socketHandler = new SocketHandler(socket, {
  onConnect: () => {
    console.log('Socket handler connected');
    if (activeRoom) {
      console.log('Attempting to restore active room:', activeRoom);
      socketHandler.reconnectToRoom(activeRoom.roomCode, activeRoom.playerName)
        .then(response => {
          console.log('Room restoration response:', response);
          if (!response.success) {
            clearSession();
            activeRoom = null;
          }
        })
        .catch(error => {
          console.error('Failed to restore room:', error);
          clearSession();
          activeRoom = null;
        });
    }
  },
  onDisconnect: (reason) => {
    console.log('Socket handler disconnected:', reason);
    if (activeRoom) {
      handleReconnection();
    }
  },
  onError: (error) => {
    console.error('Socket handler error:', error);
  }
});

// Enhanced connection promise handling with timeout and retry
const waitForConnection = async (timeout = 5000): Promise<void> => {
  if (socket.connected) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('Connection timeout'));
    }, timeout);

    const connectHandler = () => {
      cleanup();
      resolve();
    };

    const errorHandler = (error: Error) => {
      cleanup();
      reject(error);
    };

    const cleanup = () => {
      clearTimeout(timer);
      socket.off('connect', connectHandler);
      socket.off('connect_error', errorHandler);
    };

    socket.once('connect', connectHandler);
    socket.once('connect_error', errorHandler);

    socket.connect(); // Always try to connect
  });
};

// Game action handlers with enhanced error handling and room state management
export const createRoom = async (playerName: string) => {
  try {
    // Update socket query with player name
    socket.io.opts.query = { playerName };
    await waitForConnection();
    const result = await socketHandler.createRoom(playerName);
    if (result.success && result.roomCode) {
      activeRoom = { roomCode: result.roomCode, playerName };
      storeSession(result.roomCode, playerName);
      console.log('Room created successfully:', activeRoom);
    }
    return result;
  } catch (error: any) {
    console.error('Create room failed:', error);
    return { 
      success: false, 
      message: `Unable to create room: ${error.message}` 
    };
  }
};

export const joinRoom = async (roomCode: string, playerName: string) => {
  try {
    // Update socket query with player name
    socket.io.opts.query = { playerName };
    await waitForConnection();
    const result = await socketHandler.joinRoom(roomCode, playerName);
    if (result.success) {
      activeRoom = { roomCode, playerName };
      storeSession(roomCode, playerName);
      console.log('Room joined successfully:', activeRoom);
    }
    return result;
  } catch (error: any) {
    console.error('Join room failed:', error);
    return { 
      success: false, 
      message: `Unable to join room: ${error.message}` 
    };
  }
};

export const startGame = async (roomCode: string) => {
  try {
    await waitForConnection();
    return await socketHandler.startGame(roomCode);
  } catch (error: any) {
    console.error('Start game failed:', error);
    return { 
      success: false, 
      message: `Unable to start game: ${error.message}` 
    };
  }
};

export const placeBid = async (roomCode: string, bid: { quantity: number, value: number }) => {
  try {
    await waitForConnection();
    return await socketHandler.placeBid(roomCode, bid);
  } catch (error: any) {
    console.error('Place bid failed:', error);
    return { 
      success: false, 
      error: `Unable to place bid: ${error.message}` 
    };
  }
};

export const challenge = async (roomCode: string) => {
  try {
    await waitForConnection();
    return await socketHandler.challenge(roomCode);
  } catch (error: any) {
    console.error('Challenge failed:', error);
    return { 
      success: false, 
      error: `Unable to submit challenge: ${error.message}` 
    };
  }
};

export const cleanup = () => {
  if (socket.connected) {
    console.log('Cleaning up socket connection');
    socket.disconnect();
  }
  if (activeRoom) {
    console.log('Cleaning up active room:', activeRoom);
    activeRoom = null;
  }
  clearSession();
};

export default socketHandler;
