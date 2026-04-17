// ==========================================
// 03_particles.js
// ==========================================

class Particle {
  constructor() {
    this.active = false;
    this.x = 0; this.y = 0;
    this.vx = 0; this.vy = 0;
    this.life = 0; this.maxLife = 1;
    this.size = 2;
    this.color = '#FFFFFF';
    this.alpha = 1.0;
    this.fadeRate = 1.0;
    this.gravity = 0;
    this.rotation = 0;
    this.rotationSpeed = 0;
    this.shape = 'circle';
  }
}

class ParticleSystem {
  constructor(saveData) {
    this.pool = Array.from({ length: 500 }, () => new Particle());
    this.quality = saveData.settings.particleQuality;
    this.multiplier = this.quality === 'HIGH' ? 1.0 : this.quality === 'MEDIUM' ? 0.6 : this.quality === 'LOW' ? 0.3 : 0;
    
    // Non-particle explosions
    this.rings = []; 
  }

  updateSettings(quality) {
    this.quality = quality;
    this.multiplier = this.quality === 'HIGH' ? 1.0 : this.quality === 'MEDIUM' ? 0.6 : this.quality === 'LOW' ? 0.3 : 0;
  }

  _getParticle() {
    return this.pool.find(p => !p.active);
  }

  update(dt, currentGravityFlipped) {
    for (let p of this.pool) {
      if (!p.active) continue;
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      
      const gravDir = currentGravityFlipped ? -1 : 1;
      p.vy += p.gravity * gravDir * dt;
      
      p.rotation += p.rotationSpeed * dt;
      p.alpha = Math.max(0, p.alpha - p.fadeRate * dt);
    }

    for (let i = this.rings.length - 1; i >= 0; i--) {
      let r = this.rings[i];
      r.life += dt;
      if (r.life >= r.maxLife) {
        this.rings.splice(i, 1);
      }
    }
  }

  draw(ctx, camera) {
    ctx.save();
    if(camera) ctx.translate(-camera.x, -camera.y);

    for (let p of this.pool) {
      if (!p.active) continue;
      
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.strokeStyle = p.color;
      
      if (p.shape === 'circle') {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.shape === 'square') {
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillRect(-p.size/2, -p.size/2, p.size, p.size);
        ctx.rotate(-p.rotation);
        ctx.translate(-p.x, -p.y);
      } else if (p.shape === 'line') {
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.05, p.y - p.vy * 0.05); // streaky
        ctx.lineWidth = p.size;
        ctx.stroke();
      } else if (p.shape === 'star') {
        this._drawStar(ctx, p.x, p.y, 6, p.size, p.size/2.5);
      }
    }

