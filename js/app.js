// ============================================================
// Deep Learning Explorer - Main Entry Point
// 入口文件：导入所有模块并初始化应用
// ============================================================

import {
  CONFIG, GLOSSARY, BLOCK_COLORS, CATEGORY_GRADIENTS, MODULE_CATEGORIES,
  LEARNING_PATHS, safeSetItem, prefersReducedMotion, escapeHtml, debounce,
  hexToBuffer, bufferToHex, generateSalt, hashPassword,
  getCategoryGradient, highlightText, easeOutExpo, animateCount,
  addTermTooltips, initTermTooltips, getBlockIcon, escapeCodeHtml, highlightSyntax
} from './utils.js';

import {
  state, compareState, loadModels, saveModels,
  toggleTheme, restoreTheme, updateThemeIcon,
  getSpotlightScheme, setSpotlightScheme, applySpotlightScheme, initHeroInteractions
} from './state.js';

import {
  navigate, updateURL, parseHash, initHashRouter, setRenderFunctions
} from './router.js';

import {
  PERMISSIONS, userState, hasPermission, requireLogin,
  getUsers, registerUser, loginUser, logoutUser,
  initAdminPassword, setAdminPassword, saveUserState, restoreSession,
  updateUIForRole, toggleFavorite, updateFavoriteButtons,
  showLoginModal, switchAuthTab, handleLogin, handleRegister,
  checkPasswordStrength, toggleUserMenu, logoutAdmin, checkAuth
} from './auth.js';

import {
  showToast, openModal, closeModal, closeAllModals,
  createSkeletonCard, createSkeletonStat, createModelCard,
  createCategoryCard, createStatCard, createSearchBar,
  createEmptyState, createTabs, createProgressBar,
  createCodeBlock, createCompareTable, createPathCard,
  createCompareCard, createAdminTableRow,
  createModelDetailHeader, createModelDetailDesc,
  attachModelCardEvents, setupModelGrid, initScrollAnimations,
  showLoading, hideLoading
} from './ui-components.js';

import {
  createSVGElement, createSVGText, createSVGRect, createSVGCircle,
  createSVGPath, createArrowMarker, parseModelConfig, getBlockTypeName,
  drawBlock, drawConnection, drawFlowArrow,
  renderModelViz, renderParamsTable, renderModelTree,
  initVizInteractions, highlightBlockType, clearHighlight,
  exportSVGToPNG, exportModelConfig,
  destroyVisualization, destroyVizInteractions
} from './viz-engine.js';

import {
  LetterCharacter, LetterSystem, initLetterSystem, createLetterCharacter,
  destroyLetterSystem
} from './letter-system.js';

// ============================================================
// 全局导出（供内联事件处理器和旧代码使用）
// ============================================================

window.DeepLearningExplorer = {
  // Utils
  CONFIG, GLOSSARY, BLOCK_COLORS, CATEGORY_GRADIENTS, MODULE_CATEGORIES, LEARNING_PATHS,
  safeSetItem, prefersReducedMotion, escapeHtml, debounce,
  hexToBuffer, bufferToHex, generateSalt, hashPassword,
  getCategoryGradient, highlightText, easeOutExpo, animateCount,
  addTermTooltips, initTermTooltips, getBlockIcon, escapeCodeHtml, highlightSyntax,

  // State
  state, compareState, loadModels, saveModels,
  toggleTheme, restoreTheme, updateThemeIcon,
  getSpotlightScheme, setSpotlightScheme, applySpotlightScheme, initHeroInteractions,

  // Router
  navigate, updateURL, parseHash, initHashRouter, setRenderFunctions,

  // Auth
  PERMISSIONS, userState, hasPermission, requireLogin,
  getUsers, registerUser, loginUser, logoutUser,
  initAdminPassword, setAdminPassword, saveUserState, restoreSession,
  updateUIForRole, toggleFavorite, updateFavoriteButtons,
  showLoginModal, switchAuthTab, handleLogin, handleRegister,
  checkPasswordStrength, toggleUserMenu, logoutAdmin, checkAuth,

  // UI Components
  showToast, openModal, closeModal, closeAllModals,
  createSkeletonCard, createSkeletonStat, createModelCard,
  createCategoryCard, createStatCard, createSearchBar,
  createEmptyState, createTabs, createProgressBar,
  createCodeBlock, createCompareTable, createPathCard,
  createCompareCard, createAdminTableRow,
  createModelDetailHeader, createModelDetailDesc,
  attachModelCardEvents, initScrollAnimations,
  showLoading, hideLoading,

  // Viz Engine
  createSVGElement, createSVGText, createSVGRect, createSVGCircle,
  createSVGPath, createArrowMarker, parseModelConfig, getBlockTypeName,
  drawBlock, drawConnection, drawFlowArrow,
  renderModelViz, renderParamsTable, renderModelTree,
  initVizInteractions, highlightBlockType, clearHighlight,
  exportSVGToPNG, exportModelConfig,
  destroyVisualization, destroyVizInteractions,

  // Letter System
  LetterCharacter, LetterSystem, initLetterSystem, createLetterCharacter,
  destroyLetterSystem,

  // View Renderers
  renderHomeView, renderCategoryView, renderModelDetailView,
  renderFavoritesView, renderAdminView, renderCompareView,
  renderLearningPathView
};

