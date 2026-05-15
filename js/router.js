// ============================================================
// Deep Learning Explorer - Router Module
// 路由系统（navigate、showView、路由匹配、历史管理）
// ============================================================

import { state } from './state.js';
import { hasPermission } from './auth.js';
import { closeModal } from './ui-components.js';
import { showLoginModal } from './auth.js';
import { destroyLetterSystem } from './letter-system.js';
import { destroyVisualization } from './viz-engine.js';

// 导航锁，防止快速切换视图时的竞态条件
let isNavigating = false;

/**
 * 清理路由参数，防止 XSS 注入
 * @param {string} param - 原始参数
 * @returns {string} 清理后的参数
 */
function sanitizeRouteParam(param) {
  if (typeof param !== 'string') return '';
  // 仅移除可能导致 XSS 的字符，保留中文、字母、数字、常见标点
  return param.replace(/[<>"'&]/g, '');
}

/**
 * 检查视图是否需要权限并处理登录
 * @param {string} view - 视图名称
 * @returns {boolean} 是否有权限访问
 */
function checkViewPermission(view) {
  if (view === 'favorites' && !hasPermission('favorite')) {
    showLoginModal(() => navigate('favorites'));
    return false;
  }
  if (view === 'admin' && !hasPermission('admin')) {
    showLoginModal(() => navigate('admin'));
    return false;
  }
  return true;
}

/**
 * 清理路由相关资源
 */
function cleanupRouteResources() {
  destroyLetterSystem();
  const vizContainer = document.getElementById('vizContainer') || document.querySelector('.viz-container');
  if (vizContainer) {
    destroyVisualization(vizContainer);
  }
  const modelViz = document.getElementById('modelViz');
  if (modelViz) {
    destroyVisualization(modelViz);
  }
}

/**
 * 更新导航按钮状态
 * @param {string} view - 当前视图名称
 */
function updateNavButtons(view) {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });
}

/**
 * 处理带退出动画的视图切换
 * @param {HTMLElement} activeView - 当前活跃视图
 * @param {string} view - 目标视图
 * @param {Object} params - 路由参数
 */
function handleAnimatedTransition(activeView, view, params) {
  let viewSwitched = false;
  const navigationTimeoutId = setTimeout(() => {
    isNavigating = false;
  }, 5000);

  activeView.classList.add('exiting');
  activeView.addEventListener('animationend', function onExitEnd() {
    clearTimeout(navigationTimeoutId);
    activeView.removeEventListener('animationend', onExitEnd);
    activeView.classList.remove('active', 'exiting');
    if (!viewSwitched) {
      viewSwitched = true;
      showView(view, params);
    }
    isNavigating = false;
  }, { once: true });

  setTimeout(() => {
    if (activeView.classList.contains('exiting')) {
      activeView.classList.remove('active', 'exiting');
      if (!viewSwitched) {
        viewSwitched = true;
        showView(view, params);
      }
    }
    isNavigating = false;
    clearTimeout(navigationTimeoutId);
  }, 300);
}

/**
 * 导航到指定视图
 * @param {string} view - 目标视图名称
 * @param {Object} [params={}] - 路由参数
 */
export function navigate(view, params = {}) {
  if (isNavigating) return;

  // 清理参数，防止 XSS 注入
  const sanitizedParams = {};
  for (const key in params) {
    if (Object.prototype.hasOwnProperty.call(params, key)) {
      sanitizedParams[key] = sanitizeRouteParam(params[key]);
    }
  }
  params = sanitizedParams;

  // 清理视图名称
  view = sanitizeRouteParam(view) || 'home';

  // 先关闭所有已打开的模态框，避免滚动锁定残留
  document.querySelectorAll('.modal-overlay.active').forEach(modal => {
    closeModal(modal.id);
  });

  // 先进行权限检查
  if (!checkViewPermission(view)) return;

  // 如果目标视图与当前视图相同，不重复导航
  if (state.currentView === view && JSON.stringify(params) === JSON.stringify(state.currentParams || {})) return;

  // 路由切换前清理可视化资源和字母系统资源
  cleanupRouteResources();

  state.currentView = view;
  state.currentParams = params;

  // 查找当前活跃的视图元素
  const activeView = document.querySelector('.view.active');
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 更新导航按钮状态
  updateNavButtons(view);

  isNavigating = true;

  if (activeView && !prefersReducedMotion) {
    handleAnimatedTransition(activeView, view, params);
  } else {
    // 无活跃视图或用户偏好减少动画，直接切换
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    showView(view, params);
    isNavigating = false;
  }
}

// 渲染函数引用（由 app.js 设置）
let renderFunctions = {};

/**
 * 设置渲染函数
 * @param {Object} functions - 渲染函数字典
 */
export function setRenderFunctions(functions) {
  renderFunctions = functions;
}

/**
 * 获取视图名称（用于屏幕阅读器）
 * @param {string} view - 视图名称
 * @param {Object} params - 路由参数
 * @returns {string} 视图显示名称
 */
function getViewDisplayName(view, params) {
  const viewNames = {
    home: '首页',
    category: params.category ? `${params.category}分类` : '分类浏览',
    model: params.name ? `${params.name}详情` : '模型详情',
    favorites: '我的收藏',
    admin: '管理后台',
    compare: '模型对比',
    learningPath: '学习路径'
  };
  return viewNames[view] || view;
}

