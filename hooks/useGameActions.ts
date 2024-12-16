'use client';

import { useCallback } from 'react';
import { useGameState } from '../contexts/GameStateContext';
import socketHandler, { createRoom, joinRoom, startGame, placeBid, challenge, cleanup } from '../lib/socket';
import { rollDice, isValidBid, resolveChallengeOutcome } from '../utils/gameLogic';
import { Bid, Player, GameLogEntry, GameStatus, Winner } from '../types/game';

interface CreateRoomResponse {
  success: boolean;
  roomCode?: string;
  playerId?: string;
  players?: Player[];
  error?: string;
  message?: string;
}

interface JoinRoomResponse {
  success: boolean;
  playerId?: string;
  players?: Player[];
  gameState?: GameStatus;
  currentPlayerIndex?: number;
  currentBid?: Bid | null;
  error?: string;
  message?: string;
}

let logEntryId = 1; // Counter for generating unique log entry IDs

const createLogEntry = (message: string): GameLogEntry => ({
  id: logEntryId++,
  message
});

export const useGameActions = () => {
  const { state, dispatch } = useGameState();

  const resetGame = useCallback(() => {
    if (state.gameMode === 'multiplayer') {
      cleanup();
    }
    localStorage.removeItem('liarsDiceSession');
    dispatch({ type: 'RESET_GAME' });
  }, [state.gameMode, dispatch]);

  const handleCreateGame = async (name: string) => {
    try {
      dispatch({ type: 'SET_PLAYER_NAME', payload: name });
      const response = await createRoom(name) as CreateRoomResponse;
      
      if (response.success && response.roomCode && response.playerId && response.players) {
        dispatch({ type: 'SET_ROOM_CODE', payload: response.roomCode });
        dispatch({ type: 'SET_PLAYER_ID', payload: response.playerId });
        dispatch({ type: 'SET_PLAYERS', payload: response.players });
        dispatch({ type: 'SET_GAME_STATUS', payload: 'waiting' });
        dispatch({ type: 'SET_GAME_MODE', payload: 'multiplayer' });
        
        localStorage.setItem('liarsDiceSession', JSON.stringify({ 
          roomCode: response.roomCode, 
          playerName: name,
          timestamp: Date.now()
        }));
      } else {
        throw new Error(response.error || response.message || "Failed to create room");
      }
    } catch (error: any) {
      console.error('Create game failed:', error);
      alert(error.message || "Failed to create room. Please try again.");
      resetGame();
    }
  };

  const handleJoinGame = async (code: string, name: string) => {
    try {
      dispatch({ type: 'SET_PLAYER_NAME', payload: name });
      const response = await joinRoom(code, name) as JoinRoomResponse;
      
      if (response.success && response.playerId && response.players) {
        dispatch({ type: 'SET_ROOM_CODE', payload: code });
        dispatch({ type: 'SET_PLAYER_ID', payload: response.playerId });
        dispatch({ type: 'SET_PLAYERS', payload: response.players });
        
        // Handle reconnection case where additional game state is provided
        dispatch({ 
          type: 'SET_GAME_STATUS', 
          payload: response.gameState || 'waiting' 
        });
        
        if (typeof response.currentPlayerIndex !== 'undefined') {
          dispatch({ type: 'SET_CURRENT_PLAYER_INDEX', payload: response.currentPlayerIndex });
        }
        
        if (typeof response.currentBid !== 'undefined') {
          dispatch({ type: 'SET_CURRENT_BID', payload: response.currentBid });
        }
        
        dispatch({ type: 'SET_GAME_MODE', payload: 'multiplayer' });
        
        localStorage.setItem('liarsDiceSession', JSON.stringify({ 
          roomCode: code, 
          playerName: name,
          timestamp: Date.now()
        }));
      } else {
        throw new Error(response.error || response.message || "Failed to join room");
      }
    } catch (error: any) {
      console.error('Join game failed:', error);
      alert(error.message || "Failed to join room. Please try again.");
      resetGame();
    }
  };

  const handleStartSinglePlayer = useCallback((playerCount: number) => {
    dispatch({ type: 'SET_INITIAL_PLAYER_COUNT', payload: playerCount });
    dispatch({ type: 'SET_CURRENT_BID', payload: null });

    const computerPlayers = Array.from({ length: playerCount - 1 }, (_, i) => ({
      id: `computer-${i}`,
      name: `Computer ${i + 1}`,
      diceCount: 5,
      dice: rollDice(5),
      isHuman: false,
      connected: true,
      eliminated: false
    }));

    const humanPlayer = {
      id: 'human',
      name: 'You',
      diceCount: 5,
      dice: rollDice(5),
      isHuman: true,
      connected: true,
      eliminated: false
    };

    dispatch({ type: 'SET_PLAYERS', payload: [humanPlayer, ...computerPlayers] });
    dispatch({ type: 'SET_GAME_STATUS', payload: 'playing' });
    dispatch({ type: 'SET_GAME_MODE', payload: 'singlePlayer' });
    dispatch({ type: 'SET_CURRENT_PLAYER_INDEX', payload: 0 });
  }, [dispatch]);

  const handleStartMultiplayer = useCallback(async () => {
    try {
      const response = await startGame(state.roomCode);
      if (!response.success) {
        throw new Error(response.message || "Failed to start game");
      }
      dispatch({ type: 'SET_GAME_STATUS', payload: 'playing' });
    } catch (error: any) {
      console.error('Start game failed:', error);
      alert(error.message || "Failed to start game. Please try again.");
    }
  }, [state.roomCode, dispatch]);

  const handlePlaceBid = useCallback(async (quantity: number, value: number) => {
    const bid = { quantity, value };
    
    if (!isValidBid(bid, state.currentBid, state.isEndGame)) {
      alert('Invalid bid!');
      return;
    }

    dispatch({ type: 'SET_CURRENT_BID', payload: bid });
    
    if (state.gameMode === 'multiplayer') {
      try {
        await placeBid(state.roomCode, bid);
      } catch (error: any) {
        console.error('Place bid failed:', error);
        alert(error.message || "Failed to place bid. Please try again.");
      }
    } else {
      // Find next player with dice
      const activePlayers = state.players.filter(p => p.diceCount > 0);
      let nextIndex = (state.currentPlayerIndex + 1) % state.players.length;
      while (state.players[nextIndex].diceCount === 0) {
        nextIndex = (nextIndex + 1) % state.players.length;
      }
      dispatch({ type: 'SET_CURRENT_PLAYER_INDEX', payload: nextIndex });
      
      let actionMessage;
      if (state.isEndGame) {
        actionMessage = `${state.players[state.currentPlayerIndex].name} bid sum of ${value}`;
      } else {
        actionMessage = `${state.players[state.currentPlayerIndex].name} bid ${quantity}x${value}`;
      }
      dispatch({ type: 'SET_LAST_ACTION', payload: actionMessage });
      dispatch({ type: 'ADD_LOG_ENTRY', payload: createLogEntry(actionMessage) });
    }
  }, [state, dispatch]);

  const handleChallenge = useCallback(async () => {
    if (!state.currentBid) return;

    if (state.gameMode === 'multiplayer') {
      try {
        await challenge(state.roomCode);
      } catch (error: any) {
        console.error('Challenge failed:', error);
        alert(error.message || "Failed to challenge. Please try again.");
      }
    } else {
      const outcome = resolveChallengeOutcome(
        state.players,
        state.currentPlayerIndex,
        state.currentBid,
        state.isEndGame
      );
      
      // Update the loser's dice count and array, and roll new dice for the next round
      const updatedPlayers = state.players.map((p, i) => {
        if (i === outcome.loserIndex) {
          const newDiceCount = p.diceCount - 1;
          return {
            ...p,
            diceCount: newDiceCount,
            dice: newDiceCount > 0 ? rollDice(newDiceCount) : [],
            eliminated: newDiceCount === 0
          };
        }
        return {
          ...p,
          dice: p.diceCount > 0 ? rollDice(p.diceCount) : []
        };
      });
      
      let actionMessage;
      if (state.isEndGame) {
        actionMessage = `${outcome.challengerName} challenged ${outcome.bidderName}'s bid that the sum would be ${state.currentBid.value}! ` +
          `The actual sum was ${outcome.actualCount}. ${outcome.loserName} loses a die!`;
      } else {
        actionMessage = `${outcome.challengerName} challenged ${outcome.bidderName}'s bid of ${state.currentBid.quantity}x${state.currentBid.value}! ` +
          `There were ${outcome.actualCount} ${state.currentBid.value}'s. ${outcome.loserName} loses a die!`;
      }
      
      dispatch({ type: 'SET_LAST_ACTION', payload: actionMessage });
      dispatch({ type: 'ADD_LOG_ENTRY', payload: createLogEntry(actionMessage) });
      dispatch({ type: 'SET_CURRENT_BID', payload: null });
      
      // Only filter out players with 0 dice
      const remainingPlayers = updatedPlayers.filter(p => p.diceCount > 0);
      
      if (remainingPlayers.length === 1) {
        const winner = remainingPlayers[0];
        const winnerData: Winner = {
          id: winner.id,
          name: winner.name,
          isHuman: winner.isHuman
        };
        dispatch({ type: 'SET_PLAYERS', payload: remainingPlayers });
        dispatch({ type: 'SET_GAME_STATUS', payload: 'gameOver' });
        dispatch({ type: 'SET_WINNER', payload: winnerData });
        dispatch({ type: 'ADD_LOG_ENTRY', payload: createLogEntry(`Game Over! ${winner.name} wins!`) });
      } else {
        // Set the loser as the first player of the next round if they still have dice
        const nextPlayerIndex = updatedPlayers[outcome.loserIndex].diceCount > 0 
          ? outcome.loserIndex 
          : remainingPlayers.findIndex(p => p.diceCount > 0);
          
        dispatch({ type: 'SET_CURRENT_PLAYER_INDEX', payload: nextPlayerIndex });
        dispatch({ type: 'SET_PLAYERS', payload: updatedPlayers });
      }
    }
  }, [state, dispatch]);

  return {
    resetGame,
    handleCreateGame,
    handleJoinGame,
    handleStartSinglePlayer,
    handleStartMultiplayer,
    handlePlaceBid,
    handleChallenge
  };
};
