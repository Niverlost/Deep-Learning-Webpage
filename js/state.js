// ============================================================
// Deep Learning Explorer - State Module
// 状态管理（createStore、全局状态、localStorage 持久化）
// ============================================================

import { CONFIG, safeSetItem } from './utils.js';

// 动态导入 showToast 避免循环依赖
let showToastRef = null;

/**
 * 显示错误提示（懒加载 showToast 避免循环依赖）
 * @param {string} message - 错误消息
 */
function showError(message) {
  if (!showToastRef) {
    import('./ui-components.js').then(m => {
      showToastRef = m.showToast;
      showToastRef(message, 'error');
    }).catch(() => {
      console.error('[Error]', message);
    });
  } else {
    showToastRef(message, 'error');
  }
}

// ==================== 全局状态 ====================

/**
 * 全局应用状态对象
 * @type {Object}
 */
export const state = {
  models: [],
  currentView: '',
  currentParams: {},
  currentCategory: '',
  isAdmin: false,
  pendingLoginCallback: null,
  vizState: {
    selectedBlock: null,
    expandedBlock: null,
    expandedPath: [],
    params: {}
  }
};

// ==================== 模型对比系统 ====================

/**
 * 模型对比状态
 * @type {Object}
 */
export const compareState = {
  enabled: false,
  selected: []
};

// ==================== 数据管理 ====================

/**
 * 验证模型数据格式
 * @param {Array} data - 模型数据数组
 * @returns {boolean} 数据是否有效
 */
function validateModelData(data) {
  if (!Array.isArray(data) || data.length === 0) return false;
  const required = ['id', 'name', 'category', 'year', 'description'];
  return data.every(m => required.every(key => key in m));
}

/**
 * 从 localStorage 加载缓存的模型数据
 * @param {boolean} forceRefresh - 是否强制刷新
 * @returns {Array|null} 模型数据或 null
 */
function loadCachedModels(forceRefresh) {
  if (forceRefresh) {
    localStorage.removeItem(CONFIG.STORAGE_KEY);
    localStorage.removeItem(CONFIG.STORAGE_KEY + '_ts');
    localStorage.setItem(CONFIG.STORAGE_VERSION_KEY, CONFIG.DATA_VERSION);
    return null;
  }

  try {
    const savedVersion = localStorage.getItem(CONFIG.STORAGE_VERSION_KEY);
    const savedData = localStorage.getItem(CONFIG.STORAGE_KEY);

    if (savedVersion === CONFIG.DATA_VERSION && savedData) {
      try {
        const data = JSON.parse(savedData);
        if (validateModelData(data)) {
          return data;
        }
      } catch (e) {
        console.warn('localStorage 数据解析失败，清除缓存');
        localStorage.removeItem(CONFIG.STORAGE_KEY);
      }
    } else {
      localStorage.removeItem(CONFIG.STORAGE_KEY);
      localStorage.removeItem(CONFIG.STORAGE_KEY + '_ts');
      localStorage.setItem(CONFIG.STORAGE_VERSION_KEY, CONFIG.DATA_VERSION);
    }
  } catch (e) {
    console.warn('localStorage 访问失败:', e);
    try { localStorage.removeItem(CONFIG.STORAGE_KEY); } catch {}
    try { localStorage.removeItem(CONFIG.STORAGE_KEY + '_ts'); } catch {}
  }
  return null;
}

/**
 * 缓存模型数据到 localStorage
 * @param {Array} data - 模型数据数组
 */
function cacheModelData(data) {
  try {
    localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(data));
    localStorage.setItem(CONFIG.STORAGE_KEY + '_ts', String(Date.now()));
  } catch (e) {
    console.warn('localStorage 保存失败（可能存储已满）:', e);
  }
}

/**
 * 从网络加载模型数据
 * @returns {Promise<Array>} 模型数据数组
 */
