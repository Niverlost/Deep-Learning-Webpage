// ============================================================
// Deep Learning Explorer - Letter System Module
// 字母小人系统（状态机、动画、交互）
// ============================================================

import { state } from './state.js';

// ==================== 交互状态机（FSM）====================

class LetterStateMachine {
  constructor() {
    this.state = 'idle';
    this.transitions = {
      idle: ['hover', 'lazy', 'social'],
      hover: ['idle', 'scared'],
      lazy: ['idle'],
      social: ['idle'],
      scared: ['idle']
    };
  }

  canTransition(to) {
    return this.transitions[this.state]?.includes(to);
  }

  transition(to) {
    if (this.canTransition(to)) {
      this.state = to;
      return true;
    }
    return false;
  }
}

// ==================== 字母小人动画状态 ====================

const LETTER_STATES = {
  IDLE: 'idle',
  WALKING: 'walking',
  RUNNING: 'running',
  JUMPING: 'jumping',
  THINKING: 'thinking',
  EXCITED: 'excited',
  SLEEPING: 'sleeping'
};

const LETTER_DIRECTIONS = {
  LEFT: -1,
  RIGHT: 1
};

// ==================== 字母小人配置 ====================

const LETTER_CONFIG = {
  width: 40,
  height: 60,
  speed: {
    walk: 1,
    run: 2
  },
  jumpForce: -8,
  gravity: 0.4,
  groundY: 0
};

// ==================== 字母小人类 ====================

/**
 * 字母小人类
 * @param {string} letter - 字母
 * @param {HTMLElement} container - 容器元素
 * @param {Object} [options={}] - 选项
 */
export class LetterCharacter {
  constructor(letter, container, options = {}) {
    this.letter = letter;
    this.container = container;
    this.x = options.x || 0;
    this.y = options.y || 0;
    this.vx = 0;
    this.vy = 0;
    this.state = LETTER_STATES.IDLE;
    this.direction = LETTER_DIRECTIONS.RIGHT;
    this.groundY = options.groundY || LETTER_CONFIG.groundY;
    this.isOnGround = true;
    this.animationFrame = 0;
    this.blinkTimer = 0;
    this.isBlinking = false;
    this.element = null;
    this.eyeElements = [];
    this.rafId = null;
    this.isDestroyed = false;
    this.fsm = new LetterStateMachine();
    this.timers = [];
    this.clickHandler = null;

    this.init();
  }

  init() {
    if (!this.container) return;
    this.element = document.createElement('div');
    this.element.className = 'letter-character';
    this.element.style.cssText = `
      position: absolute;
      width: ${LETTER_CONFIG.width}px;
      height: ${LETTER_CONFIG.height}px;
      left: ${this.x}px;
      top: ${this.y}px;
      cursor: pointer;
      user-select: none;
      z-index: 100;
    `;

    // 身体
    const body = document.createElement('div');
    body.className = 'letter-body';
    body.style.cssText = `
      width: 100%;
      height: 100%;
      background: linear-gradient(180deg, var(--accent-primary) 0%, var(--accent-secondary) 100%);
      border-radius: 8px 8px 4px 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      font-weight: bold;
      color: white;
      position: relative;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    `;
    body.textContent = this.letter;

    // 眼睛
    const eyeContainer = document.createElement('div');
    eyeContainer.style.cssText = `
      position: absolute;
      top: 8px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      gap: 4px;
    `;

    for (let i = 0; i < 2; i++) {
      const eye = document.createElement('div');
      eye.className = 'letter-eye';
      eye.style.cssText = `
        width: 6px;
        height: 6px;
        background: white;
        border-radius: 50%;
        position: relative;
      `;
      const pupil = document.createElement('div');
      pupil.className = 'letter-pupil';
      pupil.style.cssText = `
        width: 3px;
        height: 3px;
        background: #333;
        border-radius: 50%;
        position: absolute;
        top: 1.5px;
        left: 1.5px;
      `;
      eye.appendChild(pupil);
      eyeContainer.appendChild(eye);
      this.eyeElements.push({ eye, pupil });
    }

    body.appendChild(eyeContainer);

    // 腿
    const legs = document.createElement('div');
    legs.className = 'letter-legs';
    legs.style.cssText = `
      position: absolute;
      bottom: -8px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      gap: 8px;
    `;

    for (let i = 0; i < 2; i++) {
      const leg = document.createElement('div');
      leg.className = 'letter-leg';
      leg.style.cssText = `
        width: 6px;
        height: 10px;
        background: var(--accent-primary);
        border-radius: 0 0 3px 3px;
      `;
      legs.appendChild(leg);
    }

    body.appendChild(legs);
    this.element.appendChild(body);
    this.container.appendChild(this.element);

    // 点击交互
    this.clickHandler = () => this.onClick();
    this.element.addEventListener('click', this.clickHandler);

    // 鼠标悬停交互
    this.mouseenterHandler = () => this.enterHover();
    this.mouseleaveHandler = () => this.enterIdle();
    this.element.addEventListener('mouseenter', this.mouseenterHandler);
    this.element.addEventListener('mouseleave', this.mouseleaveHandler);

    // 开始动画循环
    this.startAnimation();
  }

