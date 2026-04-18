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
         } else if (action === 'CREDITS') {
            this.engine.changeState(GAME_STATE.CREDITS);
         } else if (action === 'QUIT') {
            document.body.innerHTML = "<div style='display:flex;justify-content:center;align-items:center;height:100vh;background:black;'><h1 style='color:white;font-family:Arial;'>SYSTEM OFFLINE</h1></div>";
         }
   }
}

class SettingsScene extends Scene {
   enter() { 
      this.engine.ui.settingsSelection = 0; 
      this.items = [
         { name: 'Master Volume', key: 'masterVolume', options: [0, 20, 40, 60, 80, 100] },
         { name: 'Music', key: 'musicEnabled', options: [true, false] },
         { name: 'SFX', key: 'sfxEnabled', options: [true, false] },
         { name: 'Screen Shake', key: 'screenShake', options: ['ON', 'OFF'] }
      ];
   }
   update(dt) {
      const input = this.engine.input;
      
      if(input.isJustPressed('Escape')) {
         this.engine.audio.sfx_uiBack();
         this.engine.saveManager.save();
         this.engine.audio.updateVolumes();
         this.engine.changeState(this.engine.prevState === GAME_STATE.PAUSED ? GAME_STATE.PAUSED : GAME_STATE.MAIN_MENU);
      }
      if(input.isJustPressed('ArrowDown')) this.engine.ui.settingsSelection = (this.engine.ui.settingsSelection+1)%this.items.length;
      if(input.isJustPressed('ArrowUp')) this.engine.ui.settingsSelection = (this.engine.ui.settingsSelection-1+this.items.length)%this.items.length;
      
      let item = this.items[this.engine.ui.settingsSelection];
      let currentVal = this.engine.saveManager.data.settings[item.key];
      let idx = item.options.indexOf(currentVal);
      if(idx === -1) idx = 0;
      
      if(input.isJustPressed('ArrowRight') || input.isJustPressed('Enter')) {
         let nIdx = (idx + 1) % item.options.length;
         this.engine.saveManager.data.settings[item.key] = item.options[nIdx];
         this.engine.audio.sfx_uiSelect();
      }
      if(input.isJustPressed('ArrowLeft')) {
         let nIdx = (idx - 1 + item.options.length) % item.options.length;
         this.engine.saveManager.data.settings[item.key] = item.options[nIdx];
         this.engine.audio.sfx_uiSelect();
      }
   }
   draw(ctx) {
      ctx.fillStyle = 'rgba(10, 10, 26, 0.9)'; ctx.fillRect(0,0,CONSTANTS.WIDTH,CONSTANTS.HEIGHT);
      ctx.fillStyle = '#00FFFF'; ctx.font = 'bold 50px Arial'; ctx.textAlign='center';
      ctx.fillText("SYSTEM CONFIG", CONSTANTS.WIDTH/2, 120);
      
      for(let i=0; i<this.items.length; i++) {
         let item = this.items[i];
         let isSel = i === this.engine.ui.settingsSelection;
         ctx.fillStyle = isSel ? '#00FFFF' : '#FFFFFF';
         ctx.font = (isSel ? 'bold 32px' : '28px') + ' Arial';
         ctx.textAlign = 'right';
         ctx.fillText(item.name, CONSTANTS.WIDTH/2 - 20, 250 + i*60);
         
         ctx.textAlign = 'left';
         let valStr = this.engine.saveManager.data.settings[item.key];
         if(typeof valStr === 'boolean') valStr = valStr ? 'ON' : 'OFF';
         ctx.fillText((isSel ? '< ' : '') + valStr + (isSel ? ' >' : ''), CONSTANTS.WIDTH/2 + 20, 250 + i*60);
      }
      
      ctx.fillStyle = '#888888'; ctx.font = '20px Arial'; ctx.textAlign='center';
      ctx.fillText("Press ESCAPE to return", CONSTANTS.WIDTH/2, CONSTANTS.HEIGHT - 80);
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
         if(ent.isDead) { e.entities.splice(i, 1); continue; } // Remove dead ASAP
         ent.update(dt, e);
         CollisionEngine.resolveTileCollisions(ent, e.world, dt);
         if(ent.isDead) {
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
      if(e.world.activeBoss && tx > 125 && !e.world.activeBoss.introPlayed && e.state !== GAME_STATE.BOSS_INTRO && e.world.activeBoss.phase === 1 && e.world.activeBoss.hp === e.world.activeBoss.maxHp) {
         e.world.activeBoss.introPlayed = true;
         e.changeState(GAME_STATE.BOSS_INTRO);
      }
   }
}

class GameOverScene extends Scene {
   enter() { this.timer = 0; }
   update(dt) {
      this.timer += dt;
      if(this.timer > 0.3) {
         if(this.engine.input.isJustPressed('Enter')) {
            this.engine.loadZoneMode = 'CONTINUE';
            this.engine.changeState(GAME_STATE.GAMEPLAY);
         }
      }
   }
   draw(ctx) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0,0,CONSTANTS.WIDTH,CONSTANTS.HEIGHT);
      ctx.fillStyle = '#FF0000'; ctx.textAlign='center';
      let pop = Math.min(1.0, this.timer*3) * 80;
      ctx.font = `bold ${pop}px Arial`;
      ctx.fillText("SYSTEM FAILURE", CONSTANTS.WIDTH/2, 200);
      if(this.timer > 0.5) {
         ctx.fillStyle = '#FFFFFF'; ctx.font = '24px Arial';
         ctx.fillText("PRESS ENTER TO RETRY FROM CHECKPOINT", CONSTANTS.WIDTH/2, 500);
      }
   }
}

class CreditsScene extends Scene {
   enter() { this.scroll = CONSTANTS.HEIGHT; }
   update(dt) {
      this.scroll -= 50 * dt;
      if(this.engine.input.isJustPressed('Escape') || this.scroll < -400) {
         this.engine.changeState(GAME_STATE.MAIN_MENU);
      }
   }
   draw(ctx) {
      ctx.fillStyle = '#000000'; ctx.fillRect(0,0,CONSTANTS.WIDTH,CONSTANTS.HEIGHT);
      ctx.fillStyle = '#00FFFF'; ctx.font = 'bold 50px Arial'; ctx.textAlign='center';
      ctx.fillText("GRAVSHIFT: VOID PROTOCOL", CONSTANTS.WIDTH/2, this.scroll);
      ctx.fillStyle = '#FFFFFF'; ctx.font = '30px Arial';
      ctx.fillText("Executive Director: AI Assistant", CONSTANTS.WIDTH/2, this.scroll + 100);
      ctx.fillText("Art Direction: Nano Banana Subroutines", CONSTANTS.WIDTH/2, this.scroll + 150);
      ctx.fillText("Programming: Deepmind Antigravity", CONSTANTS.WIDTH/2, this.scroll + 200);
      ctx.fillText("Testing & QA: The User", CONSTANTS.WIDTH/2, this.scroll + 300);
      
      ctx.fillStyle = '#555555'; ctx.font = '20px Arial';
      ctx.fillText("Press ESCAPE to exit", CONSTANTS.WIDTH/2, CONSTANTS.HEIGHT - 50);
   }
}

class BossIntroScene extends Scene {
   update(dt) {
      const e = this.engine;
      e.particles.update(dt, e.player.gravityFlipped);
      e.particles.emitAmbient(e.world.zoneId, e.camera);
      e.camera.update(dt, e.player, e.world.width, e.world.height, e.saveManager.data.settings);
   }
}
