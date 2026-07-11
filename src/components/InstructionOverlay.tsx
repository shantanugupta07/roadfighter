/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { X, Keyboard, HelpCircle, Zap, ShieldCheck, Fuel } from 'lucide-react';

interface InstructionOverlayProps {
  onClose: () => void;
}

export default function InstructionOverlay({ onClose }: InstructionOverlayProps) {
  return (
    <div
      className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in"
      id="instruction-overlay-container"
    >
      <div
        className="w-full max-w-lg bg-slate-900 border-2 border-slate-800 rounded-lg p-6 shadow-2xl relative text-slate-300 font-sans"
        id="instruction-card"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white hover:bg-slate-800 p-1 rounded-full transition duration-150"
          title="Close Instruction Panel"
          id="close-instruction-btn"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 border-b border-slate-800 pb-3 mb-4">
          <HelpCircle className="w-6 h-6 text-red-500" />
          <h2 className="text-xl font-bold text-white uppercase tracking-wider font-mono">
            Racer's Manual
          </h2>
        </div>

        <div className="space-y-4 text-sm leading-relaxed" id="manual-body">
          {/* Section 1: Objectives */}
          <div>
            <h3 className="text-yellow-400 font-mono text-xs font-semibold uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-yellow-400" /> Mission Objective
            </h3>
            <p className="text-xs text-slate-400 pl-5">
              Reach the finish line of the highway before your fuel fluid depletes! Weave through traffic, avoid obstacles, and survive collisions.
            </p>
          </div>

          {/* Section 2: Controls Grid */}
          <div>
            <h3 className="text-yellow-400 font-mono text-xs font-semibold uppercase tracking-widest mb-2 flex items-center gap-1.5">
              <Keyboard className="w-3.5 h-3.5 text-yellow-400" /> Keyboard Keybinds
            </h3>
            <div className="grid grid-cols-2 gap-2 pl-5">
              <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 p-2 rounded text-xs">
                <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 text-white rounded font-mono text-[10px]">▲</kbd> or <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 text-white rounded font-mono text-[10px]">W</kbd>
                <span className="text-slate-400">Accelerate</span>
              </div>
              <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 p-2 rounded text-xs">
                <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 text-white rounded font-mono text-[10px]">▼</kbd> or <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 text-white rounded font-mono text-[10px]">S</kbd>
                <span className="text-slate-400">Brake</span>
              </div>
              <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 p-2 rounded text-xs">
                <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 text-white rounded font-mono text-[10px]">◀</kbd> / <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 text-white rounded font-mono text-[10px]">▶</kbd>
                <span className="text-slate-400">Steer left / right</span>
              </div>
              <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 p-2 rounded text-xs">
                <kbd className="px-3 py-0.5 bg-slate-800 border border-slate-700 text-white rounded font-mono text-[10px]">Space</kbd> or <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 text-white rounded font-mono text-[10px]">G</kbd>
                <span className="text-red-400 font-semibold font-mono">Shift Gear</span>
              </div>
            </div>
            <p className="text-[10px] text-slate-500 mt-1 pl-5">
              * On mobile devices, use the dedicated touch controls rendered below the game.
            </p>
          </div>

          {/* Section 3: Advanced Mechanics */}
          <div>
            <h3 className="text-yellow-400 font-mono text-xs font-semibold uppercase tracking-widest mb-2 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-yellow-400" /> Advanced Physics
            </h3>
            <ul className="text-xs text-slate-400 list-disc pl-9 space-y-1.5">
              <li>
                <strong className="text-slate-200">The Gearbox Strategy:</strong> Low Gear accelerates rapidly up to 196 km/h. High Gear has low torque (very slow start) but unlocks extreme speeds up to 400 km/h. Shift to High Gear around 150 km/h!
              </li>
              <li>
                <strong className="text-slate-200">Survival Skid Recovery:</strong> When you bump into other cars or hit oil slicks, you enter a lateral skid. <span className="text-yellow-400 font-bold">Steer aggressively in the OPPOSITE direction of the skid</span> to recover. Hitting a side wall while skidding results in an instant explosion!
              </li>
              <li>
                <strong className="text-slate-200">Obstacles & Collisions:</strong> Rocks and Barriers result in instant fuel penalty crashes. Blue cars drive steadily. Pink cars drift lanes to block you. Trucks take up space. Cyan speeders approach fast from behind!
              </li>
            </ul>
          </div>

          {/* Section 4: Fuel replenishment */}
          <div className="flex items-center gap-3 bg-slate-950/70 border border-slate-800 p-3 rounded-md">
            <Fuel className="w-8 h-8 text-yellow-500 shrink-0" />
            <div>
              <h4 className="text-xs font-bold text-slate-200 font-mono">FUEL REPLENISHMENT CARS</h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Watch out for golden/flashing cars marked with <strong className="text-yellow-400">F</strong>. Ram directly into them to gain <strong className="text-yellow-400 font-bold">+25 Fuel Fluids</strong> and a substantial score bonus!
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5 pt-3 border-t border-slate-800 text-center">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold font-mono rounded transition duration-150 uppercase tracking-widest"
            id="close-manual-ok-btn"
          >
            UNDERSTOOD
          </button>
        </div>
      </div>
    </div>
  );
}
