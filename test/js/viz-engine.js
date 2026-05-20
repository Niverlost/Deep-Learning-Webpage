// ============================================================
// Deep Learning Explorer - Viz Engine Module
// 可视化引擎（SVG 渲染、模型配置、层绘制）
// ============================================================



// ==================== SVG 工具函数 ====================

// SVG 命名空间
const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

/**
 * 创建 SVG 元素
 * @param {string} tag - SVG 标签名
 * @param {Object} [attrs={}] - 属性字典
 * @returns {SVGElement|null} 创建的 SVG 元素
 */
function createSVGElement(tag, attrs = {}) {
  if (!tag || typeof tag !== 'string') {
    console.warn('[Viz] Invalid SVG tag');
    return null;
  }
  
  try {
    const el = document.createElementNS(SVG_NAMESPACE, tag);
    for (const [key, val] of Object.entries(attrs || {})) {
      if (val !== undefined && val !== null) {
        el.setAttribute(key, String(val));
      }
    }
    return el;
  } catch (e) {
    console.error('[Viz] Failed to create SVG element:', e);
    return null;
  }
}

/**
 * 创建 SVG 文本元素
 * @param {string} text - 文本内容
 * @param {number} x - X 坐标
 * @param {number} y - Y 坐标
 * @param {Object} [opts={}] - 选项
 * @returns {SVGTextElement|null} SVG 文本元素
 */
function createSVGText(text, x, y, opts = {}) {
  // 参数验证
  if (typeof x !== 'number' || typeof y !== 'number') {
    console.warn('[Viz] Invalid coordinates for SVG text');
    return null;
  }
  
  const { fontSize = 12, fill = 'currentColor', textAnchor = 'start', fontWeight = 'normal' } = opts || {};
  const el = createSVGElement('text', {
    x, y,
    'font-size': fontSize,
    fill,
    'text-anchor': textAnchor,
    'font-weight': fontWeight
  });
  
  if (el) {
    el.textContent = text || '';
  }
  return el;
}

/**
 * 创建 SVG 矩形
 * @param {number} x - X 坐标
 * @param {number} y - Y 坐标
 * @param {number} width - 宽度
 * @param {number} height - 高度
 * @param {Object} [opts={}] - 选项
 * @returns {SVGRectElement|null} SVG 矩形元素
 */
function createSVGRect(x, y, width, height, opts = {}) {
  // 参数验证
  if (typeof x !== 'number' || typeof y !== 'number' || typeof width !== 'number' || typeof height !== 'number') {
    console.warn('[Viz] Invalid dimensions for SVG rect');
    return null;
  }
  
  const { fill = 'none', stroke = 'none', strokeWidth = 0, rx = 0, ry = 0, opacity = 1 } = opts || {};
  return createSVGElement('rect', {
    x, y, width, height,
    fill, stroke,
    'stroke-width': strokeWidth,
    rx, ry,
    opacity
  });
}

/**
 * 创建 SVG 圆形
 * @param {number} cx - 圆心 X
 * @param {number} cy - 圆心 Y
 * @param {number} r - 半径
 * @param {Object} [opts={}] - 选项
 * @returns {SVGCircleElement|null} SVG 圆形元素
 */
function createSVGCircle(cx, cy, r, opts = {}) {
  // 参数验证
  if (typeof cx !== 'number' || typeof cy !== 'number' || typeof r !== 'number') {
    console.warn('[Viz] Invalid parameters for SVG circle');
    return null;
  }
  
  const { fill = 'none', stroke = 'none', strokeWidth = 0, opacity = 1 } = opts || {};
  return createSVGElement('circle', {
    cx, cy, r,
    fill, stroke,
    'stroke-width': strokeWidth,
    opacity
  });
}

/**
 * 创建 SVG 路径
 * @param {string} d - 路径数据
 * @param {Object} [opts={}] - 选项
 * @returns {SVGPathElement|null} SVG 路径元素
 */
function createSVGPath(d, opts = {}) {
  // 参数验证
  if (!d || typeof d !== 'string') {
    console.warn('[Viz] Invalid path data for SVG path');
    return null;
  }
  
  const { fill = 'none', stroke = 'none', strokeWidth = 1, strokeDasharray = 'none', opacity = 1 } = opts || {};
  return createSVGElement('path', {
    d,
    fill, stroke,
    'stroke-width': strokeWidth,
    'stroke-dasharray': strokeDasharray,
    opacity
  });
}

