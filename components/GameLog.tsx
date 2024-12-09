'use client';

import React from 'react';
import { Card, CardHeader, CardContent } from './ui/card';
import { ScrollArea } from './ui/scroll-area';
import { GameLogEntry } from '../types/game';

interface GameLogProps {
  entries: GameLogEntry[];
}

/**
 * Displays a scrollable log of game events
 * @param entries - Array of log entries to display
 */
const GameLog: React.FC<GameLogProps> = ({ entries }) => {
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [entries]);

  const getMessageType = (message: string) => {
    if (message.includes('Challenge')) return 'challenge';
    if (message.includes('bid')) return 'bid';
    if (message.includes('joined')) return 'join';
    if (message.includes('started')) return 'start';
    if (message.includes('reset')) return 'reset';
    if (message.includes('won') || message.includes('lost')) return 'result';
    return 'info';
  };

  const getMessageIcon = (type: string) => {
    switch (type) {
      case 'challenge': return '⚔️';
      case 'bid': return '🎲';
      case 'join': return '👋';
      case 'start': return '🎮';
      case 'reset': return '🔄';
      case 'result': return '🏆';
      default: return '📝';
    }
  };

  return (
    <Card className="game-card">
      <CardHeader className="space-y-1">
        <div className="flex items-center space-x-2">
          <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">
            Game Log
          </h2>
          <div className="h-px flex-1 bg-gradient-to-r from-primary/20 to-accent/20" />
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="game-log" ref={scrollRef}>
          <div className="space-y-1">
            {entries.map((entry) => {
              const type = getMessageType(entry.message);
              const icon = getMessageIcon(type);
              
              return (
                <div 
                  key={entry.id} 
                  className="game-log-entry flex items-start space-x-2"
                >
                  <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center">
                    {icon}
                  </span>
                  <span className={`flex-1 text-sm ${
                    type === 'challenge' ? 'text-destructive font-medium' :
                    type === 'result' ? 'text-primary font-medium' :
                    'text-foreground'
                  }`}>
                    {entry.message}
                  </span>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

/**
 * Creates a new log entry with a unique ID
 * @param message - The message to log
 * @returns A new GameLogEntry object
 */
export const createLogEntry = (message: string): GameLogEntry => ({
  id: Date.now() + Math.random(),
  message
});

/**
 * Adds a new entry to the game log
 * @param entries - Current log entries
 * @param message - Message to add
 * @param unique - If true, prevents duplicate messages
 * @returns Updated array of log entries
 */
export const addLogEntry = (
  entries: GameLogEntry[],
  message: string,
  unique: boolean = false
): GameLogEntry[] => {
  if (unique && entries.some(entry => entry.message === message)) {
    return entries;
  }
  return [createLogEntry(message), ...entries];
};

export default GameLog;
