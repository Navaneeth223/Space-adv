// ==========================================
// 05_collisionIdd.js
// ==========================================

class CollisionEngine {
  static checkAABB(a, b) {
    return a.x < b.x + b.width &&
           a.x + a.width > b.x &&
           a.y < b.y + b.height &&
           a.y + a.height > b.y;
  }

  static checkAABB_expanded(a, b, pad) {
    return a.x - pad < b.x + b.width + pad &&
           a.x + a.width + pad > b.x - pad &&
           a.y - pad < b.y + b.height + pad &&
           a.y + a.height + pad > b.y - pad;
  }

  static resolveTileCollisions(entity, world, dt) {
    if (entity.isGravityImmune || entity.isDead) return;

    // Apply gravity
    const gravForce = entity.gravityFlipped ? -PHYSICS.gravity : PHYSICS.gravity;
    
    // Check if on wall for slide mechanics (player only essentially)
    if(entity.isPlayer && entity.wallClingDir !== 0) {
      if(Math.sign(entity.vy) === Math.sign(gravForce)) {
          entity.vy = Math.sign(gravForce) * PHYSICS.wallSlideSpeed;
      } else {
          entity.vy += gravForce * dt;
      }
    } else {
      entity.vy += gravForce * dt;
    }
    
    // Terminal velocity
    if (entity.vy > PHYSICS.terminalVelocity) entity.vy = PHYSICS.terminalVelocity;
    if (entity.vy < -PHYSICS.terminalVelocity) entity.vy = -PHYSICS.terminalVelocity;

    // Separate X and Y movement for slidey collision
    entity.x += entity.vx * dt;
    this._checkAxis(entity, world, 'x');

    entity.y += entity.vy * dt;
    this._checkAxis(entity, world, 'y');

    // World bounds clamp
    if (entity.x < 0) { entity.x = 0; entity.vx = 0; }
    if (entity.y < 0) { entity.y = 0; entity.vy = 0; entity.onGround = false; }
    // Max bounds handled by tile collisions on edges ideally, but we can hard cap
    const maxW = world.width * CONSTANTS.TILE_SIZE;
    const maxH = world.height * CONSTANTS.TILE_SIZE;
    if (entity.x + entity.width > maxW) { entity.x = maxW - entity.width; entity.vx = 0; }
    if (entity.y + entity.height > maxH) { entity.y = maxH - entity.height; entity.vy = 0; entity.onGround = false; }

    entity.updateStateAfterCollision();
  }

  static _checkAxis(entity, world, axis) {
    const ts = CONSTANTS.TILE_SIZE;
    // Get tiles in bounding box
    const startX = Math.floor(entity.x / ts);
    const endX = Math.floor((entity.x + entity.width - 0.01) / ts);
    const startY = Math.floor(entity.y / ts);
    const endY = Math.floor((entity.y + entity.height - 0.01) / ts);

    if(axis === 'y') entity.onGround = false;
    entity.touchingWall = 0;

    for (let y = startY; y <= endY; y++) {
      for (let x = startX; x <= endX; x++) {
        let tile = world.getTile(x, y);

        // Tile 2 & 3: Spikes, handled by entity loop. Tile 4: Energy drain
        // Only resolve physical blocks
        if (tile === 1 || tile === 5 || tile === 8) { 
          this._resolveSolid(entity, x, y, ts, axis);
        } else if (tile === 7 && axis === 'y') {
          // One-way platform
          this._resolveOneWay(entity, x, y, ts);
        }
      }
    }
  }

  static _resolveSolid(entity, tx, ty, ts, axis) {
    if (axis === 'x') {
      if (entity.vx > 0) {
        entity.x = tx * ts - entity.width;
        entity.vx = 0;
        entity.touchingWall = 1;
      } else if (entity.vx < 0) {
        entity.x = tx * ts + ts;
        entity.vx = 0;
        entity.touchingWall = -1;
      }
    } else if (axis === 'y') {
      if (entity.vy > 0) {
        entity.y = ty * ts - entity.height;
        entity.vy = 0;
        if(!entity.gravityFlipped) entity.onGround = true;
      } else if (entity.vy < 0) {
        entity.y = ty * ts + ts;
        entity.vy = 0;
        if(entity.gravityFlipped) entity.onGround = true;
      }
    }
  }

  static _resolveOneWay(entity, tx, ty, ts) {
    if (!entity.gravityFlipped && entity.vy > 0) {
      if (entity.prevY + entity.height <= ty * ts + 0.1) {
        entity.y = ty * ts - entity.height;
        entity.vy = 0;
        entity.onGround = true;
      }
    } else if (entity.gravityFlipped && entity.vy < 0) {
      if (entity.prevY >= ty * ts + ts - 0.1) {
        entity.y = ty * ts + ts;
        entity.vy = 0;
        entity.onGround = true;
      }
    }
  }
}

