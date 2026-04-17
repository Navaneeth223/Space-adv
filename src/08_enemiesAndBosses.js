// ==========================================
// 08_enemiesAndBosses.js
// ==========================================

class Projectile extends Entity {
  constructor(isPlayer, x, y, vx, vy, dmg, lifetime, pierce=false) {
     super(x, y, 12, 4);
     this.isPlayerProj = isPlayer;
     this.vx = vx; this.vy = vy;
     this.dmg = dmg;
     this.lifetime = lifetime;
     this.isProjectile = true;
     this.pierceCount = pierce ? 3 : 0;
     this.isGravityImmune = true; // bullets don't fall usually
     
     if(pierce) { this.width = 30; this.height = 30; }
  }

  update(dt, engine) {
     super.update(dt, engine);
     this.x += this.vx * dt;
     this.y += this.vy * dt;
     this.lifetime -= dt;

     if(this.lifetime <= 0) {
        this.die();
        return;
     }

     // Emit trail
     if(this.isPlayerProj && this.pierceCount > 0) {
        engine.particles.emitExplosion(this.x+15, this.y+15, 5, 0.1); 
     } else {
        if(Math.random() > 0.5) engine.particles.emitBulletHit(this.x+6, this.y+2);
     }

     // Tile collision
     const ts = CONSTANTS.TILE_SIZE;
     const tx = Math.floor(this.x/ts);
     const ty = Math.floor(this.y/ts);
     const t = engine.world.getTile(tx, ty);
     if(t === 1 || t === 5 || t === 8) {
        if(t === 8) engine.world.breakTiles({x: this.x, y: this.y, width: this.width, height: this.height});
        engine.particles.emitBulletHit(this.x, this.y);
        this.die();
        return;
     }

     // Entity collision
     for(let e of engine.entities) {
        if(e.isDead || e.isProjectile) continue;
        if(this.isPlayerProj && !e.isPlayer && CollisionEngine.checkAABB(this, e)) {
           e.takeDamage(this.dmg, Math.sign(this.vx), engine);
           engine.particles.emitBulletHit(this.x, this.y);
           if(this.pierceCount > 0) {
              this.pierceCount--;
           } else {
              this.die();
              return;
           }
        } 
        else if (!this.isPlayerProj && e.isPlayer && CollisionEngine.checkAABB(this, e)) {
           if(e.takeDamage(this.dmg, Math.sign(this.vx), engine)) {
              this.die();
              return; 
           }
        }
     }
  }

  draw(ctx) {
     ctx.fillStyle = this.isPlayerProj ? (this.pierceCount > 0 ? '#FFFFFF' : '#00FFFF') : '#FF0000';
     if(this.pierceCount > 0) {
        ctx.beginPath(); ctx.arc(this.x+15, this.y+15, 15, 0, Math.PI*2); ctx.fill();
     } else {
        ctx.fillRect(this.x, this.y, this.width, this.height);
     }
  }
}

// ================= COLLECTIBLES ================= //
class Collectible extends Entity {
  constructor(x, y, w, h) {
     super(x, y, w, h);
     this.isGravityImmune = true;
     this.collected = false;
     this.baseY = y;
     this.time = Math.random() * 10;
  }
  update(dt, engine) {
     this.time += dt;
     this.y = this.baseY + Math.sin(this.time * 2) * 8; // Float animation
     if(CollisionEngine.checkAABB_expanded(this, engine.player, 8)) {
        this.onCollect(engine);
        this.isDead = true;
     }

     if(engine.player.hasUpgrade('Crystal Magnet')) {
        let dx = engine.player.x - this.x;
        let dy = engine.player.y - this.y;
        let dist = Math.sqrt(dx*dx+dy*dy);
        if(dist < 60) {
           this.x += (dx/dist) * 200 * dt;
           this.y += (dy/dist) * 200 * dt;
           this.baseY = this.y; // Override float
        }
     }
  }
}

class Coin extends Collectible {
  constructor(x, y) { super(x, y, 16, 16); this.color = '#FFD700'; }
  onCollect(engine) {
     engine.player.coins += 1;
     engine.particles.emitCoinCollect(this.x, this.y);
     engine.audio.sfx_coinCollect();
  }
  draw(ctx) {
     ctx.fillStyle = this.color;
     ctx.beginPath(); ctx.arc(this.x+8, this.y+8, 8 * Math.abs(Math.sin(this.time*3)), 0, Math.PI*2); ctx.fill();
  }
}

