// ==========================================
// 06_entities.js
// ==========================================

class Entity {
  constructor(x, y, w, h) {
    this.x = x; this.y = y; this.prevX = x; this.prevY = y;
    this.width = w; this.height = h;
    this.vx = 0; this.vy = 0;
    this.isDead = false;
    
    this.hp = 10; this.maxHp = 10;
    this.gravityFlipped = false;
    this.isGravityImmune = false;
    this.onGround = false;
    this.touchingWall = 0;
    
    this.facingDir = 1; // 1 = right, -1 = left
    this.iframeTimer = 0;
    this.color = '#FFFFFF';
  }

  update(dt, engine) {
    this.prevX = this.x; this.prevY = this.y;
    if (this.iframeTimer > 0) this.iframeTimer -= dt;
  }
  
  updateStateAfterCollision() {}

  takeDamage(amt, knockbackDir, engine) {
    if(this.iframeTimer > 0 || this.isDead) return false;
    this.hp -= amt;
    if(knockbackDir !== 0) {
        this.vx += knockbackDir * 200;
        this.y -= (this.gravityFlipped ? -2 : 2); // small pop
    }
    this.iframeTimer = 0.2;
    if(this.hp <= 0) {
      this.hp = 0;
      this.die(engine);
    }
    return true;
  }

  die(engine) {
    this.isDead = true;
  }

  draw(ctx) {}
}

class Player extends Entity {
  constructor(saveData) {
    super(saveData.checkpointX, saveData.checkpointY, 28, 48);
    this.isPlayer = true;
    // Load stats
    const st = saveData.playerStats;
    this.hp = st.hp; this.maxHp = st.maxHp;
    this.energy = st.energy; this.maxEnergy = st.maxEnergy;
    this.coins = st.coins; this.crystals = st.crystals;
    this.score = st.score;

    this.upgrades = saveData.upgrades || [];

    // Core mechanic state
    this.dashTimer = 0;
    this.dashCooldown = 0;
    this.wallClingDir = 0;
    
    this.meleeCombo = 0;
    this.meleeTimer = 0;
    this.meleeCooldown = 0;
    
    this.shootCooldown = 0;
    this.chargeTimer = 0;

    this.auraPhase = 0;
    this.cloakPhase = 0;
    this.groundPoundActive = false;

    this.gravHoldMode = saveData.settings.gravFlipHold === 'HOLD TO FLIP';
  }

  hasUpgrade(name) { return this.upgrades.includes(name); }

  update(dt, engine) {
    super.update(dt, engine);
    if(this.isDead) return;

    this._handleInput(dt, engine);
    this._updateEnergy(dt);

    if (this.gravityFlipped) {
       this.energy -= 10 * dt; // Drain constantly
       if (this.energy <= 0) {
          this.energy = 0;
          this.gravityFlipped = false;
          this.vy = 0;
          engine.particles.emitGravityFlip(this.x + this.width/2, this.y + this.height/2, false);
          engine.audio.sfx_gravityFlip();
       }
    }
    
    this.auraPhase += dt * Math.PI; // 2s cycle approx
    this.cloakPhase += dt * 5;

    // Dash logic
    if (this.dashTimer > 0) {
      this.dashTimer -= dt;
      this.vx = PHYSICS.dashSpeed * this.facingDir;
      this.vy = 0;
      engine.particles.emitDashTrail(this.x + this.width/2, this.y + this.height/2, this.facingDir);
      if (this.dashTimer <= 0) this.vx = 0; // stop dash
    }
    if (this.dashCooldown > 0) this.dashCooldown -= dt;

    if (this.meleeCooldown > 0) this.meleeCooldown -= dt;
    if (this.meleeTimer > 0) {
        this.meleeTimer -= dt;
        if(this.meleeTimer <= 0) this.meleeCombo = 0; // reset combo window
    }

    if (this.shootCooldown > 0) this.shootCooldown -= dt;

    if (this.iframeTimer > 0) {
       // flicker managed in draw
    }
  }

