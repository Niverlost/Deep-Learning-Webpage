/** ==================== 字母小人系统（Duolingo 风格完整交互） ==================== */

// 兼容辅助：safeSetItem（如果全局不存在则提供默认实现）
if (typeof safeSetItem !== 'function') {
  window.safeSetItem = function safeSetItem(key, value) {
    try { localStorage.setItem(key, value); } catch(e) { console.warn('localStorage full:', e); }
  };
}

// 兼容辅助：applyHolidayDecorations（如果全局不存在则提供空实现）
if (typeof applyHolidayDecorations !== 'function') {
  window.applyHolidayDecorations = function applyHolidayDecorations(stage) {
    // 节日装饰：空实现，可在需要时扩展
  };
}

// I10创新：个性化记忆系统
const LetterMemory = {
  _key: 'dl_letter_memory',
  _visitKey: 'dl_visit_count',

  getData() {
    try {
      return JSON.parse(localStorage.getItem(this._key) || '{}');
    } catch (e) { return {}; }
  },

  saveData(data) {
    try { safeSetItem(this._key, JSON.stringify(data)); } catch (e) {}
  },

  recordClick(letter) {
    const data = this.getData();
    data[letter] = (data[letter] || 0) + 1;
    this.saveData(data);
  },

  getFavoriteLetter() {
    const data = this.getData();
    let max = 0, fav = null;
    for (const [k, v] of Object.entries(data)) {
      if (v > max) { max = v; fav = k; }
    }
    return fav;
  },

  getVisitCount() {
    return parseInt(localStorage.getItem(this._visitKey) || '0', 10);
  },

  incrementVisit() {
    const count = this.getVisitCount() + 1;
    localStorage.setItem(this._visitKey, String(count));
    return count;
  },

  shouldCelebrate() {
    return this.getVisitCount() > 0 && this.getVisitCount() % 5 === 0;
  }
};

// I20创新：声音反馈预留接口（默认静音）
const SoundEngine = {
  enabled: false,
  audioCtx: null,

  init() {
    try {
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      console.warn('Web Audio API not supported');
    }
  },

  // 播放合成音效
  play(type) {
    if (!this.enabled || !this.audioCtx) return;
    if (this.audioCtx.state === 'suspended') this.audioCtx.resume();

    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    osc.connect(gain);
    gain.connect(this.audioCtx.destination);

    switch (type) {
      case 'hover':
        osc.frequency.value = 440;
        osc.type = 'sine';
        gain.gain.value = 0.05;
        osc.start();
        osc.stop(this.audioCtx.currentTime + 0.1);
        break;
      case 'click':
        osc.frequency.value = 523;
        osc.type = 'sine';
        gain.gain.value = 0.08;
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.2);
        osc.stop(this.audioCtx.currentTime + 0.2);
        break;
      case 'scared':
        osc.frequency.value = 200;
        osc.type = 'sawtooth';
        gain.gain.value = 0.06;
        osc.start();
        osc.frequency.exponentialRampToValueAtTime(100, this.audioCtx.currentTime + 0.3);
        gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.3);
        osc.stop(this.audioCtx.currentTime + 0.3);
        break;
      case 'celebrate':
        // 播放两个音符
        osc.frequency.value = 523;
        osc.type = 'sine';
        gain.gain.value = 0.06;
        osc.start();
        osc.stop(this.audioCtx.currentTime + 0.15);
        const osc2 = this.audioCtx.createOscillator();
        const gain2 = this.audioCtx.createGain();
        osc2.connect(gain2);
        gain2.connect(this.audioCtx.destination);
        osc2.frequency.value = 659;
        osc2.type = 'sine';
        gain2.gain.value = 0.06;
        osc2.start(this.audioCtx.currentTime + 0.15);
        osc2.stop(this.audioCtx.currentTime + 0.3);
        break;
    }
  },

  toggle() {
    this.enabled = !this.enabled;
    if (this.enabled && !this.audioCtx) this.init();
    return this.enabled;
  }
};

// S9创新：截图分享功能
const ShareScreenshot = {
  // 触发特殊姿势排列
  triggerPose(stage) {
    const chars = stage.querySelectorAll('.letter-char');
    chars.forEach((el, i) => {
      el.style.transition = 'transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)';
      setTimeout(() => {
        // 波浪排列
        const yOffset = Math.sin(i * 0.8) * 15;
        const rotation = Math.sin(i * 0.6) * 5;
        el.style.transform = `translateY(${yOffset}px) rotate(${rotation}deg)`;
      }, i * 60);
    });

    // 3秒后恢复
    setTimeout(() => {
      chars.forEach(el => {
        el.style.transform = '';
        setTimeout(() => { el.style.transition = ''; }, 500);
      });
    }, 3000);
  }
};

// S8创新：字母自定义系统
const LetterCustomization = {
  STORAGE_KEY: 'letter-customizations',

  // 获取自定义配置
  getCustomizations() {
    try {
      return JSON.parse(localStorage.getItem(this.STORAGE_KEY)) || {};
    } catch (e) { return {}; }
  },

  // 保存自定义配置
  saveCustomizations(customizations) {
    safeSetItem(this.STORAGE_KEY, JSON.stringify(customizations));
  },

  // 自定义单个字母颜色
  setLetterColor(letterKey, color) {
    const customs = this.getCustomizations();
    if (!customs[letterKey]) customs[letterKey] = {};
    customs[letterKey].color = color;
    this.saveCustomizations(customs);
  },

  // 应用自定义配置到字母元素
  applyCustomizations(stage) {
    const customs = this.getCustomizations();
    const chars = stage.querySelectorAll('.letter-char');
    chars.forEach(el => {
      const key = el.getAttribute('data-letter');
      if (customs[key]) {
        if (customs[key].color) {
          el.querySelector('.letter-text').style.color = customs[key].color;
        }
        if (customs[key].accessory) {
          const accessory = document.createElement('div');
          accessory.className = 'custom-accessory';
          accessory.textContent = customs[key].accessory;
          el.appendChild(accessory);
        }
      }
    });
  }
};

// I7创新：连续点击5次触发合唱
const ClickChorus = {
  sequence: [],
  timeout: null,
  resetDelay: 2000,

  record(char) {
    this.sequence.push(char);
    if (this.sequence.length >= 5) {
      this.triggerChorus();
      this.sequence = [];
    }
    if (this.timeout) clearTimeout(this.timeout);
    this.timeout = setTimeout(() => { this.sequence = []; }, this.resetDelay);
  },

  triggerChorus() {
    const stage = document.getElementById('letterStage');
    if (!stage) return;
    const chars = stage.querySelectorAll('.letter-char');
    chars.forEach((el, i) => {
      setTimeout(() => {
        el.classList.add('chorus-singing');
        const rect = el.getBoundingClientRect();
        ParticleEngine.emit({
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
          count: 2, type: 'note', color: 'rgba(255,200,50,0.9)',
          size: 6, speed: 3, spread: Math.PI, angle: -Math.PI / 2,
          gravity: -0.03, life: 40
        });
        setTimeout(() => el.classList.remove('chorus-singing'), 800);
      }, i * 50);
    });
  }
};

