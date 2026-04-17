// ==========================================
// 07_zonesAndTiles.js
// ==========================================

// Map generator helper - since hand-crafting 5 arrays of 80x22 is very large,
// we will programmatically construct sensible layouts that meet the prompt's structural demands.
class World {
  constructor() {
    this.width = 160; 
    this.height = 22;
    this.tiles = [];
    this.zoneId = 1;
    this.activeBoss = null;
    this.collectibles = [];
  }

  getZoneName() {
    switch(this.zoneId) {
      case 1: return "DOCKING BAY OMEGA";
      case 2: return "REACTOR CORE";
      case 3: return "CRYOGENIC VAULTS";
      case 4: return "NEURAL NETWORK";
      case 5: return "NEXUS-7 THRONE";
      default: return "UNKNOWN";
    }
  }

  loadZone(zoneId, engine) {
    this.zoneId = zoneId;
    this.tiles = [];
    this.collectibles = [];
    this.activeBoss = null;
    
    // Clear entities
    engine.entities = [];

    // Basic map generation layout (80x22 or 160x22 for more space)
    for (let y = 0; y < this.height; y++) {
      let row = [];
      for (let x = 0; x < this.width; x++) {
        row.push(0); 
      }
      this.tiles.push(row);
    }

    // Build floor and ceiling bounds
    for (let x = 0; x < this.width; x++) {
      this.tiles[0][x] = 1;
      this.tiles[this.height - 1][x] = 1;
    }
    for (let y = 0; y < this.height; y++) {
      this.tiles[y][0] = 1;
      this.tiles[y][this.width - 1] = 1;
    }

    this._generatePlatformsAndHazards();
    this._spawnEntities(engine);

    // Force Boss Room (Starts at x=130)
    for(let y=1; y<this.height-1; y++){
       this.tiles[y][125] = 1; // Boss door
    }
    // Boss room 
    const bossType = ['Sentinel', 'Leviathan', 'Phantom', 'Warden', 'Nexus7'][this.zoneId-1];
    
    // Zone 1 exit portal logic is tied to boss death, handled in boss class

    engine.renderer.cacheMap(this);
  }

