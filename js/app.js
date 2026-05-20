// ============================================================
// Deep Learning Explorer - Main Entry Point
// 入口文件：导入所有模块并初始化应用
// ============================================================








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
  highlightCode, showCodeModal, copyCodeToClipboard,

  // Viz Engine
  createSVGElement, createSVGText, createSVGRect, createSVGCircle,
  createSVGPath, createArrowMarker, parseModelConfig, getBlockTypeName,
  drawBlock, drawConnection, drawFlowArrow,
  renderModelViz, renderParamsTable, renderModelTree,
  initVizInteractions, highlightBlockType, clearHighlight,
  exportSVGToPNG, exportModelConfig,
  destroyVisualization, destroyVizInteractions,

  // Letter System
  initLetterSystem, destroyLetterSystem,

  // View Renderers
  renderHomeView, renderCategoryView, renderModelDetailView,
  renderFavoritesView, renderAdminView, renderCompareView,
  renderLearningPathView
};

// ============================================================
// 应用初始化
// ============================================================

async function initApp() {
  console.log('[App] 开始初始化...');
  
  try {
    // 1. 恢复主题
    try {
      if (typeof restoreTheme === 'function') {
        restoreTheme();
      }
    } catch (e) {
      console.warn('[App] 主题恢复失败:', e);
    }

    // 2. 初始化管理员密码
    try {
      if (typeof initAdminPassword === 'function') {
        initAdminPassword();
      }
    } catch (e) {
      console.warn('[App] 管理员密码初始化失败:', e);
    }

    // 3. 恢复用户会话
    try {
      if (typeof restoreSession === 'function') {
        restoreSession();
      }
    } catch (e) {
      console.warn('[App] 用户会话恢复失败:', e);
    }

    // 4. 加载模型数据
    try {
      if (typeof loadModels === 'function' && state) {
        state.models = await loadModels();
        console.log('[App] 模型数据加载成功');
      }
    } catch (e) {
      console.error('[App] 模型数据加载失败:', e);
      if (typeof showToast === 'function') {
        showToast('模型数据加载失败，请刷新页面重试', 'error');
      }
    }

    // 5. 注册视图渲染函数
    try {
      if (typeof setRenderFunctions === 'function') {
        setRenderFunctions({
          renderHome: typeof renderHomeView === 'function' ? renderHomeView : null,
          renderCategory: typeof renderCategoryView === 'function' ? renderCategoryView : null,
          renderModelPage: typeof renderModelDetailView === 'function' ? renderModelDetailView : null,
          renderFavorites: typeof renderFavoritesView === 'function' ? renderFavoritesView : null,
          renderAdminTable: typeof renderAdminView === 'function' ? renderAdminView : null,
          renderCompare: typeof renderCompareView === 'function' ? renderCompareView : null,
          renderLearningPath: typeof renderLearningPathView === 'function' ? renderLearningPathView : null
        });
      }
    } catch (e) {
      console.warn('[App] 视图渲染函数注册失败:', e);
    }

    // 6. 初始化术语 tooltip
    try {
      if (typeof initTermTooltips === 'function') {
        initTermTooltips();
      }
    } catch (e) {
      console.warn('[App] 术语提示初始化失败:', e);
    }

    // 7. 初始化滚动动画
    try {
      if (typeof initScrollAnimations === 'function') {
        initScrollAnimations();
      }
    } catch (e) {
      console.warn('[App] 滚动动画初始化失败:', e);
    }

    // 8. 初始化 hash 路由
    try {
      if (typeof initHashRouter === 'function') {
        initHashRouter();
      }
    } catch (e) {
      console.warn('[App] 路由初始化失败:', e);
    }

    // 9. 初始化 Hero 交互
    try {
      if (typeof initHeroInteractions === 'function') {
        initHeroInteractions();
      }
    } catch (e) {
      console.warn('[App] Hero交互初始化失败:', e);
    }

    // 9.5 初始化字母小人系统
    try {
      const letterStage = document.getElementById('letterStage');
      if (letterStage && typeof initLetterSystem === 'function') {
        initLetterSystem(letterStage);
      }
    } catch (e) {
      console.warn('[App] 字母小人系统初始化失败:', e);
    }

    // 10. 解析初始路由
    try {
      if (typeof parseHash === 'function' && typeof navigate === 'function') {
        const { view, params } = parseHash();
        navigate(view, params);
      }
    } catch (e) {
      console.warn('[App] 路由导航失败:', e);
    }

    // 11. 隐藏骨架屏，显示内容
    try {
      const skeletonEl = document.getElementById('app-skeleton');
      const skeletonOverlay = document.getElementById('skeletonOverlay');
      const appEl = document.getElementById('app');
      
      if (skeletonOverlay) {
        skeletonOverlay.style.opacity = '0';
        skeletonOverlay.style.transition = 'opacity 0.4s ease';
        setTimeout(() => { 
          if (skeletonOverlay.parentNode) {
            skeletonOverlay.style.display = 'none'; 
          }
        }, 400);
      }
      
      if (skeletonEl) {
        skeletonEl.style.opacity = '0';
        skeletonEl.style.transition = 'opacity 0.4s ease';
        setTimeout(() => {
          if (skeletonEl.parentNode) {
            skeletonEl.style.display = 'none';
          }
          if (appEl) {
            appEl.style.opacity = '1';
          }
        }, 400);
      } else if (appEl) {
        appEl.style.opacity = '1';
      }
    } catch (e) {
      console.warn('[App] 骨架屏隐藏失败:', e);
    }

    console.log('[App] 初始化完成');
  } catch (error) {
    console.error('[App] 初始化过程中发生错误:', error);
    if (typeof showToast === 'function') {
      showToast('应用初始化失败，请刷新页面重试', 'error');
    }
  }
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
    const years = state.models.map(m => m.year).filter(y => typeof y === 'number' && !isNaN(y));
    const range = years.length ? `${Math.min(...years)}-${Math.max(...years)}` : '--';
    statYears.textContent = range;
  }

  if (moduleGrid) {
    const categoryCounts = {};
    state.models.forEach(m => {
      if (m.category) {
        categoryCounts[m.category] = (categoryCounts[m.category] || 0) + 1;
      }
    });
    const categories = Object.keys(categoryCounts);
    moduleGrid.innerHTML = categories.map((cat, index) => {
      const config = MODULE_CATEGORIES[cat] || {};
      return createCategoryCard(cat, categoryCounts[cat], config.icon || '', index);
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

  const letterStage = document.getElementById('letterStage');
  if (letterStage && typeof initLetterSystem === 'function') {
    try {
      initLetterSystem(letterStage);
    } catch (e) {
      console.warn('[App] renderHomeView: 字母小人系统初始化失败:', e);
    }
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

  const years = [...new Set(models.map(m => m.year).filter(y => typeof y === 'number' && !isNaN(y)))].sort((a, b) => b - a);
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
        ? models.filter(m => {
            const name = m.name || '';
            const desc = m.description || m.desc || '';
            const tags = m.tags ? m.tags.join('') : '';
            return (name + desc + tags).toLowerCase().includes(term);
          })
        : models;
      renderModels(filtered);
    }, CONFIG.SEARCH_DEBOUNCE));
  }
}

/**
 * 显示模型预览模态框（点击卡片时弹出，图二样式）
 * @param {string} modelName - 模型名称
 */
function showModelPreview(modelName) {
  const model = state.models.find(m => m.name === modelName);
  if (!model) return;

  const body = document.getElementById('detailBody');
  if (!body) return;

  const infoItems = [];
  if (model.authors || model.author) {
    infoItems.push({ label: '作者', value: model.authors || model.author });
  }
  if (model.institution || model.organization) {
    infoItems.push({ label: '机构', value: model.institution || model.organization });
  }
  if (model.architecture) {
    infoItems.push({ label: '架构', value: model.architecture });
  }
  if (model.parameters || model.params) {
    infoItems.push({ label: '参数量', value: String(model.parameters || model.params) });
  }

  const infoGridHtml = infoItems.length
    ? `<div class="detail-info-grid" style="margin-bottom: 20px;">${infoItems.map(item => `
        <div class="detail-info-item">
          <div class="label">${escapeHtml(item.label)}</div>
          <div class="value">${escapeHtml(item.value)}</div>
        </div>
      `).join('')}</div>`
    : '';

  const descHtml = (model.description || model.desc)
    ? `<div class="detail-desc" style="margin-bottom: 20px;">${addTermTooltips(model.description || model.desc)}</div>`
    : '';

  const innovationHtml = model.innovation || model.keyInnovation
    ? `<div class="detail-desc" style="margin-bottom: 20px; border-left-color: var(--accent-secondary);">
        <strong style="color: var(--text-primary); display: block; margin-bottom: 4px;">核心创新</strong>
        ${addTermTooltips(model.innovation || model.keyInnovation)}
      </div>`
    : '';

  const tags = model.tags || [];
  const tagsHtml = tags.length
    ? `<div class="detail-tags" style="margin-bottom: 20px;">${tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>`
    : '';

  const paperUrl = model.paperUrl || model.paper;

  body.innerHTML = `
    <div class="detail-hero">
      <h2>${escapeHtml(model.name)}</h2>
      ${model.fullName ? `<p class="detail-fullname">${escapeHtml(model.fullName)}</p>` : ''}
      <div class="detail-badges">
        ${model.year ? `<span class="badge badge-year">${model.year}</span>` : ''}
        ${model.category ? `<span class="badge badge-category">${escapeHtml(model.category)}</span>` : ''}
        ${model.architecture ? `<span class="badge badge-arch">${escapeHtml(model.architecture)}</span>` : ''}
      </div>
    </div>
    ${infoGridHtml}
    ${descHtml}
    ${innovationHtml}
    ${tagsHtml}
    <div class="detail-actions">
      ${paperUrl ? `<a href="${escapeHtml(paperUrl)}" target="_blank" rel="noopener" class="btn btn-secondary">论文链接</a>` : ''}
      <button class="btn btn-primary" onclick="closeModal('detailModal'); navigate('model', {name: '${escapeHtml(model.name).replace(/'/g, "\\'")}'})"">查看完整详情 →</button>
    </div>
  `;

  openModal('detailModal');
}