/**
 * 创建 SVG 箭头标记
 * @param {string} id - 标记 ID
 * @param {string} color - 颜色
 * @returns {SVGMarkerElement} SVG 标记元素
 */
function createArrowMarker(id, color) {
  const marker = createSVGElement('marker', {
    id,
    markerWidth: '10',
    markerHeight: '10',
    refX: '9',
    refY: '3',
    orient: 'auto',
    markerUnits: 'strokeWidth'
  });
  const path = createSVGElement('path', {
    d: 'M0,0 L0,6 L9,3 z',
    fill: color
  });
  marker.appendChild(path);
  return marker;
}

// ==================== 模型配置解析 ====================

/**
 * 解析模型配置为可视化块
 * @param {Object} model - 模型对象
 * @returns {Array} 可视化块数组
 */
function parseModelConfig(model) {
  const blocks = [];

  if (!model.config) return blocks;

  // 输入层
  if (model.config.input) {
    blocks.push({
      type: 'input',
      name: 'Input',
      config: model.config.input,
      details: model.config.input
    });
  }

  // 处理各层
  if (model.config.layers) {
    model.config.layers.forEach((layer, index) => {
      blocks.push({
        type: layer.type || 'custom',
        name: layer.name || `Layer ${index + 1}`,
        config: layer,
        details: layer
      });
    });
  }

  // 输出层
  if (model.config.output) {
    blocks.push({
      type: 'output',
      name: 'Output',
      config: model.config.output,
      details: model.config.output
    });
  }

  return blocks;
}

/**
 * 获取块类型的显示名称
 * @param {string} type - 块类型
 * @returns {string} 显示名称
 */
function getBlockTypeName(type) {
  const names = {
    input: '输入层',
    output: '输出层',
    conv: '卷积层',
    linear: '全连接层',
    mlp: 'MLP层',
    pool: '池化层',
    dropout: 'Dropout',
    attention: '注意力层',
    norm: '归一化层',
    activation: '激活函数',
    custom: '自定义层',
    diffusion: '扩散层'
  };
  return names[type] || type;
}

// ==================== 层绘制 ====================

/**
 * 绘制单个层块
 * @param {SVGElement} svg - SVG 容器
 * @param {Object} block - 块数据
 * @param {number} x - X 坐标
 * @param {number} y - Y 坐标
 * @param {number} width - 宽度
 * @param {number} height - 高度
 * @param {Object} [opts={}] - 选项
 * @returns {SVGGElement} 块组元素
 */
function drawBlock(svg, block, x, y, width, height, opts = {}) {
  const { isSelected = false, isExpanded = false, fontSizeName = 11, fontSizeType = 9 } = opts;
  const color = BLOCK_COLORS[block.type] || BLOCK_COLORS.custom;
  const group = createSVGElement('g', {
    class: `viz-block ${isSelected ? 'selected' : ''} ${isExpanded ? 'expanded' : ''}`,
    'data-block-type': block.type,
    'data-block-name': block.name
  });

  // 主矩形
  const rect = createSVGRect(x, y, width, height, {
    fill: color,
    stroke: isSelected ? '#fff' : 'rgba(255,255,255,0.1)',
    strokeWidth: isSelected ? 2 : 1,
    rx: 4,
    ry: 4,
    opacity: 0.9
  });
  group.appendChild(rect);

  // 块图标
  const iconGroup = createSVGElement('g', { class: 'block-icon' });
  // 简化为一个圆点表示
  const icon = createSVGCircle(x + 15, y + height / 2, 4, { fill: '#fff', opacity: 0.8 });
  iconGroup.appendChild(icon);
  group.appendChild(iconGroup);

  // 块名称
  const nameText = createSVGText(block.name, x + 25, y + height / 2 + 4, {
    fontSize: fontSizeName,
    fill: '#fff',
    fontWeight: '500'
  });
  group.appendChild(nameText);

  // 类型标签
  const typeText = createSVGText(getBlockTypeName(block.type), x + width - 8, y + height / 2 + 4, {
    fontSize: fontSizeType,
    fill: 'rgba(255,255,255,0.6)',
    textAnchor: 'end'
  });
  group.appendChild(typeText);

  return group;
}

/**
 * 绘制层之间的连接线
 * @param {SVGElement} svg - SVG 容器
 * @param {number} fromX - 起点 X
 * @param {number} fromY - 起点 Y
 * @param {number} toX - 终点 X
 * @param {number} toY - 终点 Y
 * @param {Object} [opts={}] - 选项
 * @returns {SVGPathElement} 连接线路径
 */
