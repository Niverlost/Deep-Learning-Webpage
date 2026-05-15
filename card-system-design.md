# 卡片系统设计方案

## 概述

卡片系统是页面的核心信息载体，分为两类：**分类卡片**（首页模块网格入口）和**模型卡片**（分类页模型列表）。本方案参考 dl-viz-pro 的卡片设计，在其基础上统一实现方式并修复已知问题。

---

## 1. 分类卡片（首页模块网格）

### 1.1 卡片结构

```
┌──────────────────────────────────────┐
│  [图标]                              │
│                                      │
│  图像分类                            │
│  从 BP 到 ViT...                     │
│  42 个模型              [→]          │
└──────────────────────────────────────┘
```

垂直布局：图标在上，名称/描述/计数在下，箭头在右下。

### 1.2 HTML 模板

```html
<div class="category-card"
     data-category="图像分类"
     role="button" tabindex="0"
     aria-label="图像分类 - 42 个模型"
     style="animation: fadeInUp 0.5s var(--ease-out) 0.08s both;">
  <div class="category-card-icon"><!-- SVG --></div>
  <div class="category-card-info">
    <div class="category-card-name">图像分类</div>
    <div class="category-card-desc">从 BP 到 ViT，探索图像分类领域的经典与前沿模型</div>
    <span class="category-card-count">42 个模型</span>
  </div>
  <svg class="category-card-arrow" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="m9 18 6-6-6-6"/></svg>
</div>
```

注意：涟漪效果通过 `::before` 伪元素实现，不需要额外 DOM 元素。

### 1.3 交互设计

| 交互 | 触发 | 响应 |
|------|------|------|
| 鼠标悬停 | `mouseenter` | 上移 6px + 缩放 1.01, 盒阴影增大, 箭头右移 4px 并变色 |
| 鼠标按下 | `mousedown` | 下压 2px + 缩放 0.99 |
| 鼠标移入跟踪 | `mousemove` | 更新 `--ripple-x/y` CSS 变量（RAF 节流），产生径向渐变光晕跟随鼠标 |
| 键盘 Enter/Space | `keydown`（事件委托） | 同点击，导航到分类页 |
| 入场 | 卡片挂载时 | `fadeInUp` 动画，逐卡延迟 `index × 0.08s` |

### 1.4 涟漪效果实现

通过 CSS 自定义属性实现纯 CSS 径向渐变光晕跟随鼠标，无需 JS 创建/移除 DOM 元素：

```css
.category-card::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: radial-gradient(600px circle at var(--ripple-x, 50%) var(--ripple-y, 50%),
              rgba(255,255,255,0.06), transparent 40%);
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.3s ease;
  z-index: 0;
}

.category-card:hover::before {
  opacity: 1;
}
```

JS 仅负责更新 `--ripple-x` 和 `--ripple-y`（mousemove 事件，RAF 节流）。手势设备不触发 mousemove，渐变停留在默认 `50% 50%`，不影响体验。

### 1.5 评估与改进

**相对 dl-viz-pro 的改进：**

- dl-viz-pro 的 `updateRipple` 每帧都执行 `getBoundingClientRect`，改用 RAF 节流（同字母小人系统的策略）
- dl-viz-pro 使用内联 `onclick`，改用事件委托 + `data-category` 属性
- dl-viz-pro 无键盘支持，增加 `tabindex="0"` + Enter/Space 事件委托

---

## 2. 模型卡片（分类页）

### 2.1 卡片结构（参考 dl-viz-pro 截图）

```
┌──────────────────────────────────────────┐
│  Faster R-CNN 2015                 [♡]   │
│  目标检测                                │
│  Faster R-CNN 是目标检测领域的里程碑工作，  │
│  首次将区域提议网络（RPN）与检测网络整合...  │
│                                          │
│  [架构图标] CNN + RPN  [参数图标] 约 137M   │
│  目标检测 RPN 两阶段检测 锚框 +1            │
│  查看详情 →                               │
└──────────────────────────────────────────┘
```