// ============================================================
// 应用初始化
// ============================================================

async function initApp() {
  // 1. 恢复主题
  restoreTheme();

  // 2. 初始化管理员密码
  initAdminPassword();

  // 3. 恢复用户会话
  restoreSession();

  // 4. 加载模型数据
  try {
    state.models = await loadModels();
  } catch (e) {
    console.error('[App] 模型数据加载失败:', e);
    showToast('模型数据加载失败，请刷新页面重试', 'error');
  }

  // 5. 注册视图渲染函数
  setRenderFunctions({
    renderHome: renderHomeView,
    renderCategory: renderCategoryView,
    renderModelPage: renderModelDetailView,
    renderFavorites: renderFavoritesView,
    renderAdminTable: renderAdminView,
    renderCompare: renderCompareView,
    renderLearningPath: renderLearningPathView
  });

  // 6. 初始化术语 tooltip
  initTermTooltips();

  // 7. 初始化滚动动画
  initScrollAnimations();

  // 8. 初始化 hash 路由
  initHashRouter();

  // 9. 初始化 Hero 交互
  initHeroInteractions();

  // 9.5 初始化字母小人系统
  const letterStage = document.getElementById('letterStage');
  if (letterStage) {
    initLetterSystem(letterStage);
  }

  // 10. 解析初始路由
  const { view, params } = parseHash();
  navigate(view, params);

  // 10. 隐藏骨架屏，显示内容
  const skeletonEl = document.getElementById('app-skeleton');
  const skeletonOverlay = document.getElementById('skeletonOverlay');
  const appEl = document.getElementById('app');
  if (skeletonOverlay) {
    skeletonOverlay.style.opacity = '0';
    skeletonOverlay.style.transition = 'opacity 0.4s ease';
    setTimeout(() => { skeletonOverlay.style.display = 'none'; }, 400);
  }
  if (skeletonEl) {
    skeletonEl.style.opacity = '0';
    skeletonEl.style.transition = 'opacity 0.4s ease';
    setTimeout(() => {
      skeletonEl.style.display = 'none';
      if (appEl) appEl.style.opacity = '1';
    }, 400);
  } else if (appEl) {
    appEl.style.opacity = '1';
  }

  // 初始化完成
}

// ============================================================
// 视图渲染函数
// ============================================================