function drawConnection(svg, fromX, fromY, toX, toY, opts = {}) {
  const { color = 'rgba(255,255,255,0.2)', strokeWidth = 1, dashed = false } = opts;

  const path = createSVGPath(`M${fromX},${fromY} L${toX},${toY}`, {
    stroke: color,
    strokeWidth,
    strokeDasharray: dashed ? '4 4' : 'none'
  });

  return path;
}

/**
 * 绘制数据流箭头
 * @param {SVGElement} svg - SVG 容器
 * @param {number} fromX - 起点 X
 * @param {number} fromY - 起点 Y
 * @param {number} toX - 终点 X
 * @param {number} toY - 终点 Y
 * @param {Object} [opts={}] - 选项
 * @returns {SVGGElement} 箭头组元素
 */
function drawFlowArrow(svg, fromX, fromY, toX, toY, opts = {}) {
  const { color = 'rgba(255,255,255,0.3)' } = opts;

  const midX = (fromX + toX) / 2;
  const midY = (fromY + toY) / 2;

  // 箭头主体
  const line = createSVGPath(`M${fromX},${fromY} L${toX},${toY}`, {
    stroke: color,
    strokeWidth: 1.5
  });

  // 箭头头部
  const angle = Math.atan2(toY - fromY, toX - fromX);
  const arrowLen = 8;
  const arrowAngle = Math.PI / 6;

  const ax1 = toX - arrowLen * Math.cos(angle - arrowAngle);
  const ay1 = toY - arrowLen * Math.sin(angle - arrowAngle);
  const ax2 = toX - arrowLen * Math.cos(angle + arrowAngle);
  const ay2 = toY - arrowLen * Math.sin(angle + arrowAngle);

  const arrowHead = createSVGPath(`M${ax1},${ay1} L${toX},${toY} L${ax2},${ay2}`, {
    stroke: color,
    strokeWidth: 1.5,
    fill: 'none'
  });

  const group = createSVGElement('g');
  group.appendChild(line);
  group.appendChild(arrowHead);

  return group;
}

// ==================== 完整模型可视化 ====================

/**
 * 计算可视化布局参数
 * @param {HTMLElement} container - 容器元素
 * @param {Array} blocks - 块数组
 * @returns {Object} 布局参数
 */
function calculateVizLayout(container, blocks) {
  const containerWidth = container.clientWidth || 800;
  const isSmallScreen = containerWidth < 768;
  const isComplex = blocks.length > 20;
  const pageSize = isComplex ? 20 : blocks.length;
  const renderBlocks = isComplex ? blocks.slice(0, pageSize) : blocks;

  return {
    containerWidth,
    isSmallScreen,
    isComplex,
    renderBlocks,
    blockHeight: isSmallScreen ? 32 : 40,
    gap: isSmallScreen ? 14 : 20,
    startX: isSmallScreen ? 16 : 50,
    startY: isSmallScreen ? 20 : 30,
    blockWidth: isSmallScreen ? Math.max(containerWidth - (isSmallScreen ? 16 : 50) * 2, 200) : 700,
    svgWidth: isSmallScreen ? containerWidth : 800,
    fontSizeName: isSmallScreen ? 9 : 11,
    fontSizeType: isSmallScreen ? 8 : 9
  };
}

/**
 * 渲染空状态
 * @param {HTMLElement} container - 容器元素
 */
function renderEmptyViz(container) {
  const emptyP = document.createElement('p');
  emptyP.className = 'viz-empty';
  emptyP.textContent = '暂无架构可视化数据';
  container.appendChild(emptyP);
}

/**
 * 创建可视化 SVG 容器
 * @param {Object} layout - 布局参数
 * @returns {SVGElement} SVG 元素
 */
function createVizSvg(layout) {
  const svgHeight = layout.renderBlocks.length * (layout.blockHeight + layout.gap) + layout.startY * 2;
  const svg = createSVGElement('svg', {
    width: '100%',
    height: svgHeight,
    viewBox: `0 0 ${layout.svgWidth} ${svgHeight}`,
    class: `model-viz-svg ${layout.isComplex ? 'viz-paginated' : ''}`
  });
  svg.style.willChange = 'transform';

  // 定义箭头标记
  const defs = createSVGElement('defs');
  defs.appendChild(createArrowMarker('arrow-head', 'rgba(255,255,255,0.3)'));
  svg.appendChild(defs);

  return svg;
}

