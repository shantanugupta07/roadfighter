/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { GameState, CarType, HazardType, EnemyCar, Obstacle, Particle, StageConfig, GameStats } from '../types';
import audio from '../utils/AudioEngine';
import { Play, RotateCcw, Volume2, VolumeX, ShieldAlert, Zap, Award, HelpCircle, Flame } from 'lucide-react';

// Stages definition
const STAGE_THEMES = [
  {
    name: "Forest Highway",
    bgColor: '#166534', // deep green forest
    roadColor: '#374151', // grey asphalt
    stripeColor: '#eab308', // yellow dashes
    scenery: 'tree' as const
  },
  {
    name: "Coastal Run",
    bgColor: '#0369a1', // ocean blue
    roadColor: '#4b5563', // grey asphalt
    stripeColor: '#ffffff', // white dashes
    scenery: 'palm' as const
  },
  {
    name: "Neon City Grid",
    bgColor: '#0f172a', // midnight dark
    roadColor: '#1e293b', // darker asphalt
    stripeColor: '#06b6d4', // neon cyan dashes
    scenery: 'building' as const
  },
  {
    name: "Desert Heatway",
    bgColor: '#b45309', // sandy orange
    roadColor: '#334155', // charcoal asphalt
    stripeColor: '#fef08a', // sandy yellow dashes
    scenery: 'palm' as const
  },
  {
    name: "Volcanic Caldera",
    bgColor: '#450a0a', // dark magma red
    roadColor: '#1e1b4b', // deep obsidian road
    stripeColor: '#f87171', // red neon dashes
    scenery: 'building' as const
  },
  {
    name: "Alpine Blizzard",
    bgColor: '#f1f5f9', // snowy white
    roadColor: '#334155', // dark road
    stripeColor: '#38bdf8', // frosty blue dashes
    scenery: 'tree' as const
  }
];

const STAGES: StageConfig[] = Array.from({ length: 50 }, (_, i) => {
  const id = i + 1;
  const themeIndex = i % STAGE_THEMES.length;
  const theme = STAGE_THEMES[themeIndex];
  
  // roadWidth narrows down from 280 down to 180 as difficulty increases
  const roadWidth = Math.max(180, 280 - Math.floor(i / 5) * 10);
  
  // length increases from 1200m to 6100m
  const length = 1200 + i * 100;
  
  // enemy density increases from 1.0 up to 2.22
  const enemyDensity = Number((1.0 + i * 0.025).toFixed(2));
  
  // speed limit increases from 360 to 420
  const speedLimit = Math.min(420, 360 + Math.floor(i / 8) * 10);
  
  return {
    id,
    name: `Stage ${id}: ${theme.name}`,
    roadWidth,
    length,
    bgColor: theme.bgColor,
    roadColor: theme.roadColor,
    stripeColor: theme.stripeColor,
    enemyDensity,
    speedLimit,
    scenery: theme.scenery
  };
});

interface GameCanvasProps {
  gameState: GameState;
  setGameState: (state: GameState) => void;
  stats: GameStats;
  setStats: React.Dispatch<React.SetStateAction<GameStats>>;
  isMuted: boolean;
  setIsMuted: (muted: boolean) => void;
  onShowInstructions: () => void;
}