**关键设计点（与 dl-viz-pro 一致）：**
- **无顶部装饰条** — 卡片更简洁，信息密度更高
- **标题 + 年份在同一行** — `Faster R-CNN 2015`
- **收藏按钮在右上角** — 心形图标，独立定位
- **无单独的"分类"标签行** — 分类信息已在页面标题中显示
- **描述完整显示**（或自然截断）— 不强制 2 行截断
- **Meta 信息在同一行** — 架构 + 参数，紧凑排列
- **标签紧跟在描述后** — 无额外间距
- **"查看详情 →" 是文本链接样式** — 无按钮边框

### 2.2 HTML 模板

```html
<div class="model-card"
     data-model="Faster R-CNN"
     data-category="目标检测"
     role="article"
     aria-label="Faster R-CNN 模型卡片"
     style="animation: fadeInUp 0.4s var(--ease-out) 0.05s both;">
  <!-- 收藏按钮 - 右上角绝对定位 -->
  <button class="model-card-fav" data-model-name="Faster R-CNN"
          aria-label="收藏" aria-pressed="false">
    <svg width="16" height="16" viewBox="0 0 24 24"
         fill="none" stroke="currentColor"
         stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
    </svg>
  </button>

  <!-- 标题行：名称 + 年份 -->
  <div class="model-card-header">
    <h3 class="model-card-name">Faster R-CNN</h3>
    <span class="model-card-year">2015</span>
  </div>

  <!-- 分类（紧凑显示） -->
  <span class="model-card-category">目标检测</span>

  <!-- 描述（自然显示，不强制截断） -->
  <p class="model-card-desc">Faster R-CNN 是目标检测领域的里程碑工作，首次将区域提议网络（RPN）与检测网络整合为统一的端到端架构。</p>

  <!-- Meta 信息（架构 + 参数，同一行） -->
  <div class="model-card-meta">
    <span class="model-card-meta-item">
      <svg><!-- 架构图标 --></svg>
      CNN + RPN
    </span>
    <span class="model-card-meta-item">
      <svg><!-- 参数图标 --></svg>
      约 137M
    </span>
  </div>

  <!-- 标签（最多4个，超出显示 +N） -->
  <div class="model-card-tags">
    <span class="model-card-tag">目标检测</span>
    <span class="model-card-tag">RPN</span>
    <span class="model-card-tag">两阶段检测</span>
    <span class="model-card-tag">锚框</span>
    <span class="model-card-tag model-card-tag-extra">+1</span>
  </div>

  <!-- 查看详情链接 -->
  <a class="model-card-view-link" data-model="Faster R-CNN">
    查看详情 →
  </a>

  <!-- 对比模式选择框（仅对比模式启用时显示） -->
  <div class="model-card-compare" style="display:none;">
    <input type="checkbox" class="model-card-compare-checkbox"
           data-model-name="Faster R-CNN" aria-label="选择 Faster R-CNN 进行对比">
  </div>
</div>
```

### 2.3 与当前实现的差异对照

| 元素 | 当前实现（图一） | dl-viz-pro（图二） | 本方案 |
|------|----------------|-------------------|--------|
| 顶部装饰条 | 有（120px 渐变 + bar） | 无 | **无** |
| 标题布局 | 名称 / 年份+收藏 分开 | 名称+年份 同行，收藏独立 | **名称+年份同行，收藏右上角** |
| 分类标签 | 单独一行 pill 样式 | 无（或紧凑显示） | **紧凑显示，无 pill 背景** |
| 描述截断 | 强制 2 行 `-webkit-line-clamp` | 自然显示 | **自然显示，不强制截断** |
| Meta 布局 | 图标+文字，有背景 | 纯文字+图标，紧凑 | **紧凑排列，无额外背景** |
| 标签位置 | 独立区域，有间距 | 紧跟描述后 | **紧跟描述，紧凑** |
| 查看详情 | 按钮样式（有边框背景） | 文本链接样式 | **文本链接样式** |
| 整体 padding | 28px | 较小（约 20-24px） | **20-24px** |
| 卡片边框 | 有 | 有（更细） | **1px 细边框** |

### 2.4 交互设计

