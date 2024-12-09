import { Player, Bid, GAME_CONSTANTS } from '../types/game';

/**
 * Generates a computer player's bid based on game state and strategy
 * @param currentPlayer - The computer player making the bid
 * @param players - All players in the game
 * @param currentBid - The current bid on the table (if any)
 * @param isEndGame - Whether the game is in end-game state
 * @returns Object containing the bid decision and whether to challenge
 */
export const generateComputerMove = (
  currentPlayer: Player,
  players: Player[],
  currentBid: Bid | null,
  isEndGame: boolean
): { shouldChallenge: boolean; bid?: Bid } => {
  const totalDice = players.reduce((sum, player) => sum + player.diceCount, 0);
  
  if (isEndGame) {
    return generateEndGameMove(currentPlayer, currentBid);
  }
  
  return generateNormalGameMove(currentPlayer, players, currentBid, totalDice);
};

/**
 * Generates a move for the end-game scenario (1 die per player)
 */
const generateEndGameMove = (
  currentPlayer: Player,
  currentBid: Bid | null
): { shouldChallenge: boolean; bid?: Bid } => {
  const ownDie = currentPlayer.dice[0];
  
  if (!currentBid) {
    // Initial bid in end game
    return {
      shouldChallenge: false,
      bid: {
        quantity: 1,
        value: Math.min(ownDie + Math.floor(Math.random() * 3) + 1, GAME_CONSTANTS.MAX_END_GAME_BID)
      }
    };
  }
  
  // Challenge probability increases with bid value
  const challengeProbability = (currentBid.value - ownDie) / GAME_CONSTANTS.MAX_END_GAME_BID;
  if (Math.random() < challengeProbability) {
    return { shouldChallenge: true };
  }
  
  return {
    shouldChallenge: false,
    bid: {
      quantity: 1,
      value: Math.min(currentBid.value + 1, GAME_CONSTANTS.MAX_END_GAME_BID)
    }
  };
};

/**
 * Generates a move for normal game play (multiple dice)
 */
const generateNormalGameMove = (
  currentPlayer: Player,
  players: Player[],
  currentBid: Bid | null,
  totalDice: number
): { shouldChallenge: boolean; bid?: Bid } => {
  const ownDice = currentPlayer.dice;
  const diceCount = (value: number): number => 
    ownDice.filter(d => d === value || d === 1).length;
  
  // Calculate dice frequencies for own dice
  const diceCounts = Array.from({ length: 6 }, (_, i) => diceCount(i + 1));
  const mostCommonValue = diceCounts.indexOf(Math.max(...diceCounts)) + 1;
  
  if (!currentBid) {
    // Initial bid strategy
    const quantity = Math.max(1, Math.floor(diceCount(mostCommonValue) * (totalDice / currentPlayer.diceCount) * 0.8));
    return {
      shouldChallenge: false,
      bid: { quantity, value: mostCommonValue }
    };
  }
  
  // Evaluate current bid probability
  const ownCount = diceCount(currentBid.value);
  const estimatedTotal = Math.round(ownCount * (totalDice / currentPlayer.diceCount));
  const confidenceThreshold = 0.6 + (Math.random() * 0.2);
  
  if (estimatedTotal < currentBid.quantity * confidenceThreshold) {
    const challengeProbability = 1 - (estimatedTotal / (currentBid.quantity * confidenceThreshold));
    if (Math.random() < challengeProbability) {
      return { shouldChallenge: true };
    }
  }
  
  // Generate new bid based on strategy
  const riskFactor = Math.random();
  let newBid: Bid;
  
  if (riskFactor < 0.4) {
    // Increase quantity
    newBid = {
      quantity: currentBid.quantity + 1,
      value: currentBid.value
    };
  } else if (riskFactor < 0.7) {
    // Increase value
    newBid = {
      quantity: currentBid.quantity,
      value: Math.min(currentBid.value + 1, GAME_CONSTANTS.DICE_SIDES)
    };
  } else {
    // Increase both (aggressive play)
    newBid = {
      quantity: currentBid.quantity + 1,
      value: Math.min(currentBid.value + 1, GAME_CONSTANTS.DICE_SIDES)
    };
  }
  
  // Adjust bid based on probability
  const probability = (newBid.quantity / totalDice) * (1/6 + (newBid.value === 1 ? 1/6 : 0));
  if (probability > 0.8) {
    newBid.quantity = Math.max(currentBid.quantity, Math.floor(newBid.quantity * 0.8));
  }
  
  return {
    shouldChallenge: false,
    bid: newBid
  };
};

/**
 * Calculates the probability of a bid being true
 * @param bid - The bid to evaluate
 * @param ownDice - The computer player's dice
 * @param totalDice - Total number of dice in play
 * @returns Estimated probability of the bid being true
 */
export const calculateBidProbability = (
  bid: Bid,
  ownDice: number[],
  totalDice: number
): number => {
  const ownMatches = ownDice.filter(d => d === bid.value || d === 1).length;
  const remainingDice = totalDice - ownDice.length;
  const expectedMatchesPerDie = 1/6 + (bid.value === 1 ? 1/6 : 0);
  const expectedOtherMatches = remainingDice * expectedMatchesPerDie;
  
  return (ownMatches + expectedOtherMatches) / bid.quantity;
};