  startAnimation() {
    if (this.isDestroyed) return;
    this.update();
    this.rafId = requestAnimationFrame(() => this.startAnimation());
  }

  update() {
    if (this.isDestroyed) return;

    this.animationFrame++;

    // 物理更新
    this.vy += LETTER_CONFIG.gravity;
    this.x += this.vx;
    this.y += this.vy;

    // 地面碰撞
    if (this.y >= this.groundY) {
      this.y = this.groundY;
      this.vy = 0;
      this.isOnGround = true;
      if (this.state === LETTER_STATES.JUMPING) {
        this.state = LETTER_STATES.IDLE;
      }
    } else {
      this.isOnGround = false;
    }

    // 边界检查
    const containerWidth = this.container.clientWidth || 800;
    if (this.x < 0) {
      this.x = 0;
      this.vx = 0;
    }
    if (this.x > containerWidth - LETTER_CONFIG.width) {
      this.x = containerWidth - LETTER_CONFIG.width;
      this.vx = 0;
    }

    // 状态动画
    this.updateAnimation();

    // 眨眼
    this.updateBlink();

    // 更新 DOM
    this.updateDOM();
  }

  updateAnimation() {
    const legs = this.element.querySelectorAll('.letter-leg');

    switch (this.state) {
      case LETTER_STATES.WALKING:
        legs.forEach((leg, i) => {
          const offset = Math.sin(this.animationFrame * 0.15 + i * Math.PI) * 4;
          leg.style.transform = `translateY(${offset}px)`;
        });
        this.element.style.transform = `translateY(${Math.sin(this.animationFrame * 0.1) * 1}px)`;
        break;

      case LETTER_STATES.RUNNING:
        legs.forEach((leg, i) => {
          const offset = Math.sin(this.animationFrame * 0.25 + i * Math.PI) * 6;
          leg.style.transform = `translateY(${offset}px)`;
        });
        this.element.style.transform = `translateY(${Math.sin(this.animationFrame * 0.15) * 2}px)`;
        break;

      case LETTER_STATES.JUMPING:
        legs.forEach(leg => {
          leg.style.transform = 'translateY(-3px)';
        });
        break;

      case LETTER_STATES.THINKING:
        this.element.style.transform = `translateY(${Math.sin(this.animationFrame * 0.05) * 2}px)`;
        break;

      case LETTER_STATES.EXCITED:
        this.element.style.transform = `scale(${1 + Math.sin(this.animationFrame * 0.2) * 0.05})`;
        break;

      case LETTER_STATES.SLEEPING:
        this.element.style.transform = `rotate(${Math.sin(this.animationFrame * 0.03) * 2}deg)`;
        break;

      default:
        legs.forEach(leg => {
          leg.style.transform = 'translateY(0)';
        });
        this.element.style.transform = 'none';
    }
  }

  updateBlink() {
    this.blinkTimer++;
    if (this.blinkTimer > 150 + Math.random() * 100) {
      this.isBlinking = true;
      this.eyeElements.forEach(({ eye }) => {
        eye.style.height = '1px';
      });
      if (this.blinkTimer > 155 + Math.random() * 100) {
        this.isBlinking = false;
        this.blinkTimer = 0;
        this.eyeElements.forEach(({ eye }) => {
          eye.style.height = '6px';
        });
      }
    }
  }

  updateDOM() {
    if (!this.element) return;
    this.element.style.left = this.x + 'px';
    this.element.style.top = this.y + 'px';

    // 方向翻转
    const scaleX = this.direction === LETTER_DIRECTIONS.LEFT ? -1 : 1;
    this.element.querySelector('.letter-body').style.transform = `scaleX(${scaleX})`;
  }

  // ==================== 动作控制 ====================

  walk(direction) {
    this.direction = direction;
    this.vx = direction * LETTER_CONFIG.speed.walk;
    this.state = LETTER_STATES.WALKING;
  }

  run(direction) {
    this.direction = direction;
    this.vx = direction * LETTER_CONFIG.speed.run;
    this.state = LETTER_STATES.RUNNING;
  }

  jump() {
    if (this.isOnGround) {
      this.vy = LETTER_CONFIG.jumpForce;
      this.state = LETTER_STATES.JUMPING;
    }
  }

  stop() {
    this.vx = 0;
    if (this.isOnGround) {
      this.state = LETTER_STATES.IDLE;
    }
  }

  think() {
    this.vx = 0;
    this.state = LETTER_STATES.THINKING;
  }

  excited() {
    this.vx = 0;
    this.state = LETTER_STATES.EXCITED;
  }

  sleep() {
    this.vx = 0;
    this.state = LETTER_STATES.SLEEPING;
  }

  wake() {
    if (this.isOnGround) {
      this.state = LETTER_STATES.IDLE;
    }
  }

  // ==================== FSM 交互状态转换 ====================

  enterHover() {
    if (this.fsm.transition('hover')) {
      this.excited();
    }
  }

