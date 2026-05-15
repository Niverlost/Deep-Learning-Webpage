import { state } from './state.js';

const CONFIG = {
  spring: {
    hover: { stiffness: 0.35, damping: 0.55, mass: 1.0 },
    body: { stiffness: 0.20, damping: 0.70, mass: 1.0 },
    scared: { stiffness: 0.30, damping: 0.50, mass: 1.2 },
    snake: { stiffness: 0.08, damping: 0.85, mass: 1.0 },
    emotion: { stiffness: 0.40, damping: 0.60, mass: 1.0 },
    breath: { stiffness: 0.05, damping: 0.90, mass: 1.0 },
  },
  interactions: {
    hoverElevation: 6,
    hoverScale: 1.05,
    scaredTriggerDist: 80,
    scaredRecoveryDist: 120,
    scaredSpeedThreshold: 15,
    pupilMaxOffset: 4,
    pupilTrackingFactor: 0.008,
    gradientFar: 300,
    gradientMid: 200,
    gradientNear: 100,
    tapDelay: 200,
    touchHoverDelay: 120,
  },
  snake: { speedThreshold: 25, consecutiveFrames: 3, cooldown: 3000, maxDuration: 3000, slowThreshold: 15 },
  lazy: {
    checkInterval: 3000, minInterval: 5000,
    actions: {
      zoneOut: { weight: 0.30, duration: [3000, 5000] },
      nodOff: { weight: 0.25, duration: [4000, 7000] },
      peek: { weight: 0.20, duration: [2000, 3000] },
      yawn: { weight: 0.10, duration: 2500 },
      stretch: { weight: 0.10, duration: 2000 },
      rubEyes: { weight: 0.05, duration: 1500 },
    },
    wakeTransition: 400, postSleepRubChance: 0.30,
  },
  social: { whisperInterval: 5000, whisperRange: 1.5, whisperDuration: 2000, whisperCooldown: 8000, eyeContactInterval: 3000, eyeContactDuration: 1500 },
  chorus: { tapCount: 5, tapWindow: 2000, staggerDelay: 80, jumpHeight: -12 },
  entrance: { defaultDuration: 0.8, leaderDuration: 1.0, wakeDuration: 0.9, maxDelay: 0.96, bufferMs: 200 },
  particle: { baseZIndex: 100 },
  memory: { celebrateEveryVisits: 5 },
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
  neutral:  { eyeClass: '',           mouthClass: '',        bodyTransform: '',                                      pupilScale: 1,   blush: false },
  happy:    { eyeClass: 'happy',      mouthClass: 'happy',   bodyTransform: '',                                      pupilScale: 1,   blush: true  },
  surprised:{ eyeClass: 'surprised',  mouthClass: 'surprised',bodyTransform: 'rotate(-3deg) translateY(2px)',         pupilScale: 1.15,blush: false },
  scared:   { eyeClass: 'scared',     mouthClass: 'scared',  bodyTransform: '',                                      pupilScale: 1.2, blush: false },
  sleepy:   { eyeClass: 'sleepy',     mouthClass: 'sleepy',  bodyTransform: 'scaleY(0.95) rotate(1deg)',             pupilScale: 0.8, blush: false },
  yawning:  { eyeClass: 'sleepy',     mouthClass: 'yawning', bodyTransform: 'scaleY(0.97) rotate(1deg)',             pupilScale: 0.7, blush: false },
  sad:      { eyeClass: 'sad',        mouthClass: 'sad',     bodyTransform: 'scaleY(0.95) rotate(2deg)',             pupilScale: 0.9, blush: false },
  curious:  { eyeClass: 'curious',    mouthClass: 'curious', bodyTransform: 'rotate(2deg) translateY(-3px)',         pupilScale: 1.1, blush: false },
  bored:    { eyeClass: 'bored',      mouthClass: 'bored',   bodyTransform: 'scaleY(0.92) rotate(3deg) translateX(2px)', pupilScale: 0.6, blush: false },
  excited:  { eyeClass: '',           mouthClass: 'excited', bodyTransform: '',                                      pupilScale: 1.2, blush: true  },
  talking:  { eyeClass: '',           mouthClass: 'talking', bodyTransform: '',                                      pupilScale: 1,   blush: false },
};