function renderModelDetailView(name, mode = 'view') {
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

  const isAdmin = state.isAdmin;
  const modeToggleHtml = isAdmin ? `
    <div class="model-page-mode-toggle">
      <button class="mode-btn ${mode === 'view' ? 'active' : ''}" onclick="renderModelDetailView('${escapeHtml(name)}', 'view')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
        浏览
      </button>
      <button class="mode-btn ${mode === 'edit' ? 'active' : ''}" onclick="renderModelDetailView('${escapeHtml(name)}', 'edit')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
        编辑
      </button>
    </div>
  ` : '';

  if (mode === 'edit' && isAdmin) {
    modelPageBody.innerHTML = `
      ${modeToggleHtml}
      <div class="detail-layout">
        <div class="detail-main">
          ${createModelDetailHeader(model)}
          <div class="network-editor-container" id="networkEditorContainer">
            <div class="editor-toolbar">
              <div class="toolbar-group">
                <button class="tool-btn" id="btn-undo" title="撤销" disabled>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7v6h6"></path><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"></path></svg>
                </button>
                <button class="tool-btn" id="btn-redo" title="重做" disabled>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 7v6h-6"></path><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13"></path></svg>
                </button>
              </div>
              <div class="toolbar-divider"></div>
              <div class="toolbar-group">
                <button class="tool-btn active" id="btn-select" title="选择">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"></path></svg>
                </button>
                <button class="tool-btn" id="btn-pan" title="平移">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"></path><path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2"></path><path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8"></path><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"></path></svg>
                </button>
              </div>
              <div class="toolbar-divider"></div>
              <div class="toolbar-group">
                <button class="tool-btn" id="btn-zoom-in" title="放大">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
                </button>
                <button class="tool-btn" id="btn-zoom-out" title="缩小">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
                </button>
                <button class="tool-btn" id="btn-fit" title="适应">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path></svg>
                </button>
              </div>
              <span class="zoom-level" id="zoom-level">100%</span>
              <div class="toolbar-divider"></div>
              <div class="toolbar-group">
                <button class="tool-btn active" id="btn-grid" title="网格">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="3" y1="15" x2="21" y2="15"></line><line x1="9" y1="3" x2="9" y2="21"></line><line x1="15" y1="3" x2="15" y2="21"></line></svg>
                </button>
              </div>
            </div>
            <div class="editor-canvas-wrapper" id="editorCanvasWrapper">
              <svg class="editor-canvas" id="editorCanvas">
                <defs>
                  <pattern id="editor-grid" width="20" height="20" patternUnits="userSpaceOnUse">
                    <path d="M 20 0 L 0 0 0 20" fill="none" stroke="var(--border)" stroke-width="0.5" opacity="0.3"/>
                  </pattern>
                  <marker id="editor-arrow" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                    <polygon points="0 0, 10 3.5, 0 7" fill="var(--accent-primary)"/>
                  </marker>
                </defs>
                <rect width="100%" height="100%" fill="url(#editor-grid)"/>
                <g id="editorConnections"></g>
                <g id="editorModules"></g>
              </svg>
            </div>
          </div>
          <div class="editor-properties-panel">
            <h3 class="panel-title">属性</h3>
            <div class="properties-content" id="propertiesContent">
              <p class="empty-hint">选择一个模块编辑属性</p>
            </div>
          </div>
        </div>
        ${createModelDetailDesc(model)}
      </div>
    `;
    initInlineEditor(model);
  } else {
    const vizConfig = typeof VIZ_CONFIGS !== 'undefined' ? VIZ_CONFIGS[model.name] : null;

    if (vizConfig) {
      renderVizPage(model, vizConfig, modelPageBody, modeToggleHtml);
    } else {
      renderInfoPage(model, modelPageBody, modeToggleHtml);
    }
  }
}

/** 渲染带可视化的模型页面（移植自 dl-viz-pro） */
function renderVizPage(m, vizConfig, container, modeToggleHtml) {
  const vs = state.vizState;
  vs.params = {};
  vs.selectedBlock = null;
  vs.expandedBlock = null;
  vs.expandedPath = [];
  if (vizConfig.params) {
    for (const [key, cfg] of Object.entries(vizConfig.params)) {
      vs.params[key] = cfg.default;
    }
  }

  container.innerHTML = `
    ${modeToggleHtml}
    <div class="model-page-hero">
      <h1>${escapeHtml(m.name)}</h1>
      ${m.fullName ? `<p class="model-page-fullname">${escapeHtml(m.fullName)}</p>` : ''}
      <div class="model-page-badges">
        ${m.year ? `<span class="badge badge-year">${m.year}</span>` : ''}
        ${m.category ? `<span class="badge badge-category">${escapeHtml(m.category)}</span>` : ''}
        ${m.architecture ? `<span class="badge badge-arch">${escapeHtml(m.architecture)}</span>` : ''}
      </div>
    </div>

    <div class="viz-main">
      <div class="viz-network-panel">
        <h3>网络结构</h3>
        ${vizConfig.type === 'mlp' ? `
        <div class="viz-svg-container" id="vizSvgContainer"></div>
        ` : `
        <div class="viz-columns-wrapper" id="vizColumnsWrapper">
          <div class="viz-columns-container" id="vizColumnsContainer">
            <div class="viz-column viz-column-main" id="vizCol0"></div>
            <div class="viz-sub-columns-wrapper" id="vizSubWrapper">
              <div class="viz-column viz-column-sub" id="vizCol1" style="display:none;"></div>
              <div class="viz-column viz-column-sub" id="vizCol2" style="display:none;"></div>
              <div class="viz-column viz-column-sub" id="vizCol3" style="display:none;"></div>
            </div>
          </div>
        </div>
        `}
      </div>

      <div class="viz-layer-info" id="vizLayerInfo">
        <h3 id="vizLayerInfoTitle"></h3>
        <p id="vizLayerInfoDesc"></p>
      </div>

      <div class="viz-code-panel" id="vizCodePanel">
        <div class="viz-code-header">
          <h3>代码实现</h3>
          <div class="viz-code-controls">
            <div class="code-version-toggle">
              <button class="version-btn active" id="btnPaperVersion" onclick="switchCodeVersion('paper')">专业版</button>
              <button class="version-btn" id="btnTutorialVersion" onclick="switchCodeVersion('tutorial')">教程版</button>
            </div>
            <span class="viz-code-lang">PyTorch</span>
          </div>
        </div>
        <div class="viz-code-toolbar">
          <button class="code-copy-btn" onclick="copyCode()">复制代码</button>
          <button class="code-download-btn" id="codeDownloadBtn" onclick="downloadCurrentCode()">下载代码</button>
        </div>
        <div class="viz-code-body">
          <pre id="vizCodeBlock"><div class="code-loading">正在加载代码...</div></pre>
        </div>
      </div>
    </div>
  `;

  // 加载本地代码文件
  loadModelCode(m.name);

  if (vizConfig.type === 'mlp') {
    renderMLPNetwork(vizConfig);
    renderMLPCode(vizConfig);
  } else if (vizConfig.blocks) {
    renderBlockNetwork(vizConfig);
    renderBlockCode(vizConfig);
  }
}

