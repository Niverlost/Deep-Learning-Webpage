// ============================================================
// Deep Learning Explorer - UI Components Module
// UI 组件（模态框、卡片、按钮、骨架屏、Toast）
// ============================================================

import { escapeHtml, highlightText, getCategoryGradient, animateCount, addTermTooltips, debounce, CONFIG } from './utils.js';
import { state } from './state.js';
import { userState, hasPermission, toggleFavorite, subscribeToFavorites } from './auth.js';
import { navigate } from './router.js';

// ==================== Toast 通知系统 ====================

/**
 * 获取 Toast 图标 SVG
 * @param {string} type - Toast 类型
 * @returns {string} SVG HTML
 */
function getToastIcon(type) {
  const icons = {
    success: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>',
    error: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    warning: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    info: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
  };
  return icons[type] || icons.info;
}

/**
 * 显示 Toast 通知
 * @param {string} message - 消息内容
 * @param {string} [type='info'] - 通知类型
 */
export function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');

  // 安全：icons 是硬编码的 SVG，message 已转义
  toast.innerHTML = `${getToastIcon(type)}<span>${escapeHtml(message)}</span>`;
  container.appendChild(toast);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      toast.classList.add('show');
    });
  });

  setTimeout(() => {
    toast.classList.remove('show');
    toast.addEventListener('transitionend', () => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, { once: true });
  }, 3000);
}

// ==================== 模态框系统 ====================

// 存储每个模态框的焦点陷阱清理函数和之前聚焦的元素
const modalFocusStore = new WeakMap();

/**
 * 创建焦点陷阱
 * @param {HTMLElement} modal - 模态框元素
 * @returns {Function} 清理函数
 */
export function createFocusTrap(modal) {
  const focusableElements = modal.querySelectorAll(
    'a, button, input, textarea, select, [tabindex]:not([tabindex="-1"])'
  );
  if (focusableElements.length === 0) return () => {};

  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];

  function handleTabKey(e) {
    if (e.key !== 'Tab') return;

    if (e.shiftKey && document.activeElement === firstElement) {
      e.preventDefault();
      lastElement.focus();
    } else if (!e.shiftKey && document.activeElement === lastElement) {
      e.preventDefault();
      firstElement.focus();
    }
  }

  modal.addEventListener('keydown', handleTabKey);
  firstElement?.focus();

  return () => {
    modal.removeEventListener('keydown', handleTabKey);
  };
}

/**
 * 打开模态框
 * @param {string} id - 模态框 ID
 */
export function openModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;

  // 保存当前焦点元素
  const previousFocus = document.activeElement;

  modal.classList.add('active');
  document.body.style.overflow = 'hidden';

  // 创建焦点陷阱
  const removeFocusTrap = createFocusTrap(modal);

  // ESC 键关闭模态框
  function handleEsc(e) {
    if (e.key === 'Escape') {
      closeModal(id);
    }
  }
  modal.addEventListener('keydown', handleEsc);

  // 存储清理函数和之前聚焦的元素
  modalFocusStore.set(modal, {
    removeFocusTrap,
    handleEsc,
    previousFocus
  });
}

/**
 * 关闭模态框
 * @param {string} id - 模态框 ID
 */
export function closeModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.remove('active');
  document.body.style.overflow = '';

  // 清理焦点陷阱和 ESC 监听
  const store = modalFocusStore.get(modal);
  if (store) {
    store.removeFocusTrap();
    modal.removeEventListener('keydown', store.handleEsc);
    modalFocusStore.delete(modal);

    // 恢复焦点
    if (store.previousFocus && typeof store.previousFocus.focus === 'function') {
      store.previousFocus.focus();
    }
  }
}

/**
 * 关闭所有模态框
 */
export function closeAllModals() {
  document.querySelectorAll('.modal-overlay.active').forEach(modal => {
    modal.classList.remove('active');

    // 清理每个模态框的焦点陷阱和 ESC 监听
    const store = modalFocusStore.get(modal);
    if (store) {
      store.removeFocusTrap();
      modal.removeEventListener('keydown', store.handleEsc);
      modalFocusStore.delete(modal);

      // 恢复焦点
      if (store.previousFocus && typeof store.previousFocus.focus === 'function') {
        store.previousFocus.focus();
      }
    }
  });
  document.body.style.overflow = '';
}