function renderHomeView() {
  const moduleGrid = document.getElementById('moduleGrid');
  const statModels = document.getElementById('statModels');
  const statCategories = document.getElementById('statCategories');
  const statYears = document.getElementById('statYears');

  if (statModels) animateCount(statModels, state.models.length, 1200);
  if (statCategories) animateCount(statCategories, new Set(state.models.map(m => m.category)).size, 1200);
  if (statYears) {
    const years = state.models.map(m => m.year).filter(Boolean);
    const range = years.length ? `${Math.min(...years)}-${Math.max(...years)}` : '--';
    statYears.textContent = range;
  }

  if (moduleGrid) {
    // 从模型数据中提取分类信息，计算每个分类的模型数量
    const categoryCounts = {};
    state.models.forEach(m => {
      categoryCounts[m.category] = (categoryCounts[m.category] || 0) + 1;
    });
    const categories = Object.keys(categoryCounts);
    moduleGrid.innerHTML = categories.map((cat, index) => {
      const config = MODULE_CATEGORIES[cat] || {};
      return createCategoryCard(cat, categoryCounts[cat], config.icon || '', config.desc || '', index);
    }).join('');
    moduleGrid.addEventListener('click', (e) => {
      const card = e.target.closest('.category-card');
      if (card) navigate('category', { category: card.dataset.category });
    });
    moduleGrid.addEventListener('keydown', (e) => {
      const card = e.target.closest('.category-card');
      if (card && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        navigate('category', { category: card.dataset.category });
      }
    });
    moduleGrid.querySelectorAll('.category-card').forEach(card => {
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        card.style.setProperty('--ripple-x', ((e.clientX - rect.left) / rect.width * 100) + '%');
        card.style.setProperty('--ripple-y', ((e.clientY - rect.top) / rect.height * 100) + '%');
      });
    });
  }

  // 重新初始化字母小人系统（路由切换后会销毁）
  const letterStage = document.getElementById('letterStage');
  if (letterStage) {
    initLetterSystem(letterStage);
  }
}

function renderCategoryView(category) {
  const modelGrid = document.getElementById('modelGrid');
  const searchInput = document.getElementById('searchInput');
  const filterGroup = document.getElementById('filterGroup');
  const emptyState = document.getElementById('emptyState');
  const breadcrumbCategory = document.getElementById('breadcrumbCategory');

  if (breadcrumbCategory) breadcrumbCategory.textContent = category || '全部分类';

  const models = category
    ? state.models.filter(m => m.category === category)
    : [...state.models];

  const years = [...new Set(models.map(m => m.year).filter(Boolean))].sort((a, b) => b - a);
  if (filterGroup) {
    filterGroup.innerHTML = years.map(y => `<button class="filter-btn" data-year="${y}">${y}</button>`).join('');
  }

  function renderModels(filtered) {
    if (!modelGrid) return;
    if (filtered.length === 0) {
      modelGrid.innerHTML = '';
      if (emptyState) emptyState.style.display = 'block';
    } else {
      if (emptyState) emptyState.style.display = 'none';
      modelGrid.innerHTML = filtered.map((m, i) => createModelCard(m, { index: i })).join('');
      setupModelGrid(modelGrid, {
        onView: (modelName) => navigate('model', { name: modelName }),
        onCardClick: (modelName) => navigate('model', { name: modelName })
      });
    }
  }

  renderModels(models);

  if (searchInput) {
    searchInput.addEventListener('input', debounce((e) => {
      const term = e.target.value.trim().toLowerCase();
      const filtered = term
        ? models.filter(m => (
            m.name + (m.description || m.desc || '') + (m.tags?.join('') || '') + m.category + (m.architecture || '')
          ).toLowerCase().includes(term))
        : models;
      renderModels(filtered);
    }, CONFIG.SEARCH_DEBOUNCE));
  }
}

