// ==========================================
// 04_rendererCamera.js
// ==========================================

class Camera {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.zoom = 1.0;
    this.shakeMag = 0;
    this.shakeDur = 0;
    this.shakeTimer = 0;
  }

  update(dt, player, mapWidth, mapHeight, settings) {
    if (!player) return;
    
    // Smooth follow (lerp factor 0.08 equivalent implemented via dt speed)
    const lerp = 5.0 * dt; 
    
    // Target X: centered on player
    let targetX = player.x - CONSTANTS.WIDTH / 2;
    
    // Vertical deadzone: 80px above/below center
    let playerScreenY = player.y - this.y;
    let targetY = this.y;
    
    if (playerScreenY < CONSTANTS.HEIGHT/2 - 80) {
      targetY = player.y - (CONSTANTS.HEIGHT/2 - 80);
    } else if (playerScreenY > CONSTANTS.HEIGHT/2 + 80) {
      targetY = player.y - (CONSTANTS.HEIGHT/2 + 80);
    }

    this.x += (targetX - this.x) * lerp;
    this.y += (targetY - this.y) * lerp;

    // Clamp to level bounds
    // Max map dimensions based on tiles
    const mapW = mapWidth * CONSTANTS.TILE_SIZE;
    const mapH = mapHeight * CONSTANTS.TILE_SIZE;
    
    // Prevent zooming camera out of bounds logic
    const scaledW = CONSTANTS.WIDTH / this.zoom;
    const scaledH = CONSTANTS.HEIGHT / this.zoom;

    this.x = Math.max(0, Math.min(this.x, mapW - scaledW));
    this.y = Math.max(0, Math.min(this.y, mapH - scaledH));

    // Screen Shake
    this.shakeX = 0;
    this.shakeY = 0;
    if (settings.screenShake === 'ON' && this.shakeTimer > 0) {
      this.shakeTimer -= dt;
      let factor = this.shakeTimer / this.shakeDur; // Exponential decay approximated
      let mag = this.shakeMag * factor;
      this.shakeX = (Math.random() - 0.5) * 2 * mag;
      this.shakeY = (Math.random() - 0.5) * 2 * mag;
    }
  }

  addShake(mag, dur) {
    this.shakeMag = mag;
    this.shakeDur = dur;
    this.shakeTimer = dur;
  }

  zoomTo(targetZoom, overTime) {
    // We can implement smooth zoom by updating zoom linearly over overTime
    // For now simple immediate or skip lerp as required
    this.zoom = targetZoom;
  }
}

class Renderer {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d', { alpha: false }); // Opt for no alpha channel if game fills it
    this.offscreenCanvas = document.createElement('canvas');
    this.offCtx = this.offscreenCanvas.getContext('2d');
    this.cachedZone = -1;
  }

  cacheMap(world) {
    // Render static map to offscreen canvas
    this.offscreenCanvas.width = world.width * CONSTANTS.TILE_SIZE;
    this.offscreenCanvas.height = world.height * CONSTANTS.TILE_SIZE;
    this.offCtx.clearRect(0, 0, this.offscreenCanvas.width, this.offscreenCanvas.height);
    
    // Draw tiles 
    // We leave background drawing to main render loop due to parallax
    world.drawStaticTiles(this.offCtx);
    this.cachedZone = world.zoneId;
  }

  render(engine) {
    const { state, camera, world, player, entities, particles, ui, settings } = engine;
    
    // Clear screen
    this.ctx.fillStyle = '#000000';
    this.ctx.fillRect(0, 0, CONSTANTS.WIDTH, CONSTANTS.HEIGHT);

    // Apply Camera
    this.ctx.save();
    
    if (state === GAME_STATE.GAMEPLAY || state === GAME_STATE.BOSS_INTRO) {
      if(settings.parallax === 'ON') {
        world.drawBackground(this.ctx, camera);
      } else {
        world.drawFlatBackground(this.ctx); // Base color
      }

      this.ctx.translate(-camera.x + camera.shakeX, -camera.y + camera.shakeY);
      this.ctx.scale(camera.zoom, camera.zoom);

      // Draw cached static tiles for current viewport
      if (this.cachedZone === world.zoneId) {
        // Source region (what camera sees)
        const sx = Math.max(0, camera.x);
        const sy = Math.max(0, camera.y);
        const sWidth = CONSTANTS.WIDTH / camera.zoom;
        const sHeight = CONSTANTS.HEIGHT / camera.zoom;
        
        // Dest region
        const dx = sx; 
        const dy = sy;
        
        this.ctx.drawImage(this.offscreenCanvas, 
          sx, sy, sWidth, sHeight, 
          dx, dy, sWidth, sHeight);
      }

      // Draw interactable entities (items, moving platforms, destructible blocks)
      world.drawDynamicTiles(this.ctx);

      // Draw Entities sorted by layer or just generally (Player, Enemies, Projectiles)
      for (const e of entities) {
        // Culling optimization
        if (e.x + e.width < camera.x - 200 || e.x > camera.x + CONSTANTS.WIDTH/camera.zoom + 200 ||
            e.y + e.height < camera.y - 200 || e.y > camera.y + CONSTANTS.HEIGHT/camera.zoom + 200) {
              continue;
        }
        e.draw(this.ctx);
      }

      if(player) {
         player.draw(this.ctx); // ensure player overlaps properly
      }

      this.ctx.restore();

      // Particles render above everything
      particles.draw(this.ctx, camera);
      
      // HUD overlays
      ui.drawHUD(this.ctx, engine);
    }
    
    if (state === GAME_STATE.PAUSED || state === GAME_STATE.MAIN_MENU || 
        state === GAME_STATE.SETTINGS || state === GAME_STATE.GAME_OVER ||
        state === GAME_STATE.BOOT || state === GAME_STATE.CUTSCENE || 
        state === GAME_STATE.VICTORY || state === GAME_STATE.CREDITS) {
      this.ctx.restore(); // Ensure no transforms for UI
      ui.drawMenu(this.ctx, engine);
      if (engine.scenes[state] && engine.scenes[state].draw) {
        engine.scenes[state].draw(this.ctx);
      }
    }
  }
}

