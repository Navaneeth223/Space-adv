// ==========================================
// 02_inputAudio.js
// ==========================================

class InputManager {
  constructor() {
    this.keys = {};
    this.prevKeys = {};
    this.mouse = { x: 0, y: 0, left: false, prevLeft: false };

    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });

    const canvas = document.getElementById('gameCanvas');
    if(canvas) {
      canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        this.mouse.x = (e.clientX - rect.left) * scaleX;
        this.mouse.y = (e.clientY - rect.top) * scaleY;
      });
      canvas.addEventListener('mousedown', (e) => { if(e.button === 0) this.mouse.left = true; });
      canvas.addEventListener('mouseup', (e) => { if(e.button === 0) this.mouse.left = false; });
    }
  }

  update() {
    // Copy current state to prev state
    this.prevKeys = { ...this.keys };
    this.mouse.prevLeft = this.mouse.left;
  }

  isDown(code) { return !!this.keys[code]; }
  isJustPressed(code) { return !!this.keys[code] && !this.prevKeys[code]; }
  isJustReleased(code) { return !this.keys[code] && !!this.prevKeys[code]; }
  isMouseJustPressed() { return this.mouse.left && !this.mouse.prevLeft; }
}

class AudioEngine {
  constructor(saveData) {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.masterGain = this.ctx.createGain();
    this.musicGain = this.ctx.createGain();
    this.sfxGain = this.ctx.createGain();

    this.sfxGain.connect(this.masterGain);
    this.musicGain.connect(this.masterGain);
    this.masterGain.connect(this.ctx.destination);

    this.settings = saveData.settings;
    this.updateVolumes();

    this.activeSfx = [];
    this.MAX_SFX = 8;
    this.musicOscillators = [];
  }

  updateVolumes() {
    this.masterGain.gain.value = this.settings.masterVolume / 100;
    this.musicGain.gain.value = this.settings.musicEnabled ? (this.settings.musicVolume / 100) : 0;
    this.sfxGain.gain.value = this.settings.sfxEnabled ? (this.settings.sfxVolume / 100) : 0;
  }

  resume() {
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  _trackSfx(node) {
    this.activeSfx.push(node);
    if(this.activeSfx.length > this.MAX_SFX) {
      const oldest = this.activeSfx.shift();
      try { oldest.stop(); } catch(e){}
    }
    node.onended = () => {
      this.activeSfx = this.activeSfx.filter(n => n !== node);
    };
  }

  // --- SFX Functions ---
  sfx_gravityFlip() {
    if(!this.settings.sfxEnabled) return;
    const t = this.ctx.currentTime;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.frequency.setValueAtTime(180, t);
    osc1.frequency.linearRampToValueAtTime(440, t + 0.08);
    
    osc2.frequency.setValueAtTime(360, t);
    osc2.frequency.linearRampToValueAtTime(880, t + 0.08);
    osc2.type = 'sine';

    gain.gain.setValueAtTime(1.0, t);
    gain.gain.linearRampToValueAtTime(0.0, t + 0.2);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.sfxGain);

    osc1.start(t); osc1.stop(t + 0.2);
    osc2.start(t); osc2.stop(t + 0.2);
    this._trackSfx(osc1);
  }