/**
 * 渲染模型架构可视化
 * @param {HTMLElement} container - 容器元素
 * @param {Object} model - 模型对象
 */
function renderModelViz(container, model) {
  // 参数验证
  if (!container) {
    console.warn('[VizEngine] 渲染失败：无效的容器');
    return;
  }
  
  if (!model || typeof model !== 'object') {
    console.warn('[VizEngine] 渲染失败：无效的模型数据');
    renderEmptyViz(container);
    return;
  }

  // 安全：清空容器后使用安全的 DOM 操作
  try {
    container.innerHTML = '';
  } catch (e) {
    console.error('[VizEngine] 清空容器失败:', e);
    return;
  }
  
  if (!model.config || typeof model.config !== 'object') {
    console.warn('[VizEngine] 模型缺少 config 数据:', model.name || 'Unknown');
    renderEmptyViz(container);
    return;
  }
  
  const blocks = parseModelConfig(model);
  if (!Array.isArray(blocks) || blocks.length === 0) {
    console.info('[VizEngine] 模型无可视化数据:', model.name || 'Unknown');
    renderEmptyViz(container);
    return;
  }

  const layout = calculateVizLayout(container, blocks);
  const svg = createVizSvg(layout);
  
  if (!svg) {
    console.error('[VizEngine] 创建 SVG 失败');
    renderEmptyViz(container);
    return;
  }

  let prevY = null;
  let prevX = null;

  layout.renderBlocks.forEach((block, index) => {
    const x = layout.startX;
    const y = layout.startY + index * (layout.blockHeight + layout.gap);

    // 绘制连接线
    if (prevY !== null && prevX !== null) {
      try {
        const connection = drawFlowArrow(svg, prevX + layout.blockWidth / 2, prevY + layout.blockHeight, x + layout.blockWidth / 2, y);
        if (connection) {
          svg.appendChild(connection);
        }
      } catch (e) {
        console.warn('[VizEngine] 绘制连接线失败:', e);
      }
    }

    // 绘制块（传入字体大小选项）
    try {
      const isSelected = state && state.vizState && state.vizState.selectedBlock === block.name;
      const blockGroup = drawBlock(svg, block, x, y, layout.blockWidth, layout.blockHeight, {
        isSelected,
        fontSizeName: layout.fontSizeName,
        fontSizeType: layout.fontSizeType
      });
      if (blockGroup) {
        svg.appendChild(blockGroup);
      }
    } catch (e) {
      console.warn('[VizEngine] 绘制块失败:', e);
    }

    prevX = x;
    prevY = y;
  });

  container.appendChild(svg);
}

/**
 * 收集模型参数
 * @param {Object} model - 模型对象
 * @returns {Array} 参数数组
 */
function collectModelParams(model) {
  const params = [];

  if (model.config.input) {
    params.push({ name: 'Input', type: 'input', ...model.config.input });
  }

  if (model.config.layers) {
    model.config.layers.forEach((layer, i) => {
      params.push({ name: layer.name || `Layer ${i + 1}`, type: layer.type, ...layer });
    });
  }

  if (model.config.output) {
    params.push({ name: 'Output', type: 'output', ...model.config.output });
  }

  return params;
}

/**
 * 生成参数表格行 HTML
 * @param {Object} param - 参数对象
 * @returns {string} 表格行 HTML
 */
function generateParamRow(param) {
  const details = Object.entries(param)
    .filter(([k]) => !['name', 'type'].includes(k))
    .map(([k, v]) => `${escapeHtml(k)}: ${escapeHtml(String(v))}`)
    .join(', ');

  return `<tr>
    <td>${escapeHtml(param.name)}</td>
    <td><span class="param-type" style="background:${BLOCK_COLORS[param.type] || BLOCK_COLORS.custom}">${escapeHtml(param.type)}</span></td>
    <td>${escapeHtml(details)}</td>
  </tr>`;
}

/**
 * 渲染模型参数表格
 * @param {HTMLElement} container - 容器元素
 * @param {Object} model - 模型对象
 */
