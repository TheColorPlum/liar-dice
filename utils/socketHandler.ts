import { Socket } from 'socket.io-client';
import { Player, Bid, ChallengeResult, GameStatus } from '../types/game';

/**
 * Type definitions for socket event callbacks
 */
interface SocketCallbacks {
  onConnect?: () => void;
  onDisconnect?: (reason: string) => void;
  onError?: (error: string) => void;
  onGameStarted?: (gameData: { players: Player[]; currentPlayerIndex: number }) => void;
  onPlayerJoined?: (player: Player) => void;
  onPlayerLeft?: (data: { playerId: string; nextPlayerIndex: number }) => void;
  onBidPlaced?: (data: { 
    bid: Bid;
    nextPlayerIndex: number;
    playerName: string;
    playerId: string;
  }) => void;
  onChallengeResult?: (result: ChallengeResult) => void;
  onGameOver?: (data: { winner: { id: string; name: string }; reason: string }) => void;
  onRoomUpdate?: (data: { players: Player[] }) => void;
  onPlayerReconnected?: (data: { playerName: string; playerIndex: number }) => void;
  onPlayerDisconnected?: (data: { playerName: string; playerIndex: number }) => void;
  onGameReset?: (gameData: {
    players: Player[];
    currentPlayerIndex: number;
    gameStatus: GameStatus;
  }) => void;
}

/**
 * Manages WebSocket connections and event handling for the game
 */
export class SocketHandler {
  private socket: Socket;
  private callbacks: SocketCallbacks;

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
   * Sets up all socket event listeners
   */
  private initializeEventListeners(): void {
    this.socket.on('connect', () => {
      console.log('Connected to server');
      this.callbacks.onConnect?.();
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Disconnected from server:', reason);
      this.callbacks.onDisconnect?.(reason);
      
      if (reason === 'io server disconnect') {
        this.socket.connect();
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      this.callbacks.onError?.('Error connecting to game server. Please try again later.');
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

    this.socket.on('gameOver', (data) => {
      console.log('Game over event received', data);
      this.callbacks.onGameOver?.(data);
    });

    this.socket.on('roomUpdate', (data) => {
      console.log('Room update received', data);
      this.callbacks.onRoomUpdate?.(data);
    });

    this.socket.on('playerRejoined', (data) => {
      console.log('Player rejoined event received', data);
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
      this.socket.emit('resetGame', { roomCode, players }, resolve);
    });
  }

  /**
   * Attempts to reconnect to a room
   */
  reconnectToRoom(roomCode: string, playerName: string): Promise<{
    success: boolean;
    players?: Player[];
    error?: string;
  }> {
    return new Promise((resolve) => {
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
