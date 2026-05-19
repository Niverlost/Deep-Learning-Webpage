/**
 * Letter System - Optimized for Apple-style Interactions
 * 状态管理系统 | 弹簧物理优化 | 呼吸动画自然度 | 节日装饰系统 | 移动端触摸支持 | 60fps性能保证
 */

const LETTER_CONFIG = {
  spring: {
    hover: { stiffness: 0.42, damping: 0.78, mass: 1.0 },
    body: { stiffness: 0.28, damping: 0.82, mass: 1.0 },
    scared: { stiffness: 0.52, damping: 0.68, mass: 1.1 },
    snake: { stiffness: 0.18, damping: 0.88, mass: 1.0 },
    emotion: { stiffness: 0.58, damping: 0.76, mass: 1.0 },
    breath: { stiffness: 0.08, damping: 0.95, mass: 1.0 },
  },
  interactions: {
    hoverElevation: 12,
    hoverScale: 1.08,
    scaredTriggerDist: 75,
    scaredRecoveryDist: 140,
    scaredSpeedThreshold: 22,
    pupilMaxOffset: 5,
    pupilTrackingFactor: 0.015,
    gradientFar: 420,
    gradientMid: 280,
    gradientNear: 140,
    tapDelay: 150,
    touchHoverDelay: 80,
  },
  snake: { speedThreshold: 30, consecutiveFrames: 6, cooldown: 5500, maxDuration: 4500, slowThreshold: 18 },
  lazy: {
    checkInterval: 5000,
    minInterval: 12000,
    actions: {
      zoneOut: { weight: 0.22, duration: [3500, 5500] },
      nodOff: { weight: 0.18, duration: [4500, 7500] },
      peek: { weight: 0.25, duration: [2500, 3500] },
      yawn: { weight: 0.15, duration: 2800 },
      stretch: { weight: 0.12, duration: 2200 },
      rubEyes: { weight: 0.08, duration: 1800 },
    },
    wakeTransition: 600,
    postSleepRubChance: 0.30,
  },
  social: { whisperInterval: 8000, whisperRange: 1.5, whisperDuration: 3000, whisperCooldown: 12000, eyeContactInterval: 5000, eyeContactDuration: 2200 },
  chorus: { tapCount: 5, tapWindow: 3000, staggerDelay: 120, jumpHeight: -20 },
  entrance: { defaultDuration: 0.8, leaderDuration: 1.0, wakeDuration: 0.9, maxDelay: 0.96, bufferMs: 200 },
  particle: { baseZIndex: 100 },
  memory: { celebrateEveryVisits: 5 },
  holiday: {
    christmas: { enabled: true, startMonth: 12, startDay: 1, endDay: 31 },
    newyear: { enabled: true, month: 1, days: 7 },
    midautumn: { enabled: true, month: 9, startDay: 13, endDay: 27 },
    springfestival: { enabled: true, startMonth: 1, startDay: 20, endMonth: 2, endDay: 15 },
  },
  touch: {
    longPressDelay: 500,
    swipeThreshold: 50,
    doubleTapDelay: 300,
    touchMoveThreshold: 8,
  },
  reducedMotion: {
    breathAmplitude: 0,
    springStiffnessMultiplier: 0.3,
    animationDurationMultiplier: 0.5,
  },
};

const LETTER_SEQUENCE = [
  { id: 'D', display: 'D' },
  { id: 'e', display: 'e' },
  { id: 'e2', display: 'e' },
  { id: 'p', display: 'p' },
  { id: 'space', display: null },
  { id: 'L', display: 'L' },
  { id: 'e3', display: 'e' },
  { id: 'a', display: 'a' },
  { id: 'r', display: 'r' },
  { id: 'n', display: 'n' },
  { id: 'i', display: 'i' },
  { id: 'n2', display: 'n' },
  { id: 'g', display: 'g' },
];

const EMOTION_PARAMS = {
  neutral:   { eyeClass: '',           mouthClass: '',     bodyTransform: '',                                          pupilScale: 1,    blush: false },
  happy:     { eyeClass: 'happy',     mouthClass: 'happy', bodyTransform: '',                                          pupilScale: 1,    blush: true  },
  surprised: { eyeClass: 'surprised', mouthClass: 'surprised', bodyTransform: 'rotate(-3deg) translateY(2px)',          pupilScale: 1.15, blush: false },
  scared:    { eyeClass: 'scared',    mouthClass: 'scared', bodyTransform: '',                                          pupilScale: 1.25, blush: false },
  sleepy:    { eyeClass: 'sleepy',    mouthClass: 'sleepy', bodyTransform: 'scaleY(0.95) rotate(1deg)',              pupilScale: 0.8, blush: false },
  yawning:   { eyeClass: 'sleepy',    mouthClass: 'yawning', bodyTransform: 'scaleY(0.97) rotate(1deg)',             pupilScale: 0.7, blush: false },
  sad:       { eyeClass: 'sad',       mouthClass: 'sad',    bodyTransform: 'scaleY(0.95) rotate(2deg)',              pupilScale: 0.9, blush: false },
  curious:   { eyeClass: 'curious',   mouthClass: 'curious', bodyTransform: 'rotate(2deg) translateY(-3px)',         pupilScale: 1.1, blush: false },
  bored:     { eyeClass: 'bored',     mouthClass: 'bored',  bodyTransform: 'scaleY(0.92) rotate(3deg) translateX(2px)', pupilScale: 0.6, blush: false },
  excited:   { eyeClass: '',          mouthClass: 'excited', bodyTransform: '',                                          pupilScale: 1.2, blush: true  },
  talking:   { eyeClass: '',          mouthClass: 'talking', bodyTransform: '',                                          pupilScale: 1,   blush: false },
};

const VALID_STATES = ['idle', 'hover', 'lazy', 'social', 'scared', 'snake', 'entering', 'exiting'];

const STATE_TRANSITIONS = {
  idle:     ['hover', 'lazy', 'social', 'scared', 'snake', 'entering'],
  hover:    ['idle', 'scared', 'snake', 'lazy'],
  lazy:     ['idle', 'hover', 'scared'],
  social:   ['idle', 'hover'],
  scared:   ['idle', 'hover'],
  snake:    ['idle'],
  entering: ['idle'],
  exiting:  [],
};

const STATE_PRIORITY = {
  scared: 100,
  snake: 90,
  social: 80,
  hover: 70,
  lazy: 60,
  idle: 50,
  entering: 40,
  exiting: 30,
};

function createTimerTracker() {
  const timers = new Map();
  let nextId = 1;
  function setTracked(fn, delay) {
    const id = nextId++;
    const timerId = setTimeout(() => {
      timers.delete(id);
      fn();
    }, delay);
    timers.set(id, { timerId, fn, delay });
    return id;
  }
  function clearTracked(id) {
    const entry = timers.get(id);
    if (entry) {
      clearTimeout(entry.timerId);
      timers.delete(id);
    }
  }
  function clearAll() {
    timers.forEach(entry => clearTimeout(entry.timerId));
    timers.clear();
  }
  function pauseAll() {
    timers.forEach((entry) => {
      clearTimeout(entry.timerId);
    });
  }
  function resumeAll() {
    const now = Date.now();
    timers.forEach((entry, id) => {
      entry.timerId = setTimeout(() => {
        timers.delete(id);
        entry.fn();
      }, Math.max(0, entry.delay));
    });
  }
  return {
    set: setTracked,
    clear: clearTracked,
    clearAll,
    pauseAll,
    resumeAll,
    size: () => timers.size,
    hasPending: () => timers.size > 0,
  };
}

function createSpring(stiffness, damping, mass) {
  return {
    current: 0,
    velocity: 0,
    target: 0,
    stiffness,
    damping,
    mass,
    restLength: 0,
  };
}