class UIManager {
  constructor() {
    this.menuSelection = 0;
    this.mainMenuItems = ['NEW GAME', 'CONTINUE', 'SETTINGS', 'CREDITS', 'QUIT'];
    
    this.settingsSelection = 0;
    this.settingsItemsRow = 0; // 0: Audio, 1: Video, 2: Gameplay etc. structure depends on impl
    
    this.pauseSelection = 0;
    this.pauseItems = ['RESUME', 'SETTINGS', 'RESTART ZONE', 'QUIT TO MENU'];
    
    this.gameOverSelection = 0;
    this.gameOverItems = ['RETRY FROM CHECKPOINT', 'RETRY FROM ZONE START', 'QUIT TO MENU'];
    
    this.fadeAlpha = 0;
    this.fadeTarget = 0;
    
    this.notifications = [];
    this.bossBarAlpha = 0;
  }

  update(dt) {
    if(this.fadeAlpha < this.fadeTarget) {
      this.fadeAlpha = Math.min(this.fadeTarget, this.fadeAlpha + dt * 3); // 300ms fade
    } else if (this.fadeAlpha > this.fadeTarget) {
      this.fadeAlpha = Math.max(this.fadeTarget, this.fadeAlpha - dt * 3);
    }

    for (let i = this.notifications.length - 1; i >= 0; i--) {
      this.notifications[i].time -= dt;
      if(this.notifications[i].time <= 0) this.notifications.splice(i, 1);
    }
  }

  showNotification(text, color, duration) {
    this.notifications.push({text, color, maxTime: duration, time: duration});
  }

