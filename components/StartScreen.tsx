'use client';

import React from 'react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Dice1, Dice2, Dice3, Dice4, Dice5, Dice6 } from 'lucide-react';

type StartScreenProps = {
  onSelectSinglePlayer: (playerCount: number) => void;
  onSelectMultiplayer: () => void;
  onSelectJoinGame: () => void;
};

const StartScreen: React.FC<StartScreenProps> = ({ 
  onSelectSinglePlayer, 
  onSelectMultiplayer, 
  onSelectJoinGame 
}) => {
  const [playerCount, setPlayerCount] = React.useState(2);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
        <div className="absolute top-10 left-10 animate-bounce-slow opacity-20">
          <Dice1 className="w-16 h-16" />
        </div>
        <div className="absolute top-20 right-20 animate-bounce-delayed opacity-20">
          <Dice2 className="w-12 h-12" />
        </div>
        <div className="absolute bottom-20 left-1/4 animate-bounce opacity-20">
          <Dice3 className="w-14 h-14" />
        </div>
        <div className="absolute top-1/3 right-1/4 animate-bounce-slow opacity-20">
          <Dice4 className="w-10 h-10" />
        </div>
        <div className="absolute bottom-10 right-10 animate-bounce-delayed opacity-20">
          <Dice5 className="w-16 h-16" />
        </div>
        <div className="absolute bottom-1/4 left-10 animate-bounce opacity-20">
          <Dice6 className="w-12 h-12" />
        </div>
      </div>

      <Card className="game-card max-w-lg w-full">
        <CardContent className="p-8">
          <div className="text-center mb-8">
            <h1 className="game-title mb-4">Liar's Dice</h1>
            <p className="text-muted-foreground mb-6">
              A classic game of deception and strategy. Challenge your opponents' bids
              or bluff your way to victory!
            </p>
          </div>

          <div className="space-y-4 mb-8">
            <div className="space-y-2">
              <select 
                className="w-full p-3 rounded-lg bg-background border text-foreground"
                value={playerCount}
                onChange={(e) => setPlayerCount(parseInt(e.target.value))}
              >
                {[2, 3, 4, 5, 6].map(num => (
                  <option key={num} value={num}>{num} players</option>
                ))}
              </select>
              <Button 
                onClick={() => onSelectSinglePlayer(playerCount)} 
                className="game-button w-full h-14 text-lg relative overflow-hidden group"
              >
                <span className="relative z-10">Single Player</span>
                <div className="absolute inset-0 bg-gradient-to-r from-primary/0 via-primary/10 to-primary/0 
                  transform translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
              </Button>
            </div>
            
            <Button 
              onClick={onSelectMultiplayer} 
              className="game-button w-full h-14 text-lg relative overflow-hidden group"
            >
              <span className="relative z-10">Create Multiplayer Game</span>
              <div className="absolute inset-0 bg-gradient-to-r from-primary/0 via-primary/10 to-primary/0 
                transform translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
            </Button>
            
            <Button 
              onClick={onSelectJoinGame} 
              className="game-button w-full h-14 text-lg relative overflow-hidden group"
              variant="outline"
            >
              <span className="relative z-10">Join Game</span>
              <div className="absolute inset-0 bg-gradient-to-r from-accent/0 via-accent/10 to-accent/0 
                transform translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
            </Button>
          </div>

          <div className="text-sm text-muted-foreground">
            <h3 className="font-semibold mb-2">How to Play:</h3>
            <ul className="list-disc list-inside space-y-1">
              <li>Each player starts with five dice</li>
              <li>Players take turns making bids about the dice on the table</li>
              <li>Challenge a bid you think is false</li>
              <li>Last player with dice wins!</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default StartScreen;
