// components/StartScreen.tsx
import React from 'react';
import { Button } from '@/components/ui/button';

type StartScreenProps = {
  onSelectSinglePlayer: () => void;
  onSelectMultiplayer: () => void;
  onSelectJoinGame: () => void;
};

const StartScreen: React.FC<StartScreenProps> = ({ onSelectSinglePlayer, onSelectMultiplayer, onSelectJoinGame }) => {
  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <h1 className="text-4xl font-bold mb-8">Liar's Dice</h1>
      <div className="space-y-4">
        <Button onClick={onSelectSinglePlayer} className="w-full">Single Player</Button>
        <Button onClick={onSelectMultiplayer} className="w-full">Multiplayer</Button>
        <Button onClick={onSelectJoinGame} className="w-full">Join Game</Button>
      </div>
    </div>
  );
};

export default StartScreen;