  drawHUD(ctx, engine) {
    const p = engine.player;
    if(!p) return;

    // Top Left: HP Bar
    ctx.fillStyle = '#000000';
    ctx.strokeStyle = '#222222';
    ctx.lineWidth = 2;
    ctx.fillRect(20, 20, 200, 14);
    ctx.strokeRect(20, 20, 200, 14);

    const hpIter = p.hp / p.maxHp;
    ctx.fillStyle = hpIter < 0.25 ? ((Math.floor(Date.now() / 150) % 2) ? '#FF0000' : '#880000') : '#FF0000';
    ctx.fillRect(22, 22, 196 * hpIter, 10);
    
    // Draw 5 segments logic
    for(let i=1; i<5; i++){
      ctx.fillStyle = '#000000';
      ctx.fillRect(20 + i*40, 20, 2, 14);
    }

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '10px Arial';
    ctx.fillText('HP', 225, 30);

    // Energy Bar
    ctx.fillStyle = '#000000';
    ctx.fillRect(20, 42, 200, 10);
    ctx.strokeRect(20, 42, 200, 10);

    const enIter = p.energy / p.maxEnergy;
    ctx.fillStyle = enIter > 0.5 ? '#00FFFF' : (enIter > 0.25 ? '#FFFF00' : '#FF0000');
    if (p.energy <= 0 && Math.floor(Date.now() / 150) % 2) ctx.fillStyle = '#FF5555';
    ctx.fillRect(22, 44, 196 * enIter, 6);
    
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText('EN', 225, 51);

    // Coins & Crystals
    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    ctx.arc(280, 27, 5, 0, Math.PI*2);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 14px Arial';
    ctx.fillText(p.coins, 290, 32);

    ctx.fillStyle = '#00FFFF';
    ctx.beginPath();
    // primitive star for icon
    ctx.moveTo(330, 22); ctx.lineTo(333, 27); ctx.lineTo(338, 27); ctx.lineTo(334, 31);
    ctx.lineTo(336, 36); ctx.lineTo(330, 33); ctx.lineTo(324, 36); ctx.lineTo(326, 31);
    ctx.lineTo(322, 27); ctx.lineTo(327, 27); ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(p.crystals, 345, 32);

    // Top Right
    ctx.textAlign = 'right';
    ctx.fillStyle = '#AAAAAA';
    ctx.font = 'italic 16px Arial';
    ctx.fillText(`ZONE ${engine.world.zoneId}: ${engine.world.getZoneName()}`, CONSTANTS.WIDTH - 20, 30);
    
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 18px Arial';
    ctx.fillText(`SCORE: ${p.score}`, CONSTANTS.WIDTH - 20, 55);

    // Boss Bar
    if(engine.world.activeBoss) {
      if(this.bossBarAlpha < 1.0) this.bossBarAlpha += 0.05;
      const b = engine.world.activeBoss;
      ctx.globalAlpha = this.bossBarAlpha;
      ctx.fillStyle = '#FF0000';
      const bWh = CONSTANTS.WIDTH - 80;
      const bHp = b.hp / b.maxHp;
      ctx.fillRect(40, CONSTANTS.HEIGHT - 40, bWh * bHp, 24);
      ctx.strokeRect(40, CONSTANTS.HEIGHT - 40, bWh, 24);
      
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.font = 'bold 16px Arial';
      ctx.fillText(b.name, CONSTANTS.WIDTH/2, CONSTANTS.HEIGHT - 45);
      ctx.globalAlpha = 1.0;
    } else {
      if(this.bossBarAlpha > 0) this.bossBarAlpha -= 0.05;
    }

    // Notifications
    ctx.textAlign = 'center';
    let ny = CONSTANTS.HEIGHT / 2 - 100;
    for(let n of this.notifications){
      const progress = n.time / n.maxTime;
      ctx.globalAlpha = progress > 0.8 ? (1-progress)*5 : (progress < 0.2 ? progress*5 : 1);
      ctx.fillStyle = n.color;
      ctx.font = 'bold 24px Arial';
      ctx.fillText(n.text, CONSTANTS.WIDTH/2, ny);
      ny += 30;
    }
    ctx.globalAlpha = 1.0;
    ctx.textAlign = 'left';
  }

  drawMenu(ctx, engine) {
    const s = engine.state;
    // Helper to draw dark overlay
    const overlay = (alpha) => {
      ctx.fillStyle = `rgba(0,0,0,${alpha})`;
      ctx.fillRect(0, 0, CONSTANTS.WIDTH, CONSTANTS.HEIGHT);
    };

    if (s === GAME_STATE.BOOT) {
      overlay(1);
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      const bootProgress = engine.bootTimer / 2.8;
      if (bootProgress > 0.17 && bootProgress < 0.53) {
         ctx.font = '20px Arial';
         ctx.fillText('GRAVSHIFT STUDIOS', CONSTANTS.WIDTH/2, CONSTANTS.HEIGHT/2 + 40);
         // Logo primitive
         ctx.beginPath(); ctx.arc(CONSTANTS.WIDTH/2 - 15, CONSTANTS.HEIGHT/2-20, 20, 0, Math.PI*2); ctx.stroke();
         ctx.beginPath(); ctx.arc(CONSTANTS.WIDTH/2 + 15, CONSTANTS.HEIGHT/2-20, 20, 0, Math.PI*2); ctx.stroke();
         ctx.beginPath(); ctx.moveTo(CONSTANTS.WIDTH/2 - 40, CONSTANTS.HEIGHT/2 - 40); ctx.lineTo(CONSTANTS.WIDTH/2 + 40, CONSTANTS.HEIGHT/2); ctx.stroke();
      } else if (bootProgress >= 0.7) {
        ctx.font = '16px Console, monospace';
        ctx.fillText('INITIALIZING SYSTEMS...', CONSTANTS.WIDTH/2, CONSTANTS.HEIGHT/2);
        ctx.strokeRect(CONSTANTS.WIDTH/2 - 100, CONSTANTS.HEIGHT/2 + 20, 200, 10);
        ctx.fillRect(CONSTANTS.WIDTH/2 - 100, CONSTANTS.HEIGHT/2 + 20, 200 * ((bootProgress-0.7)/0.3), 10);
      }
    } 
    else if (s === GAME_STATE.MAIN_MENU) {
      this._drawMainMenu(ctx, engine);
    }
    else if (s === GAME_STATE.PAUSED) {
      overlay(0.7);
      ctx.fillStyle = '#00FFFF';
      ctx.textAlign = 'center';
      ctx.font = 'bold 60px Arial';
      ctx.fillText('PAUSED', CONSTANTS.WIDTH/2, 150);

      this.pauseItems.forEach((item, i) => {
         const y = 300 + i * 50;
         ctx.fillStyle = i === this.pauseSelection ? '#00FFFF' : '#AAAAAA';
         ctx.font = 'bold 24px Arial';
         const text = (item === 'RESUME' ? '' : '') + item; // Can add logic here
         ctx.fillText(text, CONSTANTS.WIDTH/2, y);
         if(i === this.pauseSelection) {
           ctx.fillText('>', CONSTANTS.WIDTH/2 - ctx.measureText(item).width/2 - 20, y);
         }
      });
    }
    // ... Settings, Cutscene, and more will be implemented dynamically
  }