  sfx_meleeSwing() {
    if(!this.settings.sfxEnabled) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 150;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.01, t);
    gain.gain.linearRampToValueAtTime(1.0, t + 0.005);
    gain.gain.linearRampToValueAtTime(0.0, t + 0.12);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 800;
    filter.Q.value = 2;

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    
    osc.start(t); osc.stop(t + 0.12);
    this._trackSfx(osc);
  }

  sfx_meleeHit() {
    if(!this.settings.sfxEnabled) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(100, t);
    osc.frequency.linearRampToValueAtTime(60, t + 0.08);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(1.0, t);
    gain.gain.linearRampToValueAtTime(0.0, t + 0.15);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 400;

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t); osc.stop(t + 0.15);
    this._trackSfx(osc);
  }

  sfx_voidBolt() {
    if(!this.settings.sfxEnabled) return;
    const t = this.ctx.currentTime;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.frequency.value = 440;
    osc2.frequency.value = 446;

    gain.gain.setValueAtTime(0.3, t);
    gain.gain.linearRampToValueAtTime(0.0, t + 0.2);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.sfxGain);

    osc1.start(t); osc1.stop(t + 0.2);
    osc2.start(t); osc2.stop(t + 0.2);
    this._trackSfx(osc1);
  }

  sfx_chargedBlastCharge(startFreq, targetFreq, duration) {
    if(!this.settings.sfxEnabled) return;
    duration = duration/1000;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.frequency.setValueAtTime(startFreq, t);
    osc.frequency.linearRampToValueAtTime(targetFreq, t + duration);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0, t);
    gain.gain.linearRampToValueAtTime(0.5, t + duration);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t); osc.stop(t + duration);
    return { osc, gain }; // So we can stop it early if needed
  }

  sfx_chargedBlastFire() {
    if(!this.settings.sfxEnabled) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.frequency.setValueAtTime(80, t);
    osc.frequency.linearRampToValueAtTime(40, t + 0.3);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(1.0, t);
    gain.gain.linearRampToValueAtTime(0.0, t + 0.3);
    
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t); osc.stop(t + 0.3);
    this._trackSfx(osc);
  }

  sfx_enemyAlert() {
    if(!this.settings.sfxEnabled) return;
    const t = this.ctx.currentTime;
    [0, 0.13].forEach(offset => {
      const osc = this.ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = 880;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.6, t + offset);
      gain.gain.linearRampToValueAtTime(0.0, t + offset + 0.03);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t + offset); osc.stop(t + offset + 0.03);
    });
  }

  sfx_enemyDeath() {
    if(!this.settings.sfxEnabled) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = 200;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.linearRampToValueAtTime(0.0, t + 0.2);
    
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 300;

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t); osc.stop(t + 0.2);
    this._trackSfx(osc);
  }

  sfx_playerHurt() {
    if(!this.settings.sfxEnabled) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, t);
    osc.frequency.linearRampToValueAtTime(120, t + 0.3);
    
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.7, t);
    gain.gain.linearRampToValueAtTime(0.0, t + 0.3);
    
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t); osc.stop(t + 0.3);
  }

  sfx_playerDeath() {
    if(!this.settings.sfxEnabled) return;
    const t = this.ctx.currentTime;
    const freqs = [400, 320, 250];
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.5, t);
    gain.gain.linearRampToValueAtTime(0.0, t + 1.0);
    
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 800;
    filter.connect(gain);
    gain.connect(this.sfxGain);

    freqs.forEach(f => {
      const osc = this.ctx.createOscillator();
      osc.frequency.setValueAtTime(f, t);
      osc.frequency.linearRampToValueAtTime(100, t + 0.8);
      osc.connect(filter);
      osc.start(t); osc.stop(t + 1.0);
      this._trackSfx(osc);
    });
  }

  sfx_coinCollect() {
    if(!this.settings.sfxEnabled) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.frequency.value = 523; // C5
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.linearRampToValueAtTime(0.0, t + 0.08);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t); osc.stop(t + 0.08);
  }

  sfx_crystalCollect() {
    if(!this.settings.sfxEnabled) return;
    const t = this.ctx.currentTime;
    const freqs = [330, 415, 494];
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.4, t);
    gain.gain.linearRampToValueAtTime(0.0, t + 0.4);
    gain.connect(this.sfxGain);

    freqs.forEach(f => {
      const osc = this.ctx.createOscillator();
      osc.frequency.value = f;
      osc.connect(gain);
      osc.start(t); osc.stop(t + 0.4);
    });
  }

  sfx_checkpoint() {
    if(!this.settings.sfxEnabled) return;
    const t = this.ctx.currentTime;
    const freqs = [262, 392];
    freqs.forEach((f, i) => {
      const osc = this.ctx.createOscillator();
      osc.frequency.value = f;
      const gain = this.ctx.createGain();
      const offset = i * 0.25;
      gain.gain.setValueAtTime(0.5, t + offset);
      gain.gain.linearRampToValueAtTime(0.0, t + offset + 0.2);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t + offset); osc.stop(t + offset + 0.2);
    });
  }

  sfx_gravityLocked() {
    if(!this.settings.sfxEnabled) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = 60;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.setValueAtTime(0.3, t + 0.5);
    gain.gain.linearRampToValueAtTime(0.0, t + 0.51);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t); osc.stop(t + 0.51);
  }

  sfx_bossIntro() {
    if(!this.settings.sfxEnabled) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.frequency.value = 40;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.7, t + 1.25);
    gain.gain.linearRampToValueAtTime(0, t + 2.5);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t); osc.stop(t + 2.5);
  }

  sfx_uiSelect() {
    if(!this.settings.sfxEnabled) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = 440;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.linearRampToValueAtTime(0, t + 0.06);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t); osc.stop(t + 0.06);
  }

  sfx_uiBack() {
    if(!this.settings.sfxEnabled) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = 330;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.linearRampToValueAtTime(0, t + 0.06);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t); osc.stop(t + 0.06);
  }

  // --- Procedural Music ---
  stopMusic() {
    this.musicOscillators.forEach(osc => {
      try {
        osc.gainNode.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 1.0);
        osc.osc.stop(this.ctx.currentTime + 1.1);
      } catch(e) {}
    });
    this.musicOscillators = [];
  }

  playMusicMenu() {
    this.stopMusic();
    if(!this.settings.musicEnabled) return;
    
    // Ambient drone
    const t = this.ctx.currentTime;
    
    const osc1 = this.ctx.createOscillator();
    osc1.frequency.value = 55; // A1
    const gain1 = this.ctx.createGain();
    gain1.gain.setValueAtTime(0, t);
    gain1.gain.linearRampToValueAtTime(0.1, t + 1.0);
    osc1.connect(gain1); gain1.connect(this.musicGain);

    const osc2 = this.ctx.createOscillator();
    osc2.frequency.value = 82; // E2
    const gain2 = this.ctx.createGain();
    gain2.gain.setValueAtTime(0, t);
    gain2.gain.linearRampToValueAtTime(0.07, t + 1.0);
    osc2.connect(gain2); gain2.connect(this.musicGain);

    // LFO on gain1
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.5;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 0.03;
    lfo.connect(lfoGain);
    lfoGain.connect(gain1.gain);

    osc1.start(t); osc2.start(t); lfo.start(t);
    this.musicOscillators.push({osc: osc1, gainNode: gain1}, {osc: osc2, gainNode: gain2}, {osc: lfo, gainNode: lfoGain});
  }

  playMusicGameplay(zoneId) {
    this.stopMusic();
    if(!this.settings.musicEnabled) return;
    
    const zones = [
      { base: 110, bpm: 120 }, // Z1
      { base:  98, bpm: 130 }, // Z2
      { base: 130, bpm:  90 }, // Z3
      { base: 146, bpm: 140 }, // Z4
      { base:  82, bpm: 150 }, // Z5
      { base:  82, bpm: 150 }  // Fallback
    ];
    const z = zones[zoneId - 1] || zones[0];

    const t = this.ctx.currentTime;
    
    const osc = this.ctx.createOscillator();
    osc.frequency.value = z.base;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.1, t + 1.0);
    
    // pulse LFO
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = z.bpm / 60; // hz
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 0.05;
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);

    osc.connect(gain); gain.connect(this.musicGain);
    osc.start(t); lfo.start(t);

    this.musicOscillators.push({osc, gainNode: gain}, {osc: lfo, gainNode: lfoGain});
  }
}