// ==================== 骨架屏 ====================

/**
 * 创建骨架屏卡片
 * @returns {string} HTML 字符串
 */
export function createSkeletonCard() {
  return `<div class="model-card skeleton-card" role="status" aria-label="加载中">
    <div class="skeleton" style="height:180px;margin-bottom:1rem;border-radius:8px"></div>
    <div class="skeleton" style="height:24px;width:70%;margin-bottom:0.75rem;border-radius:4px"></div>
    <div class="skeleton" style="height:16px;width:90%;margin-bottom:0.5rem;border-radius:4px"></div>
    <div class="skeleton" style="height:16px;width:60%;margin-bottom:1rem;border-radius:4px"></div>
    <div style="display:flex;gap:0.5rem">
      <div class="skeleton" style="height:28px;width:80px;border-radius:14px"></div>
      <div class="skeleton" style="height:28px;width:60px;border-radius:14px"></div>
    </div>
  </div>`;
}

/**
 * 创建骨架屏统计卡片
 * @returns {string} HTML 字符串
 */
export function createSkeletonStat() {
  return `<div class="stat-card skeleton-card" role="status" aria-label="加载中">
    <div class="skeleton" style="height:32px;width:60px;margin-bottom:0.5rem;border-radius:4px"></div>
    <div class="skeleton" style="height:16px;width:80px;border-radius:4px"></div>
  </div>`;
}

/**
 * 创建完整骨架屏（模型卡片 + 统计）
 * @param {number} [modelCount=6] - 模型卡片数量
 * @param {number} [statCount=4] - 统计卡片数量
 * @returns {{cards: string, stats: string, full: string}} 骨架屏 HTML
 */
export function createSkeletonScreen(modelCount = 6, statCount = 4) {
  const cards = Array.from({ length: modelCount }, () => createSkeletonCard()).join('');
  const stats = Array.from({ length: statCount }, () => createSkeletonStat()).join('');
  return {
    cards,
    stats,
    full: `<div class="skeleton-screen">
      <div class="skeleton-stats" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:1rem;margin-bottom:2rem">${stats}</div>
      <div class="skeleton-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:1.5rem">${cards}</div>
    </div>`
  };
}

// ==================== 模型卡片 ====================

/**
 * 创建模型卡片 HTML
 * @param {Object} model - 模型对象
 * @param {Object} [opts={}] - 选项
 * @returns {string} HTML 字符串
 */
export function createModelCard(model, opts = {}) {
  if (!model || typeof model !== 'object') {
    console.warn('[createModelCard] 无效的模型数据');
    return '';
  }
  const { isCompact = false, isAdmin = false, isFavorite = false, searchTerm = '' } = opts;
  const gradient = getCategoryGradient(model.category);
  const favClass = isFavorite ? 'active' : '';

  return `<div class="model-card" data-model="${escapeHtml(model.name)}" data-category="${escapeHtml(model.category)}" role="article" aria-label="${escapeHtml(model.name)} 模型卡片">
    <div class="model-card-header" style="background:${gradient}">
      <div class="model-card-category">${escapeHtml(model.category)}</div>
      <div class="model-card-year">${escapeHtml(model.year)}</div>
    </div>
    <div class="model-card-body">
      <h3 class="model-card-title">${highlightText(model.name, searchTerm)}</h3>
      <p class="model-card-desc">${highlightText(model.desc, searchTerm)}</p>
      <div class="model-card-meta">
        ${model.params ? `<span class="meta-tag params-tag">${escapeHtml(model.params)}</span>` : ''}
        ${model.acc ? `<span class="meta-tag acc-tag">${escapeHtml(model.acc)}</span>` : ''}
      </div>
      <div class="model-card-actions">
        <button class="btn btn-sm btn-primary view-model-btn" data-model="${escapeHtml(model.name)}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          查看详情
        </button>
        <button class="btn btn-sm btn-icon fav-btn ${favClass}" data-model-name="${escapeHtml(model.name)}" aria-pressed="${isFavorite}" aria-label="${isFavorite ? '取消收藏' : '收藏'}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="${isFavorite ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
        </button>
      </div>
    </div>
  </div>`;
}