/**
 * 播报视图切换（无障碍支持）
 * @param {string} viewName - 视图显示名称
 */
function announceViewChange(viewName) {
  const announcer = document.getElementById('announcer');
  if (announcer) {
    announcer.textContent = `已切换到${viewName}`;
  }
}

/**
 * 激活指定视图元素
 * @param {string} viewId - 视图元素 ID
 */
function activateView(viewId) {
  const el = document.getElementById(viewId);
  if (el) el.classList.add('active');
}

/**
 * 渲染 404 页面
 */
function renderNotFound() {
  let notFoundView = document.getElementById('notFoundView');
  if (!notFoundView) {
    notFoundView = document.createElement('div');
    notFoundView.id = 'notFoundView';
    notFoundView.className = 'view';
    notFoundView.innerHTML = `
      <div class="container" style="text-align:center;padding:4rem 1rem;">
        <h1 style="font-size:4rem;margin-bottom:1rem;">404</h1>
        <p style="font-size:1.25rem;margin-bottom:2rem;">页面不存在</p>
        <button class="btn btn-primary" id="backToHomeBtn">返回首页</button>
      </div>
    `;
    document.body.appendChild(notFoundView);
    notFoundView.querySelector('#backToHomeBtn').addEventListener('click', () => navigate('home'));
  }
  notFoundView.classList.add('active');
}

/**
 * 显示目标视图（内部函数）
 * @param {string} view - 视图名称
 * @param {Object} params - 路由参数
 */
function showView(view, params) {
  requestAnimationFrame(() => {
    // 播报视图切换（无障碍支持）
    announceViewChange(getViewDisplayName(view, params));

    switch (view) {
      case 'home': {
        activateView('homeView');
        if (renderFunctions.renderHome) renderFunctions.renderHome();
        break;
      }

      case 'category':
        state.currentCategory = params.category || '';
        activateView('categoryView');
        if (renderFunctions.renderCategory) renderFunctions.renderCategory(params.category);
        break;

      case 'model':
        activateView('modelView');
        if (renderFunctions.renderModelPage) renderFunctions.renderModelPage(params.name);
        break;

      case 'favorites':
        activateView('favoritesView');
        if (renderFunctions.renderFavorites) renderFunctions.renderFavorites();
        break;

      case 'admin':
        activateView('adminView');
        if (renderFunctions.renderAdminTable) renderFunctions.renderAdminTable();
        break;

      case 'compare':
        activateView('compareView');
        if (renderFunctions.renderCompare) renderFunctions.renderCompare();
        break;

      case 'learningPath':
        activateView('learningPathView');
        if (renderFunctions.renderLearningPath) renderFunctions.renderLearningPath();
        break;

      default:
        renderNotFound();
        break;
    }

    // 更新 URL hash
    updateURL(view, params);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

/**
 * 更新浏览器 URL
 * @param {string} view - 视图名称
 * @param {Object} [params={}] - 路由参数
 */
export function updateURL(view, params = {}) {
  let hash = view;
  if (view === 'category' && params.category) {
    hash = `category/${encodeURIComponent(params.category)}`;
  } else if (view === 'model' && params.name) {
    hash = `model/${encodeURIComponent(params.name)}`;
  } else if (view === 'compare') {
    hash = 'compare';
  } else if (view === 'learningPath') {
    hash = 'learningPath';
  } else if (view === 'favorites') {
    hash = 'favorites';
  } else if (view === 'admin') {
    hash = 'admin';
  }
  window.location.hash = hash;
}

/**
 * 从 URL hash 解析路由
 * @returns {{view: string, params: Object}} 视图名称和参数
 */
export function parseHash() {
  const hash = window.location.hash.slice(1); // 去掉 #
  const parts = hash.split('/');

  const view = sanitizeRouteParam(parts[0]) || 'home';

  if (view === 'category' && parts[1]) {
    return { view: 'category', params: { category: sanitizeRouteParam(decodeURIComponent(parts[1])) } };
  }
  if (view === 'model' && parts[1]) {
    return { view: 'model', params: { name: sanitizeRouteParam(decodeURIComponent(parts[1])) } };
  }
  if (view === 'admin') {
    return { view: 'admin', params: {} };
  }
  if (view === 'favorites') {
    return { view: 'favorites', params: {} };
  }
  if (view === 'compare') {
    return { view: 'compare', params: {} };
  }
  if (view === 'learningPath') {
    return { view: 'learningPath', params: {} };
  }
  return { view: 'home', params: {} };
}

/**
 * 处理 hash 变化事件
 */
function handleHashChange() {
  const { view, params } = parseHash();
  if (view !== state.currentView) {
    navigate(view, params);
  }
}

/**
 * 处理浏览器前进/后退事件
 */
function handlePopState() {
  const { view, params } = parseHash();
  if (view !== state.currentView || JSON.stringify(params) !== JSON.stringify(state.currentParams || {})) {
    navigate(view, params);
  }
}

/**
 * 初始化 hash 路由监听
 */
export function initHashRouter() {
  window.addEventListener('hashchange', handleHashChange);
  window.addEventListener('popstate', handlePopState);
}
