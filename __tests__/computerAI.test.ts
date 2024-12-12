import { generateComputerMove, calculateBidProbability } from '../utils/computerAI';
import { Player, Bid, GAME_CONSTANTS } from '../types/game';

describe('Computer AI', () => {
  // Test helper to create a player
  const createPlayer = (dice: number[], isHuman: boolean = false): Player => ({
    id: Math.random().toString(),
    name: isHuman ? 'Human' : 'Computer',
    dice,
    diceCount: dice.length,
    isHuman,
    connected: true
  });

  describe('Normal Game Logic', () => {
    it('should make aggressive initial bid when having multiple matching dice', () => {
      const player = createPlayer([6, 6, 6, 6, 5]); // Strong hand with four 6s
      const players = [
        player,
        createPlayer([1, 2, 3, 4, 5])
      ];
      
      const result = generateComputerMove(player, players, null, false);
      
      expect(result.shouldChallenge).toBe(false);
      expect(result.bid).toBeDefined();
      // Should bid based on actual strong hand (4 sixes) plus expected others
      expect(result.bid?.value).toBe(6);
      expect(result.bid?.quantity).toBeGreaterThanOrEqual(4);
    });

    it('should make aggressive bid with multiple ones (wild)', () => {
      const player = createPlayer([1, 1, 1, 4, 5]); // Strong hand with three wilds
      const players = [
        player,
        createPlayer([2, 3, 4, 5, 6])
      ];
      
      const currentBid: Bid = {
        quantity: 3,
        value: 6
      };
      
      const result = generateComputerMove(player, players, currentBid, false);
      expect(result.shouldChallenge).toBe(false);
      expect(result.bid).toBeDefined();
      // Should be confident to increase bid due to wild cards
      expect(result.bid?.quantity).toBeGreaterThanOrEqual(currentBid.quantity);
    });

    it('should challenge when bid exceeds reasonable probability even with wilds', () => {
      const player = createPlayer([1, 2, 3, 4, 5]); // One wild
      const players = [
        player,
        createPlayer([1, 2, 3, 4, 5])
      ];
      
      const unreasonableBid: Bid = {
        quantity: 8, // Unreasonable for 10 total dice
        value: 6
      };
      
      const result = generateComputerMove(player, players, unreasonableBid, false);
      expect(result.shouldChallenge).toBe(true);
    });

    it('should increase quantity when having strong support for current value', () => {
      const player = createPlayer([4, 4, 4, 1, 6]); // Three 4s plus a wild
      const players = [
        player,
        createPlayer([1, 2, 3, 4, 5])
      ];
      
      const currentBid: Bid = {
        quantity: 4,
        value: 4
      };
      
      const result = generateComputerMove(player, players, currentBid, false);
      expect(result.shouldChallenge).toBe(false);
      expect(result.bid).toBeDefined();
      // Should increase quantity since we have strong support (4 matching with wild)
      expect(result.bid?.value).toBe(currentBid.value);
      expect(result.bid?.quantity).toBe(currentBid.quantity + 1);
    });

    it('should switch to higher value when holding stronger dice', () => {
      const player = createPlayer([6, 6, 6, 1, 2]); // Three 6s plus a wild
      const players = [
        player,
        createPlayer([1, 2, 3, 4, 5])
      ];
      
      const currentBid: Bid = {
        quantity: 3,
        value: 4
      };
      
      const result = generateComputerMove(player, players, currentBid, false);
      expect(result.shouldChallenge).toBe(false);
      expect(result.bid).toBeDefined();
      // Should bid 6s since we have strong support
      expect(result.bid?.value).toBe(6);
      expect(result.bid?.quantity).toBe(currentBid.quantity);
    });
  });

  describe('End Game Logic', () => {
    it('should handle end game scenario correctly', () => {
      const player = createPlayer([6]); // One die with value 6
      const players = [
        player,
        createPlayer([4]) // Opponent with one die value 4
      ];
      
      const result = generateComputerMove(player, players, null, true);
      
      expect(result.shouldChallenge).toBe(false);
      expect(result.bid).toBeDefined();
      // Initial bid should be reasonable based on own die (6) plus some buffer
      expect(result.bid?.value).toBeGreaterThanOrEqual(6);
      expect(result.bid?.value).toBeLessThanOrEqual(9); // Conservative initial bid
    });

    it('should challenge unreasonable end game bids', () => {
      const player = createPlayer([3]); // One die with value 3
      const players = [
        player,
        createPlayer([1]) // Opponent with one die
      ];
      
      // Bid that exceeds maximum possible sum (3 + 6 = 9)
      const unreasonableBid: Bid = {
        quantity: 1,
        value: 10
      };
      
      const result = generateComputerMove(player, players, unreasonableBid, true);
      expect(result.shouldChallenge).toBe(true);
    });
  });

  describe('Probability Calculations', () => {
    it('should calculate bid probability correctly with strong hand', () => {
      const ownDice = [6, 6, 6, 6, 1]; // Four 6s plus a wild
      const totalDice = 10;
      
      const bid: Bid = {
        quantity: 5,
        value: 6
      };
      
      const probability = calculateBidProbability(bid, ownDice, totalDice);
      // We have 5 matching dice (four 6s and one wild)
      // Probability should be very high (>1) for this bid
      expect(probability).toBeGreaterThan(1);
    });

    it('should handle multiple ones as wild cards effectively', () => {
      const ownDice = [1, 1, 1, 4, 6]; // Three wilds
      const totalDice = 10;
      
      const bid: Bid = {
        quantity: 4,
        value: 6
      };
      
      const probability = calculateBidProbability(bid, ownDice, totalDice);
      // We have 4 potential matches (three wilds plus one 6)
      // Probability should be favorable
      expect(probability).toBeGreaterThan(0.8);
    });

    it('should calculate lower probability for weak hands', () => {
      const ownDice = [2, 3, 4, 5, 6]; // No matching dice or wilds
      const totalDice = 10;
      
      const bid: Bid = {
        quantity: 4,
        value: 1
      };
      
      const probability = calculateBidProbability(bid, ownDice, totalDice);
      // No matching dice, should have low probability
      expect(probability).toBeLessThan(0.5);
    });
  });
});