/**
 * 创建分类卡片 HTML
 * @param {string} category - 分类名称
 * @param {number} count - 模型数量
 * @param {string} icon - SVG 图标
 * @returns {string} HTML 字符串
 */
export function createCategoryCard(category, count, icon) {
  return `<div class="category-card" data-category="${escapeHtml(category)}" role="button" tabindex="0" aria-label="浏览${escapeHtml(category)}分类，共${count}个模型">
    <div class="category-icon">${icon}</div>
    <div class="category-info">
      <h3 class="category-name">${escapeHtml(category)}</h3>
      <p class="category-count">${count} 个模型</p>
    </div>
    <svg class="category-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
  </div>`;
}

// ==================== 统计卡片 ====================

/**
 * 创建统计卡片
 * @param {string} value - 数值
 * @param {string} label - 标签
 * @param {string} icon - SVG 图标
 * @returns {string} HTML 字符串
 */
export function createStatCard(value, label, icon) {
  return `<div class="stat-card">
    <div class="stat-icon">${icon}</div>
    <div class="stat-value">${value}</div>
    <div class="stat-label">${label}</div>
  </div>`;
}

// ==================== 搜索栏 ====================

/**
 * 获取搜索历史
 * @returns {Array} 搜索历史数组
 */
function getSearchHistory() {
  try {
    const raw = localStorage.getItem(CONFIG.SEARCH_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

/**
 * 保存搜索历史
 * @param {Array} history - 搜索历史数组
 */
function saveSearchHistory(history) {
  try {
    localStorage.setItem(CONFIG.SEARCH_HISTORY_KEY, JSON.stringify(history.slice(0, 10)));
  } catch (e) {
    console.warn('保存搜索历史失败:', e);
  }
}

/**
 * 添加搜索历史
 * @param {string} term - 搜索词
 */
function addSearchHistory(term) {
  if (!term || !term.trim()) return;
  const history = getSearchHistory();
  const normalized = term.trim();
  const filtered = history.filter(h => h !== normalized);
  filtered.unshift(normalized);
  saveSearchHistory(filtered);
}

/**
 * 删除单条搜索历史
 * @param {string} term - 搜索词
 */
function removeSearchHistory(term) {
  const history = getSearchHistory();
  const filtered = history.filter(h => h !== term);
  saveSearchHistory(filtered);
}

/**
 * 清除所有搜索历史
 */
function clearSearchHistory() {
  try {
    localStorage.removeItem(CONFIG.SEARCH_HISTORY_KEY);
  } catch (e) {
    console.warn('清除搜索历史失败:', e);
  }
}

/**
 * 创建搜索栏 HTML
 * @returns {string} HTML 字符串
 */
export function createSearchBar() {
  return `<div class="search-bar">
    <svg class="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
    <input type="text" class="search-input" placeholder="搜索模型、论文、作者..." aria-label="搜索模型" autocomplete="off" maxlength="100">
    <button class="search-clear" style="display:none" aria-label="清除搜索">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
    <div class="search-history-dropdown" style="display:none"></div>
  </div>`;
}

/**
 * 绑定搜索栏输入事件
 * @param {HTMLInputElement} input - 输入框
 * @param {HTMLElement} clearBtn - 清除按钮
 * @param {Function} onSearch - 搜索回调
 */
function bindInputEvents(input, clearBtn, onSearch) {
  input.addEventListener('input', debounce(() => {
    clearBtn.style.display = input.value ? 'flex' : 'none';
    if (onSearch) onSearch(input.value);
  }, CONFIG.SEARCH_DEBOUNCE));

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && input.value.trim()) {
      addSearchHistory(input.value.trim());
      if (onSearch) onSearch(input.value);
    }
  });
}