| 交互 | 触发 | 响应 |
|------|------|------|
| 鼠标悬停 | `mouseenter` | 边框颜色加深，轻微上移 |
| 点击卡片 | `click`（事件委托） | 导航到模型详情页 |
| 点击收藏 | `click`（事件委托） | 切换收藏状态，心形填充/空心 |
| 对比复选框 | `change`（事件委托） | 添加/移除对比列表 |
| 入场 | 卡片挂载 | `fadeInUp` 0.4s, 逐卡延迟 `index × 0.05s` |

**重要：不使用内联 `onclick`。** 所有交互通过 `setupModelGrid()` 事件委托统一处理。

### 2.5 事件绑定策略

```javascript
export function setupModelGrid(grid, callbacks = {}) {
  const { onView, onCardClick, onToggleCompare, onToggleFavorite } = callbacks;

  let previousListener = grid._cardListener;
  if (previousListener) grid.removeEventListener('click', previousListener);
  let previousChangeListener = grid._cardChangeListener;
  if (previousChangeListener) grid.removeEventListener('change', previousChangeListener);

  const clickHandler = (e) => {
    const favBtn = e.target.closest('.model-card-fav');
    if (favBtn) {
      e.stopPropagation();
      const modelName = favBtn.dataset.modelName;
      if (onToggleFavorite) onToggleFavorite(modelName);
      else toggleFavorite(modelName);
      return;
    }

    const viewLink = e.target.closest('.model-card-view-link');
    if (viewLink) {
      e.stopPropagation();
      const modelName = viewLink.dataset.model;
      if (onView) onView(modelName);
      else navigate('model', { name: modelName });
      return;
    }

    const card = e.target.closest('.model-card');
    if (card) {
      const modelName = card.dataset.model;
      if (onCardClick) onCardClick(modelName);
      else navigate('model', { name: modelName });
    }
  };

  const changeHandler = (e) => {
    if (e.target.classList.contains('model-card-compare-checkbox')) {
      const modelName = e.target.dataset.modelName;
      if (onToggleCompare) onToggleCompare(modelName, e.target.checked);
    }
  };

  grid.addEventListener('click', clickHandler);
  grid.addEventListener('change', changeHandler);
  grid._cardListener = clickHandler;
  grid._cardChangeListener = changeHandler;
}
```

### 2.6 标签截断

标签数量超过 4 个时，第 5 个显示为 `+N`：

```javascript
function renderTags(tags, searchTerm) {
  if (!tags || !tags.length) return '';
  const visible = tags.slice(0, 4);
  const extra = tags.length - 4;
  return `
    <div class="model-card-tags">
      ${visible.map(t => `<span class="model-card-tag">${highlightText(t, searchTerm)}</span>`).join('')}
      ${extra > 0 ? `<span class="model-card-tag model-card-tag-extra">+${extra}</span>` : ''}
    </div>
  `;
}
```

### 2.7 搜索高亮范围

统一在名称、描述、分类、架构、标签字段上使用 `highlightText` 高亮关键词：

```javascript
highlightText(model.name, searchTerm)        // 名称
highlightText(model.category, searchTerm)     // 分类
highlightText(model.description, searchTerm)  // 描述
highlightText(model.architecture, searchTerm) // 架构
highlightText(tag, searchTerm)                // 标签
```

`highlightText` 需确保 `keyword` 在正则构造时被转义：

```javascript
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
```

### 2.8 对比模式

对比模式启用时，每张卡片左上角出现复选框。选中时卡片添加 `compare-selected` class：

```css
.model-card.compare-selected {
  outline: 2px solid var(--accent-primary);
  outline-offset: 2px;
}
```

---

## 3. 模型详情页（参考 dl-viz-pro）

### 3.1 页面结构