  getTile(x, y) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return 1; // out of bounds is solid
    return this.tiles[y][x];
  }

  setTile(x, y, v) {
    if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
      this.tiles[y][x] = v;
    }
  }

  breakTiles(rect) {
    const ts = CONSTANTS.TILE_SIZE;
    const startX = Math.floor(rect.x / ts);
    const endX = Math.floor((rect.x + rect.width) / ts);
    const startY = Math.floor(rect.y / ts);
    const endY = Math.floor((rect.y + rect.height) / ts);
    
    let broken = false;
    for (let y = startY; y <= endY; y++) {
      for (let x = startX; x <= endX; x++) {
        if (this.getTile(x, y) === 8) { // destructible
          this.setTile(x, y, 0); // break
          window.gameEngine.particles.emitExplosion(x*ts+16, y*ts+16, 16, 0.5);
          broken = true;
        }
      }
    }
    if(broken) window.gameEngine.renderer.cacheMap(this); // recache
  }

  _generatePlatformsAndHazards() {
    // Generate different architectural styles based on zoneId
    const ts = CONSTANTS.TILE_SIZE;
    
    if (this.zoneId === 1) {
      // Zone 1: Docking Bay - Wide open platforms, easy introductory level
      for (let i = 10; i < 110; i += 15) {
         let width = 6 + Math.floor(Math.random() * 5);
         let py = 15 - Math.floor(Math.random() * 4);
         for(let x=i; x<i+width; x++) {
            this.setTile(x, py, 1);
            if(Math.random() > 0.8) this.setTile(x, py-1, 2); // Occasional spike
         }
         // Add some mid-air platforms
         let midWidth = 4 + Math.floor(Math.random() * 3);
         let midY = 8 + Math.floor(Math.random() * 4);
         for(let x=i; x<i+midWidth; x++) {
            this.setTile(x + 5, midY, 7); // One-way platforms
         }
      }
    } 
    else if (this.zoneId === 2) {
      // Zone 2: Reactor Core - Hazardous bottom, lots of jumping required
      
      // Bottom layer is mostly energy drain or spikes, requiring high ground/gravity usage
      for(let x=10; x<120; x++) {
         if(Math.random() > 0.3 && this.getTile(x, 20) === 0) {
            this.setTile(x, 20, 2); // Spikes on floor
         }
      }

      for (let i = 10; i < 115; i += 10) {
         let w = 2 + Math.floor(Math.random()*3); // Narrow platforms
         let py = 12 + Math.floor(Math.random()*6); // Random altitudes
         for(let x=i; x<i+w; x++) {
            this.setTile(x, py, 1);
         }
         // High ceiling platforms
         let cw = 3 + Math.floor(Math.random()*3);
         let cy = 4 + Math.floor(Math.random()*4);
         for(let x=i+4; x<i+4+cw; x++) {
            this.setTile(x, cy, 1);
            // Spikes on bottom of high platforms
            if(Math.random() > 0.5) this.setTile(x, cy+1, 3);
         }
      }
    } 
    else if (this.zoneId === 3) {
      // Zone 3: Cryo Vaults - Enclosed ice corridors
      for (let i = 10; i < 110; i += 20) {
         // Create tunnel/corridor walls
         for(let y=4; y<18; y++) {
            if(y > 7 && y < 14) continue; // Gap
            this.setTile(i, y, 5); // Ice wall
         }
         
         // Inner platforms
         for(let x=i+4; x<i+16; x++) {
            if (x % 3 === 0) continue; // break up the floors
            this.setTile(x, 7, 5); // Ice floor top
            this.setTile(x, 14, 5); // Ice floor bottom
         }

         // Add some breakable shortcuts
         this.setTile(i, 10, 8);
         this.setTile(i, 11, 8);
      }
    }
    else if (this.zoneId === 4) {
      // Zone 4: Neural Network - Vertical pillars and data bridges
      for (let i = 20; i < 120; i += 12) {
         let isPillar = Math.random() > 0.5;
         if (isPillar) {
            let gapY = 8 + Math.floor(Math.random() * 6);
            for(let y=1; y<21; y++) {
               if(y > gapY && y < gapY + 5) continue; // Gap to pass through
               this.setTile(i, y, 1);
               this.setTile(i+1, y, 1); // 2-wide pillar
               
               // Data hazards
               if(y === gapY || y === gapY+5) {
                 this.setTile(i, gapY, 3); // Down spike
                 this.setTile(i, gapY+5, 2); // Up spike
               }
            }
         } else {
            // Bridges
            let py = 4 + Math.floor(Math.random() * 12);
            for(let x=i-5; x<i+8; x++) {
               this.setTile(x, py, 7); // Data bridges
            }
         }
      }
    }
    else {
      // Zone 5: NEXUS Throne - Chaos and symmetry
      for (let i = 15; i < 120; i += 25) {
         // Create diamond shapes
         let cy = 10;
         for(let o=0; o<5; o++) {
            this.setTile(i + o, cy + o, 1);
            this.setTile(i + o, cy - o, 1);
            this.setTile(i - o, cy + o, 1);
            this.setTile(i - o, cy - o, 1);
         }
         // Floaters
         for(let x=i+10; x<i+15; x++) {
            this.setTile(x, 5, 8); // Breakable
            this.setTile(x, 15, 8); 
         }
      }
    }
    
    // Checkpoints (Always valid ground)
    this.setTile(60, this.height-2, 9);
    this.setTile(120, this.height-2, 9);
  }

  _spawnEntities(engine) {
     engine.entities.push(new UpgradeTerminal(15 * CONSTANTS.TILE_SIZE, (this.height-2)*CONSTANTS.TILE_SIZE - 40));

     for(let i=0; i<15; i++) {
        let px = 20 + Math.floor(Math.random() * 100);
        let py = 5 + Math.floor(Math.random() * 12);
        
        // Find ground
        while(this.getTile(px, py) === 0 && py < this.height-2) py++;
        
        let type = Math.random();
        if(type < 0.3) engine.entities.push(new DroneEnemy(px*CONSTANTS.TILE_SIZE, (py-3)*CONSTANTS.TILE_SIZE));
        else if (type < 0.6) engine.entities.push(new GuardEnemy(px*CONSTANTS.TILE_SIZE, (py)*CONSTANTS.TILE_SIZE - 44));
        else if (type < 0.8) engine.entities.push(new HunterEnemy(px*CONSTANTS.TILE_SIZE, (py)*CONSTANTS.TILE_SIZE - 38));
        else engine.entities.push(new TurretEnemy(px*CONSTANTS.TILE_SIZE, (py)*CONSTANTS.TILE_SIZE - 20));
     }

     for(let i=0; i<30; i++) {
        let px = 10 + Math.floor(Math.random() * 110);
        let py = 2 + Math.floor(Math.random() * 16);
        engine.entities.push(new Coin(px*CONSTANTS.TILE_SIZE, py*CONSTANTS.TILE_SIZE));
     }

     for(let i=0; i<2; i++) {
       let px = 50 + Math.floor(Math.random() * 70);
       let py = 2 + Math.floor(Math.random() * 16);
       engine.entities.push(new Crystal(px*CONSTANTS.TILE_SIZE, py*CONSTANTS.TILE_SIZE));
     }

     for(let i=0; i<3; i++) {
       let px = 40 + Math.floor(Math.random() * 80);
       let py = 2 + Math.floor(Math.random() * 16);
       engine.entities.push(new HealthPickup(px*CONSTANTS.TILE_SIZE, py*CONSTANTS.TILE_SIZE));
     }

     // Spawn Boss
     if(this.zoneId === 1) this.activeBoss = new BossSentinel(140 * CONSTANTS.TILE_SIZE, (this.height-2)*CONSTANTS.TILE_SIZE - 120);
     if(this.zoneId === 2) this.activeBoss = new BossLeviathan(140 * CONSTANTS.TILE_SIZE, (this.height/2)*CONSTANTS.TILE_SIZE);
     if(this.zoneId === 3) this.activeBoss = new BossPhantom(140 * CONSTANTS.TILE_SIZE, (this.height/2)*CONSTANTS.TILE_SIZE);
     if(this.zoneId === 4) this.activeBoss = new BossWarden(140 * CONSTANTS.TILE_SIZE, (this.height/2)*CONSTANTS.TILE_SIZE);
     if(this.zoneId === 5) this.activeBoss = new BossNexus7(140 * CONSTANTS.TILE_SIZE, (this.height-2)*CONSTANTS.TILE_SIZE - 180);
     
     if (this.activeBoss) engine.entities.push(this.activeBoss);
  }

  drawStaticTiles(ctx) {
     const ts = CONSTANTS.TILE_SIZE;
     const colors = this._getZoneColors();

     for (let y = 0; y < this.height; y++) {
        for (let x = 0; x < this.width; x++) {
           let t = this.tiles[y][x];
           if (t === 0) continue;
           
           if (t === 1) { // Solid
              ctx.fillStyle = colors.mainTile;
              ctx.fillRect(x*ts, y*ts, ts, ts);
              ctx.strokeStyle = colors.accentTile;
              ctx.strokeRect(x*ts, y*ts, ts, ts);
           } else if (t === 5) { // Ice
              ctx.fillStyle = 'rgba(200, 255, 255, 0.7)';
              ctx.fillRect(x*ts, y*ts, ts, ts);
           } else if (t === 7) { // One Way
              ctx.fillStyle = colors.mainTile;
              ctx.fillRect(x*ts, y*ts, ts, ts/3);
           } else if (t === 8) { // Destructible
              ctx.fillStyle = '#555555';
              ctx.fillRect(x*ts, y*ts, ts, ts);
              ctx.strokeStyle = '#222222';
              ctx.beginPath(); ctx.moveTo(x*ts, y*ts); ctx.lineTo(x*ts+ts, y*ts+ts); ctx.stroke();
           } else if (t === 9) { // Checkpoint
              ctx.fillStyle = '#00AA00';
              ctx.beginPath(); ctx.arc(x*ts+16, y*ts+16, 12, 0, Math.PI*2); ctx.fill();
           }
        }
     }
  }

  drawDynamicTiles(ctx) {
     const ts = CONSTANTS.TILE_SIZE;
     // Draw spikes and damage areas separate since they might be grouped or glowing
     for (let y = 0; y < this.height; y++) {
        for (let x = 0; x < this.width; x++) {
           let t = this.tiles[y][x];
           if(t === 2) { // Spike up
              ctx.fillStyle = '#FF0000';
              ctx.beginPath();
              ctx.moveTo(x*ts, y*ts+ts); ctx.lineTo(x*ts+ts/2, y*ts); ctx.lineTo(x*ts+ts, y*ts+ts); ctx.fill();
           } else if(t === 3) { // Spike down
              ctx.fillStyle = '#FF0000';
              ctx.beginPath();
              ctx.moveTo(x*ts, y*ts); ctx.lineTo(x*ts+ts/2, y*ts+ts); ctx.lineTo(x*ts+ts, y*ts); ctx.fill();
           } else if (t === 10) { // Portal
              ctx.strokeStyle = '#00FFFF';
              ctx.lineWidth = 4;
              ctx.beginPath(); ctx.arc(x*ts+16, y*ts+16, 32 + Math.sin(Date.now()/200)*8, 0, Math.PI*2); ctx.stroke();
           }
        }
     }
  }

  drawFlatBackground(ctx) {
     ctx.fillStyle = this._getZoneColors().bg;
     ctx.fillRect(0,0,CONSTANTS.WIDTH,CONSTANTS.HEIGHT);
  }

  drawBackground(ctx, camera) {
     const colors = this._getZoneColors();
     ctx.fillStyle = colors.bg;
     ctx.fillRect(0, 0, CONSTANTS.WIDTH, CONSTANTS.HEIGHT);

     if(this.zoneId === 1) {
        ctx.fillStyle = '#223344';
        let offset = -(camera.x * 0.2) % 200;
        for(let i=0; i<10; i++) {
           ctx.fillRect(offset + i*200, 100, 50, CONSTANTS.HEIGHT);
        }
     } else if (this.zoneId === 2) {
        ctx.fillStyle = '#441100';
        let offset = -(camera.x * 0.4) % 300;
        for(let i=0; i<10; i++) {
           ctx.beginPath(); ctx.arc(offset + i*300, CONSTANTS.HEIGHT, 200, 0, Math.PI); ctx.fill();
        }
     }
     // Apply generic parallax blocks
     ctx.fillStyle = 'rgba(0,0,0,0.3)';
     let pOffset = -(camera.x * 0.5) % 400;
     for(let i=-1; i<5; i++) {
        ctx.fillRect(pOffset + i*400, 300, 150, 400);
     }
  }

  _getZoneColors() {
     switch(this.zoneId) {
        case 1: return { mainTile: '#2A2A35', accentTile: '#00FFFF', bg: '#0A0A15' };
        case 2: return { mainTile: '#331100', accentTile: '#FF4400', bg: '#1A0500' };
        case 3: return { mainTile: '#DDFFFF', accentTile: '#00AAAA', bg: '#001A22' };
        case 4: return { mainTile: '#110022', accentTile: '#00FF00', bg: '#050011' };
        case 5: return { mainTile: '#111111', accentTile: '#FF0000', bg: '#000000' };
        default: return { mainTile: '#555555', accentTile: '#FFFFFF', bg: '#000000' };
     }
  }
}
