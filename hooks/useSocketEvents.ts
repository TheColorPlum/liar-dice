'use client';

import { useEffect } from 'react';
import { useGameState } from '../contexts/GameStateContext';
import socketHandler from '../lib/socket';
import {
  RoomUpdateData,
  PlayerJoinedData,
  PlayerLeftData,
  PlayerReconnectedData,
  PlayerDisconnectedData,
  GameStartedData,
  BidPlacedData,
  ChallengeResult,
  NewRoundData,
  GameOverData,
  GameResetData
} from '../types/game';

let logEntryId = 1; // Counter for generating unique log entry IDs

const createLogEntry = (message: string) => ({
  id: logEntryId++,
  message
});

export const useSocketEvents = () => {
  const { state, dispatch } = useGameState();

  useEffect(() => {
    if (state.gameMode === 'multiplayer') {
      socketHandler.updateCallbacks({
        onConnect: () => {
          console.log('Socket connected');
          dispatch({ type: 'SET_IS_DISCONNECTED', payload: false });
        },

        onDisconnect: (reason: string) => {
          console.log('Socket disconnected:', reason);
          dispatch({ type: 'SET_IS_DISCONNECTED', payload: true });
          dispatch({ type: 'ADD_LOG_ENTRY', payload: createLogEntry('Connection lost. Attempting to reconnect...') });
        },

        onPlayerJoined: (player: PlayerJoinedData) => {
          dispatch({ type: 'ADD_LOG_ENTRY', payload: createLogEntry(`${player.name} joined the game`) });
        },

        onRoomUpdate: (data: RoomUpdateData) => {
          // Update complete game state from server
          dispatch({ type: 'SET_PLAYERS', payload: data.players });
          if (data.gameState) {
            dispatch({ type: 'SET_GAME_STATUS', payload: data.gameState });
          }
          if (typeof data.currentPlayerIndex !== 'undefined') {
            dispatch({ type: 'SET_CURRENT_PLAYER_INDEX', payload: data.currentPlayerIndex });
          }
          if (typeof data.currentBid !== 'undefined') {
            dispatch({ type: 'SET_CURRENT_BID', payload: data.currentBid });
          }
        },

        onPlayerLeft: (data: PlayerLeftData) => {
          dispatch({ 
            type: 'SET_PLAYERS', 
            payload: state.players.map(p => 
              p.id === data.playerId ? { ...p, connected: false } : p
            )
          });
          dispatch({ type: 'ADD_LOG_ENTRY', payload: createLogEntry(`${data.playerName} left the game`) });
        },

        onPlayerReconnected: (data: PlayerReconnectedData) => {
          // Update complete game state for reconnected player
          dispatch({ 
            type: 'SET_PLAYERS',
            payload: state.players.map((p, i) => 
              i === data.playerIndex ? { ...p, connected: true } : p
            )
          });
          if (data.currentPlayerIndex !== undefined) {
            dispatch({ type: 'SET_CURRENT_PLAYER_INDEX', payload: data.currentPlayerIndex });
          }
          if (data.currentBid !== undefined) {
            dispatch({ type: 'SET_CURRENT_BID', payload: data.currentBid });
          }
          if (data.gameState) {
            dispatch({ type: 'SET_GAME_STATUS', payload: data.gameState });
          }
          dispatch({ type: 'ADD_LOG_ENTRY', payload: createLogEntry(`${data.playerName} reconnected`) });
        },

        onPlayerDisconnected: (data: PlayerDisconnectedData) => {
          dispatch({ 
            type: 'SET_PLAYERS',
            payload: state.players.map((p, i) => 
              i === data.playerIndex ? { ...p, connected: false } : p
            )
          });
          dispatch({ type: 'ADD_LOG_ENTRY', payload: createLogEntry(`${data.playerName} disconnected. They have ${Math.floor(data.reconnectGracePeriod / 1000)} seconds to reconnect.`) });
        },

        onGameStarted: (data: GameStartedData) => {
          dispatch({ type: 'SET_PLAYERS', payload: data.players });
          dispatch({ type: 'SET_CURRENT_PLAYER_INDEX', payload: data.currentPlayerIndex });
          dispatch({ type: 'SET_GAME_STATUS', payload: 'playing' });
          dispatch({ type: 'SET_CURRENT_BID', payload: null });
          dispatch({ type: 'SET_WINNER', payload: null });
          
          const currentPlayer = data.players.find(p => p.name === state.playerName);
          if (currentPlayer) {
            dispatch({ type: 'SET_PLAYER_ID', payload: currentPlayer.id });
          }
          
          dispatch({ type: 'ADD_LOG_ENTRY', payload: createLogEntry('Game started') });
          
          // Add log entry for first player
          const firstPlayer = data.players[data.currentPlayerIndex];
          if (firstPlayer) {
            dispatch({ type: 'ADD_LOG_ENTRY', payload: createLogEntry(`${firstPlayer.name} goes first`) });
          }
        },

        onBidPlaced: (data: BidPlacedData) => {
          dispatch({ type: 'SET_CURRENT_BID', payload: data.bid });
          
          // Use the server's nextPlayerIndex directly
          dispatch({ type: 'SET_CURRENT_PLAYER_INDEX', payload: data.nextPlayerIndex });
          
          let actionMessage;
          if (state.isEndGame) {
            actionMessage = `${data.playerName} bid sum of ${data.bid.value}`;
          } else {
            actionMessage = `${data.playerName} bid ${data.bid.quantity}x${data.bid.value}`;
          }
          
          dispatch({ type: 'SET_LAST_ACTION', payload: actionMessage });
          dispatch({ type: 'ADD_LOG_ENTRY', payload: createLogEntry(actionMessage) });
        },

        onChallengeResult: (result: ChallengeResult) => {
          dispatch({ type: 'SET_CURRENT_BID', payload: null });
          
          let actionMessage;
          if (state.isEndGame) {
            actionMessage = `${result.challengerName} challenged ${result.bidderName}'s bid that the sum would be ${result.bid.value}! ` +
              `The actual sum was ${result.actualCount}. ${result.loserName} loses a die!`;
          } else {
            actionMessage = `${result.challengerName} challenged ${result.bidderName}'s bid of ${result.bid.quantity}x${result.bid.value}! ` +
              `There were ${result.actualCount} ${result.bid.value}'s. ${result.loserName} loses a die!`;
          }
          
          dispatch({ type: 'SET_LAST_ACTION', payload: actionMessage });
          dispatch({ type: 'ADD_LOG_ENTRY', payload: createLogEntry(actionMessage) });
          
          // Filter out eliminated players
          const updatedPlayers = result.players.filter(p => p.diceCount > 0);
          dispatch({ type: 'SET_PLAYERS', payload: updatedPlayers });

          // Add elimination message if player lost their last die
          const loser = result.players[result.loserIndex];
          if (loser && loser.diceCount === 0) {
            dispatch({ type: 'ADD_LOG_ENTRY', payload: createLogEntry(`${loser.name} has been eliminated!`) });
          }
        },

        onNewRound: (data: NewRoundData) => {
          // Update complete game state for new round
          dispatch({ type: 'SET_PLAYERS', payload: data.players });
          dispatch({ type: 'SET_CURRENT_PLAYER_INDEX', payload: data.currentPlayerIndex });
          dispatch({ type: 'SET_CURRENT_BID', payload: null });
          
          // Add new round message with first player
          const firstPlayer = data.players[data.currentPlayerIndex];
          if (firstPlayer) {
            dispatch({ type: 'ADD_LOG_ENTRY', payload: createLogEntry(`New round! ${firstPlayer.name} goes first`) });
          }
        },

        onGameOver: (data: GameOverData) => {
          dispatch({ type: 'SET_GAME_STATUS', payload: 'gameOver' });
          dispatch({ type: 'SET_WINNER', payload: data.winner });
          dispatch({ type: 'ADD_LOG_ENTRY', payload: createLogEntry(`Game Over! ${data.winner.name} wins!`) });
          dispatch({ type: 'SET_CURRENT_BID', payload: null });
          localStorage.removeItem('liarsDiceSession');
        },

        onGameReset: (data: GameResetData) => {
          dispatch({ type: 'SET_PLAYERS', payload: data.players });
          dispatch({ type: 'SET_CURRENT_PLAYER_INDEX', payload: data.currentPlayerIndex });
          dispatch({ type: 'SET_GAME_STATUS', payload: 'playing' });
          dispatch({ type: 'SET_CURRENT_BID', payload: null });
          dispatch({ type: 'SET_IS_END_GAME', payload: false });
          dispatch({ type: 'SET_WINNER', payload: null });
          dispatch({ type: 'ADD_LOG_ENTRY', payload: createLogEntry('Game reset') });
          
          // Add first player message
          const firstPlayer = data.players[data.currentPlayerIndex];
          if (firstPlayer) {
            dispatch({ type: 'ADD_LOG_ENTRY', payload: createLogEntry(`${firstPlayer.name} goes first`) });
          }
        },

        onError: (error: string) => {
          console.error('Socket error:', error);
          dispatch({ type: 'ADD_LOG_ENTRY', payload: createLogEntry(`Error: ${error}`) });
        }
      });

      return () => {
        socketHandler.updateCallbacks({});
      };
    }
  }, [state.gameMode, state.players, state.playerName, state.isEndGame, dispatch]);
};