function updateSpring(spring, dt, prefersReducedMotion = false) {
  const dtSeconds = dt / 1000;
  let effectiveStiffness = spring.stiffness;
  let effectiveDamping = spring.damping;

  if (prefersReducedMotion) {
    effectiveStiffness *= LETTER_CONFIG.reducedMotion.springStiffnessMultiplier;
  }

  const displacement = spring.current - spring.target - spring.restLength;
  const springForce = -effectiveStiffness * displacement;
  const dampingForce = -spring.velocity * effectiveDamping * 0.1;
  const acceleration = (springForce + dampingForce) / spring.mass;

  spring.velocity += acceleration * dtSeconds;
  spring.current += spring.velocity * dtSeconds;
}

function createInteractionBus() {
  const listeners = new Map();
  function on(event, fn) {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event).add(fn);
    return () => off(event, fn);
  }
  function off(event, fn) {
    const set = listeners.get(event);
    if (set) set.delete(fn);
  }
  function once(event, fn) {
    const wrapper = (data) => {
      off(event, wrapper);
      fn(data);
    };
    return on(event, wrapper);
  }
  function emit(event, data) {
    const set = listeners.get(event);
    if (set) set.forEach(fn => {
      try {
        fn(data);
      } catch (e) {
        console.error(`Error in event listener for "${event}":`, e);
      }
    });
  }
  return { on, off, once, emit, listeners };
}

function createParticleEngine(canvas) {
  const ctx = canvas.getContext('2d');
  const particles = [];
  const PARTICLE_TYPES = {
    star:    { color: '#FFD700', size: 6,  life: 1200, gravity: -0.02, shape: 'star' },
    note:    { color: '#FF9F0A', size: 8,  life: 1500, gravity: -0.03, shape: 'note' },
    heart:   { color: '#FF453A', size: 7,  life: 1300, gravity: -0.02, shape: 'heart' },
    sweat:   { color: '#64D2FF', size: 4,  life: 800,  gravity: 0.08,  shape: 'drop' },
    tear:    { color: '#64D2FF', size: 4,  life: 1000, gravity: 0.06,  shape: 'drop' },
    zzz:     { color: '#BF5AF2', size: 10, life: 2000, gravity: -0.015, shape: 'text' },
    confetti: { color: '#FF375F', size: 5, life: 1800, gravity: 0.04, shape: 'rect' },
  };

  function spawn(x, y, type, count) {
    const template = PARTICLE_TYPES[type];
    if (!template) return;
    for (let i = 0; i < (count || 1); i++) {
      particles.push({
        x: x + (Math.random() - 0.5) * 20,
        y: y + (Math.random() - 0.5) * 10,
        vx: (Math.random() - 0.5) * 3,
        vy: (Math.random() - 0.5) * 3 - 1.5,
        life: template.life,
        maxLife: template.life,
        size: template.size * (0.8 + Math.random() * 0.4),
        color: template.color,
        gravity: template.gravity,
        shape: template.shape,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.15,
      });
    }
  }

  function update(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        particles[i] = particles[particles.length - 1];
        particles.pop();
        continue;
      }
      p.vy += p.gravity;
      p.x += p.vx;
      p.y += p.vy;
      p.rotation += p.rotSpeed;
    }
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const p of particles) {
      const alpha = Math.min(1, p.life / (p.maxLife * 0.3));
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.fillStyle = p.color;

      switch (p.shape) {
        case 'star':
          drawStar(ctx, 0, 0, p.size);
          break;
        case 'heart':
          drawHeart(ctx, 0, 0, p.size);
          break;
        case 'drop':
          ctx.beginPath();
          ctx.moveTo(0, -p.size);
          ctx.quadraticCurveTo(p.size, 0, 0, p.size);
          ctx.quadraticCurveTo(-p.size, 0, 0, -p.size);
          ctx.fill();
          break;
        case 'note':
          ctx.font = `${p.size * 2}px sans-serif`;
          ctx.fillText('♪', 0, 0);
          break;
        case 'text':
          ctx.font = `${p.size * 1.5}px sans-serif`;
          ctx.fillText('Z', 0, 0);
          break;
        case 'rect':
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
          break;
      }
      ctx.restore();
    }
  }

  function drawStar(ctx, cx, cy, r) {
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const outerAngle = (i * 2 * Math.PI / 5) - Math.PI / 2;
      const innerAngle = outerAngle + Math.PI / 5;
      ctx.lineTo(cx + Math.cos(outerAngle) * r, cy + Math.sin(outerAngle) * r);
      ctx.lineTo(cx + Math.cos(innerAngle) * r * 0.4, cy + Math.sin(innerAngle) * r * 0.4);
    }
    ctx.closePath();
    ctx.fill();
  }

  function drawHeart(ctx, cx, cy, s) {
    ctx.beginPath();
    ctx.moveTo(cx, cy + s * 0.3);
    ctx.bezierCurveTo(cx - s, cy - s * 0.5, cx - s * 0.5, cy - s, cx, cy - s * 0.5);
    ctx.bezierCurveTo(cx + s * 0.5, cy - s, cx + s, cy - s * 0.5, cx, cy + s * 0.3);
    ctx.fill();
  }

  function clear() {
    particles.length = 0;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  function getParticleCount() {
    return particles.length;
  }

  return { spawn, update, draw, clear, getParticleCount };
}

class LetterCharacter {
  constructor(id, display, container, index) {
    this.id = id;
    this.display = display;
    this.index = index;
    this.isSpace = id === 'space';
    this.element = null;
    this.bodyEl = null;
    this.pupils = [];
    this.shadowEl = null;
    this.springs = {
      x: createSpring(LETTER_CONFIG.spring.body.stiffness, LETTER_CONFIG.spring.body.damping, LETTER_CONFIG.spring.body.mass),
      y: createSpring(LETTER_CONFIG.spring.hover.stiffness, LETTER_CONFIG.spring.hover.damping, LETTER_CONFIG.spring.hover.mass),
      rotation: createSpring(LETTER_CONFIG.spring.body.stiffness, LETTER_CONFIG.spring.body.damping, LETTER_CONFIG.spring.body.mass),
      scaleX: createSpring(LETTER_CONFIG.spring.emotion.stiffness, LETTER_CONFIG.spring.emotion.damping, LETTER_CONFIG.spring.emotion.mass),
      scaleY: createSpring(LETTER_CONFIG.spring.emotion.stiffness, LETTER_CONFIG.spring.emotion.damping, LETTER_CONFIG.spring.emotion.mass),
    };
    this.fsmState = 'entering';
    this.previousState = null;
    this.stateHistory = [];
    this.emotion = 'neutral';
    this.timers = createTimerTracker();
    this.positionCache = { rect: null, timestamp: 0 };
    this.isHovered = false;
    this.isPressed = false;
    this.lazyAction = null;
    this.lastInteractionTime = Date.now();
    this.whisperCooldownUntil = 0;
    this.entranceComplete = false;
    this.breathPhase = Math.random() * Math.PI * 2;
    this.breathAmplitude = 0.4 + Math.random() * 0.2;
    this.breathSpeed = 0.8 + Math.random() * 0.4;
    this.blinkTimer = null;
    this.lastBlinkTime = 0;
    this.nextBlinkDelay = this._calculateNextBlinkDelay();
    this.consecutiveBlinks = 0;
    this.activityScore = 0;

    if (!this.isSpace) {
      this._buildDOM(container);
      this._startBlinking();
    } else {
      this._buildSpace(container);
    }
  }

  _calculateNextBlinkDelay() {
    const activityFactor = Math.max(0.5, Math.min(1.5, 1 + (this.activityScore - 50) / 100));
    const baseDelay = 2000 + Math.random() * 4000;
    return baseDelay * activityFactor;
  }

  _startBlinking() {
    this._scheduleNextBlink();
  }