  _handleInput(dt, engine) {
    const input = engine.input;
    if(this.dashTimer > 0) return; // Cant act during dash

    // Horizontal Move
    let moveDir = 0;
    if (input.isDown('ArrowLeft')) { moveDir = -1; this.facingDir = -1; }
    if (input.isDown('ArrowRight')) { moveDir = 1; this.facingDir = 1; }

    if (moveDir !== 0) {
      this.vx += moveDir * PHYSICS.playerAccel * dt;
      engine.idd.recordDistance(Math.abs(this.vx * dt));
    } else {
      // Decelerate
      if (this.vx > 0) {
        this.vx -= PHYSICS.playerDecel * dt;
        if (this.vx < 0) this.vx = 0;
      } else if (this.vx < 0) {
        this.vx += PHYSICS.playerDecel * dt;
        if (this.vx > 0) this.vx = 0;
      }
    }

    // Clamp speed unless dashing
    if (this.vx > PHYSICS.playerWalkSpeed) this.vx = PHYSICS.playerWalkSpeed;
    if (this.vx < -PHYSICS.playerWalkSpeed) this.vx = -PHYSICS.playerWalkSpeed;

    // Wall cling
    this.wallClingDir = 0;
    if (!this.onGround && this.touchingWall !== 0 && moveDir === this.touchingWall) {
      this.wallClingDir = this.touchingWall;
    }

    // Gravity Flip
    if (this.gravHoldMode) {
       let wantFlipped = input.isDown('Space') || input.isDown('ArrowUp');
       if(wantFlipped !== this.gravityFlipped) this._doFlip(engine);
    } else {
       if (input.isJustPressed('Space') || input.isJustPressed('ArrowUp')) {
         this._doFlip(engine);
       }
    }

    // Ground Pound
    if (!this.onGround && input.isJustPressed('ArrowDown')) {
      this.groundPoundActive = true;
      this.vy = this.gravityFlipped ? -900 : 900;
    }

    // Dash
    if (input.isJustPressed('KeyC') && this.dashCooldown <= 0 && this.energy >= 20) {
      this.energy -= 20;
      this.dashTimer = 0.12;
      this.dashCooldown = this.hasUpgrade('Shadow Step') ? 0.5 : 0.8;
      engine.idd.recordDash();
    }

    // Melee (Z)
    if (input.isJustPressed('KeyZ') && this.meleeCooldown <= 0) {
      this._doMelee(engine);
    }

    // Ranged (X) Auto-fire or charge
    if (input.isDown('KeyX')) {
      this.chargeTimer += dt;
      if(this.chargeTimer > 1.5 && !this.chargeSound) {
         this.chargeSound = engine.audio.sfx_chargedBlastCharge(220, 880, 1500);
      }
      
      // Auto-fire checks
      if (this.hasUpgrade('Void Resonance Core') && this.chargeTimer < 0.2 && this.shootCooldown <= 0) {
          // If we want auto fire, we need continuous logic here. 
          // For simplicity, tapping vs holding - just map auto fire cleanly
          if(this.energy >= 8) this._fireVoidBolt(engine);
      }
    } else {
      if (this.chargeTimer >= 1.5) {
         // Release charged blast
         this._fireChargedBlast(engine);
      } else if (input.isJustReleased('KeyX')) {
         if(this.energy >= 8 && this.shootCooldown <= 0) this._fireVoidBolt(engine);
      }
      this.chargeTimer = 0;
      this.chargeSound = null;
    }
  }

  _doFlip(engine) {
    if (this.energy > 0) {
      this.gravityFlipped = !this.gravityFlipped;
      this.vy = 0;
      engine.particles.emitGravityFlip(this.x + this.width/2, this.y + this.height/2, this.gravityFlipped);
      engine.audio.sfx_gravityFlip();
      engine.idd.recordFlip();
      this.groundPoundActive = false; // Reset if flipping mid-pound
    } else {
      // Out of energy flash
      engine.ui.showNotification("ENERGY DEPLETED", '#FF0000', 1.0);
      engine.audio.sfx_gravityLocked();
    }
  }

