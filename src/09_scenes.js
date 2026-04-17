// ==========================================
// 09_scenes.js
// ==========================================

class Scene {
   constructor(engine) { this.engine = engine; }
   enter() {}
   update(dt) {}
   draw(ctx) {}
   exit() {}
}

class MainMenuScene extends Scene {
   enter() { 
      this.engine.menuTime = 0; 
      this.engine.audio.playMusicMenu();
   }
   update(dt) {
      this.engine.menuTime += dt;
      const input = this.engine.input;
      const ui = this.engine.ui;

      if(input.isJustPressed('ArrowDown')) {
         ui.menuSelection = (ui.menuSelection + 1) % ui.mainMenuItems.length;
         this.engine.audio.sfx_uiSelect();
      }
      if(input.isJustPressed('ArrowUp')) {
         ui.menuSelection = (ui.menuSelection - 1 + ui.mainMenuItems.length) % ui.mainMenuItems.length;
         this.engine.audio.sfx_uiSelect();
      }

      // Skip greyed out continue
      if(ui.menuSelection === 1 && !localStorage.getItem('gravshift_save')) {
         if(input.isJustPressed('ArrowDown')) ui.menuSelection = 2;
         else if (input.isJustPressed('ArrowUp')) ui.menuSelection = 0;
      }

      // Mouse hover and click
      for(let i=0; i<ui.mainMenuItems.length; i++) {
         const y = 350 + i * 50;
         if(input.mouse.x > CONSTANTS.WIDTH/2 - 150 && input.mouse.x < CONSTANTS.WIDTH/2 + 150 &&
            input.mouse.y > y - 25 && input.mouse.y < y + 25) {
            
            // Avoid selecting greyed out continue
            if(i === 1 && !localStorage.getItem('gravshift_save')) continue;

            if(ui.menuSelection !== i) {
               ui.menuSelection = i;
               this.engine.audio.sfx_uiSelect();
            }

            if(input.isMouseJustPressed()) {
               this._executeMenu(ui.mainMenuItems[i]);
               return;
            }
         }
      }

      if(input.isJustPressed('Enter')) {
         this._executeMenu(ui.mainMenuItems[ui.menuSelection]);
      }
   }

   _executeMenu(action) {
         this.engine.audio.sfx_uiSelect();
         if(action === 'NEW GAME') {
            this.engine.saveManager.resetProgress();
            this.engine.loadZoneMode = 'NEW';
            this.engine.changeState(GAME_STATE.CUTSCENE);
         } else if (action === 'CONTINUE') {
            this.engine.loadZoneMode = 'CONTINUE';
            this.engine.changeState(GAME_STATE.GAMEPLAY); // Jump right in
         } else if (action === 'SETTINGS') {
            this.engine.changeState(GAME_STATE.SETTINGS);
         }
   }
}

class SettingsScene extends Scene {
   enter() { this.engine.ui.settingsSelection = 0; }
   update(dt) {
      const input = this.engine.input;
      
      // Simple mockup
      if(input.isJustPressed('Enter') || input.isJustPressed('Escape')) {
         this.engine.audio.sfx_uiBack();
         this.engine.saveManager.save();
         this.engine.particles.updateSettings(this.engine.saveManager.data.settings.particleQuality);
         this.engine.audio.updateVolumes();
         
         // return to prev 
         if(this.engine.prevState === GAME_STATE.PAUSED) this.engine.changeState(GAME_STATE.PAUSED);
         else this.engine.changeState(GAME_STATE.MAIN_MENU);
      }
   }
   draw(ctx) {
      ctx.fillStyle = '#0a0a1a'; ctx.fillRect(0,0,CONSTANTS.WIDTH,CONSTANTS.HEIGHT);
      ctx.fillStyle = '#00FFFF'; ctx.font = '40px Arial'; ctx.textAlign='center';
      ctx.fillText("SETTINGS", CONSTANTS.WIDTH/2, 100);
      ctx.fillStyle = '#FFFFFF'; ctx.font = '20px Arial';
      ctx.fillText("Press ENTER or ESCAPE to go back", CONSTANTS.WIDTH/2, 200);
      // More robust UI sliders would go here...
   }
}