class Crystal extends Collectible {
  constructor(x, y) { super(x, y, 16, 16); this.color = '#00FFFF'; }
  onCollect(engine) {
     engine.player.crystals += 1;
     engine.player.energy = Math.min(engine.player.maxEnergy, engine.player.energy + 30);
     engine.particles.emitCrystalCollect(this.x, this.y);
     engine.audio.sfx_crystalCollect();
  }
  draw(ctx) {
     ctx.fillStyle = this.color;
     engine.particles._drawStar(ctx, this.x+8, this.y+8, 6, 8, 4);
  }
}

class HealthPickup extends Collectible {
  constructor(x, y) { super(x, y, 16, 16); this.color = '#FF0000'; }
  onCollect(engine) {
     engine.player.hp = Math.min(engine.player.maxHp, engine.player.hp + 40);
     engine.audio.sfx_crystalCollect(); // reuse
  }
  draw(ctx) {
     ctx.fillStyle = this.color;
     ctx.fillRect(this.x+6, this.y, 4, 16);
     ctx.fillRect(this.x, this.y+6, 16, 4);
  }
}

// ================= ENEMIES ================= //
class Enemy extends Entity {
  constructor(x, y, w, h, hp, spd, dmg) {
     super(x, y, w, h);
     this.maxHp = this.hp = hp;
     this.speed = spd;
     this.dmg = dmg;
     this.state = 'PATROL';
     this.stateTimer = 0;
     this.playerDist = 9999;
  }
  update(dt, engine) {
     super.update(dt, engine);
     if(this.isDead) return;
     const p = engine.player;
     this.playerDist = Math.sqrt(Math.pow(this.x - p.x, 2) + Math.pow(this.y - p.y, 2));

     if(this.state === 'ALERT') {
       this.stateTimer -= dt;
       if(this.stateTimer <= 0) this.state = 'CHASE';
     }

     if(this.iframeTimer > 0 && Math.floor(this.iframeTimer*10)%2 === 0) return; // Flash
  }
  die(engine) {
     super.die(engine);
     engine.particles.emitEnemyDeath(this.x+this.width/2, this.y+this.height/2, this.color);
     engine.audio.sfx_enemyDeath();
     // Drop coins
     let amt = 3 + Math.floor(Math.random()*5);
     for(let i=0; i<amt; i++) engine.entities.push(new Coin(this.x, this.y));
  }
  drawObj(ctx) {} // Override
  draw(ctx) {
     if (this.iframeTimer > 0 && Math.floor(this.iframeTimer * 10) % 2 === 0) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(this.x, this.y, this.width, this.height);
        return;
     }

     this.drawObj(ctx);

     // health bar
     if(this.hp < this.maxHp) {
        ctx.fillStyle = '#000'; ctx.fillRect(this.x, this.y-10, this.width, 4);
        ctx.fillStyle = '#F00'; ctx.fillRect(this.x, this.y-10, this.width * (this.hp/this.maxHp), 4);
     }
     if(this.state === 'ALERT') {
        ctx.fillStyle = '#FF0'; ctx.font = '16px Arial'; ctx.fillText('!', this.x+this.width/2-4, this.y-15);
     }
  }
}

class DroneEnemy extends Enemy {
  constructor(x, y) {
     super(x, y, 20, 20, 30, 140, 10);
     this.isGravityImmune = true;
     this.color = '#555555';
     this.baseY = y; this.time = 0;
  }
  update(dt, engine) {
     super.update(dt, engine);
     if(this.isDead) return;
     
     let hpMod = engine.idd.enemyHpMod;
     let spdMod = engine.idd.enemySpeedMod;

     this.time += dt;
     if(this.state === 'PATROL') {
        this.x += Math.sin(this.time) * this.speed * spdMod * dt;
        this.y = this.baseY + Math.sin(this.time*2) * 20;
        if(this.playerDist < 180) { this.state = 'ALERT'; this.stateTimer = 0.5; engine.audio.sfx_enemyAlert(); }
     } else if (this.state === 'CHASE') {
        let dx = engine.player.x - this.x;
        let dy = engine.player.y - this.y;
        let dist = Math.sqrt(dx*dx+dy*dy);
        if(dist > 50) {
           this.x += (dx/dist) * this.speed * spdMod * dt;
           this.y += (dy/dist) * this.speed * spdMod * dt;
        } else {
           // Attack
           if(this.stateTimer <= 0) {
              this.stateTimer = 1.5;
              engine.spawnProjectile(false, this.x+10, this.y+10, (dx/dist)*300, (dy/dist)*300, this.dmg, 2.0, false);
           }
        }
        if(this.stateTimer > 0) this.stateTimer -= dt;
     }

     if(CollisionEngine.checkAABB(this, engine.player)) engine.player.takeDamage(10, Math.sign(engine.player.x-this.x), engine);
  }
  drawObj(ctx) {
     ctx.fillStyle = this.color;
     ctx.beginPath(); ctx.arc(this.x+10, this.y+10, 10, 0, Math.PI*2); ctx.fill();
     ctx.fillStyle = '#F00';
     ctx.beginPath(); ctx.arc(this.x+10, this.y+10, 3, 0, Math.PI*2); ctx.fill();
  }
}

