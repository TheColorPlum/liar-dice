'use client';

import React from 'react';
import { Card, CardHeader, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dice1, Dice2, Dice3, Dice4, Dice5, Dice6 } from 'lucide-react';
import { Player, Bid, GAME_CONSTANTS } from '../types/game';

interface DiceIconProps {
  value: number;
  hidden: boolean;
  className?: string;
}

/**
 * Renders a single die with the appropriate face value
 */
const DiceIcon: React.FC<DiceIconProps> = ({ value, hidden, className = "" }) => {
  const DiceComponents = [Dice1, Dice2, Dice3, Dice4, Dice5, Dice6];
  const Component = DiceComponents[hidden ? 5 : value - 1];
  return (
    <div className={`dice ${className}`}>
      <Component className="w-6 h-6" />
    </div>
  );
};

interface GameBoardProps {
  players: Player[];
  currentBid: Bid | null;
  currentPlayerIndex: number;
  playerId: string | null;
  isEndGame: boolean;
  gameMode: 'singlePlayer' | 'multiplayer';
  lastAction: string;
  onPlaceBid: (quantity: number, value: number) => void;
  onChallenge: () => void;
}

/**
 * Renders the main game board including player cards and bid controls
 */
const GameBoard: React.FC<GameBoardProps> = ({
  players,
  currentBid,
  currentPlayerIndex,
  playerId,
  isEndGame,
  gameMode,
  lastAction,
  onPlaceBid,
  onChallenge,
}) => {
  const [bidQuantity, setBidQuantity] = React.useState('');
  const [bidValue, setBidValue] = React.useState('');

  const isCurrentPlayersTurn = 
    (gameMode === 'singlePlayer' && players[currentPlayerIndex]?.isHuman) ||
    (gameMode === 'multiplayer' && players[currentPlayerIndex]?.id === playerId);

  const handlePlaceBid = () => {
    const quantity = isEndGame ? 1 : parseInt(bidQuantity);
    const value = parseInt(bidValue);
    onPlaceBid(quantity, value);
    setBidQuantity('');
    setBidValue('');
  };

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {players.map((player, index) => (
          <Card 
            key={player.id} 
            className={`game-card ${index === currentPlayerIndex ? 'player-active' : ''} 
              ${!player.connected ? 'opacity-60' : ''}`}
          >
            <CardHeader className="space-y-1">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold">{player.name}</h2>
                <span className="text-sm font-medium px-2 py-1 rounded-full bg-primary/10 text-primary">
                  {player.diceCount} {player.diceCount === 1 ? 'die' : 'dice'}
                </span>
              </div>
              {!player.connected && (
                <p className="text-sm text-destructive">Disconnected</p>
              )}
            </CardHeader>
            <CardContent className="flex flex-wrap justify-center items-center gap-3 p-4">
              {((gameMode === 'singlePlayer' && player.isHuman) || 
                (gameMode === 'multiplayer' && player.id === playerId)) ? (
                Array(player.diceCount).fill(0).map((_, i) => (
                  <DiceIcon 
                    key={i} 
                    value={player.dice[i] || 1} 
                    hidden={false}
                    className="dice-roll"
                  />
                ))
              ) : (
                Array(player.diceCount).fill(0).map((_, i) => (
                  <DiceIcon 
                    key={i} 
                    value={6} 
                    hidden={true}
                    className={index === currentPlayerIndex ? 'shake' : ''}
                  />
                ))
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="game-card mb-8">
        <CardContent className="p-6">
          <div className="flex flex-col space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">
                Current Bid
              </h2>
              <div className="flex items-center space-x-2">
                {currentBid && (
                  <>
                    <span className="text-2xl font-bold">
                      {isEndGame ? '' : currentBid.quantity + ' × '}
                    </span>
                    <DiceIcon value={currentBid.value} hidden={false} />
                  </>
                )}
                {!currentBid && (
                  <span className="text-lg text-muted-foreground">No bid yet</span>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-2 text-muted-foreground">
              <span className="text-sm">Last Action:</span>
              <span className="text-sm font-medium">{lastAction}</span>
            </div>
            
            {isCurrentPlayersTurn && (
              <div className="flex flex-wrap gap-4 items-end pt-4 border-t">
                {!isEndGame && (
                  <Input
                    type="number"
                    placeholder="Quantity"
                    value={bidQuantity}
                    onChange={(e) => setBidQuantity(e.target.value)}
                    className="w-32"
                    min="1"
                  />
                )}
                <Select onValueChange={setBidValue} value={bidValue}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Die Value" />
                  </SelectTrigger>
                  <SelectContent>
                    {(isEndGame ? 
                      Array.from({ length: 11 }, (_, i) => i + 2) : 
                      Array.from({ length: 5 }, (_, i) => i + 2)
                    ).map(value => (
                      <SelectItem key={value} value={value.toString()}>{value}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex gap-2">
                  <Button 
                    onClick={handlePlaceBid}
                    className="game-button"
                    disabled={!bidValue || (!isEndGame && !bidQuantity)}
                  >
                    Place Bid
                  </Button>
                  {currentBid && (
                    <Button 
                      onClick={onChallenge} 
                      variant="outline"
                      className="hover:bg-destructive hover:text-destructive-foreground transition-colors"
                    >
                      Challenge!
                    </Button>
                  )}
                </div>
              </div>
            )}
            
            {!isCurrentPlayersTurn && (
              <div className="flex items-center justify-center p-4 border rounded-lg bg-muted/50">
                <p className="text-lg font-medium animate-pulse">
                  {players[currentPlayerIndex]?.name} is thinking...
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default GameBoard;