// S1创新：通用粒子系统引擎
const ParticleEngine = {
  particles: [],
  canvas: null,
  ctx: null,
  isRunning: false,

  // 初始化Canvas层
  init() {
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'particle-canvas';
    this.canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:100;';
    document.body.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this.resize();
    this._resizeHandler = () => this.resize();
    window.addEventListener('resize', this._resizeHandler);
  },

  // 调整Canvas尺寸
  resize() {
    if (!this.canvas) return;
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  },

  // 粒子类型配置
  types: {
    circle: { draw: (ctx, p) => { ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill(); } },
    star: { draw: (ctx, p) => { ParticleEngine.drawStar(ctx, p.x, p.y, 5, p.size, p.size / 2); } },
    heart: { draw: (ctx, p) => { ParticleEngine.drawHeart(ctx, p.x, p.y, p.size); } },
    note: { symbol: true, symbols: ['♪', '♫', '♬', '♩'] },
    spark: { draw: (ctx, p) => { ctx.beginPath(); ctx.moveTo(p.x - p.size, p.y); ctx.lineTo(p.x + p.size, p.y); ctx.moveTo(p.x, p.y - p.size); ctx.lineTo(p.x, p.y + p.size); ctx.stroke(); } },
    snow: { draw: (ctx, p) => { ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill(); } },
    confetti: { draw: (ctx, p) => { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rotation); ctx.fillRect(-p.size, -p.size / 2, p.size * 2, p.size); ctx.restore(); } }
  },

  // 绘制星形
  drawStar(ctx, cx, cy, spikes, outerR, innerR) {
    let rot = Math.PI / 2 * 3;
    const step = Math.PI / spikes;
    ctx.beginPath();
    ctx.moveTo(cx, cy - outerR);
    for (let i = 0; i < spikes; i++) {
      ctx.lineTo(cx + Math.cos(rot) * outerR, cy + Math.sin(rot) * outerR);
      rot += step;
      ctx.lineTo(cx + Math.cos(rot) * innerR, cy + Math.sin(rot) * innerR);
      rot += step;
    }
    ctx.closePath();
    ctx.fill();
  },

  // 绘制心形
  drawHeart(ctx, cx, cy, size) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.beginPath();
    ctx.moveTo(0, size * 0.3);
    ctx.bezierCurveTo(-size, -size * 0.3, -size * 0.5, -size, 0, -size * 0.5);
    ctx.bezierCurveTo(size * 0.5, -size, size, -size * 0.3, 0, size * 0.3);
    ctx.fill();
    ctx.restore();
  },

  // 发射粒子
  emit(config) {
    if (!this.canvas) this.init();

    const {
      x, y,                    // 发射位置
      count = 5,               // 数量
      type = 'circle',         // 粒子类型
      color = 'rgba(255,255,255,0.8)',  // 颜色
      size = 4,                // 大小
      sizeVariation = 2,       // 大小随机范围
      speed = 3,               // 速度
      speedVariation = 2,      // 速度随机范围
      angle = 0,               // 发射角度（弧度）
      spread = Math.PI * 2,    // 扩散角度
      gravity = 0.1,           // 重力
      friction = 0.98,         // 摩擦力
      life = 60,               // 生命周期（帧数）
      lifeVariation = 20,      // 生命周期随机范围
      rotationSpeed = 0,       // 旋转速度（confetti用）
      fadeOut = true           // 是否淡出
    } = config;

    for (let i = 0; i < count; i++) {
      const a = angle - spread / 2 + Math.random() * spread;
      const s = speed + (Math.random() - 0.5) * speedVariation * 2;
      const l = life + (Math.random() - 0.5) * lifeVariation * 2;
      const sz = Math.max(1, size + (Math.random() - 0.5) * sizeVariation * 2);

      this.particles.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        size: sz,
        color,
        type,
        life: Math.max(10, l),
        maxLife: Math.max(10, l),
        gravity,
        friction,
        rotation: 0,
        rotationSpeed: rotationSpeed * (Math.random() - 0.5) * 2,
        fadeOut,
        symbol: this.types[type]?.symbol ? this.types[type].symbols[Math.floor(Math.random() * this.types[type].symbols.length)] : null
      });
    }

    if (!this.isRunning) {
      this.isRunning = true;
      this.animate();
    }
  },

  // 动画循环
  animate() {
    if (!this.ctx) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];

      // 物理更新
      p.vy += p.gravity;
      p.vx *= p.friction;
      p.vy *= p.friction;
      p.x += p.vx;
      p.y += p.vy;
      p.rotation += p.rotationSpeed;
      p.life--;

      // 计算透明度
      const alpha = p.fadeOut ? Math.max(0, p.life / p.maxLife) : 1;

      // 绘制
      this.ctx.save();
      this.ctx.globalAlpha = alpha;
      this.ctx.fillStyle = p.color;
      this.ctx.strokeStyle = p.color;
      this.ctx.lineWidth = 2;

      if (p.symbol) {
        // 符号类型粒子
        this.ctx.font = `${p.size * 3}px sans-serif`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(p.symbol, p.x, p.y);
      } else if (this.types[p.type]?.draw) {
        // 自定义绘制
        this.types[p.type].draw(this.ctx, p);
      }

      this.ctx.restore();

      // 移除死亡粒子（swap-and-pop，O(1)）
      if (p.life <= 0) {
        this.particles[i] = this.particles[this.particles.length - 1];
        this.particles.pop();
      }
    }

    if (this.particles.length > 0) {
      requestAnimationFrame(() => this.animate());
    } else {
      this.isRunning = false;
    }
  },

  // 便捷发射方法
  burst(x, y, count = 10, type = 'circle', color = 'rgba(255,255,255,0.8)') {
    this.emit({ x, y, count, type, color, speed: 5, spread: Math.PI * 2, life: 40 });
  },

  confetti(x, y, count = 20) {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE'];
    for (let i = 0; i < count; i++) {
      this.emit({
        x, y, count: 1, type: 'confetti',
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 5, speed: 4 + Math.random() * 3,
        spread: Math.PI * 2, gravity: 0.15,
        life: 80 + Math.random() * 40,
        rotationSpeed: 0.2
      });
    }
  },

  hearts(x, y, count = 8) {
    this.emit({ x, y, count, type: 'heart', color: '#FF6B6B', size: 6, speed: 3, spread: Math.PI, angle: -Math.PI / 2, gravity: -0.05, life: 60 });
  },

  stars(x, y, count = 8) {
    this.emit({ x, y, count, type: 'star', color: '#FFD700', size: 5, speed: 4, spread: Math.PI * 2, gravity: 0.05, life: 50 });
  },

  snow(x, y, count = 15) {
    for (let i = 0; i < count; i++) {
      this.emit({
        x: x + (Math.random() - 0.5) * 200, y: y - 20,
        count: 1, type: 'snow', color: 'rgba(255,255,255,0.8)',
        size: 2 + Math.random() * 3, speed: 0.5,
        spread: Math.PI * 2, gravity: 0.02, friction: 0.99,
        life: 120 + Math.random() * 60
      });
    }
  },

  // 清理
  destroy() {
    this.particles = [];
    this.isRunning = false;
    if (this._resizeHandler) {
      window.removeEventListener('resize', this._resizeHandler);
      this._resizeHandler = null;
    }
    if (this.canvas) {
      this.canvas.remove();
      this.canvas = null;
      this.ctx = null;
    }
  }
};

window.ParticleEngine = ParticleEngine;

// S3创新：表情混合系统
const EmotionBlender = {
  // 情绪参数定义（归一化到0-1）
  emotionParams: {
    neutral:  { eyeOpen: 1.0, pupilScale: 1.0, mouthWidth: 1.0, mouthHeight: 0,   bodyTilt: 0,   blush: 0,   eyeRotation: 0 },
    happy:    { eyeOpen: 0.6, pupilScale: 1.1, mouthWidth: 1.3, mouthHeight: 0.8, bodyTilt: 0,   blush: 0.6, eyeRotation: 0 },
    surprised:{ eyeOpen: 1.3, pupilScale: 0.8, mouthWidth: 0.8, mouthHeight: 1.2, bodyTilt: 0,   blush: 0,   eyeRotation: 0 },
    sad:      { eyeOpen: 0.7, pupilScale: 0.9, mouthWidth: 0.7, mouthHeight: 0.3, bodyTilt: 3,   blush: 0,   eyeRotation: 0 },
    scared:   { eyeOpen: 1.4, pupilScale: 0.7, mouthWidth: 0.6, mouthHeight: 0.9, bodyTilt: -2,  blush: 0,   eyeRotation: 0 },
    curious:  { eyeOpen: 1.1, pupilScale: 1.1, mouthWidth: 0.6, mouthHeight: 0.2, bodyTilt: 0,   blush: 0,   eyeRotation: 0 },
    bored:    { eyeOpen: 0.5, pupilScale: 0.6, mouthWidth: 0.5, mouthHeight: 0,   bodyTilt: 3,   blush: 0,   eyeRotation: 3 },
    sleepy:   { eyeOpen: 0.4, pupilScale: 0.8, mouthWidth: 0.8, mouthHeight: 0.5, bodyTilt: 2,   blush: 0,   eyeRotation: 0 },
    excited:  { eyeOpen: 1.2, pupilScale: 1.2, mouthWidth: 1.4, mouthHeight: 1.0, bodyTilt: 0,   blush: 0.4, eyeRotation: 0 },
  },

  // 混合两种情绪
  blend(emotion1, emotion2, weight1 = 0.5, weight2 = 0.5) {
    const p1 = this.emotionParams[emotion1];
    const p2 = this.emotionParams[emotion2];
    if (!p1 || !p2) return null;

    const total = weight1 + weight2;
    const w1 = weight1 / total;
    const w2 = weight2 / total;

    const blended = {};
    for (const key of Object.keys(p1)) {
      blended[key] = p1[key] * w1 + p2[key] * w2;
    }
    return blended;
  },

  // 将混合参数应用到字母元素
  applyBlended(s, params) {
    if (!params) return;

    // 眼睛开合度
    const eyeScaleY = params.eyeOpen;
    s.eyes.forEach(e => {
      e.style.transform = `scaleY(${eyeScaleY})`;
      e.style.transition = 'transform 0.3s ease';
    });

    // 瞳孔大小
    s.pupils.forEach(p => {
      p.style.setProperty('--pupil-scale', params.pupilScale);
    });
    s.pupilScale = params.pupilScale;

    // 身体倾斜
    if (params.bodyTilt !== 0) {
      s.el.querySelector('.letter-body').style.transform = `rotate(${params.bodyTilt}deg)`;
    }

    // 腮红
    const blushOpacity = params.blush;
    s.el.querySelectorAll('.letter-blush').forEach(b => {
      b.style.opacity = blushOpacity;
      b.style.transition = 'opacity 0.3s ease';
    });

    // 嘴巴大小
    if (params.mouthWidth !== undefined) {
      const mouth = s.el.querySelector('.letter-mouth');
      if (mouth) mouth.style.transform = `scaleX(${params.mouthWidth}) scaleY(${params.mouthHeight})`;
    }

    // 眼睛旋转
    if (params.eyeRotation !== undefined) {
      s.eyes.forEach(e => {
        e.style.transform = `scaleY(${params.eyeOpen}) rotate(${params.eyeRotation}deg)`;
        e.style.transition = 'transform 0.3s ease';
      });
    }
  },

  // 混合并应用
  setBlendedEmotion(s, emotion1, emotion2, weight1 = 0.5, weight2 = 0.5) {
    const params = this.blend(emotion1, emotion2, weight1, weight2);
    if (params) {
      s.blendedEmotion = true;
      this.applyBlended(s, params);
    }
  },

  // 清除混合，恢复普通情绪
  clearBlended(s) {
    s.blendedEmotion = false;
    s.eyes.forEach(e => { e.style.transform = ''; e.style.transition = ''; });
    s.pupils.forEach(p => { p.style.setProperty('--pupil-scale', 1); });
    s.pupilScale = 1;
    const body = s.el.querySelector('.letter-body');
    if (body) body.style.transform = '';
    s.el.querySelectorAll('.letter-blush').forEach(b => { b.style.opacity = ''; b.style.transition = ''; });
  }
};

window.EmotionBlender = EmotionBlender;

// S4创新：时间感知系统
const TimeAwareness = {
  getTimePhase() {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 12) return 'morning';   // 早晨精力充沛
    if (hour >= 12 && hour < 14) return 'noon';     // 午后犯困
    if (hour >= 14 && hour < 18) return 'afternoon'; // 下午平稳
    if (hour >= 18 && hour < 22) return 'evening';   // 傍晚放松
    return 'night'; // 深夜
  },

  getAnimationIntensity() {
    const phase = this.getTimePhase();
    const intensities = { morning: 1.2, noon: 0.7, afternoon: 1.0, evening: 0.85, night: 0.6 };
    return intensities[phase];
  },

  getLazyFrequency() {
    const phase = this.getTimePhase();
    const frequencies = { morning: 1.5, noon: 0.6, afternoon: 1.0, evening: 0.8, night: 0.4 };
    return frequencies[phase];
  }
};

const LETTER_CONFIGS = [
  { letter: 'D',  key: 'D',  delay: 0 },
  { letter: 'e',  key: 'e',  delay: 0.08 },
  { letter: 'e',  key: 'e2', delay: 0.16 },
  { letter: 'p',  key: 'p',  delay: 0.24 },
  { letter: ' ',  key: null, delay: 0 },
  { letter: 'L',  key: 'L',  delay: 0.40 },
  { letter: 'e',  key: 'e3', delay: 0.48 },
  { letter: 'a',  key: 'a',  delay: 0.56 },
  { letter: 'r',  key: 'r',  delay: 0.64 },
  { letter: 'n',  key: 'n',  delay: 0.72 },
  { letter: 'i',  key: 'i',  delay: 0.80 },
  { letter: 'n',  key: 'n2', delay: 0.88 },
  { letter: 'g',  key: 'g',  delay: 0.96 },
];