async function fetchModelData() {
  const resp = await fetch('assets/models.json?t=' + Date.now());
  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
  }
  let data;
  try {
    data = await resp.json();
  } catch (e) {
    throw new Error('models.json 解析失败：不是有效的 JSON 格式');
  }
  if (!validateModelData(data)) {
    throw new Error('models.json 数据格式不正确或为空');
  }
  return data;
}

/**
 * 加载模型数据（优先 localStorage，其次 models.json）
 * @param {number} [retryCount=0] - 当前重试次数
 * @returns {Promise<Array>} 模型数据数组
 */
export async function loadModels(retryCount = 0) {
  const forceRefresh = new URLSearchParams(location.search).get('refresh') === 'true';

  const cached = loadCachedModels(forceRefresh);
  if (cached) return cached;

  try {
    const data = await fetchModelData();
    cacheModelData(data);
    return data;
  } catch (e) {
    console.error('[Data] 无法加载 models.json:', e);

    if (retryCount < 3) {
      const delay = Math.pow(2, retryCount) * 1000;
      showError(`模型数据加载失败，${delay / 1000}秒后自动重试 (${retryCount + 1}/3)...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return loadModels(retryCount + 1);
    } else {
      showError('模型数据加载失败，已重试3次。请检查网络连接后刷新页面重试。');
    }
  }
  return [];
}

/**
 * 保存模型数据到 localStorage
 */
export function saveModels() {
  safeSetItem(CONFIG.STORAGE_KEY, JSON.stringify(state.models));
}

// ==================== 主题管理 ====================

let systemThemeListener = null;
let systemThemeListenerInitialized = false;

/**
 * 切换主题
 */
export function toggleTheme() {
  const html = document.documentElement;
  const current = html.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', next);
  safeSetItem(CONFIG.THEME_KEY, next);
  updateThemeIcon(next);
}

/**
 * 页面加载时恢复主题
 */
export function restoreTheme() {
  try {
    const saved = localStorage.getItem(CONFIG.THEME_KEY);
    if (saved) {
      document.documentElement.setAttribute('data-theme', saved);
      updateThemeIcon(saved);
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const systemTheme = prefersDark ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', systemTheme);
      updateThemeIcon(systemTheme);
    }

    if (!systemThemeListenerInitialized) {
      systemThemeListenerInitialized = true;
      systemThemeListener = window.matchMedia('(prefers-color-scheme: dark)');
      systemThemeListener.addEventListener('change', (e) => {
        const manuallySet = localStorage.getItem(CONFIG.THEME_KEY);
        if (!manuallySet) {
          const newTheme = e.matches ? 'dark' : 'light';
          document.documentElement.setAttribute('data-theme', newTheme);
          updateThemeIcon(newTheme);
        }
      });
    }
  } catch (e) {
    console.warn('[Theme] 主题恢复失败:', e);
  }
}

/**
 * 更新主题图标
 * @param {string} theme - 主题名称 'dark' | 'light'
 */
export function updateThemeIcon(theme) {
  const btn = document.getElementById('themeToggle');
  if (!btn) return;
  // 安全：硬编码 SVG，无用户输入
  btn.innerHTML = theme === 'dark'
    ? '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a.5.5 0 01.5.5v1a.5.5 0 01-1 0v-1A.5.5 0 018 1zm0 13a.5.5 0 01.5.5v1a.5.5 0 01-1 0v-1a.5.5 0 01.5-.5zM2 8h1a.5.5 0 010 1H2a.5.5 0 010-1zm11 0h1a.5.5 0 010 1h-1a.5.5 0 010-1zM4.22 3.81a.5.5 0 01.707 0l.7.7a.5.5 0 01-.707.707l-.7-.7a.5.5 0 010-.707zm7.07 8.49a.5.5 0 01.707 0l.7.7a.5.5 0 01-.707.707l-.7-.7a.5.5 0 010-.707zM1 7.5a.5.5 0 01.5-.5h1a.5.5 0 010 1h-1a.5.5 0 01-.5-.5zm13.07-1.07a.5.5 0 01.707 0l.7.7a.5.5 0 01-.707.707l-.7-.7a.5.5 0 010-.707zM5.93 10.93a.5.5 0 010-.707l.7-.7a.5.5 0 11.707.707l-.7.7a.5.5 0 01-.707 0zM8 5.5A2.5 2.5 0 1010.5 8 2.5 2.5 0 008 5.5zm0 1A1.5 1.5 0 119.5 8 1.5 1.5 0 018 6.5z"/></svg>'
    : '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M6 2a.5.5 0 01.5.5v1a.5.5 0 01-1 0v-1A.5.5 0 016 2zm3.1 1.2a.5.5 0 01.2.68l-.5.87a.5.5 0 11-.86-.5l.5-.87a.5.5 0 01.66-.18zM2.4 5.1a.5.5 0 01.36.85l-.7.71a.5.5 0 11-.71-.71l.7-.71a.5.5 0 01.35-.14zm9.2 0a.5.5 0 01.36.14l.7.71a.5.5 0 11-.71.71l-.7-.71a.5.5 0 01.35-.85zM1 8a.5.5 0 01.5-.5h1a.5.5 0 010 1h-1A.5.5 0 011 8zm12.5 0a.5.5 0 01.5-.5h1a.5.5 0 010 1h-1a.5.5 0 01-.5-.5zM3.05 11.05a.5.5 0 01.7 0l.71.7a.5.5 0 11-.7.71l-.71-.7a.5.5 0 010-.71zm8.5 0a.5.5 0 010 .71l-.71.7a.5.5 0 11-.7-.71l.7-.7a.5.5 0 01.71 0zM6 14a.5.5 0 01.5-.5h1a.5.5 0 010 1h-1A.5.5 0 016 14zm2.5-3A4.5 4.5 0 1114 6.5 4.5 4.5 0 018.5 11z"/></svg>';
}

// ==================== Spotlight 方案系统 ====================

const SPOTLIGHT_KEY = 'dl_spotlight_scheme';

/**
 * 获取当前 Spotlight 方案
 * @returns {string} 方案标识 A-E
 */
export function getSpotlightScheme() {
  const saved = localStorage.getItem(SPOTLIGHT_KEY);
  if (saved && ['A', 'B', 'C', 'D', 'E'].includes(saved)) return saved;
  return 'A';
}

/**
 * 设置 Spotlight 方案
 * @param {string} scheme - 方案标识 A-E
 */
export function setSpotlightScheme(scheme) {
  if (!['A', 'B', 'C', 'D', 'E'].includes(scheme)) return;
  localStorage.setItem(SPOTLIGHT_KEY, scheme);
  applySpotlightScheme(scheme);
}

/**
 * 清理旧的 Spotlight 元素
 * @param {HTMLElement} hero - Hero 元素
 */
function cleanupOldSpotlight(hero) {
  const oldSpotlight = hero.querySelector('.hero-spotlight');
  if (oldSpotlight) oldSpotlight.remove();
  const oldBeam = hero.querySelector('.hero-beam');
  if (oldBeam) oldBeam.remove();
  const statsCard = document.querySelector('.hero-stats');
  if (statsCard) {
    statsCard.classList.remove('border-beam', 'stripe-glow');
  }
}

/**
 * 应用 Spotlight 方案
 * @param {string} scheme - 方案标识 A-E
 */
export function applySpotlightScheme(scheme) {
  const hero = document.querySelector('.hero');
  if (!hero) return;

  cleanupOldSpotlight(hero);

  if (scheme === 'A' || scheme === 'B') {
    const spotlight = document.createElement('div');
    spotlight.className = 'hero-spotlight' + (scheme === 'B' ? ' vercel' : '');
    hero.insertBefore(spotlight, hero.firstChild);
    initSpotlightTracking(hero, spotlight);
  }

  if (scheme === 'C') {
    const statsCard = document.querySelector('.hero-stats');
    if (statsCard) statsCard.classList.add('border-beam');
  }

  if (scheme === 'D') {
    const statsCard = document.querySelector('.hero-stats');
    if (statsCard) {
      statsCard.classList.add('stripe-glow');
      initStripeGlow(statsCard);
    }
  }

  if (scheme === 'E') {
    initMagicBeam(hero);
  }
}

/**
 * 初始化鼠标跟随（方案 A/B）
 * @param {HTMLElement} hero - Hero 元素
 * @param {HTMLElement} spotlight - Spotlight 元素
 */
function initSpotlightTracking(hero, spotlight) {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) return;

  let currentX = 0, currentY = 0;
  let targetX = 0, targetY = 0;
  let rafId = null;
  let isMouseInHero = false;

  function update() {
    currentX += (targetX - currentX) * 0.1;
    currentY += (targetY - currentY) * 0.1;
    spotlight.style.setProperty('--spotlight-x', currentX + 'px');
    spotlight.style.setProperty('--spotlight-y', currentY + 'px');
    if (isMouseInHero) {
      rafId = requestAnimationFrame(update);
    }
  }

  hero.addEventListener('mouseenter', () => {
    isMouseInHero = true;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(update);
  });

  hero.addEventListener('mousemove', (e) => {
    const rect = hero.getBoundingClientRect();
    targetX = e.clientX - rect.left;
    targetY = e.clientY - rect.top;
  });

  hero.addEventListener('mouseleave', () => {
    isMouseInHero = false;
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  });
}

/**
 * 初始化 Stripe 卡片内发光（方案 D）
 * @param {HTMLElement} statsCard - 统计卡片元素
 */
function initStripeGlow(statsCard) {
  let rafId = null;
  let targetX = 0, targetY = 0;
  statsCard.addEventListener('mousemove', (e) => {
    const rect = statsCard.getBoundingClientRect();
    targetX = ((e.clientX - rect.left) / rect.width) * 100;
    targetY = ((e.clientY - rect.top) / rect.height) * 100;
    if (!rafId) {
      rafId = requestAnimationFrame(() => {
        statsCard.style.setProperty('--tilt-x', targetX + '%');
        statsCard.style.setProperty('--tilt-y', targetY + '%');
        rafId = null;
      });
    }
  });
}

/**
 * 创建 SVG 路径元素
 * @param {string} d - 路径数据
 * @returns {SVGPathElement} SVG 路径元素
 */
function createBeamPath(d) {
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', d);
  path.style.stroke = 'var(--accent-primary)';
  path.style.strokeWidth = '1.5';
  path.style.fill = 'none';
  path.style.strokeDasharray = '8 4';
  path.style.animation = 'beam-dash 1s linear infinite';
  return path;
}

/**
 * 初始化 Magic UI 光束连接（方案 E）
 * @param {HTMLElement} hero - Hero 元素
 */
function initMagicBeam(hero) {
  const beam = document.createElement('div');
  beam.className = 'hero-beam';
  beam.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:0;';

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '100%');
  svg.style.overflow = 'visible';

  const rect = hero.getBoundingClientRect();
  svg.appendChild(createBeamPath(`M ${rect.width * 0.5} ${rect.height * 0.35} Q ${rect.width * 0.3} ${rect.height * 0.5} ${rect.width * 0.2} ${rect.height * 0.65}`));
  svg.appendChild(createBeamPath(`M ${rect.width * 0.5} ${rect.height * 0.35} Q ${rect.width * 0.7} ${rect.height * 0.5} ${rect.width * 0.8} ${rect.height * 0.65}`));

  beam.appendChild(svg);
  hero.insertBefore(beam, hero.firstChild);
}

/**
 * 初始化 Hero 交互（在 init 中调用）
 */
export function initHeroInteractions() {
  const scheme = getSpotlightScheme();
  applySpotlightScheme(scheme);
}
