// ==========================================
// 01_constantsAndState.js
// ==========================================

const PHYSICS = {
  gravity: 900,          // px/s^2
  terminalVelocity: 600, // px/s
  playerWalkSpeed: 220,  // px/s
  playerAccel: 800,      // px/s^2
  playerDecel: 1200,     // px/s^2
  dashSpeed: 150 / 0.12, // px/s (150px in 0.12s)
  jumpVelocity: 0,       // no jump - gravity flip is movement
  wallSlideSpeed: 50     // px/s (slow fall on wall)
};

const GAME_STATE = {
  BOOT: 0,
  MAIN_MENU: 1,
  SETTINGS: 2,
  LOADING: 3,
  CUTSCENE: 4,
  GAMEPLAY: 5,
  PAUSED: 6,
  BOSS_INTRO: 7,
  GAME_OVER: 8,
  VICTORY: 9,
  CREDITS: 10
};

const DEFAULT_SAVE_DATA = {
  version: "1.0",
  currentZone: 1,
  checkpointX: 100,
  checkpointY: 100,
  playerStats: {
    hp: 100,
    maxHp: 100,
    energy: 100,
    maxEnergy: 100,
    coins: 0,
    crystals: 0,
    score: 0,
    totalDeaths: 0
  },
  upgrades: [],
  relicsFound: [],
  zonesCompleted: [],
  settings: {
    masterVolume: 80,
    musicVolume: 60,
    sfxVolume: 100,
    musicEnabled: true,
    sfxEnabled: true,
    screenScale: 'FIT TO WINDOW',
    particleQuality: 'HIGH',
    screenShake: 'ON',
    parallax: 'ON',
    difficultyMode: 'AUTO',
    gravFlipHold: 'TAP TO FLIP'
  },
  timestamp: 0
};

class SaveManager {
  constructor() {
    this.data = JSON.parse(JSON.stringify(DEFAULT_SAVE_DATA));
    this.load();
  }

  load() {
    try {
      const stored = localStorage.getItem('gravshift_save');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.version === DEFAULT_SAVE_DATA.version) {
          this.data = parsed;
        } else {
          console.warn("Save file incompatible, starting new game.");
          this.save();
        }
      }
    } catch (e) {
      console.error("Failed to load save", e);
    }
  }

  save() {
    this.data.timestamp = Date.now();
    try {
      localStorage.setItem('gravshift_save', JSON.stringify(this.data));
    } catch (e) {
      console.error("Failed to save", e);
    }
  }

  resetProgress() {
    const settings = JSON.parse(JSON.stringify(this.data.settings));
    this.data = JSON.parse(JSON.stringify(DEFAULT_SAVE_DATA));
    this.data.settings = settings; // Keep settings
    this.save();
  }
}

const CONSTANTS = {
  TILE_SIZE: 32,
  WIDTH: 1280,
  HEIGHT: 720
};
