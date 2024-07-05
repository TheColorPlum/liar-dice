// components/JoinGame.tsx
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type JoinGameProps = {
  onJoin: (code: string) => void;
  onCancel: () => void;
};

const JoinGame: React.FC<JoinGameProps> = ({ onJoin, onCancel }) => {
  const [code, setCode] = useState('');

  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <h2 className="text-2xl font-bold mb-4">Join Game</h2>
      <Input 
        type="text" 
        value={code} 
        onChange={(e) => setCode(e.target.value)} 
        placeholder="Enter game code"
        className="mb-4"
      />
      <div className="space-x-4">
        <Button onClick={() => onJoin(code)}>Join</Button>
        <Button onClick={onCancel} variant="outline">Cancel</Button>
      </div>
    </div>
  );
};

export default JoinGame;