const VALID_STATES = ['idle', 'hover', 'lazy', 'social', 'scared'];
const STATE_TRANSITIONS = {
  idle:    ['hover', 'lazy', 'social', 'scared'],
  hover:   ['idle', 'scared'],
  lazy:    ['idle'],
  social:  ['idle'],
  scared:  ['idle'],
};

function createTimerTracker() {
  const timers = new Map();
  let nextId = 1;
  function setTracked(fn, delay) {
    const id = nextId++;
    const timerId = setTimeout(() => { timers.delete(id); fn(); }, delay);
    timers.set(id, { timerId, fn, delay });
    return id;
  }
  function clearTracked(id) {
    const entry = timers.get(id);
    if (entry) { clearTimeout(entry.timerId); timers.delete(id); }
  }
  function clearAll() { timers.forEach(entry => clearTimeout(entry.timerId)); timers.clear(); }
  return { set: setTracked, clear: clearTracked, clearAll, size: () => timers.size };
}

function createSpring(stiffness, damping, mass) {
  return {
    current: 0,
    velocity: 0,
    target: 0,
    stiffness,
    damping,
    mass,
  };
}

function updateSpring(spring, dt) {
  const force = (spring.target - spring.current) * spring.stiffness;
  spring.velocity = (spring.velocity + force * spring.mass) * spring.damping;
  spring.current += spring.velocity;
}

function createInteractionBus() {
  const listeners = new Map();
  function on(event, fn) {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event).add(fn);
  }
  function off(event, fn) {
    const set = listeners.get(event);
    if (set) set.delete(fn);
  }
  function emit(event, data) {
    const set = listeners.get(event);
    if (set) set.forEach(fn => fn(data));
  }
  return { on, off, emit };
}