function renderModelDetailView(name) {
  const modelPageBody = document.getElementById('modelPageBody');
  const breadcrumbCat = document.getElementById('modelBreadcrumbCat');
  const breadcrumbName = document.getElementById('modelBreadcrumbName');
  const model = state.models.find(m => m.name === name);

  if (!model || !modelPageBody) {
    if (modelPageBody) modelPageBody.innerHTML = createEmptyState('模型未找到');
    return;
  }

  if (breadcrumbCat) {
    breadcrumbCat.textContent = model.category;
    breadcrumbCat.href = `#category/${encodeURIComponent(model.category)}`;
    breadcrumbCat.onclick = (e) => { e.preventDefault(); navigate('category', { category: model.category }); };
  }
  if (breadcrumbName) breadcrumbName.textContent = model.name;

  modelPageBody.innerHTML = `
    <div class="detail-layout">
      <div class="detail-main">
        ${createModelDetailHeader(model)}
        <div class="model-viz-container" id="modelViz"></div>
        <div class="model-params-container" id="modelParams"></div>
        <div class="model-code-container" id="modelCode"></div>
      </div>
      ${createModelDetailDesc(model)}
    </div>
  `;

  const accordionHeaders = modelPageBody.querySelectorAll('.accordion-header');
  accordionHeaders.forEach(header => {
    header.addEventListener('click', () => {
      const section = header.closest('.accordion-section');
      const isExpanded = section.getAttribute('aria-expanded') === 'true';
      section.setAttribute('aria-expanded', isExpanded ? 'false' : 'true');
      header.setAttribute('aria-expanded', isExpanded ? 'false' : 'true');
    });
    header.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        header.click();
      }
    });
  });

  const vizContainer = document.getElementById('modelViz');
  if (vizContainer) {
    renderModelViz(vizContainer, model);
    initVizInteractions(vizContainer);
  }

  const paramsContainer = document.getElementById('modelParams');
  if (paramsContainer) renderParamsTable(paramsContainer, model);

  const codeContainer = document.getElementById('modelCode');
  if (codeContainer && model.code) {
    codeContainer.innerHTML = createCodeBlock(model.code, model.framework);
  }
}

function renderFavoritesView() {
  const favModelGrid = document.getElementById('favModelGrid');
  const favEmptyState = document.getElementById('favEmptyState');
  const favCount = document.getElementById('favCount');
  const favModels = state.models.filter(m => userState.favorites.includes(m.name));

  if (favCount) favCount.textContent = favModels.length;

  if (favModels.length === 0) {
    if (favModelGrid) favModelGrid.innerHTML = '';
    if (favEmptyState) favEmptyState.style.display = 'block';
  } else {
    if (favEmptyState) favEmptyState.style.display = 'none';
    if (favModelGrid) {
      favModelGrid.innerHTML = favModels.map((m, i) => createModelCard(m, { index: i })).join('');
      setupModelGrid(favModelGrid, {
        onView: (modelName) => navigate('model', { name: modelName }),
        onCardClick: (modelName) => navigate('model', { name: modelName })
      });
    }
  }
}

function renderAdminView() {
  const adminTable = document.getElementById('adminTable');
  if (!adminTable) return;

  const tableHTML = `
    <table class="admin-table">
      <thead>
        <tr>
          <th>模型名称</th>
          <th>类别</th>
          <th>年份</th>
          <th>参数</th>
          <th>准确率</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        ${state.models.map(m => createAdminTableRow(m)).join('')}
      </tbody>
    </table>
  `;
  adminTable.innerHTML = tableHTML;
}

function renderCompareView() {
  const compareViewBody = document.getElementById('compareViewBody');
  if (!compareViewBody) return;

  const selectedModels = state.models.filter(m => compareState.selected.includes(m.name));
  if (selectedModels.length === 0) {
    compareViewBody.innerHTML = createEmptyState('请先选择要对比的模型', '对比');
    return;
  }

  compareViewBody.innerHTML = createCompareTable(selectedModels);
}

function renderLearningPathView() {
  const learningPathViewBody = document.getElementById('learningPathViewBody');
  if (!learningPathViewBody) return;

  learningPathViewBody.innerHTML = LEARNING_PATHS.map(path => createPathCard(path)).join('');

  // 绑定模型标签点击事件
  learningPathViewBody.querySelectorAll('.path-model-tag').forEach(tag => {
    tag.addEventListener('click', () => {
      const modelName = tag.dataset.model;
      const model = state.models.find(m => m.name === modelName);
      if (model) {
        navigate('model', { name: modelName });
      } else {
        showToast(`模型 "${modelName}" 暂未收录`, 'warning');
      }
    });
  });
}

