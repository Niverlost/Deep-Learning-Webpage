// ============================================================
// Deep Learning Explorer - State Module (Optimized)
// 状态管理（createStore、全局状态、localStorage 持久化）
// ============================================================

// 动态导入 showToast 避免循环依赖
let showToastRef = null;

/**
 * 显示错误提示（懒加载 showToast 避免循环依赖）
 * @param {string} message - 错误消息
 * @param {string} [type='error'] - 消息类型
 */
function showError(message, type = 'error') {
  try {
    if (!showToastRef && typeof showToast === 'function') {
      showToastRef = showToast;
    }
    if (showToastRef) {
      showToastRef(message, type);
    }
  } catch (e) {
    console.error('[State] 显示提示失败:', e);
  }
  console.error('[State]', message);
}

// ==================== 全局状态 ====================

/**
 * 全局应用状态对象
 * @type {Object}
 */
const state = {
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
const compareState = {
  enabled: false,
  selected: []
};

// ==================== 数据验证和管理 ====================

/**
 * 验证单个模型数据
 * @param {Object} model - 模型数据
 * @returns {boolean} 数据是否有效
 */
function validateSingleModel(model) {
  if (!model || typeof model !== 'object') return false;
  
  const requiredFields = ['id', 'name', 'category'];
  const hasRequiredFields = requiredFields.every(field => field in model);
  
  if (!hasRequiredFields) {
    console.warn('[State] 模型缺少必填字段:', model);
    return false;
  }
  
  // 验证字段类型
  if (typeof model.id !== 'string' && typeof model.id !== 'number') return false;
  if (typeof model.name !== 'string') return false;
  if (typeof model.category !== 'string') return false;
  
  return true;
}

/**
 * 验证模型数据格式
 * @param {Array} data - 模型数据数组
 * @returns {boolean} 数据是否有效
 */
function validateModelData(data) {
  if (!Array.isArray(data)) {
    console.warn('[State] 数据不是数组:', data);
    return false;
  }
  
  if (data.length === 0) {
    console.warn('[State] 数据为空数组');
    return true; // 空数组是有效的
  }
  
  const validModels = data.filter(validateSingleModel);
  
  if (validModels.length !== data.length) {
    console.warn('[State] 发现无效模型，数量:', data.length - validModels.length);
  }
  
  return validModels.length > 0;
}

/**
 * 安全的 localStorage 操作
 * @param {string} key - 存储键
 * @param {*} value - 存储值
 * @returns {boolean} 是否成功
 */
function safeLocalStorageSet(key, value) {
  try {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    localStorage.setItem(key, serialized);
    return true;
  } catch (error) {
    console.warn('[State] localStorage 写入失败:', error);
    if (error.name === 'QuotaExceededError') {
      showError('存储空间已满，请清理缓存', 'warning');
    }
    return false;
  }
}

/**
 * 安全的 localStorage 读取
 * @param {string} key - 存储键
 * @param {*} defaultValue - 默认值
 * @returns {*} 读取的值
 */
function safeLocalStorageGet(key, defaultValue = null) {
  try {
    const value = localStorage.getItem(key);
    if (value === null) return defaultValue;
    try {
      return JSON.parse(value);
    } catch {
      return value; // 如果不是 JSON，返回原始字符串
    }
  } catch (error) {
    console.warn('[State] localStorage 读取失败:', error);
    return defaultValue;
  }
}

/**
 * 安全的 localStorage 删除
 * @param {string} key - 存储键
 */
function safeLocalStorageRemove(key) {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.warn('[State] localStorage 删除失败:', error);
  }
}

/**
 * 从 localStorage 加载缓存的模型数据
 * @param {boolean} forceRefresh - 是否强制刷新
 * @returns {Array|null} 模型数据或 null
 */