  _scheduleNextBlink() {
    this.blinkTimer = setTimeout(() => {
      if (this.fsmState === 'idle' && !this.isHovered && this.element) {
        this._doBlink();
        this.activityScore = Math.max(0, this.activityScore - 5);
      }
      this._scheduleNextBlink();
    }, this.nextBlinkDelay);
    this.nextBlinkDelay = this._calculateNextBlinkDelay();
  }

  _doBlink() {
    if (!this.element) return;
    this.pupils.forEach(pupil => {
      pupil.classList.add('blink');
    });
    this.consecutiveBlinks++;
    setTimeout(() => {
      this.pupils.forEach(pupil => {
        pupil.classList.remove('blink');
      });
      if (this.consecutiveBlinks >= 2 && Math.random() < 0.3) {
        setTimeout(() => this._doBlink(), 150);
        this.consecutiveBlinks = 0;
      } else {
        this.consecutiveBlinks = 0;
      }
    }, 150);
  }

  updateActivity(delta) {
    this.activityScore = Math.max(0, Math.min(100, this.activityScore + delta));
  }

  _buildSpace(container) {
    const el = document.createElement('div');
    el.className = 'letter-space';
    container.appendChild(el);
    this.element = el;
  }

  _buildDOM(container) {
    const el = document.createElement('div');
    el.className = 'letter-char';
    el.setAttribute('data-letter', this.id);
    el.setAttribute('tabindex', '0');
    el.setAttribute('role', 'button');
    el.setAttribute('aria-label', '字母 ' + this.display);

    const body = document.createElement('div');
    body.className = 'letter-body';

    const text = document.createElement('span');
    text.className = 'letter-text';
    text.textContent = this.display;
    body.appendChild(text);

    const eyes = document.createElement('div');
    eyes.className = 'letter-eyes';
    for (let i = 0; i < 2; i++) {
      const eye = document.createElement('div');
      eye.className = 'letter-eye';
      const pupil = document.createElement('div');
      pupil.className = 'letter-pupil';
      eye.appendChild(pupil);
      eyes.appendChild(eye);
      this.pupils.push(pupil);
    }
    body.appendChild(eyes);

    const mouth = document.createElement('div');
    mouth.className = 'letter-mouth';
    body.appendChild(mouth);

    const blush1 = document.createElement('div');
    blush1.className = 'letter-blush';
    body.appendChild(blush1);

    const blush2 = document.createElement('div');
    blush2.className = 'letter-blush';
    body.appendChild(blush2);

    const armLeft = document.createElement('div');
    armLeft.className = 'letter-arm left';
    body.appendChild(armLeft);

    const armRight = document.createElement('div');
    armRight.className = 'letter-arm right';
    body.appendChild(armRight);

    el.appendChild(body);

    const shadow = document.createElement('div');
    shadow.className = 'letter-shadow';
    el.appendChild(shadow);

    container.appendChild(el);
    this.element = el;
    this.bodyEl = body;
    this.shadowEl = shadow;
    this.eyesEl = eyes;
    this.mouthEl = mouth;

    el.style.transition = 'none';
  }

  canTransitionTo(newState) {
    if (this.fsmState === newState) return false;
    const allowed = STATE_TRANSITIONS[this.fsmState];
    if (!allowed) return false;
    if (allowed.includes(newState)) return true;
    const currentPriority = STATE_PRIORITY[this.fsmState] || 0;
    const newPriority = STATE_PRIORITY[newState] || 0;
    return newPriority > currentPriority;
  }

  transitionTo(newState) {
    if (newState === this.fsmState) return false;

    const canTransition = this.canTransitionTo(newState);

    if (!canTransition) {
      if (STATE_PRIORITY[newState] > STATE_PRIORITY[this.fsmState]) {
        this._forceTransitionTo(newState);
        return true;
      }
      return false;
    }

    this._forceTransitionTo(newState);
    return true;
  }

  _forceTransitionTo(newState) {
    const oldState = this.fsmState;

    this.stateHistory.push({
      from: oldState,
      to: newState,
      timestamp: Date.now(),
    });
    if (this.stateHistory.length > 10) {
      this.stateHistory.shift();
    }

    this.previousState = oldState;
    this.fsmState = newState;
    this._onExitState(oldState);
    this._onEnterState(newState);
  }

  _onEnterState(newState) {
    switch (newState) {
      case 'hover':
        this.springs.y.target = -LETTER_CONFIG.interactions.hoverElevation;
        this.springs.scaleX.target = LETTER_CONFIG.interactions.hoverScale;
        this.springs.scaleY.target = LETTER_CONFIG.interactions.hoverScale;
        this.setEmotion('happy');
        this.updateActivity(10);
        break;
      case 'idle':
        this.springs.y.target = 0;
        this.springs.x.target = 0;
        this.springs.rotation.target = 0;
        this.springs.scaleX.target = 1;
        this.springs.scaleY.target = 1;
        if (this.emotion !== 'neutral') {
          this.timers.set(() => {
            if (this.fsmState === 'idle') this.setEmotion('neutral');
          }, 500);
        }
        break;
      case 'lazy':
        this.updateActivity(-20);
        break;
      case 'social':
        this.updateActivity(5);
        break;
      case 'scared':
        this.springs.x.target = 0;
        this.springs.y.target = 0;
        this.springs.rotation.target = 0;
        this.springs.scaleX.target = 1;
        this.springs.scaleY.target = 1;
        this.updateActivity(15);
        break;
      case 'snake':
        this.updateActivity(20);
        break;
      case 'entering':
        break;
      case 'exiting':
        this.springs.y.target = 50;
        this.springs.scaleX.target = 0.5;
        this.springs.scaleY.target = 0.5;
        this.springs.rotation.target = (Math.random() - 0.5) * 20;
        break;
    }
  }

  _onExitState(oldState) {
    if (oldState === 'lazy') {
      this.lazyAction = null;
      this.timers.clearAll();
    }
    if (oldState === 'scared') {
      this.springs.x.target = 0;
      this.springs.y.target = 0;
      this.springs.rotation.target = 0;
      this.springs.scaleX.target = 1;
      this.springs.scaleY.target = 1;
    }
    if (oldState === 'snake') {
      this.springs.x.target = 0;
      this.springs.y.target = 0;
      this.springs.rotation.target = 0;
    }
  }

  setEmotion(emotion, immediate = false) {
    if (this.emotion === emotion) return;
    const prev = this.emotion;
    this.emotion = emotion;
    const params = EMOTION_PARAMS[emotion];
    if (!params) return;

    const el = this.element;
    const allEmotions = Object.keys(EMOTION_PARAMS);
    allEmotions.forEach(e => el.classList.remove(e));
    if (emotion !== 'neutral') el.classList.add(emotion);

    const eyes = el.querySelectorAll('.letter-eye');
    eyes.forEach(eye => {
      allEmotions.forEach(e => eye.classList.remove(e));
      if (params.eyeClass) eye.classList.add(params.eyeClass);
    });

    const blushOpacity = params.blush ? 1 : 0;
    el.querySelectorAll('.letter-blush').forEach(blush => {
      blush.style.opacity = blushOpacity;
    });

    this.pupils.forEach(pupil => {
      pupil.style.setProperty('--pupil-scale', String(params.pupilScale));
    });

    if (!immediate && (prev !== 'neutral' || emotion !== 'neutral')) {
      this.springs.scaleX.velocity += (Math.random() - 0.5) * 0.3;
      this.springs.scaleY.velocity += (Math.random() - 0.5) * 0.3;
    }
  }

  updatePupils(mouseX, mouseY) {
    if (this.isSpace || !this.pupils.length) return;
    if (this.fsmState === 'lazy') return;

    const rect = this.getCachedRect();
    if (!rect) return;

    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height * 0.3;
    const dx = mouseX - cx;
    const dy = mouseY - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 1) return;