/**
 * 绑定搜索栏焦点事件
 * @param {HTMLInputElement} input - 输入框
 * @param {HTMLElement} dropdown - 下拉面板
 * @param {HTMLElement} container - 容器
 * @param {Function} onFocus - 焦点回调
 * @param {Function} onSearch - 搜索回调
 */
function bindFocusEvents(input, dropdown, container, onFocus, onSearch) {
  function renderDropdown() {
    const history = getSearchHistory();
    if (history.length === 0) {
      dropdown.style.display = 'none';
      return;
    }
    dropdown.innerHTML = createSearchHistoryDropdown(history, {
      onSelect: (term) => {
        input.value = term;
        dropdown.style.display = 'none';
        if (onSearch) onSearch(term);
      },
      onDelete: (term) => {
        removeSearchHistory(term);
        renderDropdown();
      },
      onClear: () => {
        clearSearchHistory();
        dropdown.style.display = 'none';
      }
    });
    dropdown.style.display = 'block';
  }

  function hideDropdown() {
    setTimeout(() => {
      if (!container.contains(document.activeElement)) {
        dropdown.style.display = 'none';
      }
    }, 150);
  }

  input.addEventListener('focus', () => {
    renderDropdown();
    if (onFocus) onFocus();
  });

  input.addEventListener('blur', hideDropdown);
  dropdown.addEventListener('mousedown', (e) => e.preventDefault());
}

/**
 * 初始化搜索栏交互（防抖、历史下拉、清除按钮）
 * @param {HTMLElement} container - 容器元素
 * @param {Object} [options={}] - 选项
 */
export function initSearchBar(container, options = {}) {
  if (!container) return;
  const input = container.querySelector('.search-input');
  const clearBtn = container.querySelector('.search-clear');
  const dropdown = container.querySelector('.search-history-dropdown');
  if (!input || !clearBtn || !dropdown) return;

  const { onSearch, onFocus } = options;

  bindInputEvents(input, clearBtn, onSearch);
  bindFocusEvents(input, dropdown, container, onFocus, onSearch);

  clearBtn.addEventListener('click', () => {
    input.value = '';
    clearBtn.style.display = 'none';
    dropdown.style.display = 'none';
    if (onSearch) onSearch('');
    input.focus();
  });

  clearBtn.style.display = input.value ? 'flex' : 'none';
}

// ==================== 搜索历史下拉面板 ====================

/**
 * 创建搜索历史下拉面板 HTML
 * @param {Array} history - 搜索历史
 * @param {Object} [options={}] - 选项
 * @returns {string} HTML 字符串
 */
export function createSearchHistoryDropdown(history, options = {}) {
  if (!history || history.length === 0) return '';
  const { onSelect, onDelete, onClear } = options;
  const deleteIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
  const clockIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>';

  const items = history.map((term) => {
    const safeTerm = escapeHtml(term);
    return `<div class="search-history-item" data-term="${safeTerm}" role="button" tabindex="0">
      <span class="search-history-icon">${clockIcon}</span>
      <span class="search-history-text">${safeTerm}</span>
      <button class="search-history-delete" data-term="${safeTerm}" aria-label="删除 ${safeTerm}" title="删除">
        ${deleteIcon}
      </button>
    </div>`;
  }).join('');

  const wrapper = document.createElement('div');
  wrapper.className = 'search-history-panel';
  wrapper.innerHTML = `<div class="search-history-header">
    <span class="search-history-title">最近搜索</span>
    <button class="search-history-clear-btn" aria-label="清除全部搜索历史">清除全部</button>
  </div>
  <div class="search-history-list">${items}</div>`;

  wrapper.querySelectorAll('.search-history-item').forEach(item => {
    const term = item.dataset.term;
    item.addEventListener('click', (e) => {
      if (e.target.closest('.search-history-delete')) return;
      if (onSelect) onSelect(term);
    });
    item.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (onSelect) onSelect(term);
      }
    });
  });

  wrapper.querySelectorAll('.search-history-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const term = btn.dataset.term;
      if (onDelete) onDelete(term);
    });
  });

  const clearBtn = wrapper.querySelector('.search-history-clear-btn');
  if (clearBtn && onClear) {
    clearBtn.addEventListener('click', onClear);
  }

  return wrapper.outerHTML;
}