  enterIdle() {
    if (this.fsm.transition('idle')) {
      if (this.isOnGround) {
        this.state = LETTER_STATES.IDLE;
      }
    }
  }

  enterLazy() {
    if (this.fsm.transition('lazy')) {
      this.sleep();
    }
  }

  enterSocial() {
    if (this.fsm.transition('social')) {
      this.think();
    }
  }

  triggerScaredBounce() {
    if (this.fsm.transition('scared')) {
      this.vy = LETTER_CONFIG.jumpForce * 0.7;
      this.state = LETTER_STATES.JUMPING;
      const timer = setTimeout(() => {
        this.fsm.transition('idle');
        if (this.isOnGround) {
          this.state = LETTER_STATES.IDLE;
        }
      }, 800);
      this.timers.push(timer);
    }
  }

  // ==================== 交互 ====================

  onClick() {
    this.triggerScaredBounce();
  }

  // ==================== 销毁 ====================

  destroy() {
    this.isDestroyed = true;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.timers.forEach(timer => clearTimeout(timer));
    this.timers = [];
    if (this.clickHandler && this.element) {
      this.element.removeEventListener('click', this.clickHandler);
      this.clickHandler = null;
    }
    if (this.mouseenterHandler && this.element) {
      this.element.removeEventListener('mouseenter', this.mouseenterHandler);
      this.mouseenterHandler = null;
    }
    if (this.mouseleaveHandler && this.element) {
      this.element.removeEventListener('mouseleave', this.mouseleaveHandler);
      this.mouseleaveHandler = null;
    }
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
      this.element = null;
    }
  }
}

// ==================== 字母小人管理器 ====================

/**
 * 字母小人管理器
 * @param {HTMLElement} container - 容器元素
 */
export class LetterSystem {
  constructor(container) {
    this.container = container;
    this.characters = new Map();
    this.isActive = false;
    this.randomBehaviorTimer = null;
  }

  init() {
    if (!this.container) return;
    this.isActive = true;

    // 创建示例字母小人
    const letters = ['D', 'L', 'E'];
    letters.forEach((letter, index) => {
      const char = new LetterCharacter(letter, this.container, {
        x: 50 + index * 60,
        y: this.container.clientHeight - 80 || 400,
        groundY: this.container.clientHeight - 80 || 400
      });
      this.characters.set(letter, char);
    });

    // 随机行为
    this.startRandomBehavior();
  }

  startRandomBehavior() {
    if (!this.isActive) return;

    this.characters.forEach(char => {
      if (Math.random() < 0.3) {
        const actions = ['walk', 'run', 'jump', 'think', 'sleep'];
        const action = actions[Math.floor(Math.random() * actions.length)];
        const direction = Math.random() < 0.5 ? LETTER_DIRECTIONS.LEFT : LETTER_DIRECTIONS.RIGHT;

        switch (action) {
          case 'walk':
            char.walk(direction);
            char.timers.push(setTimeout(() => char.stop(), 2000 + Math.random() * 2000));
            break;
          case 'run':
            char.run(direction);
            char.timers.push(setTimeout(() => char.stop(), 1000 + Math.random() * 1000));
            break;
          case 'jump':
            char.jump();
            break;
          case 'think':
            char.think();
            char.timers.push(setTimeout(() => char.wake(), 3000));
            break;
          case 'sleep':
            char.sleep();
            char.timers.push(setTimeout(() => char.wake(), 4000));
            break;
        }
      }
    });

    this.randomBehaviorTimer = setTimeout(() => this.startRandomBehavior(), 3000 + Math.random() * 2000);
  }

  addCharacter(letter, options = {}) {
    if (this.characters.has(letter)) return;
    const char = new LetterCharacter(letter, this.container, options);
    this.characters.set(letter, char);
    return char;
  }

  removeCharacter(letter) {
    const char = this.characters.get(letter);
    if (char) {
      char.destroy();
      this.characters.delete(letter);
    }
  }

  destroy() {
    this.isActive = false;
    if (this.randomBehaviorTimer) {
      clearTimeout(this.randomBehaviorTimer);
      this.randomBehaviorTimer = null;
    }
    this.characters.forEach(char => char.destroy());
    this.characters.clear();
  }
}

// ==================== 导出便捷函数 ====================

let _letterSystemInstance = null;

/**
 * 初始化字母小人系统
 * @param {HTMLElement} container - 容器元素
 * @returns {LetterSystem} 字母小人系统实例
 */
export function initLetterSystem(container) {
  if (_letterSystemInstance) {
    _letterSystemInstance.destroy();
  }
  _letterSystemInstance = new LetterSystem(container);
  _letterSystemInstance.init();
  return _letterSystemInstance;
}

/** 创建单个字母小人 */
export function createLetterCharacter(letter, container, options) {
  return new LetterCharacter(letter, container, options);
}

/**
 * 销毁字母小人系统
 */
export function destroyLetterSystem() {
  if (_letterSystemInstance) {
    _letterSystemInstance.destroy();
    _letterSystemInstance = null;
  }
}