class GuardEnemy extends Enemy {
  constructor(x, y) {
     super(x, y, 24, 44, 60, 90, 20);
     this.color = '#444455';
     this.walkDir = 1;
  }
  update(dt, engine) {
     super.update(dt, engine);
     if(this.state === 'PATROL') {
        this.vx = this.speed * this.walkDir * engine.idd.enemySpeedMod;
        if(this.touchingWall !== 0) this.walkDir *= -1;
        if(this.playerDist < 200) { this.state = 'ALERT'; this.stateTimer = 0.5; engine.audio.sfx_enemyAlert(); }
     } else if (this.state === 'CHASE') {
        let pDir = Math.sign(engine.player.x - this.x);
        if(this.playerDist > 140) {
           this.vx = this.speed * pDir * engine.idd.enemySpeedMod;
        } else {
           this.vx = 0;
           if(this.stateTimer <= 0) {
              this.stateTimer = 2.5;
              // Burst shot would be timed but simple 1 for now
              engine.spawnProjectile(false, this.x+12, this.y+20, pDir*320, 0, this.dmg, 2.0, false);
           }
        }
        if(this.stateTimer > 0) this.stateTimer -= dt;
     }
  }
  drawObj(ctx) {
     ctx.fillStyle = this.color;
     ctx.fillRect(this.x, this.y, this.width, this.height);
     // Helmet
     ctx.fillStyle = '#F00'; ctx.fillRect(this.x+4, this.y+4, this.width-8, 6);
  }
}

class HunterEnemy extends Enemy {
   constructor(x, y) {
      super(x, y, 20, 38, 45, 200, 30);
      this.color = '#222222';
      this.walkDir = 1;
   }
   update(dt, engine) {
      super.update(dt, engine);
      if(this.state === 'PATROL') {
         this.vx = this.speed * this.walkDir * engine.idd.enemySpeedMod;
         if(this.touchingWall !== 0) { this.walkDir *= -1; }
         if(this.playerDist < 250) { this.state = 'CHASE'; engine.audio.sfx_enemyAlert(); }
      } else if (this.state === 'CHASE') {
         let pDir = Math.sign(engine.player.x - this.x);
         this.vx = this.speed * pDir * engine.idd.enemySpeedMod;
         
         // Flip gravity to match player after some time
         if(this.gravityFlipped !== engine.player.gravityFlipped && Math.random() < 0.01) {
            this.gravityFlipped = engine.player.gravityFlipped;
         }

         if(CollisionEngine.checkAABB(this, engine.player)) {
            engine.player.takeDamage(this.dmg, pDir, engine);
            this.vx = -pDir * 200; // Bounce back
         }
      }
   }
   drawObj(ctx) {
      ctx.fillStyle = this.color;
      ctx.fillRect(this.x, this.y, this.width, this.height);
      ctx.fillStyle = '#FFF'; ctx.fillRect(this.x + (this.vx>0?14:2), this.y+8, 4, 2);
   }
}

class TurretEnemy extends Enemy {
   constructor(x, y) {
      super(x, y, 32, 20, 80, 0, 25);
      this.color = '#666';
   }
   update(dt, engine) {
      super.update(dt, engine);
      if(this.playerDist < 300) {
         if(this.stateTimer <= 0) {
            this.stateTimer = 1.8;
            let dx = engine.player.x - this.x;
            let dy = engine.player.y - this.y;
            let len = Math.sqrt(dx*dx+dy*dy);
            engine.spawnProjectile(false, this.x+16, this.y+10, (dx/len)*300, (dy/len)*300, this.dmg, 3.0, false);
         }
         else this.stateTimer -= dt;
      }
   }
   drawObj(ctx) {
      ctx.fillStyle = this.color;
      ctx.fillRect(this.x, this.y, this.width, this.height);
      ctx.fillStyle = '#F00'; ctx.beginPath(); ctx.arc(this.x+16, this.y+10, 4, 0, Math.PI*2); ctx.fill();
   }
}