// ==================== 空搜索结果 ====================

/**
 * 创建推荐卡片 HTML
 * @param {Array} models - 模型数组
 * @returns {string} HTML 字符串
 */
function createRecommendationCards(models) {
  if (!models || models.length === 0) return '';
  const shuffled = models.slice().sort(() => Math.random() - 0.5);
  const picks = shuffled.slice(0, 3);
  const recCards = picks.map(m => `<div class="empty-search-rec-card" data-model="${escapeHtml(m.name)}">
    <div class="empty-search-rec-name">${escapeHtml(m.name)}</div>
    <div class="empty-search-rec-category">${escapeHtml(m.category)}</div>
  </div>`).join('');
  return `<div class="empty-search-recommendations">
    <p class="empty-search-rec-title">为你推荐</p>
    <div class="empty-search-rec-list">${recCards}</div>
  </div>`;
}

/**
 * 创建空搜索结果提示（含推荐模型）
 * @param {Array} [models=[]] - 模型数组
 * @returns {string} HTML 字符串
 */
export function createEmptySearchResult(models = []) {
  const defaultIcon = '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>';
  const recommendationsHtml = createRecommendationCards(models);
  return `<div class="empty-search-result">
    <div class="empty-search-icon">${defaultIcon}</div>
    <p class="empty-search-text">未找到相关模型</p>
    ${recommendationsHtml}
  </div>`;
}

// ==================== 空状态 ====================

/**
 * 创建空状态提示
 * @param {string} message - 消息
 * @param {string} [icon] - SVG 图标
 * @returns {string} HTML 字符串
 */
export function createEmptyState(message, icon) {
  const defaultIcon = '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>';
  return `<div class="empty-state" aria-live="polite">
    <div class="empty-state-icon">${icon ? escapeHtml(icon) : defaultIcon}</div>
    <p class="empty-state-text">${escapeHtml(message)}</p>
  </div>`;
}

// ==================== 标签页 ====================

/**
 * 创建标签页组件
 * @param {Array} tabs - 标签数组
 * @param {string} activeTab - 当前活跃标签
 * @returns {string} HTML 字符串
 */
export function createTabs(tabs, activeTab) {
  const tabItems = tabs.map(tab =>
    `<button class="tab-btn ${tab.id === activeTab ? 'active' : ''}" data-tab="${tab.id}" role="tab" aria-selected="${tab.id === activeTab}">${tab.label}</button>`
  ).join('');

  return `<div class="tabs" role="tablist">${tabItems}</div>`;
}

// ==================== 进度条 ====================

/**
 * 创建进度条
 * @param {number} value - 当前值
 * @param {number} max - 最大值
 * @param {string} [label] - 标签
 * @returns {string} HTML 字符串
 */
export function createProgressBar(value, max, label) {
  const percent = Math.min((value / max) * 100, 100);
  return `<div class="progress-bar">
    <div class="progress-bar-fill" style="width:${percent}%"></div>
    <span class="progress-bar-label">${label || ''}</span>
  </div>`;
}

// ==================== 代码块 ====================

/**
 * 创建代码块
 * @param {string} code - 代码
 * @param {string} language - 语言
 * @returns {string} HTML 字符串
 */
export function createCodeBlock(code, language) {
  return `<div class="code-block">
    <div class="code-block-header">
      <span class="code-block-lang">${escapeHtml(language || '')}</span>
      <button class="code-block-copy" aria-label="复制代码">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
      </button>
    </div>
    <pre><code>${escapeHtml(code)}</code></pre>
  </div>`;
}

// ==================== 对比表格 ====================

/**
 * 创建对比表格
 * @param {Array} models - 模型数组
 * @returns {string} HTML 字符串
 */