```
┌──────────────────────────────────────────┐
│  Faster R-CNN                            │
│  目标检测                                │
│  [2015] [目标检测] [CNN + RPN]            │
│  ──────────────────────────────────────── │
│  ┌─────────────┐ ┌─────────────┐         │
│  │ 作者        │ │ 机构        │         │
│  │ Ross Girshick│ │ Microsoft   │         │
│  └─────────────┘ └─────────────┘         │
│  ┌─────────────┐ ┌─────────────┐         │
│  │ 架构        │ │ 参数量      │         │
│  │ CNN + RPN   │ │ 约 137M     │         │
│  └─────────────┘ └─────────────┘         │
│                                          │
│  Faster R-CNN 是目标检测领域的里程碑...    │
│                                          │
│  [核心创新]                               │
│  首次将区域提议网络与检测网络整合...        │
│                                          │
│  [目标检测] [RPN] [两阶段检测] [锚框] [+]  │
│                                          │
│  [论文链接]        [查看完整详情 →]        │
└──────────────────────────────────────────┘
```

### 3.2 HTML 模板

```html
<div class="model-detail">
  <!-- Hero 区域 -->
  <div class="detail-hero">
    <h2>${escapeHtml(model.name)}</h2>
    ${model.fullName ? `<p class="detail-fullname">${escapeHtml(model.fullName)}</p>` : ''}
    <div class="detail-badges">
      ${model.year ? `<span class="badge badge-year">${model.year}</span>` : ''}
      ${model.category ? `<span class="badge badge-category">${escapeHtml(model.category)}</span>` : ''}
      ${model.architecture ? `<span class="badge badge-arch">${escapeHtml(model.architecture)}</span>` : ''}
    </div>
  </div>

  <!-- 信息网格 -->
  ${(model.author || model.organization || model.parameters || model.datasets || model.performance) ? `
  <div class="detail-info-grid">
    ${model.author ? `<div class="detail-info-item"><div class="label">作者</div><div class="value">${escapeHtml(model.author)}</div></div>` : ''}
    ${model.organization ? `<div class="detail-info-item"><div class="label">机构</div><div class="value">${escapeHtml(model.organization)}</div></div>` : ''}
    ${model.architecture ? `<div class="detail-info-item"><div class="label">架构</div><div class="value">${escapeHtml(model.architecture)}</div></div>` : ''}
    ${model.parameters ? `<div class="detail-info-item"><div class="label">参数量</div><div class="value">${escapeHtml(model.parameters)}</div></div>` : ''}
  </div>
  ` : ''}

  <!-- 描述 -->
  ${model.description ? `
  <div class="detail-desc">
    ${addTermTooltips(model.description)}
  </div>
  ` : ''}

  <!-- 核心创新 -->
  ${model.keyInnovation ? `
  <div class="detail-desc detail-innovation">
    <strong>核心创新</strong>
    ${addTermTooltips(model.keyInnovation)}
  </div>
  ` : ''}

  <!-- 标签 -->
  ${model.tags && model.tags.length ? `
  <div class="detail-tags">
    ${model.tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}
  </div>
  ` : ''}

  <!-- 操作按钮 -->
  <div class="detail-actions">
    ${model.paperUrl ? `<a href="${escapeHtml(model.paperUrl)}" target="_blank" rel="noopener" class="btn btn-secondary">论文链接</a>` : ''}
    <button class="btn btn-primary">查看完整详情 →</button>
  </div>
</div>
```

### 3.3 CSS 要点

```css
.detail-hero {
  padding-bottom: 24px;
  margin-bottom: 24px;
  border-bottom: 1px solid var(--border);
}

.detail-hero h2 {
  font-family: var(--font-heading);
  font-size: 1.75rem;
  font-weight: 700;
  margin-bottom: 8px;
  color: var(--text-primary);
  letter-spacing: -0.02em;
}

.detail-hero .detail-fullname {
  color: var(--text-secondary);
  font-size: 1rem;
  margin-bottom: 16px;
}

.detail-hero .detail-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.detail-info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
  margin-bottom: 20px;
}

.detail-info-item {
  background: var(--bg-elevated);
  padding: 16px 20px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
}

.detail-info-item .label {
  font-size: 0.75rem;
  color: var(--text-muted);
  margin-bottom: 6px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.detail-info-item .value {
  font-size: 1rem;
  color: var(--text-primary);
  font-weight: 600;
}

.detail-desc {
  color: var(--text-secondary);
  line-height: 1.8;
  font-size: 1rem;
  margin-bottom: 20px;
}

.detail-desc.detail-innovation {
  border-left: 3px solid var(--accent-secondary);
  padding-left: 16px;
}

.detail-desc strong {
  color: var(--text-primary);
  display: block;
  margin-bottom: 4px;
}

.detail-actions {
  display: flex;
  gap: 16px;
  align-items: center;
  padding-top: 24px;
  border-top: 1px solid var(--border);
}

.detail-actions .btn {
  flex: 1;
  justify-content: center;
}
```

