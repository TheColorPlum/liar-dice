'use client';

import React from 'react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Trophy, RotateCcw, Home, Crown } from 'lucide-react';

interface GameControlsProps {
  gameStatus: 'waiting' | 'playing' | 'roundEnd' | 'gameOver';
  winner: { id: string; name: string } | null;
  onReset: () => void;
  onCancel: () => void;
  isHost?: boolean;
  onStartGame?: () => void;
  roomCode?: string | null;
}

/**
 * Renders game control buttons and status information
 */
const GameControls: React.FC<GameControlsProps> = ({
  gameStatus,
  winner,
  onReset,
  onCancel,
  isHost,
  onStartGame,
  roomCode
}) => {
  if (gameStatus === 'gameOver' && winner) {
    return (
      <Card className="game-card max-w-md mx-auto animate-fade-in">
        <CardContent className="p-8 text-center">
          <div className="relative mb-8">
            <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
              <div className="relative">
                <Trophy className="h-16 w-16 text-primary animate-bounce-slow" />
                <div className="absolute inset-0 bg-primary/20 blur-xl animate-pulse-ring rounded-full" />
              </div>
            </div>
          </div>

          <div className="space-y-4 mb-8">
            <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">
              Game Over!
            </h2>
            <div className="flex items-center justify-center space-x-2">
              <Crown className="h-5 w-5 text-primary" />
              <p className="text-xl font-semibold">
                {winner.name} wins!
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <Button 
              onClick={onReset}
              className="game-button w-full relative group overflow-hidden"
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                <RotateCcw className="h-4 w-4" />
                Play Again
              </span>
              <div className="absolute inset-0 bg-gradient-to-r from-primary/0 via-primary/10 to-primary/0 
                transform translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
            </Button>

            <Button 
              onClick={onCancel} 
              variant="outline"
              className="w-full hover:bg-background/80 flex items-center justify-center gap-2"
            >
              <Home className="h-4 w-4" />
              Return to Menu
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return null;
};

export default GameControls;