export default function GameCanvas({
  gameState,
  setGameState,
  stats,
  setStats,
  isMuted,
  setIsMuted,
  onShowInstructions,
}: GameCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Game Loop references
  const requestRef = useRef<number | null>(null);
  const prevTimeRef = useRef<number>(0);

  // Keyboard controls state
  const keysRef = useRef<{ [key: string]: boolean }>({});

  // Game internal physics & state variables (avoiding react re-renders inside 60fps loop)
  const gameRef = useRef({
    playerX: 250,                    // Center of canvas
    playerY: 600,                    // Bottom-ish of canvas
    playerWidth: 28,
    playerHeight: 48,
    
    // Physics
    targetSpeed: 0,
    currentSpeed: 0,                 // Pixels per frame scroll speed
    realSpeed: 0,                    // Speed in km/h for HUD (0 - 400)
    gear: 'LOW' as 'LOW' | 'HIGH',
    fuel: 100,
    distanceCovered: 0,
    stageProgress: 0,                // 0 to 1 ratio
    score: 0,
    highScore: parseInt(localStorage.getItem('roadfighter_highscore') || '10000', 10),
    stageId: 1,

    // Steering
    steerAngle: 0,
    isBraking: false,

    // Lane positioning limits
    roadLeft: 110,
    roadRight: 390,
    roadWidth: 280,

    // Slip / Skid state
    skidTimer: 0,
    skidDirection: 0,                // -1 left, 1 right
    isSkidding: false,
    skidCounterSteerTime: 0,         // how long player successfully counter-steered

    // Invulnerability & respawn
    respawnTimer: 0,
    isInvulnerable: false,

    // Game objects
    roadOffset: 0,
    enemies: [] as EnemyCar[],
    obstacles: [] as Obstacle[],
    particles: [] as Particle[],
    skidmarks: [] as { x: number; y: number; width: number; alpha: number }[],
    backgroundScenery: [] as { x: number; y: number; type: 'tree' | 'building' | 'palm'; scale: number; speed: number; side: 'left' | 'right' }[],

    // Spawning timers
    spawnTimer: 0,
    hazardTimer: 0,
    fuelSpawnCounter: 0,             // Counts spawns to guarantee fuel car frequency
    sideSceneryTimer: 0,
    
    // Low fuel alarm beep state
    beepTimer: 0,
  });

  // Keep a copy of stats in React state for dashboard UI
  useEffect(() => {
    // Synchronize initial settings
    gameRef.current.stageId = stats.stageId;
    gameRef.current.highScore = stats.highScore;
  }, [stats.stageId, stats.highScore]);

  // Handle Mute changes
  const handleToggleMute = () => {
    const muted = audio.toggleMute();
    setIsMuted(muted);
  };

  // Stage Config
  const stage = useMemo(() => {
    return STAGES.find(s => s.id === stats.stageId) || STAGES[0];
  }, [stats.stageId]);

  // Update game configuration when stage changes
  useEffect(() => {
    const r = gameRef.current;
    r.stageId = stage.id;
    r.roadWidth = stage.roadWidth;
    r.roadLeft = (500 - stage.roadWidth) / 2;
    r.roadRight = r.roadLeft + stage.roadWidth;
    
    // Clear old objects to adapt to new road width
    r.enemies = [];
    r.obstacles = [];
    r.skidmarks = [];
    r.backgroundScenery = [];
  }, [stage]);

  // Start / stop engine sound on game state transitions
  useEffect(() => {
    if (gameState === GameState.PLAYING) {
      audio.startEngine();
    } else {
      audio.stopEngine();
    }
    return () => {
      audio.stopEngine();
    };
  }, [gameState]);

  // --------------------------------------------------------
  // KEYBOARD AND TOUCH HANDLERS
  // --------------------------------------------------------
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      // Block defaults for arrow keys & space to avoid page scrolling
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'w', 's', 'a', 'd'].includes(e.key.toLowerCase())) {
        e.preventDefault();
      }
      keysRef.current[k] = true;

      // Handle Gear Shifts (Space or 'g')
      if (k === ' ' || k === 'g') {
        const r = gameRef.current;
        r.gear = r.gear === 'LOW' ? 'HIGH' : 'LOW';
        setStats(prev => ({ ...prev, gear: r.gear }));
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      keysRef.current[k] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [setStats]);

  // For Mobile/Touch UI, we can use simulated keys
  const [touchControls, setTouchControls] = useState({
    left: false,
    right: false,
    accelerate: false,
    brake: false,
  });

  const simulateKeyDown = (key: string) => {
    keysRef.current[key] = true;
  };

  const simulateKeyUp = (key: string) => {
    keysRef.current[key] = false;
  };

  const handleGearToggle = () => {
    const r = gameRef.current;
    r.gear = r.gear === 'LOW' ? 'HIGH' : 'LOW';
    setStats(prev => ({ ...prev, gear: r.gear }));
    audio.playSkid(); // play a small wheel spin sound for visceral shift!
  };

  // --------------------------------------------------------
  // SPAWNING HELPERS
  // --------------------------------------------------------
  const spawnEnemy = () => {
    const r = gameRef.current;
    if (r.enemies.length >= 8) return; // Cap enemy count

    const rConf = STAGES.find(s => s.id === r.stageId) || STAGES[0];
    const laneCount = rConf.roadWidth >= 260 ? 4 : rConf.roadWidth >= 220 ? 3 : 2;
    const laneWidth = rConf.roadWidth / laneCount;
    
    // Choose a lane
    const targetLane = Math.floor(Math.random() * laneCount);
    const xPos = r.roadLeft + targetLane * laneWidth + laneWidth / 2;

    // Decide car type
    r.fuelSpawnCounter++;
    let type = CarType.BASIC;
    let color = '#3b82f6'; // Blue

    if (r.fuelSpawnCounter >= 8 || Math.random() < 0.12) {
      type = CarType.FUEL;
      color = '#eab308'; // Flashing / Gold
      r.fuelSpawnCounter = 0;
    } else {
      const rand = Math.random();
      if (rand < 0.25 && r.stageId > 1) {
        type = CarType.LANE_CHANGER;
        color = '#ec4899'; // Pink/Red
      } else if (rand < 0.4 && r.stageId > 2) {
        type = CarType.SPEEDER;
        color = '#06b6d4'; // Cyan neon
      } else if (rand < 0.55) {
        type = CarType.TRUCK;
        color = '#f97316'; // Orange truck
      }
    }

    // Determine dimensions
    const width = type === CarType.TRUCK ? 32 : 26;
    const height = type === CarType.TRUCK ? 60 : 44;

    // Determine start speed (relative to road)
    // Positive speeds move down (slower than player), negative speeds move up (faster than player)
    let speed = 2; // slow car, moves down the screen
    if (type === CarType.SPEEDER) {
      speed = -3; // speeder, comes from behind!
    } else if (type === CarType.TRUCK) {
      speed = 1.2; // very slow truck
    } else if (type === CarType.FUEL) {
      speed = 2.5; // steady cruiser
    }

    // Spawn from top if slower than player, from bottom if faster (speeder)
    const isSpawningFromBottom = speed < 0;
    const yPos = isSpawningFromBottom ? 720 : -80;

    // Check if lane is blocked at that spawn position
    const blocked = r.enemies.some(e => Math.abs(e.x - xPos) < 40 && Math.abs(e.y - yPos) < 120);
    if (blocked) return;

    r.enemies.push({
      id: Math.random().toString(),
      type,
      x: xPos,
      y: yPos,
      width,
      height,
      speed,
      color,
      lane: targetLane,
      laneChangeTimer: 0,
      isSpawning: true,
      state: 'NORMAL'
    });
  };

  const spawnHazard = () => {
    const r = gameRef.current;
    if (r.obstacles.length >= 4) return;

    const rConf = STAGES.find(s => s.id === r.stageId) || STAGES[0];
    const laneCount = rConf.roadWidth >= 260 ? 4 : rConf.roadWidth >= 220 ? 3 : 2;
    const laneWidth = rConf.roadWidth / laneCount;

    const rand = Math.random();
    let type = HazardType.OIL_SLICK;
    let width = 45;
    let height = 25;

    if (rand < 0.4 && r.stageId > 1) {
      type = HazardType.ROCK;
      width = 30;
      height = 25;
    } else if (rand < 0.6 && r.stageId > 2) {
      type = HazardType.BARRIER;
      width = 50;
      height = 20;
    }

    // Place on a random lane center (for oil/barrier) or shoulder/edge (for rocks)
    let xPos = 0;
    if (type === HazardType.ROCK) {
      // Put rock on road edges
      xPos = Math.random() < 0.5 ? r.roadLeft + 10 : r.roadRight - 10;
    } else {
      const targetLane = Math.floor(Math.random() * laneCount);
      xPos = r.roadLeft + targetLane * laneWidth + laneWidth / 2;
    }

    r.obstacles.push({
      id: Math.random().toString(),
      type,
      x: xPos,
      y: -100,
      width,
      height
    });
  };

  const spawnSideScenery = () => {
    const r = gameRef.current;
    if (r.backgroundScenery.length >= 20) return;

    const side = Math.random() < 0.5 ? 'left' as const : 'right' as const;
    const distanceOffset = Math.random() * 80 + 30;
    const xPos = side === 'left' ? r.roadLeft - distanceOffset : r.roadRight + distanceOffset;

    // Scenery type based on stage
    const currentStage = STAGES.find(s => s.id === r.stageId) || STAGES[0];
    const type = currentStage.scenery || 'tree';

    r.backgroundScenery.push({
      x: xPos,
      y: -150,
      type,
      scale: 0.8 + Math.random() * 0.5,
      speed: 1,
      side
    });
  };

  // --------------------------------------------------------
  // PARTICLES
  // --------------------------------------------------------
  const createExplosion = (x: number, y: number) => {
    const r = gameRef.current;
    // Sound
    audio.playCrash();

    // Spawn 25 fire/smoke particles
    for (let i = 0; i < 30; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 6 + 1;
      const life = 30 + Math.random() * 30;
      
      r.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: Math.random() < 0.6 ? '#f97316' : Math.random() < 0.5 ? '#ef4444' : '#71717a', // Orange, Red, Grey smoke
        size: Math.random() * 8 + 3,
        life,
        maxLife: life
      });
    }

    // Add a couple of flying debris sparks
    for (let i = 0; i < 6; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 4 + 3;
      r.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2, // fly upwards slightly
        color: '#facc15', // Gold sparks
        size: 3,
        life: 50,
        maxLife: 50
      });
    }
  };

  const createSpark = (x: number, y: number, dir: number) => {
    const r = gameRef.current;
    // Sparks shooting outwards
    for (let i = 0; i < 3; i++) {
      r.particles.push({
        x,
        y,
        vx: (Math.random() * 4 + 1) * dir,
        vy: Math.random() * 2 - 1,
        color: '#facc15',
        size: 2,
        life: 15,
        maxLife: 15
      });
    }
  };

  const createFloatingText = (x: number, y: number, text: string, color: string) => {
    const r = gameRef.current;
    // We can simulate floating text inside the particle system by treating color as a tag,
    // or just creating special particles with text. Let's make a text-particle!
    // Size = negative to indicate text, and vx = text, vy = custom speed
    r.particles.push({
      x,
      y,
      vx: 0, // unused
      vy: -1.5, // float up
      color, // Text color
      size: -1, // Special code for text particle
      life: 50,
      maxLife: 50,
      // Hack: we'll attach text to this particle node directly in JS
    } as any);
    // Attach text
    const lastP = r.particles[r.particles.length - 1] as any;
    lastP.text = text;
  };

  // --------------------------------------------------------
  // RESPOND / CRASH RESET
  // --------------------------------------------------------
  const triggerCrash = () => {
    const r = gameRef.current;
    if (r.isInvulnerable) return;

    createExplosion(r.playerX, r.playerY);
    r.currentSpeed = 0;
    r.realSpeed = 0;
    r.fuel = Math.max(0, r.fuel - 12); // Hitting wall or car costs fuel!
    r.skidTimer = 0;
    r.isSkidding = false;
    
    if (r.fuel <= 0) {
      setGameState(GameState.GAME_OVER);
      audio.playGameOver();
      // Record highscore
      if (r.score > r.highScore) {
        localStorage.setItem('roadfighter_highscore', r.score.toString());
        r.highScore = r.score;
        setStats(prev => ({ ...prev, highScore: r.score }));
      }
    } else {
      setGameState(GameState.RESPAWN);
      r.respawnTimer = 90; // 1.5 seconds respawn delay
    }
  };

  // --------------------------------------------------------
  // MAIN CORE PHYSIC ENGINE & GAME LOOP
  // --------------------------------------------------------
  const updateGamePhysics = (deltaTime: number) => {
    const r = gameRef.current;
    const rConf = STAGES.find(s => s.id === r.stageId) || STAGES[0];

    // Read Key States
    const accelerate = keysRef.current['arrowup'] || keysRef.current['w'] || touchControls.accelerate;
    const brake = keysRef.current['arrowdown'] || keysRef.current['s'] || touchControls.brake;
    const steerLeft = keysRef.current['arrowleft'] || keysRef.current['a'] || touchControls.left;
    const steerRight = keysRef.current['arrowright'] || keysRef.current['d'] || touchControls.right;

    // --------------------------------------------------------
    // 1. ENGINE & GEAR PHYSICS
    // --------------------------------------------------------
    // Acceleration and speed capping
    const maxSpeedLimit = rConf.speedLimit;
    if (r.fuel <= 0) {
      // Engine died out of fuel
      r.targetSpeed = 0;
    } else if (accelerate) {
      if (r.gear === 'LOW') {
        r.targetSpeed = 196; // 196 km/h cap in LOW gear
      } else {
        r.targetSpeed = maxSpeedLimit; // High gear can reach speed limit
      }
    } else if (brake) {
      r.targetSpeed = 0;
    } else {
      r.targetSpeed = 0; // deceleration coasting
    }

    // Acceleration rate based on gear and speed
    let accelRate = 1.8;
    if (brake) {
      accelRate = 8.0; // Brake quickly
    } else if (!accelerate) {
      accelRate = 1.0; // Decelerate slowly when coasting
    } else if (r.gear === 'HIGH' && r.realSpeed < 140) {
      // HIGH gear has horrible acceleration at low speeds! Classic mechanic!
      accelRate = 0.35;
    } else if (r.gear === 'HIGH') {
      accelRate = 0.9;
    }

    // Apply speed changes smoothly
    if (r.realSpeed < r.targetSpeed) {
      r.realSpeed = Math.min(r.targetSpeed, r.realSpeed + accelRate);
    } else if (r.realSpeed > r.targetSpeed) {
      r.realSpeed = Math.max(r.targetSpeed, r.realSpeed - accelRate);
    }

    // Scroll speed in pixels per frame mapped to realSpeed (0 - 400 km/h -> 0 - 15 px/f)
    r.currentSpeed = (r.realSpeed / 400) * 14;

    // Low Gear / High Gear Audio update
    audio.updateEngine(r.realSpeed / maxSpeedLimit, r.gear);

    // --------------------------------------------------------
    // 2. FUEL & MILEAGE DECAY
    // --------------------------------------------------------
    if (r.fuel > 0) {
      // Base drain + dynamic speed consumption
      // At top speed, fuel drains slightly faster per second, but you cover more ground!
      const fuelDrain = 0.015 + (r.realSpeed / 400) * 0.01;
      r.fuel = Math.max(0, r.fuel - fuelDrain);

      // Warning beep when low fuel
      if (r.fuel < 20) {
        r.beepTimer++;
        if (r.beepTimer >= 45) {
          audio.playBeep();
          r.beepTimer = 0;
        }
      }
    } else if (r.realSpeed === 0) {
      // Fuel ran out and car stopped -> Game over
      setGameState(GameState.GAME_OVER);
      audio.playGameOver();
      if (r.score > r.highScore) {
        localStorage.setItem('roadfighter_highscore', r.score.toString());
        r.highScore = r.score;
        setStats(prev => ({ ...prev, highScore: r.score }));
      }
    }

    // --------------------------------------------------------
    // 3. TRACK DISTANCE PROGRESS
    // --------------------------------------------------------
    if (r.realSpeed > 0) {
      // Map speed to meters covered (e.g. 400 km/h = ~111 m/s -> ~1.85 meters per frame at 60fps)
      const metersPerFrame = (r.realSpeed / 3600) * 1000 / 60;
      r.distanceCovered += metersPerFrame;
      r.stageProgress = Math.min(1.0, r.distanceCovered / rConf.length);

      // Add small scores for driving forward
      r.score += Math.floor(r.currentSpeed * 0.15);

      // Stage completed check!
      if (r.distanceCovered >= rConf.length) {
        r.currentSpeed = 0;
        r.realSpeed = 0;
        audio.stopEngine();
        audio.playLevelComplete();
        setGameState(GameState.STAGE_CLEAR);
      }
    }

    // --------------------------------------------------------
    // 4. STEERING & SKID PHYSICS
    // --------------------------------------------------------
    // Steering speed scale: steering is ineffective if car is stationary
    const steerSpeedScale = Math.min(1.0, r.realSpeed / 80);
    const baseSteer = 3.6 * steerSpeedScale;

    if (r.isSkidding) {
      // Skidding mechanic!
      r.skidTimer--;
      
      // Auto-slide player sideways
      r.playerX += r.skidDirection * 4.2;

      // Skid marks behind tyres
      if (Math.random() < 0.4) {
        r.skidmarks.push({ x: r.playerX - 10, y: r.playerY + 20, width: 6, alpha: 0.6 });
        r.skidmarks.push({ x: r.playerX + 10, y: r.playerY + 20, width: 6, alpha: 0.6 });
      }

      // Check for counter-steering to recover!
      const counterSteering = (r.skidDirection === 1 && steerLeft) || (r.skidDirection === -1 && steerRight);
      if (counterSteering) {
        r.skidCounterSteerTime += 1;
        if (r.skidCounterSteerTime > 15) {
          // Recovered! Play rubber screech
          audio.playSkid();
          r.isSkidding = false;
          r.skidTimer = 0;
          createFloatingText(r.playerX, r.playerY - 40, "RECOVERED!", "#22c55e");
          r.score += 500; // Bonus score for recovering skid!
        }
      } else {
        // Lose recovery progress if player stops counter-steering
        r.skidCounterSteerTime = Math.max(0, r.skidCounterSteerTime - 0.5);
      }

      if (r.skidTimer <= 0) {
        r.isSkidding = false; // timed out skid, back to normal but no bonus
      }
    } else {
      // Normal steering
      if (steerLeft) {
        r.playerX -= baseSteer;
        r.steerAngle = -0.15; // lean visually
      } else if (steerRight) {
        r.playerX += baseSteer;
        r.steerAngle = 0.15;
      } else {
        r.steerAngle = 0;
      }
    }

    // Road boundaries check
    const innerLeftBoundary = r.roadLeft + 15;
    const innerRightBoundary = r.roadRight - 15;

    if (r.playerX < innerLeftBoundary) {
      // Scraping left wall
      r.playerX = innerLeftBoundary;
      if (r.realSpeed > 100) {
        createSpark(r.playerX - 10, r.playerY + 10, 1);
        if (r.isSkidding) {
          // Instant crash if skidding out of control into wall!
          triggerCrash();
        } else {
          // Lose some speed and scrape wall
          r.realSpeed = Math.max(50, r.realSpeed - 4);
          r.score = Math.max(0, r.score - 5);
        }
      }
    } else if (r.playerX > innerRightBoundary) {
      // Scraping right wall
      r.playerX = innerRightBoundary;
      if (r.realSpeed > 100) {
        createSpark(r.playerX + 10, r.playerY + 10, -1);
        if (r.isSkidding) {
          triggerCrash();
        } else {
          r.realSpeed = Math.max(50, r.realSpeed - 4);
          r.score = Math.max(0, r.score - 5);
        }
      }
    }

    // --------------------------------------------------------
    // 5. ANIMATE SCROLLING ENVIRONMENT & SIDE ART
    // --------------------------------------------------------
    r.roadOffset = (r.roadOffset + r.currentSpeed) % 60;

    // Update background scenery
    r.backgroundScenery.forEach((sc, index) => {
      sc.y += r.currentSpeed;
    });
    // Remove offscreen scenery
    r.backgroundScenery = r.backgroundScenery.filter(sc => sc.y < 800);

    // --------------------------------------------------------
    // 6. SPAWN TRAFFIC & HAZARDS
    // --------------------------------------------------------
    r.spawnTimer += rConf.enemyDensity;
    if (r.spawnTimer > 110) {
      spawnEnemy();
      r.spawnTimer = 0;
    }

    r.hazardTimer += rConf.enemyDensity;
    if (r.hazardTimer > 230) {
      spawnHazard();
      r.hazardTimer = 0;
    }

    r.sideSceneryTimer++;
    if (r.sideSceneryTimer > 25) {
      spawnSideScenery();
      r.sideSceneryTimer = 0;
    }

    // --------------------------------------------------------
    // 7. TRAFFIC VEHICLES LOOP
    // --------------------------------------------------------
    r.enemies.forEach((enemy) => {
      // Update vertical position based on player's current speed and enemy's self-speed
      // If speed is relative: dy = playerScrollSpeed - enemySpeed
      const relativeMovement = r.currentSpeed - enemy.speed;
      enemy.y += relativeMovement;

      // Handle Lane changer logic: starts moving sideways when player gets within 200px below it
      if (enemy.type === CarType.LANE_CHANGER && enemy.state === 'NORMAL') {
        const distY = enemy.y - r.playerY;
        if (distY < 0 && distY > -240) { // player is approaching from behind
          enemy.laneChangeTimer++;
          if (enemy.laneChangeTimer > 15) {
            // Initiate lane drift towards player's side!
            const laneCount = rConf.roadWidth >= 260 ? 4 : rConf.roadWidth >= 220 ? 3 : 2;
            const laneWidth = rConf.roadWidth / laneCount;
            const playerLane = Math.floor((r.playerX - r.roadLeft) / laneWidth);
            
            if (enemy.lane < playerLane) {
              enemy.lane++;
            } else if (enemy.lane > playerLane) {
              enemy.lane--;
            }
            enemy.state = 'SKIDDING'; // Temporarily slide lanes
            enemy.laneChangeTimer = -90; // Cool down
          }
        }
      }

      // Smooth lane changing movement
      if (enemy.state === 'SKIDDING') {
        const laneCount = rConf.roadWidth >= 260 ? 4 : rConf.roadWidth >= 220 ? 3 : 2;
        const laneWidth = rConf.roadWidth / laneCount;
        const targetX = r.roadLeft + enemy.lane * laneWidth + laneWidth / 2;
        const dx = targetX - enemy.x;
        if (Math.abs(dx) > 2) {
          enemy.x += Math.sign(dx) * 1.8;
        } else {
          enemy.x = targetX;
          enemy.state = 'NORMAL';
        }
      }

      // Check collision with player!
      if (Math.abs(enemy.x - r.playerX) < (enemy.width + r.playerWidth) / 2 - 2 &&
          Math.abs(enemy.y - r.playerY) < (enemy.height + r.playerHeight) / 2 - 3) {
        
        if (enemy.type === CarType.FUEL) {
          // Fuel grab! Perfect!
          r.fuel = Math.min(100, r.fuel + 28);
          r.score += 2500;
          audio.playFuel();
          createFloatingText(enemy.x, enemy.y, "+25 FUEL", "#facc15");
          createFloatingText(enemy.x, enemy.y - 20, "+2500 PTS", "#38bdf8");
          // Remove from list
          r.enemies = r.enemies.filter(e => e.id !== enemy.id);
        } else {
          // Regular car crash/skid trigger
          if (r.isInvulnerable) return;

          // Determine angle/impact vector
          const fromLeft = r.playerX < enemy.x;
          r.isSkidding = true;
          r.skidTimer = 65; // Skid for ~1 sec
          r.skidDirection = fromLeft ? -1 : 1; // skid away from collision point
          r.skidCounterSteerTime = 0;
          
          audio.playSkid();
          // Slow player down on bumper bump
          r.realSpeed = Math.max(80, r.realSpeed * 0.65);
          
          // Spawn little bumper collision sparks
          createSpark((r.playerX + enemy.x) / 2, (r.playerY + enemy.y) / 2, fromLeft ? 1 : -1);

          // Knock enemy car into skid/crash too!
          enemy.state = 'CRASHED';
          enemy.speed = -4; // shoots away fast
          enemy.color = '#7f1d1d'; // dark crash red
          r.score += 200; // Small score for overtaking safely or surviving bumper
        }
      }
    });

    // Filter out off-screen enemies
    r.enemies = r.enemies.filter(e => e.y < 850 && e.y > -200);

    // --------------------------------------------------------
    // 8. OBSTACLES & HAZARDS LOOP
    // --------------------------------------------------------
    r.obstacles.forEach((obs) => {
      obs.y += r.currentSpeed;

      // Check collision with player
      if (Math.abs(obs.x - r.playerX) < (obs.width + r.playerWidth) / 2 - 3 &&
          Math.abs(obs.y - r.playerY) < (obs.height + r.playerHeight) / 2 - 3) {
        
        if (r.isInvulnerable) return;

        if (obs.type === HazardType.OIL_SLICK) {
          // Triggers heavy random skid, but not instant explosion
          if (!r.isSkidding) {
            r.isSkidding = true;
            r.skidTimer = 55;
            r.skidDirection = Math.random() < 0.5 ? -1 : 1;
            r.skidCounterSteerTime = 0;
            audio.playSkid();
            createFloatingText(r.playerX, r.playerY - 40, "SLIP!", "#60a5fa");
          }
        } else {
          // Rocks & Barriers are instant high-damage crash!
          triggerCrash();
        }
      }
    });

    // Remove offscreen obstacles
    r.obstacles = r.obstacles.filter(o => o.y < 850);

    // --------------------------------------------------------
    // 9. RECOVERY / RESPAWN SYSTEM
    // --------------------------------------------------------
    if (r.isInvulnerable) {
      r.respawnTimer--;
      if (r.respawnTimer <= 0) {
        r.isInvulnerable = false;
      }
    }

    // --------------------------------------------------------
    // 10. DEBRIS PARTICLES LOOP
    // --------------------------------------------------------
    r.particles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.life--;
    });
    r.particles = r.particles.filter(p => p.life > 0);

    // 11. DECAY SKIDMARKS OUT
    // Update existing skidmarks
    r.skidmarks.forEach(sm => {
      sm.y += r.currentSpeed;
      sm.alpha -= 0.01;
    });
    r.skidmarks = r.skidmarks.filter(sm => sm.y < 750 && sm.alpha > 0);

    // Synch score back to react state every frame for HUD dashboard
    setStats({
      score: r.score,
      highScore: r.highScore,
      fuel: Math.round(r.fuel),
      speed: Math.round(r.realSpeed),
      gear: r.gear,
      distanceCovered: Math.round(r.distanceCovered),
      stageId: r.stageId
    });
  };

  // --------------------------------------------------------
  // RESPOND STATE LOGIC IN FRAME
  // --------------------------------------------------------
  const updateRespawnLogic = () => {
    const r = gameRef.current;
    r.respawnTimer--;

    // Keep scrolling environment very slowly
    r.roadOffset = (r.roadOffset + 1) % 60;
    r.backgroundScenery.forEach(sc => sc.y += 1);

    if (r.respawnTimer <= 0) {
      // Done respawning, let's revive player in center of lane
      r.playerX = 250;
      r.playerY = 600;
      r.realSpeed = 0;
      r.currentSpeed = 0;
      r.gear = 'LOW';
      r.isInvulnerable = true;
      r.respawnTimer = 90; // Invulnerability frames (1.5 seconds)
      setGameState(GameState.PLAYING);
    }
  };

  // --------------------------------------------------------
  // DRAW CORE GRAPHICS (THE RENDERING ENGINE)
  // --------------------------------------------------------
  const drawGame = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const r = gameRef.current;
    const width = canvas.width;
    const height = canvas.height;

    // Clear Canvas
    ctx.clearRect(0, 0, width, height);

    // 1. Draw Green grass background
    ctx.fillStyle = stage.bgColor;
    ctx.fillRect(0, 0, width, height);

    // 2. Draw Side gravel / shoulders (retro asphalt edge)
    const gravelWidth = 12;
    ctx.fillStyle = '#94a3b8'; // light slate shoulder
    ctx.fillRect(r.roadLeft - gravelWidth, 0, gravelWidth, height);
    ctx.fillRect(r.roadRight, 0, gravelWidth, height);

    // Alternating red/white curbs on sides of road to give a powerful scrolling effect!
    const curbSegmentLength = 40;
    const offset = r.roadOffset % (curbSegmentLength * 2);
    for (let y = -curbSegmentLength * 2; y < height + curbSegmentLength * 2; y += curbSegmentLength) {
      const drawY = y + offset;
      const isRed = Math.floor((drawY - offset) / curbSegmentLength) % 2 === 0;
      ctx.fillStyle = isRed ? '#ef4444' : '#f8fafc'; // retro red and white curbs
      
      // Left curb
      ctx.fillRect(r.roadLeft - 8, drawY, 8, curbSegmentLength);
      // Right curb
      ctx.fillRect(r.roadRight, drawY, 8, curbSegmentLength);
    }

    // 3. Draw Asphalt road
    ctx.fillStyle = stage.roadColor;
    ctx.fillRect(r.roadLeft, 0, stage.roadWidth, height);

    // 4. Draw Lanes dividers (Yellow/White dashed stripes)
    ctx.fillStyle = stage.stripeColor;
    const stripeLength = 30;
    const stripeGap = 35;
    const totalStripeCycle = stripeLength + stripeGap;
    const stripeOffset = r.roadOffset % totalStripeCycle;

    const laneCount = stage.roadWidth >= 260 ? 4 : stage.roadWidth >= 220 ? 3 : 2;
    const laneWidth = stage.roadWidth / laneCount;

    for (let l = 1; l < laneCount; l++) {
      const stripeX = r.roadLeft + l * laneWidth;
      for (let y = -totalStripeCycle; y < height + totalStripeCycle; y += totalStripeCycle) {
        ctx.fillRect(stripeX - 2, y + stripeOffset, 4, stripeLength);
      }
    }

    // 5. Draw Skidmarks
    r.skidmarks.forEach((sm) => {
      ctx.fillStyle = `rgba(15, 23, 42, ${sm.alpha})`;
      ctx.fillRect(sm.x, sm.y, sm.width, 10);
    });

    // 6. Draw Hazards & Obstacles
    r.obstacles.forEach((obs) => {
      if (obs.type === HazardType.OIL_SLICK) {
        // Transparent grey puddle
        ctx.fillStyle = 'rgba(71, 85, 105, 0.65)';
        ctx.beginPath();
        ctx.ellipse(obs.x, obs.y, obs.width / 2, obs.height / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        // Inner oil gloss
        ctx.fillStyle = 'rgba(15, 23, 42, 0.4)';
        ctx.beginPath();
        ctx.ellipse(obs.x - 5, obs.y - 2, obs.width / 4, obs.height / 4, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (obs.type === HazardType.ROCK) {
        // Draw 3D rock/boulder
        ctx.fillStyle = '#64748b'; // stone dark grey
        ctx.beginPath();
        ctx.moveTo(obs.x - obs.width / 2, obs.y + obs.height / 2);
        ctx.lineTo(obs.x - obs.width / 3, obs.y - obs.height / 2);
        ctx.lineTo(obs.x + obs.width / 4, obs.y - obs.height / 3);
        ctx.lineTo(obs.x + obs.width / 2, obs.y + obs.height / 2);
        ctx.closePath();
        ctx.fill();

        // Highlight
        ctx.fillStyle = '#94a3b8'; // light grey highlight
        ctx.beginPath();
        ctx.moveTo(obs.x - obs.width / 3, obs.y - obs.height / 2);
        ctx.lineTo(obs.x, obs.y - obs.height / 5);
        ctx.lineTo(obs.x - obs.width / 4, obs.y + obs.height / 3);
        ctx.closePath();
        ctx.fill();
      } else if (obs.type === HazardType.BARRIER) {
        // Striped warning block
        ctx.fillStyle = '#eab308'; // yellow
        ctx.fillRect(obs.x - obs.width / 2, obs.y - obs.height / 2, obs.width, obs.height);
        
        ctx.fillStyle = '#0f172a'; // black stripes
        const stripeW = 8;
        for (let sx = obs.x - obs.width / 2 + 5; sx < obs.x + obs.width / 2; sx += stripeW * 2) {
          ctx.beginPath();
          ctx.moveTo(sx, obs.y - obs.height / 2);
          ctx.lineTo(sx + stripeW, obs.y - obs.height / 2);
          ctx.lineTo(sx + stripeW - 5, obs.y + obs.height / 2);
          ctx.lineTo(sx - 5, obs.y + obs.height / 2);
          ctx.closePath();
          ctx.fill();
        }
      }
    });

    // 7. Draw Traffic Vehicles
    r.enemies.forEach((enemy) => {
      ctx.save();
      ctx.translate(enemy.x, enemy.y);

      // Draw shadow
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(0, 4, enemy.width / 2 + 2, enemy.height / 2 + 1, 0, 0, Math.PI * 2);
      ctx.fill();

      if (enemy.type === CarType.TRUCK) {
        // Draw Large Truck/Trailer
        // Wheels
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(-enemy.width/2 - 2, -enemy.height/2 + 5, 3, 10);
        ctx.fillRect(enemy.width/2 - 1, -enemy.height/2 + 5, 3, 10);
        ctx.fillRect(-enemy.width/2 - 2, enemy.height/2 - 15, 3, 10);
        ctx.fillRect(enemy.width/2 - 1, enemy.height/2 - 15, 3, 10);
        ctx.fillRect(-enemy.width/2 - 2, enemy.height/2 - 30, 3, 10);
        ctx.fillRect(enemy.width/2 - 1, enemy.height/2 - 30, 3, 10);

        // Cab (Front)
        ctx.fillStyle = '#ef4444'; // Orange-Red cab
        ctx.fillRect(-enemy.width/2, enemy.height/2 - 12, enemy.width, 12);
        // Cab windshield
        ctx.fillStyle = '#93c5fd';
        ctx.fillRect(-enemy.width/2 + 3, enemy.height/2 - 9, enemy.width - 6, 4);

        // Large Trailer (Back Cargo Container)
        ctx.fillStyle = enemy.color; // Orange/Grey cargo
        ctx.fillRect(-enemy.width/2 + 1, -enemy.height/2, enemy.width - 2, enemy.height - 15);
        
        // Trailer door details
        ctx.strokeStyle = '#475569';
        ctx.strokeRect(-enemy.width/2 + 1, -enemy.height/2, enemy.width - 2, enemy.height - 15);
        ctx.beginPath();
        ctx.moveTo(0, -enemy.height/2);
        ctx.lineTo(0, enemy.height/2 - 15);
        ctx.stroke();

      } else if (enemy.type === CarType.FUEL) {
        // Draw FLASHING FUEL CAR
        const pulse = Math.floor(Date.now() / 150) % 2 === 0;
        
        // Wheels
        ctx.fillStyle = '#111827';
        ctx.fillRect(-enemy.width/2 - 2, -enemy.height/2 + 6, 2, 8);
        ctx.fillRect(enemy.width/2, -enemy.height/2 + 6, 2, 8);
        ctx.fillRect(-enemy.width/2 - 2, enemy.height/2 - 14, 2, 8);
        ctx.fillRect(enemy.width/2, enemy.height/2 - 14, 2, 8);

        // Body
        ctx.fillStyle = pulse ? '#fbbf24' : '#eab308'; // Glowing gold/yellow
        ctx.fillRect(-enemy.width/2, -enemy.height/2, enemy.width, enemy.height);

        // Neon warning flashing rails
        ctx.fillStyle = pulse ? '#22c55e' : '#ef4444'; // Flashing Green / Red
        ctx.fillRect(-enemy.width/2, -5, 2, 10);
        ctx.fillRect(enemy.width/2 - 2, -5, 2, 10);

        // Cockpit glass
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(-enemy.width/2 + 4, -8, enemy.width - 8, 8);

        // Spoilers
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(-enemy.width/2 - 1, enemy.height/2 - 4, enemy.width + 2, 4);

        // Large "F" Fuel marker on the hood
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 12px "JetBrains Mono", Courier, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('F', 0, -12);

      } else {
        // Draw Standard/Lanechanger/Speeder Sedan Car
        // Wheels
        ctx.fillStyle = '#111827';
        ctx.fillRect(-enemy.width/2 - 1, -enemy.height/2 + 6, 2, 8);
        ctx.fillRect(enemy.width/2 - 1, -enemy.height/2 + 6, 2, 8);
        ctx.fillRect(-enemy.width/2 - 1, enemy.height/2 - 14, 2, 8);
        ctx.fillRect(enemy.width/2 - 1, enemy.height/2 - 14, 2, 8);

        // Main chassis
        ctx.fillStyle = enemy.color;
        ctx.fillRect(-enemy.width/2 + 1, -enemy.height/2, enemy.width - 2, enemy.height);

        // Windshield
        ctx.fillStyle = '#38bdf8'; // glossy cyan glass
        ctx.fillRect(-enemy.width/2 + 4, -8, enemy.width - 8, 6);

        // Rear window
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(-enemy.width/2 + 4, 10, enemy.width - 8, 4);

        // Headlights
        ctx.fillStyle = '#fef08a';
        ctx.fillRect(-enemy.width/2 + 2, -enemy.height/2, 3, 2);
        ctx.fillRect(enemy.width/2 - 5, -enemy.height/2, 3, 2);

        // Brake lights
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(-enemy.width/2 + 2, enemy.height/2 - 2, 3, 2);
        ctx.fillRect(enemy.width/2 - 5, enemy.height/2 - 2, 3, 2);
      }

      ctx.restore();
    });

    // 8. Draw Player Car
    if (gameState === GameState.PLAYING || gameState === GameState.RESPAWN) {
      // Flashing animation when invulnerable during respawn
      const isInvul = r.isInvulnerable;
      const drawPlayer = !isInvul || (Math.floor(r.respawnTimer / 4) % 2 === 0);

      if (drawPlayer) {
        ctx.save();
        ctx.translate(r.playerX, r.playerY);
        ctx.rotate(r.steerAngle);

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(0, 5, r.playerWidth / 2 + 3, r.playerHeight / 2 + 1, 0, 0, Math.PI * 2);
        ctx.fill();

        // Skid indicator or spark
        if (r.isSkidding) {
          // Warning indicator
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 2;
          ctx.strokeRect(-r.playerWidth / 2 - 4, -r.playerHeight / 2 - 4, r.playerWidth + 8, r.playerHeight + 8);
        }

        // Tyres (4 corners)
        ctx.fillStyle = '#090d16'; // deep dark rubber
        // Front left tyre
        ctx.fillRect(-r.playerWidth / 2 - 2, -r.playerHeight / 2 + 6, 3, 10);
        // Front right tyre
        ctx.fillRect(r.playerWidth / 2 - 1, -r.playerHeight / 2 + 6, 3, 10);
        // Rear left tyre
        ctx.fillRect(-r.playerWidth / 2 - 2, r.playerHeight / 2 - 16, 3, 10);
        // Rear right tyre
        ctx.fillRect(r.playerWidth / 2 - 1, r.playerHeight / 2 - 16, 3, 10);

        // Body Chassis - Formula 1 Retro Sport Styling
        const bodyGradient = ctx.createLinearGradient(-r.playerWidth/2, 0, r.playerWidth/2, 0);
        bodyGradient.addColorStop(0, '#dc2626'); // deep red edges
        bodyGradient.addColorStop(0.5, '#ef4444'); // bright center red
        bodyGradient.addColorStop(1, '#991b1b'); // dark shadow red
        ctx.fillStyle = bodyGradient;
        
        // Main pod
        ctx.fillRect(-r.playerWidth/2 + 2, -r.playerHeight/2 + 4, r.playerWidth - 4, r.playerHeight - 8);

        // Nose cone
        ctx.beginPath();
        ctx.moveTo(-r.playerWidth/2 + 4, -r.playerHeight/2 + 4);
        ctx.lineTo(0, -r.playerHeight/2 - 4);
        ctx.lineTo(r.playerWidth/2 - 4, -r.playerHeight/2 + 4);
        ctx.closePath();
        ctx.fill();

        // Racing stripe (Dual white stripes down center)
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(-2, -r.playerHeight/2 + 3, 1, r.playerHeight - 12);
        ctx.fillRect(1, -r.playerHeight/2 + 3, 1, r.playerHeight - 12);

        // Cockpit Glass
        const glassGrad = ctx.createLinearGradient(0, -10, 0, 4);
        glassGrad.addColorStop(0, '#0284c7'); // glossy blue
        glassGrad.addColorStop(1, '#e0f2fe'); // white highlight
        ctx.fillStyle = glassGrad;
        ctx.beginPath();
        ctx.ellipse(0, -3, r.playerWidth / 3, 7, 0, 0, Math.PI * 2);
        ctx.fill();

        // Rear Spoiler wing
        ctx.fillStyle = '#1e293b'; // graphite dark spoiler
        ctx.fillRect(-r.playerWidth/2 - 2, r.playerHeight/2 - 6, r.playerWidth + 4, 4);
        // Spoiler mounts
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(-r.playerWidth/4, r.playerHeight/2 - 8, 2, 3);
        ctx.fillRect(r.playerWidth/4 - 2, r.playerHeight/2 - 8, 2, 3);

        // Exhaust flame particle effect if going fast!
        if (r.realSpeed > 220 && Math.random() < 0.6) {
          ctx.fillStyle = Math.random() < 0.5 ? '#f59e0b' : '#ef4444';
          ctx.beginPath();
          ctx.arc(0, r.playerHeight / 2 + 1, Math.random() * 4 + 2, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      }
    }

    // 9. Draw Background Scenery (Trees / Palms / Buildings)
    r.backgroundScenery.forEach((sc) => {
      ctx.save();
      ctx.translate(sc.x, sc.y);
      ctx.scale(sc.scale, sc.scale);

      if (sc.type === 'tree') {
        // Forest Pine tree
        // Trunk
        ctx.fillStyle = '#78350f';
        ctx.fillRect(-3, 10, 6, 8);
        // Foliage (layer triangles)
        ctx.fillStyle = '#14532d';
        ctx.beginPath();
        ctx.moveTo(0, -22);
        ctx.lineTo(15, 0);
        ctx.lineTo(-15, 0);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#15803d';
        ctx.beginPath();
        ctx.moveTo(0, -12);
        ctx.lineTo(12, 10);
        ctx.lineTo(-12, 10);
        ctx.closePath();
        ctx.fill();
      } else if (sc.type === 'palm') {
        // Coastal Palm Tree
        // Curved trunk
        ctx.strokeStyle = '#7c2d12';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(0, 20);
        ctx.quadraticCurveTo(-8, 5, 0, -12);
        ctx.stroke();

        // Leaves
        ctx.fillStyle = '#065f46';
        ctx.beginPath();
        // Palm leaf 1
        ctx.ellipse(5, -12, 12, 4, Math.PI / 6, 0, Math.PI * 2);
        // Palm leaf 2
        ctx.ellipse(-5, -12, 12, 4, -Math.PI / 6, 0, Math.PI * 2);
        // Palm leaf 3
        ctx.ellipse(0, -15, 14, 4, -Math.PI / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // City Building / Neon Tower
        ctx.fillStyle = '#1e293b'; // deep grey block
        ctx.fillRect(-22, -40, 44, 100);
        
        // Neon structural outlines
        ctx.strokeStyle = '#f43f5e'; // glowing hot pink
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-22, -40, 44, 100);

        // Windows (little yellow dots)
        ctx.fillStyle = '#fef08a';
        for (let wx = -16; wx < 16; wx += 10) {
          for (let wy = -30; wy < 50; wy += 15) {
            ctx.fillRect(wx, wy, 4, 4);
          }
        }
      }

      ctx.restore();
    });

    // 10. Draw Particles
    r.particles.forEach((p) => {
      ctx.save();
      if (p.size === -1) {
        // Special render for text particle
        ctx.fillStyle = p.color;
        ctx.font = 'bold 11px "JetBrains Mono", Courier, monospace';
        ctx.textAlign = 'center';
        ctx.shadowColor = '#000';
        ctx.shadowBlur = 4;
        ctx.fillText((p as any).text, p.x, p.y);
      } else {
        // Circle particle
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });

    // 11. Extreme speed lines (wind streaks overlay)
    if (r.realSpeed > 300) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 5; i++) {
        const x = (i * 105 + r.roadOffset * 4) % width;
        const y = (i * 160 + r.roadOffset * 7) % height;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + 55);
        ctx.stroke();
      }
    }
  };

  // --------------------------------------------------------
  // FRAME TICK LOOP SWITCHBOARD
  // --------------------------------------------------------
  useEffect(() => {
    const loop = (time: number) => {
      // Handle frame lock roughly to 60fps
      const elapsed = time - prevTimeRef.current;
      
      if (gameState === GameState.PLAYING) {
        updateGamePhysics(elapsed);
        drawGame();
      } else if (gameState === GameState.RESPAWN) {
        updateRespawnLogic();
        drawGame();
      } else {
        // Even when paused / on start screen, draw the background static scene
        drawGame();
      }

      prevTimeRef.current = time;
      requestRef.current = requestAnimationFrame(loop);
    };

    requestRef.current = requestAnimationFrame(loop);
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [gameState]);

  // --------------------------------------------------------
  // START BUTTON TRIGGERS
  // --------------------------------------------------------
  const handleStartGame = () => {
    // Reset all parameters
    const r = gameRef.current;
    r.fuel = 100;
    r.distanceCovered = 0;
    r.stageProgress = 0;
    r.realSpeed = 0;
    r.currentSpeed = 0;
    r.score = 0;
    r.enemies = [];
    r.obstacles = [];
    r.particles = [];
    r.skidmarks = [];
    r.skidTimer = 0;
    r.isSkidding = false;
    r.isInvulnerable = false;
    r.gear = 'LOW';
    r.playerX = 250;

    setStats({
      score: 0,
      highScore: r.highScore,
      fuel: 100,
      speed: 0,
      gear: 'LOW',
      distanceCovered: 0,
      stageId: r.stageId
    });

    setGameState(GameState.PLAYING);
  };

  const handleNextStage = () => {
    const r = gameRef.current;
    let nextId = r.stageId + 1;
    if (nextId > STAGES.length) {
      nextId = 1; // cycle back
    }
    r.stageId = nextId;
    handleStartGame();
  };

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-5xl mx-auto h-full p-2 gap-4" id="roadfighter-cabinet-wrapper">
      {/* Upper Cabinet Marquee Panel */}
      <div className="w-full bg-slate-950 text-red-500 font-mono flex items-center justify-between border-2 md:border-4 border-red-600 rounded-md py-2 md:py-3 px-3 md:px-6 shadow-2xl relative" id="marquee-header">
        <div className="absolute inset-0 bg-radial from-transparent to-red-950/40 pointer-events-none"></div>
        <div className="flex items-center gap-3">
          <Flame className="w-8 h-8 text-yellow-500 animate-pulse" />
          <h1 className="text-xl md:text-3xl font-extrabold tracking-widest uppercase italic text-yellow-400 select-none">
            ROAD FIGHTER
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={handleToggleMute}
            className="p-1.5 hover:bg-slate-800 rounded-md border border-slate-700 text-slate-300 hover:text-white transition duration-200"
            title="Toggle Mute"
            id="mute-button"
          >
            {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5 text-yellow-400" />}
          </button>
          <button
            onClick={onShowInstructions}
            className="p-1.5 hover:bg-slate-800 rounded-md border border-slate-700 text-slate-300 hover:text-white transition duration-200"
            title="Show Guide"
            id="guide-button"
          >
            <HelpCircle className="w-5 h-5" />
          </button>
          <div className="hidden sm:flex flex-col items-end text-xs text-slate-400 font-sans tracking-wide">
            <span>HIGH SCORE</span>
            <span className="font-mono text-red-400 text-base font-bold">{stats.highScore.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Main Cabinet Stage */}
      <div className="w-full flex flex-col md:flex-row gap-4 items-stretch justify-center h-full max-h-[720px]" id="cabinet-body-layout">
        
        {/* LEFT COMPONENT: STAGE INFO & INSTRUCTION SHEET */}
        <div className="hidden md:flex flex-col w-56 bg-slate-900 border-2 border-slate-800 rounded-md p-4 text-slate-300 justify-between font-sans shadow-xl relative" id="left-sidebar-cabinet">
          <div className="flex flex-col gap-4">
            <div className="border-b-2 border-slate-700 pb-2 mb-1">
              <h3 className="text-sm font-bold text-yellow-400 uppercase tracking-widest font-mono">Stage Selection</h3>
              <p className="text-[11px] text-slate-400">Choose a road configuration:</p>
            </div>
            
            <div className="flex items-center gap-1 w-full" id="stage-picker">
              <button
                disabled={gameState === GameState.PLAYING || gameState === GameState.RESPAWN || stats.stageId === 1}
                onClick={() => {
                  setStats(prev => ({ ...prev, stageId: prev.stageId - 1 }));
                  audio.playSkid();
                }}
                className="bg-slate-950 border border-slate-800 hover:bg-slate-800 hover:text-slate-200 text-slate-400 py-2 px-2.5 rounded disabled:opacity-50 text-xs font-mono transition duration-150"
                title="Previous Stage"
              >
                ◀
              </button>
              <select
                disabled={gameState === GameState.PLAYING || gameState === GameState.RESPAWN}
                value={stats.stageId}
                onChange={(e) => {
                  setStats(prev => ({ ...prev, stageId: Number(e.target.value) }));
                  audio.playSkid();
                }}
                className="flex-1 bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-200 text-xs rounded py-2 px-1.5 font-mono outline-none cursor-pointer focus:border-red-600 transition duration-150 text-center"
              >
                {STAGES.map(s => (
                  <option key={s.id} value={s.id} className="bg-slate-950 text-slate-300">
                    STG {s.id}: {s.name.split(':')[1]?.trim() || s.name}
                  </option>
                ))}
              </select>
              <button
                disabled={gameState === GameState.PLAYING || gameState === GameState.RESPAWN || stats.stageId === STAGES.length}
                onClick={() => {
                  setStats(prev => ({ ...prev, stageId: prev.stageId + 1 }));
                  audio.playSkid();
                }}
                className="bg-slate-950 border border-slate-800 hover:bg-slate-800 hover:text-slate-200 text-slate-400 py-2 px-2.5 rounded disabled:opacity-50 text-xs font-mono transition duration-150"
                title="Next Stage"
              >
                ▶
              </button>
            </div>

            <div className="border-t border-slate-800 pt-3 mt-1">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5 font-mono">Cabinet Rules</h4>
              <ul className="text-[11px] text-slate-400 space-y-1.5 list-disc pl-3">
                <li><strong className="text-slate-300">Shift Gear</strong> to HIGH once speed reaches 150 km/h to hit top speeds!</li>
                <li><strong className="text-slate-300">Low Gear</strong> provides massive starting acceleration.</li>
                <li><strong className="text-slate-300">Survive Skids</strong>: If hit, counter-steer in the OPPOSITE direction of the slip to recover!</li>
                <li><strong className="text-slate-300">Fuel Cars</strong>: Drive into rainbow/flashing cars with <span className="text-yellow-400 font-bold">F</span> to refuel!</li>
              </ul>
            </div>
          </div>

          <div className="border-t border-slate-800 pt-3 flex flex-col items-center">
            <span className="text-[10px] text-slate-500 font-mono">COIN-OP CLASSIC</span>
            <span className="text-[9px] text-slate-600 font-mono">VER 1.0.3</span>
          </div>
        </div>

        {/* MOBILE HEADS-UP DISPLAY (HUD): ONLY ON SMALL SCREENS */}
        <div className="w-full max-w-[480px] md:hidden bg-slate-900 border-2 border-slate-800 rounded-md p-2.5 flex justify-between items-center text-xs font-mono text-slate-300 shadow-xl" id="mobile-hud">
          <div className="flex flex-col items-center">
            <span className="text-[9px] text-slate-500 font-sans">SCORE</span>
            <span className="text-yellow-400 font-bold font-mono text-sm leading-none">{stats.score.toLocaleString()}</span>
          </div>
          <div className="flex flex-col items-center w-20">
            <span className="text-[9px] text-slate-500 font-sans">FUEL FLUID</span>
            <span className={`text-xs font-bold leading-none ${stats.fuel < 20 ? 'text-red-500 animate-pulse font-bold' : 'text-emerald-400'}`}>{stats.fuel}%</span>
            <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden mt-1 flex border border-slate-800">
              <div
                className={`h-full rounded-full ${stats.fuel < 20 ? 'bg-red-600 animate-pulse' : stats.fuel < 45 ? 'bg-yellow-500' : 'bg-emerald-500'}`}
                style={{ width: `${stats.fuel}%` }}
              ></div>
            </div>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-[9px] text-slate-500 font-sans">GEAR</span>
            <span className={`text-xs font-bold leading-none ${stats.gear === 'HIGH' ? 'text-rose-500 font-bold' : 'text-emerald-400 font-bold'}`}>{stats.gear}</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-[9px] text-slate-500 font-sans">VELOCITY</span>
            <span className={`text-sm font-bold leading-none font-mono ${stats.speed > 300 ? 'text-red-500 animate-pulse' : 'text-white'}`}>{stats.speed} <span className="text-[9px] text-slate-500">KM/H</span></span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-[9px] text-slate-500 font-sans">STG</span>
            <span className="text-cyan-400 font-bold text-sm leading-none font-mono">#{stats.stageId}</span>
          </div>
        </div>

        {/* CENTER COMPONENT: THE HTML5 RETRO CANVAS SCREEN */}
        <div className="flex-1 bg-slate-950 rounded-lg border-2 md:border-4 border-slate-800 relative flex items-center justify-center overflow-hidden shadow-2xl aspect-[5/7] max-w-[480px] mx-auto md:mx-0" id="canvas-monitor-bezel">
          {/* Scanlines overlays for CRT monitor feel */}
          <div className="absolute inset-0 bg-scanlines pointer-events-none opacity-25 z-10"></div>
          <div className="absolute inset-0 bg-radial-vignette pointer-events-none opacity-45 z-10"></div>

          <canvas
            ref={canvasRef}
            width={500}
            height={700}
            className="w-full h-full object-contain bg-slate-900"
            id="retro-game-canvas"
          />

          {/* OVERLAY: START SCREEN */}
          {gameState === GameState.START && (
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center z-20" id="start-overlay">
              <div className="space-y-6 max-w-xs">
                <div className="space-y-1.5 animate-bounce">
                  <span className="text-red-500 text-sm font-mono tracking-widest font-extrabold uppercase">INSERT COIN TO PLAY</span>
                  <h2 className="text-2xl font-bold font-mono tracking-wide text-white">ROAD FIGHTER</h2>
                </div>
                
                <p className="text-xs text-slate-300 leading-relaxed font-sans">
                  A rapid-scrolling 2D arcade race! Weave through chaotic traffic, grab fuel canisters, and reach the finish line before your energy depletes!
                </p>

                <div className="bg-slate-900/90 border border-slate-850 p-3 rounded-md text-slate-400 space-y-1">
                  <div className="text-xs font-mono text-yellow-400 border-b border-slate-800 pb-1 mb-1">STATION SELECT</div>
                  <div className="text-[11px] font-sans">Currently: <strong className="text-white">{stage.name}</strong></div>
                  <div className="text-[10px] font-sans opacity-70">Limit: {stage.speedLimit} km/h • Width: {stage.roadWidth}px</div>
                </div>

                <button
                  onClick={handleStartGame}
                  className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 text-white font-mono font-bold py-3 px-6 rounded-md shadow-lg transition duration-200 transform hover:scale-105"
                  id="btn-play-game"
                >
                  <Play className="w-5 h-5 fill-current" />
                  START RACE
                </button>
              </div>
            </div>
          )}

          {/* OVERLAY: GAME OVER OUT OF FUEL / ENERGY */}
          {gameState === GameState.GAME_OVER && (
            <div className="absolute inset-0 bg-red-950/90 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center z-20 animate-fade-in" id="game-over-overlay">
              <div className="space-y-6 max-w-xs">
                <div className="text-red-500 bg-red-950/50 border border-red-800 px-4 py-2 rounded-md inline-block font-mono text-xs tracking-widest font-bold uppercase animate-pulse">
                  OUT OF FUEL
                </div>
                
                <h2 className="text-4xl font-extrabold text-white tracking-widest font-mono italic">
                  GAME OVER
                </h2>

                <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-md space-y-2">
                  <div className="text-slate-400 text-xs font-sans">FINAL SCORE</div>
                  <div className="text-3xl font-mono font-bold text-yellow-400">{stats.score.toLocaleString()}</div>
                  <div className="text-[11px] text-slate-500 font-sans">Stage ID: {stats.stageId} • Progress: {Math.round(gameRef.current.stageProgress * 100)}%</div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleStartGame}
                    className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 text-white font-mono font-semibold py-2.5 px-4 rounded transition duration-200"
                    id="btn-retry"
                  >
                    <RotateCcw className="w-4 h-4" />
                    RETRY
                  </button>
                  <button
                    onClick={() => setGameState(GameState.START)}
                    className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono font-semibold py-2.5 px-4 rounded transition duration-200"
                    id="btn-menu"
                  >
                    MENU
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* OVERLAY: STAGE CLEAR */}
          {gameState === GameState.STAGE_CLEAR && (
            <div className="absolute inset-0 bg-teal-950/90 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center z-20 animate-fade-in" id="stage-clear-overlay">
              <div className="space-y-6 max-w-xs">
                <div className="text-teal-400 bg-teal-950/50 border border-teal-800 px-4 py-2 rounded-md inline-block font-mono text-xs tracking-widest font-bold uppercase">
                  VICTORY CHECKPOINT
                </div>

                <h2 className="text-3xl font-extrabold text-white tracking-wider font-mono italic uppercase">
                  STAGE CLEARED!
                </h2>

                <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-md space-y-2">
                  <div className="text-slate-400 text-xs">REMAINING FUEL BONUS</div>
                  <div className="text-xl font-mono font-bold text-teal-400">+{stats.fuel * 100} PTS</div>
                  <div className="text-slate-400 text-xs pt-1 border-t border-slate-800">TOTAL SCORE</div>
                  <div className="text-3xl font-mono font-bold text-yellow-400">
                    {(stats.score + stats.fuel * 100).toLocaleString()}
                  </div>
                </div>

                <button
                  onClick={handleNextStage}
                  className="w-full flex items-center justify-center gap-2 bg-teal-500 hover:bg-teal-400 text-slate-950 font-mono font-bold py-3 px-6 rounded shadow-lg transition duration-200"
                  id="btn-next-stage"
                >
                  NEXT ROADWAY
                </button>
              </div>
            </div>
          )}

          {/* CRITICAL FUEL / WARNING HUD FLASH ON SCREEN */}
          {gameState === GameState.PLAYING && stats.fuel < 20 && (
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10 flex items-center gap-1.5 bg-red-600/90 border border-red-500 text-white font-mono text-xs px-3 py-1.5 rounded-full shadow-lg animate-pulse">
              <ShieldAlert className="w-4 h-4 text-white" />
              <span>LOW ENERGY FLUID</span>
            </div>
          )}

          {/* CRITICAL SKIDDING / SPIN OUT DANGER WARNING */}
          {gameState === GameState.PLAYING && gameRef.current.isSkidding && (
            <div className="absolute top-16 left-1/2 transform -translate-x-1/2 z-10 flex items-center gap-1.5 bg-yellow-500 text-slate-950 font-mono text-[11px] px-3 py-1 rounded shadow-lg animate-bounce">
              <Zap className="w-3.5 h-3.5 animate-spin" />
              <span>COUNTER STEER NOW!</span>
            </div>
          )}
        </div>

        {/* MOBILE PROGRESS BAR: ONLY ON SMALL SCREENS */}
        <div className="w-full max-w-[480px] md:hidden bg-slate-900 border border-slate-800 rounded-md p-1.5 flex items-center justify-between text-[10px] font-mono text-slate-400 shadow-md gap-2" id="mobile-road-progress">
          <span className="text-slate-500 font-bold">S</span>
          <div className="flex-1 bg-slate-950 h-2 rounded-full relative overflow-hidden flex items-center border border-slate-800">
            <div
              className="bg-cyan-500 h-full opacity-40"
              style={{ width: `${gameRef.current.stageProgress * 100}%` }}
            ></div>
            <div
              className="absolute w-2 h-2 bg-red-600 rounded-full border border-white"
              style={{ left: `calc(${gameRef.current.stageProgress * 100}% - 4px)` }}
            ></div>
          </div>
          <span className="text-red-500 font-bold">F</span>
          <span className="text-[9px] text-slate-500 font-sans shrink-0">{stats.distanceCovered}M / {stage.length}M</span>
        </div>

        {/* RIGHT COMPONENT: THE RETRO SCI-FI MECHANICAL DASHBOARD */}
        <div className="hidden md:flex flex-col w-56 bg-slate-900 border-2 border-slate-800 rounded-md p-4 justify-between text-slate-300 font-mono shadow-xl relative" id="right-sidebar-cabinet">
          <div className="flex flex-col gap-4">
            
            {/* SCORE DISPLAY */}
            <div className="bg-slate-950 border border-slate-800 rounded-md p-3 text-center">
              <span className="text-[10px] text-slate-500 uppercase tracking-widest block font-sans mb-1">SCORE</span>
              <span className="text-2xl font-bold text-yellow-400 glow-yellow">{stats.score.toLocaleString()}</span>
            </div>

            {/* FUEL TANK FLUID PROGRESS BAR */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-slate-400 font-sans">FUEL FLUID</span>
                <span className={`${stats.fuel < 20 ? 'text-red-500 font-bold animate-pulse' : 'text-emerald-400'}`}>
                  {stats.fuel}%
                </span>
              </div>
              <div className="w-full bg-slate-950 h-5 border border-slate-800 rounded p-0.5 overflow-hidden flex" id="fuel-gauge-bar">
                <div
                  className={`h-full rounded-xs transition-all duration-150 ${
                    stats.fuel < 20
                      ? 'bg-red-600 animate-pulse'
                      : stats.fuel < 45
                      ? 'bg-yellow-500'
                      : 'bg-emerald-500'
                  }`}
                  style={{ width: `${stats.fuel}%` }}
                ></div>
              </div>
            </div>

            {/* SPEEDOMETER & GEAR GAUGES */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-slate-950 border border-slate-800 rounded-md p-2.5 text-center flex flex-col justify-center">
                <span className="text-[9px] text-slate-500 font-sans mb-0.5 uppercase">GEAR</span>
                <span className={`text-lg font-bold font-mono tracking-wide ${
                  stats.gear === 'HIGH' ? 'text-rose-500' : 'text-emerald-400'
                }`}>
                  {stats.gear}
                </span>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-md p-2.5 text-center flex flex-col justify-center">
                <span className="text-[9px] text-slate-500 font-sans mb-0.5 uppercase">LIMIT</span>
                <span className="text-xs font-semibold text-slate-400">
                  {stage.speedLimit} KM/H
                </span>
              </div>
            </div>

            {/* HIGH FIDELITY SPEED DISPLAY */}
            <div className="bg-slate-950 border border-slate-800 rounded-md p-3 text-center relative" id="speedometer-digital">
              <span className="text-[9px] text-slate-500 uppercase tracking-wider block font-sans mb-1">VELOCITY</span>
              <div className="flex items-baseline justify-center gap-1">
                <span className={`text-3xl font-extrabold font-mono tracking-tighter ${
                  stats.speed > 300 ? 'text-red-500 animate-pulse' : 'text-white'
                }`}>
                  {stats.speed}
                </span>
                <span className="text-xs text-slate-500 font-sans">KM/H</span>
              </div>
              
              {/* Radial or analog visual speed gauge bar */}
              <div className="w-full bg-slate-900 h-1 rounded-full mt-2.5 overflow-hidden flex">
                <div
                  className="bg-gradient-to-r from-emerald-500 via-yellow-400 to-red-500 h-full"
                  style={{ width: `${(stats.speed / stage.speedLimit) * 100}%` }}
                ></div>
              </div>
            </div>

            {/* ROADWAY METRIC GAP BAR (DISTANCE PROGRESS) */}
            <div className="bg-slate-950 border border-slate-800 rounded-md p-3" id="road-progress-indicator">
              <span className="text-[9px] text-slate-500 uppercase tracking-widest block font-sans text-center mb-2">ROADWAY PROGRESS</span>
              
              <div className="flex items-center gap-2 relative">
                <span className="text-[10px] text-slate-500">S</span>
                
                {/* Horizontal slider representing player moving towards finish */}
                <div className="flex-1 bg-slate-900 h-2.5 rounded border border-slate-800 relative overflow-hidden flex items-center">
                  <div
                    className="bg-cyan-500 h-full opacity-40"
                    style={{ width: `${gameRef.current.stageProgress * 100}%` }}
                  ></div>
                  <div
                    className="absolute w-3 h-3 bg-red-600 rounded-full border border-white"
                    style={{ left: `calc(${gameRef.current.stageProgress * 100}% - 6px)` }}
                  ></div>
                </div>
                
                <span className="text-[10px] text-red-500 font-bold">F</span>
              </div>

              <div className="flex justify-between text-[10px] text-slate-400 font-sans mt-2">
                <span>{stats.distanceCovered} M</span>
                <span>{stage.length} M</span>
              </div>
            </div>

          </div>

          <div className="border-t border-slate-800 pt-3 text-[10px] text-slate-400 space-y-1 mt-4">
            <div className="flex justify-between">
              <span>CONTROLLER:</span>
              <span className="text-slate-200">KEYBOARD / TOUCH</span>
            </div>
            <div className="flex justify-between">
              <span>HIGH SCORE:</span>
              <span className="text-red-400 font-bold">{stats.highScore.toLocaleString()}</span>
            </div>
          </div>
        </div>

      </div>

      {/* MOBILE CONTROLLER TOUCHPAD: REVEALS ONLY ON SMALL SCREENS */}
      <div className="w-full max-w-[480px] md:hidden bg-slate-900 border-2 border-slate-800 rounded-md p-3 flex flex-col gap-3 font-sans shadow-xl text-slate-300" id="mobile-game-controller">
        
        {/* Gear and steering controller layout */}
        <div className="grid grid-cols-12 gap-3">
          
          {/* Left steering pad (Columns 1-5) */}
          <div className="col-span-5 grid grid-cols-2 gap-2">
            <button
              onMouseDown={() => simulateKeyDown('arrowleft')}
              onMouseUp={() => simulateKeyUp('arrowleft')}
              onTouchStart={(e) => { e.preventDefault(); simulateKeyDown('arrowleft'); }}
              onTouchEnd={(e) => { e.preventDefault(); simulateKeyUp('arrowleft'); }}
              className="bg-slate-800 hover:bg-slate-700 active:bg-slate-650 h-14 border border-slate-700 rounded-md flex items-center justify-center font-bold text-lg select-none"
              id="btn-steer-left"
            >
              ◀
            </button>
            <button
              onMouseDown={() => simulateKeyDown('arrowright')}
              onMouseUp={() => simulateKeyUp('arrowright')}
              onTouchStart={(e) => { e.preventDefault(); simulateKeyDown('arrowright'); }}
              onTouchEnd={(e) => { e.preventDefault(); simulateKeyUp('arrowright'); }}
              className="bg-slate-800 hover:bg-slate-700 active:bg-slate-650 h-14 border border-slate-700 rounded-md flex items-center justify-center font-bold text-lg select-none"
              id="btn-steer-right"
            >
              ▶
            </button>
          </div>

          {/* Middle auxiliary buttons (Columns 6-7) */}
          <div className="col-span-2 flex flex-col justify-center items-center gap-1.5">
            <button
              onClick={handleGearToggle}
              onTouchStart={(e) => { e.preventDefault(); handleGearToggle(); }}
              className="w-full bg-rose-650 hover:bg-rose-600 active:bg-rose-700 text-white border border-rose-800 py-1 px-1 rounded text-[10px] font-bold font-mono text-center shadow select-none"
              id="btn-gear-shift"
            >
              SHIFT
            </button>
            <span className="text-[8px] text-slate-400 font-mono tracking-tighter uppercase font-bold text-center">GEAR</span>
          </div>

          {/* Right speed/brake pads (Columns 8-12) */}
          <div className="col-span-5 grid grid-cols-2 gap-2">
            <button
              onMouseDown={() => simulateKeyDown('arrowdown')}
              onMouseUp={() => simulateKeyUp('arrowdown')}
              onTouchStart={(e) => { e.preventDefault(); simulateKeyDown('arrowdown'); }}
              onTouchEnd={(e) => { e.preventDefault(); simulateKeyUp('arrowdown'); }}
              className="bg-amber-800 hover:bg-amber-700 active:bg-amber-750 h-14 border border-amber-900 rounded-md flex flex-col items-center justify-center select-none"
              id="btn-brake"
            >
              <span className="text-xs font-semibold text-amber-200">BRAKE</span>
              <span className="text-[10px] text-amber-400">▼</span>
            </button>
            <button
              onMouseDown={() => simulateKeyDown('arrowup')}
              onMouseUp={() => simulateKeyUp('arrowup')}
              onTouchStart={(e) => { e.preventDefault(); simulateKeyDown('arrowup'); }}
              onTouchEnd={(e) => { e.preventDefault(); simulateKeyUp('arrowup'); }}
              className="bg-red-600 hover:bg-red-500 active:bg-red-650 h-14 border border-red-700 rounded-md flex flex-col items-center justify-center select-none"
              id="btn-accel"
            >
              <span className="text-xs font-semibold text-white">ACCEL</span>
              <span className="text-[10px] text-red-200">▲</span>
            </button>
          </div>

        </div>

        {/* Mobile Stage Selector */}
        {gameState !== GameState.PLAYING && gameState !== GameState.RESPAWN && (
          <div className="flex items-center justify-between border-t border-slate-800 pt-2 text-xs gap-2" id="mobile-stage-selector">
            <span className="text-slate-400 font-mono shrink-0">ROADWAY:</span>
            <div className="flex items-center gap-1 flex-1 max-w-[240px]">
              <button
                disabled={stats.stageId === 1}
                onClick={() => {
                  setStats(prev => ({ ...prev, stageId: prev.stageId - 1 }));
                  audio.playSkid();
                }}
                className="bg-slate-800 hover:bg-slate-750 text-slate-300 py-1 px-2 rounded disabled:opacity-50 text-[10px] font-mono"
              >
                ◀
              </button>
              <select
                value={stats.stageId}
                onChange={(e) => {
                  setStats(prev => ({ ...prev, stageId: Number(e.target.value) }));
                  audio.playSkid();
                }}
                className="flex-1 bg-slate-800 border border-slate-700 text-slate-200 text-[10px] rounded py-1 px-1.5 font-mono outline-none cursor-pointer focus:border-red-600 text-center"
              >
                {STAGES.map(s => (
                  <option key={s.id} value={s.id} className="bg-slate-900 text-slate-300">
                    STG {s.id}: {s.name.split(':')[1]?.trim() || s.name}
                  </option>
                ))}
              </select>
              <button
                disabled={stats.stageId === STAGES.length}
                onClick={() => {
                  setStats(prev => ({ ...prev, stageId: prev.stageId + 1 }));
                  audio.playSkid();
                }}
                className="bg-slate-800 hover:bg-slate-750 text-slate-300 py-1 px-2 rounded disabled:opacity-50 text-[10px] font-mono"
              >
                ▶
              </button>
            </div>
          </div>
        )}

      </div>

    </div>
  );
}