    for (let r of this.rings) {
      let progress = r.life / r.maxLife;
      let alpha = 1 - progress;
      let radius = r.maxRadius * progress;
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(r.x, r.y, radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  _drawStar(ctx, cx, cy, spikes, outerRadius, innerRadius) {
      let rot = Math.PI / 2 * 3;
      let x = cx, y = cy;
      let step = Math.PI / spikes;

      ctx.beginPath();
      ctx.moveTo(cx, cy - outerRadius)
      for (let i = 0; i < spikes; i++) {
          x = cx + Math.cos(rot) * outerRadius;
          y = cy + Math.sin(rot) * outerRadius;
          ctx.lineTo(x, y)
          rot += step
          x = cx + Math.cos(rot) * innerRadius;
          y = cy + Math.sin(rot) * innerRadius;
          ctx.lineTo(x, y)
          rot += step
      }
      ctx.lineTo(cx, cy - outerRadius);
      ctx.closePath();
      ctx.fill();
  }

  // --- Emitters ---

  emitGravityFlip(x, y, isFlippedNow) {
    if (this.multiplier === 0) return;
    let count = Math.floor(12 * this.multiplier);
    const color = isFlippedNow ? '#00FFFF' : '#AA00FF';
    
    for (let i = 0; i < count; i++) {
      let p = this._getParticle();
      if (!p) break;
      p.active = true; p.x = x; p.y = y;
      const angle = Math.random() * Math.PI * 2;
      const speed = 80 + Math.random() * 120;
      p.vx = Math.cos(angle) * speed; p.vy = Math.sin(angle) * speed;
      p.life = 0; p.maxLife = 0.4 + Math.random() * 0.2;
      p.size = 3 + Math.random() * 3;
      p.color = color; p.alpha = 1.0;
      p.fadeRate = 1 / p.maxLife; p.gravity = 0;
      p.shape = 'circle';
    }
  }

  emitMeleeSlash(x, y, direction, gravFlipped) {
    if (this.multiplier === 0) return;
    let count = Math.floor(8 * this.multiplier);
    const baseAngle = direction > 0 ? 0 : Math.PI;
    
    for(let i=0; i<count; i++) {
      let p = this._getParticle();
      if(!p) break;
      const angle = baseAngle - Math.PI/4 + Math.random() * Math.PI/2;
      const speed = 150 + Math.random() * 150;
      p.active = true; p.x = x; p.y = y;
      p.vx = Math.cos(angle) * speed; p.vy = Math.sin(angle) * speed;
      if (gravFlipped) p.vy *= -1; // roughly adjust to gravity aim
      p.life = 0; p.maxLife = 0.2 + Math.random()*0.1;
      p.size = 2 + Math.random() * 2;
      p.color = '#FFFFFF'; p.alpha = 1.0; p.fadeRate = 1/p.maxLife; p.gravity = 0;
      p.shape = 'line';
    }
  }

  emitBulletHit(x, y) {
    if (this.multiplier === 0) return;
    let count = Math.floor(6 * this.multiplier);
    for(let i=0; i<count; i++) {
      let p = this._getParticle();
      if(!p) break;
      p.active = true; p.x = x; p.y = y;
      const angle = Math.random() * Math.PI * 2;
      const speed = 50 + Math.random() * 70;
      p.vx = Math.cos(angle) * speed; p.vy = Math.sin(angle) * speed;
      p.life = 0; p.maxLife = 0.15 + Math.random()*0.1;
      p.size = 2 + Math.random() * 1;
      p.color = '#00FFFF'; p.alpha = 1.0; p.fadeRate = 1/p.maxLife; p.gravity = 0;
      p.shape = 'circle';
    }
  }

  emitEnemyDeath(x, y, enemyColor) {
    if (this.multiplier === 0) return;
    let count = Math.floor(20 * this.multiplier);
    for(let i=0; i<count; i++) {
      let p = this._getParticle();
      if(!p) break;
      p.active = true; p.x = x; p.y = y;
      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 190;
      p.vx = Math.cos(angle) * speed; p.vy = Math.sin(angle) * speed;
      p.life = 0; p.maxLife = 0.5 + Math.random()*0.3;
      p.size = 3 + Math.random() * 5;
      p.color = Math.random() > 0.3 ? enemyColor : '#FFA500';
      p.alpha = 1.0; p.fadeRate = 1/p.maxLife; p.gravity = 300;
      p.shape = Math.random() > 0.5 ? 'square' : 'circle';
      p.rotationSpeed = Math.random() * 10 - 5;
      p.rotation = 0;
    }
  }

  emitExplosion(x, y, radius, intensity) {
    if (this.multiplier === 0) return;
    let count = Math.min(30, Math.floor(intensity * 3 * this.multiplier));
    
    // Add ring
    this.rings.push({x, y, maxRadius: radius, color: '#FFFFFF', life: 0, maxLife: 0.4 });

    for(let i=0; i<count; i++) {
      let p = this._getParticle();
      if(!p) break;
      p.active = true; p.x = x; p.y = y;
      const angle = Math.random() * Math.PI * 2;
      const speed = (100 + Math.random() * 300) * intensity;
      p.vx = Math.cos(angle) * speed; p.vy = Math.sin(angle) * speed;
      p.life = 0; p.maxLife = 0.4 + Math.random()*0.5;
      p.size = 4 + Math.random() * 8;
      
      // We will fake the gradient by just picking random colors in the gradient
      const cChance = Math.random();
      p.color = cChance > 0.6 ? '#FFFFFF' : (cChance > 0.3 ? '#FFA500' : '#FF0000');
      
      p.alpha = 1.0; p.fadeRate = 1/p.maxLife; p.gravity = 0;
      p.shape = 'circle';
    }
  }

  emitGroundPound(x, y, gravFlipped) {
    if (this.multiplier === 0) return;
    let count = Math.floor(20 * this.multiplier);
    for(let i=0; i<count; i++) {
      let p = this._getParticle();
      if(!p) break;
      p.active = true; p.x = x; p.y = y;
      const angle = (Math.random() > 0.5 ? 0 : Math.PI) + (Math.random()*0.2 - 0.1);
      const speed = 80 + Math.random() * 120;
      p.vx = Math.cos(angle) * speed * (Math.random() > 0.5 ? 1 : -1);
      p.vy = (Math.random() - 0.5) * 50; 
      p.life = 0; p.maxLife = 0.3 + Math.random()*0.2;
      p.size = 2 + Math.random() * 3;
      p.color = '#EEEEEE'; p.alpha = 1.0; p.fadeRate = 1/p.maxLife; p.gravity = 0;
      p.shape = 'circle';
    }
  }

  emitDashTrail(x, y, facingDir) {
    if (this.multiplier === 0) return;
    let count = Math.floor(4 * this.multiplier);
    for(let i=0; i<count; i++) {
      let p = this._getParticle();
      if(!p) break;
      p.active = true; p.x = x; p.y = y;
      p.vx = (10 + Math.random()*20) * -facingDir; 
      p.vy = (Math.random()-0.5)*20;
      p.life = 0; p.maxLife = 0.15 + Math.random() * 0.05;
      p.size = 8 + Math.random() * 6;
      p.color = '#1a0a2a'; p.alpha = 0.4; p.fadeRate = 0.4/p.maxLife; p.gravity = 0;
      p.shape = 'circle';
    }
  }

  emitCoinCollect(x, y) {
    if (this.multiplier === 0) return;
    let count = Math.floor(6 * this.multiplier);
    for(let i=0; i<count; i++) {
      let p = this._getParticle();
      if(!p) break;
      p.active = true; p.x = x; p.y = y;
      p.vx = (Math.random()-0.5)*100;
      p.vy = -60 - Math.random() * 60; // Upward burst
      p.life = 0; p.maxLife = 0.3 + Math.random()*0.2;
      p.size = 2 + Math.random() * 2;
      p.color = '#FFD700'; p.alpha = 1.0; p.fadeRate = 1/p.maxLife; p.gravity = 400; // Fake some normal gravity for falling
      p.shape = 'circle';
    }
  }

  emitCrystalCollect(x, y) {
    if (this.multiplier === 0) return;
    let count = Math.floor(10 * this.multiplier);
    for(let i=0; i<count; i++) {
      let p = this._getParticle();
      if(!p) break;
      p.active = true; p.x = x; p.y = y;
      p.vx = (Math.random()-0.5)*100;
      p.vy = -40 - Math.random() * 60;
      p.life = 0; p.maxLife = 0.5 + Math.random()*0.2;
      p.size = 2 + Math.random() * 3;
      p.color = '#00FFFF'; p.alpha = 1.0; p.fadeRate = 1/p.maxLife; p.gravity = 0;
      p.shape = 'star';
      p.rotationSpeed = Math.random() * 5;
    }
  }

  emitAmbient(zoneId, camera) {
    if (this.multiplier === 0) return;
    // Emit 0-2 particles per frame
    if(Math.random() > 0.1 * this.multiplier) return;

    let p = this._getParticle();
    if(!p) return;

    // Spawn randomly in camera view
    p.active = true; 
    p.x = camera.x + Math.random() * CONSTANTS.WIDTH;
    p.y = camera.y + Math.random() * CONSTANTS.HEIGHT;

    p.alpha = 1.0;
    p.rotation = 0; p.rotationSpeed = 0;

    switch(zoneId) {
      case 1:
        p.vx = (Math.random()-0.5)*10; p.vy = -10 - Math.random()*20;
        p.life = 0; p.maxLife = 2 + Math.random()*2;
        p.size = 1; p.color = '#FFFFFF'; p.fadeRate = 1/p.maxLife; p.gravity = 0; p.shape='circle';
        p.alpha = 0.05; p.fadeRate = 0.05/p.maxLife;
        break;
      case 2:
        p.vx = (Math.random()-0.5)*20; p.vy = -30 - Math.random()*40;
        p.life = 0; p.maxLife = 1 + Math.random()*2;
        p.size = 2; p.color = '#FFA500'; p.fadeRate = 1/p.maxLife; p.gravity = -200; p.shape='square';
        break;
      case 3:
        p.vx = 20 + Math.random()*30; p.vy = 20 + Math.random()*30;
        p.life = 0; p.maxLife = 2 + Math.random()*3;
        p.size = 1 + Math.random()*2; p.color = '#FFFFFF'; p.fadeRate = 1/p.maxLife; p.gravity = 0; p.shape='circle';
        break;
      case 4:
        p.vx = -100 - Math.random()*100; p.vy = 0;
        p.life = 0; p.maxLife = 1 + Math.random()*1;
        p.size = 1; p.color = '#00FF00'; p.fadeRate = 1/p.maxLife; p.gravity = 0; p.shape='square';
        break;
      case 5:
        p.vx = (Math.random()-0.5)*50; p.vy = (Math.random()-0.5)*50;
        p.life = 0; p.maxLife = 2 + Math.random()*2;
        p.size = 1 + Math.random(); p.color = '#AA0000'; p.fadeRate = 1/p.maxLife; p.gravity = 0; p.shape='circle';
        break;
      default:
        p.active = false;
    }
  }

  // Effect specifically for boss defeat
  emitBossExplosion(x, y) {
    if (this.multiplier === 0) return;
    this.emitExplosion(x, y, 150, 4.0);
    this.emitEnemyDeath(x, y, '#FF0000');
  }
}