    const maxOff = LETTER_CONFIG.interactions.pupilMaxOffset;
    const factor = LETTER_CONFIG.interactions.pupilTrackingFactor;
    const offsetX = Math.sign(dx) * Math.min(dist * factor, maxOff);
    const offsetY = Math.sign(dy) * Math.min(dist * factor * 0.6, maxOff * 0.6);

    this.pupils.forEach(pupil => {
      pupil.style.transform = `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px)) scale(var(--pupil-scale))`;
    });
  }

  getCachedRect() {
    const now = Date.now();
    if (this.positionCache.rect && now - this.positionCache.timestamp < 100) {
      return this.positionCache.rect;
    }
    if (!this.element) return null;
    const rect = this.element.getBoundingClientRect();
    this.positionCache.rect = rect;
    this.positionCache.timestamp = now;
    return rect;
  }

  applyDistanceGradient(mouseX, mouseY) {
    if (this.isSpace) return;
    if (this.fsmState === 'lazy') return;
    if (this.fsmState === 'hover') return;
    if (this.fsmState === 'scared') return;
    if (this.fsmState === 'snake') return;

    const rect = this.getCachedRect();
    if (!rect) return;

    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = mouseX - cx;
    const dy = mouseY - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);

    const {
      gradientFar,
      gradientMid,
      gradientNear,
      scaredTriggerDist,
      scaredRecoveryDist,
    } = LETTER_CONFIG.interactions;

    if (dist < scaredTriggerDist) {
      this.triggerScared(dx);
      return;
    }

    if (this.fsmState === 'scared' && dist > scaredRecoveryDist) {
      this.transitionTo('idle');
      return;
    }

    if (dist < gradientNear) {
      const tiltAngle = -(dx / gradientNear) * 6;
      this.springs.rotation.target = tiltAngle;
      const elevation = (1 - dist / gradientNear) * 4;
      this.springs.y.target = -elevation;
    } else if (dist < gradientMid) {
      const tiltAngle = -(dx / gradientMid) * 3;
      this.springs.rotation.target = tiltAngle;
      this.springs.y.target = 0;
    } else {
      this.springs.rotation.target = 0;
      this.springs.y.target = 0;
    }
  }

  triggerScared(directionX) {
    if (!this.canTransitionTo('scared')) return;

    this.transitionTo('scared');
    this.setEmotion('scared');

    const pushDir = directionX > 0 ? -1 : 1;
    this.springs.x.target = pushDir * 18;
    this.springs.y.target = -14;
    this.springs.rotation.target = pushDir * 12;
    this.springs.scaleX.target = 0.82;
    this.springs.scaleY.target = 1.18;

    this.timers.set(() => {
      this.springs.x.target = 0;
      this.springs.y.target = 0;
      this.springs.rotation.target = 0;
      this.springs.scaleX.target = 1;
      this.springs.scaleY.target = 1;
      this.setEmotion('neutral');
      this.transitionTo('idle');
    }, 1000);
  }

  triggerTap(allChars) {
    this.setEmotion('happy');
    this.springs.scaleX.target = 0.88;
    this.springs.scaleY.target = 1.12;
    this.updateActivity(15);

    this.timers.set(() => {
      this.springs.scaleX.target = 1;
      this.springs.scaleY.target = 1;
      if (this.fsmState !== 'hover') {
        this.timers.set(() => {
          if (this.fsmState === 'idle') this.setEmotion('neutral');
        }, 800);
      }
    }, 200);

    allChars.forEach(c => {
      if (c !== this && !c.isSpace && (c.fsmState === 'idle' || c.fsmState === 'lazy')) {
        const rect = this.getCachedRect();
        const cRect = c.getCachedRect();
        if (rect && cRect) {
          c.updatePupils(rect.left + rect.width / 2, rect.top + rect.height * 0.3);
        }
      }
    });
  }

  triggerDoubleTap(particleEngine) {
    this.setEmotion('excited');
    this.springs.rotation.target = 360;
    this.springs.y.target = -22;
    this.updateActivity(25);

    this.timers.set(() => {
      this.springs.rotation.target = 0;
      this.springs.y.target = 0;
      this.timers.set(() => {
        if (this.fsmState !== 'hover') this.setEmotion('neutral');
      }, 600);
    }, 700);

    if (particleEngine && this.element) {
      const rect = this.getCachedRect();
      if (rect) {
        particleEngine.spawn(rect.left + rect.width / 2, rect.top, 'star', 8);
        particleEngine.spawn(rect.left + rect.width / 2, rect.top + 20, 'heart', 3);
      }
    }
  }

  triggerPress() {
    this.isPressed = true;
    this.setEmotion('surprised');
    this.springs.scaleX.target = 1.15;
    this.springs.scaleY.target = 0.85;
  }

  triggerRelease() {
    this.isPressed = false;
    this.springs.scaleX.target = 0.88;
    this.springs.scaleY.target = 1.12;

    this.timers.set(() => {
      this.springs.scaleX.target = 1;
      this.springs.scaleY.target = 1;
      if (this.fsmState !== 'hover') {
        this.timers.set(() => {
          if (this.fsmState === 'idle') this.setEmotion('neutral');
        }, 500);
      }
    }, 250);
  }

  startLazyAction() {
    if (this.fsmState !== 'idle') return;
    if (!this.canTransitionTo('lazy')) return;
    this.transitionTo('lazy');

    const actions = LETTER_CONFIG.lazy.actions;
    const entries = Object.entries(actions);
    const totalWeight = entries.reduce((sum, [, a]) => sum + a.weight, 0);
    let rand = Math.random() * totalWeight;
    let chosen = entries[0][0];

    for (const [name, action] of entries) {
      rand -= action.weight;
      if (rand <= 0) {
        chosen = name;
        break;
      }
    }

    this.lazyAction = chosen;
    const actionConfig = actions[chosen];
    const duration = Array.isArray(actionConfig.duration)
      ? actionConfig.duration[0] + Math.random() * (actionConfig.duration[1] - actionConfig.duration[0])
      : actionConfig.duration;

    switch (chosen) {
      case 'zoneOut':
        this.setEmotion('bored');
        break;
      case 'nodOff':
        this.setEmotion('sleepy');
        this._startNodding();
        break;
      case 'peek':
        this.setEmotion('curious');
        this.springs.rotation.target = (Math.random() < 0.5 ? -1 : 1) * 10;
        break;
      case 'yawn':
        this.setEmotion('yawning');
        this._startYawning();
        break;
      case 'stretch':
        this.element.classList.add('stretching');
        this.springs.scaleY.target = 1.15;
        this.springs.y.target = -10;
        break;
      case 'rubEyes':
        this.element.classList.add('rubbing-eyes');
        break;
    }

    this.timers.set(() => {
      this._endLazyAction();
    }, duration);
  }

  _startNodding() {
    let nodCount = 0;
    const maxNods = 3;
    const nodInterval = setInterval(() => {
      if (this.fsmState !== 'lazy' || this.lazyAction !== 'nodOff') {
        clearInterval(nodInterval);
        return;
      }
      nodCount++;
      if (nodCount > maxNods) {
        clearInterval(nodInterval);
        return;
      }
      const direction = nodCount % 2 === 0 ? 1 : -1;
      this.springs.rotation.target = direction * 5;
    }, 800);
    this.nodInterval = nodInterval;
  }

  _startYawning() {
    if (this.element) {
      this.element.classList.add('yawning-anim');
    }
  }

  _endLazyAction() {
    if (this.nodInterval) {
      clearInterval(this.nodInterval);
      this.nodInterval = null;
    }

    if (this.lazyAction === 'stretch') {
      this.element.classList.remove('stretching');
    }
    if (this.lazyAction === 'rubEyes') {
      this.element.classList.remove('rubbing-eyes');
    }
    if (this.lazyAction === 'yawn') {
      this.element.classList.remove('yawning-anim');
    }

    this.springs.y.target = 0;
    this.springs.rotation.target = 0;
    this.springs.scaleX.target = 1;
    this.springs.scaleY.target = 1;

    const wasSleepLike = this.lazyAction === 'nodOff' || this.lazyAction === 'yawn';
    this.lazyAction = null;
    this.transitionTo('idle');

    if (wasSleepLike && Math.random() < LETTER_CONFIG.lazy.postSleepRubChance) {
      this.timers.set(() => {
        if (this.fsmState === 'idle' && this.element) {
          this.element.classList.add('rubbing-eyes');
          this.timers.set(() => {
            if (this.element) this.element.classList.remove('rubbing-eyes');
          }, LETTER_CONFIG.lazy.actions.rubEyes.duration);
        }
      }, LETTER_CONFIG.lazy.wakeTransition);
    }
  }

  wakeUp() {
    if (this.fsmState === 'lazy') {
      this.timers.clearAll();
      if (this.nodInterval) {
        clearInterval(this.nodInterval);
        this.nodInterval = null;
      }
      this._endLazyAction();
    }
    this.lastInteractionTime = Date.now();
    this.updateActivity(20);
  }

  updateBreath(time, prefersReducedMotion) {
    if (this.isSpace) return;
    if (this.fsmState !== 'idle') return;

    const amplitude = prefersReducedMotion
      ? LETTER_CONFIG.reducedMotion.breathAmplitude
      : this.breathAmplitude;

    const breathPeriod = 3500 / this.breathSpeed;
    const breathOffset = Math.sin(time * (2 * Math.PI) / breathPeriod + this.breathPhase) * amplitude;
    if (this.springs.y.target === 0) {
      this.springs.y.target = breathOffset;
    }
  }

  destroy() {
    if (this.blinkTimer) {
      clearTimeout(this.blinkTimer);
      this.blinkTimer = null;
    }
    if (this.nodInterval) {
      clearInterval(this.nodInterval);
      this.nodInterval = null;
    }
    this.timers.clearAll();

    const holidayElements = this.element?.querySelectorAll('.holiday-hat, .holiday-lantern');
    holidayElements?.forEach(el => el.remove());

    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
    this.element = null;
    this.bodyEl = null;
    this.pupils = [];
    this.shadowEl = null;
  }
}

