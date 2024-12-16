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
 * @param targetValue - The value to count (ignored in endgame as we sum all dice)
 * @param isEndGame - Whether the game is in end-game state
 * @returns The total count of matching dice or sum in end-game
 */
export const calculateDiceCount = (
  players: Player[],
  targetValue: number,
  isEndGame: boolean
): number => {
  if (isEndGame) {
    // In end-game, we sum all dice values regardless of targetValue
    return players.reduce((sum, player) => {
      const diceValue = player.dice[0] || 0;  // Use 0 if no dice
      console.log(`Player ${player.name} dice: ${diceValue}`); // Debug log
      return sum + diceValue;
    }, 0);
  }
  
  // In normal game, we count matching dice including ones as wild
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
    // In end-game, the bid represents the sum of both dice
    // Challenge succeeds if the actual sum is LESS than the bid
    if (actualCount < currentBid.value) {
      loserIndex = bidderIndex; // Bidder loses if they bid too high
      outcome = 'succeeded';
    } else {
      loserIndex = challengerIndex; // Challenger loses if the sum is >= bid
      outcome = 'failed';
    }
  } else {
    // Normal game - challenge succeeds if actual count is less than bid quantity
    if (actualCount < currentBid.quantity) {
      loserIndex = bidderIndex;
      outcome = 'succeeded';
    } else {
      loserIndex = challengerIndex;
      outcome = 'failed';
    }
  }
  
  return {
    loserIndex,
    outcome,
    actualCount,
    challengerName: players[challengerIndex].name,
    bidderName: players[bidderIndex].name,
    loserName: players[loserIndex].name,
    challengerIndex,
    bidderIndex
  };
};
