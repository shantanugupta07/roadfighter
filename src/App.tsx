/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { GameState, GameStats } from './types';
import GameCanvas from './components/GameCanvas';
import InstructionOverlay from './components/InstructionOverlay';
import audio from './utils/AudioEngine';

export default function App() {
  const [gameState, setGameState] = useState<GameState>(GameState.START);
  const [showInstructions, setShowInstructions] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // Initialize statistics
  const [stats, setStats] = useState<GameStats>({
    score: 0,
    highScore: parseInt(localStorage.getItem('roadfighter_highscore') || '10000', 10),
    fuel: 100,
    speed: 0,
    gear: 'LOW',
    distanceCovered: 0,
    stageId: 1,
  });

  // Load initial settings
  useEffect(() => {
    setIsMuted(audio.getMuteStatus());
  }, []);

  return (
    <div
      className="min-h-screen w-full bg-[#030712] bg-grid-pattern flex flex-col items-center justify-between py-6 px-4 relative overflow-x-hidden selection:bg-red-600 selection:text-white"
      id="arcade-room-container"
    >
      {/* Background Neon ambient glows */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-red-600/5 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-600/5 rounded-full blur-3xl pointer-events-none"></div>

      {/* Main Arcade Frame Container */}
      <main className="flex-1 w-full flex items-center justify-center z-10" id="arcade-cabinet-frame">
        <GameCanvas
          gameState={gameState}
          setGameState={setGameState}
          stats={stats}
          setStats={setStats}
          isMuted={isMuted}
          setIsMuted={setIsMuted}
          onShowInstructions={() => setShowInstructions(true)}
        />
      </main>

      {/* Manual Overlay Dialog */}
      {showInstructions && (
        <InstructionOverlay onClose={() => setShowInstructions(false)} />
      )}

      {/* Humble Footer containing licensing info */}
      <footer className="w-full text-center py-4 text-[11px] text-slate-600 font-mono tracking-wider z-10 select-none">
        ROAD FIGHTER RETRO COIN-OP • POWERED BY CANVAS ENGINE • © 2026
      </footer>
    </div>
  );
}
