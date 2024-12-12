import { Player, Bid, GAME_CONSTANTS } from '../types/game';
import { isValidBid } from './gameLogic';

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
  // Special handling for end game scenario (2 players, 1 die each)
  if (isEndGame && players.length === 2 && players.every(p => p.diceCount === 1)) {
    return generateEndGameMove(currentPlayer, currentBid);
  }

  return generateNormalGameMove(currentPlayer, players, currentBid);
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
    // Initial bid - bid own die value plus small buffer
    return {
      shouldChallenge: false,
      bid: {
        quantity: 1,
        value: Math.min(12, ownDie + 2)
      }
    };
  }

  // Challenge if bid exceeds maximum possible sum
  const maxPossibleSum = ownDie + GAME_CONSTANTS.DICE_SIDES;
  if (currentBid.value > maxPossibleSum) {
    return { shouldChallenge: true };
  }

  // Challenge if bid is getting too close to maximum
  if (currentBid.value >= maxPossibleSum - 2) { // Slightly more aggressive here
    return { shouldChallenge: true };
  }

  // Make conservative bid increase if reasonable
  return {
    shouldChallenge: false,
    bid: {
      quantity: 1,
      value: currentBid.value + 1
    }
  };
};

/**
 * Calculates confidence in a bid based on known dice and total dice
 */
const calculateBidConfidence = (
  bid: Bid,
  ownDiceCounts: { [key: number]: number },
  totalDice: number,
  ownDiceCount: number
): number => {
  const ownSupport = ownDiceCounts[bid.value] || 0;
  const otherDice = totalDice - ownDiceCount;
  const neededFromOthers = bid.quantity - ownSupport;
  
  // Base confidence on:
  // 1. What percentage of needed dice we have
  // 2. How reasonable it is to expect the remaining from others
  const ownSupportRatio = ownSupport / bid.quantity;
  const neededRatio = neededFromOthers / otherDice;
  
  // More confident if:
  // - We have a higher percentage of needed dice
  // - We need a lower percentage from others
  return ownSupportRatio - (neededRatio * 0.6); // Reduced penalty for needed ratio
};

/**
 * Generates a move for normal game play (multiple dice)
 */
const generateNormalGameMove = (
  currentPlayer: Player,
  players: Player[],
  currentBid: Bid | null
): { shouldChallenge: boolean; bid?: Bid } => {
  const totalDice = players.reduce((sum, player) => sum + player.diceCount, 0);
  const ownDice = currentPlayer.dice;
  const onesCount = ownDice.filter(d => d === 1).length;
  
  // Count our matching dice for each value
  const getOwnDiceCounts = () => {
    const counts: { [key: number]: number } = {};
    for (let i = 2; i <= 6; i++) {
      const actualCount = ownDice.filter(d => d === i).length;
      counts[i] = actualCount + onesCount;
    }
    return counts;
  };

  const ownDiceCounts = getOwnDiceCounts();

  if (!currentBid) {
    // Find our strongest value
    const bestValue = Object.entries(ownDiceCounts)
      .reduce((best, [value, count]) => count > best.count ? { value: Number(value), count } : best,
        { value: 2, count: -1 });

    // Initial bid based on our actual dice plus conservative estimate of others
    const otherDice = totalDice - ownDice.length;
    const expectedOthers = Math.floor(otherDice * 0.33); // Increased from 0.3 to 0.33
    
    const initialBid = {
      quantity: Math.max(1, bestValue.count + expectedOthers),
      value: bestValue.value
    };

    // Check if our initial bid violates our confidence interval
    const confidence = calculateBidConfidence(initialBid, ownDiceCounts, totalDice, ownDice.length);
    if (confidence < 0) {
      // If even our best initial bid lacks confidence, start very conservatively
      return {
        shouldChallenge: false,
        bid: {
          quantity: 1,
          value: GAME_CONSTANTS.MIN_BID_VALUE
        }
      };
    }

    return {
      shouldChallenge: false,
      bid: initialBid
    };
  }

  // First check confidence in current bid
  const currentBidConfidence = calculateBidConfidence(currentBid, ownDiceCounts, totalDice, ownDice.length);
  
  // If current bid already violates our confidence interval, challenge
  if (currentBidConfidence < -0.35) { // Slightly more tolerant before challenging
    return { shouldChallenge: true };
  }

  // Find our best possible bids based on our dice
  const findPossibleBids = (): Bid[] => {
    const possibleBids: Bid[] = [];
    const otherDice = totalDice - ownDice.length;

    // For each value we have
    Object.entries(ownDiceCounts).forEach(([valueStr, count]) => {
      const value = Number(valueStr);
      if (count === 0) return;

      // Calculate reasonable quantities based on our count
      const minQuantity = currentBid ? currentBid.quantity : 1;
      const maxQuantity = Math.min(
        totalDice,
        count + Math.ceil(otherDice * 0.5) // Assume up to half of other dice might match
      );

      // Try different quantities
      for (let qty = minQuantity; qty <= maxQuantity; qty++) {
        const bid = { quantity: qty, value };
        if (isValidBid(bid, currentBid, false)) {
          // Only include bids that don't violate our confidence interval
          const confidence = calculateBidConfidence(bid, ownDiceCounts, totalDice, ownDice.length);
          if (confidence >= -0.15) { // Slightly more tolerant of risky bids
            possibleBids.push(bid);
          }
        }
      }
    });

    return possibleBids;
  };

  // Get all possible bids that don't violate our confidence interval
  const possibleBids = findPossibleBids();

  // If we have no confident bids, challenge the current bid
  if (possibleBids.length === 0) {
    return { shouldChallenge: true };
  }

  // Evaluate each possible bid
  const evaluateBid = (bid: Bid): number => {
    const confidence = calculateBidConfidence(bid, ownDiceCounts, totalDice, ownDice.length);
    const valueBonus = bid.value / 20; // Small bonus for higher values
    return confidence + valueBonus;
  };

  // Sort bids by their score
  const scoredBids = possibleBids
    .map(bid => ({ bid, score: evaluateBid(bid) }))
    .sort((a, b) => b.score - a.score);

  // Take our best confident bid
  const bestBid = scoredBids[0].bid;
  const bestConfidence = calculateBidConfidence(bestBid, ownDiceCounts, totalDice, ownDice.length);

  // If even our best bid has low confidence, challenge instead
  if (bestConfidence < -0.2) { // Slightly more tolerant before falling back to challenge
    return { shouldChallenge: true };
  }

  return {
    shouldChallenge: false,
    bid: bestBid
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
  const actualMatches = ownDice.filter(d => d === bid.value).length;
  const onesCount = ownDice.filter(d => d === 1).length;
  const ownMatches = actualMatches + onesCount;
  const remainingDice = totalDice - ownDice.length;
  
  // More optimistic probability calculation
  const expectedProbabilityPerDie = 0.33; // Increased from 0.3 to 0.33
  const expectedOtherMatches = remainingDice * expectedProbabilityPerDie;
  const expectedTotal = ownMatches + expectedOtherMatches;
  
  return expectedTotal / bid.quantity;
};