// ============================================================
// 全局事件监听
// ============================================================

// ESC 关闭模态框
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    const activeModal = document.querySelector('.modal-overlay.active');
    if (activeModal) closeModal(activeModal.id);
  }
});

// 点击模态框背景关闭
document.querySelectorAll('.modal-overlay').forEach(modal => {
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal(modal.id);
  });
});

// 页面卸载或路由切换时清理资源
window.addEventListener('beforeunload', () => {
  destroyLetterSystem();
});

// 导出全局访问（向后兼容）
window.navigate = navigate;
window.showToast = showToast;
window.openModal = openModal;
window.closeModal = closeModal;
window.toggleTheme = toggleTheme;
window.toggleFavorite = toggleFavorite;
window.showLoginModal = showLoginModal;
window.switchAuthTab = switchAuthTab;
window.handleLogin = handleLogin;
window.handleRegister = handleRegister;
window.checkPasswordStrength = checkPasswordStrength;
window.toggleUserMenu = toggleUserMenu;
window.logoutAdmin = logoutAdmin;
window.logoutUser = logoutUser;
window.showDetail = showDetail;
window.updateRipple = updateRipple;

// ============================================================
// 缺失的全局函数（供内联 onclick 调用）
// ============================================================

function updateRipple(event, el) {
  const rect = el.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width * 100).toFixed(1);
  const y = ((event.clientY - rect.top) / rect.height * 100).toFixed(1);
  el.style.setProperty('--ripple-x', x + '%');
  el.style.setProperty('--ripple-y', y + '%');
}

function showDetail(id) {
  const m = state.models.find(x => x.id === id);
  if (!m) return;

  const body = document.getElementById('detailBody');
  body.innerHTML = `
    <div class="detail-hero">
      <h2>${escapeHtml(m.name)}</h2>
      ${m.fullName ? `<p class="detail-fullname">${escapeHtml(m.fullName)}</p>` : ''}
      <div class="detail-badges">
        ${m.year ? `<span class="badge badge-year">${m.year}</span>` : ''}
        ${m.category ? `<span class="badge badge-category">${escapeHtml(m.category)}</span>` : ''}
        ${m.architecture ? `<span class="badge badge-arch">${escapeHtml(m.architecture)}</span>` : ''}
      </div>
    </div>

    ${(m.authors || m.institution || m.architecture || (m.parameters || m.params)) ? `
    <div class="detail-info-grid">
      ${m.authors ? `<div class="detail-info-item"><div class="label">作者</div><div class="value">${escapeHtml(m.authors)}</div></div>` : ''}
      ${m.institution ? `<div class="detail-info-item"><div class="label">机构</div><div class="value">${escapeHtml(m.institution)}</div></div>` : ''}
      ${m.architecture ? `<div class="detail-info-item"><div class="label">架构</div><div class="value">${escapeHtml(m.architecture)}</div></div>` : ''}
      ${(m.parameters || m.params) ? `<div class="detail-info-item"><div class="label">参数量</div><div class="value">${escapeHtml(m.parameters || m.params)}</div></div>` : ''}
    </div>
    ` : ''}

    ${(m.description || m.desc) ? `
    <div class="detail-desc">
      ${addTermTooltips(m.description || m.desc)}
    </div>
    ` : ''}

    ${m.innovation ? `
    <div class="detail-desc" style="border-left-color: var(--accent-secondary);">
      <strong style="color: var(--text-primary); display: block; margin-bottom: 4px;">核心创新</strong>
      ${addTermTooltips(m.innovation)}
    </div>
    ` : ''}

    ${m.tags && m.tags.length ? `
    <div class="detail-tags">
      ${m.tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}
    </div>
    ` : ''}

    ${(m.paperUrl || m.paper) ? `
    <div class="detail-actions">
      ${(m.paperUrl || m.paper) ? `<a href="${escapeHtml(m.paperUrl || m.paper)}" target="_blank" rel="noopener" class="btn btn-secondary">论文链接</a>` : ''}
      <button class="btn btn-primary" data-action="view-full-detail" data-model="${escapeHtml(m.name).replace(/'/g, "\\'")}">查看完整详情 →</button>
    </div>
    ` : ''}
  `;

  openModal('detailModal');
}