/** 渲染无可视化配置的模型信息页（移植自 dl-viz-pro） */
function renderInfoPage(m, container, modeToggleHtml) {
  container.innerHTML = `
    ${modeToggleHtml}
    <div class="model-page-hero">
      <h1>${escapeHtml(m.name)}</h1>
      ${m.fullName ? `<p class="model-page-fullname">${escapeHtml(m.fullName)}</p>` : ''}
      <div class="model-page-badges">
        ${m.year ? `<span class="badge badge-year">${m.year}</span>` : ''}
        ${m.category ? `<span class="badge badge-category">${escapeHtml(m.category)}</span>` : ''}
        ${m.architecture ? `<span class="badge badge-arch">${escapeHtml(m.architecture)}</span>` : ''}
      </div>
    </div>

    ${m.description ? `
    <div class="model-page-section">
      <h2>简介</h2>
      <p>${addTermTooltips(m.description)}</p>
    </div>
    ` : ''}

    ${m.keyInnovation ? `
    <div class="model-page-section">
      <h2>核心创新</h2>
      <p>${addTermTooltips(m.keyInnovation)}</p>
    </div>
    ` : ''}

    <div class="model-page-section">
      <h2>详细信息</h2>
      <div class="model-page-info-grid">
        ${m.author ? `<div class="model-page-info-item"><div class="label">作者</div><div class="value">${escapeHtml(m.author)}</div></div>` : ''}
        ${m.organization ? `<div class="model-page-info-item"><div class="label">机构</div><div class="value">${escapeHtml(m.organization)}</div></div>` : ''}
        ${m.parameters ? `<div class="model-page-info-item"><div class="label">参数量</div><div class="value">${escapeHtml(m.parameters)}</div></div>` : ''}
        ${m.datasets ? `<div class="model-page-info-item"><div class="label">训练数据集</div><div class="value">${escapeHtml(m.datasets)}</div></div>` : ''}
        ${m.performance ? `<div class="model-page-info-item"><div class="label">性能指标</div><div class="value">${escapeHtml(m.performance)}</div></div>` : ''}
      </div>
    </div>

    <div class="model-page-section">
      <h2>参考资源</h2>
      <div class="model-page-resource-grid">
        ${m.paperUrl ? `
        <div class="resource-card">
          <div class="resource-icon">📄</div>
          <div class="resource-info">
            <h4>论文原文</h4>
            <p>查看或下载论文PDF</p>
          </div>
          <a href="${escapeHtml(m.paperUrl)}" target="_blank" rel="noopener" class="btn btn-secondary">查看论文</a>
        </div>
        ` : ''}
        ${(typeof MODEL_CODE_FILES !== 'undefined' && MODEL_CODE_FILES[m.name]) ? `
        <div class="resource-card">
          <div class="resource-icon">💻</div>
          <div class="resource-info">
            <h4>代码实现</h4>
            <p>专业版 + 教程版</p>
          </div>
          <button class="btn btn-primary" onclick="navigate('model', {name: '${escapeHtml(m.name).replace(/'/g, "\\'")}'})"">查看代码 →</button>
        </div>
        ` : (m.codeUrl ? `
        <div class="resource-card">
          <div class="resource-icon">💻</div>
          <div class="resource-info">
            <h4>代码实现</h4>
            <p>外部参考实现</p>
          </div>
          <a href="${escapeHtml(m.codeUrl)}" target="_blank" rel="noopener" class="btn btn-secondary">查看代码</a>
        </div>
        ` : '')}
      </div>
    </div>

    ${m.tags && m.tags.length ? `
    <div class="model-page-section">
      <h2>标签</h2>
      <div class="model-page-tags">
        ${m.tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}
      </div>
    </div>
    ` : ''}

    <div class="model-page-section model-page-placeholder">
      <p>交互式可视化正在建设中，敬请期待...</p>
    </div>
  `;
}

// ============================================================
// 本地代码加载、切换和下载功能
// ============================================================

var _currentCodeModel = null;
var _currentCodeVersion = 'paper';
var _currentCodeContent = '';
var _currentCodeFileName = '';

/** 加载模型代码文件 */
function loadModelCode(modelName) {
  _currentCodeModel = modelName;
  _currentCodeVersion = 'paper';

  if (typeof MODEL_CODE_FILES === 'undefined') {
    showCodeLoadError('代码映射表未加载');
    return;
  }

  var codeFiles = MODEL_CODE_FILES[modelName];
  if (!codeFiles) {
    showCodeLoadError('暂无本地代码实现');
    return;
  }

  fetchCodeFile(codeFiles.paper, 'paper');
}

/** 获取代码文件 */
function fetchCodeFile(filename, version) {
  var codeBlock = document.getElementById('vizCodeBlock');
  if (codeBlock) {
    codeBlock.innerHTML = '<div class="code-loading">正在加载代码...</div>';
  }

  fetch('assets/models/' + filename)
    .then(function(response) {
      if (!response.ok) {
        throw new Error('HTTP ' + response.status);
      }
      return response.text();
    })
    .then(function(code) {
      _currentCodeContent = code;
      _currentCodeFileName = filename;
      _currentCodeVersion = version;
      displayCode(code);
    })
    .catch(function(err) {
      showCodeLoadError('加载失败: ' + err.message);
    });
}

/** 显示代码 */
function displayCode(code) {
  var codeBlock = document.getElementById('vizCodeBlock');
  if (!codeBlock) return;

  if (typeof escapeCodeHtml === 'function' && typeof highlightSyntax === 'function') {
    codeBlock.innerHTML = highlightSyntax(escapeCodeHtml(code));
  } else {
    codeBlock.textContent = code;
  }
}

/** 显示加载错误 */
function showCodeLoadError(msg) {
  var codeBlock = document.getElementById('vizCodeBlock');
  if (codeBlock) {
    codeBlock.innerHTML = '<div class="code-error">' + msg + '</div>';
  }
}

/** 切换代码版本 (paper / tutorial) */
function switchCodeVersion(version) {
  if (!_currentCodeModel || version === _currentCodeVersion) return;

  var codeFiles = MODEL_CODE_FILES[_currentCodeModel];
  if (!codeFiles) return;

  var filename = version === 'tutorial' ? codeFiles.tutorial : codeFiles.paper;

  // 更新按钮状态
  var btnPaper = document.getElementById('btnPaperVersion');
  var btnTutorial = document.getElementById('btnTutorialVersion');
  if (btnPaper && btnTutorial) {
    if (version === 'paper') {
      btnPaper.classList.add('active');
      btnTutorial.classList.remove('active');
    } else {
      btnPaper.classList.remove('active');
      btnTutorial.classList.add('active');
    }
  }

  fetchCodeFile(filename, version);
}

/** 下载当前显示的代码 */
function downloadCurrentCode() {
  if (!_currentCodeContent || !_currentCodeFileName) {
    showToast('没有可下载的代码', 'error');
    return;
  }

  var blob = new Blob([_currentCodeContent], { type: 'text/x-python' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = _currentCodeFileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast('代码已下载: ' + _currentCodeFileName, 'success');
}

/** 复制代码到剪贴板 */
function copyCode() {
  const codeBlock = document.getElementById('vizCodeBlock');
  if (!codeBlock) return;
  const text = codeBlock.textContent || codeBlock.innerText;
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.querySelector('.code-copy-btn');
    if (btn) {
      btn.textContent = '已复制';
      btn.classList.add('copied');
      setTimeout(() => {
        btn.textContent = '复制代码';
        btn.classList.remove('copied');
      }, 2000);
    }
    showToast('代码已复制到剪贴板', 'success');
  }).catch(() => {
    showToast('复制失败，请手动选择复制', 'error');
  });
}

function copyModelCode() {
  copyCode();
}

function initInlineEditor(model) {
  const canvas = document.getElementById('editorCanvas');
  const modulesGroup = document.getElementById('editorModules');
  const connectionsGroup = document.getElementById('editorConnections');
  const zoomLevel = document.getElementById('zoom-level');
  const wrapper = document.getElementById('editorCanvasWrapper');
  
  let currentZoom = 1;
  let isPanning = false;
  let panStart = { x: 0, y: 0 };
  let viewBox = { x: 0, y: 0 };
  let scale = 1;

  function updateViewBox() {
    const w = wrapper.clientWidth / scale;
    const h = wrapper.clientHeight / scale;
    canvas.setAttribute('viewBox', `${viewBox.x} ${viewBox.y} ${w} ${h}`);
    zoomLevel.textContent = Math.round(scale * 100) + '%';
  }

  function zoom(factor, cx, cy) {
    const newScale = Math.max(0.25, Math.min(4, scale * factor));
    const wx = (cx - viewBox.x) / scale;
    const wy = (cy - viewBox.y) / scale;
    viewBox.x += wx * (scale - newScale);
    viewBox.y += wy * (scale - newScale);
    scale = newScale;
    updateViewBox();
  }

  document.getElementById('btn-zoom-in')?.addEventListener('click', () => zoom(1.2, wrapper.clientWidth / 2, wrapper.clientHeight / 2));
  document.getElementById('btn-zoom-out')?.addEventListener('click', () => zoom(0.8, wrapper.clientWidth / 2, wrapper.clientHeight / 2));
  document.getElementById('btn-fit')?.addEventListener('click', () => { scale = 1; viewBox = { x: 0, y: 0 }; updateViewBox(); });
  document.getElementById('btn-select')?.addEventListener('click', () => isPanning = false);
  document.getElementById('btn-pan')?.addEventListener('click', () => isPanning = true);
  document.getElementById('btn-grid')?.addEventListener('click', (e) => {
    e.currentTarget.classList.toggle('active');
    const grid = document.getElementById('editor-grid');
    if (grid) grid.style.display = grid.style.display === 'none' ? '' : 'none';
  });

  wrapper?.addEventListener('wheel', (e) => {
    e.preventDefault();
    zoom(e.deltaY < 0 ? 1.1 : 0.9, e.offsetX, e.offsetY);
  });

  wrapper?.addEventListener('mousedown', (e) => {
    if (isPanning) {
      isPanning = true;
      panStart = { x: e.clientX, y: e.clientY };
    }
  });

  document.addEventListener('mousemove', (e) => {
    if (isPanning && panStart.x !== 0) {
      viewBox.x -= (e.clientX - panStart.x) / scale;
      viewBox.y -= (e.clientY - panStart.y) / scale;
      panStart = { x: e.clientX, y: e.clientY };
      updateViewBox();
    }
  });

  document.addEventListener('mouseup', () => { panStart = { x: 0, y: 0 }; });

  if (model && model.vizConfig) {
    const vizConfig = model.vizConfig;
    const blockWidth = 140;
    const blockHeight = 70;
    const padding = 60;
    
    let maxX = 0, maxY = 0;
    const blocks = [];
    
    vizConfig.blocks.forEach((block, i) => {
      const x = padding + block.x * (blockWidth + 30);
      const y = padding + block.y * (blockHeight + 30);
      maxX = Math.max(maxX, x + blockWidth);
      maxY = Math.max(maxY, y + blockHeight);
      
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('transform', `translate(${x}, ${y})`);
      g.setAttribute('class', 'editor-block');
      g.style.cursor = 'pointer';
      
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('width', blockWidth);
      rect.setAttribute('height', blockHeight);
      rect.setAttribute('rx', '8');
      rect.setAttribute('fill', 'var(--bg-card)');
      rect.setAttribute('stroke', 'var(--border)');
      rect.setAttribute('stroke-width', '1');
      
      const title = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      title.setAttribute('x', blockWidth / 2);
      title.setAttribute('y', '28');
      title.setAttribute('text-anchor', 'middle');
      title.setAttribute('fill', 'var(--text-primary)');
      title.setAttribute('font-size', '13');
      title.setAttribute('font-weight', '600');
      title.textContent = block.name;
      
      const type = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      type.setAttribute('x', blockWidth / 2);
      type.setAttribute('y', '48');
      type.setAttribute('text-anchor', 'middle');
      type.setAttribute('fill', 'var(--text-secondary)');
      type.setAttribute('font-size', '11');
      type.textContent = block.type;
      
      g.appendChild(rect);
      g.appendChild(title);
      g.appendChild(type);
      modulesGroup.appendChild(g);
      
      blocks.push({ block, el: g, x, y });
    });

    (vizConfig.connections || []).forEach(conn => {
      const from = blocks[conn.from];
      const to = blocks[conn.to];
      if (from && to) {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', from.x + blockWidth);
        line.setAttribute('y1', from.y + blockHeight / 2);
        line.setAttribute('x2', to.x);
        line.setAttribute('y2', to.y + blockHeight / 2);
        line.setAttribute('stroke', 'var(--accent-primary)');
        line.setAttribute('stroke-width', '2');
        line.setAttribute('marker-end', 'url(#editor-arrow)');
        connectionsGroup.appendChild(line);
      }
    });
  }

  updateViewBox();
}