class CutsceneScene extends Scene {
   enter() { 
      this.timer = 0; 
      this.lines = this._getTextForZone(this.engine.saveManager.data.currentZone).split('|');
      this.lineIndex = 0;
      this.engine.audio.playMusicMenu();
   }
   update(dt) {
      this.timer += dt;
      if (this.timer > 0.8 && this.lineIndex < this.lines.length) {
         this.timer = 0;
         this.lineIndex++;
      }
      if(this.engine.input.isJustPressed('Enter')) {
         this.engine.changeState(GAME_STATE.GAMEPLAY);
      }
   }
   draw(ctx) {
      ctx.fillStyle = '#000000'; ctx.fillRect(0,0,CONSTANTS.WIDTH,CONSTANTS.HEIGHT);
      ctx.fillStyle = '#00FFFF'; ctx.font = '30px Arial'; ctx.textAlign='center';
      ctx.fillText(`ZONE ${this.engine.saveManager.data.currentZone}`, CONSTANTS.WIDTH/2, 150);
      
      ctx.fillStyle = '#FFFFFF'; ctx.font = '24px Arial';
      for(let i=0; i<this.lineIndex; i++) {
         ctx.fillText(this.lines[i], CONSTANTS.WIDTH/2, 250 + i*40);
      }

      if(this.lineIndex >= this.lines.length) {
         ctx.globalAlpha = 0.5 + 0.5*Math.sin(Date.now()/200);
         ctx.fillText("PRESS ENTER TO CONTINUE", CONSTANTS.WIDTH/2, CONSTANTS.HEIGHT - 100);
         ctx.globalAlpha = 1.0;
      }
   }
   _getTextForZone(zoneId) {
      switch(zoneId) {
         case 1: return "DOCKING BAY OMEGA — Station Entry Level|The bay is crawling with NEXUS-7's sentinels.|But they don't know what you can do yet.|The gravity is unstable here. Use it.";
         case 2: return "REACTOR CORE — The Station's Heart|The heat here is unbearable for most.|NEXUS-7's power flows through these walls.|Sever the connection. Shut down the core.";
         case 3: return "CRYOGENIC VAULTS — Long-Term Storage|Hundreds were frozen here. Waiting.|NEXUS-7 uses them as an army in reserve.|They will not wake today.";
         case 4: return "NEURAL NETWORK — NEXUS-7's Mind|This is where it thinks. Where it plans.|Destroy the neural pathways. Blind the machine.|One final room remains.";
         case 5: return "NEXUS-7 THRONE — The Core of Everything|I have been watching you, Wraith.|You cannot kill what was never alive.|   — NEXUS-7|End it.";
         default: return "VOID STATION KAEROS — Deep Space Quadrant 7|You were not meant to wake up here.|The station's anti-gravity core has been corrupted.|NEXUS-7 has turned this place into a prison.|You are The Wraith. And you do not stay imprisoned.";
      }
   }
}

class GameScene extends Scene {
   enter() {
      // Handled heavily by engine setup initially
   }
   update(dt) {
      const e = this.engine;
      
      if(e.input.isJustPressed('Escape') || e.input.isJustPressed('KeyP')) {
         e.changeState(GAME_STATE.PAUSED);
         return;
      }

      e.idd.update(dt, e.player);
      e.player.update(dt, e);
      
      // Update entities
      for(let i = e.entities.length-1; i>=0; i--) {
         let ent = e.entities[i];
         ent.update(dt, e);
         CollisionEngine.resolveTileCollisions(ent, e.world, dt);
         if(ent.isDead && (ent.iframeTimer || 0) <= 0) {
            e.entities.splice(i, 1);
         }
      }

      CollisionEngine.resolveTileCollisions(e.player, e.world, dt);
      
      // Pickup check, portal check
      const ts = CONSTANTS.TILE_SIZE;
      let tx = Math.floor((e.player.x + e.player.width/2)/ts);
      let ty = Math.floor((e.player.y + e.player.height/2)/ts);
      if(e.world.getTile(tx, ty) === 10) { // Portal
         if(e.world.zoneId === 5) {
            e.changeState(GAME_STATE.VICTORY);
         } else {
            e.saveManager.data.currentZone++;
            e.saveManager.save();
            e.changeState(GAME_STATE.CUTSCENE);
         }
      } else if (e.world.getTile(tx, ty) === 9) { // Checkpoint
         if(e.saveManager.data.checkpointX !== tx*ts || e.saveManager.data.checkpointY !== ty*ts - e.player.height){
            e.saveManager.data.checkpointX = tx*ts;
            e.saveManager.data.checkpointY = ty*ts - e.player.height;
            e.saveManager.save();
            e.ui.showNotification("CHECKPOINT SAVED", '#00FF00', 1.5);
            e.audio.sfx_checkpoint();
         }
      } else if (e.world.getTile(tx, ty) === 2 || e.world.getTile(tx, ty) === 3) {
         // Spike
         e.player.takeDamage(25, -e.player.facingDir, e); 
      }

      // Check boundaries death
      if (e.player.y > e.world.height * ts || e.player.y < -ts) {
         e.player.die(e);
      }
      
      // Particles
      e.particles.update(dt, e.player.gravityFlipped);
      e.particles.emitAmbient(e.world.zoneId, e.camera);

      // Camera
      e.camera.update(dt, e.player, e.world.width, e.world.height, e.saveManager.data.settings);

      // Boss trigger
      if(e.world.activeBoss && tx > 125 && e.state !== GAME_STATE.BOSS_INTRO && e.world.activeBoss.phase === 1 && e.world.activeBoss.hp === e.world.activeBoss.maxHp) {
         e.changeState(GAME_STATE.BOSS_INTRO);
      }
   }
}

class GameOverScene extends Scene {
   enter() { this.timer = 0; }
   update(dt) {
      this.timer += dt;
      if(this.timer > 1.5) {
         if(this.engine.input.isJustPressed('Enter')) {
            // Simulate selecting retry checkpoint
            this.engine.loadZoneMode = 'CONTINUE';
            this.engine.changeState(GAME_STATE.GAMEPLAY);
         }
      }
   }
   draw(ctx) {
      ctx.fillStyle = '#000000'; ctx.fillRect(0,0,CONSTANTS.WIDTH,CONSTANTS.HEIGHT);
      if(this.timer > 1.5) {
         ctx.fillStyle = '#FF0000'; ctx.textAlign='center'; ctx.font = 'bold 80px Arial';
         ctx.fillText("SYSTEM FAILURE", CONSTANTS.WIDTH/2, 200);
         ctx.fillStyle = '#FFFFFF'; ctx.font = '24px Arial';
         ctx.fillText("PRESS ENTER TO RETRY FROM CHECKPOINT", CONSTANTS.WIDTH/2, 500);
      }
   }
}
