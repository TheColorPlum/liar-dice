'use client';

import { useEffect } from 'react';
import { useGameState } from '../contexts/GameStateContext';
import { useGameActions } from '../hooks/useGameActions';
import { useSocketEvents } from '../hooks/useSocketEvents';
import { generateComputerMove } from '../utils/computerAI';
import { isEndGameScenario } from '../utils/gameLogic';
import StartScreen from './StartScreen';
import JoinGame from './JoinGame';
import WaitingRoom from './WaitingRoom';
import GameBoard from './GameBoard';
import GameLog from './GameLog';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import socketHandler, { cleanup } from '../lib/socket';

const LiarsDice: React.FC = () => {
  const { state, dispatch } = useGameState();
  const {
    resetGame,
    handleCreateGame,
    handleJoinGame,
    handleStartSinglePlayer,
    handleStartMultiplayer,
    handlePlaceBid,
    handleChallenge
  } = useGameActions();

  // Set up socket event handlers
  useSocketEvents();

  // Handle window close/refresh
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (state.gameMode === 'multiplayer') {
        cleanup();
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (state.gameMode === 'multiplayer') {
        cleanup();
      }
    };
  }, [state.gameMode]);

  // Check for end game scenario whenever players change
  useEffect(() => {
    if (state.gameStatus === 'playing') {
      dispatch({ type: 'SET_IS_END_GAME', payload: isEndGameScenario(state.players) });
    }
  }, [state.players, state.gameStatus, dispatch]);

  // Handle computer turns in single player mode
  useEffect(() => {
    if (state.gameMode === 'singlePlayer' && 
        state.gameStatus === 'playing' && 
        !state.players[state.currentPlayerIndex]?.isHuman) {
      const computerTurnTimeout = setTimeout(() => {
        const currentPlayer = state.players[state.currentPlayerIndex];
        const move = generateComputerMove(currentPlayer, state.players, state.currentBid, state.isEndGame);

        if (move.shouldChallenge) {
          handleChallenge();
        } else if (move.bid) {
          handlePlaceBid(move.bid.quantity, move.bid.value);
        }
      }, 1000);

      return () => clearTimeout(computerTurnTimeout);
    }
  }, [state, handleChallenge, handlePlaceBid]);

  const renderGameState = () => {
    if (state.isDisconnected && state.gameMode === 'multiplayer') {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <Card className="w-[90%] max-w-md">
            <CardHeader>
              <CardTitle className="text-center">Disconnected from server</CardTitle>
              <CardDescription className="text-center">
                Attempting to reconnect...
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
            </CardContent>
            <CardFooter>
              <Button 
                variant="secondary" 
                className="w-full"
                onClick={() => {
                  cleanup();
                  resetGame();
                  dispatch({ type: 'SET_GAME_MODE', payload: 'start' });
                }}
              >
                Return to Main Menu
              </Button>
            </CardFooter>
          </Card>
        </div>
      );
    }

    if (state.gameMode === 'start') {
      return (
        <StartScreen
          onSelectSinglePlayer={handleStartSinglePlayer}
          onSelectMultiplayer={() => dispatch({ type: 'SET_GAME_MODE', payload: 'create' })}
          onSelectJoinGame={() => dispatch({ type: 'SET_GAME_MODE', payload: 'join' })}
        />
      );
    }

    if (state.gameMode === 'create' || state.gameMode === 'join') {
      return (
        <JoinGame
          mode={state.gameMode}
          onJoin={handleJoinGame}
          onCreate={handleCreateGame}
          onCancel={() => {
            resetGame();
            dispatch({ type: 'SET_GAME_MODE', payload: 'start' });
          }}
        />
      );
    }

    if (state.gameStatus === 'waiting' && state.gameMode === 'multiplayer') {
      const isHost = state.players.length > 0 && state.players[0].name === state.playerName;
      return (
        <WaitingRoom
          roomCode={state.roomCode}
          players={state.players.map(p => p.name)}
          onStartGame={handleStartMultiplayer}
          onCancel={resetGame}
          isHost={isHost}
        />
      );
    }

    if (state.gameStatus === 'playing' && (state.gameMode === 'singlePlayer' || state.gameMode === 'multiplayer')) {
      return (
        <div className="container mx-auto p-4 space-y-6">
          <GameBoard
            players={state.players}
            currentBid={state.currentBid}
            currentPlayerIndex={state.currentPlayerIndex}
            playerId={state.playerId}
            isEndGame={state.isEndGame}
            gameMode={state.gameMode}
            lastAction={state.lastAction}
            onPlaceBid={handlePlaceBid}
            onChallenge={handleChallenge}
          />
          <GameLog entries={state.gameLog} />
          {state.gameMode === 'multiplayer' && (
            <div className="fixed bottom-4 right-4">
              <button
                onClick={resetGame}
                className="px-4 py-2 bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90"
              >
                Leave Game
              </button>
            </div>
          )}
        </div>
      );
    }

    if (state.gameStatus === 'gameOver') {
      const isPlayerWinner = state.winner?.name === state.playerName;
    
      return (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center">
          <Card className="w-[90%] max-w-md mx-auto">
            <CardHeader>
              <CardTitle className="text-center bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">
                Game Over!
              </CardTitle>
              <CardDescription className="text-center text-lg mt-2">
                {state.winner ? (isPlayerWinner ? 
                  "Congratulations! You've won the game!" :
                  `${state.winner.name} has won the game!`) : 
                  "Game Over!"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-center text-muted-foreground">
                {state.winner ? (isPlayerWinner ?
                  "You've outplayed your opponents and emerged victorious!" :
                  "Better luck next time! Keep practicing your bluffing skills.") :
                  "The game has ended."}
              </p>
            </CardContent>
            <CardFooter className="flex flex-col space-y-2">
              {state.gameMode === 'singlePlayer' ? (
                <Button 
                  onClick={() => handleStartSinglePlayer(state.initialPlayerCount)}
                  className="w-full"
                  variant="default"
                >
                  Play Again
                </Button>
              ) : (
                <Button
                  onClick={() => {
                    socketHandler.resetGame(state.roomCode, state.players).catch(error => {
                      console.error('Reset game failed:', error);
                      alert(error.message || "Failed to reset game. Please try again.");
                    });
                  }}
                  className="w-full"
                  variant="default"
                >
                  Play Again
                </Button>
              )}
              <Button 
                onClick={resetGame}
                className="w-full"
                variant="secondary"
              >
                Return to Main Menu
              </Button>
            </CardFooter>
          </Card>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="min-h-screen bg-background">
      {renderGameState()}
    </div>
  );
};

export default LiarsDice;
