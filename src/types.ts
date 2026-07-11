/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum GameState {
  START = 'START',
  PLAYING = 'PLAYING',
  RESPAWN = 'RESPAWN',
  GAME_OVER = 'GAME_OVER',
  STAGE_CLEAR = 'STAGE_CLEAR',
}

export enum CarType {
  PLAYER = 'PLAYER',
  BASIC = 'BASIC',       // Regular car, moves straight
  LANE_CHANGER = 'LANE_CHANGER', // Changes lane when player gets close
  SPEEDER = 'SPEEDER',   // Fast car, moves from behind or overtakes
  TRUCK = 'TRUCK',       // Large, blocks more space, moves slowly
  FUEL = 'FUEL',         // Multi-colored fuel car. Grabbing it refills fuel!
}

export enum HazardType {
  OIL_SLICK = 'OIL_SLICK', // Makes player skid left/right
  ROCK = 'ROCK',           // Side-road hazard, instant crash if hit
  BARRIER = 'BARRIER',     // Inside road hazard
}

export interface Coordinates {
  x: number;
  y: number;
}

export interface StageConfig {
  id: number;
  name: string;
  roadWidth: number;      // Width of the road in pixels
  length: number;         // Total distance to complete the stage (meters)
  bgColor: string;        // Color of the grass/sides
  roadColor: string;      // Color of the road
  stripeColor: string;    // Lane stripe color
  enemyDensity: number;   // Spawn chance multiplier
  speedLimit: number;     // Max speed in km/h
  scenery?: 'tree' | 'building' | 'palm';
}

export interface Obstacle {
  id: string;
  type: HazardType;
  x: number;              // Relative to center of road or absolute X
  y: number;              // Absolute distance along track
  width: number;
  height: number;
}

export interface EnemyCar {
  id: string;
  type: CarType;
  x: number;              // Absolute x coordinate
  y: number;              // Y position on the track (moving vertically)
  width: number;
  height: number;
  speed: number;          // Speed in pixels/frame relative to road scroll
  color: string;          // Color theme
  lane: number;           // Targeted lane index
  laneChangeTimer: number;// Timer for changing lane
  isSpawning: boolean;    // Spawning from bottom or top
  state: 'NORMAL' | 'SKIDDING' | 'CRASHED';
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  life: number;
  maxLife: number;
}

export interface GameStats {
  score: number;
  highScore: number;
  fuel: number;           // Max 100
  speed: number;          // Current speed in km/h (0 to 400)
  gear: 'LOW' | 'HIGH';
  distanceCovered: number;// Distance covered in current stage (meters)
  stageId: number;
}