function loadCachedModels(forceRefresh) {
  try {
    if (forceRefresh) {
      safeLocalStorageRemove(CONFIG.STORAGE_KEY);
      safeLocalStorageRemove(CONFIG.STORAGE_KEY + '_ts');
      safeLocalStorageSet(CONFIG.STORAGE_VERSION_KEY, CONFIG.DATA_VERSION);
      return null;
    }

    const savedVersion = safeLocalStorageGet(CONFIG.STORAGE_VERSION_KEY);
    const savedData = safeLocalStorageGet(CONFIG.STORAGE_KEY);

    if (savedVersion === CONFIG.DATA_VERSION && savedData) {
      if (validateModelData(savedData)) {
        return savedData;
      } else {
        console.warn('[State] 缓存数据无效，清除缓存');
        safeLocalStorageRemove(CONFIG.STORAGE_KEY);
      }
    } else if (savedVersion !== CONFIG.DATA_VERSION) {
      console.info('[State] 数据版本不匹配，清除旧缓存');
      safeLocalStorageRemove(CONFIG.STORAGE_KEY);
      safeLocalStorageRemove(CONFIG.STORAGE_KEY + '_ts');
      safeLocalStorageSet(CONFIG.STORAGE_VERSION_KEY, CONFIG.DATA_VERSION);
    }
  } catch (error) {
    console.warn('[State] 加载缓存失败:', error);
    try {
      safeLocalStorageRemove(CONFIG.STORAGE_KEY);
    } catch {}
  }
  return null;
}

/**
 * 缓存模型数据到 localStorage
 * @param {Array} data - 模型数据数组
 */
function cacheModelData(data) {
  try {
    safeLocalStorageSet(CONFIG.STORAGE_KEY, data);
    safeLocalStorageSet(CONFIG.STORAGE_KEY + '_ts', String(Date.now()));
  } catch (error) {
    console.warn('[State] 缓存模型数据失败:', error);
  }
}

/**
 * 从网络加载模型数据
 * @returns {Promise<Array>} 模型数据数组
 */
async function fetchModelData() {
  try {
    const resp = await fetch('assets/models.json?t=' + Date.now());
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
    }
    
    let data;
    try {
      data = await resp.json();
    } catch (error) {
      throw new Error('models.json 解析失败：不是有效的 JSON 格式');
    }
    
    if (!validateModelData(data)) {
      throw new Error('models.json 数据格式不正确或为空');
    }
    
    return data;
  } catch (error) {
    console.error('[State] 获取模型数据失败:', error);
    throw error;
  }
}

/**
 * 加载模型数据（优先 localStorage，其次 models.json）
 * @param {number} [retryCount=0] - 当前重试次数
 * @param {number} [maxRetries=3] - 最大重试次数
 * @returns {Promise<Array>} 模型数据数组
 */
async function loadModels(retryCount = 0, maxRetries = 3) {
  try {
    // 测试环境：使用内联的 TEST_MODELS 数据，跳过 fetch
    if (typeof TEST_MODELS !== 'undefined' && TEST_MODELS) {
      if (validateModelData(TEST_MODELS)) {
        cacheModelData(TEST_MODELS);
        return TEST_MODELS;
      }
    }

    const forceRefresh = new URLSearchParams(location.search).get('refresh') === 'true';

    const cached = loadCachedModels(forceRefresh);
    if (cached) return cached;

    const data = await fetchModelData();
    cacheModelData(data);
    return data;
  } catch (error) {
    console.error('[State] 加载模型失败:', error);

    if (retryCount < maxRetries) {
      const delay = Math.pow(2, retryCount) * 1000; // 指数退避
      showError(`模型数据加载失败，${delay / 1000}秒后自动重试 (${retryCount + 1}/${maxRetries})...`, 'warning');
      await new Promise(resolve => setTimeout(resolve, delay));
      return loadModels(retryCount + 1, maxRetries);
    } else {
      showError('模型数据加载失败，已重试多次。请检查网络连接后刷新页面重试。', 'error');
      return [];
    }
  }
}

/**
 * 保存模型数据到 localStorage
 */
function saveModels() {
  try {
    safeLocalStorageSet(CONFIG.STORAGE_KEY, state.models);
  } catch (error) {
    console.error('[State] 保存模型失败:', error);
    showError('保存失败，请重试', 'error');
  }
}

// ==================== 主题管理 ====================

let systemThemeListener = null;
let systemThemeListenerInitialized = false;

/**
 * 切换主题
 */
function toggleTheme() {
  try {
    const html = document.documentElement;
    const current = html.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', next);
    safeLocalStorageSet(CONFIG.THEME_KEY, next);
    updateThemeIcon(next);
  } catch (error) {
    console.error('[State] 切换主题失败:', error);
  }
}