class LetterSystem {
  constructor(container) {
    this.container = container;
    this.characters = [];
    this.bus = createInteractionBus();
    this.particleEngine = null;
    this.canvas = null;
    this.rafId = null;
    this.isActive = false;
    this.mouseX = 0;
    this.mouseY = 0;
    this.prevMouseX = 0;
    this.prevMouseY = 0;
    this.mouseSpeed = 0;
    this.snakeFrames = 0;
    this.snakeActive = false;
    this.snakeCooldownUntil = 0;
    this.chorusTaps = [];
    this.lastTime = 0;
    this.lazyCheckTimer = null;
    this.socialWhisperTimer = null;
    this.socialEyeContactTimer = null;
    this.entrancePhase = false;
    this.prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.lastTapTime = 0;
    this.lastTappedChar = null;
    this.longPressTimer = null;
    this.isLongPress = false;
    this.touchStartPos = { x: 0, y: 0 };
    this.lastShadowUpdate = 0;
    this.holidayElements = [];
    this.frameCount = 0;
    this.lastFpsUpdate = performance.now();

    this._boundMouseMove = this._onMouseMove.bind(this);
    this._boundMouseDown = this._onMouseDown.bind(this);
    this._boundMouseUp = this._onMouseUp.bind(this);
    this._boundTouchStart = this._onTouchStart.bind(this);
    this._boundTouchMove = this._onTouchMove.bind(this);
    this._boundTouchEnd = this._onTouchEnd.bind(this);
    this._boundResize = this._onResize.bind(this);

    this._setupReducedMotionListener();
  }

  _setupReducedMotionListener() {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    mediaQuery.addEventListener('change', (e) => {
      this.prefersReducedMotion = e.matches;
      this.bus.emit('prefersReducedMotionChanged', { prefersReducedMotion: e.matches });
    });
  }

  init() {
    if (!this.container) return;
    this.isActive = true;

    this._setupCanvas();
    this._createCharacters();
    this._setupEvents();
    this._playEntrance();
    this._startSystems();
  }

  _setupCanvas() {
    this.canvas = document.createElement('canvas');
    this.canvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:' + LETTER_CONFIG.particle.baseZIndex;
    this.container.style.position = 'relative';
    this.container.appendChild(this.canvas);
    this._resizeCanvas();
    this.particleEngine = createParticleEngine(this.canvas);
    this._resizeObserver = new ResizeObserver(() => this._resizeCanvas());
    this._resizeObserver.observe(this.container);
  }

  _resizeCanvas() {
    const rect = this.container.getBoundingClientRect();
    this.canvas.width = rect.width;
    this.canvas.height = rect.height;
  }

  _createCharacters() {
    LETTER_SEQUENCE.forEach((item, index) => {
      const char = new LetterCharacter(item.id, item.display, this.container, index);
      this.characters.push(char);
    });
  }

  _setupEvents() {
    document.addEventListener('mousemove', this._boundMouseMove, { passive: true });
    document.addEventListener('mousedown', this._boundMouseDown);
    document.addEventListener('mouseup', this._boundMouseUp);
    document.addEventListener('touchstart', this._boundTouchStart, { passive: false });
    document.addEventListener('touchmove', this._boundTouchMove, { passive: true });
    document.addEventListener('touchend', this._boundTouchEnd, { passive: false });
    window.addEventListener('resize', this._boundResize, { passive: true });

    this.characters.forEach(char => {
      if (char.isSpace || !char.element) return;

      char.element.addEventListener('mouseenter', () => this._onCharHoverStart(char));
      char.element.addEventListener('mouseleave', () => this._onCharHoverEnd(char));
      char.element.addEventListener('click', (e) => this._onCharClick(char, e));
      char.element.addEventListener('dblclick', () => this._onCharDblClick(char));
      char.element.addEventListener('keydown', (e) => this._onCharKeydown(char, e));

      char.element.addEventListener('touchstart', (e) => this._onCharTouchStart(char, e), { passive: false });
      char.element.addEventListener('touchend', (e) => this._onCharTouchEnd(char, e), { passive: false });
    });
  }

  _onResize() {
    this._resizeCanvas();
  }

  _onMouseMove(e) {
    this.prevMouseX = this.mouseX;
    this.prevMouseY = this.mouseY;
    this.mouseX = e.clientX;
    this.mouseY = e.clientY;
    this.mouseSpeed = Math.sqrt(
      (this.mouseX - this.prevMouseX) ** 2 +
      (this.mouseY - this.prevMouseY) ** 2
    );
    this.bus.emit('move', { x: this.mouseX, y: this.mouseY, speed: this.mouseSpeed });
  }

  _onMouseDown(e) {
    this.bus.emit('press', { x: e.clientX, y: e.clientY });
    this.characters.forEach(char => {
      if (char.isSpace || !char.element) return;
      const rect = char.getCachedRect();
      if (rect && e.clientX >= rect.left && e.clientX <= rect.right &&
          e.clientY >= rect.top && e.clientY <= rect.bottom) {
        char.triggerPress();
      }
    });
  }

  _onMouseUp(e) {
    this.bus.emit('release', { x: e.clientX, y: e.clientY });
    this.characters.forEach(char => {
      if (char.isPressed) char.triggerRelease();
    });
  }

  _onTouchStart(e) {
    if (e.touches.length > 0) {
      const t = e.touches[0];
      this.touchStartPos = { x: t.clientX, y: t.clientY };
      this.mouseX = t.clientX;
      this.mouseY = t.clientY;
      this.bus.emit('press', { x: t.clientX, y: t.clientY });
    }
  }

