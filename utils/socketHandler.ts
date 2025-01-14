import { Socket } from 'socket.io-client';
import { 
  Player, 
  Bid, 
  ChallengeResult, 
  GameStatus,
  RoomUpdateData,
  PlayerJoinedData,
  PlayerLeftData,
  PlayerReconnectedData,
  PlayerDisconnectedData,
  GameStartedData,
  BidPlacedData,
  NewRoundData,
  GameOverData,
  GameResetData
} from '../types/game';

/**
 * Type definitions for socket event callbacks
 */
interface SocketCallbacks {
  onConnect?: () => void;
  onDisconnect?: (reason: string) => void;
  onError?: (error: string) => void;
  onGameStarted?: (gameData: GameStartedData) => void;
  onPlayerJoined?: (player: PlayerJoinedData) => void;
  onPlayerLeft?: (data: PlayerLeftData) => void;
  onBidPlaced?: (data: BidPlacedData) => void;
  onChallengeResult?: (result: ChallengeResult) => void;
  onNewRound?: (data: NewRoundData) => void;
  onGameOver?: (data: GameOverData) => void;
  onRoomUpdate?: (data: RoomUpdateData) => void;
  onPlayerReconnected?: (data: PlayerReconnectedData) => void;
  onPlayerDisconnected?: (data: PlayerDisconnectedData) => void;
  onGameReset?: (data: GameResetData) => void;
}

/**
 * Manages WebSocket connections and event handling for the game
 */
export class SocketHandler {
  private socket: Socket;
  private callbacks: SocketCallbacks;
  private reconnectAttempts: number = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 5;
  private isReconnecting: boolean = false;

  constructor(socket: Socket, callbacks: SocketCallbacks) {
    this.socket = socket;
    this.callbacks = callbacks;
    this.initializeEventListeners();
  }

  /**
   * Updates the socket event callbacks
   */
  updateCallbacks(newCallbacks: SocketCallbacks): void {
    this.callbacks = newCallbacks;
  }

  /**
   * Reconnects the socket if disconnected
   */
  reconnect(): void {
    if (!this.socket.connected && !this.isReconnecting) {
      console.log('Attempting manual reconnection');
      this.handleReconnection();
    }
  }

  /**
   * Handles reconnection attempts with backoff
   */
  private handleReconnection(): void {
    if (this.isReconnecting || this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
      return;
    }

    this.isReconnecting = true;
    const attempt = () => {
      if (!this.socket.connected && this.reconnectAttempts < this.MAX_RECONNECT_ATTEMPTS) {
        this.reconnectAttempts++;
        const backoffDelay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 5000);
        
        console.log(`Reconnection attempt ${this.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS}`, {
          backoffDelay,
          transport: this.socket.io?.engine?.transport?.name
        });
        
        setTimeout(() => {
          if (!this.socket.connected) {
            console.log('Attempting to reconnect...');
            this.socket.connect();
            
            if (this.reconnectAttempts < this.MAX_RECONNECT_ATTEMPTS) {
              attempt();
            } else {
              this.isReconnecting = false;
              console.error('Max reconnection attempts reached');
              this.callbacks.onError?.('Failed to connect after maximum attempts');
            }
          }
        }, backoffDelay);
      }
    };