/**
 * 页面加载时恢复主题
 */
function restoreTheme() {
  try {
    const saved = safeLocalStorageGet(CONFIG.THEME_KEY);
    let theme = saved;
    
    if (!saved) {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      theme = prefersDark ? 'dark' : 'light';
    }
    
    document.documentElement.setAttribute('data-theme', theme);
    updateThemeIcon(theme);

    if (!systemThemeListenerInitialized) {
      systemThemeListenerInitialized = true;
      systemThemeListener = window.matchMedia('(prefers-color-scheme: dark)');
      systemThemeListener.addEventListener('change', (e) => {
        const manuallySet = safeLocalStorageGet(CONFIG.THEME_KEY);
        if (!manuallySet) {
          const newTheme = e.matches ? 'dark' : 'light';
          document.documentElement.setAttribute('data-theme', newTheme);
          updateThemeIcon(newTheme);
        }
      });
    }
  } catch (error) {
    console.warn('[State] 主题恢复失败:', error);
  }
}

/**
 * 更新主题图标
 * @param {string} theme - 主题名称 'dark' | 'light'
 */
function updateThemeIcon(theme) {
  try {
    const btn = document.getElementById('themeToggle');
    if (!btn) return;
    // 安全：硬编码 SVG，无用户输入
    btn.innerHTML = theme === 'dark'
      ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 1a.5.5 0 01.5.5v1a.5.5 0 01-1 0v-1A.5.5 0 018 1zm0 13a.5.5 0 01.5.5v1a.5.5 0 01-1 0v-1a.5.5 0 01.5-.5zM2 8h1a.5.5 0 010 1H2a.5.5 0 010-1zm11 0h1a.5.5 0 010 1h-1a.5.5 0 010-1zM4.22 3.81a.5.5 0 01.707 0l.7.7a.5.5 0 01-.707.707l-.7-.7a.5.5 0 010-.707zm7.07 8.49a.5.5 0 01.707 0l.7.7a.5.5 0 01-.707.707l-.7-.7a.5.5 0 010-.707zM1 7.5a.5.5 0 01.5-.5h1a.5.5 0 010 1h-1a.5.5 0 01-.5-.5zm13.07-1.07a.5.5 0 01.707 0l.7.7a.5.5 0 01-.707.707l-.7-.7a.5.5 0 010-.707zM5.93 10.93a.5.5 0 010-.707l.7-.7a.5.5 1 1 .707.707l-.7.7a.5.5 0 01-.707 0zM8 5.5A2.5 2.5 0 1 0 10.5 8 2.5 2.5 0 0 0 8 5.5zm0 1A1.5 1.5 0 1 1 9.5 8 1.5 1.5 0 0 1 8 6.5z"/></svg>'
      : '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6 2a.5.5 0 01.5.5v1a.5.5 0 01-1 0v-1A.5.5 0 016 2zm3.1 1.2a.5.5 0 01.2.68l-.5.87a.5.5 0 11-.86-.5l.5-.87a.5.5 0 01.66-.18zM2.4 5.1a.5.5 0 01.36.85l-.7.71a.5.5 0 11-.71-.71l.7-.71a.5.5 0 01.35-.14zm9.2 0a.5.5 0 01.36.14l.7.71a.5.5 0 11-.71.71l-.7-.71a.5.5 0 01.35-.85zM1 8a.5.5 0 01.5-.5h1a.5.5 0 010 1h-1A.5.5 0 011 8zm12.5 0a.5.5 0 01.5-.5h1a.5.5 0 010 1h-1a.5.5 0 01-.5-.5zM3.05 11.05a.5.5 0 01.7 0l.71.7a.5.5 0 11-.7.71l-.71-.7a.5.5 0 010-.71zm8.5 0a.5.5 0 010 .71l-.71.7a.5.5 0 11-.7-.71l.7-.7a.5.5 0 01.71 0zM6 14a.5.5 0 01.5-.5h1a.5.5 0 010 1h-1A.5.5 0 016 14zm2.5-3A4.5 4.5 0 1 1 14 6.5 4.5 4.5 0 0 1 8.5 11z"/></svg>';
  } catch (error) {
    console.warn('[State] 更新主题图标失败:', error);
  }
}