class IDDSystem {
  constructor(settings) {
    this.mode = settings.difficultyMode;
    this.timer = 0;
    this.deaths = 0;
    this.flips = 0;
    this.dmgDealt = 0;
    this.dmgTaken = 0;
    this.distX = 0;
    this.itemsCollected = 0;
    this.itemsPossible = 10; // avoid div by 0
    this.dashes = 0;
    
    this.performanceScore = 0.5; // Starts in middle

    // Modifiers that will be read by the game
    this.enemyHpMod = 1.0;
    this.enemySpeedMod = 1.0;
    this.enemyAggroMod = 1.0;
    this.pickupSpawnChance = 1.0;
    this.spawnElite = false;

    this._applyFixedMode();
  }

  _applyFixedMode() {
    if (this.mode !== 'AUTO') {
      switch(this.mode) {
        case 'EASY': this.performanceScore = 0.1; break;
        case 'NORMAL': this.performanceScore = 0.5; break;
        case 'HARD': this.performanceScore = 0.7; break;
        case 'NIGHTMARE': this.performanceScore = 0.95; break;
      }
      this._updateModifiers();
    }
  }

  update(dt, player) {
    if (this.mode !== 'AUTO') return;

    this.timer += dt;
    if (this.timer >= 30.0) { // Eval every 30s
      this._evaluate();
      this.timer = 0;
      // Reset counters
      this.deaths = 0; this.flips = 0; this.dmgDealt = 0; this.dmgTaken = 0;
      this.distX = 0; this.itemsCollected = 0; this.itemsPossible = 5; this.dashes = 0;
    }
  }

  _evaluate() {
    // 1. Deaths (scaled ~3 / 30s)
    let mDeath = 1.0 - Math.min(this.deaths / 3.0, 1.0);
    // 2. Combat (deal / taken)
    let comboEff = this.dmgTaken > 0 ? (this.dmgDealt / this.dmgTaken) : 3.0;
    let mCombat = Math.min(comboEff / 3.0, 1.0);
    // 3. Flips
    let mFlips = Math.min(this.flips / 20.0, 1.0);
    // 4. Speed (approx px per second / 150)
    let speed = (this.distX / 30.0);
    let mSpeed = Math.min(speed / 150.0, 1.0);
    // 5. Dash
    let mDash = Math.min(this.dashes / 10.0, 1.0);

    let newScore = (mDeath * 0.3) + (mCombat * 0.25) + (mFlips * 0.2) + (mSpeed * 0.15) + (mDash * 0.1);
    
    // Smooth lerp
    this.performanceScore = (this.performanceScore * 0.7) + (newScore * 0.3);
    this._updateModifiers();
  }

  _updateModifiers() {
    let p = this.performanceScore;
    if (p < 0.2) {
      this.enemyHpMod = 0.7; this.enemySpeedMod = 0.8; this.enemyAggroMod = 0.7;
      this.pickupSpawnChance = 1.5; this.spawnElite = false;
    } else if (p < 0.4) {
      this.enemyHpMod = 0.85; this.enemySpeedMod = 0.9; this.enemyAggroMod = 0.9;
      this.pickupSpawnChance = 1.2; this.spawnElite = false;
    } else if (p < 0.6) {
      this.enemyHpMod = 1.0; this.enemySpeedMod = 1.0; this.enemyAggroMod = 1.0;
      this.pickupSpawnChance = 1.0; this.spawnElite = false;
    } else if (p < 0.8) {
      this.enemyHpMod = 1.15; this.enemySpeedMod = 1.15; this.enemyAggroMod = 1.2;
      this.pickupSpawnChance = 0.8; this.spawnElite = false;
    } else {
      this.enemyHpMod = 1.30; this.enemySpeedMod = 1.30; this.enemyAggroMod = 1.5;
      this.pickupSpawnChance = (this.mode==='NIGHTMARE') ? 0 : 0.6; 
      this.spawnElite = true;
    }
  }

  // --- External Trackers ---
  recordDeath() { this.deaths++; }
  recordFlip() { this.flips++; }
  recordDash() { this.dashes++; }
  recordDamageDealt(amt) { this.dmgDealt += amt; }
  recordDamageTaken(amt) { this.dmgTaken += amt; }
  recordDistance(px) { this.distX += Math.abs(px); }
  recordItem() { this.itemsCollected++; }
  recordItemSpawnable() { this.itemsPossible++; }
}