export function createCompareTable(models) {
  if (!models || models.length === 0) return '';

  const headers = models.map(m => `<th>${escapeHtml(m.name)}</th>`).join('');
  const rows = [
    { label: '类别', key: 'category' },
    { label: '年份', key: 'year' },
    { label: '参数量', key: 'params' },
    { label: '准确率', key: 'acc' },
    { label: '描述', key: 'desc' }
  ];

  const bodyRows = rows.map(row => {
    const cells = models.map(m => {
      const val = m[row.key];
      return `<td>${val ? escapeHtml(String(val)) : '-'}</td>`;
    }).join('');
    return `<tr><th>${row.label}</th>${cells}</tr>`;
  }).join('');

  return `<table class="compare-table">
    <thead><tr><th>属性</th>${headers}</tr></thead>
    <tbody>${bodyRows}</tbody>
  </table>`;
}

// ==================== 学习路径卡片 ====================

/**
 * 创建学习路径卡片
 * @param {Object} path - 路径对象
 * @returns {string} HTML 字符串
 */
export function createPathCard(path) {
  const modelsList = path.models.map(m => `<span class="path-model-tag">${escapeHtml(m)}</span>`).join('');
  return `<div class="path-card" data-path="${escapeHtml(path.id)}">
    <div class="path-card-header" style="background: ${path.color}">
      <div class="path-card-icon">${path.icon}</div>
      <div class="path-card-title">${escapeHtml(path.title)}</div>
    </div>
    <div class="path-card-body">
      <p class="path-card-subtitle">${escapeHtml(path.subtitle)}</p>
      <p class="path-card-desc">${escapeHtml(path.description)}</p>
      <div class="path-card-models">${modelsList}</div>
    </div>
  </div>`;
}

// ==================== 对比选择卡片 ====================

/**
 * 创建对比选择卡片
 * @param {Object} model - 模型对象
 * @param {boolean} isSelected - 是否选中
 * @returns {string} HTML 字符串
 */
export function createCompareCard(model, isSelected) {
  return `<div class="compare-select-card ${isSelected ? 'selected' : ''}" data-model="${escapeHtml(model.name)}">
    <div class="compare-select-header">
      <h4>${escapeHtml(model.name)}</h4>
      <span class="compare-select-category">${escapeHtml(model.category)}</span>
    </div>
    <p class="compare-select-desc">${escapeHtml(model.desc)}</p>
    <div class="compare-select-meta">
      ${model.params ? `<span>${escapeHtml(model.params)}</span>` : ''}
      ${model.year ? `<span>${escapeHtml(model.year)}</span>` : ''}
    </div>
  </div>`;
}

// ==================== 管理后台表格 ====================

/**
 * 创建管理后台模型表格行
 * @param {Object} model - 模型对象
 * @param {number} index - 索引
 * @returns {string} HTML 字符串
 */
export function createAdminTableRow(model, index) {
  return `<tr data-index="${index}">
    <td>${escapeHtml(model.name)}</td>
    <td>${escapeHtml(model.category)}</td>
    <td>${escapeHtml(model.year)}</td>
    <td>${escapeHtml(model.params || '')}</td>
    <td>
      <button class="btn btn-sm btn-primary edit-model-btn" data-index="${index}">编辑</button>
      <button class="btn btn-sm btn-danger delete-model-btn" data-index="${index}">删除</button>
    </td>
  </tr>`;
}

// ==================== 模型详情页组件 ====================

/**
 * 创建模型详情头部
 * @param {Object} model - 模型对象
 * @returns {string} HTML 字符串
 */
export function createModelDetailHeader(model) {
  return `<div class="model-detail-header">
    <div class="model-detail-title">
      <h1>${escapeHtml(model.name)}</h1>
      <span class="model-detail-category">${escapeHtml(model.category)}</span>
    </div>
    <div class="model-detail-meta">
      ${model.year ? `<span class="meta-item"><strong>年份:</strong> ${escapeHtml(model.year)}</span>` : ''}
      ${model.params ? `<span class="meta-item"><strong>参数量:</strong> ${escapeHtml(model.params)}</span>` : ''}
      ${model.acc ? `<span class="meta-item"><strong>准确率:</strong> ${escapeHtml(model.acc)}</span>` : ''}
    </div>
  </div>`;
}