function renderParamsTable(container, model) {
  if (!container || !model || !model.config) {
    console.warn('[VizEngine] 参数表格渲染失败：无效参数');
    return;
  }

  const params = collectModelParams(model);

  if (params.length === 0) {
    const emptyP = document.createElement('p');
    emptyP.className = 'viz-empty';
    emptyP.textContent = '暂无参数数据';
    container.appendChild(emptyP);
    return;
  }

  const rows = params.map(generateParamRow).join('');

  // 安全：rows 中的动态内容已使用 escapeHtml 转义
  container.innerHTML = `<table class="params-table">
    <thead>
      <tr><th>层名</th><th>类型</th><th>参数</th></tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`;
}

/**
 * 构建树节点 HTML
 * @param {Object} obj - 对象数据
 * @param {string} name - 节点名称
 * @param {string} type - 节点类型
 * @param {number} [depth=0] - 深度
 * @returns {string} 树节点 HTML
 */
function buildTreeNode(obj, name, type, depth = 0) {
  const indent = depth * 20;
  const color = BLOCK_COLORS[type] || BLOCK_COLORS.custom;

  let html = `<div class="tree-node" style="margin-left:${indent}px">
    <div class="tree-node-header">
      <span class="tree-node-dot" style="background:${color}"></span>
      <span class="tree-node-name">${escapeHtml(name)}</span>
      <span class="tree-node-type">${escapeHtml(type)}</span>
    </div>`;

  if (obj && typeof obj === 'object') {
    Object.entries(obj).forEach(([key, val]) => {
      if (typeof val === 'object' && val !== null) {
        html += buildTreeNode(val, key, val.type || 'custom', depth + 1);
      } else if (!['name', 'type'].includes(key)) {
        html += `<div class="tree-leaf" style="margin-left:${(depth + 1) * 20}px">
          <span class="tree-leaf-key">${escapeHtml(key)}:</span>
          <span class="tree-leaf-val">${escapeHtml(String(val))}</span>
        </div>`;
      }
    });
  }

  html += '</div>';
  return html;
}

/**
 * 收集模型树 HTML
 * @param {Object} model - 模型对象
 * @returns {string} 树形 HTML
 */
function collectModelTreeHtml(model) {
  let html = '';
  if (model.config.input) {
    html += buildTreeNode(model.config.input, 'Input', 'input');
  }
  if (model.config.layers) {
    model.config.layers.forEach((layer, i) => {
      html += buildTreeNode(layer, layer.name || `Layer ${i + 1}`, layer.type || 'custom');
    });
  }
  if (model.config.output) {
    html += buildTreeNode(model.config.output, 'Output', 'output');
  }
  return html;
}

/**
 * 渲染模型结构树
 * @param {HTMLElement} container - 容器元素
 * @param {Object} model - 模型对象
 */
function renderModelTree(container, model) {
  if (!container || !model || !model.config) {
    console.warn('[VizEngine] 结构树渲染失败：无效参数');
    return;
  }

  const html = collectModelTreeHtml(model);

  // 安全：html 中的动态内容已使用 escapeHtml 转义
  if (html) {
    container.innerHTML = html;
  } else {
    const emptyP = document.createElement('p');
    emptyP.className = 'viz-empty';
    emptyP.textContent = '暂无结构数据';
    container.appendChild(emptyP);
  }
}

// ==================== 交互功能 ====================

const vizInteractionMap = new WeakMap();

/**
 * 处理块点击事件
 * @param {HTMLElement} container - 容器元素
 * @param {Event} e - 点击事件
 */
function handleBlockClick(container, e) {
  const block = e.target.closest('.viz-block');
  if (!block) return;

  const blockName = block.dataset.blockName;
  const blockType = block.dataset.blockType;

  // 切换选中状态
  container.querySelectorAll('.viz-block').forEach(b => {
    b.classList.remove('selected');
    b.classList.remove('viz-clicked');
  });
  block.classList.add('selected');
  block.classList.add('viz-clicked');

  // 移除动画类以支持重复点击触发动画
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      block.classList.remove('viz-clicked');
    });
  });

  state.vizState.selectedBlock = blockName;

  // 触发块详情显示事件
  const event = new CustomEvent('blockSelected', {
    detail: { name: blockName, type: blockType }
  });
  container.dispatchEvent(event);
}

/**
 * 初始化可视化交互
 * @param {HTMLElement} container - 容器元素
 */
function initVizInteractions(container) {
  if (!container) return;

  // 如果已经绑定过，先清理旧监听器
  destroyVizInteractions(container);

  const clickHandler = (e) => handleBlockClick(container, e);

  container.addEventListener('click', clickHandler);
  vizInteractionMap.set(container, clickHandler);
}

/**
 * 清理可视化交互
 * @param {HTMLElement} container - 容器元素
 */