---

## 4. CSS 要点

### 4.1 分类卡片

```css
.category-card {
  position: relative;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  padding: 32px;
  cursor: pointer;
  overflow: hidden;
  transition: background var(--duration-normal) var(--apple-spring),
              border-color var(--duration-normal) var(--apple-spring),
              transform var(--duration-normal) var(--apple-spring),
              box-shadow var(--duration-normal) var(--apple-spring);
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  contain: layout style paint;
}

.category-card:hover {
  background: var(--bg-card-hover);
  border-color: var(--border-hover);
  transform: translateY(-6px) scale(1.01);
  box-shadow: var(--shadow-xl);
}

.category-card:active {
  transform: translateY(-2px) scale(0.99);
}

/* 涟漪光晕 */
.category-card::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: radial-gradient(600px circle at var(--ripple-x, 50%) var(--ripple-y, 50%),
              rgba(255,255,255,0.06), transparent 40%);
  opacity: 0;
  transition: opacity 0.3s ease;
  pointer-events: none;
  z-index: 0;
}

.category-card:hover::before {
  opacity: 1;
}

/* 分类徽章 - 右上角 */
.category-card-badge {
  position: absolute;
  top: 20px;
  right: 20px;
  padding: 6px 14px;
  border-radius: var(--radius-full);
  font-size: 0.75rem;
  font-weight: 600;
  font-family: var(--font-heading);
  background: var(--glass-bg);
  border: 1px solid var(--border);
  color: var(--text-secondary);
}

.category-card-icon {
  width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--glass-bg);
  border-radius: var(--radius-lg);
  margin-bottom: 20px;
  border: 1px solid var(--border);
}

.category-card-icon svg {
  width: 28px;
  height: 28px;
  color: var(--text-primary);
}

.category-card-info {
  flex: 1;
  min-width: 0;
}

.category-card-name {
  font-family: var(--font-heading);
  font-size: 1.375rem;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 12px;
  letter-spacing: -0.02em;
  line-height: 1.2;
}

.category-card-desc {
  color: var(--text-secondary);
  font-size: 0.9375rem;
  line-height: 1.5;
  margin-bottom: 16px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.category-card-count {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--text-muted);
  font-size: 0.875rem;
  font-weight: 500;
}

.category-card-arrow {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--glass-bg);
  border-radius: var(--radius-full);
  border: 1px solid var(--border);
  color: var(--text-secondary);
  transition: background var(--duration-fast) var(--ease-out),
              border-color var(--duration-fast) var(--ease-out),
              color var(--duration-fast) var(--ease-out),
              transform var(--duration-fast) var(--ease-out);
}

.category-card:hover .category-card-arrow {
  background: var(--accent-primary);
  border-color: var(--accent-primary);
  color: #fff;
  transform: translateX(4px);
}
```

### 4.2 模型卡片（参考 dl-viz-pro）