  _onTouchMove(e) {
    if (e.touches.length > 0) {
      const t = e.touches[0];
      this.prevMouseX = this.mouseX;
      this.prevMouseY = this.mouseY;
      this.mouseX = t.clientX;
      this.mouseY = t.clientY;
      this.mouseSpeed = Math.sqrt(
        (this.mouseX - this.prevMouseX) ** 2 +
        (this.mouseY - this.prevMouseY) ** 2
      );
      this.bus.emit('move', { x: this.mouseX, y: this.mouseY, speed: this.mouseSpeed });
    }
  }

  _onTouchEnd(e) {
    this.bus.emit('release', { x: this.mouseX, y: this.mouseY });
    this.characters.forEach(char => {
      if (char.isPressed) char.triggerRelease();
    });
  }

  _onCharTouchStart(char, e) {
    e.preventDefault();
    const touch = e.touches[0];
    this.touchStartPos = { x: touch.clientX, y: touch.clientY };
    this.isLongPress = false;

    this.longPressTimer = setTimeout(() => {
      this.isLongPress = true;
      char.triggerPress();
      if (this.particleEngine) {
        const rect = char.getCachedRect();
        if (rect) {
          this.particleEngine.spawn(rect.left + rect.width / 2, rect.top, 'sweat', 2);
        }
      }
    }, LETTER_CONFIG.touch.longPressDelay);

    char.wakeUp();
  }

  _onCharTouchEnd(char, e) {
    e.preventDefault();

    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }

    if (this.isLongPress) {
      char.triggerRelease();
      this.isLongPress = false;
      return;
    }