function toggleCompareMode() {
  if (!state.models) return;
  const btn = document.getElementById('compareModeBtn');
  const isActive = btn && btn.classList.contains('active');
  if (isActive) {
    btn.classList.remove('active');
    compareState.selected = [];
    document.querySelectorAll('.model-card').forEach(c => c.classList.remove('compare-selected'));
    showToast('已退出对比模式', 'info');
  } else {
    btn.classList.add('active');
    showToast('对比模式已开启，点击模型卡片进行选择', 'info');
  }
}

function showAddForm() {
  openModal('editModal');
  const form = document.getElementById('editForm');
  if (form) form.reset();
  const title = document.getElementById('editModalTitle');
  if (title) title.textContent = '添加模型';
}

function exportData() {
  if (!state.models || state.models.length === 0) {
    showToast('没有可导出的数据', 'warning');
    return;
  }
  const dataStr = JSON.stringify(state.models, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'models-export-' + new Date().toISOString().slice(0, 10) + '.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('数据导出成功', 'success');
}

function showImportDialog() {
  openModal('importModal');
  const textarea = document.getElementById('importData');
  const errorEl = document.getElementById('importError');
  if (textarea) textarea.value = '';
  if (errorEl) errorEl.style.display = 'none';
}

function importData() {
  const textarea = document.getElementById('importData');
  const errorEl = document.getElementById('importError');
  if (!textarea) return;
  const raw = textarea.value.trim();
  if (!raw) {
    if (errorEl) { errorEl.textContent = '请输入 JSON 数据'; errorEl.style.display = 'block'; }
    return;
  }
  try {
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) throw new Error('数据必须是 JSON 数组');
    state.models = data;
    saveModels();
    closeModal('importModal');
    showToast('数据导入成功，共 ' + data.length + ' 条', 'success');
    navigate('home');
  } catch (e) {
    if (errorEl) { errorEl.textContent = '导入失败：' + e.message; errorEl.style.display = 'block'; }
  }
}

function showInteractionGuide() {
  openModal('interactionGuideModal');
}

function clearSearch() {
  var searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.value = '';
    searchInput.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

function showCompare() {
  navigate('compare');
}

function updateCompareUI() {
  var bar = document.getElementById('compareBar');
  var countEl = document.getElementById('compareBarCount');
  var modelsEl = document.getElementById('compareBarModels');
  var count = compareState.selected.length;
  if (countEl) countEl.textContent = count;
  if (modelsEl) modelsEl.textContent = compareState.selected.join('、');
  if (bar) bar.style.display = count > 0 ? 'flex' : 'none';
}

window.toggleCompareMode = toggleCompareMode;
window.showAddForm = showAddForm;
window.exportData = exportData;
window.showImportDialog = showImportDialog;
window.importData = importData;
window.showInteractionGuide = showInteractionGuide;
window.clearSearch = clearSearch;
window.showCompare = showCompare;
window.updateCompareUI = updateCompareUI;

// ============================================================
// 应用启动入口（仅初始化一次）
// ============================================================
// v2025.05.14-2

function startApp() {
  initApp();

  // 反馈表单处理
  const feedbackForm = document.getElementById('feedbackForm');
  if (feedbackForm) {
    feedbackForm.addEventListener('submit', function(e) {
      e.preventDefault();
      const type = document.getElementById('feedbackType').value;
      const content = document.getElementById('feedbackContent').value;
      const feedback = {
        type, content,
        url: location.href,
        timestamp: Date.now(),
        userAgent: navigator.userAgent
      };
      const existing = JSON.parse(localStorage.getItem('dl_feedback') || '[]');
      existing.push(feedback);
      localStorage.setItem('dl_feedback', JSON.stringify(existing));
      showToast('感谢您的反馈！', 'success');
      closeModal('feedbackModal');
      feedbackForm.reset();
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startApp);
} else {
  startApp();
}