/**
 * 创建模型详情描述
 * @param {Object} model - 模型对象
 * @returns {string} HTML 字符串
 */
export function createModelDetailDesc(model) {
  return `<div class="model-detail-desc">
    <h2>模型简介</h2>
    <p>${addTermTooltips(model.desc)}</p>
  </div>`;
}

// ==================== 事件委托辅助 ====================

/**
 * 获取收藏按钮 SVG
 * @param {boolean} isFav - 是否收藏
 * @returns {string} SVG HTML
 */
function getFavoriteIcon(isFav) {
  if (isFav) {
    return '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.5"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>';
  }
  return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>';
}

/**
 * 更新收藏按钮状态
 * @param {HTMLElement} btn - 按钮元素
 * @param {boolean} isFav - 是否收藏
 */
function updateFavoriteButtonState(btn, isFav) {
  if (isFav) {
    btn.classList.add('active');
  } else {
    btn.classList.remove('active');
  }
  btn.innerHTML = getFavoriteIcon(isFav);
  btn.setAttribute('aria-pressed', isFav);
  btn.setAttribute('aria-label', isFav ? '取消收藏' : '收藏');
}

/**
 * 处理模型卡片点击事件
 * @param {Event} e - 点击事件
 * @param {Object} callbacks - 回调函数
 */
function handleCardClick(e, callbacks) {
  const viewBtn = e.target.closest('.view-model-btn');
  if (viewBtn) {
    const modelName = viewBtn.dataset.model;
    if (modelName && callbacks.onView) callbacks.onView(modelName);
    return;
  }

  const favBtn = e.target.closest('.fav-btn');
  if (favBtn) {
    const modelName = favBtn.dataset.modelName;
    if (modelName) toggleFavorite(modelName);
    return;
  }

  const card = e.target.closest('.model-card');
  if (card && callbacks.onCardClick) {
    const modelName = card.dataset.model;
    if (modelName) callbacks.onCardClick(modelName);
  }
}

/**
 * 为容器添加模型卡片点击事件委托
 * @param {HTMLElement} container - 容器元素
 * @param {Object} [callbacks={}] - 回调函数
 */
export function attachModelCardEvents(container, callbacks = {}) {
  if (!container) return;

  container.addEventListener('click', (e) => handleCardClick(e, callbacks));

  // 订阅收藏状态变化，同步更新当前容器内所有收藏按钮
  const unsubscribe = subscribeToFavorites((modelName, isFav) => {
    container.querySelectorAll('.fav-btn').forEach(btn => {
      if (btn.dataset.modelName === modelName) {
        updateFavoriteButtonState(btn, isFav);
      }
    });
  });

  // 将取消订阅函数挂载到容器上，便于外部清理
  container._unsubscribeFavorites = unsubscribe;
}

// ==================== 滚动动画 ====================

/**
 * 初始化滚动显示动画
 * @returns {IntersectionObserver} 观察者实例
 */
export function initScrollAnimations() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

  document.querySelectorAll('.scroll-reveal').forEach(el => {
    observer.observe(el);
  });

  return observer;
}

// ==================== 加载状态 ====================

/**
 * 显示加载状态
 * @param {HTMLElement} container - 容器元素
 * @param {string} [message='加载中...'] - 加载消息
 */
export function showLoading(container, message = '加载中...') {
  if (!container) return;
  // 安全：message 已转义，其余为硬编码 HTML
  container.innerHTML = `<div class="loading-state">
    <div class="loading-spinner"></div>
    <p>${escapeHtml(message)}</p>
  </div>`;
}

/**
 * 隐藏加载状态
 * @param {HTMLElement} container - 容器元素
 */
export function hideLoading(container) {
  if (!container) return;
  const loading = container.querySelector('.loading-state');
  if (loading) loading.remove();
}