// ==================== Spotlight 方案系统 ====================

const SPOTLIGHT_KEY = 'dl_spotlight_scheme';

/**
 * 获取当前 Spotlight 方案
 * @returns {string} 方案标识 A-E
 */
function getSpotlightScheme() {
  try {
    const saved = safeLocalStorageGet(SPOTLIGHT_KEY);
    if (saved && ['A', 'B', 'C', 'D', 'E'].includes(saved)) return saved;
  } catch (error) {
    console.warn('[State] 获取Spotlight方案失败:', error);
  }
  return 'A';
}

/**
 * 设置 Spotlight 方案
 * @param {string} scheme - 方案标识 A-E
 */
function setSpotlightScheme(scheme) {
  try {
    if (!['A', 'B', 'C', 'D', 'E'].includes(scheme)) {
      console.warn('[State] 无效的Spotlight方案:', scheme);
      return;
    }
    safeLocalStorageSet(SPOTLIGHT_KEY, scheme);
    applySpotlightScheme(scheme);
  } catch (error) {
    console.error('[State] 设置Spotlight方案失败:', error);
  }
}

/**
 * 清理旧的 Spotlight 元素
 * @param {HTMLElement} hero - Hero 元素
 */
function cleanupOldSpotlight(hero) {
  try {
    const oldSpotlight = hero.querySelector('.hero-spotlight');
    if (oldSpotlight) oldSpotlight.remove();
    const oldBeam = hero.querySelector('.hero-beam');
    if (oldBeam) oldBeam.remove();
    hero.classList.remove('hero-glass');
    const oldCanvas = hero.querySelector('.hero-particle-canvas');
    if (oldCanvas) {
      if (oldCanvas.__particleOrbit && oldCanvas.__particleOrbit.stop) {
        oldCanvas.__particleOrbit.stop();
      }
      oldCanvas.remove();
    }
    const statsCard = document.querySelector('.hero-stats');
    if (statsCard) {
      statsCard.classList.remove('border-beam', 'stripe-glow');
    }
    hero.classList.remove('hero-sweep');
    hero.style.removeProperty('--sweep-glow-x');
    hero.style.removeProperty('--sweep-glow-y');
    hero.classList.remove('hero-blobs');
    hero.style.removeProperty('--blob-x');
    hero.style.removeProperty('--blob-y');
    hero.classList.remove('hero-grid');
    hero.style.removeProperty('--grid-mouse-x');
    hero.style.removeProperty('--grid-mouse-y');
  } catch (error) {
    console.warn('[State] 清理Spotlight失败:', error);
  }
}

/**
 * 应用 Spotlight 方案
 * @param {string} scheme - 方案标识 A-E
 */
function applySpotlightScheme(scheme) {
  try {
    const hero = document.querySelector('.hero');
    if (!hero) return;

    cleanupOldSpotlight(hero);

    if (scheme === 'A') {
      const spotlight = document.createElement('div');
      spotlight.className = 'hero-spotlight';
      hero.insertBefore(spotlight, hero.firstChild);
      initSpotlightTracking(hero, spotlight);
    }

    if (scheme === 'B') {
      initParticleOrbit(hero);
    }

    if (scheme === 'C') {
      hero.classList.add('hero-grid');
      initGridTracking(hero);
    }

    if (scheme === 'D') {
      hero.classList.add('hero-blobs');
      initBlobTracking(hero);
    }

    if (scheme === 'E') {
      hero.classList.add('hero-glass');
      initGlassTracking(hero);
    }
  } catch (error) {
    console.error('[State] 应用Spotlight方案失败:', error);
  }
}

/**
 * 初始化鼠标跟随（方案 A/B）
 * @param {HTMLElement} hero - Hero 元素
 * @param {HTMLElement} spotlight - Spotlight 元素
 */
function initSpotlightTracking(hero, spotlight) {
  try {
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
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    });
  } catch (error) {
    console.warn('[State] 初始化Spotlight跟踪失败:', error);
  }
}

/**
 * 初始化粒子星轨跟随（方案 B）
 * 在 Hero 区域创建 Canvas 粒子系统：粒子围绕鼠标位置做轨道运动，
 * 使用蓝紫 HSL 色彩渐变，具有延迟跟随效果。
 * @param {HTMLElement} hero - Hero 元素
 */
