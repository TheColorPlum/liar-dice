'use client';

import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import { Player, Bid, GameStatus, GameMode, GameLogEntry, Winner } from '../types/game';

interface GameState {
  playerName: string;
  roomCode: string;
  playerId: string;
  players: Player[];
  gameStatus: GameStatus;
  gameMode: GameMode;
  currentBid: Bid | null;
  currentPlayerIndex: number;
  isEndGame: boolean;
  lastAction: string;
  gameLog: GameLogEntry[];
  isReconnecting: boolean;
  isDisconnected: boolean;
  initialPlayerCount: number;
  winner: Winner | null;
}

type GameAction =
  | { type: 'SET_PLAYER_NAME'; payload: string }
  | { type: 'SET_ROOM_CODE'; payload: string }
  | { type: 'SET_PLAYER_ID'; payload: string }
  | { type: 'SET_PLAYERS'; payload: Player[] }
  | { type: 'SET_GAME_STATUS'; payload: GameStatus }
  | { type: 'SET_GAME_MODE'; payload: GameMode }
  | { type: 'SET_CURRENT_BID'; payload: Bid | null }
  | { type: 'SET_CURRENT_PLAYER_INDEX'; payload: number }
  | { type: 'SET_IS_END_GAME'; payload: boolean }
  | { type: 'SET_LAST_ACTION'; payload: string }
  | { type: 'ADD_LOG_ENTRY'; payload: GameLogEntry }
  | { type: 'SET_IS_RECONNECTING'; payload: boolean }
  | { type: 'SET_IS_DISCONNECTED'; payload: boolean }
  | { type: 'SET_INITIAL_PLAYER_COUNT'; payload: number }
  | { type: 'SET_WINNER'; payload: Winner | null }
  | { type: 'RESET_GAME' };

const initialState: GameState = {
  playerName: '',
  roomCode: '',
  playerId: '',
  players: [],
  gameStatus: 'waiting',
  gameMode: 'start',
  currentBid: null,
  currentPlayerIndex: 0,
  isEndGame: false,
  lastAction: 'Game started',
  gameLog: [{ id: 0, message: 'Game started' }],
  isReconnecting: false,
  isDisconnected: false,
  initialPlayerCount: 0,
  winner: null,
};

const gameReducer = (state: GameState, action: GameAction): GameState => {
  switch (action.type) {
    case 'SET_PLAYER_NAME':
      return { ...state, playerName: action.payload };
    case 'SET_ROOM_CODE':
      return { ...state, roomCode: action.payload };
    case 'SET_PLAYER_ID':
      return { ...state, playerId: action.payload };
    case 'SET_PLAYERS':
      return { ...state, players: action.payload };
    case 'SET_GAME_STATUS':
      return { ...state, gameStatus: action.payload };
    case 'SET_GAME_MODE':
      return { ...state, gameMode: action.payload };
    case 'SET_CURRENT_BID':
      return { ...state, currentBid: action.payload };
    case 'SET_CURRENT_PLAYER_INDEX':
      return { ...state, currentPlayerIndex: action.payload };
    case 'SET_IS_END_GAME':
      return { ...state, isEndGame: action.payload };
    case 'SET_LAST_ACTION':
      return { ...state, lastAction: action.payload };
    case 'ADD_LOG_ENTRY':
      return { ...state, gameLog: [action.payload, ...state.gameLog] };
    case 'SET_IS_RECONNECTING':
      return { ...state, isReconnecting: action.payload };
    case 'SET_IS_DISCONNECTED':
      return { ...state, isDisconnected: action.payload };
    case 'SET_INITIAL_PLAYER_COUNT':
      return { ...state, initialPlayerCount: action.payload };
    case 'SET_WINNER':
      return { ...state, winner: action.payload };
    case 'RESET_GAME':
      return initialState;
    default:
      return state;
  }
};

const GameStateContext = createContext<{
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
} | null>(null);

export const GameStateProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(gameReducer, initialState);

  return (
    <GameStateContext.Provider value={{ state, dispatch }}>
      {children}
    </GameStateContext.Provider>
  );
};

export const useGameState = () => {
  const context = useContext(GameStateContext);
  if (!context) {
    throw new Error('useGameState must be used within a GameStateProvider');
  }
  return context;
};
