'use client';

import React, { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader } from './ui/card';
import { 
  Users, 
  Copy, 
  ArrowLeft, 
  CheckCircle2, 
  Clock, 
  PlayCircle,
  LoaderCircle
} from 'lucide-react';

type WaitingRoomProps = {
  roomCode: string;
  players: string[];
  onStartGame: () => void;
  onCancel: () => void;
};

const WaitingRoom: React.FC<WaitingRoomProps> = ({ 
  roomCode, 
  players, 
  onStartGame, 
  onCancel 
}) => {
  const [copied, setCopied] = useState(false);

  const copyRoomCode = async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy room code:', err);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <Card className="game-card max-w-md w-full animate-fade-in">
        <CardHeader>
          <div className="flex items-center justify-between">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={onCancel}
              className="absolute left-4 top-4 hover:bg-background/80"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center space-x-2 mx-auto">
              <Users className="h-6 w-6 text-primary" />
              <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">
                Waiting Room
              </h2>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Room Code Section */}
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-primary/10 animate-pulse-ring rounded-lg" />
            <div className="relative bg-card p-4 rounded-lg border shadow-sm">
              <label className="text-sm font-medium text-muted-foreground block mb-2">
                Room Code
              </label>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold tracking-wider">
                  {roomCode}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={copyRoomCode}
                  className="hover:bg-primary/10"
                >
                  {copied ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Players List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Players</h3>
              <span className="text-sm text-muted-foreground">
                {players.length} {players.length === 1 ? 'player' : 'players'}
              </span>
            </div>
            <div className="space-y-2">
              {players.map((player, index) => (
                <div 
                  key={index}
                  className="flex items-center justify-between p-3 rounded-lg bg-background/50 border animate-fade-in"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="font-medium">{player}</span>
                  </div>
                  {index === 0 && (
                    <span className="text-xs text-primary font-medium px-2 py-1 rounded-full bg-primary/10">
                      Host
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Waiting Message */}
          <div className="text-center text-muted-foreground">
            {players.length < 2 ? (
              <div className="flex items-center justify-center space-x-2">
                <Clock className="h-4 w-4 animate-pulse" />
                <span>Waiting for more players to join...</span>
              </div>
            ) : (
              <div className="flex items-center justify-center space-x-2">
                <PlayCircle className="h-4 w-4" />
                <span>Ready to start!</span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="space-y-3 pt-4">
            <Button 
              onClick={onStartGame}
              disabled={players.length < 2}
              className="game-button w-full relative group overflow-hidden"
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                {players.length < 2 ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <PlayCircle className="h-4 w-4" />
                )}
                Start Game
              </span>
              <div className="absolute inset-0 bg-gradient-to-r from-primary/0 via-primary/10 to-primary/0 
                transform translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
            </Button>

            <Button 
              onClick={onCancel} 
              variant="outline"
              className="w-full hover:bg-background/80"
            >
              Leave Room
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default WaitingRoom;
