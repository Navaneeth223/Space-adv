// ==========================================
// 10_engine.js
// ==========================================

class GameEngine {
  constructor() {
     this.saveManager = new SaveManager();
     this.input = new InputManager();
     this.audio = new AudioEngine(this.saveManager.data);
     this.particles = new ParticleSystem(this.saveManager.data);
     this.renderer = new Renderer();
     this.ui = new UIManager();
     this.camera = new Camera();
     this.idd = new IDDSystem(this.saveManager.data.settings);
     this.world = new World();
     
     this.entities = [];
     this.player = null;

     this.state = GAME_STATE.BOOT;
     this.prevState = GAME_STATE.BOOT;
     this.bootTimer = 0;
     
     this.scenes = {};
     this.scenes[GAME_STATE.MAIN_MENU] = new MainMenuScene(this);
     this.scenes[GAME_STATE.SETTINGS] = new SettingsScene(this);
     this.scenes[GAME_STATE.CUTSCENE] = new CutsceneScene(this);
     this.scenes[GAME_STATE.GAMEPLAY] = new GameScene(this);
     this.scenes[GAME_STATE.BOSS_INTRO] = new BossIntroScene(this);
     this.scenes[GAME_STATE.GAME_OVER] = new GameOverScene(this);
     this.scenes[GAME_STATE.CREDITS] = new CreditsScene(this);

     this.lastTime = 0;
     this.accumulator = 0;
     this.timestep = 1 / 60;

     // Setup start
     window.requestAnimationFrame((t) => this.loop(t));
  }

  changeState(newState) {
     this.prevState = this.state;
     
     if (this.scenes[this.prevState] && this.scenes[this.prevState].exit) {
        this.scenes[this.prevState].exit();
     }
     
     this.state = newState;
     
     // Specific transitions logic
     if(this.state === GAME_STATE.GAMEPLAY && this.prevState !== GAME_STATE.PAUSED && this.prevState !== GAME_STATE.BOSS_INTRO) {
        this._initGameplay();
     }
     if(this.state === GAME_STATE.BOSS_INTRO) {
        this.audio.sfx_bossIntro();
        this.camera.zoomTo(1.2, 1.0);
        setTimeout(() => {
           this.changeState(GAME_STATE.GAMEPLAY);
           this.camera.zoomTo(1.0, 1.0);
        }, 2500);
     }

     if (this.scenes[this.state] && this.scenes[this.state].enter) {
        this.scenes[this.state].enter();
     }
     
     this.ui.fadeAlpha = 1.0;
     this.ui.fadeTarget = 0.0;
  }

  _initGameplay() {
     this.audio.playMusicGameplay(this.saveManager.data.currentZone);
     
     // Only hard reload zone if not resuming identically, but simpler to just reload
     this.world.loadZone(this.saveManager.data.currentZone, this);
     
     // Create player
     this.player = new Player(this.saveManager.data);
     
     if(this.loadZoneMode === 'NEW') {
        this.player.x = 2 * CONSTANTS.TILE_SIZE;
        this.player.y = (this.world.height - 3) * CONSTANTS.TILE_SIZE;
     }

     this.camera.x = this.player.x - CONSTANTS.WIDTH/2;
     this.camera.y = this.player.y - CONSTANTS.HEIGHT/2;
  }

  spawnProjectile(isPlayer, x, y, vx, vy, dmg, lifetime, pierce=false) {
     this.entities.push(new Projectile(isPlayer, x, y, vx, vy, dmg, lifetime, pierce));
  }

  triggerGameOver() { this.changeState(GAME_STATE.GAME_OVER); }

  triggerUpgradeMenu() {
     // Simplified implementation for constraints
     if(this.player.coins >= 80 && !this.player.hasUpgrade('Vitality Core I')) {
         this.player.coins -= 80;
         this.player.maxHp += 30;
         this.player.hp += 30;
         this.player.upgrades.push('Vitality Core I');
         this.ui.showNotification("VITALITY CORE I PURCHASED", '#00FF00', 2.0);
     } else {
         this.ui.showNotification("UPGRADE TERMINAL: NEED 80 COINS", '#FFA500', 2.0);
     }
  }

  update(dt) {
     // Input update moved to end of loop
     
     // Boot sequence logic
     if (this.state === GAME_STATE.BOOT) {
        this.bootTimer += dt;
        if(this.bootTimer > 2.8) {
           this.audio.resume(); // Ensure context unblocked
           this.changeState(GAME_STATE.MAIN_MENU);
        }
     } 
     // Pasused logic
     else if (this.state === GAME_STATE.PAUSED) {
        if(this.input.isJustPressed('Escape') || this.input.isJustPressed('KeyP')) {
           this.changeState(GAME_STATE.GAMEPLAY);
        }
        if(this.input.isJustPressed('ArrowDown')) this.ui.pauseSelection = (this.ui.pauseSelection+1)%4;
        if(this.input.isJustPressed('ArrowUp')) this.ui.pauseSelection = (this.ui.pauseSelection-1+4)%4;
        if(this.input.isJustPressed('Enter')) {
           let action = this.ui.pauseItems[this.ui.pauseSelection];
           if(action === 'RESUME') this.changeState(GAME_STATE.GAMEPLAY);
           if(action === 'SETTINGS') this.changeState(GAME_STATE.SETTINGS);
           if(action === 'RESTART ZONE') { this.loadZoneMode='RESTART'; this.changeState(GAME_STATE.GAMEPLAY); }
           if(action === 'QUIT TO MENU') this.changeState(GAME_STATE.MAIN_MENU);
        }
     }
     else if (this.scenes[this.state] && this.scenes[this.state].update) {
         this.scenes[this.state].update(dt);
     }

     this.ui.update(dt);
     this.input.update(); // Update prev keys at end of tick
  }

  loop(timestamp) {
     if (!this.lastTime) this.lastTime = timestamp;
     let dt = (timestamp - this.lastTime) / 1000;
     if (dt > 0.1) dt = 0.1; // Clamp large deltas
     this.lastTime = timestamp;

     this.accumulator += dt;
     
     // Fixed timestep logic
     while(this.accumulator >= this.timestep) {
        this.update(this.timestep);
        this.accumulator -= this.timestep;
     }

     this.renderer.render(this);

     // Fade overlay
     if(this.ui.fadeAlpha > 0) {
        this.renderer.ctx.fillStyle = `rgba(0,0,0,${this.ui.fadeAlpha})`;
        this.renderer.ctx.fillRect(0,0,CONSTANTS.WIDTH,CONSTANTS.HEIGHT);
     }

     window.requestAnimationFrame((t) => this.loop(t));
  }
}

// Start game
window.onload = () => {
   // Resize listener
   function resizeCanvas() {
      const canvas = document.getElementById('gameCanvas');
      if(!canvas) return;
      const scaleX = window.innerWidth / 1280;
      const scaleY = window.innerHeight / 720;
      const scale = Math.min(scaleX, scaleY);
      
      canvas.style.width = (1280 * scale) + 'px';
      canvas.style.height = (720 * scale) + 'px';
      canvas.style.position = 'absolute';
      canvas.style.left = ((window.innerWidth - 1280 * scale) / 2) + 'px';
      canvas.style.top = ((window.innerHeight - 720 * scale) / 2) + 'px';
   }
   window.addEventListener('resize', resizeCanvas);
   resizeCanvas();

   // Click anywhere to unblock audio on chrome
   window.addEventListener('click', () => {
      if(window.gameEngine) window.gameEngine.audio.resume();
   });

   window.gameEngine = new GameEngine();
};
