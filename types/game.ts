/**
 * Represents a player in the Liar's Dice game
 */
export interface Player {
  id: string;
  name: string;
  dice: number[];
  diceCount: number;
  isHuman: boolean;
  connected: boolean;
}

/**
 * Represents a bid in the game
 */
export interface Bid {
  quantity: number;
  value: number;
}

/**
 * Represents the result of a challenge
 */
export interface ChallengeResult {
  players: Player[];
  outcome: 'succeeded' | 'failed';
  actualCount: number;
  bid: Bid;
  loserName: string;
  challengerName: string;
  bidderName: string;
  challengerIndex: number;
  bidderIndex: number;
  loserIndex: number;
}

/**
 * Represents a game log entry
 */
export interface GameLogEntry {
  id: number;
  message: string;
}

/**
 * Game status types
 */
export type GameStatus = 'waiting' | 'playing' | 'roundEnd' | 'gameOver';

/**
 * Game mode types
 */
export type GameMode = 'start' | 'create' | 'join' | 'singlePlayer' | 'multiplayer' | 'joinGame' | 'playing';

/**
 * Game constants
 */
export const GAME_CONSTANTS = {
  TOTAL_DICE: 5,
  DICE_SIDES: 6,
  MIN_BID_VALUE: 2,
  MAX_END_GAME_BID: 12
} as const;