    attempt();
  }

  /**
   * Sets up all socket event listeners
   */
  private initializeEventListeners(): void {
    this.socket.on('connect', () => {
      console.log('Connected to server');
      this.isReconnecting = false;
      this.reconnectAttempts = 0;
      this.callbacks.onConnect?.();
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Disconnected from server:', reason);
      this.callbacks.onDisconnect?.(reason);
      
      if (reason === 'io server disconnect' || 
          reason === 'transport close' || 
          reason === 'ping timeout') {
        this.handleReconnection();
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      this.callbacks.onError?.('Error connecting to game server. Please try again later.');
      
      // Attempt to reconnect on connection error
      if (!this.isReconnecting) {
        console.log('Initiating reconnection after connection error');
        this.handleReconnection();
      }
    });

    this.socket.on('gameStarted', (gameData) => {
      console.log('Game started event received', gameData);
      this.callbacks.onGameStarted?.(gameData);
    });

    this.socket.on('playerJoined', (player) => {
      console.log('Player joined event received', player);
      this.callbacks.onPlayerJoined?.(player);
    });

    this.socket.on('playerLeft', (data) => {
      console.log('Player left event received', data);
      this.callbacks.onPlayerLeft?.(data);
    });

    this.socket.on('bidPlaced', (data) => {
      console.log('Bid placed event received', data);
      this.callbacks.onBidPlaced?.(data);
    });

    this.socket.on('challengeResult', (result) => {
      console.log('Challenge result received', result);
      this.callbacks.onChallengeResult?.(result);
    });

    this.socket.on('newRound', (data) => {
      console.log('New round event received', data);
      this.callbacks.onNewRound?.(data);
    });

    this.socket.on('gameOver', (data) => {
      console.log('Game over event received', data);
      this.callbacks.onGameOver?.(data);
    });

    this.socket.on('roomUpdate', (data) => {
      console.log('Room update received', data);
      this.callbacks.onRoomUpdate?.(data);
    });

    this.socket.on('playerReconnected', (data) => {
      console.log('Player reconnected event received', data);
      this.callbacks.onPlayerReconnected?.(data);
    });

    this.socket.on('playerDisconnected', (data) => {
      console.log('Player disconnected event received', data);
      this.callbacks.onPlayerDisconnected?.(data);
    });

    this.socket.on('gameReset', (gameData) => {
      console.log('Game reset event received', gameData);
      this.callbacks.onGameReset?.(gameData);
    });

    // Ensure initial connection
    if (!this.socket.connected) {
      console.log('Initiating initial connection');
      this.socket.connect();
    }
  }

  /**
   * Creates a new game room
   */
  createRoom(playerName: string): Promise<{
    success: boolean;
    roomCode?: string;
    playerId?: string;
    players?: Player[];
    error?: string;
  }> {
    return new Promise((resolve) => {
      if (!this.socket.connected) {
        console.log('Socket not connected, attempting to connect before creating room');
        this.socket.connect();
      }
      this.socket.emit('createRoom', { playerName }, resolve);
    });
  }

  /**
   * Joins an existing game room
   */
  joinRoom(roomCode: string, playerName: string): Promise<{
    success: boolean;
    playerId?: string;
    players?: Player[];
    message?: string;
  }> {
    return new Promise((resolve) => {
      if (!this.socket.connected) {
        console.log('Socket not connected, attempting to connect before joining room');
        this.socket.connect();
      }
      this.socket.emit('joinRoom', { roomCode, playerName }, resolve);
    });
  }

  /**
   * Starts the game
   */
  startGame(roomCode: string): Promise<{
    success: boolean;
    message?: string;
  }> {
    return new Promise((resolve) => {
      if (!this.socket.connected) {
        console.log('Socket not connected, attempting to connect before starting game');
        this.socket.connect();
      }
      this.socket.emit('startGame', { roomCode }, resolve);
    });
  }

  /**
   * Places a bid
   */
  placeBid(roomCode: string, bid: Bid): Promise<{
    success: boolean;
    error?: string;
  }> {
    return new Promise((resolve) => {
      if (!this.socket.connected) {
        console.log('Socket not connected, attempting to connect before placing bid');
        this.socket.connect();
      }
      this.socket.emit('placeBid', { roomCode, bid }, resolve);
    });
  }

  /**
   * Initiates a challenge
   */
  challenge(roomCode: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    return new Promise((resolve) => {
      if (!this.socket.connected) {
        console.log('Socket not connected, attempting to connect before challenge');
        this.socket.connect();
      }
      this.socket.emit('challenge', { roomCode }, resolve);
    });
  }

  /**
   * Resets the game
   */
  resetGame(roomCode: string, players: Player[]): Promise<{
    success: boolean;
    message?: string;
  }> {
    return new Promise((resolve) => {
      if (!this.socket.connected) {
        console.log('Socket not connected, attempting to connect before reset');
        this.socket.connect();
      }
      this.socket.emit('resetGame', { roomCode, players }, resolve);
    });
  }

  /**
   * Attempts to reconnect to a room
   */
  reconnectToRoom(roomCode: string, playerName: string): Promise<{
    success: boolean;
    players?: Player[];
    gameState?: GameStatus;
    currentPlayerIndex?: number;
    currentBid?: Bid | null;
    error?: string;
  }> {
    return new Promise((resolve) => {
      if (!this.socket.connected) {
        console.log('Socket not connected, attempting to connect before reconnecting to room');
        this.socket.connect();
      }
      this.socket.emit('reconnectToRoom', { roomCode, playerName }, resolve);
    });
  }

  /**
   * Disconnects the socket
   */
  disconnect(): void {
    this.socket.disconnect();
  }
}