function renderFavoritesView() {
  const favModelGrid = document.getElementById('favModelGrid');
  const favEmptyState = document.getElementById('favEmptyState');
  const favCount = document.getElementById('favCount');
  
  if (!state.models || state.models.length === 0) {
    if (favModelGrid) favModelGrid.innerHTML = '';
    if (favEmptyState) favEmptyState.style.display = 'block';
    if (favCount) favCount.textContent = '0';
    return;
  }
  
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

// ============================================================
// 可视化渲染函数（从 dl-viz-pro 移植）
// ============================================================

/** 将 blocks 数组分组为串行/并行组 */
function groupBlocks(blocks) {
  const groups = [];
  let i = 0;
  while (i < blocks.length) {
    if (blocks[i].parallel) {
      const items = [];
      while (i < blocks.length && blocks[i].parallel) {
        items.push(blocks[i]);
        i++;
      }
      groups.push({ type: 'parallel', items });
    } else {
      groups.push({ type: 'serial', items: [blocks[i]] });
      i++;
    }
  }
  return groups;
}

/** 渲染块级网络（CNN / Transformer） */
function renderBlockNetwork(vizConfig) {
  const col = document.getElementById('vizCol0');
  if (!col || !vizConfig.blocks) return;

  const blocks = vizConfig.blocks;
  const groups = groupBlocks(blocks);
  const vs = state.vizState;

  const nameEl = document.getElementById('modelBreadcrumbName');
  const modelName = nameEl ? nameEl.textContent : 'Network';

  let html = `<div class="viz-col-header"><span>${escapeHtml(modelName)}</span><button class="viz-col-fit-btn" onclick="fitColumn(0)">适配</button></div>`;
  html += `<div class="viz-col-body">`;

  groups.forEach((group, gi) => {
    if (gi > 0) {
      html += `<div class="viz-arrow-down">↓</div>`;
    }

    if (group.type === 'parallel') {
      html += `<div class="viz-block-wrapper parallel"><div class="viz-parallel-row">`;
      group.items.forEach(block => {
        html += renderBlockCard(block, vs);
      });
      html += `</div></div>`;
    } else {
      html += `<div class="viz-block-wrapper serial">`;
      html += renderBlockCard(group.items[0], vs);
      html += `</div>`;
    }
  });

  html += `</div>`;
  col.innerHTML = html;

  // 绘制 SVG 连接线
  if (vizConfig.edges && vizConfig.edges.length > 0) {
    const colBody = col.querySelector('.viz-col-body');
    if (colBody) {
      colBody.style.position = 'relative';
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.classList.add('viz-edges-svg');
      svg.setAttribute('style', 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:1;overflow:visible;');
      colBody.appendChild(svg);
      requestAnimationFrame(() => renderEdges(vizConfig, colBody));
    }
  }

  addResizeHandle(col, 0, null);
}

/** 渲染单个块卡片 HTML */
function renderBlockCard(block, vs) {
  const color = BLOCK_COLORS[block.type] || '#6366f1';
  const isSelected = vs.selectedBlock === block.id;
  const isExpanded = vs.expandedBlock === block.id;
  const hasChildren = block.children && block.children.length > 0;
  const icon = block.icon || getBlockIcon(block.type);

  return `
    <div class="viz-block-card ${isSelected ? 'selected' : ''}"
         data-id="${block.id}"
         style="--block-color: ${color}"
         onclick="onBlockClick('${block.id}')">
      <span class="viz-block-icon">${icon}</span>
      <span class="viz-block-label">${escapeHtml(block.label)}</span>
      <span class="viz-block-desc">${escapeHtml(block.desc)}</span>
      ${hasChildren ? `<span class="viz-block-expand">${isExpanded ? '▼' : '▶'}</span>` : ''}
    </div>
  `;
}

/** 块点击事件 */
function onBlockClick(blockId) {
  const nameEl = document.getElementById('modelBreadcrumbName');
  const modelName = nameEl ? nameEl.textContent : '';
  const config = VIZ_CONFIGS[modelName];
  if (!config || !config.blocks) return;

  const block = config.blocks.find(b => b.id === blockId);
  if (!block) return;

  const vs = state.vizState;
  const wasSelected = vs.selectedBlock === blockId;
  vs.selectedBlock = wasSelected ? null : blockId;

  // 获取被点击的元素
  const clickedElement = document.querySelector(`.viz-block-card[data-id="${blockId}"]`);

  // 显示/隐藏代码浮窗
  if (vs.selectedBlock && clickedElement) {
    showCodeTooltip(blockId, clickedElement);
  } else {
    hideCodeTooltip();
  }

  const hasChildren = block.children && block.children.length > 0;
  if (hasChildren) {
    if (vs.expandedBlock === blockId) {
      closeColumnsAfter(1);
      vs.expandedBlock = null;
      vs.expandedPath = [];
    } else {
      closeColumnsAfter(1);
      vs.expandedBlock = blockId;
      vs.expandedPath = [blockId];
      renderColumn(1, block);
    }
  } else {
    closeColumnsAfter(1);
    vs.expandedBlock = null;
    vs.expandedPath = [];
  }

  renderBlockNetwork(config);

  // 显示块信息
  const infoPanel = document.getElementById('vizLayerInfo');
  if (vs.selectedBlock && block.detail) {
    const color = BLOCK_COLORS[block.type] || '#6366f1';
    const icon = block.icon || getBlockIcon(block.type);
    document.getElementById('vizLayerInfoTitle').innerHTML = `<span style="color:${color}">${icon}</span> ${escapeHtml(block.label)}`;
    document.getElementById('vizLayerInfoDesc').textContent = block.detail;
    infoPanel.classList.add('active');
  } else {
    infoPanel.classList.remove('active');
  }

  renderBlockCode(config);
}

/** 渲染子列 */
function renderColumn(colIndex, parentBlock) {
  const col = document.getElementById('vizCol' + colIndex);
  if (!col) return;

  const children = parentBlock.children;
  if (!children || children.length === 0) return;

  const vs = state.vizState;
  const isParallel = parentBlock.parallel || children.some(c => c.parallel);

  let html = `<div class="viz-col-header"><span>`;
  vs.expandedPath.forEach((id, i) => {
    if (i > 0) html += `<span class="viz-col-sep">›</span>`;
    const b = findBlockInConfig(id);
    html += `<span class="viz-col-crumb" onclick="navigateBreadcrumb(${i})">${b ? escapeHtml(b.label) : id}</span>`;
  });
  html += `</span><button class="viz-col-fit-btn" onclick="fitColumn(${colIndex})">适配</button></div>`;

  if (isParallel) {
    html += `<div class="viz-col-body horizontal"><div class="viz-block-wrapper parallel-h"><div class="viz-parallel-col">`;
    children.forEach(child => {
      html += renderSubBlockCard(child, vs);
    });
    html += `</div></div></div>`;
  } else {
    html += `<div class="viz-col-body horizontal">`;
    children.forEach((child, index) => {
      if (index > 0) html += `<div class="viz-arrow-right">→</div>`;
      html += `<div class="viz-block-wrapper serial-h">`;
      html += renderSubBlockCard(child, vs);
      html += `</div>`;
    });
    html += `</div>`;
  }

  col.innerHTML = html;
  col.style.display = 'flex';
  alignColumnToBlock(colIndex, parentBlock.id);
  addResizeHandle(col, colIndex, parentBlock);
}

/** 渲染子块卡片 HTML */
function renderSubBlockCard(child, vs) {
  const hasChildren = child.children && child.children.length > 0;
  const isSelected = vs.selectedBlock === child.id;
  const color = BLOCK_COLORS[child.type] || '#6366f1';
  const icon = child.icon || getBlockIcon(child.type);

  return `
    <div class="viz-block-card ${isSelected ? 'selected' : ''}"
         data-id="${child.id}"
         style="--block-color: ${color}"
         onclick="onSubBlockClick('${child.id}')">
      <span class="viz-block-icon">${icon}</span>
      <span class="viz-block-label">${escapeHtml(child.label)}</span>
      <span class="viz-block-desc">${escapeHtml(child.desc)}</span>
      ${hasChildren ? `<span class="viz-block-expand">${vs.expandedPath.includes(child.id) ? '▼' : '▶'}</span>` : ''}
    </div>
  `;
}

/** 子块点击事件 */
function onSubBlockClick(childId) {
  const nameEl = document.getElementById('modelBreadcrumbName');
  const modelName = nameEl ? nameEl.textContent : '';
  const config = VIZ_CONFIGS[modelName];
  if (!config || !config.blocks) return;

  const vs = state.vizState;
  if (!vs.expandedPath || vs.expandedPath.length === 0) return;

  // 查找父节点
  let parentBlock = null;
  let currentColIndex = -1;

  for (let level = 0; level < vs.expandedPath.length; level++) {
    let block = config.blocks.find(b => b.id === vs.expandedPath[0]);
    if (!block) break;
    for (let i = 1; i <= level; i++) {
      if (!block.children) break;
      block = block.children.find(c => c.id === vs.expandedPath[i]);
      if (!block) break;
    }
    if (block && block.children) {
      const found = block.children.find(c => c.id === childId);
      if (found) {
        parentBlock = block;
        currentColIndex = level + 1;
        break;
      }
    }
  }

  if (!parentBlock || currentColIndex < 1) return;

  const child = parentBlock.children.find(c => c.id === childId);
  if (!child) return;

  vs.selectedBlock = vs.selectedBlock === childId ? null : childId;

  const hasGrandChildren = child.children && child.children.length > 0;
  const nextColIndex = currentColIndex + 1;

  closeColumnsAfter(nextColIndex);
  vs.expandedPath = vs.expandedPath.slice(0, currentColIndex);

  if (hasGrandChildren && vs.selectedBlock) {
    vs.expandedPath = [...vs.expandedPath, childId];
    renderColumn(nextColIndex, child);
  }

  renderColumn(currentColIndex, parentBlock);

  // 显示信息
  const infoPanel = document.getElementById('vizLayerInfo');
  if (vs.selectedBlock && child) {
    const color = BLOCK_COLORS[child.type] || '#6366f1';
    const icon = child.icon || getBlockIcon(child.type);
    let title = `${icon} ${child.label}`;
    document.getElementById('vizLayerInfoTitle').innerHTML = `<span style="color:${color}">${escapeHtml(title)}</span>`;
    document.getElementById('vizLayerInfoDesc').textContent = child.detail || child.desc;
    infoPanel.classList.add('active');
  } else {
    infoPanel.classList.remove('active');
  }

  renderBlockCode(config);
}

/** 面包屑导航 */
function navigateBreadcrumb(level) {
  const nameEl = document.getElementById('modelBreadcrumbName');
  const modelName = nameEl ? nameEl.textContent : '';
  const config = VIZ_CONFIGS[modelName];
  if (!config || !config.blocks) return;

  const vs = state.vizState;
  if (level === 0) {
    vs.expandedPath = vs.expandedPath.slice(0, 1);
  } else {
    vs.expandedPath = vs.expandedPath.slice(0, level + 1);
  }

  closeColumnsAfter(vs.expandedPath.length + 1);

  const topBlock = config.blocks.find(b => b.id === vs.expandedPath[0]);
  if (topBlock) {
    let targetBlock = topBlock;
    for (let i = 1; i < vs.expandedPath.length; i++) {
      if (!targetBlock.children) break;
      const found = targetBlock.children.find(c => c.id === vs.expandedPath[i]);
      if (!found) break;
      targetBlock = found;
    }
    renderColumn(vs.expandedPath.length, targetBlock);
  }

  vs.selectedBlock = null;
  document.getElementById('vizLayerInfo').classList.remove('active');
  renderBlockCode(config);
}

/** 关闭指定列索引及之后的所有列 */
function closeColumnsAfter(colIndex) {
  for (let i = colIndex; i <= 3; i++) {
    const col = document.getElementById('vizCol' + i);
    if (col) {
      col.style.display = 'none';
      col.innerHTML = '';
    }
  }
}

/** 在配置树中查找指定 id 的块 */
function findBlockInConfig(blockId) {
  const nameEl = document.getElementById('modelBreadcrumbName');
  const modelName = nameEl ? nameEl.textContent : '';
  const config = VIZ_CONFIGS[modelName];
  if (!config || !config.blocks) return null;

  function search(blocks) {
    for (const b of blocks) {
      if (b.id === blockId) return b;
      if (b.children) {
        const found = search(b.children);
        if (found) return found;
      }
    }
    return null;
  }
  return search(config.blocks);
}

/** 对齐列到被点击模块位置 */
function alignColumnToBlock(colIndex, parentBlockId) {
  const container = document.getElementById('vizColumnsContainer');
  const col = document.getElementById('vizCol' + colIndex);
  if (!col || !container) return;

  const prevCol = document.getElementById('vizCol' + (colIndex - 1));
  if (!prevCol) return;

  const blockEl = prevCol.querySelector(`[data-id="${parentBlockId}"]`);
  if (!blockEl) return;

  const prevBody = prevCol.querySelector('.viz-col-body');
  const colBody = col.querySelector('.viz-col-body');
  if (!prevBody || !colBody) return;

  const bodyRect = prevBody.getBoundingClientRect();
  const blockRect = blockEl.getBoundingClientRect();
  const offset = blockRect.left - bodyRect.left;
  colBody.scrollLeft = offset;
}

/** 绘制 SVG 连接线 */
function renderEdges(vizConfig, colBody) {
  const svg = colBody.querySelector('.viz-edges-svg');
  if (!svg || !vizConfig.edges) return;

  const containerRect = colBody.getBoundingClientRect();

  vizConfig.edges.forEach(edge => {
    const fromEl = colBody.querySelector(`[data-id="${edge.from}"]`);
    const toEl = colBody.querySelector(`[data-id="${edge.to}"]`);
    if (!fromEl || !toEl) return;

    const fromAnchor = edge.fromAnchor || 'right';
    const toAnchor = edge.toAnchor || 'left';
    const from = getAnchorPoint(fromEl, fromAnchor, containerRect);
    const to = getAnchorPoint(toEl, toAnchor, containerRect);

    const offset = Math.abs(to.x - from.x) * 0.4 || Math.abs(to.y - from.y) * 0.4 || 50;

    let cp1x = from.x, cp1y = from.y, cp2x = to.x, cp2y = to.y;
    if (fromAnchor === 'right') cp1x = from.x + offset;
    else if (fromAnchor === 'left') cp1x = from.x - offset;
    else if (fromAnchor === 'bottom') cp1y = from.y + offset;
    else if (fromAnchor === 'top') cp1y = from.y - offset;

    if (toAnchor === 'right') cp2x = to.x + offset;
    else if (toAnchor === 'left') cp2x = to.x - offset;
    else if (toAnchor === 'bottom') cp2y = to.y + offset;
    else if (toAnchor === 'top') cp2y = to.y - offset;

    const d = `M ${from.x},${from.y} C ${cp1x},${cp1y} ${cp2x},${cp2y} ${to.x},${to.y}`;

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    path.classList.add('viz-edge-path');
    path.setAttribute('stroke', edge.color || '#6366f1');
    if (edge.style === 'dashed') {
      path.setAttribute('stroke-dasharray', '6,4');
    }
    svg.appendChild(path);

    if (edge.label) {
      const midX = (from.x + to.x) / 2;
      const midY = (from.y + to.y) / 2;
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', midX);
      text.setAttribute('y', midY - 6);
      text.classList.add('viz-edge-label');
      text.textContent = edge.label;
      svg.appendChild(text);
    }
  });
}

/** 获取锚点坐标 */
function getAnchorPoint(el, anchor, containerRect) {
  const rect = el.getBoundingClientRect();
  const x = rect.left - containerRect.left;
  const y = rect.top - containerRect.top;
  const w = rect.width;
  const h = rect.height;
  switch (anchor) {
    case 'top': return { x: x + w / 2, y: y };
    case 'bottom': return { x: x + w / 2, y: y + h };
    case 'left': return { x: x, y: y + h / 2 };
    case 'right': return { x: x + w, y: y + h / 2 };
    default: return { x: x + w / 2, y: y + h / 2 };
  }
}

/** 添加列拖拽调整手柄 */
function addResizeHandle(col, colIndex, parentBlock) {
  col.style.position = 'relative';

  // 右侧宽度拖拽
  const widthHandle = document.createElement('div');
  widthHandle.className = 'viz-col-resize-handle';
  col.appendChild(widthHandle);

  let startX, startWidth, isDraggingWidth = false;
  widthHandle.addEventListener('mousedown', (e) => {
    e.preventDefault();
    isDraggingWidth = true;
    col.classList.add('is-resizing');
    startX = e.clientX;
    startWidth = col.offsetWidth;

    // 添加吸附反馈
    const snapPoints = [160, 240, 320, 400, 500, 600];

    const onMouseMove = (e) => {
      const delta = e.clientX - startX;
      let newWidth = Math.max(160, startWidth + delta);

      // 检测吸附点
      const snapThreshold = 5;
      for (const snap of snapPoints) {
        if (Math.abs(newWidth - snap) < snapThreshold) {
          newWidth = snap;
          col.style.boxShadow = '0 0 0 2px var(--accent-primary)';
          break;
        } else {
          col.style.boxShadow = '';
        }
      }

      col.style.width = newWidth + 'px';
    };

    const onMouseUp = () => {
      isDraggingWidth = false;
      col.classList.remove('is-resizing');
      col.style.boxShadow = '';
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  });

  // 底部高度拖拽
  const heightHandle = document.createElement('div');
  heightHandle.className = 'viz-col-resize-handle-bottom';
  col.appendChild(heightHandle);

  let startY, startHeight, isDraggingHeight = false;
  heightHandle.addEventListener('mousedown', (e) => {
    e.preventDefault();
    isDraggingHeight = true;
    col.classList.add('is-resizing');
    startY = e.clientY;
    startHeight = col.offsetHeight;

    // 添加吸附反馈
    const snapPoints = [100, 150, 200, 300, 400];

    const onMouseMove = (e) => {
      const delta = e.clientY - startY;
      let newHeight = Math.max(100, startHeight + delta);

      // 检测吸附点
      const snapThreshold = 5;
      for (const snap of snapPoints) {
        if (Math.abs(newHeight - snap) < snapThreshold) {
          newHeight = snap;
          col.style.boxShadow = '0 0 0 2px var(--accent-primary)';
          break;
        } else {
          col.style.boxShadow = '';
        }
      }

      col.style.height = newHeight + 'px';
    };

    const onMouseUp = () => {
      isDraggingHeight = false;
      col.classList.remove('is-resizing');
      col.style.boxShadow = '';
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  });
}

/** 适配列大小到内容 */
function fitColumn(colIndex) {
  const col = document.getElementById('vizCol' + colIndex);
  if (!col) return;

  col.style.width = 'auto';
  col.style.height = 'auto';
  col.style.maxWidth = 'none';
  col.style.maxHeight = 'none';
  col.style.overflow = 'visible';

  const container = document.getElementById('vizColumnsContainer');
  const savedContainer = container ? container.style.overflow : '';
  if (container) container.style.overflow = 'visible';

  const contentW = col.scrollWidth;
  const contentH = col.scrollHeight;

  if (container) container.style.overflow = savedContainer;

  col.style.width = (contentW + 4) + 'px';
  col.style.height = (contentH + 4) + 'px';
  col.style.maxWidth = 'none';
  col.style.maxHeight = 'none';
  col.style.overflow = '';
}

/** HTML 转义特殊字符 */
function escapeCodeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** PyTorch 语法高亮（正则替换） */
function highlightSyntax(code) {
  // 先转义 HTML 特殊字符
  let html = escapeCodeHtml(code);

  // 1. 注释 (# ...) - 最高优先级，先处理以避免后续替换干扰
  html = html.replace(/(#.*?)(\n|$)/g, '<span class="syn-comment">$1</span>$2');

  // 2. 字符串（三引号和单/双引号）
  html = html.replace(/("""[\s\S]*?"""|\'\'\'[\s\S]*?\'\'\')/g, '<span class="syn-string">$1</span>');
  html = html.replace(/("(?:[^"\\]|\\.)*"|\'(?:[^\'\\]|\\.)*\')/g, '<span class="syn-string">$1</span>');

  // 3. 关键字
  const keywords = ['def', 'class', 'import', 'from', 'return', 'if', 'elif', 'else', 'for', 'while', 'with', 'as', 'try', 'except', 'finally', 'raise', 'yield', 'lambda', 'pass', 'break', 'continue', 'and', 'or', 'not', 'in', 'is', 'global', 'nonlocal', 'assert', 'del'];
  const kwPattern = new RegExp('\\b(' + keywords.join('|') + ')\\b', 'g');
  html = html.replace(kwPattern, '<span class="syn-keyword">$1</span>');

  // self
  html = html.replace(/\b(self)\b/g, '<span class="syn-param">$1</span>');

  // 4. 类名 (大写开头的标识符，如 nn.Module, Conv2d, Sequential, Linear, ReLU 等)
  const classNames = ['nn\\.Module', 'nn\\.Sequential', 'nn\\.Linear', 'nn\\.Conv2d', 'nn\\.Conv1d', 'nn\\.MaxPool2d', 'nn\\.AvgPool2d', 'nn\\.Dropout', 'nn\\.ReLU', 'nn\\.Sigmoid', 'nn\\.Tanh', 'nn\\.BatchNorm2d', 'nn\\.LayerNorm', 'nn\\.Embedding', 'nn\\.Transformer', 'nn\\.MultiheadAttention', 'nn\\.CrossEntropyLoss', 'nn\\.MSELoss', 'nn\\.Softmax', 'nn\\.Flatten', 'torch', 'nn', 'F', 'MLP', 'super'];
  const classPattern = new RegExp('\\b(' + classNames.join('|') + ')\\b', 'g');
  html = html.replace(classPattern, '<span class="syn-class">$1</span>');

  // 5. 数字
  html = html.replace(/\b(\d+\.?\d*)\b/g, '<span class="syn-number">$1</span>');

  // 6. 函数调用 (标识符后跟括号)
  html = html.replace(/\b([a-zA-Z_]\w*)\s*(?=\()/g, function(match, fname) {
    // 跳过已经被 span 包裹的
    if (match.includes('span')) return match;
    return '<span class="syn-func">' + fname + '</span>';
  });

  // 7. 运算符
  html = html.replace(/([+\-*=\/%&lt;&gt;!]=?)/g, '<span class="syn-op">$1</span>');

  return html;
}

/** 将代码文本渲染为带行号的 HTML */
function renderCodeWithLineNumbers(codeHtml, codeBlock) {
  // codeHtml 是已经过高亮的 HTML 字符串，按行分割
  const lines = codeHtml.split('\n');
  let lineNumbersHtml = '';
  let codeLinesHtml = '';

  lines.forEach((line, i) => {
    const lineNum = i + 1;
    lineNumbersHtml += `<span class="code-line-num">${lineNum}</span>`;
    codeLinesHtml += `<div class="code-line" data-line="${lineNum}">${line || ' '}</div>`;
  });

  codeBlock.innerHTML = `
    <div class="code-line-numbers">${lineNumbersHtml}</div>
    <div class="code-lines">${codeLinesHtml}</div>
  `;
}

/** 自动滚动代码面板到高亮行 */
function scrollToCodeHighlight() {
  const codeBody = document.querySelector('.viz-code-body');
  const codeBlock = document.getElementById('vizCodeBlock');
  if (!codeBody || !codeBlock) return;
  const first = codeBlock.querySelector('.code-selected-line');
  if (first) {
    const bodyRect = codeBody.getBoundingClientRect();
    const lineRect = first.getBoundingClientRect();
    const offset = lineRect.top - bodyRect.top + codeBody.scrollTop - bodyRect.height / 2 + lineRect.height / 2;
    codeBody.scrollTo({ top: offset, behavior: 'smooth' });
  }
}

/** 复制代码到剪贴板 */
function copyCode() {
  const codeBlock = document.getElementById('vizCodeBlock');
  if (!codeBlock) return;

  // 提取纯文本代码（去掉 HTML 标签）
  const text = codeBlock.textContent || codeBlock.innerText;

  navigator.clipboard.writeText(text).then(() => {
    const btn = document.querySelector('.code-copy-btn');
    if (btn) {
      btn.textContent = '已复制';
      btn.classList.add('copied');
      setTimeout(() => {
        btn.textContent = '复制代码';
        btn.classList.remove('copied');
      }, 2000);
    }
    showToast('代码已复制到剪贴板', 'success');
  }).catch(() => {
    showToast('复制失败，请手动选择复制', 'error');
  });
}

// ==================== 代码浮窗 ====================
let codeTooltip = null;

/** 获取模块对应的代码行 */
function getBlockCodeLines(blockId, vizConfig) {
  if (!vizConfig || !vizConfig.blocks) return [];

  const lines = [];
  const nameEl = document.getElementById('modelBreadcrumbName');
  const modelName = nameEl ? nameEl.textContent : 'Model';
  const safeName = modelName.replace(/[^a-zA-Z0-9]/g, '_');

  // 收集所有代码行及其对应的 blockId
  const allLines = [];

  function addLine(text, bid) {
    allLines.push({ text, blockId: bid });
  }

  addLine('import torch');
  addLine('import torch.nn as nn');
  addLine('import torch.nn.functional as F');
  addLine('');

  addLine(`class ${safeName}(nn.Module):`, 'model_class');
  addLine('    def __init__(self):');
  addLine('        super().__init__()');

  vizConfig.blocks.forEach(block => {
    if (block.type === 'input' || block.type === 'output') return;

    if (block.type === 'conv' && block.params) {
      const p = block.params;
      addLine(`        self.${block.id} = nn.Sequential(`, block.id);
      let convLine = `            nn.Conv2d(${p.in_ch}, ${p.out_ch}, ${p.kernel}`;
      if (p.stride) convLine += `, stride=${p.stride}`;
      if (p.padding) convLine += `, padding=${p.padding}`;
      convLine += ')';
      addLine(convLine, block.id);
      if (p.act) addLine(`            nn.${p.act}()`, block.id);
      if (p.pool) {
        const poolCls = p.pool === 'max' ? 'nn.MaxPool2d' : 'nn.AvgPool2d';
        addLine(`            ${poolCls}(${p.pool_size || 2})`, block.id);
      }
      addLine('        )', block.id);
    } else if (block.type === 'linear' && block.params) {
      addLine(`        self.${block.id} = nn.Linear(${block.params.in_f}, ${block.params.out_f})`, block.id);
    } else if (block.type === 'mlp' && block.params) {
      const p = block.params;
      addLine(`        self.${block.id} = nn.Sequential(`, block.id);
      if (p.dropout) addLine(`            nn.Dropout(${p.dropout}),`, block.id);
      addLine(`            nn.Linear(${p.in_f}, ${p.out_f}),`, block.id);
      if (p.act) addLine(`            nn.${p.act}()`, block.id);
      addLine('        )', block.id);
    } else if (block.type === 'pool' && block.params) {
      const p = block.params;
      const poolCls = p.pool === 'max' ? 'nn.MaxPool2d' : 'nn.AvgPool2d';
      addLine(`        self.${block.id} = ${poolCls}(${p.pool_size || 2})`, block.id);
    } else if (block.type === 'dropout' && block.params) {
      addLine(`        self.${block.id} = nn.Dropout(${block.params.rate})`, block.id);
    } else if (block.type === 'custom') {
      addLine(`        # ${block.label}: ${block.desc}`, block.id);
    } else {
      addLine(`        # ${block.label}`, block.id);
    }
  });

  addLine('');
  addLine('    def forward(self, x):');

  vizConfig.blocks.forEach(block => {
    if (block.type === 'input') return;
    if (block.type === 'output') {
      if (block.params && block.params.out_f) {
        addLine(`        x = self.output(x)`, 'output');
      }
      addLine('        return x');
      return;
    }
    if (['conv', 'linear', 'mlp', 'pool', 'dropout'].includes(block.type) && block.params) {
      addLine(`        x = self.${block.id}(x)`, block.id);
    } else {
      addLine(`        # ${block.label}`, block.id);
    }
  });

  // 筛选出属于指定 blockId 的代码行
  return allLines.filter(l => l.blockId === blockId).map(l => l.text);
}

/** 显示代码浮窗 */
function showCodeTooltip(blockId, element) {
  const nameEl = document.getElementById('modelBreadcrumbName');
  const modelName = nameEl ? nameEl.textContent : '';
  const config = VIZ_CONFIGS[modelName];
  if (!config) return;

  const codeLines = getBlockCodeLines(blockId, config);
  if (!codeLines || codeLines.length === 0) return;

  // 创建或更新浮窗
  if (!codeTooltip) {
    codeTooltip = document.createElement('div');
    codeTooltip.className = 'code-tooltip';
    codeTooltip.setAttribute('role', 'tooltip');
    codeTooltip.setAttribute('aria-label', '代码详情');
    codeTooltip.innerHTML = `
      <div class="code-tooltip-header">
        <span class="code-tooltip-title">代码片段</span>
        <button class="code-tooltip-close" onclick="hideCodeTooltip()">×</button>
      </div>
      <div class="code-tooltip-body"></div>
    `;
    document.body.appendChild(codeTooltip);
  }

  // 设置内容
  const body = codeTooltip.querySelector('.code-tooltip-body');
  const highlightedCode = highlightSyntax(codeLines.join('\n'));
  body.innerHTML = `<pre><code>${highlightedCode}</code></pre>`;

  // 定位到元素旁边
  const rect = element.getBoundingClientRect();
  const tooltipWidth = 400; // 最大宽度

  // 计算水平位置，确保不超出视口
  let left = rect.left;
  if (left + tooltipWidth > window.innerWidth - 20) {
    left = window.innerWidth - tooltipWidth - 20;
  }
  if (left < 20) left = 20;

  // 计算垂直位置
  let top = rect.bottom + 8;
  if (top + 280 > window.innerHeight) {
    top = rect.top - 8 - 200; // 显示在元素上方
  }

  codeTooltip.style.top = top + 'px';
  codeTooltip.style.left = left + 'px';
  codeTooltip.classList.add('visible');
}

/** 隐藏代码浮窗 */
function hideCodeTooltip() {
  if (codeTooltip) {
    codeTooltip.classList.remove('visible');
  }
}

/** 点击页面其他区域关闭浮窗 */
document.addEventListener('click', function(e) {
  if (codeTooltip && codeTooltip.classList.contains('visible')) {
    // 如果点击的不是浮窗本身或触发浮窗的元素
    if (!codeTooltip.contains(e.target) && !e.target.closest('.viz-block-card')) {
      hideCodeTooltip();
    }
  }
});

/** 渲染块级代码 */
function renderBlockCode(vizConfig) {
  const codeBlock = document.getElementById('vizCodeBlock');
  if (!codeBlock || !vizConfig.blocks) return;

  const nameEl = document.getElementById('modelBreadcrumbName');
  const modelName = nameEl ? nameEl.textContent : 'Model';
  const vs = state.vizState;
  const selected = vs.selectedBlock;
  const lines = [];

  function addLine(text, blockId) {
    lines.push({ text, blockId });
  }

  addLine('import torch');
  addLine('import torch.nn as nn');
  addLine('import torch.nn.functional as F');
  addLine('');

  const safeName = modelName.replace(/[^a-zA-Z0-9]/g, '_');
  addLine(`class ${safeName}(nn.Module):`, 'model_class');
  addLine('    def __init__(self):');
  addLine('        super().__init__()');

  vizConfig.blocks.forEach(block => {
    if (block.type === 'input' || block.type === 'output') return;

    if (block.type === 'conv' && block.params) {
      const p = block.params;
      addLine(`        self.${block.id} = nn.Sequential(`, block.id);
      let convLine = `            nn.Conv2d(${p.in_ch}, ${p.out_ch}, ${p.kernel}`;
      if (p.stride) convLine += `, stride=${p.stride}`;
      if (p.padding) convLine += `, padding=${p.padding}`;
      convLine += ')';
      addLine(convLine, block.id);
      if (p.act) addLine(`            nn.${p.act}()`, block.id);
      if (p.pool) {
        const poolCls = p.pool === 'max' ? 'nn.MaxPool2d' : 'nn.AvgPool2d';
        addLine(`            ${poolCls}(${p.pool_size || 2})`, block.id);
      }
      addLine('        )', block.id);
    } else if (block.type === 'linear' && block.params) {
      addLine(`        self.${block.id} = nn.Linear(${block.params.in_f}, ${block.params.out_f})`, block.id);
    } else if (block.type === 'mlp' && block.params) {
      const p = block.params;
      addLine(`        self.${block.id} = nn.Sequential(`, block.id);
      if (p.dropout) addLine(`            nn.Dropout(${p.dropout}),`, block.id);
      addLine(`            nn.Linear(${p.in_f}, ${p.out_f}),`, block.id);
      if (p.act) addLine(`            nn.${p.act}()`, block.id);
      addLine('        )', block.id);
    } else if (block.type === 'pool' && block.params) {
      const p = block.params;
      const poolCls = p.pool === 'max' ? 'nn.MaxPool2d' : 'nn.AvgPool2d';
      addLine(`        self.${block.id} = ${poolCls}(${p.pool_size || 2})`, block.id);
    } else if (block.type === 'dropout' && block.params) {
      addLine(`        self.${block.id} = nn.Dropout(${block.params.rate})`, block.id);
    } else if (block.type === 'custom') {
      addLine(`        # ${block.label}: ${block.desc}`, block.id);
      if (block.children && block.children.length > 0) {
        addLine('        #   点击上方模块查看内部组成', block.id);
      }
    } else {
      addLine(`        # ${block.label}`, block.id);
    }
  });

  addLine('');
  addLine('    def forward(self, x):');

  vizConfig.blocks.forEach(block => {
    if (block.type === 'input') return;
    if (block.type === 'output') {
      if (block.params && block.params.out_f) {
        addLine(`        x = self.output(x)`, 'output');
      }
      addLine('        return x');
      return;
    }
    if (['conv', 'linear', 'mlp', 'pool', 'dropout'].includes(block.type) && block.params) {
      addLine(`        x = self.${block.id}(x)`, block.id);
    } else {
      addLine(`        # ${block.label}`, block.id);
    }
  });

  // 将代码文本通过语法高亮处理
  const plainCode = lines.map(l => l.text).join('\n');
  const highlighted = highlightSyntax(plainCode);

  // 渲染带行号的 HTML
  renderCodeWithLineNumbers(highlighted, codeBlock);

  // 添加选中行高亮
  lines.forEach((l, i) => {
    if (selected && selected === l.blockId) {
      const lineEl = codeBlock.querySelector(`[data-line="${i + 1}"]`);
      if (lineEl) lineEl.classList.add('code-selected-line');
    }
  });

  scrollToCodeHighlight();
}

// ==================== MLP 可视化 ====================

/** 渲染 MLP 神经元网络 SVG */
function renderMLPNetwork(vizConfig) {
  const container = document.getElementById('vizSvgContainer');
  if (!container) return;

  const p = state.vizState.params;
  const layers = [];
  layers.push({ id: 'input', label: '输入层', size: p.inputSize, type: 'input' });
  for (let i = 0; i < p.hiddenLayers; i++) {
    layers.push({ id: 'hidden_' + i, label: '隐藏层 ' + (i + 1), size: p.hiddenSize, type: 'hidden' });
  }
  layers.push({ id: 'output', label: '输出层', size: p.outputSize, type: 'output' });

  const layerGap = 140;
  const neuronRadius = 8;
  const neuronGap = 18;
  const maxNeurons = Math.max(...layers.map(l => l.size));
  const svgWidth = layers.length * layerGap + 60;
  const svgHeight = Math.max(maxNeurons * neuronGap + 80, 300);
  const layerWidth = 60;

  let svg = `<svg width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}" xmlns="http://www.w3.org/2000/svg">`;

  // 连接线
  for (let i = 0; i < layers.length - 1; i++) {
    const x1 = 40 + i * layerGap + layerWidth;
    const x2 = 40 + (i + 1) * layerGap;
    const y1Start = (svgHeight - layers[i].size * neuronGap) / 2 + neuronGap / 2;
    const y2Start = (svgHeight - layers[i + 1].size * neuronGap) / 2 + neuronGap / 2;

    for (let n1 = 0; n1 < layers[i].size; n1++) {
      for (let n2 = 0; n2 < layers[i + 1].size; n2++) {
        const y1 = y1Start + n1 * neuronGap;
        const y2 = y2Start + n2 * neuronGap;
        const isActive = state.vizState.selectedBlock &&
          (state.vizState.selectedBlock === layers[i].id || state.vizState.selectedBlock === layers[i + 1].id);
        svg += `<line class="nn-connection ${isActive ? 'active' : ''}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
      }
    }
  }

  // 层
  for (let i = 0; i < layers.length; i++) {
    const layer = layers[i];
    const x = 40 + i * layerGap;
    const yStart = (svgHeight - layer.size * neuronGap) / 2;
    const rectHeight = layer.size * neuronGap + 10;
    const rectY = yStart - 5;
    const isSelected = state.vizState.selectedBlock === layer.id;

    svg += `<g class="nn-layer-group ${isSelected ? 'selected' : ''}" onclick="onMLPLayerClick('${layer.id}')">`;
    svg += `<rect class="nn-layer-rect" x="${x}" y="${rectY}" width="${layerWidth}" height="${rectHeight}" rx="8" fill="#1a1d27" stroke="${isSelected ? '#38bdf8' : '#2d3148'}" stroke-width="${isSelected ? 2.5 : 1}"/>`;

    for (let n = 0; n < layer.size; n++) {
      const ny = yStart + n * neuronGap + neuronGap / 2;
      const nx = x + layerWidth / 2;
      svg += `<circle class="nn-neuron ${isSelected ? 'active' : ''}" cx="${nx}" cy="${ny}" r="${neuronRadius}"/>`;
    }

    svg += `<text class="nn-layer-label" x="${x + layerWidth / 2}" y="${rectY - 10}">${escapeHtml(layer.label)}</text>`;
    svg += `<text class="nn-layer-sublabel" x="${x + layerWidth / 2}" y="${rectY + rectHeight + 16}">${layer.size} neurons</text>`;
    svg += `</g>`;
  }

  svg += `</svg>`;
  container.innerHTML = svg;
}

/** MLP 层点击事件 */
function onMLPLayerClick(layerId) {
  const vs = state.vizState;
  vs.selectedBlock = vs.selectedBlock === layerId ? null : layerId;

  const nameEl = document.getElementById('modelBreadcrumbName');
  const modelName = nameEl ? nameEl.textContent : '';
  const config = VIZ_CONFIGS[modelName];
  if (!config) return;

  renderMLPNetwork(config);

  const infoPanel = document.getElementById('vizLayerInfo');
  if (vs.selectedBlock) {
    const layerType = layerId === 'input' ? 'input' : layerId === 'output' ? 'output' : 'hidden';
    const info = config.layerInfo[layerType];
    const p = vs.params;

    let title = '';
    if (layerType === 'input') title = `输入层 (${p.inputSize} 个神经元)`;
    else if (layerType === 'output') title = `输出层 (${p.outputSize} 个神经元)`;
    else {
      const idx = parseInt(layerId.split('_')[1], 10) + 1;
      title = `隐藏层 ${idx} (${p.hiddenSize} 个神经元)`;
    }

    document.getElementById('vizLayerInfoTitle').textContent = title;
    document.getElementById('vizLayerInfoDesc').textContent = info;
    infoPanel.classList.add('active');
  } else {
    infoPanel.classList.remove('active');
  }

  renderMLPCode(config);
}

/** 渲染 MLP 代码 */
function renderMLPCode(vizConfig) {
  const codeBlock = document.getElementById('vizCodeBlock');
  if (!codeBlock) return;
  const plainCode = generateMLPCode(state.vizState.params, state.vizState.selectedBlock);
  const highlighted = highlightSyntax(plainCode);
  renderCodeWithLineNumbers(highlighted, codeBlock);
  scrollToCodeHighlight();
}

/** 生成 MLP PyTorch 代码（纯文本） */
function generateMLPCode(p, selectedLayer) {
  const actMap = { 'ReLU': 'nn.ReLU()', 'Sigmoid': 'nn.Sigmoid()', 'Tanh': 'nn.Tanh()' };
  const actFn = actMap[p.activation] || 'nn.ReLU()';

  const lines = [];
  lines.push('import torch');
  lines.push('import torch.nn as nn');
  lines.push('');
  lines.push('class MLP(nn.Module):');
  lines.push('    def __init__(self):');
  lines.push('        super(MLP, self).__init__()');
  lines.push('        # 输入层 → 隐藏层1');
  lines.push(`        self.fc1 = nn.Linear(${p.inputSize}, ${p.hiddenSize})`);

  for (let i = 0; i < p.hiddenLayers; i++) {
    if (i < p.hiddenLayers - 1) {
      lines.push(`        # 隐藏层${i + 1} → 隐藏层${i + 2}`);
      lines.push(`        self.fc${i + 2} = nn.Linear(${p.hiddenSize}, ${p.hiddenSize})`);
    } else {
      lines.push(`        # 隐藏层${i + 1} → 输出层`);
      lines.push(`        self.fc${i + 2} = nn.Linear(${p.hiddenSize}, ${p.outputSize})`);
    }
  }

  lines.push(`        self.activation = ${actFn}`);
  lines.push('');
  lines.push('    def forward(self, x):');
  lines.push('        x = self.activation(self.fc1(x))');

  for (let i = 0; i < p.hiddenLayers - 1; i++) {
    lines.push(`        x = self.activation(self.fc${i + 2}(x))`);
  }

  lines.push(`        x = self.fc${p.hiddenLayers + 1}(x)`);
  lines.push('        return x');
  lines.push('');
  lines.push('# 创建模型实例');
  lines.push('model = MLP()');

  return lines.join('\n');
}

// 导出全局函数
window.renderBlockNetwork = renderBlockNetwork;
window.renderBlockCode = renderBlockCode;
window.renderMLPNetwork = renderMLPNetwork;
window.renderMLPCode = renderMLPCode;
window.onBlockClick = onBlockClick;
window.onSubBlockClick = onSubBlockClick;
window.onMLPLayerClick = onMLPLayerClick;
window.navigateBreadcrumb = navigateBreadcrumb;
window.fitColumn = fitColumn;
window.groupBlocks = groupBlocks;
window.renderBlockCard = renderBlockCard;
window.renderColumn = renderColumn;
window.renderSubBlockCard = renderSubBlockCard;
window.closeColumnsAfter = closeColumnsAfter;
window.findBlockInConfig = findBlockInConfig;
window.renderEdges = renderEdges;
window.getAnchorPoint = getAnchorPoint;
window.generateMLPCode = generateMLPCode;
window.highlightSyntax = highlightSyntax;
window.showDetail = showDetail;
window.showModelPreview = showModelPreview;
window.copyCode = copyCode;
window.copyModelCode = copyModelCode;
window.renderModelDetailView = renderModelDetailView;
window.showCodeTooltip = showCodeTooltip;
window.hideCodeTooltip = hideCodeTooltip;
window.getBlockCodeLines = getBlockCodeLines;
window.renderCodeWithLineNumbers = renderCodeWithLineNumbers;
window.scrollToCodeHighlight = scrollToCodeHighlight;
window.addResizeHandle = addResizeHandle;
window.alignColumnToBlock = alignColumnToBlock;
window.renderVizPage = renderVizPage;
window.renderInfoPage = renderInfoPage;
window.escapeCodeHtml = escapeCodeHtml;
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

// Global exports for inline event handlers
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