class UpgradeTerminal extends Entity {
   constructor(x, y) { super(x, y, 32, 64); this.isGravityImmune = false;}
   update(dt, engine) {
      if(CollisionEngine.checkAABB_expanded(this, engine.player, 0)) {
         engine.triggerUpgradeMenu();
      }
   }
   draw(ctx) {
      ctx.fillStyle = '#114411'; ctx.fillRect(this.x, this.y, this.width, this.height);
      ctx.fillStyle = '#0F0'; ctx.fillRect(this.x+4, this.y+4, 24, 20);
      ctx.fillStyle = '#FFF'; ctx.font = '10px Arial'; ctx.fillText('UPG', this.x+6, this.y+18);
   }
}

// ================= BOSSES ================= //
class Boss extends Enemy {
   constructor(x, y, w, h, hp, name) {
      super(x, y, w, h, hp, 0, 20);
      this.name = name;
      this.phase = 1;
      this.isBoss = true;
   }
   takeDamage(amt, dir, engine){
      if(super.takeDamage(amt, dir, engine)) {
         if(this.hp <= this.maxHp*0.5 && this.phase === 1) {
            this.phase = 2;
         }
         return true;
      }
      return false;
   }
   die(engine) {
      super.die(engine);
      engine.particles.emitBossExplosion(this.x + this.width/2, this.y + this.height/2);
      // Spawn Boss Portal
      engine.world.setTile(Math.floor(this.x/CONSTANTS.TILE_SIZE), Math.floor(this.y/CONSTANTS.TILE_SIZE), 10);
      engine.entities.push(new Crystal(this.x, this.y));
      for(let i=0; i<15; i++) engine.entities.push(new Coin(this.x, this.y));
   }
}

class BossSentinel extends Boss {
  constructor(x, y) { super(x, y, 80, 120, 1000, "NEXUS SENTINEL"); this.timer = 0; }
  update(dt, engine) {
     super.update(dt, engine);
     this.timer += dt;
     if(this.timer > 3.0) {
        this.timer = 0;
        // Attack
        for(let i=0; i<5; i++){
           setTimeout(() => {
              if(this.isDead) return;
              engine.spawnProjectile(false, this.x, this.y+20 + (i*20), -400, 0, 20, 4.0, false);
           }, i * 200);
        }
     }
  }
  drawObj(ctx) { ctx.fillStyle = '#551111'; ctx.fillRect(this.x, this.y, this.width, this.height); }
}

class BossLeviathan extends Boss {
  constructor(x,y) { super(x,y, 200, 30, 1500, "GRAVITY LEVIATHAN"); this.isGravityImmune=true;}
  update(dt, engine) {
     super.update(dt, engine);
     // Simplified sinewave boss
     this.y += Math.sin(Date.now()/500) * 100 * dt;
     if(Math.random() < 0.01) {
        engine.spawnProjectile(false, this.x, this.y, -300, (engine.player.y - this.y), 25, 3.0, true);
     }
  }
  drawObj(ctx) { ctx.fillStyle = '#FF8800'; ctx.fillRect(this.x, this.y, this.width, this.height); }
}
class BossPhantom extends Boss {
  constructor(x,y) { super(x,y, 60, 60, 1200, "PHANTOM CORE"); this.isGravityImmune=true;}
  drawObj(ctx) { ctx.fillStyle = '#FFFFFF'; ctx.globalAlpha=0.7; ctx.fillRect(this.x, this.y, this.width, this.height); ctx.globalAlpha=1.0;}
}
class BossWarden extends Boss {
  constructor(x,y) { super(x,y, 100, 100, 1800, "WARDEN UNIT X"); this.isGravityImmune=true;}
  drawObj(ctx) { ctx.fillStyle = '#006600'; ctx.fillRect(this.x, this.y, this.width, this.height); }
}
class BossNexus7 extends Boss {
  constructor(x,y) { super(x,y, 100, 180, 2500, "NEXUS-7"); this.isGravityImmune=true;}
  drawObj(ctx) { ctx.fillStyle = '#000000'; ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth=2; ctx.fillRect(this.x, this.y, this.width, this.height); ctx.strokeRect(this.x, this.y, this.width, this.height); }
}