function initParticleOrbit(hero) {
  try {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    const canvas = document.createElement('canvas');
    canvas.className = 'hero-particle-canvas';
    canvas.width = hero.offsetWidth;
    canvas.height = hero.offsetHeight;
    hero.insertBefore(canvas, hero.firstChild);

    const ctx = canvas.getContext('2d');
    let isMouseInHero = false;
    let rafId = null;
    let opacity = 0;

    const MAX_HISTORY = 60;
    const mouseHistory = [];
    let currentMouseX = hero.offsetWidth / 2;
    let currentMouseY = hero.offsetHeight / 2;

    const layerConfigs = [
      { count: 4, radiusRange: [20, 40], sizeRange: [2, 3] },
      { count: 4, radiusRange: [55, 85], sizeRange: [3, 4] },
      { count: 3, radiusRange: [100, 150], sizeRange: [4, 5] }
    ];

    const particles = [];
    let globalIdx = 0;
    layerConfigs.forEach((layer, li) => {
      for (let i = 0; i < layer.count; i++) {
        const hue = 210 + Math.random() * 60;
        particles.push({
          layer: li,
          angle: Math.random() * Math.PI * 2,
          speed: (0.01 + Math.random() * 0.015) * (li % 2 === 0 ? 1 : -1),
          radius: layer.radiusRange[0] + Math.random() * (layer.radiusRange[1] - layer.radiusRange[0]),
          hue: hue,
          saturation: 70 + Math.random() * 20,
          lightness: 60 + Math.random() * 20,
          size: layer.sizeRange[0] + Math.random() * (layer.sizeRange[1] - layer.sizeRange[0]),
          delayIdx: Math.min(globalIdx * 4 + 2, MAX_HISTORY - 1),
          alpha: 0.3 + Math.random() * 0.4
        });
        globalIdx++;
      }
    });

    function draw() {
      if (!isMouseInHero && opacity <= 0) {
        rafId = null;
        return;
      }

      mouseHistory.push({ x: currentMouseX, y: currentMouseY });
      if (mouseHistory.length > MAX_HISTORY) {
        mouseHistory.shift();
      }

      const targetOpacity = isMouseInHero ? 1 : 0;
      opacity += (targetOpacity - opacity) * 0.05;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = opacity;

      if (canvas.width !== hero.offsetWidth || canvas.height !== hero.offsetHeight) {
        canvas.width = hero.offsetWidth;
        canvas.height = hero.offsetHeight;
      }

      particles.forEach(p => {
        p.angle += p.speed;

        const histIdx = Math.max(0, mouseHistory.length - 1 - p.delayIdx);
        const center = mouseHistory[Math.min(histIdx, mouseHistory.length - 1)];

        if (!center) return;

        const x = center.x + Math.cos(p.angle) * p.radius;
        const y = center.y + Math.sin(p.angle) * p.radius;

        const glowSize = p.size * 4;
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, glowSize);
        gradient.addColorStop(0, `hsla(${p.hue}, ${p.saturation}%, ${p.lightness}%, ${p.alpha})`);
        gradient.addColorStop(0.3, `hsla(${p.hue}, ${p.saturation}%, ${p.lightness}%, ${p.alpha * 0.3})`);
        gradient.addColorStop(1, `hsla(${p.hue}, ${p.saturation}%, ${p.lightness}%, 0)`);

        ctx.beginPath();
        ctx.arc(x, y, glowSize, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(x, y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, ${p.saturation}%, ${p.lightness}%, ${p.alpha})`;
        ctx.fill();
      });

      ctx.globalAlpha = 1;
      rafId = requestAnimationFrame(draw);
    }

    let resizeTimer = null;
    function handleResize() {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        canvas.width = hero.offsetWidth;
        canvas.height = hero.offsetHeight;
      }, 100);
    }

    hero.addEventListener('mouseenter', () => {
      isMouseInHero = true;
      const rect = hero.getBoundingClientRect();
      currentMouseX = rect.width / 2;
      currentMouseY = rect.height / 2;
      if (!rafId) {
        rafId = requestAnimationFrame(draw);
      }
    });

    hero.addEventListener('mousemove', (e) => {
      const rect = hero.getBoundingClientRect();
      currentMouseX = e.clientX - rect.left;
      currentMouseY = e.clientY - rect.top;
    });

    hero.addEventListener('mouseleave', () => {
      isMouseInHero = false;
    });

    window.addEventListener('resize', handleResize);

    canvas.__particleOrbit = {
      stop: function() {
        if (rafId) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }
        window.removeEventListener('resize', handleResize);
      }
    };

  } catch (error) {
    console.warn('[State] 初始化粒子星轨失败:', error);
  }
}

/**
 * 初始化 Stripe 卡片内发光（方案 D）
 * @param {HTMLElement} statsCard - 统计卡片元素
 */
function initBlobTracking(hero) {
  try {
    hero.addEventListener('mousemove', function(e) {
      var rect = hero.getBoundingClientRect();
      var x = ((e.clientX - rect.left) / rect.width) * 100;
      var y = ((e.clientY - rect.top) / rect.height) * 100;
      hero.style.setProperty('--blob-x', x + '%');
      hero.style.setProperty('--blob-y', y + '%');
    });
    hero.addEventListener('mouseleave', function() {
      hero.style.setProperty('--blob-x', '50%');
      hero.style.setProperty('--blob-y', '50%');
    });
  } catch (error) {
    console.warn('[State] 初始化光斑追踪失败:', error);
  }
}

/**
 * 初始化毛玻璃光晕鼠标追踪（方案 E）
 * @param {HTMLElement} hero - Hero 元素
 */
function initGlassTracking(hero) {
  try {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    let rafId = null;
    let targetX = 50, targetY = 50;
    let currentX = 50, currentY = 50;

    function updateGlassPosition() {
      currentX += (targetX - currentX) * 0.08;
      currentY += (targetY - currentY) * 0.08;
      hero.style.setProperty('--glass-x', currentX + '%');
      hero.style.setProperty('--glass-y', currentY + '%');
      rafId = requestAnimationFrame(updateGlassPosition);
    }

    hero.addEventListener('mouseenter', () => {
      if (!rafId) {
        rafId = requestAnimationFrame(updateGlassPosition);
      }
    });

    hero.addEventListener('mousemove', (e) => {
      const rect = hero.getBoundingClientRect();
      targetX = ((e.clientX - rect.left) / rect.width) * 100;
      targetY = ((e.clientY - rect.top) / rect.height) * 100;
    });

    hero.addEventListener('mouseleave', () => {
      targetX = 50;
      targetY = 50;
    });
  } catch (error) {
    console.warn('[State] 初始化毛玻璃追踪失败:', error);
  }
}

/**
 * 初始化网格鼠标追踪（方案 C）
 * @param {HTMLElement} hero - Hero 元素
 */
function initGridTracking(hero) {
  try {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    hero.addEventListener('mousemove', (e) => {
      const rect = hero.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      hero.style.setProperty('--grid-mouse-x', x + '%');
      hero.style.setProperty('--grid-mouse-y', y + '%');
    });

    hero.addEventListener('mouseleave', () => {
      hero.style.setProperty('--grid-mouse-x', '50%');
      hero.style.setProperty('--grid-mouse-y', '50%');
    });
  } catch (error) {
    console.warn('[State] 初始化网格追踪失败:', error);
  }
}

/**
 * 创建 SVG 路径元素
 * @param {string} d - 路径数据
 * @returns {SVGPathElement} SVG 路径元素
 */
function createBeamPath(d) {
  try {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    path.style.stroke = 'var(--accent-primary)';
    path.style.strokeWidth = '1.5';
    path.style.fill = 'none';
    path.style.strokeDasharray = '8 4';
    path.style.animation = 'beam-dash 1s linear infinite';
    return path;
  } catch (error) {
    console.error('[State] 创建光束路径失败:', error);
    return null;
  }
}

/**
 * 初始化 Magic UI 光束连接（方案 E）
 * @param {HTMLElement} hero - Hero 元素
 */
/**
 * 初始化 Hero 交互（在 init 中调用）
 */
function initHeroInteractions() {
  try {
    const scheme = getSpotlightScheme();
    applySpotlightScheme(scheme);
  } catch (error) {
    console.error('[State] 初始化Hero交互失败:', error);
  }
}

// Global exports for inline event handlers
window.state = state;
window.compareState = compareState;