    const now = Date.now();
    const dx = this.mouseX - this.touchStartPos.x;
    const dy = this.mouseY - this.touchStartPos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < LETTER_CONFIG.touch.swipeThreshold) {
      if (this.lastTappedChar === char && now - this.lastTapTime < LETTER_CONFIG.touch.doubleTapDelay) {
        this._onCharDblClick(char);
        this.lastTappedChar = null;
        this.lastTapTime = 0;
      } else {
        this._onCharClick(char, e);
        this.lastTappedChar = char;
        this.lastTapTime = now;
      }
    }
  }

  _onCharHoverStart(char) {
    if (this.entrancePhase) return;
    char.isHovered = true;
    char.lastInteractionTime = Date.now();
    char.wakeUp();
    char.transitionTo('hover');
    this.bus.emit('hover-start', { char });
  }

  _onCharHoverEnd(char) {
    char.isHovered = false;
    char.transitionTo('idle');
    this.bus.emit('hover-end', { char });
  }

  _onCharClick(char, e) {
    if (this.entrancePhase) return;
    char.lastInteractionTime = Date.now();
    char.wakeUp();
    char.triggerTap(this.characters);
    this._registerChorusTap();
    this.bus.emit('char-tap', { char });
  }

  _onCharDblClick(char) {
    if (this.entrancePhase) return;
    char.triggerDoubleTap(this.particleEngine);
    this.bus.emit('char-dbltap', { char });
  }

  _onCharKeydown(char, e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this._onCharClick(char, e);
    }
    if (e.key === 'Escape') {
      char.wakeUp();
      char.transitionTo('idle');
    }
  }

  _registerChorusTap() {
    const now = Date.now();
    this.chorusTaps.push(now);
    this.chorusTaps = this.chorusTaps.filter(t => now - t < LETTER_CONFIG.chorus.tapWindow);
    if (this.chorusTaps.length >= LETTER_CONFIG.chorus.tapCount) {
      this._triggerChorus();
      this.chorusTaps = [];
    }
  }

  _triggerChorus() {
    this.characters.forEach((char, i) => {
      if (char.isSpace) return;
      this._delayedAction(i * LETTER_CONFIG.chorus.staggerDelay, () => {
        if (char.fsmState === 'lazy') char.wakeUp();

        char.springs.y.target = LETTER_CONFIG.chorus.jumpHeight;
        char.setEmotion('excited');
        char.element.classList.add('chorus-singing');
        char.updateActivity(20);

        if (this.particleEngine) {
          const rect = char.getCachedRect();
          if (rect) {
            this.particleEngine.spawn(rect.left + rect.width / 2, rect.top, 'note', 2);
          }
        }

        char.timers.set(() => {
          char.springs.y.target = 0;
          char.element.classList.remove('chorus-singing');
          if (char.fsmState === 'idle') {
            char.timers.set(() => {
              char.setEmotion('neutral');
            }, 500);
          }
        }, 700);
      });
    });

    this.bus.emit('chorus-triggered');
  }

  _delayedAction(delay, fn) {
    setTimeout(fn, delay);
  }

  _playEntrance() {
    this.entrancePhase = true;
    const chars = this.characters.filter(c => !c.isSpace);
    const leader = chars[0];
    const followers = chars.slice(1);

    if (leader && leader.element) {
      leader.element.style.animation = `letterHeroEntrance ${LETTER_CONFIG.entrance.leaderDuration}s cubic-bezier(0.34, 1.56, 0.64, 1) forwards`;
    }

    followers.forEach((char, i) => {
      if (!char.element) return;
      const delay = (i + 1) * (LETTER_CONFIG.entrance.maxDelay / followers.length);
      char.element.style.opacity = '0';
      char.element.style.animation = `letterWakeEntrance ${LETTER_CONFIG.entrance.wakeDuration}s cubic-bezier(0.34, 1.56, 0.64, 1) ${delay}s forwards`;
    });

    const totalDuration = LETTER_CONFIG.entrance.maxDelay + LETTER_CONFIG.entrance.wakeDuration * 1000 + LETTER_CONFIG.entrance.bufferMs;
    setTimeout(() => {
      this.characters.forEach(char => {
        if (char.isSpace || !char.element) return;
        char.element.style.animation = '';
        char.element.style.opacity = '';
        char.element.style.transition = 'none';
        char.entranceComplete = true;
        char.transitionTo('idle');
      });

      this.characters.forEach(char => {
        if (char.isSpace || !char.element) return;
        char.element.style.animation = 'letterGroupReveal 0.6s ease forwards';
      });

      setTimeout(() => {
        this.characters.forEach(char => {
          if (char.isSpace || !char.element) return;
          char.element.style.animation = '';
        });
        this.entrancePhase = false;
        this.bus.emit('entrance-complete');
      }, 600);
    }, totalDuration);
  }

  _startSystems() {
    this.lastTime = performance.now();
    this._tick(this.lastTime);

    this.lazyCheckTimer = setInterval(() => this._checkLazyActions(), LETTER_CONFIG.lazy.checkInterval);
    this.socialWhisperTimer = setInterval(() => this._checkWhisper(), LETTER_CONFIG.social.whisperInterval);
    this.socialEyeContactTimer = setInterval(() => this._checkEyeContact(), LETTER_CONFIG.social.eyeContactInterval);

    this._checkCelebration();
    this._applyHolidayDecorations();
  }

  _applyHolidayDecorations() {
    if (this.prefersReducedMotion) return;

    const now = new Date();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const config = LETTER_CONFIG.holiday;

    const decorations = [];

    if (config.christmas.enabled && month === config.christmas.startMonth &&
        day >= config.christmas.startDay && day <= config.christmas.endDay) {
      decorations.push('christmas');
      this._applyChristmasDecoration();
    }

    if (config.newyear.enabled && month === config.newyear.month &&
        day <= config.newyear.days) {
      decorations.push('newyear');
      this._applyNewYearDecoration();
    }

    if (config.midautumn.enabled && month === config.midautumn.month &&
        day >= config.midautumn.startDay && day <= config.midautumn.endDay) {
      decorations.push('midautumn');
      this._applyMidAutumnDecoration();
    }

    if (config.springfestival.enabled) {
      let inRange = false;
      if (month === config.springfestival.startMonth && day >= config.springfestival.startDay) {
        inRange = true;
      } else if (month === config.springfestival.endMonth && day <= config.springfestival.endDay) {
        inRange = true;
      }
      if (inRange) {
        decorations.push('springfestival');
        this._applySpringFestivalDecoration();
      }
    }

    if (decorations.length > 0) {
      this.container.classList.add('holiday-active');
      this.bus.emit('holiday-decorated', { holidays: decorations });
    }
  }

  _applyChristmasDecoration() {
    this.container.classList.add('holiday-christmas');
    const chars = this.characters.filter(c => !c.isSpace);

    chars.forEach((char, i) => {
      if (i % 3 === 0 && char.element) {
        const hat = document.createElement('div');
        hat.className = 'holiday-hat santa-hat';
        hat.setAttribute('aria-hidden', 'true');
        char.element.appendChild(hat);
        this.holidayElements.push(hat);
      }
    });

    this._addHolidayStyle('.holiday-christmas', {
      background: 'linear-gradient(180deg, rgba(255,69,58,0.05) 0%, rgba(48,209,88,0.05) 100%)',
    });
  }

  _applyNewYearDecoration() {
    this.container.classList.add('holiday-newyear');
    const chars = this.characters.filter(c => !c.isSpace);

    chars.forEach(char => {
      if (char.element) {
        char.element.style.filter = 'drop-shadow(0 0 8px rgba(255, 215, 0, 0.6))';
      }
    });

    this._addHolidayStyle('.holiday-newyear', {
      background: 'linear-gradient(180deg, rgba(255,215,0,0.08) 0%, rgba(255,159,10,0.05) 100%)',
    });
  }

  _applyMidAutumnDecoration() {
    this.container.classList.add('holiday-midautumn');
    const chars = this.characters.filter(c => !c.isSpace);

    if (chars.length > 0) {
      const middleIdx = Math.floor(chars.length / 2);
      const middleChar = chars[middleIdx];
      if (middleChar.element) {
        middleChar.element.style.filter = 'drop-shadow(0 0 15px rgba(255, 200, 100, 0.7))';
      }
    }

    this._addHolidayStyle('.holiday-midautumn', {
      background: 'linear-gradient(180deg, rgba(255,180,50,0.08) 0%, rgba(200,150,50,0.05) 100%)',
    });
  }

  _applySpringFestivalDecoration() {
    this.container.classList.add('holiday-springfestival');
    const chars = this.characters.filter(c => !c.isSpace);

    chars.forEach((char, i) => {
      if (char.element) {
        const lantern = document.createElement('div');
        lantern.className = 'holiday-lantern';
        lantern.setAttribute('aria-hidden', 'true');
        char.element.appendChild(lantern);
        this.holidayElements.push(lantern);
      }
    });

    this._addHolidayStyle('.holiday-springfestival', {
      background: 'linear-gradient(180deg, rgba(255,55,95,0.08) 0%, rgba(255,215,0,0.05) 100%)',
    });
  }

  _addHolidayStyle(selector, styles) {
    let styleEl = document.getElementById('holiday-styles');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'holiday-styles';
      document.head.appendChild(styleEl);
    }
    styleEl.textContent += `${selector} { ${Object.entries(styles).map(([k, v]) => `${k}: ${v}`).join('; ')} }`;
  }

  _tick(time) {
    if (!this.isActive) return;
    const dt = Math.min(time - this.lastTime, 50);
    this.lastTime = time;

    this.frameCount++;
    if (time - this.lastFpsUpdate >= 1000) {
      this.lastFpsUpdate = time;
      this.frameCount = 0;
    }

    this._updateSnakeFollowing();
    this._updateAllSprings(dt);
    this._updatePupilTracking();
    this._updateDistanceGradient();
    this._updateBreath(time);
    this._applyTransforms();
    this._updateShadows();

    if (this.particleEngine) {
      this.particleEngine.update(dt);
      this.particleEngine.draw();
    }

    this.rafId = requestAnimationFrame((t) => this._tick(t));
  }

  _updateAllSprings(dt) {
    this.characters.forEach(char => {
      if (char.isSpace) return;
      Object.values(char.springs).forEach(spring => updateSpring(spring, dt, this.prefersReducedMotion));
    });
  }

  _updatePupilTracking() {
    if (this.prefersReducedMotion) return;
    this.characters.forEach(char => {
      if (char.isSpace || char.fsmState === 'lazy') return;
      char.updatePupils(this.mouseX, this.mouseY);
    });
  }

  _updateDistanceGradient() {
    if (this.prefersReducedMotion) return;
    this.characters.forEach(char => {
      if (char.isSpace || char.isHovered || char.fsmState === 'hover') return;
      char.applyDistanceGradient(this.mouseX, this.mouseY);
    });
  }

  _updateBreath(time) {
    this.characters.forEach(char => {
      char.updateBreath(time, this.prefersReducedMotion);
    });
  }

  _applyTransforms() {
    this.characters.forEach(char => {
      if (char.isSpace || !char.element) return;
      const { x, y, rotation, scaleX, scaleY } = char.springs;
      const tx = x.current;
      const ty = y.current;
      const rot = rotation.current;
      const sx = Math.max(0.1, scaleX.current);
      const sy = Math.max(0.1, scaleY.current);

      char.element.style.transform = `translate(${tx}px, ${ty}px) rotate(${rot}deg) scale(${sx}, ${sy})`;

      if (char.bodyEl && Math.abs(rot) > 0.5) {
        char.bodyEl.style.transform = `rotate(${-rot * 0.25}deg)`;
      } else if (char.bodyEl) {
        char.bodyEl.style.transform = '';
      }
    });
  }

  _updateShadows() {
    const now = performance.now();
    if (now - this.lastShadowUpdate < 16) return;
    this.lastShadowUpdate = now;

    this.characters.forEach(char => {
      if (char.isSpace || !char.shadowEl) return;
      const yOffset = char.springs.y.current;
      const absY = Math.abs(yOffset);
      const widthPct = Math.max(30, 60 - absY * 1.5);
      const opacity = Math.max(0.05, 0.2 - absY * 0.01);
      const blur = 3 + absY * 0.3;
      char.shadowEl.style.width = widthPct + '%';
      char.shadowEl.style.opacity = opacity;
      char.shadowEl.style.filter = `blur(${blur}px)`;
    });
  }

  _checkLazyActions() {
    if (!this.isActive) return;
    const now = Date.now();
    this.characters.forEach(char => {
      if (char.isSpace) return;
      if (char.fsmState !== 'idle') return;
      if (now - char.lastInteractionTime < LETTER_CONFIG.lazy.minInterval) return;
      if (Math.random() < 0.25) {
        char.startLazyAction();
      }
    });
  }

  _checkWhisper() {
    if (!this.isActive) return;
    if (this.prefersReducedMotion) return;

    const now = Date.now();
    const nonSpace = this.characters.filter(c => !c.isSpace);
    for (let i = 0; i < nonSpace.length - 1; i++) {
      const a = nonSpace[i];
      const b = nonSpace[i + 1];
      if (a.fsmState !== 'idle' || b.fsmState !== 'idle') continue;
      if (now < a.whisperCooldownUntil || now < b.whisperCooldownUntil) continue;
      if (Math.random() > 0.25) continue;

      a.transitionTo('social');
      b.transitionTo('social');
      a.setEmotion('talking');
      b.setEmotion('talking');

      if (a.element) a.element.style.animation = 'whisperLeft 2s ease-in-out';
      if (b.element) b.element.style.animation = 'whisperRight 2s ease-in-out';

      const dur = LETTER_CONFIG.social.whisperDuration;
      setTimeout(() => {
        if (a.element) a.element.style.animation = '';
        if (b.element) b.element.style.animation = '';
        a.transitionTo('idle');
        b.transitionTo('idle');
        a.whisperCooldownUntil = now + LETTER_CONFIG.social.whisperCooldown;
        b.whisperCooldownUntil = now + LETTER_CONFIG.social.whisperCooldown;
      }, dur);

      break;
    }
  }

  _checkEyeContact() {
    if (!this.isActive) return;
    if (this.prefersReducedMotion) return;

    const idleChars = this.characters.filter(c => !c.isSpace && c.fsmState === 'idle');
    if (idleChars.length < 2) return;

    const i = Math.floor(Math.random() * idleChars.length);
    let j;
    do {
      j = Math.floor(Math.random() * idleChars.length);
    } while (j === i);

    const a = idleChars[i];
    const b = idleChars[j];
    const aRect = a.getCachedRect();
    const bRect = b.getCachedRect();
    if (!aRect || !bRect) return;

    a.updatePupils(bRect.left + bRect.width / 2, bRect.top + bRect.height * 0.3);
    setTimeout(() => {
      b.updatePupils(aRect.left + aRect.width / 2, aRect.top + aRect.height * 0.3);
    }, LETTER_CONFIG.social.eyeContactDuration / 2);
  }

  _checkCelebration() {
    try {
      let visits = parseInt(localStorage.getItem('dl_visit_count') || '0', 10);
      visits++;
      localStorage.setItem('dl_visit_count', String(visits));
      if (visits % LETTER_CONFIG.memory.celebrateEveryVisits === 0) {
        setTimeout(() => this._triggerCelebration(), 2000);
      }
    } catch {}
  }

  _triggerCelebration() {
    if (this.particleEngine) {
      const rect = this.container.getBoundingClientRect();
      this.particleEngine.spawn(rect.left + rect.width / 2, rect.top + rect.height / 2, 'confetti', 20);
    }
    this._triggerChorus();
  }

  _updateSnakeFollowing() {
    if (this.prefersReducedMotion) return;

    const now = Date.now();

    if (this.mouseSpeed > LETTER_CONFIG.snake.speedThreshold) {
      this.snakeFrames++;
    } else if (this.mouseSpeed < LETTER_CONFIG.snake.slowThreshold) {
      this.snakeFrames = Math.max(0, this.snakeFrames - 1);
    }

    if (this.snakeFrames >= LETTER_CONFIG.snake.consecutiveFrames &&
        !this.snakeActive &&
        now > this.snakeCooldownUntil) {
      this.snakeActive = true;
      this.snakeFrames = 0;
      this._startSnakeFollowing();
      setTimeout(() => {
        this.snakeActive = false;
        this.snakeCooldownUntil = Date.now() + LETTER_CONFIG.snake.cooldown;
        this.characters.forEach(char => {
          if (char.isSpace) return;
          if (char.fsmState === 'snake') {
            char.springs.x.target = 0;
            char.springs.y.target = 0;
            char.springs.rotation.target = 0;
            char.transitionTo('idle');
          }
        });
      }, LETTER_CONFIG.snake.maxDuration);
    }
  }

  _startSnakeFollowing() {
    const nonSpace = this.characters.filter(c => !c.isSpace);
    nonSpace.forEach((char, i) => {
      if (char.fsmState === 'lazy') char.wakeUp();
      if (char.canTransitionTo('snake')) {
        char.transitionTo('snake');
      }

      const delay = i * 40;
      this._delayedAction(delay, () => {
        const rect = char.getCachedRect();
        if (!rect) return;
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = this.mouseX - cx;
        const dy = this.mouseY - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const maxPull = 18;
        const pull = Math.min(dist * 0.12, maxPull);
        const angle = Math.atan2(dy, dx);
        char.springs.x.target = Math.cos(angle) * pull;
        char.springs.y.target = Math.sin(angle) * pull;
        char.springs.rotation.target = (dx / 200) * 12;
      });
    });

    this.bus.emit('snake-started');
  }

  addCharacter(letter, options = {}) {
    const char = new LetterCharacter(letter, letter, this.container, this.characters.length);
    this.characters.push(char);
    return char;
  }

  removeCharacter(id) {
    const idx = this.characters.findIndex(c => c.id === id);
    if (idx === -1) return;
    this.characters[idx].destroy();
    this.characters.splice(idx, 1);
  }

  setEnabled(feature, enabled) {
    switch (feature) {
      case 'lazy':
        if (!enabled && this.lazyCheckTimer) {
          clearInterval(this.lazyCheckTimer);
          this.lazyCheckTimer = null;
        } else if (enabled && !this.lazyCheckTimer) {
          this.lazyCheckTimer = setInterval(() => this._checkLazyActions(), LETTER_CONFIG.lazy.checkInterval);
        }
        break;
      case 'social':
        if (!enabled && this.socialWhisperTimer) {
          clearInterval(this.socialWhisperTimer);
          this.socialWhisperTimer = null;
          clearInterval(this.socialEyeContactTimer);
          this.socialEyeContactTimer = null;
        } else if (enabled && !this.socialWhisperTimer) {
          this.socialWhisperTimer = setInterval(() => this._checkWhisper(), LETTER_CONFIG.social.whisperInterval);
          this.socialEyeContactTimer = setInterval(() => this._checkEyeContact(), LETTER_CONFIG.social.eyeContactInterval);
        }
        break;
      case 'snake':
        if (!enabled) {
          this.snakeActive = false;
          this.snakeFrames = 0;
          this.characters.forEach(char => {
            if (char.fsmState === 'snake') char.transitionTo('idle');
          });
        }
        break;
    }
    this.bus.emit('feature-toggled', { feature, enabled });
  }

  getState() {
    return {
      isActive: this.isActive,
      entrancePhase: this.entrancePhase,
      snakeActive: this.snakeActive,
      characterCount: this.characters.length,
      particleCount: this.particleEngine ? this.particleEngine.getParticleCount() : 0,
    };
  }

  destroy() {
    this.isActive = false;
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.lazyCheckTimer) { clearInterval(this.lazyCheckTimer); this.lazyCheckTimer = null; }
    if (this.socialWhisperTimer) { clearInterval(this.socialWhisperTimer); this.socialWhisperTimer = null; }
    if (this.socialEyeContactTimer) { clearInterval(this.socialEyeContactTimer); this.socialEyeContactTimer = null; }
    if (this._resizeObserver) { this._resizeObserver.disconnect(); this._resizeObserver = null; }

    this.holidayElements.forEach(el => {
      if (el.parentNode) el.parentNode.removeChild(el);
    });
    this.holidayElements = [];

    document.removeEventListener('mousemove', this._boundMouseMove);
    document.removeEventListener('mousedown', this._boundMouseDown);
    document.removeEventListener('mouseup', this._boundMouseUp);
    document.removeEventListener('touchstart', this._boundTouchStart);
    document.removeEventListener('touchmove', this._boundTouchMove);
    document.removeEventListener('touchend', this._boundTouchEnd);
    window.removeEventListener('resize', this._boundResize);
    this.characters.forEach(char => char.destroy());
    this.characters = [];
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
    this.canvas = null;
    this.particleEngine = null;
    this.bus.emit('destroyed');
  }
}

let _letterSystemInstance = null;

function initLetterSystem(container) {
  if (_letterSystemInstance) {
    _letterSystemInstance.destroy();
  }
  _letterSystemInstance = new LetterSystem(container);
  _letterSystemInstance.init();
  return _letterSystemInstance;
}

function createLetterCharacter(letter, container, options) {
  return new LetterCharacter(letter, letter, container, 0);
}

function destroyLetterSystem() {
  if (_letterSystemInstance) {
    _letterSystemInstance.destroy();
    _letterSystemInstance = null;
  }
}

function getLetterSystem() {
  return _letterSystemInstance;
}