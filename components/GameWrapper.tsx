'use client';

import dynamic from 'next/dynamic';
import { GameStateProvider } from '../contexts/GameStateContext';

const LiarsDice = dynamic(() => import('./LiarsDice'), { ssr: false });

export default function GameWrapper() {
  return (
    <GameStateProvider>
      <LiarsDice />
    </GameStateProvider>
  );
}
