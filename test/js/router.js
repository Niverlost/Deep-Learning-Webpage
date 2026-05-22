// ============================================================
// Deep Learning Explorer - Router Module (Optimized)
// 路由系统（navigate、showView、路由匹配、历史管理）
// ============================================================

// 导航锁，防止快速切换视图时的竞态条件
let isNavigating = false;
let navigationTimeout = null;

/**
 * 清理路由参数，防止 XSS 注入
 * @param {string} param - 原始参数
 * @returns {string} 清理后的参数
 */
function sanitizeRouteParam(param) {
  if (param == null) return '';
  const str = String(param);
  return str.replace(/[<>"'&]/g, '').trim();
}

/**
 * 验证视图名称是否有效
 * @param {string} view - 视图名称
 * @returns {boolean} 是否有效
 */
function isValidView(view) {
  const validViews = ['home', 'category', 'model', 'favorites', 'admin', 'compare', 'learningPath'];
  return validViews.includes(view);
}

/**
 * 检查视图是否需要权限并处理登录
 * @param {string} view - 视图名称
 * @returns {boolean} 是否有权限访问
 */
function checkViewPermission(view) {
  try {
    if (view === 'favorites' && !hasPermission('favorite')) {
      showLoginModal(() => navigate('favorites'));
      return false;
    }
    if (view === 'admin' && !hasPermission('admin')) {
      showLoginModal(() => navigate('admin'));
      return false;
    }
    return true;
  } catch (error) {
    console.error('[Router] 权限检查失败:', error);
    return false;
  }
}

/**
 * 清理路由相关资源
 */
function cleanupRouteResources() {
  try {
    destroyLetterSystem();
    const vizContainer = document.getElementById('vizContainer') || document.querySelector('.viz-container');
    if (vizContainer) {
      destroyVisualization(vizContainer);
    }
    const modelViz = document.getElementById('modelViz');
    if (modelViz) {
      destroyVisualization(modelViz);
    }
  } catch (error) {
    console.warn('[Router] 资源清理时出错:', error);
  }
}

/**
 * 更新导航按钮状态
 * @param {string} view - 视图名称
 */
function updateNavButtons(view) {
  try {
    document.querySelectorAll('.nav-btn').forEach(btn => {
      const isActive = btn.dataset.view === view;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-current', isActive ? 'page' : 'false');
    });
  } catch (error) {
    console.warn('[Router] 更新导航按钮失败:', error);
  }
}

/**
 * 处理带退出动画的视图切换
 * @param {HTMLElement} activeView - 当前活跃视图
 * @param {string} view - 目标视图
 * @param {Object} params - 路由参数
 */
function handleAnimatedTransition(activeView, view, params) {
  let viewSwitched = false;
  
  // 清理之前的超时
  if (navigationTimeout) {
    clearTimeout(navigationTimeout);
  }

  const navigationTimeoutId = setTimeout(() => {
    console.warn('[Router] 视图切换超时，强制切换');
    if (!viewSwitched) {
      try {
        showView(view, params);
      } catch (e) {
        console.error('[Router] showView 执行失败:', e);
        renderNotFound();
      }
    }
    isNavigating = false;
  }, 5000);

  navigationTimeout = navigationTimeoutId;

  activeView.classList.add('exiting');
  activeView.addEventListener('animationend', function onExitEnd() {
    clearTimeout(navigationTimeoutId);
    activeView.removeEventListener('animationend', onExitEnd);
    activeView.classList.remove('active', 'exiting');
    if (!viewSwitched) {
      viewSwitched = true;
      try {
        showView(view, params);
      } catch (e) {
        console.error('[Router] showView 执行失败:', e);
        renderNotFound();
      }
    }
    isNavigating = false;
  }, { once: true });

  // 备用超时，防止 animationend 不触发
  setTimeout(() => {
    if (activeView.classList.contains('exiting')) {
      activeView.classList.remove('active', 'exiting');
      if (!viewSwitched) {
        viewSwitched = true;
        try {
          showView(view, params);
        } catch (e) {
          console.error('[Router] showView 执行失败:', e);
          renderNotFound();
        }
      }
      isNavigating = false;
      clearTimeout(navigationTimeoutId);
    }
  }, 300);
}

/**
 * 导航到指定视图
 * @param {string} view - 目标视图名称
 * @param {Object} [params={}] - 路由参数
 */
function navigate(view, params = {}) {
  if (isNavigating) {
    console.warn('[Router] 正在导航中，忽略重复请求');
    return;
  }

  try {
    // 清理参数，防止 XSS 注入
    const sanitizedParams = {};
    for (const key in params) {
      if (Object.prototype.hasOwnProperty.call(params, key)) {
        sanitizedParams[key] = sanitizeRouteParam(params[key]);
      }
    }
    params = sanitizedParams;

    // 清理并验证视图名称
    view = sanitizeRouteParam(view) || 'home';
    if (!isValidView(view)) {
      console.warn('[Router] 无效的视图名称:', view);
      view = 'home';
    }

    // 先关闭所有已打开的模态框，避免滚动锁定残留
    try {
      closeAllModals();
    } catch (e) {
      console.warn('[Router] 关闭模态框失败:', e);
    }

    // 先进行权限检查
    if (!checkViewPermission(view)) return;

    // 如果目标视图与当前视图相同，不重复导航
    if (state.currentView === view && JSON.stringify(params) === JSON.stringify(state.currentParams || {})) {
      console.info('[Router] 目标视图与当前视图相同，跳过导航');
      return;
    }

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
  } catch (error) {
    console.error('[Router] 导航失败:', error);
    isNavigating = false;
    showToast('导航失败，请重试', 'error');
  }
}

// 渲染函数引用（由 app.js 设置）
let renderFunctions = {};

/**
 * 设置渲染函数
 * @param {Object} functions - 渲染函数字典
 */
function setRenderFunctions(functions) {
  renderFunctions = functions || {};
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
  try {
    const announcer = document.getElementById('announcer');
    if (announcer) {
      announcer.textContent = `已切换到${viewName}`;
    }
  } catch (error) {
    console.warn('[Router] 无障碍播报失败:', error);
  }
}

/**
 * 激活指定视图元素
 * @param {string} viewId - 视图元素ID
 */
function activateView(viewId) {
  try {
    const el = document.getElementById(viewId);
    if (el) {
      el.classList.add('active');
      // 设置 tabindex 便于无障碍导航，但不调用 el.focus()
      // 避免非交互元素获得程序化焦点产生蓝色焦点轮廓（蓝条问题）
      el.setAttribute('tabindex', '-1');
    }
  } catch (error) {
    console.warn('[Router] 激活视图失败:', error);
  }
}

/**
 * 渲染 404 页面
 */
function renderNotFound() {
  try {
    let notFoundView = document.getElementById('notFoundView');
    if (!notFoundView) {
      notFoundView = document.createElement('div');
      notFoundView.id = 'notFoundView';
      notFoundView.className = 'view';
      notFoundView.innerHTML = `
        <div class="container" style="text-align:center;padding:4rem 1rem;">
          <h1 style="font-size:4rem;margin-bottom:1rem;">404</h1>
          <p style="font-size:1.25rem;margin-bottom:2rem;">页面不存在</p>
          <button class="btn btn-primary" id="backToHomeBtn" onclick="navigate('home')">返回首页</button>
        </div>
      `;
      document.body.appendChild(notFoundView);
    }
    notFoundView.classList.add('active');
  } catch (error) {
    console.error('[Router] 渲染404页面失败:', error);
  }
}

/**
 * 显示目标视图（内部函数）
 * @param {string} view - 视图名称
 * @param {Object} params - 路由参数
 */
function showView(view, params) {
  requestAnimationFrame(() => {
    try {
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
      // 仅在新页面导航时滚动到顶部（例如模型详情页）
      if (view === 'model') {
        window.scrollTo({ top: 0, behavior: 'instant' });
      }
    } catch (error) {
      console.error('[Router] 显示视图失败:', error);
      renderNotFound();
    }
  });
}

/**
 * 更新浏览器 URL
 * @param {string} view - 视图名称
 * @param {Object} [params={}] - 路由参数
 */
function updateURL(view, params = {}) {
  try {
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
    // 使用 replaceState 避免额外的历史记录
    history.replaceState(null, '', `#${hash}`);
  } catch (error) {
    console.warn('[Router] 更新URL失败:', error);
  }
}

/**
 * 从 URL hash 解析路由
 * @returns {{view: string, params: Object}} 视图名称和参数
 */
function parseHash() {
  try {
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
  } catch (error) {
    console.error('[Router] 解析hash失败:', error);
    return { view: 'home', params: {} };
  }
}

/**
 * 处理 hash 变化事件
 */
function handleHashChange() {
  try {
    const { view, params } = parseHash();
    if (view !== state.currentView) {
      navigate(view, params);
    }
  } catch (error) {
    console.error('[Router] 处理hash变化失败:', error);
  }
}

/**
 * 处理浏览器前进/后退事件
 */
function handlePopState() {
  try {
    const { view, params } = parseHash();
    if (view !== state.currentView || JSON.stringify(params) !== JSON.stringify(state.currentParams || {})) {
      navigate(view, params);
    }
  } catch (error) {
    console.error('[Router] 处理popstate失败:', error);
  }
}

/**
 * 初始化 hash 路由监听
 */
function initHashRouter() {
  try {
    window.addEventListener('hashchange', debounce(handleHashChange, 100));
    window.addEventListener('popstate', debounce(handlePopState, 100));
    console.info('[Router] 路由系统初始化完成');
  } catch (error) {
    console.error('[Router] 路由初始化失败:', error);
  }
}