function createParticleEngine(canvas) {
  const ctx = canvas.getContext('2d');
  const particles = [];
  const PARTICLE_TYPES = {
    star:    { color: '#FFD700', size: 6,  life: 1200, gravity: -0.02, shape: 'star' },
    note:    { color: '#FF9600', size: 8,  life: 1500, gravity: -0.03, shape: 'note' },
    heart:   { color: '#FF4B4B', size: 7,  life: 1300, gravity: -0.02, shape: 'heart' },
    sweat:   { color: '#5AC8FA', size: 4,  life: 800,  gravity: 0.08,  shape: 'drop' },
    tear:    { color: '#5AC8FA', size: 4,  life: 1000, gravity: 0.06,  shape: 'drop' },
    zzz:     { color: '#CE82FF', size: 10, life: 2000, gravity: -0.015,shape: 'text' },
  };

  function spawn(x, y, type, count) {
    const template = PARTICLE_TYPES[type];
    if (!template) return;
    for (let i = 0; i < (count || 1); i++) {
      particles.push({
        x: x + (Math.random() - 0.5) * 20,
        y: y + (Math.random() - 0.5) * 10,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2 - 1,
        life: template.life,
        maxLife: template.life,
        size: template.size * (0.8 + Math.random() * 0.4),
        color: template.color,
        gravity: template.gravity,
        shape: template.shape,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.1,
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

      if (p.shape === 'star') {
        drawStar(ctx, 0, 0, p.size);
      } else if (p.shape === 'heart') {
        drawHeart(ctx, 0, 0, p.size);
      } else if (p.shape === 'drop') {
        ctx.beginPath();
        ctx.moveTo(0, -p.size);
        ctx.quadraticCurveTo(p.size, 0, 0, p.size);
        ctx.quadraticCurveTo(-p.size, 0, 0, -p.size);
        ctx.fill();
      } else if (p.shape === 'note') {
        ctx.font = `${p.size * 2}px sans-serif`;
        ctx.fillText('♪', 0, 0);
      } else if (p.shape === 'text') {
        ctx.font = `${p.size * 1.5}px sans-serif`;
        ctx.fillText('Z', 0, 0);
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

  return { spawn, update, draw, clear };
}

export class LetterCharacter {
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
      x: createSpring(CONFIG.spring.body.stiffness, CONFIG.spring.body.damping, CONFIG.spring.body.mass),
      y: createSpring(CONFIG.spring.hover.stiffness, CONFIG.spring.hover.damping, CONFIG.spring.hover.mass),
      rotation: createSpring(CONFIG.spring.body.stiffness, CONFIG.spring.body.damping, CONFIG.spring.body.mass),
      scaleX: createSpring(CONFIG.spring.emotion.stiffness, CONFIG.spring.emotion.damping, CONFIG.spring.emotion.mass),
      scaleY: createSpring(CONFIG.spring.emotion.stiffness, CONFIG.spring.emotion.damping, CONFIG.spring.emotion.mass),
    };
    this.fsmState = 'idle';
    this.previousState = null;
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

    if (!this.isSpace) {
      this._buildDOM(container);
    } else {
      this._buildSpace(container);
    }
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

  transitionTo(newState) {
    if (!STATE_TRANSITIONS[this.fsmState]?.includes(newState)) return false;
    const oldState = this.fsmState;
    this.previousState = oldState;
    this.fsmState = newState;
    this._onExitState(oldState);
    this._onEnterState(newState);
    return true;
  }

  _onEnterState(newState) {
    switch (newState) {
      case 'hover':
        this.springs.y.target = -CONFIG.interactions.hoverElevation;
        this.springs.scaleX.target = CONFIG.interactions.hoverScale;
        this.springs.scaleY.target = CONFIG.interactions.hoverScale;
        this.setEmotion('happy');
        break;
      case 'idle':
        this.springs.y.target = 0;
        this.springs.x.target = 0;
        this.springs.rotation.target = 0;
        this.springs.scaleX.target = 1;
        this.springs.scaleY.target = 1;
        if (this.emotion !== 'neutral') this.setEmotion('neutral');
        break;
      case 'lazy':
        break;
      case 'social':
        break;
      case 'scared':
        break;
    }
  }

  _onExitState(oldState) {
    if (oldState === 'lazy') {
      this.lazyAction = null;
      this.timers.clearAll();
    }
  }

  setEmotion(emotion) {
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

    this.pupils.forEach(pupil => {
      pupil.style.setProperty('--pupil-scale', String(params.pupilScale));
    });

    if (prev !== 'neutral' || emotion !== 'neutral') {
      this.springs.scaleX.velocity += (Math.random() - 0.5) * 0.5;
      this.springs.scaleY.velocity += (Math.random() - 0.5) * 0.5;
    }
  }

  updatePupils(mouseX, mouseY) {
    if (this.isSpace || !this.pupils.length) return;
    const rect = this.getCachedRect();
    if (!rect) return;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height * 0.3;
    const dx = mouseX - cx;
    const dy = mouseY - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1) return;
    const maxOff = CONFIG.interactions.pupilMaxOffset;
    const factor = CONFIG.interactions.pupilTrackingFactor;
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
    if (this.isSpace || this.fsmState === 'lazy') return;
    const rect = this.getCachedRect();
    if (!rect) return;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = mouseX - cx;
    const dy = mouseY - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const { gradientFar, gradientNear, scaredTriggerDist, scaredRecoveryDist, scaredSpeedThreshold } = CONFIG.interactions;

    if (dist < scaredTriggerDist && this.fsmState !== 'scared' && this.fsmState !== 'hover') {
      this.triggerScared(dx);
      return;
    }

    if (this.fsmState === 'scared' && dist > scaredRecoveryDist) {
      this.transitionTo('idle');
      return;
    }

    if (dist < gradientNear && this.fsmState === 'idle') {
      const tiltAngle = -(dx / gradientNear) * 5;
      this.springs.rotation.target = tiltAngle;
      const elevation = (1 - dist / gradientNear) * 3;
      this.springs.y.target = -elevation;
    } else if (dist < gradientMid && this.fsmState === 'idle') {
      const tiltAngle = -(dx / gradientMid) * 2;
      this.springs.rotation.target = tiltAngle;
      this.springs.y.target = 0;
    } else if (dist < gradientFar && this.fsmState === 'idle') {
      this.springs.rotation.target = 0;
      this.springs.y.target = 0;
    } else if (this.fsmState === 'idle') {
      this.springs.rotation.target = 0;
      this.springs.y.target = 0;
    }
  }

  triggerScared(directionX) {
    if (!this.transitionTo('scared')) return;
    this.setEmotion('scared');
    const pushDir = directionX > 0 ? -1 : 1;
    this.springs.x.target = pushDir * 12;
    this.springs.y.target = -10;
    this.springs.rotation.target = pushDir * 8;
    this.springs.scaleX.target = 0.9;
    this.springs.scaleY.target = 1.1;
    const scareDx = pushDir * 8;
    this.element.style.setProperty('--scare-dx', scareDx + 'px');
    this.timers.set(() => {
      this.springs.x.target = 0;
      this.springs.y.target = 0;
      this.springs.rotation.target = 0;
      this.springs.scaleX.target = 1;
      this.springs.scaleY.target = 1;
      this.transitionTo('idle');
    }, 800);
  }

  triggerTap(allChars) {
    this.setEmotion('happy');
    this.springs.scaleX.target = 0.9;
    this.springs.scaleY.target = 1.1;
    this.timers.set(() => {
      this.springs.scaleX.target = 1;
      this.springs.scaleY.target = 1;
    }, 200);
    allChars.forEach(c => {
      if (c !== this && !c.isSpace && c.fsmState === 'idle') {
        const rect = this.getCachedRect();
        const cRect = c.getCachedRect();
        if (rect && cRect) {
          const dx = rect.left - cRect.left;
          c.updatePupils(rect.left + rect.width / 2, rect.top + rect.height * 0.3);
        }
      }
    });
  }

  triggerDoubleTap(particleEngine) {
    this.setEmotion('excited');
    this.springs.rotation.target = 360;
    this.springs.y.target = -15;
    this.timers.set(() => {
      this.springs.rotation.target = 0;
      this.springs.y.target = 0;
      if (this.fsmState !== 'hover') this.setEmotion('neutral');
    }, 600);
    if (particleEngine && this.element) {
      const rect = this.getCachedRect();
      if (rect) {
        particleEngine.spawn(rect.left + rect.width / 2, rect.top, 'star', 5);
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
    this.springs.scaleX.target = 0.92;
    this.springs.scaleY.target = 1.1;
    this.timers.set(() => {
      this.springs.scaleX.target = 1;
      this.springs.scaleY.target = 1;
      if (this.fsmState !== 'hover') this.setEmotion('neutral');
    }, 300);
  }

  startLazyAction() {
    if (this.fsmState !== 'idle') return;
    if (!this.transitionTo('lazy')) return;

    const actions = CONFIG.lazy.actions;
    const entries = Object.entries(actions);
    const totalWeight = entries.reduce((sum, [, a]) => sum + a.weight, 0);
    let rand = Math.random() * totalWeight;
    let chosen = entries[0][0];
    for (const [name, action] of entries) {
      rand -= action.weight;
      if (rand <= 0) { chosen = name; break; }
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
        this.springs.rotation.target = 5;
        break;
      case 'peek':
        this.setEmotion('curious');
        this.springs.rotation.target = (Math.random() < 0.5 ? -1 : 1) * 8;
        break;
      case 'yawn':
        this.setEmotion('yawning');
        break;
      case 'stretch':
        this.element.classList.add('stretching');
        this.springs.scaleY.target = 1.12;
        this.springs.y.target = -8;
        break;
      case 'rubEyes':
        this.element.classList.add('rubbing-eyes');
        break;
    }

    this.timers.set(() => {
      this._endLazyAction();
    }, duration);
  }

  _endLazyAction() {
    if (this.lazyAction === 'stretch') {
      this.element.classList.remove('stretching');
    }
    if (this.lazyAction === 'rubEyes') {
      this.element.classList.remove('rubbing-eyes');
    }

    this.springs.y.target = 0;
    this.springs.rotation.target = 0;
    this.springs.scaleX.target = 1;
    this.springs.scaleY.target = 1;

    const wasSleepLike = this.lazyAction === 'nodOff' || this.lazyAction === 'yawn';
    this.transitionTo('idle');

    if (wasSleepLike && Math.random() < CONFIG.lazy.postSleepRubChance) {
      this.timers.set(() => {
        if (this.fsmState === 'idle') {
          this.element.classList.add('rubbing-eyes');
          this.timers.set(() => {
            this.element.classList.remove('rubbing-eyes');
          }, CONFIG.lazy.actions.rubEyes.duration);
        }
      }, CONFIG.lazy.wakeTransition);
    }
  }

  wakeUp() {
    if (this.fsmState === 'lazy') {
      this.timers.clearAll();
      this._endLazyAction();
    }
    this.lastInteractionTime = Date.now();
  }

  updateBreath(time) {
    if (this.isSpace) return;
    if (this.fsmState !== 'idle') return;
    const breathOffset = Math.sin(time * 0.002 + this.breathPhase) * 0.8;
    this.springs.y.target = this.springs.y.target + breathOffset * 0.1;
  }

  destroy() {
    this.timers.clearAll();
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
    this.element = null;
    this.bodyEl = null;
    this.pupils = [];
    this.shadowEl = null;
  }
}

export class LetterSystem {
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
    this._boundMouseMove = this._onMouseMove.bind(this);
    this._boundMouseDown = this._onMouseDown.bind(this);
    this._boundMouseUp = this._onMouseUp.bind(this);
    this._boundTouchStart = this._onTouchStart.bind(this);
    this._boundTouchMove = this._onTouchMove.bind(this);
    this._boundTouchEnd = this._onTouchEnd.bind(this);
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
    this.canvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:' + CONFIG.particle.baseZIndex;
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
    document.addEventListener('mousemove', this._boundMouseMove);
    document.addEventListener('mousedown', this._boundMouseDown);
    document.addEventListener('mouseup', this._boundMouseUp);
    document.addEventListener('touchstart', this._boundTouchStart, { passive: true });
    document.addEventListener('touchmove', this._boundTouchMove, { passive: true });
    document.addEventListener('touchend', this._boundTouchEnd);

    this.characters.forEach(char => {
      if (char.isSpace || !char.element) return;
      char.element.addEventListener('mouseenter', () => this._onCharHoverStart(char));
      char.element.addEventListener('mouseleave', () => this._onCharHoverEnd(char));
      char.element.addEventListener('click', (e) => this._onCharClick(char, e));
      char.element.addEventListener('dblclick', () => this._onCharDblClick(char));
    });
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
  }

  _onCharDblClick(char) {
    if (this.entrancePhase) return;
    char.triggerDoubleTap(this.particleEngine);
  }

  _registerChorusTap() {
    const now = Date.now();
    this.chorusTaps.push(now);
    this.chorusTaps = this.chorusTaps.filter(t => now - t < CONFIG.chorus.tapWindow);
    if (this.chorusTaps.length >= CONFIG.chorus.tapCount) {
      this._triggerChorus();
      this.chorusTaps = [];
    }
  }

  _triggerChorus() {
    this.characters.forEach((char, i) => {
      if (char.isSpace) return;
      this._delayedAction(i * CONFIG.chorus.staggerDelay, () => {
        char.springs.y.target = CONFIG.chorus.jumpHeight;
        char.setEmotion('excited');
        char.element.classList.add('chorus-singing');
        if (this.particleEngine) {
          const rect = char.getCachedRect();
          if (rect) {
            this.particleEngine.spawn(rect.left + rect.width / 2, rect.top, 'note', 2);
          }
        }
        char.timers.set(() => {
          char.springs.y.target = 0;
          char.element.classList.remove('chorus-singing');
          if (char.fsmState !== 'hover') char.setEmotion('neutral');
        }, 600);
      });
    });
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
      leader.element.style.animation = `letterHeroEntrance ${CONFIG.entrance.leaderDuration}s cubic-bezier(0.34, 1.56, 0.64, 1) forwards`;
    }

    followers.forEach((char, i) => {
      if (!char.element) return;
      const delay = (i + 1) * (CONFIG.entrance.maxDelay / followers.length);
      char.element.style.opacity = '0';
      char.element.style.animation = `letterWakeEntrance ${CONFIG.entrance.wakeDuration}s cubic-bezier(0.34, 1.56, 0.64, 1) ${delay}s forwards`;
    });

    const totalDuration = CONFIG.entrance.maxDelay + CONFIG.entrance.wakeDuration * 1000 + CONFIG.entrance.bufferMs;
    setTimeout(() => {
      this.characters.forEach(char => {
        if (char.isSpace || !char.element) return;
        char.element.style.animation = '';
        char.element.style.opacity = '';
        char.element.style.transition = 'none';
        char.entranceComplete = true;
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
      }, 600);
    }, totalDuration);
  }

  _startSystems() {
    this.lastTime = performance.now();
    this._tick(this.lastTime);

    this.lazyCheckTimer = setInterval(() => this._checkLazyActions(), CONFIG.lazy.checkInterval);
    this.socialWhisperTimer = setInterval(() => this._checkWhisper(), CONFIG.social.whisperInterval);
    this.socialEyeContactTimer = setInterval(() => this._checkEyeContact(), CONFIG.social.eyeContactInterval);

    this._checkCelebration();
  }

  _tick(time) {
    if (!this.isActive) return;
    const dt = Math.min(time - this.lastTime, 50);
    this.lastTime = time;

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
      Object.values(char.springs).forEach(spring => updateSpring(spring, dt));
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
      char.updateBreath(time);
    });
  }

  _applyTransforms() {
    this.characters.forEach(char => {
      if (char.isSpace || !char.element) return;
      const { x, y, rotation, scaleX, scaleY } = char.springs;
      const tx = x.current;
      const ty = y.current;
      const rot = rotation.current;
      const sx = scaleX.current;
      const sy = scaleY.current;

      char.element.style.transform = `translate(${tx}px, ${ty}px) rotate(${rot}deg) scale(${sx}, ${sy})`;

      if (char.bodyEl && Math.abs(rot) > 0.5) {
        char.bodyEl.style.transform = `rotate(${-rot * 0.25}deg)`;
      } else if (char.bodyEl) {
        char.bodyEl.style.transform = '';
      }
    });
  }

  _updateShadows() {
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
      if (now - char.lastInteractionTime < CONFIG.lazy.minInterval) return;
      if (Math.random() < 0.3) {
        char.startLazyAction();
      }
    });
  }

  _checkWhisper() {
    if (!this.isActive) return;
    const now = Date.now();
    const nonSpace = this.characters.filter(c => !c.isSpace);
    for (let i = 0; i < nonSpace.length - 1; i++) {
      const a = nonSpace[i];
      const b = nonSpace[i + 1];
      if (a.fsmState !== 'idle' || b.fsmState !== 'idle') continue;
      if (now < a.whisperCooldownUntil || now < b.whisperCooldownUntil) continue;
      if (Math.random() > 0.3) continue;

      a.transitionTo('social');
      b.transitionTo('social');
      a.setEmotion('talking');
      b.setEmotion('talking');

      if (a.element) a.element.style.animation = 'whisperLeft 2s ease-in-out';
      if (b.element) b.element.style.animation = 'whisperRight 2s ease-in-out';

      const dur = CONFIG.social.whisperDuration;
      setTimeout(() => {
        if (a.element) a.element.style.animation = '';
        if (b.element) b.element.style.animation = '';
        a.transitionTo('idle');
        b.transitionTo('idle');
        a.whisperCooldownUntil = now + CONFIG.social.whisperCooldown;
        b.whisperCooldownUntil = now + CONFIG.social.whisperCooldown;
      }, dur);

      break;
    }
  }

  _checkEyeContact() {
    if (!this.isActive) return;
    const idleChars = this.characters.filter(c => !c.isSpace && c.fsmState === 'idle');
    if (idleChars.length < 2) return;
    const i = Math.floor(Math.random() * idleChars.length);
    let j;
    do { j = Math.floor(Math.random() * idleChars.length); } while (j === i);

    const a = idleChars[i];
    const b = idleChars[j];
    const aRect = a.getCachedRect();
    const bRect = b.getCachedRect();
    if (!aRect || !bRect) return;

    a.updatePupils(bRect.left + bRect.width / 2, bRect.top + bRect.height * 0.3);
    setTimeout(() => {
      b.updatePupils(aRect.left + aRect.width / 2, aRect.top + aRect.height * 0.3);
    }, CONFIG.social.eyeContactDuration / 2);
  }

  _checkCelebration() {
    try {
      let visits = parseInt(localStorage.getItem('dl_visit_count') || '0', 10);
      visits++;
      localStorage.setItem('dl_visit_count', String(visits));
      if (visits % CONFIG.memory.celebrateEveryVisits === 0) {
        setTimeout(() => this._triggerChorus(), 2000);
      }
    } catch {}
  }

  _updateSnakeFollowing() {
    if (this.prefersReducedMotion) return;
    const now = Date.now();

    if (this.mouseSpeed > CONFIG.snake.speedThreshold) {
      this.snakeFrames++;
    } else if (this.mouseSpeed < CONFIG.snake.slowThreshold) {
      this.snakeFrames = Math.max(0, this.snakeFrames - 1);
    }

    if (this.snakeFrames >= CONFIG.snake.consecutiveFrames && !this.snakeActive && now > this.snakeCooldownUntil) {
      this.snakeActive = true;
      this.snakeFrames = 0;
      this._startSnakeFollowing();
      setTimeout(() => {
        this.snakeActive = false;
        this.snakeCooldownUntil = Date.now() + CONFIG.snake.cooldown;
        this.characters.forEach(char => {
          if (char.isSpace) return;
          if (char.fsmState !== 'idle') return;
          char.springs.x.target = 0;
          char.springs.y.target = 0;
          char.springs.rotation.target = 0;
        });
      }, CONFIG.snake.maxDuration);
    }
  }

  _startSnakeFollowing() {
    const nonSpace = this.characters.filter(c => !c.isSpace);
    nonSpace.forEach((char, i) => {
      if (char.fsmState === 'lazy') char.wakeUp();
      const delay = i * 30;
      this._delayedAction(delay, () => {
        const rect = char.getCachedRect();
        if (!rect) return;
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = this.mouseX - cx;
        const dy = this.mouseY - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const maxPull = 15;
        const pull = Math.min(dist * 0.1, maxPull);
        const angle = Math.atan2(dy, dx);
        char.springs.x.target = Math.cos(angle) * pull;
        char.springs.y.target = Math.sin(angle) * pull;
        char.springs.rotation.target = (dx / 200) * 10;
      });
    });
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

  destroy() {
    this.isActive = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.lazyCheckTimer) { clearInterval(this.lazyCheckTimer); this.lazyCheckTimer = null; }
    if (this.socialWhisperTimer) { clearInterval(this.socialWhisperTimer); this.socialWhisperTimer = null; }
    if (this.socialEyeContactTimer) { clearInterval(this.socialEyeContactTimer); this.socialEyeContactTimer = null; }
    if (this._resizeObserver) { this._resizeObserver.disconnect(); this._resizeObserver = null; }
    document.removeEventListener('mousemove', this._boundMouseMove);
    document.removeEventListener('mousedown', this._boundMouseDown);
    document.removeEventListener('mouseup', this._boundMouseUp);
    document.removeEventListener('touchstart', this._boundTouchStart);
    document.removeEventListener('touchmove', this._boundTouchMove);
    document.removeEventListener('touchend', this._boundTouchEnd);
    this.characters.forEach(char => char.destroy());
    this.characters = [];
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
    this.canvas = null;
    this.particleEngine = null;
  }
}

let _letterSystemInstance = null;

export function initLetterSystem(container) {
  if (_letterSystemInstance) {
    _letterSystemInstance.destroy();
  }
  _letterSystemInstance = new LetterSystem(container);
  _letterSystemInstance.init();
  return _letterSystemInstance;
}

export function createLetterCharacter(letter, container, options) {
  return new LetterCharacter(letter, letter, container, 0);
}

export function destroyLetterSystem() {
  if (_letterSystemInstance) {
    _letterSystemInstance.destroy();
    _letterSystemInstance = null;
  }
}