  _doMelee(engine) {
    this.meleeCombo++;
    if(this.meleeCombo > 3) this.meleeCombo = 1;
    this.meleeTimer = this.hasUpgrade('Combo Extender') ? 0.6 : 0.4;
    this.meleeCooldown = 0.35;
    
    const dmg = this.hasUpgrade('Blade Sharpness') ? 40 : 25;
    const finalDmg = this.meleeCombo === 3 ? dmg * 2 : dmg;

    engine.audio.sfx_meleeSwing();
    
    // Spawn melee hitbox & particles
    // ... we can handle hitbox logic directly checking enemies here
    let cx = this.x + this.width/2 + (this.facingDir * 30);
    let cy = this.y + this.height/2;

    engine.particles.emitMeleeSlash(cx, cy, this.facingDir, this.gravityFlipped);

    const hitRect = {
       x: this.facingDir > 0 ? this.x : this.x - 45,
       y: this.y - 10,
       width: 45 + this.width,
       height: this.height + 20
    };

    let hitAnything = false;
    // Check destructibles
    engine.world.breakTiles(hitRect);

    // Check enemies
    for(let e of engine.entities) {
      if(!e.isPlayer && !e.isDead && !e.isProjectile) {
        if(CollisionEngine.checkAABB(hitRect, e)) {
           if(e.takeDamage(finalDmg, this.facingDir, engine)) {
               engine.particles.emitBulletHit(e.x + e.width/2, e.y + e.height/2);
               engine.idd.recordDamageDealt(finalDmg);
               hitAnything = true;
           }
        }
      }
    }
    
    if(hitAnything) engine.audio.sfx_meleeHit();
  }

  _fireVoidBolt(engine) {
    this.energy -= 8;
    this.shootCooldown = this.hasUpgrade('Rapid Fire') ? 0.22 : 0.3;
    
    let vx = 550 * this.facingDir;
    let vy = 0;
    if(engine.input.isDown('ArrowUp')) vy = this.gravityFlipped ? 550 : -550;
    if(engine.input.isDown('ArrowDown')) vy = this.gravityFlipped ? -550 : 550;
    
    if(vy !== 0) vx = 550 * 0.707 * this.facingDir; // normalize diag

    const dmg = this.hasUpgrade('Void Amplifier') ? 26 : 18;
    engine.spawnProjectile(true, this.x + this.width/2, this.y + this.height/2, vx, vy, dmg, 1.2, false);
    engine.audio.sfx_voidBolt();
  }

  _fireChargedBlast(engine) {
    if (this.energy < 40) return;
    this.energy -= 40;
    let vx = 300 * this.facingDir;
    let vy = 0; // standard horizontal usually for charged
    
    const dmg = this.hasUpgrade('Singularity Overload') ? 130 : 90;
    engine.spawnProjectile(true, this.x + this.width/2, this.y + this.height/2, vx, vy, dmg, 3.0, true);
    engine.audio.sfx_chargedBlastFire();
  }

  _updateEnergy(dt) {
    if(this.gravityFlipped) return; // Halt regeneration while draining
    const isRegenSlow = this.dashTimer > 0 || this.chargeTimer > 0;
    const rate = (isRegenSlow ? 6 : 12) + (this.hasUpgrade('Energy Regen+') ? 5 : 0);
    this.energy = Math.min(this.maxEnergy, this.energy + rate * dt);
  }

  updateStateAfterCollision() {
    if(this.groundPoundActive && this.onGround) {
      this.groundPoundActive = false;
      window.gameEngine.camera.addShake(5, 0.2);
      window.gameEngine.particles.emitGroundPound(this.x+14, this.gravityFlipped?this.y:this.y+48, this.gravityFlipped);
      window.gameEngine.audio.sfx_meleeHit(); // Reutilize thud
      // DMG to enemies
      for(let e of window.gameEngine.entities) {
         if(!e.isPlayer && !e.isDead && !e.isProjectile) {
            let dx = (e.x) - (this.x);
            let dy = (e.y) - (this.y);
            if (dx*dx+dy*dy < 80*80) { // 80px radius
               e.takeDamage(15, Math.sign(dx), window.gameEngine);
            }
         }
      }
    }
  }

  takeDamage(amt, knockbackDir, engine) {
    if(this.dashTimer > 0) return false; // iframe during dash
    if(super.takeDamage(amt, knockbackDir, engine)){
      engine.camera.addShake(8, 0.3);
      engine.audio.sfx_playerHurt();
      engine.idd.recordDamageTaken(amt);
      return true;
    }
    return false;
  }

