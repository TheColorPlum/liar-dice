'use client';

import React, { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader } from './ui/card';
import { ArrowLeft, Users, UserPlus } from 'lucide-react';

type JoinGameProps = {
  onJoin: (code: string, name: string) => void;
  onCreate: (name: string) => void;
  onCancel: () => void;
  mode: 'join' | 'create';
};

const JoinGame: React.FC<JoinGameProps> = ({ onJoin, onCreate, onCancel, mode }) => {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [isValidating, setIsValidating] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsValidating(true);

    if (!name.trim()) {
      return;
    }

    if (mode === 'join') {
      if (!code.trim()) {
        return;
      }
      onJoin(code.trim(), name.trim());
    } else {
      onCreate(name.trim());
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <Card className="game-card max-w-md w-full animate-fade-in">
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={onCancel}
              className="absolute left-4 top-4 hover:bg-background/80"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Users className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">
              {mode === 'join' ? 'Join Game' : 'Create Game'}
            </h2>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                Your Name
              </label>
              <Input 
                type="text" 
                value={name} 
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  setName(e.target.value);
                  setIsValidating(false);
                }}
                placeholder="Enter your name"
                className={`${isValidating && !name.trim() ? 'border-destructive' : ''}`}
                maxLength={20}
              />
              {isValidating && !name.trim() && (
                <p className="text-sm text-destructive animate-fade-in">
                  Please enter your name
                </p>
              )}
            </div>

            {mode === 'join' && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">
                  Game Code
                </label>
                <Input 
                  type="text" 
                  value={code} 
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    setCode(e.target.value.toUpperCase());
                    setIsValidating(false);
                  }}
                  placeholder="Enter the 6-digit code"
                  className={`text-lg tracking-wider text-center uppercase
                    ${isValidating && !code.trim() ? 'border-destructive' : ''}`}
                  maxLength={6}
                />
                {isValidating && !code.trim() && (
                  <p className="text-sm text-destructive animate-fade-in">
                    Please enter the game code
                  </p>
                )}
              </div>
            )}

            <div className="space-y-4">
              <Button 
                type="submit"
                className="game-button w-full relative group overflow-hidden"
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  <UserPlus className="h-4 w-4" />
                  {mode === 'join' ? 'Join Game' : 'Create Game'}
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-primary/0 via-primary/10 to-primary/0 
                  transform translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
              </Button>

              <Button 
                type="button"
                onClick={onCancel} 
                variant="outline"
                className="w-full hover:bg-background/80"
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default JoinGame;