```css
.model-card {
  position: relative;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  padding: 20px;
  cursor: pointer;
  overflow: hidden;
  transition: border-color var(--duration-normal) var(--apple-spring),
              transform var(--duration-normal) var(--apple-spring),
              box-shadow var(--duration-normal) var(--apple-spring);
}

.model-card:hover {
  border-color: var(--border-hover);
  transform: translateY(-4px);
  box-shadow: var(--shadow-lg);
}

.model-card:active {
  transform: translateY(-1px);
}

/* 收藏按钮 - 右上角 */
.model-card-fav {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  transition: color 0.2s ease, transform 0.2s ease;
  z-index: 2;
}

.model-card-fav:hover {
  color: var(--danger);
  transform: scale(1.15);
}

.model-card-fav.active {
  color: var(--danger);
}

.model-card-fav svg {
  width: 16px;
  height: 16px;
}

/* 标题行 */
.model-card-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 4px;
  padding-right: 40px; /* 为收藏按钮留出空间 */
}

.model-card-name {
  font-family: var(--font-heading);
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.3;
  letter-spacing: -0.01em;
}

.model-card-year {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-muted);
  flex-shrink: 0;
}

/* 分类 */
.model-card-category {
  font-size: 0.8125rem;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

/* 描述 */
.model-card-desc {
  font-size: 0.875rem;
  color: var(--text-secondary);
  line-height: 1.6;
  margin-bottom: 10px;
}

/* Meta 信息 */
.model-card-meta {
  display: flex;
  gap: 16px;
  margin-bottom: 10px;
  font-size: 0.8125rem;
  color: var(--text-muted);
}

.model-card-meta-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.model-card-meta-item svg {
  width: 12px;
  height: 12px;
  flex-shrink: 0;
}

/* 标签 */
.model-card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 12px;
}

.model-card-tag {
  font-size: 0.8125rem;
  color: var(--text-secondary);
}

.model-card-tag mark {
  background: var(--accent-light);
  color: var(--accent-primary);
  border-radius: 2px;
}

.model-card-tag-extra {
  font-size: 0.8125rem;
  color: var(--accent-primary);
  font-weight: 600;
}

/* 查看详情链接 */
.model-card-view-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.875rem;
  color: var(--accent-primary);
  cursor: pointer;
  transition: gap 0.2s ease;
}

.model-card-view-link:hover {
  gap: 8px;
  text-decoration: underline;
}

/* 对比模式 */
.model-card-compare {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 2;
}

.model-card-compare-checkbox {
  width: 18px;
  height: 18px;
  cursor: pointer;
  accent-color: var(--accent-primary);
}

.model-card.compare-selected {
  outline: 2px solid var(--accent-primary);
  outline-offset: 2px;
}
```

---

## 5. 入场动画

两类卡片使用统一的 `fadeInUp` 动画，仅时长和延迟不同：

```css
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(24px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

- 分类卡片：`0.5s`, 延迟 `index × 0.08s`
- 模型卡片：`0.4s`, 延迟 `index × 0.05s`

通过内联 `style` 设置延迟。`prefers-reduced-motion: reduce` 时跳过入场动画和 hover 上移动画。

---

## 6. 无障碍

- 分类卡片：`role="button"`, `tabindex="0"`, `aria-label` 含分类名和模型数量
- 模型卡片：`role="article"`, `aria-label` 含模型名称
- 收藏按钮：`aria-pressed` 表达 toggle 状态, `aria-label` 动态切换"收藏"/"取消收藏"
- 对比复选框：`aria-label` 含模型名称
- `prefers-reduced-motion`: 检测时跳过入场动画和 hover 上移动画

---

## 7. 实现路线

### 第一步：模型卡片结构改造（参考 dl-viz-pro）
- 移除顶部装饰条（`.model-card-visual`）
- 收藏按钮改为右上角绝对定位
- 标题 + 年份改为同行显示
- 移除分类的 pill 背景样式
- 描述取消强制 2 行截断
- Meta 区域紧凑排列
- 标签紧跟描述
- "查看详情"改为文本链接样式
- padding 从 28px 改为 20px

### 第二步：模型详情页改造（参考 dl-viz-pro）
- 新增 `detail-hero` 区域（名称 + fullName + badges）
- 新增 `detail-info-grid` 信息网格（作者/机构/架构/参数）
- 描述区域带左边框引用样式
- 核心创新区域单独显示
- 标签使用 pill 样式
- 底部操作按钮（论文链接 + 查看完整详情）

### 第三步：修复事件和高亮
- `highlightText` 增加正则转义
- 搜索高亮扩展到标签、架构字段
- 统一使用事件委托

### 第四步：细节打磨
- 入场动画 `fadeInUp`
- `prefers-reduced-motion` 支持
- 对比模式 UI 补齐