function createLetterChar(config, index = 0, total = 1) {
  if (!config.key) {
    const space = document.createElement('div');
    space.className = 'letter-space';
    return space;
  }
  const char = document.createElement('div');
  char.className = 'letter-char';
  char.setAttribute('data-letter', config.key);

  // A1创新：入场叙事动画
  let entranceAnimation = 'letterBounceIn';
  let entranceDuration = 0.8;

  if (index === 0) {
    // D字母领袖隆重登场
    entranceAnimation = 'letterHeroEntrance';
    entranceDuration = 1.0;
  } else if (index > 0 && index < total - 1) {
    // 中间字母被吵醒入场
    entranceAnimation = 'letterWakeEntrance';
    entranceDuration = 0.9;
  }

  char.style.animation = `${entranceAnimation} ${entranceDuration}s cubic-bezier(0.34, 1.56, 0.64, 1) ${config.delay}s both`;
  char.innerHTML = `
    <div class="letter-body">
      <span class="letter-text">${config.letter}</span>
      <div class="letter-eyes" aria-hidden="true">
        <div class="letter-eye"><div class="letter-pupil"></div></div>
        <div class="letter-eye"><div class="letter-pupil"></div></div>
      </div>
      <div class="letter-mouth" aria-hidden="true"></div>
      <div class="letter-blush" aria-hidden="true"></div>
      <div class="letter-blush" aria-hidden="true"></div>
      <div class="letter-arm left" aria-hidden="true"></div>
      <div class="letter-arm right" aria-hidden="true"></div>
    </div>
    <div class="letter-shadow" aria-hidden="true"></div>`;
  // 无障碍支持
  char.setAttribute('tabindex', '0');
  char.setAttribute('role', 'button');
  char.setAttribute('aria-label', `字母${config.key}，点击或按Enter键查看互动效果`);
  return char;
}

function initLetterStage() {
  const stage = document.getElementById('letterStage');
  if (!stage) return;
  if (stage.dataset.initialized === 'true') return;
  stage.dataset.initialized = 'true';

  // A1创新：计算总字母数，用于入场叙事动画
  const letterConfigs = LETTER_CONFIGS.filter(c => c.key);
  const totalLetters = letterConfigs.length;

  LETTER_CONFIGS.forEach((c, i) => {
    const index = letterConfigs.indexOf(c);
    stage.appendChild(createLetterChar(c, index, totalLetters));
  });

  // I12创新：节日装饰系统
  applyHolidayDecorations(stage);

  // S8创新：应用字母自定义配置
  LetterCustomization.applyCustomizations(stage);

  // S9创新：暴露截图分享功能到全局
  window.ShareScreenshot = ShareScreenshot;

  // I20创新：初始化声音引擎并暴露到全局
  SoundEngine.init();
  window.SoundEngine = SoundEngine;
  ParticleEngine.init();

  setupLetterSystem(stage);

  // I10创新：入场动画完成后检查庆祝
  const maxDelay = Math.max(...LETTER_CONFIGS.map(c => c.delay || 0));
  const totalAnimTime = (maxDelay + 0.8) * 1000 + 200;
  let celebrationTimer = setTimeout(() => {
    const favLetter = LetterMemory.getFavoriteLetter();
    if (LetterMemory.shouldCelebrate()) {
      // 每5次访问庆祝：所有字母开心跳跃
      const chars = stage.querySelectorAll('.letter-char');
      chars.forEach(el => {
        el.style.animation = 'letterBounceIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)';
        setTimeout(() => { el.style.animation = ''; }, 600);
      });
    }
    if (favLetter) {
      // 最爱字母特殊高亮
      const favEl = stage.querySelector(`[data-letter="${favLetter}"]`);
      if (favEl) {
        favEl.style.animation = 'letterBounceIn 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)';
        setTimeout(() => { favEl.style.animation = ''; }, 800);
      }
    }
  }, totalAnimTime);
  // 页面卸载时清理庆祝定时器
  window.addEventListener('beforeunload', () => clearTimeout(celebrationTimer));
}