function destroyVizInteractions(container) {
  if (!container) return;
  const oldHandler = vizInteractionMap.get(container);
  if (oldHandler) {
    container.removeEventListener('click', oldHandler);
    vizInteractionMap.delete(container);
  }
}

/**
 * 高亮特定类型的层
 * @param {HTMLElement} container - 容器元素
 * @param {string} type - 块类型
 */
function highlightBlockType(container, type) {
  if (!container) return;
  container.querySelectorAll('.viz-block').forEach(block => {
    if (block.dataset.blockType === type) {
      block.classList.add('highlighted');
    } else {
      block.classList.remove('highlighted');
    }
  });
}

/**
 * 清除高亮
 * @param {HTMLElement} container - 容器元素
 */
function clearHighlight(container) {
  if (!container) return;
  container.querySelectorAll('.viz-block').forEach(block => {
    block.classList.remove('highlighted');
  });
}

/**
 * 安全移除 DOM 元素
 * @param {HTMLElement} element - 要移除的元素
 */
function safeRemove(element) {
  if (element && element.parentNode) {
    element.parentNode.removeChild(element);
  }
}

/**
 * 销毁可视化：清理 SVG、事件监听、tooltip/popover
 * @param {HTMLElement} container - 容器元素
 */
function destroyVisualization(container) {
  if (!container) return;

  // 清理交互事件
  destroyVizInteractions(container);

  // 清理 SVG 元素
  const svg = container.querySelector('.model-viz-svg');
  safeRemove(svg);

  // 清理参数表格
  const table = container.querySelector('.params-table');
  safeRemove(table);

  // 清理树形结构
  container.querySelectorAll('.tree-node').forEach(safeRemove);

  // 清理 tooltip / popover
  container.querySelectorAll('.viz-tooltip, .viz-popover, .block-tooltip').forEach(safeRemove);

  // 清空容器
  container.innerHTML = '';
}

// ==================== 导出功能 ====================

/**
 * 将 SVG 导出为 PNG
 * @param {SVGElement} svgElement - SVG 元素
 * @param {string} [filename='model-viz.png'] - 文件名
 */
function exportSVGToPNG(svgElement, filename = 'model-viz.png') {
  if (!svgElement) return;

  const svgData = new XMLSerializer().serializeToString(svgElement);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const img = new Image();

  // 从 viewBox 读取实际像素尺寸
  const viewBox = svgElement.getAttribute('viewBox');
  if (viewBox) {
    const parts = viewBox.split(' ').map(Number);
    if (parts.length === 4) {
      canvas.width = parts[2];
      canvas.height = parts[3];
    }
  }

  const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  img.onload = function() {
    if (canvas.width === 0) {
      canvas.width = img.width || 800;
      canvas.height = img.height || 600;
    }
    ctx.drawImage(img, 0, 0);
    URL.revokeObjectURL(url);

    const link = document.createElement('a');
    link.download = filename;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  img.onerror = function() {
    URL.revokeObjectURL(url);
    console.error('SVG 导出失败：无法将 SVG 渲染为图片');
  };

  if (canvas.width === 0) {
    canvas.width = 800;
    canvas.height = 600;
  }

  img.src = url;
}

/**
 * 导出模型配置为 JSON
 * @param {Object} model - 模型对象
 */
function exportModelConfig(model) {
  if (!model || !model.config) return;

  const dataStr = JSON.stringify(model.config, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.download = `${model.name}-config.json`;
  link.href = url;
  link.click();

  URL.revokeObjectURL(url);
}

/**
 * 构建对比导出数据
 * @param {Array} models - 模型数组
 * @returns {Object} 导出数据
 */
function buildCompareExportData(models) {
  return {
    exportType: 'compare',
    exportDate: new Date().toISOString(),
    modelCount: models.length,
    models: models.map(m => ({
      name: m.name,
      category: m.category,
      year: m.year,
      params: m.params,
      acc: m.acc,
      desc: m.desc,
      config: m.config || null
    }))
  };
}

/**
 * 导出对比结果为 JSON
 * @param {Array} models - 模型数组
 */
function exportCompareResult(models) {
  if (!models || models.length === 0) return;

  const exportData = buildCompareExportData(models);

  const dataStr = JSON.stringify(exportData, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.download = `compare-result-${new Date().toISOString().slice(0, 10)}.json`;
  link.href = url;
  link.click();

  URL.revokeObjectURL(url);
}
