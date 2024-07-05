// components/WaitingRoom.tsx
import React from 'react';
import { Button } from '@/components/ui/button';

type WaitingRoomProps = {
  roomCode: string;
  players: string[];
  onStartGame: () => void;
  onCancel: () => void;
};

const WaitingRoom: React.FC<WaitingRoomProps> = ({ roomCode, players, onStartGame, onCancel }) => {
  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <h2 className="text-2xl font-bold mb-4">Waiting Room</h2>
      <p className="mb-4">Room Code: <span className="font-bold">{roomCode}</span></p>
      <h3 className="text-xl mb-2">Players:</h3>
      <ul className="mb-4">
        {players.map((player, index) => (
          <li key={index}>{player}</li>
        ))}
      </ul>
      <div className="space-x-4">
        <Button onClick={onStartGame}>Start Game</Button>
        <Button onClick={onCancel} variant="outline">Cancel</Button>
      </div>
    </div>
  );
};

export default WaitingRoom;