  _drawMainMenu(ctx, engine) {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0,0,CONSTANTS.WIDTH,CONSTANTS.HEIGHT);
    
    // Parallax background for menu (Starfield layer 1)
    ctx.fillStyle = '#FFFFFF';
    for(let i=0; i<200; i++) {
       let px = (i * 37 + engine.menuTime * 10) % CONSTANTS.WIDTH;
       let py = (i * 91) % CONSTANTS.HEIGHT;
       ctx.fillRect(px, py, 1, 1);
    }
    // Nebula layer (simplified blobs)
    ctx.fillStyle = 'rgba(128, 0, 255, 0.05)';
    for(let i=0; i<5; i++) {
       let px = (i * 300 + engine.menuTime * 20) % (CONSTANTS.WIDTH+400) - 200;
       ctx.beginPath(); ctx.arc(px, 300 + Math.sin(px)*100, 150, 0, Math.PI*2); ctx.fill();
    }
    // Station silhouette
    ctx.save();
    ctx.translate(CONSTANTS.WIDTH/2, CONSTANTS.HEIGHT + 200);
    ctx.rotate(engine.menuTime * Math.PI / 180 * -1); // slow rotate
    ctx.fillStyle = '#111115';
    ctx.beginPath(); ctx.moveTo(-600, 0); ctx.lineTo(-400, -200); ctx.lineTo(-200, -200); ctx.lineTo(-50, -400); ctx.lineTo(100, -300); ctx.lineTo(400, -350); ctx.lineTo(700, 0); ctx.closePath(); ctx.fill();
    ctx.restore();

    // Glitch title Text
    ctx.textAlign = 'center';
    ctx.font = 'bold 80px Arial';
    let titleT = "GRAVSHIFT";
    let isGlitch = Math.random() < 0.05 && engine.menuTime % 2 < 0.2;
    ctx.fillStyle = '#00FFFF';
    if(isGlitch) {
      ctx.fillText(titleT, CONSTANTS.WIDTH/2 + (Math.random()*10 - 5), 180);
      ctx.fillStyle = '#FF00FF';
      ctx.fillText(titleT, CONSTANTS.WIDTH/2 + (Math.random()*10 - 5), 180);
    } else {
      ctx.fillText(titleT, CONSTANTS.WIDTH/2, 180);
    }
    ctx.font = 'bold 24px Arial';
    ctx.fillStyle = '#AA00FF';
    ctx.fillText("VOID PROTOCOL", CONSTANTS.WIDTH/2, 220);

    // Wraith anim
    let wy = CONSTANTS.HEIGHT/2 + Math.sin(engine.menuTime*Math.PI) * 10;
    ctx.fillStyle = 'rgba(170,0,255,0.2)';
    ctx.beginPath(); ctx.arc(300, wy + 20, 60, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(286, wy, 28, 48); // body
    
    // Items
    this.mainMenuItems.forEach((item, i) => {
       const y = 350 + i * 50;
       
       let displayColor = '#AAAAAA';
       if(i === 1 && !localStorage.getItem('gravshift_save')) displayColor = '#444444'; // grey out continue
       else if(i === this.menuSelection) displayColor = '#00FFFF';

       ctx.fillStyle = displayColor;
       ctx.font = `bold ${i === this.menuSelection ? 26 : 24}px Arial`;
       ctx.fillText(item, CONSTANTS.WIDTH/2, y);

       if(i === this.menuSelection) {
         ctx.fillText('>', CONSTANTS.WIDTH/2 - ctx.measureText(item).width/2 - 20, y);
       }
    });

  }
}