function setupLetterSystem(stage) {
  // I8创新：深夜模式自动sleepy（22:00-06:00）
  const hour = new Date().getHours();
  const isNightTime = hour >= 22 || hour < 6;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const chars = Array.from(stage.querySelectorAll('.letter-char'));
  if (!chars.length) return;

  // ===== 交互开关配置（可由用户控制）=====
  const interactionConfig = {
    lazyActions: true,      // 偷懒动作（总开关）
    socialInteractions: true, // 社交互动（总开关）
    snakeFollow: true,      // 排队跟随
    scaredBounce: true,     // 吓退弹跳
    eyeTracking: true,      // 眼球跟随
    bodyReaction: true,     // 身体反应
    squashStretch: true,    // 按住压扁
    // 鼠标交互子开关
    hover: true,            // hover 交互
    clickGaze: true,        // 点击注视
    // 偷懒动作子开关
    lazyNodOff: true,       // 打瞌睡
    lazyStretch: true,      // 伸懒腰
    lazyYawn: true,         // 打哈欠
    lazyZoneOut: true,      // 走神
    lazyPeek: true,         // 偷看
    lazyRubEyes: true,      // 揉眼睛
    // 社交互动子开关
    socialWhisper: true,    // 窃窃私语
    socialEyeContact: true, // 传递眼神
    socialCelebrate: true,  // 庆祝跳跃
  };
  // 使用单一命名空间对象，避免全局污染
  if (!window.LetterSystem) window.LetterSystem = {};
  window.LetterSystem.config = interactionConfig;

  // ============================================================
  // 第一部分：状态机初始化
  // 每个字母只有一个活跃状态：'idle' | 'hover' | 'lazy' | 'social' | 'scared'
  // ============================================================
  const states = chars.map((el, i) => ({
    el, index: i,
    pupils: el.querySelectorAll('.letter-pupil'),
    eyes: el.querySelectorAll('.letter-eye'),
    body: el.querySelector('.letter-body'),
    shadow: el.querySelector('.letter-shadow'),
    // 当前状态（互斥）
    state: 'idle', // 'idle' | 'hover' | 'lazy' | 'social' | 'scared'
    // 动画目标值（rAF 使用）
    tx: 0, ty: 0, tr: 0, ts: 1,
    cx: 0, cy: 0, cr: 0, cs: 1,
    // I1创新：弹簧速度属性
    vx: 0, vy: 0, vr: 0, vs: 0,
    // 定时器
    lazyTimer: null,
    socialTimer: null,
    talkingTimer: null,
    // 情绪（用于表情）
    emotion: 'neutral',
    // 缓存瞳孔缩放值，避免rAF中频繁调用getComputedStyle
    pupilScale: 1,
    // 吓退触发标记
    scaredTriggered: false,
    // I8创新：深夜模式标记
    nightMode: isNightTime,
  }));

  // 全局鼠标状态
  let mouseX = window.innerWidth / 2, mouseY = window.innerHeight / 2;
  let lastMouseMove = Date.now();
  let rafId = null;
  let isPaused = false;
  let isDestroyed = false; // 销毁标志，防止定时器继续执行
  let mouseSpeed = 0;
  let lastMouseMoveTime = Date.now(); // 用于计算真实速度

  // 常量定义（避免魔法数字）
  const CACHE_THROTTLE_MS = 100;
  const SCARED_DISTANCE_THRESHOLD = 80;
  const SCARED_RECOVERY_DISTANCE = 120;
  const LERP_FACTOR = 0.1;
  const MOUSE_SPEED_THRESHOLD = 40;
  const MOUSE_SLOW_THRESHOLD = 15;
  const ROTATION_START_DISTANCE = 50;
  const PUSH_DISTANCE_THRESHOLD = 150;
  const CURIOUS_DISTANCE_MIN = 100;
  const CURIOUS_DISTANCE_MAX = 200;
  const SNAKE_TRIGGER_FRAMES = 3;
  const SNAKE_COOLDOWN_MS = 3000;
  const SNAKE_MAX_DURATION_MS = 3000;
  // I1创新：弹簧物理参数
  const SPRING_STIFFNESS = 0.15;
  const SPRING_DAMPING = 0.75;
  // I3创新：瞳孔追踪统一参数
  const PUPIL_DISTANCE_FACTOR = 0.008;
  const PUPIL_MAX_OFFSET = 4;

  // A20创新：扩展缓动函数库（供JS驱动动画使用，如社交互动、惊醒弹跳等场景）
  // 使用示例：const progress = EASINGS.bounce(elapsed / duration); value = start + (end - start) * progress;
  const EASINGS = {
    bounce: t => {
      const n1 = 7.5625, d1 = 2.75;
      if (t < 1 / d1) return n1 * t * t;
      if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
      if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
      return n1 * (t -= 2.625 / d1) * t + 0.984375;
    },
    elastic: t => t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI / 3)) + 1,
    heavy: t => { const c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
    float: t => Math.sin(t * Math.PI * 0.5) * (1 - Math.sin(t * Math.PI * 0.5) * 0.3),
    snap: t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
    glide: t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
  };

  // 元素位置缓存
  const cachedPositions = new WeakMap();
  let lastCacheUpdate = 0;

  function updatePositionCache() {
    const now = Date.now();
    if (now - lastCacheUpdate < CACHE_THROTTLE_MS) return;
    lastCacheUpdate = now;
    states.forEach(s => {
      const rect = s.el.getBoundingClientRect();
      cachedPositions.set(s.el, {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        cx: rect.left + rect.width / 2,
        cy: rect.top + rect.height * 0.2
      });
    });
  }

  // 获取缓存位置的辅助函数
  function getCachedPosition(el) {
    let pos = cachedPositions.get(el);
    if (!pos) {
      updatePositionCache();
      pos = cachedPositions.get(el);
    }
    return pos || { left: 0, top: 0, width: 0, height: 0, cx: 0, cy: 0 };
  }

  // ===== 定时器追踪（用于清理）=====
  const allTimers = new Set();
  const originalSetTimeout = window.setTimeout;
  const trackedSetTimeout = (fn, delay) => {
    const wrappedFn = () => {
      if (isDestroyed) return; // 已销毁则不执行
      try {
        fn();
      } catch (e) {
        console.warn('LetterSystem timer error:', e);
      }
    };
    const id = originalSetTimeout(wrappedFn, delay);
    allTimers.add(id);
    return id;
  };
  const trackedClearTimeout = (id) => {
    if (id === null || id === undefined) return;
    allTimers.delete(id);
    return clearTimeout(id);
  };

  // ===== setInterval 追踪（用于清理）=====
  const allIntervals = new Set();
  const trackedSetInterval = (fn, delay) => {
    const wrappedFn = () => {
      if (isDestroyed) return;
      try {
        fn();
      } catch (e) {
        console.warn('LetterSystem interval error:', e);
      }
    };
    const id = setInterval(wrappedFn, delay);
    allIntervals.add(id);
    return id;
  };
  const trackedClearInterval = (id) => {
    if (id === null || id === undefined) return;
    allIntervals.delete(id);
    return clearInterval(id);
  };

  // ===== visibilitychange 处理 =====
  function handleVisibilityChange() {
    if (document.hidden) {
      isPaused = true;
      if (rafId) cancelAnimationFrame(rafId);
      // 暂停所有 interval 和 timeout
      allIntervals.forEach(id => clearInterval(id));
      allIntervals.clear();
      allTimers.forEach(id => clearTimeout(id));
      allTimers.clear();
    } else {
      isPaused = false;
      lastMouseMove = Date.now();
      if (!prefersReducedMotion && !isDestroyed) rafId = requestAnimationFrame(animate);
      // 重新调度 idle 状态字母的 lazy
      states.forEach(s => {
        if (s.state === 'idle') scheduleLazy(s);
      });
      // I9创新：页面重新可见时集体看向屏幕中心
      trackedSetTimeout(() => {
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;
        states.forEach(s => {
          if (s.state !== 'idle' && s.state !== 'hover') return;
          const pos = getCachedPosition(s.el);
          const dx = centerX - pos.cx;
          const dy = centerY - pos.cy;
          const angle = Math.atan2(dy, dx);
          const dist = Math.min(Math.sqrt(dx * dx + dy * dy) * PUPIL_DISTANCE_FACTOR, PUPIL_MAX_OFFSET);
          const ox = Math.cos(angle) * dist;
          const oy = Math.sin(angle) * dist;
          s.pupils.forEach(p => {
            p.style.transform = `translate(calc(-50% + ${ox}px), calc(-50% + ${oy}px)) scale(${s.pupilScale})`;
            p.style.transition = 'transform 0.5s ease';
          });
          // 1.5秒后恢复
          trackedSetTimeout(() => {
            s.pupils.forEach(p => { p.style.transition = ''; });
          }, 1500);
        });
      }, 300);
    }
  }
  document.addEventListener('visibilitychange', handleVisibilityChange);

  // ===== 清理函数 =====
  function destroyLetterSystem() {
    isDestroyed = true; // 设置销毁标志
    ParticleEngine.destroy();
    // 取消 rAF
    if (rafId) cancelAnimationFrame(rafId);
    // 清除所有定时器
    allTimers.forEach(id => clearTimeout(id));
    allTimers.clear();
    // 清除所有 interval
    allIntervals.forEach(id => clearInterval(id));
    allIntervals.clear();
    // 移除事件监听
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    document.removeEventListener('mousemove', handleMouseMove);
    // 移除触摸事件监听
    document.removeEventListener('touchmove', handleTouchMove);
    document.removeEventListener('touchstart', handleTouchStart);
    // 断开 IntersectionObserver
    if (goodbyeObserver) goodbyeObserver.disconnect();
    // 关闭 AudioContext
    if (SoundEngine.audioCtx && SoundEngine.audioCtx.state !== 'closed') {
      SoundEngine.audioCtx.close();
    }
    // 移除字母元素上的事件监听器（通过克隆元素替换，自动移除所有监听器）
    chars.forEach((el) => {
      const newEl = el.cloneNode(true);
      if (el.parentNode) {
        el.parentNode.replaceChild(newEl, el);
      }
    });
    // 清理状态
    states.forEach(s => {
      s.el.style.animation = '';
      s.el.style.transform = '';
      // 清理talking定时器
      if (s.talkingTimer) {
        clearInterval(s.talkingTimer);
        s.talkingTimer = null;
      }
    });
  }
  // 暴露清理函数到命名空间
  window.LetterSystem.destroy = destroyLetterSystem;

  // ============================================================
  // I11创新：滚动告别动画
  // ============================================================
  let hasWavedGoodbye = false;
  const goodbyeObserver = new IntersectionObserver((entries) => {
    if (prefersReducedMotion) return;
    entries.forEach(entry => {
      // 字母舞台即将离开视口（可见度低于20%）
      if (entry.intersectionRatio < 0.2 && !hasWavedGoodbye) {
        hasWavedGoodbye = true;
        // 触发挥手告别
        states.forEach((s, i) => {
          if (s.state !== 'idle') return;
          trackedSetTimeout(() => {
            // 添加挥手动画
            s.el.classList.add('waving-goodbye');
            setEmotion(s, 'sad');
            // 1秒后恢复
            trackedSetTimeout(() => {
              s.el.classList.remove('waving-goodbye');
              setEmotion(s, 'neutral');
            }, 1000);
          }, i * 80);
        });
      }
      // 重新进入视口时重置
      if (entry.intersectionRatio > 0.5) {
        hasWavedGoodbye = false;
      }
    });
  }, { threshold: [0.1, 0.2, 0.5, 0.8] });

  goodbyeObserver.observe(stage);

  // ============================================================
  // 第二部分：状态转换函数（显式进入/退出）
  // ============================================================

  /** 进入 hover 状态 */
  function enterHover(s) {
    if (s.state === 'hover') return;
    exitState(s); // 先退出当前状态
    s.state = 'hover';
    stopIdleAnimation(s);
    setEmotion(s, 'happy');
    SoundEngine.play('hover');
  }

  /** 退出 hover 状态 */
  function exitHover(s) {
    if (s.state !== 'hover') return;
    s.state = 'idle';
    setEmotion(s, 'neutral');
    startIdleAnimation(s);
    scheduleLazy(s);
  }

  /** 进入 lazy 状态 */
  function enterLazy(s, action) {
    if (s.state === 'lazy') return;
    exitState(s);
    s.state = 'lazy';
    stopIdleAnimation(s);
    action(s);
  }

  /** 退出 lazy 状态 */
  function exitLazy(s) {
    if (s.state !== 'lazy') return;
    trackedClearTimeout(s.lazyTimer);
    s.lazyTimer = null;
    const wasSleepy = s.emotion === 'sleepy';
    s.state = 'idle';
    setEmotion(s, 'neutral');
    // 重置瞳孔 transition
    s.pupils.forEach(p => { p.style.transition = ''; });
    s.el.classList.remove('rubbing-eyes', 'stretching');
    // 唤醒动画（使用EASINGS.elastic驱动弹性效果）
    const wakeDuration = 400;
    const wakeStart = performance.now();
    function animateWake(now) {
      const elapsed = now - wakeStart;
      const t = Math.min(elapsed / wakeDuration, 1);
      const elastic = EASINGS.elastic(t);
      s.el.style.transform = `scaleY(${0.9 + 0.25 * elastic}) translateY(${-10 * elastic}px)`;
      if (t < 1) requestAnimationFrame(animateWake);
      else s.el.style.transform = '';
    }
    requestAnimationFrame(animateWake);
    trackedSetTimeout(() => {
      s.el.style.animation = '';
      // 从打瞌睡醒来后30%概率揉眼睛
      if (wasSleepy && Math.random() < 0.3) {
        enterLazy(s, LAZY_ACTIONS[5]); // 揉眼睛
      } else {
        startIdleAnimation(s);
        scheduleLazy(s);
      }
    }, 400);
  }

  /** 进入 social 状态 */
  function enterSocial(s) {
    if (s.state === 'social') return;
    exitState(s);
    s.state = 'social';
    stopIdleAnimation(s);
  }

  /** 退出 social 状态 */
  function exitSocial(s) {
    if (s.state !== 'social') return;
    s.state = 'idle';
    setEmotion(s, 'neutral');
    startIdleAnimation(s);
  }

  /** 进入 scared 状态 */
  function enterScared(s) {
    if (s.state === 'scared') return;
    exitState(s);
    s.state = 'scared';
    stopIdleAnimation(s);
  }

  /** 退出 scared 状态 */
  function exitScared(s) {
    if (s.state !== 'scared') return;
    s.state = 'idle';
    setEmotion(s, 'neutral');
    startIdleAnimation(s);
  }

  /** 通用退出当前状态 */
  function exitState(s) {
    switch (s.state) {
      case 'hover': exitHover(s); break;
      case 'lazy': exitLazy(s); break;
      case 'social': exitSocial(s); break;
      case 'scared': exitScared(s); break;
    }
  }

  // ============================================================
  // 第三部分：情绪系统
  // ============================================================
  // I14创新：情绪切换过渡动画（挤压过渡帧）
  function setEmotion(s, emotion, skipTransition = false) {
    // 允许重复设置（社交互动需要刷新表情）
    if (s.emotion === emotion) {
      // neutral 重复设置无意义，其他情绪允许刷新
      if (emotion === 'neutral') return;
    }

    // I14创新：挤压过渡动画（50ms）
    if (!skipTransition && emotion !== 'neutral' && s.emotion !== emotion) {
      s.el.style.transform = 'scale(0.95, 0.9)';
      trackedSetTimeout(() => {
        s.el.style.transform = '';
        applyEmotion(s, emotion);
      }, 50);
      return;
    }

    applyEmotion(s, emotion);
  }

  function applyEmotion(s, emotion) {
    // 清除旧情绪类
    s.el.classList.remove('happy', 'surprised', 'sleepy', 'yawning', 'excited', 'sad', 'curious', 'scared', 'bored', 'talking');
    s.eyes.forEach(e => e.classList.remove('sleepy', 'surprised', 'sad', 'curious', 'scared', 'bored'));
    s.emotion = emotion;
    // 更新pupilScale缓存（与CSS --pupil-scale保持同步）
    const pupilScaleMap = { neutral: 1, excited: 1.2, curious: 1.1, bored: 0.6, surprised: 0.8, sad: 0.9, scared: 0.7, happy: 1.1, sleepy: 0.8 };
    s.pupilScale = pupilScaleMap[emotion] !== undefined ? pupilScaleMap[emotion] : 1;
    // 设置新情绪
    if (emotion !== 'neutral') s.el.classList.add(emotion);
    if (emotion === 'sleepy') s.eyes.forEach(e => e.classList.add('sleepy'));
    if (emotion === 'surprised') s.eyes.forEach(e => e.classList.add('surprised'));
    if (emotion === 'sad') s.eyes.forEach(e => e.classList.add('sad'));
    if (emotion === 'scared') s.eyes.forEach(e => e.classList.add('scared'));
    if (emotion === 'bored') s.eyes.forEach(e => e.classList.add('bored'));
    // I16创新：talking情绪（使用CSS动画实现嘴巴动态效果）
    if (emotion === 'talking') {
      // talking效果由CSS动画 .talking .letter-mouth::before 实现
      // 无需额外JS定时器，CSS animation已提供随机感
    } else {
      if (s.talkingTimer) {
        clearInterval(s.talkingTimer);
        s.talkingTimer = null;
      }
    }
  }

  // ============================================================
  // 第四部分：眼球跟随
  // 跳过 lazy 和 social 状态的字母
  // ============================================================
  function updateEyes() {
    if (!interactionConfig.eyeTracking) return;
    updatePositionCache();
    states.forEach(s => {
      // lazy 或 social 状态不参与眼球跟随
      if (s.state === 'lazy' || s.state === 'social') return;
      // 跳过有 CSS animation 的瞳孔
      const hasPupilAnimation = Array.from(s.pupils).some(p => p.style.animation && p.style.animation !== '');
      if (hasPupilAnimation) return;

      const pos = cachedPositions.get(s.el);
      if (!pos) return;
      const cx = pos.cx, cy = pos.cy;
      const dx = mouseX - cx, dy = mouseY - cy;
      const angle = Math.atan2(dy, dx);
      const dist = Math.min(Math.sqrt(dx * dx + dy * dy) * PUPIL_DISTANCE_FACTOR, PUPIL_MAX_OFFSET);
      const ox = Math.cos(angle) * dist, oy = Math.sin(angle) * dist;
      s.pupils.forEach(p => {
        p.style.transform = `translate(calc(-50% + ${ox}px), calc(-50% + ${oy}px)) scale(${s.pupilScale})`;
      });
    });
  }

  // ============================================================
  // 第五部分：360° 身体反应（简化版）
  // 只有 idle 和 hover 状态响应鼠标
  // ============================================================
  // I2创新：连续距离梯度反馈常量
  const GRADIENT_FAR = 300;      // 远距离：开始微弱反应
  const GRADIENT_MID = 200;      // 中距离：踮脚好奇
  const GRADIENT_NEAR = 100;     // 近距离：明显反应
  const GRADIENT_PUSH = 60;      // 推开距离

  function updateBodies() {
    if (!interactionConfig.bodyReaction) return;
    states.forEach(s => {
      // 只有 idle 和 hover 状态响应鼠标
      if (s.state !== 'idle' && s.state !== 'hover') return;

      const pos = getCachedPosition(s.el);
      const rect = { left: pos.left, top: pos.top, width: pos.width, height: pos.height };
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = mouseX - cx, dy = mouseY - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // 重置目标值
      s.tx = 0; s.ty = 0; s.tr = 0; s.ts = 1;

      // 1. 朝鼠标方向旋转（±8°）
      if (dist > ROTATION_START_DISTANCE) {
        const angle = Math.atan2(dy, dx);
        s.tr = Math.sin(angle) * 8 * Math.max(0, 1 - dist / 400);
      }

      // 2. hover 状态：轻微弹起
      if (s.state === 'hover') {
        s.ts = 1.05;
        s.ty = -6;
        return;
      }

      // 3. 非常近：吓退弹跳（只触发一次）
      if (dist < SCARED_DISTANCE_THRESHOLD && !s.scaredTriggered && interactionConfig.scaredBounce && mouseSpeed < MOUSE_SLOW_THRESHOLD) {
        s.scaredTriggered = true;
        triggerScaredBounce(s, dx, dy, dist);
        return;
      }

      // I2创新：连续距离梯度反馈（消除三段式离散反馈）
      // 计算连续梯度因子 (0-1)，距离越近因子越大
      if (dist < GRADIENT_FAR) {
        const gradientFactor = Math.max(0, 1 - dist / GRADIENT_FAR);

        // 连续倾斜：300px内开始微弱倾斜，越近越明显
        const angle = Math.atan2(dy, dx);
        s.tr = Math.sin(angle) * 8 * gradientFactor;

        // 连续踮脚：200px内开始踮脚，越近越高
        if (dist < GRADIENT_MID) {
          const tipToeFactor = Math.max(0, 1 - dist / GRADIENT_MID);
          s.ty = -6 * tipToeFactor;

          // 连续推开：100px内开始推开
          if (dist < GRADIENT_NEAR) {
            const pushFactor = Math.max(0, 1 - dist / GRADIENT_NEAR);
            const push = pushFactor * 8;
            s.tx = -(dx / Math.max(dist, 1)) * push;
            s.ty = -8 * pushFactor;
          }
        }

        // 情绪渐变：距离越近越好奇
        if (gradientFactor > 0.4 && s.state === 'idle') {
          setEmotion(s, 'curious');
        }
      }

      // 距离恢复正常时恢复情绪
      if (dist >= GRADIENT_FAR && s.emotion === 'curious') {
        setEmotion(s, 'neutral');
      }
    });
  }

  /** 触发吓退弹跳 */
  function triggerScaredBounce(s, dx, dy, dist) {
    enterScared(s);
    const scareDir = -(dx / Math.max(dist, 1));
    s.el.style.setProperty('--scare-dx', `${scareDir * 8}px`);
    s.el.style.animation = 'scaredJump 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';
    setEmotion(s, 'scared');
    SoundEngine.play('scared');

    trackedSetTimeout(() => {
      if (isDestroyed) return;
      s.el.style.animation = '';
      exitScared(s);
      // 迟滞：等鼠标远离到120px以上才允许再次触发
      const checkDist = () => {
        if (isDestroyed) { s.scaredTriggered = false; return; }
        const pos = getCachedPosition(s.el);
        const r = { left: pos.left, top: pos.top, width: pos.width, height: pos.height };
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        const d = Math.sqrt((mouseX - cx) ** 2 + (mouseY - cy) ** 2);
        if (d > SCARED_RECOVERY_DISTANCE) {
          s.scaredTriggered = false;
        } else {
          requestAnimationFrame(checkDist);
        }
      };
      requestAnimationFrame(checkDist);
    }, 400);
  }

  // ============================================================
  // 第六部分：平滑插值动画循环
  // ============================================================
  function animate() {
    if (isPaused || isDestroyed) return;

    // 检查是否所有功能都关闭了
    const allDisabled = !interactionConfig.hover && !interactionConfig.clickGaze &&
                        !interactionConfig.bodyReaction && !interactionConfig.scaredBounce &&
                        !interactionConfig.squashStretch && !interactionConfig.eyeTracking &&
                        !interactionConfig.lazyActions && !interactionConfig.socialInteractions &&
                        !interactionConfig.snakeFollow;
    if (allDisabled) return;

    // I4创新：全局呼吸时间
    const breathTime = Date.now() * 0.002;

    states.forEach((s, idx) => {
      // 如果有 CSS animation 在运行，跳过 rAF transform
      const hasCssAnimation = s.el.style.animation && s.el.style.animation !== '';
      if (!hasCssAnimation) {
        // I1创新：弹簧物理替代简单LERP
        const dxC = s.tx - s.cx;
        s.vx = (s.vx + dxC * SPRING_STIFFNESS) * SPRING_DAMPING;
        s.cx += s.vx;

        const dyC = s.ty - s.cy;
        s.vy = (s.vy + dyC * SPRING_STIFFNESS) * SPRING_DAMPING;
        s.cy += s.vy;

        const drC = s.tr - s.cr;
        s.vr = (s.vr + drC * SPRING_STIFFNESS) * SPRING_DAMPING;
        s.cr += s.vr;

        const dsC = s.ts - s.cs;
        s.vs = (s.vs + dsC * SPRING_STIFFNESS) * SPRING_DAMPING;
        s.cs += s.vs;

        // I4创新：呼吸微动（每个字母相位偏移）
        const breathScale = 1 + Math.sin(breathTime + idx * 0.5) * 0.005;
        const finalScale = s.cs * breathScale;

        s.el.style.transform =
          `perspective(800px) translateY(${s.cy}px) translateX(${s.cx}px) rotate(${s.cr}deg) scale(${finalScale})`;

        // A27创新：增强身体反向旋转
        if (s.body) {
          const bodyCounterRotation = -s.cr * 0.25;
          const bodyCounterY = -s.cy * 0.05;
          s.body.style.transform = `rotate(${bodyCounterRotation}deg) translateY(${bodyCounterY}px)`;
        }
      }

      // V3创新：动态阴影系统
      if (s.shadow) {
        const height = Math.abs(s.cy);
        const ss = Math.max(0.3, 1 - height * 0.04);
        const so = Math.max(0.03, 0.2 - height * 0.02);
        const blur = Math.min(12, 3 + height * 0.15);
        const shadowOffsetX = -s.cx * 0.3;
        s.shadow.style.transform = `scaleX(${ss}) translateX(${shadowOffsetX}px)`;
        s.shadow.style.opacity = so;
        s.shadow.style.filter = `blur(${blur}px)`;
      }
    });

    updateEyes();
    rafId = requestAnimationFrame(animate);
  }

  // ============================================================
  // 第七部分：随机眨眼
  // ============================================================
  // A4创新：单眼眨眼变化
  function scheduleBlink(eyes) {
    trackedSetTimeout(() => {
      if (isDestroyed) return;
      // 20%概率单眼眨眼
      const isSingleBlink = Math.random() < 0.2;
      const eyesToBlink = isSingleBlink
        ? [eyes[Math.random() < 0.5 ? 0 : 1]]
        : Array.from(eyes);

      eyesToBlink.forEach(e => e.classList.add('blink'));
      trackedSetTimeout(() => {
        eyesToBlink.forEach(e => e.classList.remove('blink'));
        scheduleBlink(eyes);
      }, 80);
    }, Math.random() * 4000 + 2000);
  }
  states.forEach(s => trackedSetTimeout(() => scheduleBlink(s.eyes), Math.random() * 2000));

  // ============================================================
  // 第八部分：鼠标事件监听 + 排队跟随检测 + 触摸支持
  // ============================================================
  let prevMouseX = mouseX, prevMouseY = mouseY;
  let snakeFollowActive = false;
  let snakeFastFrames = 0;
  let lastSnakeFollow = 0;
  let mouseMoveRafId = null; // 用于节流
  let touchMoveRafId = null; // 用于触摸节流

  function handleMouseMove(e) {
    // 使用 RAF 节流，避免高频事件
    if (mouseMoveRafId) return;
    mouseMoveRafId = requestAnimationFrame(() => {
      mouseMoveRafId = null;

      // 计算鼠标速度（基于时间）
      const now = Date.now();
      const dt = Math.max(now - lastMouseMoveTime, 1);
      const dx = e.clientX - mouseX;
      const dy = e.clientY - mouseY;
      const pixelDist = Math.sqrt(dx * dx + dy * dy);
      mouseSpeed = pixelDist / dt * 16; // 标准化为每帧速度
      lastMouseMoveTime = now;

      prevMouseX = mouseX;
      prevMouseY = mouseY;
      mouseX = e.clientX;
      mouseY = e.clientY;
      lastMouseMove = now;

      // 鼠标移动时唤醒偷懒的小人
      states.forEach(s => {
        if (s.state === 'lazy') exitLazy(s);
      });

      // 快速移动时触发排队跟随（需要连续快速移动）
      if (mouseSpeed > MOUSE_SPEED_THRESHOLD && !snakeFollowActive && !states.some(s => s.state !== 'idle') && interactionConfig.snakeFollow) {
        snakeFastFrames = (snakeFastFrames || 0) + 1;
        if (snakeFastFrames >= SNAKE_TRIGGER_FRAMES && Date.now() - lastSnakeFollow > SNAKE_COOLDOWN_MS) {
          triggerSnakeFollow();
          snakeFastFrames = 0;
          lastSnakeFollow = Date.now();
        }
      } else {
        snakeFastFrames = 0;
      }
    });
  }
  document.addEventListener('mousemove', handleMouseMove);

  // ===== 触摸事件支持 =====
  function handleTouchStart(e) {
    if (e.touches.length > 0) {
      const touch = e.touches[0];
      mouseX = touch.clientX;
      mouseY = touch.clientY;
      lastMouseMove = Date.now();
      lastMouseMoveTime = Date.now();
    }
  }

  function handleTouchMove(e) {
    // 使用 RAF 节流，避免高频触摸事件
    if (touchMoveRafId) return;
    touchMoveRafId = requestAnimationFrame(() => {
      touchMoveRafId = null;
      if (e.touches.length > 0) {
        const touch = e.touches[0];
        const now = Date.now();
        const dt = Math.max(now - lastMouseMoveTime, 1);
        const dx = touch.clientX - mouseX;
        const dy = touch.clientY - mouseY;
        mouseSpeed = Math.sqrt(dx * dx + dy * dy) / dt * 16;

        mouseX = touch.clientX;
        mouseY = touch.clientY;
        lastMouseMove = now;
        lastMouseMoveTime = now;

        // 触摸移动时唤醒偷懒的小人
        states.forEach(s => {
          if (s.state === 'lazy') exitLazy(s);
        });
      }
    });
  }
  document.addEventListener('touchstart', handleTouchStart, { passive: true });
  document.addEventListener('touchmove', handleTouchMove, { passive: true });

  /** 排队跟随（蛇形效果）- 持续跟随直到鼠标减速 */
  function triggerSnakeFollow() {
    if (!interactionConfig.snakeFollow) return;
    snakeFollowActive = true;
    const startTime = Date.now();

    // 每个字母跟随前一个字母的位置偏移
    function updateSnake() {
      if (isDestroyed) { snakeFollowActive = false; return; }
      const elapsed = Date.now() - startTime;
      if (elapsed > SNAKE_MAX_DURATION_MS || mouseSpeed < MOUSE_SLOW_THRESHOLD) {
        // 结束：恢复所有字母
        states.forEach(s => {
          if (s.state === 'idle') {
            s.tx = 0; s.ty = 0; s.tr = 0;
            startIdleAnimation(s);
          }
        });
        snakeFollowActive = false;
        return;
      }

      // 预先缓存所有位置
      updatePositionCache();

      states.forEach((s, i) => {
        if (s.state !== 'idle') return;
        s.el.style.animation = ''; // 清除 idle

        const pos = getCachedPosition(s.el);
        const rect = { left: pos.left, top: pos.top, width: pos.width, height: pos.height };
        const ccx = rect.left + rect.width / 2;
        const ccy = rect.top + rect.height / 2;

        // 第一个字母跟随鼠标，后续字母跟随前一个字母
        let targetX, targetY;
        if (i === 0) {
          targetX = mouseX; targetY = mouseY;
        } else {
          const prevPos = getCachedPosition(states[i - 1].el);
          targetX = prevPos.cx;
          targetY = prevPos.cy;
        }

        const dx = targetX - ccx;
        const dy = targetY - ccy;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // A17创新：波浪传播延迟感 - 越靠后的字母LERP系数越小
        const lerpFactor = Math.max(0.15, 0.5 - i * 0.035); // 头部0.5，尾部约0.15
        // 衰减因子：越后面的字母跟随幅度越小
        const decay = Math.max(0.3, 1 - i * 0.06);
        // 目标位置
        const targetTx = (dx / Math.max(dist, 1)) * Math.min(dist * 0.08, 10) * decay;
        const targetTy = (dy / Math.max(dist, 1)) * Math.min(dist * 0.06, 6) * decay - 2 * decay;
        const targetTr = (dx / Math.max(dist, 1)) * 3 * decay;
        // A17创新：使用LERP平滑过渡，产生传播延迟
        s.tx = s.tx + (targetTx - s.tx) * lerpFactor;
        s.ty = s.ty + (targetTy - s.ty) * lerpFactor;
        s.tr = s.tr + (targetTr - s.tr) * lerpFactor;
      });

      requestAnimationFrame(updateSnake);
    }

    requestAnimationFrame(updateSnake);
  }

  // ============================================================
  // 第九部分：Hover 和点击事件
  // ============================================================
  chars.forEach((el, i) => {
    // Hover 进入
    el.addEventListener('mouseenter', () => {
      if (prefersReducedMotion || !interactionConfig.hover) return;
      enterHover(states[i]);
    });
    // Hover 退出
    el.addEventListener('mouseleave', () => {
      if (prefersReducedMotion) return;
      exitHover(states[i]);
    });
    // I5创新：触摸设备hover等效
    let touchTimer = null;
    el.addEventListener('touchstart', (e) => {
      if (prefersReducedMotion) return;
      const s = states[i];
      if (s.state !== 'idle') return;
      touchTimer = trackedSetTimeout(() => {
        enterHover(s);
      }, 120);
    }, { passive: true });
    el.addEventListener('touchend', () => {
      if (touchTimer) { trackedClearTimeout(touchTimer); touchTimer = null; }
      const s = states[i];
      if (s.state === 'hover') exitHover(s);
    }, { passive: true });
    el.addEventListener('touchmove', () => {
      if (touchTimer) { trackedClearTimeout(touchTimer); touchTimer = null; }
    }, { passive: true });
    el.addEventListener('touchcancel', () => {
      if (touchTimer) { trackedClearTimeout(touchTimer); touchTimer = null; }
      const s = states[i];
      if (s.state === 'hover') exitHover(s);
    }, { passive: true });
    // 鼠标按下：squash & stretch（CSS动画）
    el.addEventListener('mousedown', () => {
      if (prefersReducedMotion || !interactionConfig.squashStretch) return;
      const s = states[i];
      s.el.style.animation = 'squashPress 0.15s ease-out forwards';
      setEmotion(s, 'surprised');
    });
    // 鼠标释放：恢复
    el.addEventListener('mouseup', () => {
      if (prefersReducedMotion || !interactionConfig.squashStretch) return;
      const s = states[i];
      s.el.style.animation = 'squashRelease 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards';
      trackedSetTimeout(() => {
        if (s.state === 'idle' || s.state === 'hover') {
          s.el.style.animation = '';
          setEmotion(s, s.state === 'hover' ? 'happy' : 'neutral');
          if (s.state === 'idle') startIdleAnimation(s);
        }
      }, 300);
    });
    // 触摸按下：squash & stretch（触摸设备支持）
    el.addEventListener('touchstart', () => {
      if (prefersReducedMotion || !interactionConfig.squashStretch) return;
      const s = states[i];
      s.el.style.animation = 'squashPress 0.15s ease-out forwards';
      setEmotion(s, 'surprised');
    }, { passive: true });
    // 触摸释放：恢复
    el.addEventListener('touchend', () => {
      if (prefersReducedMotion || !interactionConfig.squashStretch) return;
      const s = states[i];
      s.el.style.animation = 'squashRelease 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards';
      trackedSetTimeout(() => {
        if (s.state === 'idle' || s.state === 'hover') {
          s.el.style.animation = '';
          setEmotion(s, s.state === 'hover' ? 'happy' : 'neutral');
          if (s.state === 'idle') startIdleAnimation(s);
        }
      }, 300);
    }, { passive: true });
    // 点击：群体注视（不改变其他字母的情绪）
    el.addEventListener('click', () => {
      if (prefersReducedMotion || !interactionConfig.clickGaze) return;
      const clickedS = states[i];
      const clickedPos = getCachedPosition(clickedS.el);
      const clickedRect = { left: clickedPos.left, top: clickedPos.top, width: clickedPos.width, height: clickedPos.height };
      const clickedCx = clickedRect.left + clickedRect.width / 2;
      const clickedCy = clickedRect.top + clickedRect.height * 0.2;

      // 被点击的字母开心
      setEmotion(clickedS, 'happy');
      LetterMemory.recordClick(el.getAttribute('data-letter'));
      ClickChorus.record(el.getAttribute('data-letter'));
      SoundEngine.play('click');

      // 其他字母看向被点击的字母（不改变情绪）
      states.forEach((s, j) => {
        if (j === i || s.state === 'lazy') return;

        const sPos = getCachedPosition(s.el);
        const sRect = { left: sPos.left, top: sPos.top, width: sPos.width, height: sPos.height };
        const dx = clickedCx - (sRect.left + sRect.width / 2);
        const dy = clickedCy - (sRect.top + sRect.height * 0.2);
        const dist = Math.sqrt(dx * dx + dy * dy);
        const offset = Math.min(dist * PUPIL_DISTANCE_FACTOR, PUPIL_MAX_OFFSET);

        const angle = Math.atan2(dy, dx);
        const ox = Math.cos(angle) * offset;
        const oy = Math.sin(angle) * offset;

        s.pupils.forEach(p => {
          p.style.transform = `translate(calc(-50% + ${ox}px), calc(-50% + ${oy}px)) scale(${s.pupilScale})`;
          p.style.transition = 'transform 0.3s ease';
        });
      });

      // 1.5秒后恢复
      trackedSetTimeout(() => {
        states.forEach(s => {
          s.pupils.forEach(p => { p.style.transition = ''; });
        });
        // 恢复被点击字母的情绪
        if (clickedS.state === 'idle') {
          setEmotion(clickedS, 'neutral');
        }
      }, 1500);
    });
    // 键盘支持
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        el.click();
      }
    });
    // 焦点样式由CSS :focus-visible处理，无需JS内联样式
  });

  // I6创新：双击旋转Easter Egg
  chars.forEach((el, i) => {
    el.addEventListener('dblclick', (e) => {
      e.preventDefault();
      if (prefersReducedMotion) return;
      const s = states[i];
      if (s.state !== 'idle') return;
      s.el.style.animation = 'letterSpin 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)';
      setEmotion(s, 'excited');
      // 生成星星粒子
      spawnParticles(s.el, 5, 'star');
      trackedSetTimeout(() => {
        s.el.style.animation = '';
        setEmotion(s, 'neutral');
        startIdleAnimation(s);
      }, 600);
    });
  });

  // 简单粒子生成函数（I6配套）
  function spawnParticles(parentEl, count, type) {
    const rect = parentEl.getBoundingClientRect();
    const animations = ['particleBurst', 'particleArc', 'particleSpiral'];
    for (let i = 0; i < count; i++) {
      const p = document.createElement('div');
      p.className = 'letter-particle';
      const animType = animations[Math.floor(Math.random() * animations.length)];
      let symbols, color;
      if (type === 'star') {
        symbols = ['✦', '✧', '⭑'];
        color = `hsl(${Math.random() * 360}, 80%, 70%)`;
      } else if (type === 'note') {
        symbols = ['♪', '♫', '♬', '♩'];
        color = `hsl(${30 + Math.random() * 30}, 90%, 70%)`;
      } else {
        symbols = ['•', '◦', '∘'];
        color = `hsl(${Math.random() * 360}, 80%, 70%)`;
      }
      p.textContent = symbols[Math.floor(Math.random() * symbols.length)];
      const arcX = (Math.random() - 0.5) * 40;
      p.style.cssText = `
        position: fixed;
        left: ${rect.left + rect.width / 2}px;
        top: ${rect.top + rect.height / 2}px;
        font-size: ${8 + Math.random() * 8}px;
        color: ${color};
        pointer-events: none;
        z-index: 9999;
        animation: ${animType} ${0.6 + Math.random() * 0.4}s ease-out forwards;
        --burst-x: ${(Math.random() - 0.5) * 60}px;
        --arc-x: ${arcX}px;
      `;
      document.body.appendChild(p);
      trackedSetTimeout(() => p.remove(), 1200);
    }
  }

  // ============================================================
  // 第十部分：偷懒动作系统
  // ============================================================
  const LAZY_ACTIONS = [
    // 打瞌睡
    (s) => {
      setEmotion(s, 'sleepy');
      s.el.style.animation = 'nodOff 3s ease-in-out infinite';
      s.lazyTimer = trackedSetTimeout(() => exitLazy(s), 4000 + Math.random() * 3000);
    },
    // 伸懒腰
    (s) => {
      s.el.classList.add('stretching');
      s.el.style.animation = 'stretchUp 2s ease-in-out';
      s.lazyTimer = trackedSetTimeout(() => {
        s.el.classList.remove('stretching');
        exitLazy(s);
      }, 2000);
    },
    // 打哈欠
    (s) => {
      setEmotion(s, 'yawning');
      s.lazyTimer = trackedSetTimeout(() => exitLazy(s), 2500);
    },
    // 走神
    (s) => {
      setEmotion(s, 'bored');
      const gazeX = (Math.random() - 0.5) * 3;
      const gazeY = (Math.random() - 0.5) * 2;
      s.pupils.forEach(p => {
        p.style.transform = `translate(calc(-50% + ${gazeX}px), calc(-50% + ${gazeY}px)) scale(${s.pupilScale})`;
        p.style.transition = 'transform 0.8s ease';
      });
      s.lazyTimer = trackedSetTimeout(() => {
        s.pupils.forEach(p => { p.style.transition = ''; });
        exitLazy(s);
      }, 3000 + Math.random() * 2000);
    },
    // 偷看别处
    (s) => {
      const peekOx = (Math.random() - 0.5) * 4;
      const peekOy = (Math.random() - 0.5) * 3;
      s.el.style.setProperty('--peek-ox', `${peekOx}px`);
      s.el.style.setProperty('--peek-oy', `${peekOy}px`);
      s.pupils.forEach(p => {
        p.style.animation = `peekAway ${2 + Math.random()}s ease-in-out`;
      });
      s.lazyTimer = trackedSetTimeout(() => {
        s.pupils.forEach(p => { p.style.animation = ''; });
        exitLazy(s);
      }, 2000 + Math.random() * 1000);
    },
    // 揉眼睛
    (s) => {
      s.el.classList.add('rubbing-eyes');
      s.eyes.forEach(e => e.classList.add('sleepy'));
      const arms = s.el.querySelectorAll('.letter-arm');
      arms.forEach(arm => {
        arm.style.animation = `${arm.classList.contains('left') ? 'rubEyesLeft' : 'rubEyesRight'} 0.8s ease-in-out 2`;
      });
      s.lazyTimer = trackedSetTimeout(() => {
        s.el.classList.remove('rubbing-eyes');
        s.eyes.forEach(e => e.classList.remove('sleepy'));
        arms.forEach(arm => { arm.style.animation = ''; });
        exitLazy(s);
      }, 2000);
    },
  ];

  function scheduleLazy(s) {
    if (s.state !== 'idle' || !interactionConfig.lazyActions || isDestroyed) return;
    // I8创新：深夜模式缩短延迟时间
    // S4创新：时间感知系统调整延迟
    const baseDelay = 8000 + Math.random() * 7000; // 8-15秒（降低触发门槛）
    const timeFactor = TimeAwareness.getLazyFrequency();
    const delay = (s.nightMode ? baseDelay * 0.4 : baseDelay) / timeFactor;
    s.lazyTimer = trackedSetTimeout(() => {
      if (isDestroyed) return;
      if (isPaused || Date.now() - lastMouseMove < 5000 || s.state !== 'idle') { // 5秒无操作
        if (s.state === 'idle') scheduleLazy(s);
        return;
      }
      const idleTime = Date.now() - lastMouseMove;
      let actionIdx;
      if (idleTime > 12000) {
        // 很长时间：打瞌睡、伸懒腰、打哈欠
        actionIdx = Math.floor(Math.random() * 3);
      } else if (idleTime > 8000) {
        // 中等时间：走神、偷看
        actionIdx = 3 + Math.floor(Math.random() * 2);
      } else {
        // 刚过阈值：随机
        actionIdx = Math.floor(Math.random() * LAZY_ACTIONS.length);
      }
      // 子开关映射
      const lazyActionKeys = ['lazyNodOff', 'lazyStretch', 'lazyYawn', 'lazyZoneOut', 'lazyPeek', 'lazyRubEyes'];
      // 检查对应子开关
      if (!interactionConfig[lazyActionKeys[actionIdx]]) {
        scheduleLazy(s); // 跳过此动作，重新调度
        return;
      }
      enterLazy(s, LAZY_ACTIONS[actionIdx]);
    }, delay);
  }

  // ============================================================
  // 第十一部分：社交互动系统
  // 只保留：窃窃私语、传递眼神、庆祝跳跃
  // ============================================================
  function triggerSocialInteraction() {
    // 完整状态检查
    if (states.some(s => ['lazy', 'social', 'scared', 'hover'].includes(s.state))) return;
    if (isPaused) return;

    // 收集可用的社交互动（根据子开关过滤）
    const availableInteractions = [];

    // 窃窃私语
    if (interactionConfig.socialWhisper) {
      availableInteractions.push(() => {
        // 动态分组，确保不越界
        const mid = Math.floor(states.length / 2);
        const firstHalf = states.slice(0, mid).map((_, i) => i);
        const secondHalf = states.slice(mid).map((_, i) => i + mid);
        const group = Math.random() > 0.5 && firstHalf.length > 1 ? firstHalf : secondHalf;
        if (group.length < 2) return;
        const localIdx = Math.floor(Math.random() * (group.length - 1));
        const a = states[group[localIdx]], b = states[group[localIdx + 1]];
        if (!a || !b || a.state !== 'idle' || b.state !== 'idle') return;

        enterSocial(a);
        enterSocial(b);
        a.el.style.animation = 'whisperRight 2s ease-in-out';
        b.el.style.animation = 'whisperLeft 2s ease-in-out 0.15s';

        // 嘴巴微动效果：交替设置 happy/neutral 模拟说话
        let mouthCount = 0;
        const mouthInterval = trackedSetInterval(() => {
          // S3创新：使用表情混合，talking + happy 混合
          if (mouthCount % 2 === 0) {
            EmotionBlender.setBlendedEmotion(a, 'happy', 'surprised', 0.7, 0.3);
            EmotionBlender.setBlendedEmotion(b, 'happy', 'surprised', 0.7, 0.3);
          } else {
            EmotionBlender.setBlendedEmotion(a, 'happy', 'neutral', 0.6, 0.4);
            EmotionBlender.setBlendedEmotion(b, 'happy', 'neutral', 0.6, 0.4);
          }
          mouthCount++;
          if (mouthCount > 6) {
            trackedClearInterval(mouthInterval);
            EmotionBlender.clearBlended(a);
            EmotionBlender.clearBlended(b);
            setEmotion(a, 'happy');
            setEmotion(b, 'happy');
          }
        }, 300);

        // I17创新：被排除邻居偷瞄反应
        const excludedNeighbor = states[group[localIdx + 2]]; // 如果有的话
        if (excludedNeighbor && excludedNeighbor.state === 'idle') {
          // 偷瞄：先看聊天两人，然后转开变sad
          excludedNeighbor.el.classList.add('peeking-at-chat');
          setEmotion(excludedNeighbor, 'curious'); // 先好奇偷看

          trackedSetTimeout(() => {
            // 30%概率尝试加入（变成happy）
            if (Math.random() < 0.3) {
              setEmotion(excludedNeighbor, 'happy');
              excludedNeighbor.el.classList.remove('peeking-at-chat');
              // 尝试加入动画
              excludedNeighbor.el.style.animation = 'tryJoinChat 0.8s ease-in-out';
              trackedSetTimeout(() => {
                excludedNeighbor.el.style.animation = '';
                if (excludedNeighbor.state === 'idle') setEmotion(excludedNeighbor, 'neutral');
              }, 800);
            } else {
              // 没加入，变sad
              setEmotion(excludedNeighbor, 'sad');
              excludedNeighbor.el.classList.remove('peeking-at-chat');
              trackedSetTimeout(() => {
                if (excludedNeighbor.state === 'idle') setEmotion(excludedNeighbor, 'neutral');
              }, 1500);
            }
          }, 800); // 偷看800ms后反应
        }

        trackedSetTimeout(() => {
          trackedClearInterval(mouthInterval);
          a.el.style.animation = '';
          b.el.style.animation = '';
          exitSocial(a);
          exitSocial(b);
        }, 2200);
      });
    }

    // I18创新：跨组社交互动（20%概率触发Deep组和Learning组之间的互动）
    if (interactionConfig.socialWhisper && Math.random() < 0.2 && states.length >= 5) {
      availableInteractions.push(() => {
        // Deep组最后一个字母 (p, index 3) 和 Learning组第一个字母 (L, index 4)
        const deepLast = states[3];  // p
        const learningFirst = states[4];  // L
        if (!deepLast || !learningFirst || deepLast.state !== 'idle' || learningFirst.state !== 'idle') return;

        enterSocial(deepLast);
        enterSocial(learningFirst);

        // 跨组打招呼动画
        deepLast.el.style.animation = 'waveCrossGroup 1.5s ease-in-out';
        learningFirst.el.style.animation = 'waveCrossGroup 1.5s ease-in-out 0.2s';

        // 互相看对方
        setEmotion(deepLast, 'happy');
        setEmotion(learningFirst, 'happy');

        // 其他字母也转头看向他们
        const otherIndices = [0, 1, 2, 5, 6, 7, 8, 9, 10, 11];
        otherIndices.forEach(idx => {
          const s = states[idx];
          if (s && s.state === 'idle') {
            // 简单模拟转头（设置curious情绪）
            setEmotion(s, 'curious');
            trackedSetTimeout(() => {
              if (s.state === 'idle') setEmotion(s, 'neutral');
            }, 2000);
          }
        });

        trackedSetTimeout(() => {
          deepLast.el.style.animation = '';
          learningFirst.el.style.animation = '';
          exitSocial(deepLast);
          exitSocial(learningFirst);
        }, 1800);
      });
    }

    // 传递眼神
    if (interactionConfig.socialEyeContact) {
      availableInteractions.push(() => {
        const group = Math.random() > 0.5 ? [0, 1, 2, 3] : [4, 5, 6, 7, 8, 9, 10, 11];
        const localIdx = Math.floor(Math.random() * (group.length - 1));
        const a = states[group[localIdx]], b = states[group[localIdx + 1]];
        if (!a || !b || a.state !== 'idle' || b.state !== 'idle') return;

        enterSocial(a);
        enterSocial(b);

        // A 看 B
        const bPos = getCachedPosition(b.el);
        const aPos = getCachedPosition(a.el);
        const bRect = { left: bPos.left, top: bPos.top, width: bPos.width, height: bPos.height };
        const aRect = { left: aPos.left, top: aPos.top, width: aPos.width, height: aPos.height };
        const dx1 = (bRect.left + bRect.width / 2) - (aRect.left + aRect.width / 2);
        const dy1 = (bRect.top + bRect.height * 0.2) - (aRect.top + aRect.height * 0.2);
        const d1 = Math.min(Math.sqrt(dx1 * dx1 + dy1 * dy1) * PUPIL_DISTANCE_FACTOR, PUPIL_MAX_OFFSET);
        a.pupils.forEach(p => {
          p.style.transform = `translate(calc(-50% + ${Math.cos(Math.atan2(dy1, dx1)) * d1}px), calc(-50% + ${Math.sin(Math.atan2(dy1, dx1)) * d1}px)) scale(${a.pupilScale})`;
          p.style.transition = 'transform 0.3s ease';
        });

        // B 接收到后回看 A
        trackedSetTimeout(() => {
          const bPos2 = getCachedPosition(b.el);
          const aPos2 = getCachedPosition(a.el);
          const bRect2 = { left: bPos2.left, top: bPos2.top, width: bPos2.width, height: bPos2.height };
          const aRect2 = { left: aPos2.left, top: aPos2.top, width: aPos2.width, height: aPos2.height };
          const dx2 = (aRect2.left + aRect2.width / 2) - (bRect2.left + bRect2.width / 2);
          const dy2 = (aRect2.top + aRect2.height * 0.2) - (bRect2.top + bRect2.height * 0.2);
          const d2 = Math.min(Math.sqrt(dx2 * dx2 + dy2 * dy2) * PUPIL_DISTANCE_FACTOR, PUPIL_MAX_OFFSET);
          b.pupils.forEach(p => {
            p.style.transform = `translate(calc(-50% + ${Math.cos(Math.atan2(dy2, dx2)) * d2}px), calc(-50% + ${Math.sin(Math.atan2(dy2, dx2)) * d2}px)) scale(${b.pupilScale})`;
            p.style.transition = 'transform 0.3s ease';
          });

          // 开心
          trackedSetTimeout(() => {
            setEmotion(a, 'happy');
            setEmotion(b, 'happy');
          }, 400);

          // 恢复
          trackedSetTimeout(() => {
            [a, b].forEach(s => {
              s.pupils.forEach(p => { p.style.transition = ''; });
            });
            exitSocial(a);
            exitSocial(b);
          }, 1500);
        }, 800);
      });
    }

    // A8创新：庆祝跳跃（波浪节奏 + 落地冲击 + EASINGS.bounce）
    if (interactionConfig.socialCelebrate) {
      availableInteractions.push(() => {
        SoundEngine.play('celebrate');
        // 使用粒子引擎发射五彩纸屑
        const stageRect = stage.getBoundingClientRect();
        ParticleEngine.confetti(stageRect.left + stageRect.width / 2, stageRect.top + stageRect.height / 2, 30);
        states.forEach((s, i) => {
          if (s.state !== 'idle') return;
          enterSocial(s);
          s.el.style.animation = '';
          const delay = i * 80;
          const isEdge = i === 0 || i === chars.length - 1;
          const maxJump = isEdge ? -18 : -12 + Math.sin(i * 0.8) * 4;
          const stretchAmount = isEdge ? 1.08 : 1.05;

          trackedSetTimeout(() => {
            setEmotion(s, 'excited');
            // 使用EASINGS.bounce驱动的跳跃动画（替代硬编码分步）
            const jumpDuration = 500;
            const jumpStart = performance.now();
            function animateJump(now) {
              const elapsed = now - jumpStart;
              const t = Math.min(elapsed / jumpDuration, 1);
              const bounce = EASINGS.bounce(t);
              s.ty = maxJump * (1 - bounce);
              s.ts = 1 + (stretchAmount - 1) * (1 - bounce);
              if (t < 1) requestAnimationFrame(animateJump);
              else { s.ty = 0; s.ts = 1; }
            }
            requestAnimationFrame(animateJump);
            // 相邻字母击掌
            if (i > 0 && states[i - 1].state === 'social') {
              const arms = s.el.querySelectorAll('.letter-arm');
              const rightArm = arms[1];
              if (rightArm) {
                rightArm.style.animation = 'highFive 0.8s cubic-bezier(0.22, 1, 0.36, 1)';
                rightArm.style.opacity = '0.9';
                trackedSetTimeout(() => { rightArm.style.animation = ''; rightArm.style.opacity = ''; }, 800);
              }
            }
          }, delay);
        });

        trackedSetTimeout(() => {
          states.forEach(s => {
            if (s.state === 'social') exitSocial(s);
          });
        }, chars.length * 80 + 800);
      });
    }

    // 如果没有可用的社交互动，直接返回
    if (availableInteractions.length === 0) return;

    const action = availableInteractions[Math.floor(Math.random() * availableInteractions.length)];
    action();
  }

  function scheduleSocial() {
    if (!interactionConfig.socialInteractions || isDestroyed) return;
    const delay = 20000 + Math.random() * 20000; // 20-40秒
    trackedSetTimeout(() => {
      if (isDestroyed) return;
      if (!isPaused && interactionConfig.socialInteractions) {
        triggerSocialInteraction();
      }
      scheduleSocial();
    }, delay);
  }

  // ============================================================
  // 第十二部分：个性化待机动画
  // ============================================================
  const IDLE_KEYFRAMES = {
    D:  { name: 'idleD',  duration: '3.0s' },
    e:  { name: 'idleE',  duration: '2.5s' },
    e2: { name: 'idleE2', duration: '2.8s' },
    p:  { name: 'idleP',  duration: '3.2s' },
    L:  { name: 'idleL',  duration: '3.5s' },
    e3: { name: 'idleE3', duration: '2.2s' },
    a:  { name: 'idleA',  duration: '2.4s' },
    r:  { name: 'idleR',  duration: '1.8s' },
    n:  { name: 'idleN',  duration: '3.0s' },
    i:  { name: 'idleI',  duration: '2.6s' },
    n2: { name: 'idleN2', duration: '3.3s' },
    g:  { name: 'idleG',  duration: '2.8s' },
  };

  function startIdleAnimation(s) {
    const key = s.el.getAttribute('data-letter');
    const idle = IDLE_KEYFRAMES[key] || { name: 'idleD', duration: '3s' };
    s.el.style.animation = `${idle.name} ${idle.duration} ease-in-out infinite`;
  }

  function stopIdleAnimation(s) {
    s.el.style.animation = '';
  }

  // ============================================================
  // 第十三部分：启动系统
  // ============================================================

  // 重启动画循环的函数（当开关从全部关闭变为部分开启时调用）
  function restartAnimation() {
    if (!isPaused && !isDestroyed && !rafId) {
      rafId = requestAnimationFrame(animate);
    }
  }
  window.LetterSystem.restartAnimation = restartAnimation;

  if (!prefersReducedMotion) {
    rafId = requestAnimationFrame(animate);
    updateBodies(); // 初始调用
  }

  // 入场完成后启动 idle + 偷懒 + 社交
  const totalEntry = 800 + LETTER_CONFIGS[LETTER_CONFIGS.length - 1].delay * 1000 + 800;
  trackedSetTimeout(() => {
    if (prefersReducedMotion) return;
    chars.forEach((el, i) => {
      trackedSetTimeout(() => {
        startIdleAnimation(states[i]);
        scheduleLazy(states[i]);
      }, i * 300);
    });
    scheduleSocial();
  }, totalEntry);
}

// 导出适配test项目的接口
window.initLetterSystem = function(container) {
  initLetterStage();
};
window.destroyLetterSystem = function() {
  if (window.LetterSystem && window.LetterSystem.destroy) {
    window.LetterSystem.destroy();
  }
  const stage = document.getElementById('letterStage');
  if (stage) {
    stage.innerHTML = '';
    stage.dataset.initialized = '';
  }
};
