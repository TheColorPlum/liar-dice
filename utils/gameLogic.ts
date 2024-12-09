import { Bid, Player, GAME_CONSTANTS } from '../types/game';

/**
 * Validates if a bid is legal according to game rules
 * @param newBid - The bid to validate
 * @param currentBid - The current bid on the table (if any)
 * @param isEndGame - Whether the game is in end-game state
 * @returns boolean indicating if the bid is valid
 */
export const isValidBid = (
  newBid: Bid,
  currentBid: Bid | null,
  isEndGame: boolean
): boolean => {
  if (isEndGame) {
    if (!newBid.value || newBid.value < 2 || newBid.value > 12) return false;
    if (!currentBid) return true;
    return newBid.value > currentBid.value;
  } else {
    if (!newBid.quantity || newBid.quantity <= 0 || !newBid.value || 
        newBid.value < 2 || newBid.value > 6) {
      return false;
    }
    if (!currentBid) return true;
    if (newBid.quantity < currentBid.quantity) return false;
    if (newBid.quantity === currentBid.quantity) {
      if (currentBid.value === 6) return false;
      return newBid.value > currentBid.value;
    }
    return true;
  }
};

/**
 * Generates random dice rolls for a player
 * @param count - Number of dice to roll
 * @returns Array of dice values
 */
export const rollDice = (count: number): number[] => {
  return Array.from(
    { length: count }, 
    () => Math.floor(Math.random() * GAME_CONSTANTS.DICE_SIDES) + 1
  );
};

/**
 * Checks if the game is in an end-game scenario
 * @param players - Current players in the game
 * @returns boolean indicating if it's an end-game scenario
 */
export const isEndGameScenario = (players: Player[]): boolean => {
  return players.length === 2 && players.every(player => player.diceCount === 1);
};

/**
 * Calculates the actual count of dice matching a value
 * @param players - All players in the game
 * @param targetValue - The value to count
 * @param isEndGame - Whether the game is in end-game state
 * @returns The total count of matching dice
 */
export const calculateDiceCount = (
  players: Player[],
  targetValue: number,
  isEndGame: boolean
): number => {
  if (isEndGame) {
    return players.reduce((sum, player) => sum + player.dice[0], 0);
  }
  
  const allDice = players.flatMap(player => player.dice);
  return allDice.filter(die => die === targetValue || die === 1).length;
};

/**
 * Determines the winner of a challenge
 * @param players - Current players
 * @param challengerIndex - Index of the challenging player
 * @param currentBid - The current bid being challenged
 * @param isEndGame - Whether the game is in end-game state
 * @returns Object containing challenge outcome details
 */
export const resolveChallengeOutcome = (
  players: Player[],
  challengerIndex: number,
  currentBid: Bid,
  isEndGame: boolean
) => {
  const bidderIndex = (challengerIndex - 1 + players.length) % players.length;
  const actualCount = calculateDiceCount(players, currentBid.value, isEndGame);
  
  let loserIndex;
  let outcome;
  
  if (isEndGame) {
    if (currentBid.value > actualCount) {
      loserIndex = bidderIndex;
      outcome = 'succeeded';
    } else {
      loserIndex = challengerIndex;
      outcome = 'failed';
    }
  } else {
    if (actualCount >= currentBid.quantity) {
      loserIndex = challengerIndex;
      outcome = 'failed';
    } else {
      loserIndex = bidderIndex;
      outcome = 'succeeded';
    }
  }
  
  return {
    loserIndex,
    outcome,
    actualCount,
    challengerName: players[challengerIndex].name,
    bidderName: players[bidderIndex].name,
    loserName: players[loserIndex].name
  };
};