  die(engine) {
    super.die(engine);
    engine.particles.emitEnemyDeath(this.x+14, this.y+24, '#1a0a2a');
    engine.audio.sfx_playerDeath();
    engine.idd.recordDeath();
    engine.triggerGameOver();
  }

  draw(ctx) {
    if (this.iframeTimer > 0 && Math.floor(this.iframeTimer * 10) % 2 === 0) return; // FLicker

    ctx.save();
    ctx.translate(this.x + this.width/2, this.y + this.height/2);
    if(this.gravityFlipped) ctx.scale(1, -1);
    if(this.facingDir === -1) ctx.scale(-1, 1);

    // Aura
    let op = 0.6 + Math.sin(this.auraPhase)*0.4;
    let radGrad = ctx.createRadialGradient(0, 0, 5, 0, 0, 40);
    const radColor = this.gravityFlipped ? '0, 255, 255' : '170, 0, 255';
    radGrad.addColorStop(0, `rgba(${radColor}, ${op})`);
    radGrad.addColorStop(1, `rgba(${radColor}, 0)`);
    ctx.fillStyle = radGrad;
    ctx.beginPath(); ctx.arc(0, 0, 40, 0, Math.PI*2); ctx.fill();

    // Procedural Nano Banana Character
    const isMoving = Math.abs(this.vx) > 10;
    const isJumping = !this.onGround;
    const runCycle = isMoving && this.onGround ? Date.now() / 150 : 0;
    
    // Banana Body
    ctx.fillStyle = '#FFDD00';
    ctx.beginPath();
    ctx.moveTo(-10, -20);
    ctx.quadraticCurveTo(15, -15, 10, 20);
    ctx.quadraticCurveTo(0, 25, -10, 20);
    ctx.quadraticCurveTo(-5, 0, -14, -20);
    ctx.fill();
    
    // Nanosuit Armor Plates
    ctx.fillStyle = '#222222';
    ctx.fillRect(-6, 0, 16, 8); // Mid section belt
    ctx.fillRect(-2, -22, 10, 6); // Top cap

    // Visor
    ctx.fillStyle = '#00FFFF';
    ctx.fillRect(4, -14, 8, 4);

    // Legs Animation
    ctx.strokeStyle = '#444444';
    ctx.lineWidth = 3;
    ctx.beginPath();
    let leg1y = 20, leg2y = 20;
    let leg1x = 0, leg2x = 6;
    if (isJumping) {
        leg1y = 16; leg2y = 24;
        leg1x = -4; leg2x = 2;
    } else if (isMoving) {
        leg1x = 0 + Math.sin(runCycle) * 8;
        leg2x = 6 + Math.sin(runCycle + Math.PI) * 8;
        leg1y = 20 - Math.abs(Math.sin(runCycle)*4);
        leg2y = 20 - Math.abs(Math.sin(runCycle + Math.PI)*4);
    }
    ctx.moveTo(2, 18); ctx.lineTo(leg1x, leg1y); // Leg 1
    ctx.moveTo(8, 16); ctx.lineTo(leg2x, leg2y); // Leg 2
    ctx.stroke();

    // Arms
    let armX = 0; let armY = 4;
    if(isMoving && this.onGround) {
       armX = Math.sin(runCycle + Math.PI) * 6; // Swing opposite of leg1
    }
    ctx.strokeStyle = '#222222';
    ctx.beginPath();
    ctx.moveTo(0, -2); ctx.lineTo(armX + 4, armY);
    ctx.stroke();
    
    // Charged visual
    if(this.chargeTimer > 0) {
       let chargeProg = Math.min(this.chargeTimer / 1.5, 1.0);
       let cr = 8 + 16 * chargeProg;
       ctx.fillStyle = chargeProg >= 1.0 ? '#FFFFFF' : '#00FFFF';
       ctx.globalAlpha = 0.5 + 0.5*chargeProg;
       ctx.beginPath(); ctx.arc(10, 0, cr, 0, Math.PI*2); ctx.fill();
       ctx.globalAlpha = 1.0;
    }

    ctx.restore();
  }
}

// ... basic Enemy/Projectile classes follow the same pattern in 08_enemies
