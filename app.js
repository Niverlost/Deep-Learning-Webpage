// ============================================================
// Deep Learning Explorer - Core Application Logic
// ============================================================

// ==================== 配置与常量 ====================
const CONFIG = {
  // 注意：管理员验证应通过后端进行，此处仅为演示用途
  // 生产环境请移除此配置，使用后端API验证
  STORAGE_KEY: 'dl_viz_pro_models',
  STORAGE_VERSION_KEY: 'dl_viz_pro_version',
  DATA_VERSION: 'v6',
  AUTH_KEY: 'dl_viz_pro_auth',
  USERS_KEY: 'dlviz_users',
  SESSION_KEY: 'dlviz_session',
  THEME_KEY: 'dlviz_theme',
  TOAST_DURATION: 3000,
  SEARCH_DEBOUNCE: 300
};

// ==================== 工具函数 ====================

/** 安全写入 localStorage，防止 QuotaExceededError 导致后续代码不执行 */
function safeSetItem(key, value) {
  try { localStorage.setItem(key, value); } catch(e) { console.warn('localStorage full:', e); }
}

/** 检测用户是否偏好减少动画 - 集中管理避免重复查询 */
const prefersReducedMotion = () => {
  // 缓存结果，避免多次查询
  if (prefersReducedMotion._cached === undefined) {
    prefersReducedMotion._cached = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // 监听变化更新缓存
    window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (e) => {
      prefersReducedMotion._cached = e.matches;
    });
  }
  return prefersReducedMotion._cached;
};

// 简单的密码哈希函数（演示用，生产环境应使用bcrypt/PBKDF2）
/**
 * 使用 PBKDF2 进行密码派生 - 符合生产安全标准
 * 迭代次数：100,000（OWASP推荐最低值）
 * 盐值：16字节随机值
 * 输出：256位（32字节）
 */
async function hashPassword(password, salt) {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);
  const saltBuffer = hexToBuffer(salt);
  
  // 导入密码为 CryptoKey
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  
  // 使用 PBKDF2 派生密钥
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations: 100000,
      hash: 'SHA-256'
    },
    passwordKey,
    256 // 256位输出
  );
  
  return bufferToHex(derivedBits);
}

/** 将十六进制字符串转为 ArrayBuffer */
function hexToBuffer(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes.buffer;
}

/** 将 ArrayBuffer 转为十六进制字符串 */
function bufferToHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0')).join('');
}

function generateSalt() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map(b => b.toString(16).padStart(2, '0')).join('');
}

// ==================== 术语词典 ====================
const GLOSSARY = {
  'CNN': '卷积神经网络，一种专门处理图像数据的神经网络，通过卷积核提取图像特征',
  'RNN': '循环神经网络，一种处理序列数据的神经网络，具有记忆功能',
  'LSTM': '长短期记忆网络，通过门控机制解决RNN的长期依赖问题',
  'GRU': '门控循环单元，LSTM的简化版本，参数更少训练更快',
  'Transformer': '基于自注意力机制的神经网络架构，可并行处理序列数据，是GPT、BERT等模型的基础',
  'Attention': '注意力机制，让模型聚焦于输入数据中最相关的部分',
  'FPN': '特征金字塔网络，通过多尺度特征融合提升目标检测精度',
  'RPN': '区域提议网络，自动生成候选目标区域',
  'RoI': '感兴趣区域，图像中可能包含目标的区域',
  'ASPP': '空洞空间金字塔池化，使用不同扩张率的空洞卷积捕获多尺度上下文',
  'SPPF': '空间金字塔池化-快速版，通过多尺度最大池化融合特征',
  'C2f': 'Cross Stage Partial Bottleneck with 2 convolutions，YOLOv8中的高效模块',
  'Anchor': '锚框，预定义的不同尺寸和长宽比的参考框',
  'mAP': '平均精度均值，目标检测的标准评估指标',
  'IoU': '交并比，预测框与真实框的重叠程度',
  'BLEU': '双语评估替补分数 (Bilingual Evaluation Understudy)，机器翻译的标准评估指标',
  'Top-1/Top-5': 'ImageNet分类指标，Top-1指预测排名第一的准确率，Top-5指前五个预测包含正确答案的准确率',
  'Focal Loss': '焦点损失，自动降低易分类样本的权重，解决类别不平衡问题',
  'Skip Connection': '跳跃连接，将浅层特征直接传递到深层，解决梯度消失问题',
  'Residual Learning': '残差学习，学习输入与输出之间的残差而非直接映射',
  'Batch Normalization': '批归一化，对每层输入进行标准化，加速训练收敛',
  'Dropout': '随机失活，训练时随机丢弃部分神经元防止过拟合',
  'Softmax': '将网络输出转换为概率分布的函数',
  'ReLU': '修正线性单元，最常用的激活函数，f(x)=max(0,x)',
  'Convolution': '卷积操作，用卷积核在图像上滑动提取局部特征',
  'Pooling': '池化操作，降低特征图的空间尺寸，减少计算量',
  'Encoder-Decoder': '编码器-解码器结构，编码器提取特征，解码器恢复空间信息',
  'Segmentation': '语义分割，对图像中每个像素进行分类',
  'Transfer Learning': '迁移学习，将在大数据集上预训练的模型迁移到小数据集任务',
  'Fine-tuning': '微调，在预训练模型基础上用小数据集继续训练',
  'Zero-shot': '零样本学习，无需在目标任务上训练即可完成预测',
  'BPE': '字节对编码，一种子词分词方法，处理未知词汇',
  'Self-Attention': '自注意力机制，计算序列内部元素之间的关联度',
  'Cross-Attention': '交叉注意力，计算两个不同序列之间的关联度',
  'Token': '词元，文本处理的基本单元，可以是一个词或子词',
  'Embedding': '嵌入，将离散符号映射到连续向量空间',
  'Backbone': '骨干网络，提取图像特征的基础网络',
  'Neck': '颈部网络，连接骨干网络和检测头的中间网络',
  'Head': '检测头/分割头，负责最终预测的网络部分',
  'Dilation Rate': '扩张率，空洞卷积中卷积核元素之间的间隔',
  'Stride': '步长，卷积核每次移动的像素数',
  'Padding': '填充，在输入边缘补零以控制输出尺寸',
  'Kernel': '卷积核/滤波器，执行卷积操作的权重矩阵',
  'Channel': '通道，特征图的深度维度',
  'Feature Map': '特征图，卷积层的输出，表示图像在不同层级的特征表示',
  'Gradient': '梯度，损失函数对参数的导数，用于参数更新',
  'Epoch': '训练轮次，完整遍历一次训练数据',
  'Batch': '批次，每次训练使用的样本子集',
  'Learning Rate': '学习率，控制参数更新步长的超参数',
  'Overfitting': '过拟合，模型在训练数据上表现好但在新数据上表现差',
  'Regularization': '正则化，防止过拟合的技术（如Dropout、权重衰减）',
  'Data Augmentation': '数据增强，通过变换训练数据增加样本多样性',
  'Inference': '推理，使用训练好的模型进行预测',
  'Pre-training': '预训练，在大规模数据上进行的初始训练',
  'Contrastive Learning': '对比学习，通过拉近相似样本、推开不相似样本来学习表示',
  'Diffusion': '扩散模型，通过逐步添加和去除噪声来生成数据',
  'GAN': '生成对抗网络，通过生成器和判别器的对抗训练生成数据',
  'Autoencoder': '自编码器，学习数据压缩表示的无监督模型',
  'Multi-head Attention': '多头注意力，将注意力分为多个子空间并行计算',
  'Position Encoding': '位置编码，为序列中的每个位置添加位置信息',
  'Layer Normalization': '层归一化，对单个样本的特征维度进行标准化',
  'Masked Language Model': '掩码语言模型，随机遮盖部分词元让模型预测',
  'Next Token Prediction': '下一个词元预测，根据上文预测下一个词',
  'Beam Search': '束搜索，解码时保留多个候选序列的搜索策略',
  'Temperature': '温度参数，控制生成模型输出概率分布的平滑程度',
  'Prompt': '提示词，给大语言模型的输入指令',
  'Hallucination': '幻觉，模型生成看似合理但实际错误的内容',
  'Quantization': '量化，将模型参数从高精度转换为低精度以减少模型大小',
  'Pruning': '剪枝，移除模型中不重要的参数或层以压缩模型',
  'Distillation': '知识蒸馏，用大模型（教师）指导小模型（学生）训练',
  'Mosaic': 'Mosaic数据增强，将4张图片拼接为1张进行训练',
  'CSP': 'Cross Stage Partial，跨阶段部分连接，减少计算量同时增强梯度流',
  'Shifted Window': '滑动窗口，Swin Transformer中的局部注意力机制',
  'Patch': '图像块，Vision Transformer中将图像分割的小块',
  'ViT': 'Vision Transformer，将Transformer应用于图像分类的模型',
  'CLIP': '对比语言-图像预训练，通过图文对学习视觉表示',
  'DALL-E': 'OpenAI的文本到图像生成模型',
  'Stable Diffusion': 'Stability AI的文本到图像扩散模型',
  'YOLO': 'You Only Look Once，实时目标检测算法系列',
  'NMS': '非极大值抑制，去除重叠的检测框',
  'Confidence': '置信度，模型对预测结果的确定程度',
  'Ground Truth': '真实标签，数据集中标注的正确答案',
  'Loss Function': '损失函数，衡量模型预测与真实标签之间的差距',
  'Optimizer': '优化器，根据梯度更新模型参数的算法（如SGD、Adam）',
  'Backpropagation': '反向传播，计算损失函数对每层参数梯度的算法',
  'Activation Function': '激活函数，引入非线性的函数（如ReLU、Sigmoid）',
  'Sigmoid': 'Sigmoid函数，将输出映射到0-1之间，f(x)=1/(1+e^(-x))',
  'Tanh': '双曲正切函数，将输出映射到-1到1之间',
  'Adam': '自适应矩估计优化器，结合动量和自适应学习率',
  'SGD': '随机梯度下降，最基本的优化算法',
  'Weight Decay': '权重衰减，L2正则化，防止权重过大',
  'Momentum': '动量，加速梯度下降并减少震荡',
  'LR Schedule': '学习率调度，训练过程中动态调整学习率',
  'Warmup': '预热，训练初期使用较小的学习率逐步增大',
  'Checkpoint': '检查点，训练过程中保存的模型快照',
  'Early Stopping': '早停，验证集性能不再提升时停止训练',
  'Cross-Entropy': '交叉熵损失，分类任务常用的损失函数',
  'MSE': '均方误差，回归任务常用的损失函数',
  'BCE': '二元交叉熵，二分类任务常用的损失函数',
  'Dice Loss': 'Dice损失，分割任务中衡量预测与真实区域的重叠度',
  'F1 Score': 'F1分数，精确率和召回率的调和平均',
  'Precision': '精确率，预测为正的样本中真正为正的比例',
  'Recall': '召回率，真正为正的样本中被正确预测的比例',
  'AUC': 'ROC曲线下面积，分类模型的整体性能指标',
  'AP': '平均精度，单个类别的精度-召回率曲线下面积',
  'GFLOPs': '十亿次浮点运算，衡量模型计算量',
  'FPS': '每秒帧数，衡量模型推理速度',
  'Latency': '延迟，模型处理单个样本所需时间',
  'Throughput': '吞吐量，模型单位时间内处理的样本数',
  'Parameters': '参数量，模型中可训练权重的总数',
  'FLOPs': '浮点运算次数，衡量模型计算复杂度',
  'MACs': '乘加操作次数，衡量卷积层的计算量'
};

// 术语tooltip缓存
let termTooltipEl = null;

/** 在渲染模型详情和描述时，自动为术语添加tooltip */
// 预编译术语正则（单次构建，避免每次调用重建110个正则）
let _termRegexCache = null;
function _buildTermRegex() {
  if (_termRegexCache) return _termRegexCache;
  const terms = Object.keys(GLOSSARY).sort((a, b) => b.length - a.length);
  const escaped = terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  _termRegexCache = {
    regex: new RegExp(`\\b(${escaped.join('|')})\\b`, 'gi'),
    terms
  };
  return _termRegexCache;
}

function addTermTooltips(text) {
  if (!text) return text;
  let result = escapeHtml(text);
  const { regex, terms } = _buildTermRegex();
  // 单次正则匹配 + 查表替换，将 O(n*m) 降为 O(n)
  result = result.replace(regex, (match) => {
    const key = terms.find(t => t.toLowerCase() === match.toLowerCase());
    if (!key) return match;
    const def = GLOSSARY[key].replace(/"/g, '&quot;');
    return `<span class="term" data-term="${key}" title="${def}">${match}</span>`;
  });
  return result;
}

/** 初始化术语tooltip事件委托 */
function initTermTooltips() {
  // 创建tooltip元素
  if (!termTooltipEl) {
    termTooltipEl = document.createElement('div');
    termTooltipEl.className = 'term-tooltip';
    document.body.appendChild(termTooltipEl);
  }

  document.addEventListener('mouseenter', function(e) {
    const termEl = e.target.closest('.term');
    if (!termEl) return;
    const definition = termEl.getAttribute('title');
    if (!definition) return;
    termTooltipEl.textContent = definition;
    termTooltipEl.classList.add('visible');
    positionTooltip(termEl);
  }, true);

  document.addEventListener('mouseleave', function(e) {
    const termEl = e.target.closest('.term');
    if (!termEl) return;
    termTooltipEl.classList.remove('visible');
  }, true);

  document.addEventListener('mousemove', function(e) {
    if (termTooltipEl.classList.contains('visible')) {
      let x = e.clientX + 12;
      let y = e.clientY + 12;
      // 边界检测：防止tooltip溢出视口
      const tw = termTooltipEl.offsetWidth;
      const th = termTooltipEl.offsetHeight;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      if (x + tw > vw - 8) x = e.clientX - tw - 12;
      if (y + th > vh - 8) y = e.clientY - th - 12;
      if (x < 8) x = 8;
      if (y < 8) y = 8;
      termTooltipEl.style.left = x + 'px';
      termTooltipEl.style.top = y + 'px';
    }
  });
}

/** 定位tooltip */
function positionTooltip(el) {
  const rect = el.getBoundingClientRect();
  termTooltipEl.style.left = (rect.left + rect.width / 2) + 'px';
  termTooltipEl.style.top = (rect.bottom + 8) + 'px';
}

// ==================== 模型对比系统 ====================
const compareState = {
  enabled: false,
  selected: []
};

/** 切换对比模式 */
function toggleCompareMode() {
  compareState.enabled = !compareState.enabled;
  compareState.selected = [];
  updateCompareUI();
  // 重新渲染当前分类页
  if (state.currentView === 'category' && state.currentCategory) {
    renderCategory(state.currentCategory);
  }
}

/** 切换模型对比选择 */
function toggleCompareSelection(modelName, event) {
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }
  const idx = compareState.selected.indexOf(modelName);
  if (idx === -1) {
    if (compareState.selected.length >= 4) {
      showToast('最多选择4个模型进行对比', 'warning');
      return;
    }
    compareState.selected.push(modelName);
  } else {
    compareState.selected.splice(idx, 1);
  }
  updateCompareUI();
  // 更新卡片上的checkbox样式
  document.querySelectorAll('.compare-checkbox').forEach(cb => {
    const name = cb.dataset.modelName;
    const isSelected = compareState.selected.includes(name);
    if (isSelected) {
      cb.classList.add('checked');
    } else {
      cb.classList.remove('checked');
    }
    cb.setAttribute('aria-checked', isSelected);
  });
}

/** 更新对比模式UI */
function updateCompareUI() {
  const bar = document.getElementById('compareBar');
  const btn = document.getElementById('compareModeBtn');
  if (!bar || !btn) return;

  if (compareState.enabled) {
    btn.classList.add('active');
    btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="1" width="5" height="5" rx="1"/><rect x="8" y="8" width="5" height="5" rx="1"/><line x1="6" y1="3.5" x2="8" y2="3.5" stroke-dasharray="1 1"/><line x1="3.5" y1="6" x2="3.5" y2="8" stroke-dasharray="1 1"/></svg><span>对比中</span>';
  } else {
    btn.classList.remove('active');
    btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="1" width="5" height="5" rx="1"/><rect x="8" y="8" width="5" height="5" rx="1"/><line x1="6" y1="3.5" x2="8" y2="3.5" stroke-dasharray="1 1"/><line x1="3.5" y1="6" x2="3.5" y2="8" stroke-dasharray="1 1"/></svg><span>对比</span>';
  }

  // 更新底部对比栏
  if (compareState.enabled && compareState.selected.length >= 2) {
    bar.classList.add('visible');
    document.getElementById('compareBarCount').textContent = compareState.selected.length;
    document.getElementById('compareBarModels').textContent = compareState.selected.join(' vs ');
  } else {
    bar.classList.remove('visible');
  }
}

/** 显示对比页面 */
function showCompare() {
  if (compareState.selected.length < 2) {
    showToast('请至少选择2个模型', 'warning');
    return;
  }
  navigate('compare');
}

/** 渲染对比页面 */
function renderCompare() {
  const container = document.getElementById('compareViewBody');
  if (!container) return;

  const selectedModels = compareState.selected.map(name => state.models.find(m => m.name === name)).filter(Boolean);

  if (selectedModels.length < 2) {
    container.innerHTML = '<div class="empty-state"><p>请至少选择2个模型进行对比</p><p class="empty-hint">返回分类页选择模型</p></div>';
    return;
  }

  const compareRows = [
    { label: '年份', key: 'year' },
    { label: '作者', key: 'author' },
    { label: '机构', key: 'organization' },
    { label: '架构', key: 'architecture' },
    { label: '参数量', key: 'parameters' },
    { label: '训练数据集', key: 'datasets' },
    { label: '性能指标', key: 'performance' },
    { label: '关键创新', key: 'keyInnovation' }
  ];

  let html = `
    <div class="compare-header">
      <h2>模型对比</h2>
      <div class="compare-header-actions">
        <button class="btn btn-ghost btn-sm" onclick="navigate('category', {category: '${escapeHtml(state.currentCategory || '')}'})">返回分类</button>
        <button class="btn btn-secondary btn-sm" onclick="toggleCompareMode(); navigate('category', {category: '${escapeHtml(state.currentCategory || '')}'})">退出对比</button>
      </div>
    </div>
    <div class="compare-table-wrapper">
      <table class="compare-table">
        <thead>
          <tr>
            <th class="compare-table-label-col">属性</th>
            ${selectedModels.map(m => `<th>${escapeHtml(m.name)}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${compareRows.map(row => `
            <tr>
              <td class="compare-table-label-col"><strong>${row.label}</strong></td>
              ${selectedModels.map(m => `<td>${addTermTooltips(m[row.key] || '-')}</td>`).join('')}
            </tr>
          `).join('')}
          <tr>
            <td class="compare-table-label-col"><strong>简介</strong></td>
            ${selectedModels.map(m => `<td class="compare-desc-cell">${addTermTooltips(m.description || '-')}</td>`).join('')}
          </tr>
        </tbody>
      </table>
    </div>
  `;

  container.innerHTML = html;
}

// ==================== 学习路径系统 ====================
const LEARNING_PATHS = [
  {
    id: 'beginner',
    title: '入门路径',
    subtitle: '从零开始理解深度学习',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7 20h10"/><path d="M10 20c5.5-2.5.8-6.4 3-10"/><path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z"/><path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z"/></svg>',
    color: '#22c55e',
    models: ['BP', 'LeNet-5', 'AlexNet', 'VGGNet', 'ResNet'],
    description: '适合深度学习初学者，从最基础的反向传播开始，逐步了解CNN的发展历程'
  },
  {
    id: 'intermediate',
    title: '进阶路径',
    subtitle: '深入理解现代架构',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>',
    color: '#f59e0b',
    models: ['GoogLeNet', 'ResNet', 'DenseNet', 'SENet', 'MobileNetV1', 'EfficientNet'],
    description: '适合有一定基础的学习者，深入理解Inception、残差连接、注意力机制等核心思想'
  },
  {
    id: 'detection',
    title: '目标检测路径',
    subtitle: '从R-CNN到YOLO',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>',
    color: '#ef4444',
    models: ['YOLO', 'Faster R-CNN', 'SSD', 'RetinaNet', 'YOLOv3', 'YOLOv5', 'YOLOv8'],
    description: '系统学习目标检测的发展脉络，从两阶段到单阶段，从Anchor-based到Anchor-free'
  },
  {
    id: 'segmentation',
    title: '语义分割路径',
    subtitle: '像素级理解图像',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/></svg>',
    color: '#a855f7',
    models: ['FCN', 'U-Net', 'DeepLab v3+'],
    description: '学习语义分割的经典方法，从全卷积网络到编码器-解码器结构'
  },
  {
    id: 'nlp',
    title: 'NLP路径',
    subtitle: '从RNN到Transformer',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>',
    color: '#06b6d4',
    models: ['LSTM', 'GRU', 'Transformer', 'BERT', 'GPT-2', 'T5'],
    description: '了解自然语言处理的演进，从循环神经网络到预训练语言模型'
  },
  {
    id: 'advanced',
    title: '前沿路径',
    subtitle: '探索最新技术',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg>',
    color: '#ec4899',
    models: ['ViT', 'Swin Transformer', 'DeiT', 'CLIP', 'Stable Diffusion', 'GPT-4'],
    description: '探索Vision Transformer、多模态学习、扩散模型等前沿技术'
  }
];

/** 渲染学习路径页面 */
function renderLearningPath() {
  const container = document.getElementById('learningPathViewBody');
  if (!container) return;

  let html = `
    <div class="learning-path-header">
      <h2>学习路径</h2>
      <p class="learning-path-intro">根据你的学习阶段和兴趣，选择合适的学习路径，系统化地掌握深度学习知识体系</p>
    </div>
    <div class="path-grid">
  `;

  LEARNING_PATHS.forEach((path, index) => {
    // 检查路径中的模型是否在数据库中存在
    const availableModels = path.models.filter(name => state.models.find(m => m.name === name));
    const totalModels = path.models.length;

    html += `
      <div class="path-card" style="--path-color: ${path.color}; animation: fadeInUp 0.5s var(--ease-out) ${index * 0.08}s both;">
        <div class="path-card-header">
          <span class="path-card-icon">${path.icon}</span>
          <div>
            <h3 class="path-card-title">${escapeHtml(path.title)}</h3>
            <p class="path-card-subtitle">${escapeHtml(path.subtitle)}</p>
          </div>
          <span class="path-card-count" style="color: ${path.color};">${availableModels.length}/${totalModels}</span>
        </div>
        <p class="path-card-desc">${escapeHtml(path.description)}</p>
        <div class="path-models">
          ${path.models.map((name, i) => {
            const exists = state.models.find(m => m.name === name);
            return `
              ${i > 0 ? '<span class="path-arrow">→</span>' : ''}
              <span class="path-model-tag ${exists ? '' : 'path-model-tag-missing'}" 
                    ${exists ? `onclick="navigate('model', {name: '${escapeHtml(name)}'})" onkeydown="if(event.key==='Enter')navigate('model',{name:'${escapeHtml(name).replace(/'/g, "\\'")}'})" role="button" tabindex="0"` : ''}
                    title="${exists ? '点击查看详情' : '暂未收录'}">
                ${escapeHtml(name)}
              </span>
            `;
          }).join('')}
        </div>
        ${availableModels.length > 0 ? `
          <div class="path-card-actions">
            <button class="btn btn-primary btn-sm" onclick="navigate('model', {name: '${escapeHtml(availableModels[0])}'})">开始学习</button>
          </div>
        ` : ''}
      </div>
    `;
  });

  html += '</div>';
  container.innerHTML = html;
}

// ==================== 权限系统 ====================
const PERMISSIONS = {
  guest: { browse: true, visualize: true, code: true, favorite: false, compare: false, admin: false },
  user:  { browse: true, visualize: true, code: true, favorite: true, compare: true, admin: false },
  admin: { browse: true, visualize: true, code: true, favorite: true, compare: true, admin: true }
};

// 用户状态
const userState = {
  role: 'guest',
  username: '',
  email: '',
  favorites: [],
  joinDate: null
};

/** 检查权限 */
function hasPermission(action) {
  return PERMISSIONS[userState.role][action] || false;
}

/** 需要登录的操作，未登录时弹出登录提示 */
function requireLogin(callback) {
  if (userState.role === 'guest') {
    showLoginModal(callback);
    return;
  }
  callback();
}

// 模块分类配置（图标、颜色、描述）
const MODULE_CATEGORIES = {
  '图像分类': {
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>',
    color: 'blue',
    desc: '从 BP 到 ViT，探索图像分类领域的经典与前沿模型'
  },
  '目标检测': {
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="22" y1="12" x2="18" y2="12"/><line x1="6" y1="12" x2="2" y2="12"/><line x1="12" y1="6" x2="12" y2="2"/><line x1="12" y1="22" x2="12" y2="18"/></svg>',
    color: 'orange',
    desc: '实时检测与定位图像中的目标对象'
  },
  '自然语言处理': {
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    color: 'purple',
    desc: '语言理解与生成的核心模型架构'
  },
  '图像生成': {
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="10.5" r="2.5"/><circle cx="8.5" cy="7.5" r="2.5"/><circle cx="6.5" cy="12.5" r="2.5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>',
    color: 'pink',
    desc: '从文本到图像、从噪声到艺术的生成模型'
  },
  '大语言模型': {
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>',
    color: 'cyan',
    desc: '大规模预训练语言模型与通用 AI'
  }
};

// 块类型颜色映射
const BLOCK_COLORS = {
  input: '#22c55e',
  output: '#ef4444',
  conv: '#6366f1',
  linear: '#f59e0b',
  mlp: '#f59e0b',
  pool: '#06b6d4',
  dropout: '#9ca3af',
  attention: '#a855f7',
  norm: '#06b6d4',
  activation: '#ec4899',
  custom: '#6366f1',
  diffusion: '#f472b6'
};

// ==================== 全局状态 ====================
const state = {
  models: [],
  currentView: 'home',
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

// ==================== 工具函数 ====================

/** HTML 转义，防止 XSS */
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/** 防抖函数 */
function debounce(fn, ms) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), ms);
  };
}

/** 显示 Toast 提示 */
function showToast(msg, type = '') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  // 限制最大同时显示数量，防止界面被填满
  const MAX_TOASTS = 5;
  while (container.children.length >= MAX_TOASTS) {
    container.removeChild(container.firstChild);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.setAttribute('role', 'status'); // 无障碍支持：屏幕阅读器播报
  
  // 添加图标
  const iconMap = {
    'success': '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
    'error': '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>',
    'warning': '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>',
    'info': '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>'
  };
  
  if (iconMap[type]) {
    toast.innerHTML = `<span class="toast-icon">${iconMap[type]}</span><span class="toast-message">${escapeHtml(msg)}</span>`;
  } else {
    toast.textContent = msg;
  }
  
  container.appendChild(toast);
  
  // 触发动画
  requestAnimationFrame(() => {
    toast.classList.add('visible');
  });

  setTimeout(() => {
    toast.classList.add('hiding');
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 300);
  }, CONFIG.TOAST_DURATION);
}

/** 获取块类型图标 */
function getBlockIcon(type) {
  const icons = {
    input: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>',
    output: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
    conv: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>',
    linear: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
    mlp: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>',
    pool: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>',
    dropout: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3h5v5"/><path d="M8 3H3v5"/><path d="M12 22v-8"/><path d="m21 3-7 7"/><path d="M3 3l7 7"/></svg>',
    attention: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>',
    norm: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/></svg>',
    activation: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
    custom: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a9 9 0 0 0 9 9"/><path d="M12 3a9 9 0 0 1 9 9"/><path d="M12 3v9h9"/></svg>',
    diffusion: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>'
  };
  return icons[type] || icons.custom;
}

// ==================== 用户数据库 ====================

/** 获取用户列表 */
function getUsers() {
  try {
    return JSON.parse(localStorage.getItem(CONFIG.USERS_KEY) || '[]');
  } catch (e) {
    console.warn('Failed to parse users data:', e);
    return [];
  }
}

/** 注册用户 */
async function registerUser(username, email, password) {
  const users = getUsers();
  if (users.find(u => u.username === username)) {
    showToast('用户名已存在', 'error');
    return false;
  }
  if (users.find(u => u.email === email)) {
    showToast('该邮箱已被注册', 'error');
    return false;
  }
  // 使用SHA-256哈希密码（生产环境应使用bcrypt/PBKDF2）
  const salt = generateSalt();
  const hashedPassword = await hashPassword(password, salt);
  users.push({
    username,
    email,
    password: hashedPassword,
    salt: salt,
    role: 'user',
    favorites: [],
    joinDate: new Date().toISOString()
  });
  localStorage.setItem(CONFIG.USERS_KEY, JSON.stringify(users));
  return true;
}

/** 用户登录 */
async function loginUser(username, password) {
  // 管理员登录（生产环境应通过后端验证）
  // 演示模式：使用环境变量或后端API替代硬编码密码
  const adminPasswordHash = localStorage.getItem('admin_pass_hash');
  if (username === 'admin' && adminPasswordHash) {
    const adminSalt = localStorage.getItem('admin_salt') || '';
    const inputHash = await hashPassword(password, adminSalt);
    if (inputHash === adminPasswordHash) {
      userState.role = 'admin';
      userState.username = 'admin';
      userState.email = '';
      userState.favorites = [];
      userState.joinDate = null;
      state.isAdmin = true;
      sessionStorage.setItem(CONFIG.AUTH_KEY, '1');
      sessionStorage.setItem(CONFIG.SESSION_KEY, JSON.stringify(userState));
      updateUIForRole();
      showToast('管理员登录成功', 'success');
      return true;
    }
  }

  const users = getUsers();
  const user = users.find(u => u.username === username);
  if (!user) {
    showToast('用户名或密码错误', 'error');
    return false;
  }
  
  // 验证密码哈希
  const inputHash = await hashPassword(password, user.salt || '');
  if (inputHash !== user.password) {
    // 兼容旧版Base64存储（迁移期间）
    if (user.password === btoa(password)) {
      // 自动升级为哈希存储
      const salt = generateSalt();
      user.salt = salt;
      user.password = await hashPassword(password, salt);
      safeSetItem(CONFIG.USERS_KEY, JSON.stringify(users));
    } else {
      showToast('用户名或密码错误', 'error');
      return false;
    }
  }

  userState.role = user.role;
  userState.username = user.username;
  userState.email = user.email;
  userState.favorites = user.favorites || [];
  userState.joinDate = user.joinDate;
  state.isAdmin = false;
  sessionStorage.setItem(CONFIG.SESSION_KEY, JSON.stringify(userState));
  updateUIForRole();
  showToast(`欢迎回来，${user.username}`, 'success');
  return true;
}

/** 退出登录 */
function logoutUser() {
  userState.role = 'guest';
  userState.username = '';
  userState.email = '';
  userState.favorites = [];
  userState.joinDate = null;
  state.isAdmin = false;
  sessionStorage.removeItem(CONFIG.SESSION_KEY);
  sessionStorage.removeItem(CONFIG.AUTH_KEY);
  updateUIForRole();
  showToast('已退出登录', 'info');
}

// I12创新：节日装饰系统
function applyHolidayDecorations(stage) {
  const now = new Date();
  const month = now.getMonth() + 1; // 1-12
  const day = now.getDate();
  
  // 圣诞节 (12月)
  if (month === 12) {
    stage.classList.add('holiday-christmas');
    // 给字母添加圣诞帽
    const chars = stage.querySelectorAll('.letter-char');
    chars.forEach((char, i) => {
      if (i % 3 === 0) { // 每3个字母戴一顶帽子
        const hat = document.createElement('div');
        hat.className = 'holiday-hat santa-hat';
        hat.setAttribute('aria-hidden', 'true');
        hat.innerHTML = '🎅';
        char.appendChild(hat);
      }
    });
  }
  
  // 新年 (1月1日-3日)
  if (month === 1 && day <= 3) {
    stage.classList.add('holiday-newyear');
    // 添加彩带效果
    const chars = stage.querySelectorAll('.letter-char');
    chars.forEach(char => {
      char.style.filter = 'drop-shadow(0 0 8px rgba(255, 215, 0, 0.5))';
    });
  }
  
  // 中秋节 (农历八月十五，简化用9月中旬)
  if (month === 9 && day >= 15 && day <= 20) {
    stage.classList.add('holiday-midautumn');
    // 添加月亮光晕
    const chars = stage.querySelectorAll('.letter-char');
    chars.forEach((char, i) => {
      if (i === Math.floor(chars.length / 2)) { // 中间字母
        char.style.filter = 'drop-shadow(0 0 12px rgba(255, 200, 100, 0.6))';
      }
    });
  }
}

/** 初始化管理员密码（首次运行时调用） */
function initAdminPassword() {
  try {
    const adminPasswordHash = localStorage.getItem('admin_pass_hash');
    if (!adminPasswordHash) {
      // 生成默认管理员密码（首次运行时）
      const defaultPassword = 'admin' + Math.random().toString(36).substring(2, 8);
      const salt = generateSalt();
      hashPassword(defaultPassword, salt).then(hash => {
        safeSetItem('admin_pass_hash', hash);
        safeSetItem('admin_salt', salt);
        // 仅在开发环境显示默认密码（生产环境应移除此日志）
        if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
          console.log('%c🔐 管理员账户已初始化', 'color: #007AFF; font-size: 14px; font-weight: bold;');
          console.log('%c用户名: admin', 'color: #333; font-size: 12px;');
          console.log('%c密码: ' + defaultPassword, 'color: #333; font-size: 12px;');
          console.log('%c请登录后立即修改密码！', 'color: #FF3B30; font-size: 12px;');
        }
      }).catch(e => {
        console.warn('[Admin] 密码哈希生成失败:', e);
      });
    }
  } catch (e) {
    console.warn('[Admin] 管理员密码初始化失败:', e);
  }
}

/** 设置管理员密码（需要管理员权限） */
async function setAdminPassword(newPassword) {
  if (!state.isAdmin) {
    showToast('需要管理员权限', 'error');
    return false;
  }
  const salt = generateSalt();
  const hash = await hashPassword(newPassword, salt);
  safeSetItem('admin_pass_hash', hash);
  safeSetItem('admin_salt', salt);
  showToast('管理员密码已更新', 'success');
  return true;
}

/** 保存用户状态到 localStorage */
function saveUserState() {
  const users = getUsers();
  const user = users.find(u => u.username === userState.username);
  if (user) {
    user.favorites = userState.favorites;
    safeSetItem(CONFIG.USERS_KEY, JSON.stringify(users));
  }
  sessionStorage.setItem(CONFIG.SESSION_KEY, JSON.stringify(userState));
}

/** 页面加载时恢复会话 */
function restoreSession() {
  const session = sessionStorage.getItem(CONFIG.SESSION_KEY);
  if (session) {
    try {
      const data = JSON.parse(session);
      Object.assign(userState, data);
      if (userState.role === 'admin') {
        state.isAdmin = true;
      }
    } catch (e) {
      console.warn('会话数据解析失败');
    }
  }
  updateUIForRole();
}

/** 根据角色更新 UI */
function updateUIForRole() {
  // 更新导航栏用户区域
  const userNav = document.getElementById('userNav');
  const loginBtn = document.getElementById('navLoginBtn');
  const adminBtn = document.getElementById('navAdminBtn');
  const favBtn = document.getElementById('navFavBtn');

  if (userNav) {
    if (userState.role !== 'guest') {
      userNav.style.display = 'flex';
      const avatar = document.getElementById('userAvatar');
      const userName = document.getElementById('userName');
      if (avatar) avatar.textContent = userState.username.charAt(0).toUpperCase();
      if (userName) userName.textContent = userState.username;
    } else {
      userNav.style.display = 'none';
    }
  }

  if (loginBtn) {
    loginBtn.style.display = userState.role === 'guest' ? 'flex' : 'none';
  }

  if (adminBtn) {
    adminBtn.style.display = hasPermission('admin') ? 'flex' : 'none';
  }

  if (favBtn) {
    favBtn.style.display = hasPermission('favorite') ? 'flex' : 'none';
  }

  // 更新收藏按钮状态
  updateFavoriteButtons();
}

// ==================== 收藏功能 ====================

/** 收藏操作锁，防止快速点击 */
const favoriteLocks = new Set();

/** 切换收藏 */
function toggleFavorite(modelName) {
  // 防止快速点击
  if (favoriteLocks.has(modelName)) return;
  favoriteLocks.add(modelName);

  requireLogin(() => {
    const idx = userState.favorites.indexOf(modelName);
    if (idx === -1) {
      userState.favorites.push(modelName);
      showToast('已收藏', 'success');
    } else {
      userState.favorites.splice(idx, 1);
      showToast('已取消收藏', 'info');
    }
    saveUserState();
    updateFavoriteButtons();
  });

  // 无论是否登录，都确保锁被释放
  setTimeout(() => favoriteLocks.delete(modelName), 300);
}

/** 更新所有收藏按钮的样式 */
function updateFavoriteButtons() {
  document.querySelectorAll('.fav-btn').forEach(btn => {
    const name = btn.dataset.modelName;
    const isFav = userState.favorites.includes(name);
    if (isFav) {
      btn.classList.add('active');
      btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.5"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>';
    } else {
      btn.classList.remove('active');
      btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>';
    }
    btn.setAttribute('aria-pressed', isFav);
    btn.setAttribute('aria-label', isFav ? '取消收藏' : '收藏');
  });
}

/** 渲染"我的收藏"页面 */
function renderFavorites() {
  const grid = document.getElementById('favModelGrid');
  const empty = document.getElementById('favEmptyState');
  const countEl = document.getElementById('favCount');

  if (!grid) return;

  const favModels = state.models.filter(m => userState.favorites.includes(m.name));

  if (countEl) countEl.textContent = favModels.length;

  if (!favModels || favModels.length === 0) {
    grid.style.display = 'none';
    if (empty) empty.style.display = 'block';
    return;
  }

  grid.style.display = 'grid';
  if (empty) empty.style.display = 'none';

  grid.innerHTML = favModels.map((m, index) => {
    const gradient = getCategoryGradient(m.category);
    return `
    <div class="model-card" onclick="showDetail(${m.id})"
         style="animation: fadeInUp 0.4s var(--ease-out) ${index * 0.05}s both;"
         role="button" tabindex="0"
         aria-label="${escapeHtml(m.name)}"
         onkeydown="if(event.key==='Enter') showDetail(${m.id})">
      <div class="card-visual" style="background: ${gradient};">
        <div class="card-visual-inner">
          <div class="card-visual-bar"></div>
          <div class="card-visual-bar"></div>
          <div class="card-visual-bar"></div>
          <div class="card-visual-bar"></div>
          <div class="card-visual-bar"></div>
        </div>
      </div>
      <div class="card-content">
        <div class="card-header">
          <span class="card-name">${escapeHtml(m.name)}</span>
          <span class="card-year">${m.year || ''}</span>
        </div>
        ${m.category ? `<span class="card-category">${escapeHtml(m.category)}</span>` : ''}
        <p class="card-desc">${escapeHtml(m.description || '')}</p>
        <div class="card-meta">
          ${m.architecture ? `<span><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg> ${escapeHtml(m.architecture)}</span>` : ''}
          ${m.parameters ? `<span><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> ${escapeHtml(m.parameters)}</span>` : ''}
        </div>
        <span class="card-enter-btn" onclick="event.stopPropagation(); navigate('model', {name: '${escapeHtml(m.name).replace(/'/g, "\\'")}'})">查看详情 &rarr;</span>
      </div>
    </div>
  `}).join('');
}

// ==================== 主题切换 ====================

/** 切换主题 */
function toggleTheme() {
  const html = document.documentElement;
  const current = html.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', next);
  safeSetItem(CONFIG.THEME_KEY, next);
  updateThemeIcon(next);
}

/** 页面加载时恢复主题 */
function restoreTheme() {
  try {
    const saved = localStorage.getItem(CONFIG.THEME_KEY) || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
    updateThemeIcon(saved);
  } catch (e) {
    console.warn('[Theme] 主题恢复失败:', e);
  }
}

/** 更新主题图标 */
function updateThemeIcon(theme) {
  const btn = document.getElementById('themeToggle');
  if (btn) btn.innerHTML = theme === 'dark'
    ? '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a.5.5 0 01.5.5v1a.5.5 0 01-1 0v-1A.5.5 0 018 1zm0 13a.5.5 0 01.5.5v1a.5.5 0 01-1 0v-1a.5.5 0 01.5-.5zM2 8h1a.5.5 0 010 1H2a.5.5 0 010-1zm11 0h1a.5.5 0 010 1h-1a.5.5 0 010-1zM4.22 3.81a.5.5 0 01.707 0l.7.7a.5.5 0 01-.707.707l-.7-.7a.5.5 0 010-.707zm7.07 8.49a.5.5 0 01.707 0l.7.7a.5.5 0 01-.707.707l-.7-.7a.5.5 0 010-.707zM1 7.5a.5.5 0 01.5-.5h1a.5.5 0 010 1h-1a.5.5 0 01-.5-.5zm13.07-1.07a.5.5 0 01.707 0l.7.7a.5.5 0 01-.707.707l-.7-.7a.5.5 0 010-.707zM5.93 10.93a.5.5 0 010-.707l.7-.7a.5.5 0 11.707.707l-.7.7a.5.5 0 01-.707 0zM8 5.5A2.5 2.5 0 1010.5 8 2.5 2.5 0 008 5.5zm0 1A1.5 1.5 0 119.5 8 1.5 1.5 0 018 6.5z"/></svg>'
    : '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M6 2a.5.5 0 01.5.5v1a.5.5 0 01-1 0v-1A.5.5 0 016 2zm3.1 1.2a.5.5 0 01.2.68l-.5.87a.5.5 0 11-.86-.5l.5-.87a.5.5 0 01.66-.18zM2.4 5.1a.5.5 0 01.36.85l-.7.71a.5.5 0 11-.71-.71l.7-.71a.5.5 0 01.35-.14zm9.2 0a.5.5 0 01.36.14l.7.71a.5.5 0 11-.71.71l-.7-.71a.5.5 0 01.35-.85zM1 8a.5.5 0 01.5-.5h1a.5.5 0 010 1h-1A.5.5 0 011 8zm12.5 0a.5.5 0 01.5-.5h1a.5.5 0 010 1h-1a.5.5 0 01-.5-.5zM3.05 11.05a.5.5 0 01.7 0l.71.7a.5.5 0 11-.7.71l-.71-.7a.5.5 0 010-.71zm8.5 0a.5.5 0 010 .71l-.71.7a.5.5 0 11-.7-.71l.7-.7a.5.5 0 01.71 0zM6 14a.5.5 0 01.5-.5h1a.5.5 0 010 1h-1A.5.5 0 016 14zm2.5-3A4.5 4.5 0 1114 6.5 4.5 4.5 0 018.5 11z"/></svg>';
}

// ==================== 数据管理 ====================

/** 加载模型数据（优先 localStorage，其次 models.json） */
async function loadModels() {
  // 强制刷新标志：如果 URL 中包含 ?refresh=true，则跳过缓存
  const forceRefresh = new URLSearchParams(location.search).get('refresh') === 'true';

  // 版本检查，不匹配时清除缓存
  try {
    const savedVersion = localStorage.getItem(CONFIG.STORAGE_VERSION_KEY);
    const savedData = localStorage.getItem(CONFIG.STORAGE_KEY);

    // 只有在有缓存数据且版本匹配时，才使用缓存
    if (!forceRefresh && savedVersion === CONFIG.DATA_VERSION && savedData) {
      try {
        const data = JSON.parse(savedData);
        if (Array.isArray(data) && data.length > 0) {
          console.log('[Data] 从 localStorage 缓存加载了', data.length, '个模型');
          return data;
        }
      } catch (e) {
        console.warn('localStorage 数据解析失败，清除缓存');
        localStorage.removeItem(CONFIG.STORAGE_KEY);
      }
    } else {
      // 版本不匹配或强制刷新，清除缓存
      localStorage.removeItem(CONFIG.STORAGE_KEY);
      localStorage.setItem(CONFIG.STORAGE_VERSION_KEY, CONFIG.DATA_VERSION);
    }
  } catch (e) {
    console.warn('localStorage 访问失败:', e);
    // 出错时也清除可能损坏的缓存
    try { localStorage.removeItem(CONFIG.STORAGE_KEY); } catch {}
  }

  // 从 models.json 加载
  try {
    console.log('[Data] 正在加载 models.json...');
    // 添加时间戳防止缓存
    const resp = await fetch('models.json?t=' + Date.now());
    if (resp.ok) {
      const data = await resp.json();
      if (Array.isArray(data) && data.length > 0) {
        console.log('[Data] 从 models.json 加载了', data.length, '个模型');
        try {
          localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(data));
          console.log('[Data] 数据已缓存到 localStorage');
        } catch (e) {
          console.warn('localStorage 保存失败（可能存储已满）:', e);
        }
        return data;
      } else {
        console.error('[Data] models.json 数据格式不正确或为空');
      }
    } else {
      console.error('[Data] models.json 加载失败，状态码:', resp.status);
    }
  } catch (e) {
    console.error('[Data] 无法加载 models.json:', e);
    // 如果是 file:// 协议，提示用户使用服务器
    if (location.protocol === 'file:') {
      console.error('[Data] 检测到 file:// 协议！请使用本地服务器运行本应用');
      console.error('[Data] 解决方案：');
      console.error('[Data] 1. 使用 npx serve（需要 Node.js）');
      console.error('[Data] 2. 使用 python -m http.server（需要 Python）');
      console.error('[Data] 3. 使用 VS Code Live Server 扩展');
    }
  }
  return [];
}

/** 保存模型数据到 localStorage */
function saveModels() {
  safeSetItem(CONFIG.STORAGE_KEY, JSON.stringify(state.models));
}

// ==================== 路由系统 ====================

/** 导航锁，防止快速切换视图时的竞态条件 */
let isNavigating = false;

/** 导航到指定视图 */
function navigate(view, params = {}) {
  // 防止快速切换视图时的竞态
  if (isNavigating) return;

  // 先关闭所有已打开的模态框，避免滚动锁定残留
  document.querySelectorAll('.modal-overlay.active').forEach(modal => {
    closeModal(modal.id);
  });

  // 先进行权限检查，避免无权限时已修改状态导致空白页
  if (view === 'favorites' && !hasPermission('favorite')) {
    showLoginModal(() => navigate('favorites'));
    return;
  }
  if (view === 'admin' && !hasPermission('admin')) {
    showLoginModal(() => navigate('admin'));
    return;
  }

  // 如果目标视图与当前视图相同，不重复导航
  if (state.currentView === view && JSON.stringify(params) === JSON.stringify(state.currentParams || {})) return;
  state.currentView = view;
  state.currentParams = params;

  // 查找当前活跃的视图元素
  const activeView = document.querySelector('.view.active');
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 更新导航按钮状态
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });

  if (activeView && !prefersReducedMotion) {
    isNavigating = true;
    let viewSwitched = false;
    const timeoutId = setTimeout(() => {
      isNavigating = false;
    }, 5000);
    activeView.classList.add('exiting');
    activeView.addEventListener('animationend', function onExitEnd() {
      clearTimeout(timeoutId);
      activeView.removeEventListener('animationend', onExitEnd);
      activeView.classList.remove('active', 'exiting');
      if (!viewSwitched) {
        viewSwitched = true;
        _showView(view, params);
      }
      isNavigating = false;
    }, { once: true });
    setTimeout(() => {
      if (activeView.classList.contains('exiting')) {
        activeView.classList.remove('active', 'exiting');
        if (!viewSwitched) {
          viewSwitched = true;
          _showView(view, params);
        }
      }
      isNavigating = false;
      clearTimeout(timeoutId);
    }, 300);
  } else {
    // 无活跃视图或用户偏好减少动画，直接切换
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    _showView(view, params);
  }
}

/** 显示目标视图（内部函数） */
function _showView(view, params) {
  requestAnimationFrame(() => {
    // 视图名称映射，用于屏幕阅读器播报
    const viewNames = {
      home: '首页',
      category: params.category ? `${params.category}分类` : '分类浏览',
      model: params.name ? `${params.name}详情` : '模型详情',
      favorites: '我的收藏',
      admin: '管理后台',
      compare: '模型对比',
      learningPath: '学习路径'
    };

    // 播报视图切换（无障碍支持）
    const announcer = document.getElementById('announcer');
    if (announcer) {
      announcer.textContent = `已切换到${viewNames[view] || view}`;
    }

    switch (view) {
      case 'home': {
        const el = document.getElementById('homeView');
        if (el) el.classList.add('active');
        renderHome();
        break;
      }

      case 'category':
        state.currentCategory = params.category || '';
        { const el = document.getElementById('categoryView'); if (el) el.classList.add('active'); }
        renderCategory(params.category);
        break;

      case 'model':
        { const el = document.getElementById('modelView'); if (el) el.classList.add('active'); }
        renderModelPage(params.name);
        break;

      case 'favorites':
        { const el = document.getElementById('favoritesView'); if (el) el.classList.add('active'); }
        renderFavorites();
        break;

      case 'admin':
        { const el = document.getElementById('adminView'); if (el) el.classList.add('active'); }
        renderAdminTable();
        break;

      case 'compare':
        { const el = document.getElementById('compareView'); if (el) el.classList.add('active'); }
        renderCompare();
        break;

      case 'learningPath':
        { const el = document.getElementById('learningPathView'); if (el) el.classList.add('active'); }
        renderLearningPath();
        break;
    }

    // 更新 URL hash
    updateURL(view, params);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

/** 更新浏览器 URL */
function updateURL(view, params = {}) {
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

/** 从 URL hash 解析路由 */
function parseHash() {
  const hash = window.location.hash.slice(1); // 去掉 #
  const parts = hash.split('/');

  if (parts[0] === 'category' && parts[1]) {
    return { view: 'category', params: { category: decodeURIComponent(parts[1]) } };
  }
  if (parts[0] === 'model' && parts[1]) {
    return { view: 'model', params: { name: decodeURIComponent(parts[1]) } };
  }
  if (parts[0] === 'admin') {
    return { view: 'admin', params: {} };
  }
  if (parts[0] === 'favorites') {
    return { view: 'favorites', params: {} };
  }
  if (parts[0] === 'compare') {
    return { view: 'compare', params: {} };
  }
  if (parts[0] === 'learningPath') {
    return { view: 'learningPath', params: {} };
  }
  return { view: 'home', params: {} };
}

// ==================== 首页 ====================

/** 渲染首页 */
function renderHome() {
  renderHeroStats();
  renderModuleGrid();
}

/** 渲染 Hero 区域统计数字 */
function renderHeroStats() {
  const models = state.models;
  const statsEl = document.getElementById('heroStats');

  if (models.length === 0) {
    if (statsEl) statsEl.style.display = 'none';
    return;
  }
  if (statsEl) statsEl.style.display = '';

  const categories = new Set(models.map(m => m.category).filter(Boolean));
  const years = models.map(m => m.year).filter(Boolean);
  const yearSpan = years.length > 1 ? Math.max(...years) - Math.min(...years) : 0;

  const targets = {
    statModels: models.length,
    statCategories: categories.size,
    statYears: yearSpan
  };

  // 使用 IntersectionObserver 触发计数动画
  const heroEl = document.querySelector('.hero');
  if (!heroEl) return;

  // 如果已经观察过，先取消
  if (heroEl._countObserver) {
    heroEl._countObserver.disconnect();
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        // 触发计数动画
        Object.entries(targets).forEach(([id, target]) => {
          animateCount(document.getElementById(id), target);
        });
        observer.disconnect();
      }
    });
  }, { threshold: 0.3 });

  observer.observe(heroEl);
  heroEl._countObserver = observer;
}

/** easeOutExpo 缓动函数 */
function easeOutExpo(t) {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

/** 计数动画：从 0 滚动到目标值 */
function animateCount(el, target) {
  if (!el) return;
  const duration = 1500; // 1.5s
  const startTime = performance.now();

  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const easedProgress = easeOutExpo(progress);
    const currentValue = Math.round(easedProgress * target);
    el.textContent = currentValue;

    if (progress < 1) {
      requestAnimationFrame(update);
    } else {
      el.textContent = target;
    }
  }

  requestAnimationFrame(update);
}

/* ==================== 字母小人系统（Duolingo 风格完整交互） ==================== */

// I10创新：个性化记忆系统
const LetterMemory = {
  _key: 'dl_letter_memory',
  _visitKey: 'dl_visit_count',
  
  getData() {
    try {
      return JSON.parse(localStorage.getItem(this._key) || '{}');
    } catch (e) { return {}; }
  },
  
  saveData(data) {
    try { safeSetItem(this._key, JSON.stringify(data)); } catch (e) {}
  },
  
  recordClick(letter) {
    const data = this.getData();
    data[letter] = (data[letter] || 0) + 1;
    this.saveData(data);
  },
  
  getFavoriteLetter() {
    const data = this.getData();
    let max = 0, fav = null;
    for (const [k, v] of Object.entries(data)) {
      if (v > max) { max = v; fav = k; }
    }
    return fav;
  },
  
  getVisitCount() {
    try { return parseInt(localStorage.getItem(this._visitKey) || '0', 10); } catch { return 0; }
  },

  incrementVisit() {
    const count = this.getVisitCount() + 1;
    safeSetItem(this._visitKey, String(count));
    return count;
  },
  
  shouldCelebrate() {
    return this.getVisitCount() > 0 && this.getVisitCount() % 5 === 0;
  }
};

// I20创新：声音反馈预留接口（默认静音）
const SoundEngine = {
  enabled: false,
  audioCtx: null,
  
  init() {
    try {
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      console.warn('Web Audio API not supported');
    }
  },
  
  // 播放合成音效
  play(type) {
    if (!this.enabled || !this.audioCtx) return;
    if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
    
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    osc.connect(gain);
    gain.connect(this.audioCtx.destination);
    
    switch (type) {
      case 'hover':
        osc.frequency.value = 440;
        osc.type = 'sine';
        gain.gain.value = 0.05;
        osc.start();
        osc.stop(this.audioCtx.currentTime + 0.1);
        break;
      case 'click':
        osc.frequency.value = 523;
        osc.type = 'sine';
        gain.gain.value = 0.08;
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.2);
        osc.stop(this.audioCtx.currentTime + 0.2);
        break;
      case 'scared':
        osc.frequency.value = 200;
        osc.type = 'sawtooth';
        gain.gain.value = 0.06;
        osc.start();
        osc.frequency.exponentialRampToValueAtTime(100, this.audioCtx.currentTime + 0.3);
        gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.3);
        osc.stop(this.audioCtx.currentTime + 0.3);
        break;
      case 'celebrate':
        // 播放两个音符
        osc.frequency.value = 523;
        osc.type = 'sine';
        gain.gain.value = 0.06;
        osc.start();
        osc.stop(this.audioCtx.currentTime + 0.15);
        const osc2 = this.audioCtx.createOscillator();
        const gain2 = this.audioCtx.createGain();
        osc2.connect(gain2);
        gain2.connect(this.audioCtx.destination);
        osc2.frequency.value = 659;
        osc2.type = 'sine';
        gain2.gain.value = 0.06;
        osc2.start(this.audioCtx.currentTime + 0.15);
        osc2.stop(this.audioCtx.currentTime + 0.3);
        break;
    }
  },
  
  toggle() {
    this.enabled = !this.enabled;
    if (this.enabled && !this.audioCtx) this.init();
    return this.enabled;
  }
};

// S9创新：截图分享功能
const ShareScreenshot = {
  // 触发特殊姿势排列
  triggerPose(stage) {
    const chars = stage.querySelectorAll('.letter-char');
    chars.forEach((el, i) => {
      el.style.transition = 'transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)';
      setTimeout(() => {
        // 波浪排列
        const yOffset = Math.sin(i * 0.8) * 15;
        const rotation = Math.sin(i * 0.6) * 5;
        el.style.transform = `translateY(${yOffset}px) rotate(${rotation}deg)`;
      }, i * 60);
    });
    
    // 3秒后恢复
    setTimeout(() => {
      chars.forEach(el => {
        el.style.transform = '';
        setTimeout(() => { el.style.transition = ''; }, 500);
      });
    }, 3000);
  }
};

// S8创新：字母自定义系统
const LetterCustomization = {
  STORAGE_KEY: 'letter-customizations',
  
  // 获取自定义配置
  getCustomizations() {
    try {
      return JSON.parse(localStorage.getItem(this.STORAGE_KEY)) || {};
    } catch (e) { return {}; }
  },
  
  // 保存自定义配置
  saveCustomizations(customizations) {
    safeSetItem(this.STORAGE_KEY, JSON.stringify(customizations));
  },
  
  // 自定义单个字母颜色
  setLetterColor(letterKey, color) {
    const customs = this.getCustomizations();
    if (!customs[letterKey]) customs[letterKey] = {};
    customs[letterKey].color = color;
    this.saveCustomizations(customs);
  },
  
  // 应用自定义配置到字母元素
  applyCustomizations(stage) {
    const customs = this.getCustomizations();
    const chars = stage.querySelectorAll('.letter-char');
    chars.forEach(el => {
      const key = el.getAttribute('data-letter');
      if (customs[key]) {
        if (customs[key].color) {
        const textEl = el.querySelector('.letter-text');
        if (textEl) textEl.style.color = customs[key].color;
      }
        if (customs[key].accessory) {
          const accessory = document.createElement('div');
          accessory.className = 'custom-accessory';
          accessory.textContent = customs[key].accessory;
          el.appendChild(accessory);
        }
      }
    });
  }
};

// I7创新：连续点击5次触发合唱
const ClickChorus = {
  sequence: [],
  timeout: null,
  resetDelay: 2000,

  record(char) {
    this.sequence.push(char);
    if (this.sequence.length >= 5) {
      this.triggerChorus();
      this.sequence = [];
    }
    if (this.timeout) clearTimeout(this.timeout);
    this.timeout = trackedSetTimeout(() => { this.sequence = []; }, this.resetDelay);
  },

  triggerChorus() {
    const stage = document.getElementById('letterStage');
    if (!stage) return;
    const chars = stage.querySelectorAll('.letter-char');
    chars.forEach((el, i) => {
      setTimeout(() => {
        el.classList.add('chorus-singing');
        spawnParticles(el, 3, 'note');
        setTimeout(() => el.classList.remove('chorus-singing'), 800);
      }, i * 50);
    });
  }
};

// S1创新：通用粒子系统引擎
const ParticleEngine = {
  particles: [],
  canvas: null,
  ctx: null,
  isRunning: false,
  
  // 初始化Canvas层
  init() {
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'particle-canvas';
    this.canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:100;';
    document.body.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this.resize();
    this._resizeHandler = () => this.resize();
    window.addEventListener('resize', this._resizeHandler);
  },
  
  // 调整Canvas尺寸
  resize() {
    if (!this.canvas) return;
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  },
  
  // 粒子类型配置
  types: {
    circle: { draw: (ctx, p) => { ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill(); } },
    star: { draw: (ctx, p) => { this.drawStar(ctx, p.x, p.y, 5, p.size, p.size / 2); } },
    heart: { draw: (ctx, p) => { this.drawHeart(ctx, p.x, p.y, p.size); } },
    note: { symbol: true, symbols: ['♪', '♫', '♬', '♩'] },
    spark: { draw: (ctx, p) => { ctx.beginPath(); ctx.moveTo(p.x - p.size, p.y); ctx.lineTo(p.x + p.size, p.y); ctx.moveTo(p.x, p.y - p.size); ctx.lineTo(p.x, p.y + p.size); ctx.stroke(); } },
    snow: { draw: (ctx, p) => { ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill(); } },
    confetti: { draw: (ctx, p) => { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rotation); ctx.fillRect(-p.size, -p.size / 2, p.size * 2, p.size); ctx.restore(); } }
  },
  
  // 绘制星形
  drawStar(ctx, cx, cy, spikes, outerR, innerR) {
    let rot = Math.PI / 2 * 3;
    const step = Math.PI / spikes;
    ctx.beginPath();
    ctx.moveTo(cx, cy - outerR);
    for (let i = 0; i < spikes; i++) {
      ctx.lineTo(cx + Math.cos(rot) * outerR, cy + Math.sin(rot) * outerR);
      rot += step;
      ctx.lineTo(cx + Math.cos(rot) * innerR, cy + Math.sin(rot) * innerR);
      rot += step;
    }
    ctx.closePath();
    ctx.fill();
  },
  
  // 绘制心形
  drawHeart(ctx, cx, cy, size) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.beginPath();
    ctx.moveTo(0, size * 0.3);
    ctx.bezierCurveTo(-size, -size * 0.3, -size * 0.5, -size, 0, -size * 0.5);
    ctx.bezierCurveTo(size * 0.5, -size, size, -size * 0.3, 0, size * 0.3);
    ctx.fill();
    ctx.restore();
  },
  
  // 发射粒子
  emit(config) {
    if (!this.canvas) this.init();
    
    const {
      x, y,                    // 发射位置
      count = 5,               // 数量
      type = 'circle',         // 粒子类型
      color = 'rgba(255,255,255,0.8)',  // 颜色
      size = 4,                // 大小
      sizeVariation = 2,       // 大小随机范围
      speed = 3,               // 速度
      speedVariation = 2,      // 速度随机范围
      angle = 0,               // 发射角度（弧度）
      spread = Math.PI * 2,    // 扩散角度
      gravity = 0.1,           // 重力
      friction = 0.98,         // 摩擦力
      life = 60,               // 生命周期（帧数）
      lifeVariation = 20,      // 生命周期随机范围
      rotationSpeed = 0,       // 旋转速度（confetti用）
      fadeOut = true           // 是否淡出
    } = config;
    
    for (let i = 0; i < count; i++) {
      const a = angle - spread / 2 + Math.random() * spread;
      const s = speed + (Math.random() - 0.5) * speedVariation * 2;
      const l = life + (Math.random() - 0.5) * lifeVariation * 2;
      const sz = Math.max(1, size + (Math.random() - 0.5) * sizeVariation * 2);
      
      this.particles.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        size: sz,
        color,
        type,
        life: Math.max(10, l),
        maxLife: Math.max(10, l),
        gravity,
        friction,
        rotation: 0,
        rotationSpeed: rotationSpeed * (Math.random() - 0.5) * 2,
        fadeOut,
        symbol: this.types[type]?.symbol ? this.types[type].symbols[Math.floor(Math.random() * this.types[type].symbols.length)] : null
      });
    }
    
    if (!this.isRunning) {
      this.isRunning = true;
      this.animate();
    }
  },
  
  // 动画循环
  animate() {
    if (!this.ctx) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      
      // 物理更新
      p.vy += p.gravity;
      p.vx *= p.friction;
      p.vy *= p.friction;
      p.x += p.vx;
      p.y += p.vy;
      p.rotation += p.rotationSpeed;
      p.life--;
      
      // 计算透明度
      const alpha = p.fadeOut ? Math.max(0, p.life / p.maxLife) : 1;
      
      // 绘制
      this.ctx.save();
      this.ctx.globalAlpha = alpha;
      this.ctx.fillStyle = p.color;
      this.ctx.strokeStyle = p.color;
      this.ctx.lineWidth = 2;
      
      if (p.symbol) {
        // 符号类型粒子
        this.ctx.font = `${p.size * 3}px sans-serif`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(p.symbol, p.x, p.y);
      } else if (this.types[p.type]?.draw) {
        // 自定义绘制
        this.types[p.type].draw(this.ctx, p);
      }
      
      this.ctx.restore();
      
      // 移除死亡粒子（swap-and-pop，O(1)）
      if (p.life <= 0) {
        this.particles[i] = this.particles[this.particles.length - 1];
        this.particles.pop();
      }
    }
    
    if (this.particles.length > 0) {
      requestAnimationFrame(() => this.animate());
    } else {
      this.isRunning = false;
    }
  },
  
  // 便捷发射方法
  burst(x, y, count = 10, type = 'circle', color = 'rgba(255,255,255,0.8)') {
    this.emit({ x, y, count, type, color, speed: 5, spread: Math.PI * 2, life: 40 });
  },
  
  confetti(x, y, count = 20) {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE'];
    for (let i = 0; i < count; i++) {
      this.emit({
        x, y, count: 1, type: 'confetti',
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 5, speed: 4 + Math.random() * 3,
        spread: Math.PI * 2, gravity: 0.15,
        life: 80 + Math.random() * 40,
        rotationSpeed: 0.2
      });
    }
  },
  
  hearts(x, y, count = 8) {
    this.emit({ x, y, count, type: 'heart', color: '#FF6B6B', size: 6, speed: 3, spread: Math.PI, angle: -Math.PI / 2, gravity: -0.05, life: 60 });
  },
  
  stars(x, y, count = 8) {
    this.emit({ x, y, count, type: 'star', color: '#FFD700', size: 5, speed: 4, spread: Math.PI * 2, gravity: 0.05, life: 50 });
  },
  
  snow(x, y, count = 15) {
    for (let i = 0; i < count; i++) {
      this.emit({
        x: x + (Math.random() - 0.5) * 200, y: y - 20,
        count: 1, type: 'snow', color: 'rgba(255,255,255,0.8)',
        size: 2 + Math.random() * 3, speed: 0.5,
        spread: Math.PI * 2, gravity: 0.02, friction: 0.99,
        life: 120 + Math.random() * 60
      });
    }
  },
  
  // 清理
  destroy() {
    this.particles = [];
    this.isRunning = false;
    if (this._resizeHandler) {
      window.removeEventListener('resize', this._resizeHandler);
      this._resizeHandler = null;
    }
    if (this.canvas) {
      this.canvas.remove();
      this.canvas = null;
      this.ctx = null;
    }
  }
};

window.ParticleEngine = ParticleEngine;

// S3创新：表情混合系统
const EmotionBlender = {
  // 情绪参数定义（归一化到0-1）
  emotionParams: {
    neutral:  { eyeOpen: 1.0, pupilScale: 1.0, mouthWidth: 1.0, mouthHeight: 0,   bodyTilt: 0,   blush: 0,   eyeRotation: 0 },
    happy:    { eyeOpen: 0.6, pupilScale: 1.1, mouthWidth: 1.3, mouthHeight: 0.8, bodyTilt: 0,   blush: 0.6, eyeRotation: 0 },
    surprised:{ eyeOpen: 1.3, pupilScale: 0.8, mouthWidth: 0.8, mouthHeight: 1.2, bodyTilt: 0,   blush: 0,   eyeRotation: 0 },
    sad:      { eyeOpen: 0.7, pupilScale: 0.9, mouthWidth: 0.7, mouthHeight: 0.3, bodyTilt: 3,   blush: 0,   eyeRotation: 0 },
    scared:   { eyeOpen: 1.4, pupilScale: 0.7, mouthWidth: 0.6, mouthHeight: 0.9, bodyTilt: -2,  blush: 0,   eyeRotation: 0 },
    curious:  { eyeOpen: 1.1, pupilScale: 1.1, mouthWidth: 0.6, mouthHeight: 0.2, bodyTilt: 0,   blush: 0,   eyeRotation: 0 },
    bored:    { eyeOpen: 0.5, pupilScale: 0.6, mouthWidth: 0.5, mouthHeight: 0,   bodyTilt: 3,   blush: 0,   eyeRotation: 3 },
    sleepy:   { eyeOpen: 0.4, pupilScale: 0.8, mouthWidth: 0.8, mouthHeight: 0.5, bodyTilt: 2,   blush: 0,   eyeRotation: 0 },
    excited:  { eyeOpen: 1.2, pupilScale: 1.2, mouthWidth: 1.4, mouthHeight: 1.0, bodyTilt: 0,   blush: 0.4, eyeRotation: 0 },
  },
  
  // 混合两种情绪
  blend(emotion1, emotion2, weight1 = 0.5, weight2 = 0.5) {
    const p1 = this.emotionParams[emotion1];
    const p2 = this.emotionParams[emotion2];
    if (!p1 || !p2) return null;
    
    const total = weight1 + weight2;
    const w1 = weight1 / total;
    const w2 = weight2 / total;
    
    const blended = {};
    for (const key of Object.keys(p1)) {
      blended[key] = p1[key] * w1 + p2[key] * w2;
    }
    return blended;
  },
  
  // 将混合参数应用到字母元素
  applyBlended(s, params) {
    if (!params) return;
    
    // 眼睛开合度
    const eyeScaleY = params.eyeOpen;
    s.eyes.forEach(e => {
      e.style.transform = `scaleY(${eyeScaleY})`;
      e.style.transition = 'transform 0.3s ease';
    });
    
    // 瞳孔大小
    s.pupils.forEach(p => {
      p.style.setProperty('--pupil-scale', params.pupilScale);
    });
    s.pupilScale = params.pupilScale;
    
    // 身体倾斜
    if (params.bodyTilt !== 0) {
      s.el.querySelector('.letter-body').style.transform = `rotate(${params.bodyTilt}deg)`;
    }
    
    // 腮红
    const blushOpacity = params.blush;
    s.el.querySelectorAll('.letter-blush').forEach(b => {
      b.style.opacity = blushOpacity;
      b.style.transition = 'opacity 0.3s ease';
    });

    // 嘴巴大小
    if (params.mouthWidth !== undefined) {
      const mouth = s.el.querySelector('.letter-mouth');
      if (mouth) mouth.style.transform = `scaleX(${params.mouthWidth}) scaleY(${params.mouthHeight})`;
    }

    // 眼睛旋转
    if (params.eyeRotation !== undefined) {
      s.eyes.forEach(e => {
        e.style.transform = `scaleY(${params.eyeOpen}) rotate(${params.eyeRotation}deg)`;
        e.style.transition = 'transform 0.3s ease';
      });
    }
  },
  
  // 混合并应用
  setBlendedEmotion(s, emotion1, emotion2, weight1 = 0.5, weight2 = 0.5) {
    const params = this.blend(emotion1, emotion2, weight1, weight2);
    if (params) {
      s.blendedEmotion = true;
      this.applyBlended(s, params);
    }
  },
  
  // 清除混合，恢复普通情绪
  clearBlended(s) {
    s.blendedEmotion = false;
    s.eyes.forEach(e => { e.style.transform = ''; e.style.transition = ''; });
    s.pupils.forEach(p => { p.style.setProperty('--pupil-scale', 1); });
    s.pupilScale = 1;
    const body = s.el.querySelector('.letter-body');
    if (body) body.style.transform = '';
    s.el.querySelectorAll('.letter-blush').forEach(b => { b.style.opacity = ''; b.style.transition = ''; });
    const mouth = s.el.querySelector('.letter-mouth');
    if (mouth) mouth.style.transform = '';
  }
};

window.EmotionBlender = EmotionBlender;

// S4创新：时间感知系统
const TimeAwareness = {
  getTimePhase() {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 12) return 'morning';   // 早晨精力充沛
    if (hour >= 12 && hour < 14) return 'noon';     // 午后犯困
    if (hour >= 14 && hour < 18) return 'afternoon'; // 下午平稳
    if (hour >= 18 && hour < 22) return 'evening';   // 傍晚放松
    return 'night'; // 深夜
  },

  getAnimationIntensity() {
    const phase = this.getTimePhase();
    const intensities = { morning: 1.2, noon: 0.7, afternoon: 1.0, evening: 0.85, night: 0.6 };
    return intensities[phase];
  },

  getLazyFrequency() {
    const phase = this.getTimePhase();
    const frequencies = { morning: 1.5, noon: 0.6, afternoon: 1.0, evening: 0.8, night: 0.4 };
    return frequencies[phase];
  }
};

const LETTER_CONFIGS = [
  { letter: 'D',  key: 'D',  delay: 0 },
  { letter: 'e',  key: 'e',  delay: 0.08 },
  { letter: 'e',  key: 'e2', delay: 0.16 },
  { letter: 'p',  key: 'p',  delay: 0.24 },
  { letter: ' ',  key: null, delay: 0 },
  { letter: 'L',  key: 'L',  delay: 0.40 },
  { letter: 'e',  key: 'e3', delay: 0.48 },
  { letter: 'a',  key: 'a',  delay: 0.56 },
  { letter: 'r',  key: 'r',  delay: 0.64 },
  { letter: 'n',  key: 'n',  delay: 0.72 },
  { letter: 'i',  key: 'i',  delay: 0.80 },
  { letter: 'n',  key: 'n2', delay: 0.88 },
  { letter: 'g',  key: 'g',  delay: 0.96 },
];

function createLetterChar(config, index = 0, total = 1) {
  if (!config.key) {
    const space = document.createElement('div');
    space.className = 'letter-space';
    return space;
  }
  const char = document.createElement('div');
  char.className = 'letter-char';
  char.setAttribute('data-letter', config.key);
  
  // A1创新：入场叙事动画
  let entranceAnimation = 'letterBounceIn';
  let entranceDuration = 0.8;
  
  if (index === 0) {
    // D字母领袖隆重登场
    entranceAnimation = 'letterHeroEntrance';
    entranceDuration = 1.0;
  } else if (index > 0 && index < total - 1) {
    // 中间字母被吵醒入场
    entranceAnimation = 'letterWakeEntrance';
    entranceDuration = 0.9;
  }
  
  char.style.animation = `${entranceAnimation} ${entranceDuration}s cubic-bezier(0.34, 1.56, 0.64, 1) ${config.delay}s both`;
  char.innerHTML = `
    <div class="letter-body">
      <span class="letter-text">${config.letter}</span>
      <div class="letter-eyes" aria-hidden="true">
        <div class="letter-eye"><div class="letter-pupil"></div></div>
        <div class="letter-eye"><div class="letter-pupil"></div></div>
      </div>
      <div class="letter-mouth" aria-hidden="true"></div>
      <div class="letter-blush" aria-hidden="true"></div>
      <div class="letter-blush" aria-hidden="true"></div>
      <div class="letter-arm left" aria-hidden="true"></div>
      <div class="letter-arm right" aria-hidden="true"></div>
    </div>
    <div class="letter-shadow" aria-hidden="true"></div>`;
  // 无障碍支持
  char.setAttribute('tabindex', '0');
  char.setAttribute('role', 'button');
  char.setAttribute('aria-label', `字母${config.key}，点击或按Enter键查看互动效果`);
  return char;
}

function initLetterStage() {
  const stage = document.getElementById('letterStage');
  if (!stage) return;
  
  // A1创新：计算总字母数，用于入场叙事动画
  const letterConfigs = LETTER_CONFIGS.filter(c => c.key);
  const totalLetters = letterConfigs.length;
  
  LETTER_CONFIGS.forEach((c, i) => {
    const index = letterConfigs.indexOf(c);
    stage.appendChild(createLetterChar(c, index, totalLetters));
  });
  
  // I12创新：节日装饰系统
  applyHolidayDecorations(stage);
  
  // S8创新：应用字母自定义配置
  LetterCustomization.applyCustomizations(stage);
  
  // S9创新：暴露截图分享功能到全局
  window.ShareScreenshot = ShareScreenshot;
  
  // I20创新：初始化声音引擎并暴露到全局
  SoundEngine.init();
  window.SoundEngine = SoundEngine;
  ParticleEngine.init();
  
  initLetterSystem(stage);

  // I10创新：入场动画完成后检查庆祝
  const maxDelay = Math.max(...LETTER_CONFIGS.map(c => c.delay || 0));
  const totalAnimTime = (maxDelay + 0.8) * 1000 + 200;
  let celebrationTimer = setTimeout(() => {
    const favLetter = LetterMemory.getFavoriteLetter();
    if (LetterMemory.shouldCelebrate()) {
      // 每5次访问庆祝：所有字母开心跳跃
      const chars = stage.querySelectorAll('.letter-char');
      chars.forEach(el => {
        el.style.animation = 'letterBounceIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)';
        setTimeout(() => { el.style.animation = ''; }, 600);
      });
    }
    if (favLetter) {
      // 最爱字母特殊高亮
      const favEl = stage.querySelector(`[data-letter="${favLetter}"]`);
      if (favEl) {
        favEl.style.animation = 'letterBounceIn 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)';
        setTimeout(() => { favEl.style.animation = ''; }, 800);
      }
    }
  }, totalAnimTime);
  if (!window.LetterSystem) window.LetterSystem = {};
  window.LetterSystem._celebrationTimer = celebrationTimer;
}

function initLetterSystem(stage) {
  // I8创新：深夜模式自动sleepy（22:00-06:00）
  const hour = new Date().getHours();
  const isNightTime = hour >= 22 || hour < 6;

  let prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const motionMediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const chars = Array.from(stage.querySelectorAll('.letter-char'));
  if (!chars.length) return;

  // ===== 交互开关配置（可由用户控制）=====
  const interactionConfig = {
    lazyActions: true,      // 偷懒动作（总开关）
    socialInteractions: true, // 社交互动（总开关）
    snakeFollow: true,      // 排队跟随
    scaredBounce: true,     // 吓退弹跳
    eyeTracking: true,      // 眼球跟随
    bodyReaction: true,     // 身体反应
    squashStretch: true,    // 按住压扁
    // 鼠标交互子开关
    hover: true,            // hover 交互
    clickGaze: true,        // 点击注视
    // 偷懒动作子开关
    lazyNodOff: true,       // 打瞌睡
    lazyStretch: true,      // 伸懒腰
    lazyYawn: true,         // 打哈欠
    lazyZoneOut: true,      // 走神
    lazyPeek: true,         // 偷看
    lazyRubEyes: true,      // 揉眼睛
    // 社交互动子开关
    socialWhisper: true,    // 窃窃私语
    socialEyeContact: true, // 传递眼神
    socialCelebrate: true,  // 庆祝跳跃
  };
  // 使用单一命名空间对象，避免全局污染
  if (!window.LetterSystem) window.LetterSystem = {};
  window.LetterSystem.config = interactionConfig;

  // ============================================================
  // 第一部分：状态机初始化
  // 每个字母只有一个活跃状态：'idle' | 'hover' | 'lazy' | 'social' | 'scared'
  // ============================================================
  const states = chars.map((el, i) => ({
    el, index: i,
    pupils: el.querySelectorAll('.letter-pupil'),
    eyes: el.querySelectorAll('.letter-eye'),
    body: el.querySelector('.letter-body'),
    shadow: el.querySelector('.letter-shadow'),
    // 当前状态（互斥）
    state: 'idle', // 'idle' | 'hover' | 'lazy' | 'social' | 'scared'
    // 动画目标值（rAF 使用）
    tx: 0, ty: 0, tr: 0, ts: 1,
    cx: 0, cy: 0, cr: 0, cs: 1,
    // I1创新：弹簧速度属性
    vx: 0, vy: 0, vr: 0, vs: 0,
    // 定时器
    lazyTimer: null,
    socialTimer: null,
    talkingTimer: null,
    // 情绪（用于表情）
    emotion: 'neutral',
    // 缓存瞳孔缩放值，避免rAF中频繁调用getComputedStyle
    pupilScale: 1,
    // 吓退触发标记
    scaredTriggered: false,
    // I8创新：深夜模式标记
    nightMode: isNightTime,
  }));

  // 全局鼠标状态
  let mouseX = window.innerWidth / 2, mouseY = window.innerHeight / 2;
  let lastMouseMove = Date.now();
  let rafId = null;
  let isPaused = false;
  let isDestroyed = false; // 销毁标志，防止定时器继续执行
  let mouseSpeed = 0;
  let lastMouseMoveTime = Date.now(); // 用于计算真实速度

  // 追踪所有活跃的 rAF 回调 ID（用于清理）
  const activeRafIds = new Set();

  // 常量定义（避免魔法数字）
  const CACHE_THROTTLE_MS = 100;
  const SCARED_DISTANCE_THRESHOLD = 80;
  const SCARED_RECOVERY_DISTANCE = 120;
  const LERP_FACTOR = 0.1;
  const MOUSE_SPEED_THRESHOLD = 40;
  const MOUSE_SLOW_THRESHOLD = 15;
  const ROTATION_START_DISTANCE = 50;
  const PUSH_DISTANCE_THRESHOLD = 150;
  const CURIOUS_DISTANCE_MIN = 100;
  const CURIOUS_DISTANCE_MAX = 200;
  const SNAKE_TRIGGER_FRAMES = 3;
  const SNAKE_COOLDOWN_MS = 3000;
  const SNAKE_MAX_DURATION_MS = 3000;
  // I1创新：弹簧物理参数
  const SPRING_STIFFNESS = 0.15;
  const SPRING_DAMPING = 0.75;
  // I3创新：瞳孔追踪统一参数
  const PUPIL_DISTANCE_FACTOR = 0.008;
  const PUPIL_MAX_OFFSET = 4;

  // A20创新：扩展缓动函数库（供JS驱动动画使用，如社交互动、惊醒弹跳等场景）
  // 使用示例：const progress = EASINGS.bounce(elapsed / duration); value = start + (end - start) * progress;
  const EASINGS = {
    bounce: t => {
      const n1 = 7.5625, d1 = 2.75;
      if (t < 1 / d1) return n1 * t * t;
      if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
      if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
      return n1 * (t -= 2.625 / d1) * t + 0.984375;
    },
    elastic: t => t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI / 3)) + 1,
    heavy: t => { const c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
    float: t => Math.sin(t * Math.PI * 0.5) * (1 - Math.sin(t * Math.PI * 0.5) * 0.3),
    snap: t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
    glide: t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
  };

  // 元素位置缓存
  const cachedPositions = new WeakMap();
  let lastCacheUpdate = 0;

  function updatePositionCache() {
    const now = Date.now();
    if (now - lastCacheUpdate < CACHE_THROTTLE_MS) return;
    lastCacheUpdate = now;
    states.forEach(s => {
      const rect = s.el.getBoundingClientRect();
      cachedPositions.set(s.el, {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        cx: rect.left + rect.width / 2,
        cy: rect.top + rect.height * 0.2
      });
    });
  }

  // 获取缓存位置的辅助函数
  function getCachedPosition(el) {
    let pos = cachedPositions.get(el);
    if (!pos) {
      updatePositionCache();
      pos = cachedPositions.get(el);
    }
    return pos || { left: 0, top: 0, width: 0, height: 0, cx: 0, cy: 0 };
  }

  // ===== 定时器追踪（用于清理）=====
  const allTimers = new Set();
  const originalSetTimeout = window.setTimeout;
  const trackedSetTimeout = (fn, delay) => {
    const wrappedFn = () => {
      if (isDestroyed) return; // 已销毁则不执行
      try {
        fn();
      } catch (e) {
        console.warn('LetterSystem timer error:', e);
      }
    };
    const id = originalSetTimeout(wrappedFn, delay);
    allTimers.add(id);
    return id;
  };
  const trackedClearTimeout = (id) => {
    if (id === null || id === undefined) return;
    allTimers.delete(id);
    return clearTimeout(id);
  };

  // ===== setInterval 追踪（用于清理）=====
  const allIntervals = new Set();
  const trackedSetInterval = (fn, delay) => {
    const wrappedFn = () => {
      if (isDestroyed) return;
      try {
        fn();
      } catch (e) {
        console.warn('LetterSystem interval error:', e);
      }
    };
    const id = setInterval(wrappedFn, delay);
    allIntervals.add(id);
    return id;
  };
  const trackedClearInterval = (id) => {
    if (id === null || id === undefined) return;
    allIntervals.delete(id);
    return clearInterval(id);
  };

  // ===== 动画优先级管理：检测是否有CSS动画在运行 =====
  function hasCssAnimation(el) {
    // 检查元素自身是否有CSS动画（内联style或CSS class）
    const style = window.getComputedStyle(el);
    const hasAnimation = style.animationName && style.animationName !== 'none';
    if (hasAnimation) return true;
    // 检查关键子元素是否有CSS动画
    const animatedChildren = el.querySelectorAll('.letter-arm, .letter-mouth, .letter-pupil, .letter-eye');
    for (const child of animatedChildren) {
      const childStyle = window.getComputedStyle(child);
      if (childStyle.animationName && childStyle.animationName !== 'none') return true;
    }
    return false;
  }

  // ===== prefers-reduced-motion 变化监听 =====
  function handleMotionPreferenceChange(e) {
    prefersReducedMotion = e.matches;
    if (prefersReducedMotion) {
      // 用户偏好减少动画：完全停止rAF动画
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
      activeRafIds.forEach(id => cancelAnimationFrame(id));
      activeRafIds.clear();
      // 清除所有CSS动画
      states.forEach(s => {
        s.el.style.animation = '';
        s.el.classList.remove('waving-goodbye', 'rubbing-eyes', 'stretching', 'peeking-at-chat');
        s.el.style.transform = '';
        if (s.body) s.body.style.transform = '';
        if (s.shadow) { s.shadow.style.transform = ''; s.shadow.style.opacity = ''; s.shadow.style.filter = ''; }
      });
    } else if (!isPaused && !isDestroyed) {
      // 用户允许动画：重新启动
      if (!rafId) rafId = requestAnimationFrame(animate);
      states.forEach(s => {
        if (s.state === 'idle') startIdleAnimation(s);
      });
    }
  }
  motionMediaQuery.addEventListener('change', handleMotionPreferenceChange);

  // ===== visibilitychange 处理 =====
  function handleVisibilityChange() {
    if (document.hidden) {
      isPaused = true;
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
      // 取消所有活跃的rAF
      activeRafIds.forEach(id => cancelAnimationFrame(id));
      activeRafIds.clear();
      // 暂停所有 interval 和 timeout
      allIntervals.forEach(id => clearInterval(id));
      allIntervals.clear();
      allTimers.forEach(id => clearTimeout(id));
      allTimers.clear();
    } else {
      isPaused = false;
      lastMouseMove = Date.now();
      if (!prefersReducedMotion && !isDestroyed) rafId = requestAnimationFrame(animate);
      // 重新调度 idle 状态字母的 lazy
      states.forEach(s => {
        if (s.state === 'idle') scheduleLazy(s);
      });
      // I9创新：页面重新可见时集体看向屏幕中心
      trackedSetTimeout(() => {
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;
        states.forEach(s => {
          if (s.state !== 'idle' && s.state !== 'hover') return;
          const pos = getCachedPosition(s.el);
          const dx = centerX - pos.cx;
          const dy = centerY - pos.cy;
          const angle = Math.atan2(dy, dx);
          const dist = Math.min(Math.sqrt(dx * dx + dy * dy) * PUPIL_DISTANCE_FACTOR, PUPIL_MAX_OFFSET);
          const ox = Math.cos(angle) * dist;
          const oy = Math.sin(angle) * dist;
          s.pupils.forEach(p => {
            p.style.transform = `translate(calc(-50% + ${ox}px), calc(-50% + ${oy}px)) scale(${s.pupilScale})`;
            p.style.transition = 'transform 0.5s ease';
          });
          // 1.5秒后恢复
          trackedSetTimeout(() => {
            s.pupils.forEach(p => { p.style.transition = ''; });
          }, 1500);
        });
      }, 300);
    }
  }
  document.addEventListener('visibilitychange', handleVisibilityChange);

  // ===== 清理函数 =====
  function destroyLetterSystem() {
    isDestroyed = true; // 设置销毁标志
    ParticleEngine.destroy();
    // 取消主 rAF
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    // 取消所有活跃的rAF（包括animateWake, animateJump, checkDist, updateSnake等）
    activeRafIds.forEach(id => cancelAnimationFrame(id));
    activeRafIds.clear();
    // 取消鼠标/触摸节流rAF
    if (mouseMoveRafId) { cancelAnimationFrame(mouseMoveRafId); mouseMoveRafId = null; }
    if (touchMoveRafId) { cancelAnimationFrame(touchMoveRafId); touchMoveRafId = null; }
    // 清除所有定时器
    allTimers.forEach(id => clearTimeout(id));
    allTimers.clear();
    // 清除所有 interval
    allIntervals.forEach(id => clearInterval(id));
    allIntervals.clear();
    // 移除事件监听
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    document.removeEventListener('mousemove', handleMouseMove);
    // 移除触摸事件监听
    document.removeEventListener('touchmove', handleTouchMove);
    document.removeEventListener('touchstart', handleTouchStart);
    // 移除 prefers-reduced-motion 监听
    motionMediaQuery.removeEventListener('change', handleMotionPreferenceChange);
    // 断开 IntersectionObserver
    if (goodbyeObserver) goodbyeObserver.disconnect();
    // 关闭 AudioContext
    if (SoundEngine.audioCtx && SoundEngine.audioCtx.state !== 'closed') {
      SoundEngine.audioCtx.close();
    }
    // 移除字母元素上的事件监听器（通过克隆元素替换，自动移除所有监听器）
    chars.forEach((el) => {
      const newEl = el.cloneNode(true);
      if (el.parentNode) {
        el.parentNode.replaceChild(newEl, el);
      }
    });
    if (window.LetterSystem._celebrationTimer) {
      clearTimeout(window.LetterSystem._celebrationTimer);
      window.LetterSystem._celebrationTimer = null;
    }
    // 清理状态
    states.forEach(s => {
      s.el.style.animation = '';
      s.el.style.transform = '';
      s.el.classList.remove('waving-goodbye', 'rubbing-eyes', 'stretching', 'peeking-at-chat');
      if (s.body) s.body.style.transform = '';
      if (s.shadow) { s.shadow.style.transform = ''; s.shadow.style.opacity = ''; s.shadow.style.filter = ''; }
      // 清理所有定时器引用
      if (s.lazyTimer) { s.lazyTimer = null; }
      if (s.socialTimer) { s.socialTimer = null; }
      // 清理talking定时器
      if (s.talkingTimer) {
        clearInterval(s.talkingTimer);
        s.talkingTimer = null;
      }
    });
  }
  // 暴露清理函数到命名空间
  window.LetterSystem.destroy = destroyLetterSystem;

  // ============================================================
  // I11创新：滚动告别动画
  // ============================================================
  let hasWavedGoodbye = false;
  const goodbyeObserver = new IntersectionObserver((entries) => {
    if (prefersReducedMotion) return;
    entries.forEach(entry => {
      // 字母舞台即将离开视口（可见度低于20%）
      if (entry.intersectionRatio < 0.2 && !hasWavedGoodbye) {
        hasWavedGoodbye = true;
        // 触发挥手告别
        states.forEach((s, i) => {
          if (s.state !== 'idle') return;
          trackedSetTimeout(() => {
            // 添加挥手动画
            s.el.classList.add('waving-goodbye');
            setEmotion(s, 'sad');
            // 1秒后恢复
            trackedSetTimeout(() => {
              s.el.classList.remove('waving-goodbye');
              setEmotion(s, 'neutral');
            }, 1000);
          }, i * 80);
        });
      }
      // 重新进入视口时重置
      if (entry.intersectionRatio > 0.5) {
        hasWavedGoodbye = false;
      }
    });
  }, { threshold: [0.1, 0.2, 0.5, 0.8] });
  
  goodbyeObserver.observe(stage);

  // ============================================================
  // 第二部分：状态转换函数（显式进入/退出）
  // ============================================================

  /** 进入 hover 状态 */
  function enterHover(s) {
    if (s.state === 'hover') return;
    exitState(s); // 先退出当前状态
    s.state = 'hover';
    stopIdleAnimation(s);
    setEmotion(s, 'happy');
    SoundEngine.play('hover');
  }

  /** 退出 hover 状态 */
  function exitHover(s) {
    if (s.state !== 'hover') return;
    s.state = 'idle';
    setEmotion(s, 'neutral');
    startIdleAnimation(s);
    scheduleLazy(s);
  }

  /** 进入 lazy 状态 */
  function enterLazy(s, action) {
    if (s.state === 'lazy') return;
    exitState(s);
    s.state = 'lazy';
    stopIdleAnimation(s);
    action(s);
  }

  /** 退出 lazy 状态 */
  function exitLazy(s) {
    if (s.state !== 'lazy') return;
    trackedClearTimeout(s.lazyTimer);
    s.lazyTimer = null;
    const wasSleepy = s.emotion === 'sleepy';
    s.state = 'idle';
    setEmotion(s, 'neutral');
    // 重置瞳孔 transition
    s.pupils.forEach(p => { p.style.transition = ''; });
    s.el.classList.remove('rubbing-eyes', 'stretching');
    // 唤醒动画（使用EASINGS.elastic驱动弹性效果）
    const wakeDuration = 400;
    const wakeStart = performance.now();
    let wakeRafId = null;
    function animateWake(now) {
      if (isDestroyed) { if (wakeRafId) activeRafIds.delete(wakeRafId); return; }
      const elapsed = now - wakeStart;
      const t = Math.min(elapsed / wakeDuration, 1);
      const elastic = EASINGS.elastic(t);
      s.el.style.transform = `scaleY(${0.9 + 0.25 * elastic}) translateY(${-10 * elastic}px)`;
      if (t < 1) {
        wakeRafId = requestAnimationFrame(animateWake);
        activeRafIds.add(wakeRafId);
      } else {
        s.el.style.transform = '';
        if (wakeRafId) activeRafIds.delete(wakeRafId);
      }
    }
    wakeRafId = requestAnimationFrame(animateWake);
    activeRafIds.add(wakeRafId);
    trackedSetTimeout(() => {
      s.el.style.animation = '';
      // 从打瞌睡醒来后30%概率揉眼睛
      if (wasSleepy && Math.random() < 0.3) {
        enterLazy(s, LAZY_ACTIONS[5]); // 揉眼睛
      } else {
        startIdleAnimation(s);
        scheduleLazy(s);
      }
    }, 400);
  }

  /** 进入 social 状态 */
  function enterSocial(s) {
    if (s.state === 'social') return;
    exitState(s);
    s.state = 'social';
    stopIdleAnimation(s);
  }

  /** 退出 social 状态 */
  function exitSocial(s) {
    if (s.state !== 'social') return;
    s.state = 'idle';
    setEmotion(s, 'neutral');
    startIdleAnimation(s);
  }

  /** 进入 scared 状态 */
  function enterScared(s) {
    if (s.state === 'scared') return;
    exitState(s);
    s.state = 'scared';
    stopIdleAnimation(s);
  }

  /** 退出 scared 状态 */
  function exitScared(s) {
    if (s.state !== 'scared') return;
    s.state = 'idle';
    setEmotion(s, 'neutral');
    startIdleAnimation(s);
  }

  /** 通用退出当前状态 */
  function exitState(s) {
    switch (s.state) {
      case 'hover': exitHover(s); break;
      case 'lazy': exitLazy(s); break;
      case 'social': exitSocial(s); break;
      case 'scared': exitScared(s); break;
    }
  }

  // ============================================================
  // 第三部分：情绪系统
  // ============================================================
  // I14创新：情绪切换过渡动画（挤压过渡帧）
  function setEmotion(s, emotion, skipTransition = false) {
    // 允许重复设置（社交互动需要刷新表情）
    if (s.emotion === emotion) {
      // neutral 重复设置无意义，其他情绪允许刷新
      if (emotion === 'neutral') return;
    }
    
    // I14创新：挤压过渡动画（50ms）
    if (!skipTransition && emotion !== 'neutral' && s.emotion !== emotion) {
      s.el.style.transform = 'scale(0.95, 0.9)';
      trackedSetTimeout(() => {
        s.el.style.transform = '';
        applyEmotion(s, emotion);
      }, 50);
      return;
    }
    
    applyEmotion(s, emotion);
  }
  
  function applyEmotion(s, emotion) {
    // 清除旧情绪类
    s.el.classList.remove('happy', 'surprised', 'sleepy', 'yawning', 'excited', 'sad', 'curious', 'scared', 'bored', 'talking');
    s.eyes.forEach(e => e.classList.remove('sleepy', 'surprised', 'sad', 'curious', 'scared', 'bored'));
    s.emotion = emotion;
    // 更新pupilScale缓存（与CSS --pupil-scale保持同步）
    const pupilScaleMap = { neutral: 1, excited: 1.2, curious: 1.1, bored: 0.6, surprised: 0.8, sad: 0.9, scared: 0.7, happy: 1.1, sleepy: 0.8 };
    s.pupilScale = pupilScaleMap[emotion] !== undefined ? pupilScaleMap[emotion] : 1;
    // 设置新情绪
    if (emotion !== 'neutral') s.el.classList.add(emotion);
    if (emotion === 'sleepy') s.eyes.forEach(e => e.classList.add('sleepy'));
    if (emotion === 'surprised') s.eyes.forEach(e => e.classList.add('surprised'));
    if (emotion === 'sad') s.eyes.forEach(e => e.classList.add('sad'));
    if (emotion === 'scared') s.eyes.forEach(e => e.classList.add('scared'));
    if (emotion === 'bored') s.eyes.forEach(e => e.classList.add('bored'));
    if (emotion === 'yawning') s.eyes.forEach(e => e.classList.add('sleepy'));
    // I16创新：talking情绪（使用CSS动画实现嘴巴动态效果）
    if (emotion === 'talking') {
      // talking效果由CSS动画 .talking .letter-mouth::before 实现
      // 无需额外JS定时器，CSS animation已提供随机感
    } else {
      if (s.talkingTimer) {
        clearInterval(s.talkingTimer);
        s.talkingTimer = null;
      }
    }
  }

  // ============================================================
  // 第四部分：眼球跟随
  // 跳过 lazy 和 social 状态的字母
  // ============================================================
  function updateEyes() {
    if (!interactionConfig.eyeTracking) return;
    updatePositionCache();
    states.forEach(s => {
      // lazy 或 social 状态不参与眼球跟随
      if (s.state === 'lazy' || s.state === 'social') return;
      // 跳过有 CSS animation 的瞳孔
      const hasPupilAnimation = Array.from(s.pupils).some(p => p.style.animation && p.style.animation !== '');
      if (hasPupilAnimation) return;

      const pos = cachedPositions.get(s.el);
      if (!pos) return;
      const cx = pos.cx, cy = pos.cy;
      const dx = mouseX - cx, dy = mouseY - cy;
      const angle = Math.atan2(dy, dx);
      const dist = Math.min(Math.sqrt(dx * dx + dy * dy) * PUPIL_DISTANCE_FACTOR, PUPIL_MAX_OFFSET);
      const ox = Math.cos(angle) * dist, oy = Math.sin(angle) * dist;
      s.pupils.forEach(p => {
        p.style.transform = `translate(calc(-50% + ${ox}px), calc(-50% + ${oy}px)) scale(${s.pupilScale})`;
      });
    });
  }

  // ============================================================
  // 第五部分：360° 身体反应（简化版）
  // 只有 idle 和 hover 状态响应鼠标
  // ============================================================
  // I2创新：连续距离梯度反馈常量
  const GRADIENT_FAR = 300;      // 远距离：开始微弱反应
  const GRADIENT_MID = 200;      // 中距离：踮脚好奇
  const GRADIENT_NEAR = 100;     // 近距离：明显反应
  const GRADIENT_PUSH = 60;      // 推开距离

  function updateBodies() {
    if (!interactionConfig.bodyReaction) return;
    states.forEach(s => {
      // 只有 idle 和 hover 状态响应鼠标
      if (s.state !== 'idle' && s.state !== 'hover') return;

      const pos = getCachedPosition(s.el);
      const rect = { left: pos.left, top: pos.top, width: pos.width, height: pos.height };
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = mouseX - cx, dy = mouseY - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // 重置目标值
      s.tx = 0; s.ty = 0; s.tr = 0; s.ts = 1;

      // 1. 朝鼠标方向旋转（±8°）
      if (dist > ROTATION_START_DISTANCE) {
        const angle = Math.atan2(dy, dx);
        s.tr = Math.sin(angle) * 8 * Math.max(0, 1 - dist / 400);
      }

      // 2. hover 状态：轻微弹起
      if (s.state === 'hover') {
        s.ts = 1.05;
        s.ty = -6;
        return;
      }

      // 3. 非常近：吓退弹跳（只触发一次）
      if (dist < SCARED_DISTANCE_THRESHOLD && !s.scaredTriggered && interactionConfig.scaredBounce && mouseSpeed < MOUSE_SLOW_THRESHOLD) {
        s.scaredTriggered = true;
        triggerScaredBounce(s, dx, dy, dist);
        return;
      }

      // I2创新：连续距离梯度反馈（消除三段式离散反馈）
      // 计算连续梯度因子 (0-1)，距离越近因子越大
      if (dist < GRADIENT_FAR) {
        const gradientFactor = Math.max(0, 1 - dist / GRADIENT_FAR);
        
        // 连续倾斜：300px内开始微弱倾斜，越近越明显
        const angle = Math.atan2(dy, dx);
        s.tr = Math.sin(angle) * 8 * gradientFactor;
        
        // 连续踮脚：200px内开始踮脚，越近越高
        if (dist < GRADIENT_MID) {
          const tipToeFactor = Math.max(0, 1 - dist / GRADIENT_MID);
          s.ty = -6 * tipToeFactor;
          
          // 连续推开：100px内开始推开
          if (dist < GRADIENT_NEAR) {
            const pushFactor = Math.max(0, 1 - dist / GRADIENT_NEAR);
            const push = pushFactor * 8;
            s.tx = -(dx / Math.max(dist, 1)) * push;
            s.ty = -8 * pushFactor;
          }
        }
        
        // 情绪渐变：距离越近越好奇
        if (gradientFactor > 0.4 && s.state === 'idle') {
          setEmotion(s, 'curious');
        }
      }
      
      // 距离恢复正常时恢复情绪
      if (dist >= GRADIENT_FAR && s.emotion === 'curious') {
        setEmotion(s, 'neutral');
      }
    });
  }

  /** 触发吓退弹跳 */
  function triggerScaredBounce(s, dx, dy, dist) {
    enterScared(s);
    const scareDir = -(dx / Math.max(dist, 1));
    s.el.style.setProperty('--scare-dx', `${scareDir * 8}px`);
    s.el.style.animation = 'scaredJump 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';
    setEmotion(s, 'scared');
    SoundEngine.play('scared');

    trackedSetTimeout(() => {
      if (isDestroyed) return;
      s.el.style.animation = '';
      exitScared(s);
      // 迟滞：等鼠标远离到120px以上才允许再次触发
      let checkDistRafId = null;
      let checkDistFrames = 0;
      const MAX_CHECK_DIST_FRAMES = 300;
      const checkDist = () => {
        if (isDestroyed || checkDistFrames >= MAX_CHECK_DIST_FRAMES) {
          s.scaredTriggered = false;
          if (checkDistRafId) activeRafIds.delete(checkDistRafId);
          return;
        }
        checkDistFrames++;
        const pos = getCachedPosition(s.el);
        const r = { left: pos.left, top: pos.top, width: pos.width, height: pos.height };
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        const d = Math.sqrt((mouseX - cx) ** 2 + (mouseY - cy) ** 2);
        if (d > SCARED_RECOVERY_DISTANCE) {
          s.scaredTriggered = false;
          if (checkDistRafId) activeRafIds.delete(checkDistRafId);
        } else {
          checkDistRafId = requestAnimationFrame(checkDist);
          activeRafIds.add(checkDistRafId);
        }
      };
      checkDistRafId = requestAnimationFrame(checkDist);
      activeRafIds.add(checkDistRafId);
    }, 400);
  }

  // ============================================================
  // 第六部分：平滑插值动画循环
  // ============================================================
  function animate() {
    if (isPaused || isDestroyed) return;
    
    // 检查是否所有功能都关闭了
    const allDisabled = !interactionConfig.hover && !interactionConfig.clickGaze && 
                        !interactionConfig.bodyReaction && !interactionConfig.scaredBounce &&
                        !interactionConfig.squashStretch && !interactionConfig.eyeTracking &&
                        !interactionConfig.lazyActions && !interactionConfig.socialInteractions &&
                        !interactionConfig.snakeFollow;
    if (allDisabled) return;

    // I4创新：全局呼吸时间
    const breathTime = Date.now() * 0.002;
    
    states.forEach((s, idx) => {
      // 如果有 CSS animation 在运行（包括内联style和CSS class），跳过 rAF transform
      const hasCssAnim = hasCssAnimation(s.el);
      if (!hasCssAnim) {
        // I1创新：弹簧物理替代简单LERP
        const dxC = s.tx - s.cx;
        s.vx = (s.vx + dxC * SPRING_STIFFNESS) * SPRING_DAMPING;
        s.cx += s.vx;

        const dyC = s.ty - s.cy;
        s.vy = (s.vy + dyC * SPRING_STIFFNESS) * SPRING_DAMPING;
        s.cy += s.vy;

        const drC = s.tr - s.cr;
        s.vr = (s.vr + drC * SPRING_STIFFNESS) * SPRING_DAMPING;
        s.cr += s.vr;

        const dsC = s.ts - s.cs;
        s.vs = (s.vs + dsC * SPRING_STIFFNESS) * SPRING_DAMPING;
        s.cs += s.vs;

        // I4创新：呼吸微动（每个字母相位偏移）
        const breathScale = 1 + Math.sin(breathTime + idx * 0.5) * 0.005;
        const finalScale = s.cs * breathScale;

        s.el.style.transform =
          `perspective(800px) translateY(${s.cy}px) translateX(${s.cx}px) rotate(${s.cr}deg) scale(${finalScale})`;

        // A27创新：增强身体反向旋转
        if (s.body) {
          const bodyCounterRotation = -s.cr * 0.25;
          const bodyCounterY = -s.cy * 0.05;
          s.body.style.transform = `rotate(${bodyCounterRotation}deg) translateY(${bodyCounterY}px)`;
        }
      }

      // V3创新：动态阴影系统
      if (s.shadow) {
        const height = Math.abs(s.cy);
        const ss = Math.max(0.3, 1 - height * 0.04);
        const so = Math.max(0.03, 0.2 - height * 0.02);
        const blur = Math.min(12, 3 + height * 0.15);
        const shadowOffsetX = -s.cx * 0.3;
        s.shadow.style.transform = `scaleX(${ss}) translateX(${shadowOffsetX}px)`;
        s.shadow.style.opacity = so;
        s.shadow.style.filter = `blur(${blur}px)`;
      }
    });

    updateEyes();
    rafId = requestAnimationFrame(animate);
  }

  // ============================================================
  // 第七部分：随机眨眼
  // ============================================================
  // A4创新：单眼眨眼变化
  function scheduleBlink(eyes) {
    trackedSetTimeout(() => {
      if (isDestroyed) return;
      // 20%概率单眼眨眼
      const isSingleBlink = Math.random() < 0.2;
      const eyesToBlink = isSingleBlink
        ? [eyes[Math.random() < 0.5 ? 0 : 1]]
        : Array.from(eyes);
      
      eyesToBlink.forEach(e => e.classList.add('blink'));
      trackedSetTimeout(() => {
        eyesToBlink.forEach(e => e.classList.remove('blink'));
        scheduleBlink(eyes);
      }, 80);
    }, Math.random() * 4000 + 2000);
  }
  states.forEach(s => trackedSetTimeout(() => scheduleBlink(s.eyes), Math.random() * 2000));

  // ============================================================
  // 第八部分：鼠标事件监听 + 排队跟随检测 + 触摸支持
  // ============================================================
  let prevMouseX = mouseX, prevMouseY = mouseY;
  let snakeFollowActive = false;
  let snakeFastFrames = 0;
  let lastSnakeFollow = 0;
  let mouseMoveRafId = null; // 用于节流
  let touchMoveRafId = null; // 用于触摸节流

  function handleMouseMove(e) {
    // 使用 RAF 节流，避免高频事件
    if (mouseMoveRafId) return;
    mouseMoveRafId = requestAnimationFrame(() => {
      mouseMoveRafId = null;
      
      // 计算鼠标速度（基于时间）
      const now = Date.now();
      const dt = Math.max(now - lastMouseMoveTime, 1);
      const dx = e.clientX - mouseX;
      const dy = e.clientY - mouseY;
      const pixelDist = Math.sqrt(dx * dx + dy * dy);
      mouseSpeed = pixelDist / dt * 16; // 标准化为每帧速度
      lastMouseMoveTime = now;
      
      prevMouseX = mouseX;
      prevMouseY = mouseY;
      mouseX = e.clientX;
      mouseY = e.clientY;
      lastMouseMove = now;

      // 鼠标移动时唤醒偷懒的小人
      states.forEach(s => {
        if (s.state === 'lazy') exitLazy(s);
      });

      // 快速移动时触发排队跟随（需要连续快速移动）
      if (mouseSpeed > MOUSE_SPEED_THRESHOLD && !snakeFollowActive && !states.some(s => s.state !== 'idle') && interactionConfig.snakeFollow) {
        snakeFastFrames = (snakeFastFrames || 0) + 1;
        if (snakeFastFrames >= SNAKE_TRIGGER_FRAMES && Date.now() - lastSnakeFollow > SNAKE_COOLDOWN_MS) {
          triggerSnakeFollow();
          snakeFastFrames = 0;
          lastSnakeFollow = Date.now();
        }
      } else {
        snakeFastFrames = 0;
      }
    });
  }
  document.addEventListener('mousemove', handleMouseMove);

  // ===== 触摸事件支持 =====
  function handleTouchStart(e) {
    if (e.touches.length > 0) {
      const touch = e.touches[0];
      mouseX = touch.clientX;
      mouseY = touch.clientY;
      lastMouseMove = Date.now();
      lastMouseMoveTime = Date.now();
    }
  }

  function handleTouchMove(e) {
    // 使用 RAF 节流，避免高频触摸事件
    if (touchMoveRafId) return;
    touchMoveRafId = requestAnimationFrame(() => {
      touchMoveRafId = null;
      if (e.touches.length > 0) {
        const touch = e.touches[0];
        const now = Date.now();
        const dt = Math.max(now - lastMouseMoveTime, 1);
        const dx = touch.clientX - mouseX;
        const dy = touch.clientY - mouseY;
        mouseSpeed = Math.sqrt(dx * dx + dy * dy) / dt * 16;
        
        mouseX = touch.clientX;
        mouseY = touch.clientY;
        lastMouseMove = now;
        lastMouseMoveTime = now;

        // 触摸移动时唤醒偷懒的小人
        states.forEach(s => {
          if (s.state === 'lazy') exitLazy(s);
        });
      }
    });
  }
  document.addEventListener('touchstart', handleTouchStart, { passive: true });
  document.addEventListener('touchmove', handleTouchMove, { passive: true });

  /** 排队跟随（蛇形效果）- 持续跟随直到鼠标减速 */
  function triggerSnakeFollow() {
    if (!interactionConfig.snakeFollow || prefersReducedMotion) return;
    snakeFollowActive = true;
    const startTime = Date.now();
    let snakeRafId = null;

    // 每个字母跟随前一个字母的位置偏移
    function updateSnake() {
      if (isDestroyed || prefersReducedMotion) { snakeFollowActive = false; if (snakeRafId) activeRafIds.delete(snakeRafId); return; }
      const elapsed = Date.now() - startTime;
      if (elapsed > SNAKE_MAX_DURATION_MS || mouseSpeed < MOUSE_SLOW_THRESHOLD) {
        // 结束：恢复所有字母
        states.forEach(s => {
          if (s.state === 'idle') {
            s.tx = 0; s.ty = 0; s.tr = 0;
            startIdleAnimation(s);
          }
        });
        snakeFollowActive = false;
        if (snakeRafId) activeRafIds.delete(snakeRafId);
        return;
      }

      // 预先缓存所有位置
      updatePositionCache();

      states.forEach((s, i) => {
        if (s.state !== 'idle') return;
        s.el.style.animation = ''; // 清除 idle

        const pos = getCachedPosition(s.el);
        const rect = { left: pos.left, top: pos.top, width: pos.width, height: pos.height };
        const ccx = rect.left + rect.width / 2;
        const ccy = rect.top + rect.height / 2;

        // 第一个字母跟随鼠标，后续字母跟随前一个字母
        let targetX, targetY;
        if (i === 0) {
          targetX = mouseX; targetY = mouseY;
        } else {
          const prevPos = getCachedPosition(states[i - 1].el);
          targetX = prevPos.cx;
          targetY = prevPos.cy;
        }

        const dx = targetX - ccx;
        const dy = targetY - ccy;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // A17创新：波浪传播延迟感 - 越靠后的字母LERP系数越小
        const lerpFactor = Math.max(0.15, 0.5 - i * 0.035); // 头部0.5，尾部约0.15
        // 衰减因子：越后面的字母跟随幅度越小
        const decay = Math.max(0.3, 1 - i * 0.06);
        // 目标位置
        const targetTx = (dx / Math.max(dist, 1)) * Math.min(dist * 0.08, 10) * decay;
        const targetTy = (dy / Math.max(dist, 1)) * Math.min(dist * 0.06, 6) * decay - 2 * decay;
        const targetTr = (dx / Math.max(dist, 1)) * 3 * decay;
        // A17创新：使用LERP平滑过渡，产生传播延迟
        s.tx = s.tx + (targetTx - s.tx) * lerpFactor;
        s.ty = s.ty + (targetTy - s.ty) * lerpFactor;
        s.tr = s.tr + (targetTr - s.tr) * lerpFactor;
      });

      snakeRafId = requestAnimationFrame(updateSnake);
      activeRafIds.add(snakeRafId);
    }

    snakeRafId = requestAnimationFrame(updateSnake);
    activeRafIds.add(snakeRafId);
  }

  // ============================================================
  // 第九部分：Hover 和点击事件
  // ============================================================
  chars.forEach((el, i) => {
    // Hover 进入
    el.addEventListener('mouseenter', () => {
      if (prefersReducedMotion || !interactionConfig.hover) return;
      enterHover(states[i]);
    });
    // Hover 退出
    el.addEventListener('mouseleave', () => {
      if (prefersReducedMotion) return;
      exitHover(states[i]);
    });
    // I5创新：触摸设备hover等效
    let touchTimer = null;
    el.addEventListener('touchstart', () => {
      if (prefersReducedMotion) return;
      const s = states[i];
      if (s.state !== 'idle' && s.state !== 'hover') return;
      if (interactionConfig.squashStretch) {
        s.el.style.animation = 'squashPress 0.15s ease-out forwards';
        setEmotion(s, 'surprised');
      }
      if (interactionConfig.hover && s.state === 'idle') {
        touchTimer = trackedSetTimeout(() => {
          enterHover(s);
        }, 120);
      }
    }, { passive: true });
    el.addEventListener('touchend', () => {
      if (touchTimer) { trackedClearTimeout(touchTimer); touchTimer = null; }
      const s = states[i];
      if (s.state === 'hover') exitHover(s);
    }, { passive: true });
    el.addEventListener('touchmove', () => {
      if (touchTimer) { trackedClearTimeout(touchTimer); touchTimer = null; }
    }, { passive: true });
    el.addEventListener('touchcancel', () => {
      if (touchTimer) { trackedClearTimeout(touchTimer); touchTimer = null; }
      const s = states[i];
      if (s.state === 'hover') exitHover(s);
    }, { passive: true });
    // 鼠标按下：squash & stretch（CSS动画）
    el.addEventListener('mousedown', () => {
      if (prefersReducedMotion || !interactionConfig.squashStretch) return;
      const s = states[i];
      s.el.style.animation = 'squashPress 0.15s ease-out forwards';
      setEmotion(s, 'surprised');
    });
    // 鼠标释放：恢复
    el.addEventListener('mouseup', () => {
      if (prefersReducedMotion || !interactionConfig.squashStretch) return;
      const s = states[i];
      s.el.style.animation = 'squashRelease 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards';
      trackedSetTimeout(() => {
        if (s.state === 'idle' || s.state === 'hover') {
          s.el.style.animation = '';
          setEmotion(s, s.state === 'hover' ? 'happy' : 'neutral');
          if (s.state === 'idle') startIdleAnimation(s);
        }
      }, 300);
    });
    // 触摸释放：恢复
    el.addEventListener('touchend', () => {
      if (prefersReducedMotion || !interactionConfig.squashStretch) return;
      const s = states[i];
      s.el.style.animation = 'squashRelease 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards';
      trackedSetTimeout(() => {
        if (s.state === 'idle' || s.state === 'hover') {
          s.el.style.animation = '';
          setEmotion(s, s.state === 'hover' ? 'happy' : 'neutral');
          if (s.state === 'idle') startIdleAnimation(s);
        }
      }, 300);
    }, { passive: true });
    // 点击：群体注视（不改变其他字母的情绪）
    el.addEventListener('click', () => {
      if (prefersReducedMotion || !interactionConfig.clickGaze) return;
      const clickedS = states[i];
      const clickedPos = getCachedPosition(clickedS.el);
      const clickedRect = { left: clickedPos.left, top: clickedPos.top, width: clickedPos.width, height: clickedPos.height };
      const clickedCx = clickedRect.left + clickedRect.width / 2;
      const clickedCy = clickedRect.top + clickedRect.height * 0.2;

      // 被点击的字母开心
      setEmotion(clickedS, 'happy');
      LetterMemory.recordClick(el.getAttribute('data-letter'));
      ClickChorus.record(el.getAttribute('data-letter'));
      SoundEngine.play('click');

      // 其他字母看向被点击的字母（不改变情绪）
      states.forEach((s, j) => {
        if (j === i || s.state === 'lazy') return;

        const sPos = getCachedPosition(s.el);
        const sRect = { left: sPos.left, top: sPos.top, width: sPos.width, height: sPos.height };
        const dx = clickedCx - (sRect.left + sRect.width / 2);
        const dy = clickedCy - (sRect.top + sRect.height * 0.2);
        const dist = Math.sqrt(dx * dx + dy * dy);
        const offset = Math.min(dist * PUPIL_DISTANCE_FACTOR, PUPIL_MAX_OFFSET);

        const angle = Math.atan2(dy, dx);
        const ox = Math.cos(angle) * offset;
        const oy = Math.sin(angle) * offset;

        s.pupils.forEach(p => {
          p.style.transform = `translate(calc(-50% + ${ox}px), calc(-50% + ${oy}px)) scale(${s.pupilScale})`;
          p.style.transition = 'transform 0.3s ease';
        });
      });

      // 1.5秒后恢复
      trackedSetTimeout(() => {
        states.forEach(s => {
          s.pupils.forEach(p => { p.style.transition = ''; });
        });
        // 恢复被点击字母的情绪
        if (clickedS.state === 'idle') {
          setEmotion(clickedS, 'neutral');
        }
      }, 1500);
    });
    // 键盘支持
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        el.click();
      }
    });
    // 焦点样式由CSS :focus-visible处理，无需JS内联样式
  });

  // I6创新：双击旋转Easter Egg
  chars.forEach((el, i) => {
    el.addEventListener('dblclick', (e) => {
      e.preventDefault();
      if (prefersReducedMotion) return;
      const s = states[i];
      if (s.state !== 'idle') return;
      s.el.style.animation = 'letterSpin 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)';
      setEmotion(s, 'excited');
      // 生成星星粒子
      spawnParticles(s.el, 5, 'star');
      trackedSetTimeout(() => {
        s.el.style.animation = '';
        setEmotion(s, 'neutral');
        startIdleAnimation(s);
      }, 600);
    });
  });

  // 简单粒子生成函数（I6配套）
  function spawnParticles(parentEl, count, type) {
    const rect = parentEl.getBoundingClientRect();
    const animations = ['particleBurst', 'particleArc', 'particleSpiral'];
    for (let i = 0; i < count; i++) {
      const p = document.createElement('div');
      p.className = 'letter-particle';
      const animType = animations[Math.floor(Math.random() * animations.length)];
      let symbols, color;
      if (type === 'star') {
        symbols = ['✦', '✧', '⭑'];
        color = `hsl(${Math.random() * 360}, 80%, 70%)`;
      } else if (type === 'note') {
        symbols = ['♪', '♫', '♬', '♩'];
        color = `hsl(${30 + Math.random() * 30}, 90%, 70%)`;
      } else {
        symbols = ['•', '◦', '∘'];
        color = `hsl(${Math.random() * 360}, 80%, 70%)`;
      }
      p.textContent = symbols[Math.floor(Math.random() * symbols.length)];
      const arcX = (Math.random() - 0.5) * 40;
      p.style.cssText = `
        position: fixed;
        left: ${rect.left + rect.width / 2}px;
        top: ${rect.top + rect.height / 2}px;
        font-size: ${8 + Math.random() * 8}px;
        color: ${color};
        pointer-events: none;
        z-index: 9999;
        animation: ${animType} ${0.6 + Math.random() * 0.4}s ease-out forwards;
        --burst-x: ${(Math.random() - 0.5) * 60}px;
        --arc-x: ${arcX}px;
      `;
      document.body.appendChild(p);
      trackedSetTimeout(() => p.remove(), 1200);
    }
  }

  // ============================================================
  // 第十部分：偷懒动作系统
  // ============================================================
  const LAZY_ACTIONS = [
    // 打瞌睡
    (s) => {
      setEmotion(s, 'sleepy');
      s.el.style.animation = 'nodOff 3s ease-in-out infinite';
      s.lazyTimer = trackedSetTimeout(() => exitLazy(s), 4000 + Math.random() * 3000);
    },
    // 伸懒腰
    (s) => {
      s.el.classList.add('stretching');
      s.el.style.animation = 'stretchUp 2s ease-in-out';
      s.lazyTimer = trackedSetTimeout(() => {
        s.el.classList.remove('stretching');
        exitLazy(s);
      }, 2000);
    },
    // 打哈欠
    (s) => {
      setEmotion(s, 'yawning');
      s.lazyTimer = trackedSetTimeout(() => exitLazy(s), 2500);
    },
    // 走神
    (s) => {
      setEmotion(s, 'bored');
      const gazeX = (Math.random() - 0.5) * 3;
      const gazeY = (Math.random() - 0.5) * 2;
      s.pupils.forEach(p => {
        p.style.transform = `translate(calc(-50% + ${gazeX}px), calc(-50% + ${gazeY}px)) scale(${s.pupilScale})`;
        p.style.transition = 'transform 0.8s ease';
      });
      s.lazyTimer = trackedSetTimeout(() => {
        s.pupils.forEach(p => { p.style.transition = ''; });
        exitLazy(s);
      }, 3000 + Math.random() * 2000);
    },
    // 偷看别处
    (s) => {
      const peekOx = (Math.random() - 0.5) * 4;
      const peekOy = (Math.random() - 0.5) * 3;
      s.el.style.setProperty('--peek-ox', `${peekOx}px`);
      s.el.style.setProperty('--peek-oy', `${peekOy}px`);
      s.pupils.forEach(p => {
        p.style.animation = `peekAway ${2 + Math.random()}s ease-in-out`;
      });
      s.lazyTimer = trackedSetTimeout(() => {
        s.pupils.forEach(p => { p.style.animation = ''; });
        exitLazy(s);
      }, 2000 + Math.random() * 1000);
    },
    // 揉眼睛
    (s) => {
      s.el.classList.add('rubbing-eyes');
      s.eyes.forEach(e => e.classList.add('sleepy'));
      const arms = s.el.querySelectorAll('.letter-arm');
      arms.forEach(arm => {
        arm.style.animation = `${arm.classList.contains('left') ? 'rubEyesLeft' : 'rubEyesRight'} 0.8s ease-in-out 2`;
      });
      s.lazyTimer = trackedSetTimeout(() => {
        s.el.classList.remove('rubbing-eyes');
        s.eyes.forEach(e => e.classList.remove('sleepy'));
        arms.forEach(arm => { arm.style.animation = ''; });
        exitLazy(s);
      }, 2000);
    },
  ];

  function scheduleLazy(s) {
    if (s.state !== 'idle' || !interactionConfig.lazyActions || isDestroyed) return;
    // I8创新：深夜模式缩短延迟时间
    // S4创新：时间感知系统调整延迟
    const baseDelay = 8000 + Math.random() * 7000; // 8-15秒（降低触发门槛）
    const timeFactor = TimeAwareness.getLazyFrequency();
    const delay = (s.nightMode ? baseDelay * 0.4 : baseDelay) / timeFactor;
    s.lazyTimer = trackedSetTimeout(() => {
      if (isDestroyed) return;
      if (isPaused || Date.now() - lastMouseMove < 5000 || s.state !== 'idle') { // 5秒无操作
        if (s.state === 'idle') scheduleLazy(s);
        return;
      }
      const idleTime = Date.now() - lastMouseMove;
      let actionIdx;
      if (idleTime > 12000) {
        // 很长时间：打瞌睡、伸懒腰、打哈欠
        actionIdx = Math.floor(Math.random() * 3);
      } else if (idleTime > 8000) {
        // 中等时间：走神、偷看
        actionIdx = 3 + Math.floor(Math.random() * 2);
      } else {
        // 刚过阈值：随机
        actionIdx = Math.floor(Math.random() * LAZY_ACTIONS.length);
      }
      // 子开关映射
      const lazyActionKeys = ['lazyNodOff', 'lazyStretch', 'lazyYawn', 'lazyZoneOut', 'lazyPeek', 'lazyRubEyes'];
      // 检查对应子开关
      if (!interactionConfig[lazyActionKeys[actionIdx]]) {
        if ((s._lazyRetryCount || 0) > 10) {
          s._lazyRetryCount = 0;
          return;
        }
        s._lazyRetryCount = (s._lazyRetryCount || 0) + 1;
        scheduleLazy(s);
        return;
      }
      s._lazyRetryCount = 0;
      enterLazy(s, LAZY_ACTIONS[actionIdx]);
    }, delay);
  }

  // ============================================================
  // 第十一部分：社交互动系统
  // 只保留：窃窃私语、传递眼神、庆祝跳跃
  // ============================================================
  function triggerSocialInteraction() {
    // 完整状态检查
    if (states.some(s => ['lazy', 'social', 'scared', 'hover'].includes(s.state))) return;
    if (isPaused) return;

    // 收集可用的社交互动（根据子开关过滤）
    const availableInteractions = [];

    // 窃窃私语
    if (interactionConfig.socialWhisper) {
      availableInteractions.push(() => {
        // 动态分组，确保不越界
        const mid = Math.floor(states.length / 2);
        const firstHalf = states.slice(0, mid).map((_, i) => i);
        const secondHalf = states.slice(mid).map((_, i) => i + mid);
        const group = Math.random() > 0.5 && firstHalf.length > 1 ? firstHalf : secondHalf;
        if (group.length < 2) return;
        const localIdx = Math.floor(Math.random() * (group.length - 1));
        const a = states[group[localIdx]], b = states[group[localIdx + 1]];
        if (!a || !b || a.state !== 'idle' || b.state !== 'idle') return;

        enterSocial(a);
        enterSocial(b);
        a.el.style.animation = 'whisperRight 2s ease-in-out';
        b.el.style.animation = 'whisperLeft 2s ease-in-out 0.15s';

        // 嘴巴微动效果：交替设置 happy/neutral 模拟说话
        let mouthCount = 0;
        const mouthInterval = trackedSetInterval(() => {
          // S3创新：使用表情混合，talking + happy 混合
          if (mouthCount % 2 === 0) {
            EmotionBlender.setBlendedEmotion(a, 'happy', 'surprised', 0.7, 0.3);
            EmotionBlender.setBlendedEmotion(b, 'happy', 'surprised', 0.7, 0.3);
          } else {
            EmotionBlender.setBlendedEmotion(a, 'happy', 'neutral', 0.6, 0.4);
            EmotionBlender.setBlendedEmotion(b, 'happy', 'neutral', 0.6, 0.4);
          }
          mouthCount++;
          if (mouthCount > 6) {
            trackedClearInterval(mouthInterval);
            EmotionBlender.clearBlended(a);
            EmotionBlender.clearBlended(b);
            setEmotion(a, 'happy');
            setEmotion(b, 'happy');
          }
        }, 300);

        // I17创新：被排除邻居偷瞄反应
        const excludedNeighbor = states[group[localIdx + 2]]; // 如果有的话
        if (excludedNeighbor && excludedNeighbor.state === 'idle') {
          // 偷瞄：先看聊天两人，然后转开变sad
          excludedNeighbor.el.classList.add('peeking-at-chat');
          setEmotion(excludedNeighbor, 'curious'); // 先好奇偷看
          
          trackedSetTimeout(() => {
            // 30%概率尝试加入（变成happy）
            if (Math.random() < 0.3) {
              setEmotion(excludedNeighbor, 'happy');
              excludedNeighbor.el.classList.remove('peeking-at-chat');
              // 尝试加入动画
              excludedNeighbor.el.style.animation = 'tryJoinChat 0.8s ease-in-out';
              trackedSetTimeout(() => {
                excludedNeighbor.el.style.animation = '';
                if (excludedNeighbor.state === 'idle') setEmotion(excludedNeighbor, 'neutral');
              }, 800);
            } else {
              // 没加入，变sad
              setEmotion(excludedNeighbor, 'sad');
              excludedNeighbor.el.classList.remove('peeking-at-chat');
              trackedSetTimeout(() => {
                if (excludedNeighbor.state === 'idle') setEmotion(excludedNeighbor, 'neutral');
              }, 1500);
            }
          }, 800); // 偷看800ms后反应
        }

        trackedSetTimeout(() => {
          trackedClearInterval(mouthInterval);
          a.el.style.animation = '';
          b.el.style.animation = '';
          exitSocial(a);
          exitSocial(b);
        }, 2200);
      });
    }

    // I18创新：跨组社交互动（20%概率触发Deep组和Learning组之间的互动）
    if (interactionConfig.socialWhisper && Math.random() < 0.2 && states.length >= 5) {
      availableInteractions.push(() => {
        // Deep组最后一个字母 (p, index 3) 和 Learning组第一个字母 (L, index 4)
        const spaceIndex = LETTER_CONFIGS.findIndex(c => c.key === null);
        const deepLastIdx = spaceIndex > 0 ? spaceIndex - 1 : 3;
        const learningFirstIdx = spaceIndex + 1 < states.length ? spaceIndex + 1 : 4;
        const deepLast = states[deepLastIdx];
        const learningFirst = states[learningFirstIdx];
        if (!deepLast || !learningFirst || deepLast.state !== 'idle' || learningFirst.state !== 'idle') return;
        
        enterSocial(deepLast);
        enterSocial(learningFirst);
        
        // 跨组打招呼动画
        deepLast.el.style.animation = 'waveCrossGroup 1.5s ease-in-out';
        learningFirst.el.style.animation = 'waveCrossGroup 1.5s ease-in-out 0.2s';
        
        // 互相看对方
        setEmotion(deepLast, 'happy');
        setEmotion(learningFirst, 'happy');
        
        // 其他字母也转头看向他们
        const otherIndices = states.map((_, i) => i).filter(i => i !== deepLastIdx && i !== learningFirstIdx);
        otherIndices.forEach(idx => {
          const s = states[idx];
          if (s && s.state === 'idle') {
            // 简单模拟转头（设置curious情绪）
            setEmotion(s, 'curious');
            trackedSetTimeout(() => {
              if (s.state === 'idle') setEmotion(s, 'neutral');
            }, 2000);
          }
        });
        
        trackedSetTimeout(() => {
          deepLast.el.style.animation = '';
          learningFirst.el.style.animation = '';
          exitSocial(deepLast);
          exitSocial(learningFirst);
        }, 1800);
      });
    }

    // 传递眼神
    if (interactionConfig.socialEyeContact) {
      availableInteractions.push(() => {
        const mid = Math.floor(states.length / 2);
        const firstGroup = Array.from({length: mid}, (_, i) => i);
        const secondGroup = Array.from({length: states.length - mid}, (_, i) => i + mid);
        const group = Math.random() > 0.5 && firstGroup.length > 1 ? firstGroup : secondGroup;
        const localIdx = Math.floor(Math.random() * (group.length - 1));
        const a = states[group[localIdx]], b = states[group[localIdx + 1]];
        if (!a || !b || a.state !== 'idle' || b.state !== 'idle') return;

        enterSocial(a);
        enterSocial(b);

        // A 看 B
        const bPos = getCachedPosition(b.el);
        const aPos = getCachedPosition(a.el);
        const bRect = { left: bPos.left, top: bPos.top, width: bPos.width, height: bPos.height };
        const aRect = { left: aPos.left, top: aPos.top, width: aPos.width, height: aPos.height };
        const dx1 = (bRect.left + bRect.width / 2) - (aRect.left + aRect.width / 2);
        const dy1 = (bRect.top + bRect.height * 0.2) - (aRect.top + aRect.height * 0.2);
        const d1 = Math.min(Math.sqrt(dx1 * dx1 + dy1 * dy1) * PUPIL_DISTANCE_FACTOR, PUPIL_MAX_OFFSET);
        a.pupils.forEach(p => {
          p.style.transform = `translate(calc(-50% + ${Math.cos(Math.atan2(dy1, dx1)) * d1}px), calc(-50% + ${Math.sin(Math.atan2(dy1, dx1)) * d1}px)) scale(${a.pupilScale})`;
          p.style.transition = 'transform 0.3s ease';
        });

        // B 接收到后回看 A
        trackedSetTimeout(() => {
          const bPos2 = getCachedPosition(b.el);
          const aPos2 = getCachedPosition(a.el);
          const bRect2 = { left: bPos2.left, top: bPos2.top, width: bPos2.width, height: bPos2.height };
          const aRect2 = { left: aPos2.left, top: aPos2.top, width: aPos2.width, height: aPos2.height };
          const dx2 = (aRect2.left + aRect2.width / 2) - (bRect2.left + bRect2.width / 2);
          const dy2 = (aRect2.top + aRect2.height * 0.2) - (bRect2.top + bRect2.height * 0.2);
          const d2 = Math.min(Math.sqrt(dx2 * dx2 + dy2 * dy2) * PUPIL_DISTANCE_FACTOR, PUPIL_MAX_OFFSET);
          b.pupils.forEach(p => {
            p.style.transform = `translate(calc(-50% + ${Math.cos(Math.atan2(dy2, dx2)) * d2}px), calc(-50% + ${Math.sin(Math.atan2(dy2, dx2)) * d2}px)) scale(${b.pupilScale})`;
            p.style.transition = 'transform 0.3s ease';
          });

          // 开心
          trackedSetTimeout(() => {
            setEmotion(a, 'happy');
            setEmotion(b, 'happy');
          }, 400);

          // 恢复
          trackedSetTimeout(() => {
            [a, b].forEach(s => {
              s.pupils.forEach(p => { p.style.transition = ''; });
            });
            exitSocial(a);
            exitSocial(b);
          }, 1500);
        }, 800);
      });
    }

    // A8创新：庆祝跳跃（波浪节奏 + 落地冲击 + EASINGS.bounce）
    if (interactionConfig.socialCelebrate) {
      availableInteractions.push(() => {
        SoundEngine.play('celebrate');
        // 使用粒子引擎发射五彩纸屑
        const stageRect = stage.getBoundingClientRect();
        ParticleEngine.confetti(stageRect.left + stageRect.width / 2, stageRect.top + stageRect.height / 2, 30);
        states.forEach((s, i) => {
          if (s.state !== 'idle') return;
          enterSocial(s);
          s.el.style.animation = '';
          const delay = i * 80;
          const isEdge = i === 0 || i === chars.length - 1;
          const maxJump = isEdge ? -18 : -12 + Math.sin(i * 0.8) * 4;
          const stretchAmount = isEdge ? 1.08 : 1.05;
          
          trackedSetTimeout(() => {
            setEmotion(s, 'excited');
            // 使用EASINGS.bounce驱动的跳跃动画（替代硬编码分步）
            const jumpDuration = 500;
            const jumpStart = performance.now();
            let jumpRafId = null;
            function animateJump(now) {
              if (isDestroyed || prefersReducedMotion) { if (jumpRafId) activeRafIds.delete(jumpRafId); s.ty = 0; s.ts = 1; return; }
              const elapsed = now - jumpStart;
              const t = Math.min(elapsed / jumpDuration, 1);
              const bounce = EASINGS.bounce(t);
              s.ty = maxJump * (1 - bounce);
              s.ts = 1 + (stretchAmount - 1) * (1 - bounce);
              if (t < 1) {
                jumpRafId = requestAnimationFrame(animateJump);
                activeRafIds.add(jumpRafId);
              } else {
                s.ty = 0; s.ts = 1;
                if (jumpRafId) activeRafIds.delete(jumpRafId);
              }
            }
            jumpRafId = requestAnimationFrame(animateJump);
            activeRafIds.add(jumpRafId);
            // 相邻字母击掌
            if (i > 0 && states[i - 1].state === 'social') {
              const arms = s.el.querySelectorAll('.letter-arm');
              const rightArm = arms[1];
              if (rightArm) {
                rightArm.style.animation = 'highFive 0.8s cubic-bezier(0.22, 1, 0.36, 1)';
                rightArm.style.opacity = '0.9';
                trackedSetTimeout(() => { rightArm.style.animation = ''; rightArm.style.opacity = ''; }, 800);
              }
            }
          }, delay);
        });

        trackedSetTimeout(() => {
          states.forEach(s => {
            if (s.state === 'social') exitSocial(s);
          });
        }, chars.length * 80 + 800);
      });
    }

    // 如果没有可用的社交互动，直接返回
    if (availableInteractions.length === 0) return;

    const action = availableInteractions[Math.floor(Math.random() * availableInteractions.length)];
    action();
  }

  function scheduleSocial() {
    if (!interactionConfig.socialInteractions || isDestroyed) return;
    const delay = 20000 + Math.random() * 20000; // 20-40秒
    trackedSetTimeout(() => {
      if (isDestroyed) return;
      if (!isPaused && interactionConfig.socialInteractions) {
        triggerSocialInteraction();
      }
      scheduleSocial();
    }, delay);
  }

  // ============================================================
  // 第十二部分：个性化待机动画
  // ============================================================
  const IDLE_KEYFRAMES = {
    D:  { name: 'idleD',  duration: '3.0s' },
    e:  { name: 'idleE',  duration: '2.5s' },
    e2: { name: 'idleE2', duration: '2.8s' },
    p:  { name: 'idleP',  duration: '3.2s' },
    L:  { name: 'idleL',  duration: '3.5s' },
    e3: { name: 'idleE3', duration: '2.2s' },
    a:  { name: 'idleA',  duration: '2.4s' },
    r:  { name: 'idleR',  duration: '1.8s' },
    n:  { name: 'idleN',  duration: '3.0s' },
    i:  { name: 'idleI',  duration: '2.6s' },
    n2: { name: 'idleN2', duration: '3.3s' },
    g:  { name: 'idleG',  duration: '2.8s' },
  };

  function startIdleAnimation(s) {
    const key = s.el.getAttribute('data-letter');
    const idle = IDLE_KEYFRAMES[key] || { name: 'idleD', duration: '3s' };
    s.el.style.animation = `${idle.name} ${idle.duration} ease-in-out infinite`;
  }

  function stopIdleAnimation(s) {
    s.el.style.animation = '';
  }

  // ============================================================
  // 第十三部分：启动系统
  // ============================================================
  
  // 重启动画循环的函数（当开关从全部关闭变为部分开启时调用）
  function restartAnimation() {
    if (!isPaused && !isDestroyed && !rafId && !prefersReducedMotion) {
      rafId = requestAnimationFrame(animate);
    }
  }
  window.LetterSystem.restartAnimation = restartAnimation;

  if (!prefersReducedMotion) {
    rafId = requestAnimationFrame(animate);
    updateBodies(); // 初始调用
  }

  // 入场完成后启动 idle + 偷懒 + 社交
  const totalEntry = 800 + LETTER_CONFIGS[LETTER_CONFIGS.length - 1].delay * 1000 + 800;
  trackedSetTimeout(() => {
    if (prefersReducedMotion) return;
    chars.forEach((el, i) => {
      trackedSetTimeout(() => {
        startIdleAnimation(states[i]);
        scheduleLazy(states[i]);
      }, i * 300);
    });
    scheduleSocial();
  }, totalEntry);
}

/* ==================== Hero 交互特效 ==================== */

/** 初始化 Hero 区域的鼠标交互特效 */
function initHeroInteractions() {
  const hero = document.querySelector('.hero');
  if (!hero) return;
  if (hero.querySelector('.hero-spotlight')) return;

  // 检查是否偏好减少动画
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) return;

  // ===== 创建 Spotlight 追光系统（6 层） =====
  const spotlight = document.createElement('div');
  spotlight.className = 'hero-spotlight';

  // SVG 滤镜 - 液态玻璃有机扰动
  const svgFilters = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svgFilters.classList.add('spotlight-filters');
  svgFilters.setAttribute('aria-hidden', 'true');
  svgFilters.innerHTML = `
    <defs>
      <filter id="spotlight-organic" x="-20%" y="-20%" width="140%" height="140%">
        <feTurbulence type="fractalNoise" baseFrequency="0.015" numOctaves="3" seed="42" result="noise"/>
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="12" xChannelSelector="R" yChannelSelector="G"/>
      </filter>
    </defs>`;
  spotlight.appendChild(svgFilters);

  // Layer 2: 色差分离 - 绿色通道
  const chromaticGreen = document.createElement('div');
  chromaticGreen.className = 'spotlight-chromatic-green';
  spotlight.appendChild(chromaticGreen);

  // Layer 3: 色差分离 - 蓝色通道
  const chromaticBlue = document.createElement('div');
  chromaticBlue.className = 'spotlight-chromatic-blue';
  spotlight.appendChild(chromaticBlue);

  // Layer 4: 高光核心
  const core = document.createElement('div');
  core.className = 'spotlight-core';
  spotlight.appendChild(core);

  // Layer 5: Apple 风格高光边缘
  const rim = document.createElement('div');
  rim.className = 'spotlight-rim';
  spotlight.appendChild(rim);

  // Layer 6: 漂浮微粒容器
  const particlesContainer = document.createElement('div');
  particlesContainer.className = 'spotlight-particles';
  spotlight.appendChild(particlesContainer);

  hero.insertBefore(spotlight, hero.firstChild);

  // 2. 获取统计卡片和按钮
  const statsCard = document.querySelector('.hero-stats');
  const heroBtns = document.querySelectorAll('.hero-actions .btn');

  // ===== 追光平滑插值 =====
  let currentX = 0, currentY = 0;
  let targetX = 0, targetY = 0;
  let rafId = null;
  let isMouseInHero = false;

  function updateSpotlightPosition() {
    // 平滑插值（lerp 系数 0.12）
    currentX += (targetX - currentX) * 0.12;
    currentY += (targetY - currentY) * 0.12;

    const xStr = currentX + 'px';
    const yStr = currentY + 'px';

    // 更新所有层的 CSS 变量
    spotlight.style.setProperty('--spotlight-x', xStr);
    spotlight.style.setProperty('--spotlight-y', yStr);

    // 色差偏移量随速度动态变化
    const dx = targetX - currentX;
    const dy = targetY - currentY;
    const velocity = Math.sqrt(dx * dx + dy * dy);
    const chromaticOffset = Math.min(velocity * 0.15, 16);

    // 更新色差绿色通道位置
    chromaticGreen.style.left = `calc(${xStr} + ${chromaticOffset * 0.5}px)`;
    chromaticGreen.style.top = `calc(${yStr} - ${chromaticOffset}px)`;

    // 更新色差蓝色通道位置
    chromaticBlue.style.left = `calc(${xStr} - ${chromaticOffset}px)`;
    chromaticBlue.style.top = `calc(${yStr} + ${chromaticOffset * 0.5}px)`;

    // 更新 ::after 红色通道（通过 CSS 变量）
    spotlight.style.setProperty('--chromatic-offset', chromaticOffset + 'px');

    // 高光核心跟随（更快的 lerp）
    const coreX = currentX + (targetX - currentX) * 0.3;
    const coreY = currentY + (targetY - currentY) * 0.3;
    core.style.left = coreX + 'px';
    core.style.top = coreY + 'px';

    // 生成粒子（基于速度）
    if (velocity > 3 && Math.random() < 0.3) {
      spawnParticle(particlesContainer, currentX, currentY);
    }

    if (isMouseInHero) {
      rafId = requestAnimationFrame(updateSpotlightPosition);
    }
  }

  hero.addEventListener('mouseenter', () => {
    isMouseInHero = true;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(updateSpotlightPosition);
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

  // ===== 粒子系统 =====
  function spawnParticle(container, x, y) {
    const particle = document.createElement('div');
    particle.className = 'spotlight-particle';
    const offsetX = (Math.random() - 0.5) * 100;
    const offsetY = (Math.random() - 0.5) * 60;
    particle.style.left = (x + offsetX) + 'px';
    particle.style.top = (y + offsetY) + 'px';
    const size = 1 + Math.random() * 2;
    particle.style.width = size + 'px';
    particle.style.height = size + 'px';
    const duration = 1.5 + Math.random() * 2;
    particle.style.animation = `particle-float ${duration}s ease-out forwards`;
    container.appendChild(particle);
    setTimeout(() => particle.remove(), duration * 1000);
  }

  // ===== 统计卡片 3D 倾斜 + 内部追光 =====
  if (statsCard) {
    statsCard.addEventListener('mousemove', (e) => {
      const rect = statsCard.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      // 计算倾斜角度（最大 ±5 度）
      const rotateX = ((y - centerY) / centerY) * -5;
      const rotateY = ((x - centerX) / centerX) * 5;

      statsCard.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;

      // 内部追光位置
      const percentX = (x / rect.width) * 100;
      const percentY = (y / rect.height) * 100;
      statsCard.style.setProperty('--tilt-x', percentX + '%');
      statsCard.style.setProperty('--tilt-y', percentY + '%');
    });

    statsCard.addEventListener('mouseleave', () => {
      statsCard.style.transform = 'perspective(800px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
    });
  }

  // ===== 按钮 Spotlight + 磁性吸附 =====
  heroBtns.forEach(btn => {
    btn.addEventListener('mousemove', (e) => {
      const rect = btn.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const percentX = (x / rect.width) * 100;
      const percentY = (y / rect.height) * 100;
      btn.style.setProperty('--btn-spotlight-x', percentX + '%');
      btn.style.setProperty('--btn-spotlight-y', percentY + '%');

      // 磁性吸附效果
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const deltaX = (e.clientX - centerX) * 0.15;
      const deltaY = (e.clientY - centerY) * 0.15;
      btn.style.transform = `translate(${deltaX}px, ${deltaY}px) translateY(-2px) scale(1.02)`;
    });

    btn.addEventListener('mouseleave', () => {
      btn.style.transform = '';
      btn.style.setProperty('--btn-spotlight-x', '50%');
      btn.style.setProperty('--btn-spotlight-y', '50%');
    });
  });
}

/** 渲染分类卡片网格 */
function renderModuleGrid() {
  const grid = document.getElementById('moduleGrid');
  if (!grid) return;
  const models = state.models;

  // 统计每个类别的模型数量
  const categoryCount = {};
  models.forEach(m => {
    if (m.category) {
      categoryCount[m.category] = (categoryCount[m.category] || 0) + 1;
    }
  });

  const categories = Object.keys(categoryCount).sort((a, b) => categoryCount[b] - categoryCount[a]);

  if (categories.length === 0) {
    grid.innerHTML = '<p style="color: var(--text-muted); text-align: center; grid-column: 1/-1; padding: 40px;">暂无模型数据</p>';
    return;
  }

  grid.innerHTML = categories.map((cat, index) => {
    const config = MODULE_CATEGORIES[cat] || { icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>', color: 'green', desc: '浏览该类别的深度学习模型' };
    const count = categoryCount[cat];
    return `
      <div class="module-card" data-color="${config.color}"
           onclick="navigate('category', {category: '${escapeHtml(cat)}'})"
           style="animation: fadeInUp 0.5s var(--ease-out) ${index * 0.08}s both;"
           onmousemove="updateRipple(event, this)"
           role="button" tabindex="0"
           aria-label="${escapeHtml(cat)} - ${count} 个模型"
           onkeydown="if(event.key==='Enter') navigate('category', {category: '${escapeHtml(cat)}'})">
        <span class="module-card-icon">${config.icon}</span>
        <div class="module-card-name">${escapeHtml(cat)}</div>
        <div class="module-card-desc">${escapeHtml(config.desc)}</div>
        <span class="module-card-count">${count} 个模型</span>
      </div>
    `;
  }).join('');
}

/** 更新卡片涟漪效果位置 */
function updateRipple(event, el) {
  const rect = el.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width * 100).toFixed(1);
  const y = ((event.clientY - rect.top) / rect.height * 100).toFixed(1);
  el.style.setProperty('--ripple-x', x + '%');
  el.style.setProperty('--ripple-y', y + '%');
}

// ==================== 分类页 ====================

/** 渲染分类页 */
function renderCategory(category) {
  state.currentCategory = category;

  // 更新面包屑
  const breadcrumbEl = document.getElementById('breadcrumbCategory');
  if (breadcrumbEl) breadcrumbEl.textContent = category;

  // 重置搜索
  const searchInput = document.getElementById('searchInput');
  if (searchInput) searchInput.value = '';

  // 填充年份筛选按钮
  renderYearFilters(category);

  // 渲染模型列表
  const catModels = state.models.filter(m => m.category === category);
  const sorted = [...catModels].sort((a, b) => (a.year || 0) - (b.year || 0));
  renderModelGrid(sorted);
}

/** 渲染年份筛选按钮 */
function renderYearFilters(category) {
  const filterGroup = document.getElementById('filterGroup');
  if (!filterGroup) return;
  const catModels = state.models.filter(m => m.category === category);
  const years = [...new Set(catModels.map(m => m.year).filter(Boolean))].sort((a, b) => b - a);

  let html = `<button class="filter-btn active" data-year="" onclick="filterByYear(this, '')">全部</button>`;
  years.forEach(y => {
    html += `<button class="filter-btn" data-year="${y}" onclick="filterByYear(this, '${y}')">${y}</button>`;
  });
  filterGroup.innerHTML = html;
}

/** 清除搜索和筛选 */
function clearSearch() {
  const searchInput = document.getElementById('searchInput');
  if (searchInput) searchInput.value = '';
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  const allBtn = document.querySelector('.filter-btn[data-year=""]');
  if (allBtn) allBtn.classList.add('active');
  applyFilters('');
}

/** 年份筛选 */
function filterByYear(btn, year) {
  // 更新按钮状态
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  applyFilters(year);
}

/** 应用搜索和筛选 */
const applyFilters = debounce(function (overrideYear) {
  const keyword = document.getElementById('searchInput').value.toLowerCase().trim();

  // 获取当前激活的年份
  let year = overrideYear !== undefined ? overrideYear : '';
  if (year === '') {
    const activeBtn = document.querySelector('.filter-btn.active');
    if (activeBtn) year = activeBtn.dataset.year || '';
  }

  let filtered = state.models.filter(m => m.category === state.currentCategory);

  if (keyword) {
    filtered = filtered.filter(m =>
      m.name.toLowerCase().includes(keyword) ||
      (m.fullName && m.fullName.toLowerCase().includes(keyword)) ||
      (m.description && m.description.toLowerCase().includes(keyword)) ||
      (m.tags && m.tags.some(t => t.toLowerCase().includes(keyword))) ||
      (m.architecture && m.architecture.toLowerCase().includes(keyword))
    );
  }

  if (year) {
    filtered = filtered.filter(m => String(m.year) === year);
  }

  filtered.sort((a, b) => (a.year || 0) - (b.year || 0));
  renderModelGrid(filtered);
}, CONFIG.SEARCH_DEBOUNCE);

// 类别到颜色渐变的映射
const CATEGORY_GRADIENTS = {
  '图像分类': 'linear-gradient(180deg, #6366f1 0%, #818cf8 50%, #a78bfa 100%)',
  '目标检测': 'linear-gradient(180deg, #f97316 0%, #ef4444 50%, #dc2626 100%)',
  '自然语言处理': 'linear-gradient(180deg, #a855f7 0%, #ec4899 50%, #f472b6 100%)',
  '图像生成': 'linear-gradient(180deg, #ec4899 0%, #f59e0b 50%, #fbbf24 100%)',
  '大语言模型': 'linear-gradient(180deg, #06b6d4 0%, #38bdf8 50%, #6366f1 100%)'
};

/** 获取类别对应的渐变色 */
function getCategoryGradient(category) {
  return CATEGORY_GRADIENTS[category] || 'linear-gradient(180deg, #6366f1 0%, #818cf8 100%)';
}

/** 高亮搜索关键词 */
function highlightText(text, keyword) {
  if (!keyword || !text) return escapeHtml(text || '');
  const escaped = escapeHtml(text);
  const escapedKeyword = escapeHtml(keyword);
  // 使用全局不区分大小写的正则匹配
  const regex = new RegExp(`(${escapedKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return escaped.replace(regex, '<mark class="search-highlight">$1</mark>');
}

/** 渲染模型卡片网格 */
function renderModelGrid(data) {
  const grid = document.getElementById('modelGrid');
  const empty = document.getElementById('emptyState');
  if (!grid || !empty) return;

  if (!data || data.length === 0) {
    grid.style.display = 'none';
    empty.style.display = 'block';
    return;
  }

  grid.style.display = 'grid';
  empty.style.display = 'none';

  // 获取当前搜索关键词
  const searchInput = document.getElementById('searchInput');
  const keyword = searchInput ? searchInput.value.trim() : '';

  grid.innerHTML = data.map((m, index) => {
    const gradient = getCategoryGradient(m.category);
    const isFav = userState.favorites.includes(m.name);
    const isCompareSelected = compareState.selected.includes(m.name);
    return `
    <div class="model-card ${compareState.enabled ? 'compare-mode' : ''}" onclick="${compareState.enabled ? '' : `showDetail(${m.id})`}"
         style="animation: fadeInUp 0.4s var(--ease-out) ${index * 0.05}s both;"
         role="button" tabindex="0"
         aria-label="${escapeHtml(m.name)}"
         onkeydown="if(event.key==='Enter') ${compareState.enabled ? '' : `showDetail(${m.id})`}">
      ${compareState.enabled ? `<div class="compare-checkbox ${isCompareSelected ? 'checked' : ''}" data-model-name="${escapeHtml(m.name)}" role="checkbox" aria-checked="${isCompareSelected}" tabindex="0" aria-label="选择${escapeHtml(m.name)}进行对比" onclick="toggleCompareSelection('${escapeHtml(m.name).replace(/'/g, "\\'")}', event)" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();toggleCompareSelection('${escapeHtml(m.name).replace(/'/g, "\\'")}',event)}"></div>` : ''}
      <button class="fav-btn ${isFav ? 'active' : ''}" data-model-name="${escapeHtml(m.name)}" onclick="event.stopPropagation(); toggleFavorite('${escapeHtml(m.name).replace(/'/g, "\\'")}')" aria-label="收藏">${isFav ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.5"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>' : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>'}</button>
      <div class="card-visual" style="background: ${gradient};">
        <div class="card-visual-inner">
          <div class="card-visual-bar"></div>
          <div class="card-visual-bar"></div>
          <div class="card-visual-bar"></div>
          <div class="card-visual-bar"></div>
          <div class="card-visual-bar"></div>
        </div>
      </div>
      <div class="card-content">
        <div class="card-header">
          <span class="card-name">${highlightText(m.name, keyword)}</span>
          <span class="card-year">${m.year || ''}</span>
        </div>
        ${m.category ? `<span class="card-category">${highlightText(m.category, keyword)}</span>` : ''}
        <p class="card-desc">${highlightText(m.description || '', keyword)}</p>
        <div class="card-meta">
          ${m.architecture ? `<span><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:2px"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>${highlightText(m.architecture, keyword)}</span>` : ''}
          ${m.parameters ? `<span><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:2px"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>${escapeHtml(m.parameters)}</span>` : ''}
        </div>
        ${m.tags && m.tags.length ? `
          <div class="card-tags">
            ${m.tags.slice(0, 4).map(t => `<span class="tag">${highlightText(t, keyword)}</span>`).join('')}
            ${m.tags.length > 4 ? `<span class="tag">+${m.tags.length - 4}</span>` : ''}
          </div>
        ` : ''}
        <span class="card-enter-btn" onclick="event.stopPropagation(); navigate('model', {name: '${escapeHtml(m.name).replace(/'/g, "\\'")}'})">查看详情 →</span>
      </div>
    </div>
  `}).join('');
}

// ==================== 模型详情页 ====================

/** 渲染模型详情页 */
function renderModelPage(modelName) {
  const m = state.models.find(x => x.name === modelName);
  if (!m) {
    const modelPageBody = document.getElementById('modelPageBody');
    if (modelPageBody) modelPageBody.innerHTML = '<div class="model-page-placeholder"><p>模型未找到</p></div>';
    return;
  }

  // 更新面包屑
  const catLink = document.getElementById('modelBreadcrumbCat');
  if (catLink) {
    catLink.textContent = m.category || '未分类';
    catLink.onclick = function (e) {
      e.preventDefault();
      navigate('category', { category: m.category });
    };
  }
  const breadcrumbName = document.getElementById('modelBreadcrumbName');
  if (breadcrumbName) breadcrumbName.textContent = m.name;

  const body = document.getElementById('modelPageBody');
  const vizConfig = VIZ_CONFIGS[m.name];

  if (vizConfig) {
    renderVizPage(m, vizConfig, body);
  } else {
    renderInfoPage(m, body);
  }
}

/** 渲染带可视化的模型页面 */
function renderVizPage(m, vizConfig, container) {
  // 初始化可视化状态
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
    <div class="model-page-hero">
      <h1>${escapeHtml(m.name)}</h1>
      ${m.fullName ? `<p class="model-page-fullname">${escapeHtml(m.fullName)}</p>` : ''}
      <div class="model-page-badges">
        ${m.year ? `<span class="badge badge-year">${m.year}</span>` : ''}
        ${m.category ? `<span class="badge badge-category">${escapeHtml(m.category)}</span>` : ''}
        ${m.architecture ? `<span class="badge badge-arch">${escapeHtml(m.architecture)}</span>` : ''}
      </div>
    </div>

    <div class="viz-split-layout">
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

        <div class="viz-code-panel">
          <div class="viz-code-header">
            <h3>代码实现</h3>
            <span class="viz-code-lang">PyTorch</span>
          </div>
          <button class="code-copy-btn" onclick="copyCode()">复制代码</button>
          <div class="viz-code-body">
            <pre id="vizCodeBlock"></pre>
          </div>
        </div>
      </div>

      <div class="viz-info-sidebar">
        <!-- 简介 -->
        <div class="accordion-section open" id="accordion-intro">
          <button class="accordion-header" onclick="toggleAccordion('intro')">
            <span>简介</span>
            <span class="accordion-arrow">▼</span>
          </button>
          <div class="accordion-body">
            <div class="accordion-content">
              <p>${addTermTooltips(m.description || '暂无简介')}</p>
            </div>
          </div>
        </div>

        <!-- 核心创新 -->
        <div class="accordion-section" id="accordion-innovation">
          <button class="accordion-header" onclick="toggleAccordion('innovation')">
            <span>核心创新</span>
            <span class="accordion-arrow">▼</span>
          </button>
          <div class="accordion-body">
            <div class="accordion-content">
              <p>${addTermTooltips(m.keyInnovation || '暂无核心创新信息')}</p>
            </div>
          </div>
        </div>

        <!-- 详细信息 -->
        <div class="accordion-section" id="accordion-details">
          <button class="accordion-header" onclick="toggleAccordion('details')">
            <span>详细信息</span>
            <span class="accordion-arrow">▼</span>
          </button>
          <div class="accordion-body">
            <div class="accordion-content">
              <div class="model-page-info-grid">
                ${m.author ? `<div class="model-page-info-item"><div class="label">作者</div><div class="value">${escapeHtml(m.author)}</div></div>` : ''}
                ${m.organization ? `<div class="model-page-info-item"><div class="label">机构</div><div class="value">${escapeHtml(m.organization)}</div></div>` : ''}
                ${m.parameters ? `<div class="model-page-info-item"><div class="label">参数量</div><div class="value">${escapeHtml(m.parameters)}</div></div>` : ''}
                ${m.datasets ? `<div class="model-page-info-item"><div class="label">训练数据集</div><div class="value">${escapeHtml(m.datasets)}</div></div>` : ''}
                ${m.performance ? `<div class="model-page-info-item"><div class="label">性能指标</div><div class="value">${escapeHtml(m.performance)}</div></div>` : ''}
              </div>
            </div>
          </div>
        </div>

        <!-- 参考链接 -->
        <div class="accordion-section" id="accordion-links">
          <button class="accordion-header" onclick="toggleAccordion('links')">
            <span>参考链接</span>
            <span class="accordion-arrow">▼</span>
          </button>
          <div class="accordion-body">
            <div class="accordion-content">
              <div class="model-page-links">
                ${m.paperUrl ? `<a href="${escapeHtml(m.paperUrl)}" target="_blank" rel="noopener">论文</a>` : '<span style="color:var(--text-muted)">暂无论文链接</span>'}
                ${m.codeUrl ? `<a href="${escapeHtml(m.codeUrl)}" target="_blank" rel="noopener">代码</a>` : ''}
              </div>
            </div>
          </div>
        </div>

        <!-- 标签 -->
        <div class="accordion-section" id="accordion-tags">
          <button class="accordion-header" onclick="toggleAccordion('tags')">
            <span>标签</span>
            <span class="accordion-arrow">▼</span>
          </button>
          <div class="accordion-body">
            <div class="accordion-content">
              <div class="model-page-tags">
                ${m.tags && m.tags.length ? m.tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('') : '<span style="color:var(--text-muted)">暂无标签</span>'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // 渲染可视化
  if (vizConfig.type === 'mlp') {
    renderMLPNetwork(vizConfig);
    renderMLPCode(vizConfig);
  } else if (vizConfig.blocks) {
    renderBlockNetwork(vizConfig);
    renderBlockCode(vizConfig);
  }
}

/** 手风琴展开/折叠控制 */
function toggleAccordion(sectionId) {
  const section = document.getElementById('accordion-' + sectionId);
  if (!section) return;
  section.classList.toggle('open');
}

/** 渲染无可视化配置的模型信息页 */
function renderInfoPage(m, container) {
  container.innerHTML = `
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

    ${(m.paperUrl || m.codeUrl) ? `
    <div class="model-page-section">
      <h2>参考链接</h2>
      <div class="model-page-links">
        ${m.paperUrl ? `<a href="${escapeHtml(m.paperUrl)}" target="_blank" rel="noopener">论文</a>` : ''}
        ${m.codeUrl ? `<a href="${escapeHtml(m.codeUrl)}" target="_blank" rel="noopener">代码</a>` : ''}
      </div>
    </div>
    ` : ''}

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

// ==================== 可视化引擎 ====================

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

      // 窗口大小变化时重绘连接线
      if (window._vizEdgeResizeHandler) {
        window.removeEventListener('resize', window._vizEdgeResizeHandler);
      }
      window._vizEdgeResizeHandler = () => {
        renderEdges(vizConfig, colBody);
      };
      window.addEventListener('resize', window._vizEdgeResizeHandler);
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
  const offset = blockRect.left - bodyRect.left + prevBody.scrollLeft;
  colBody.style.scrollBehavior = 'smooth';
  colBody.scrollLeft = offset;
  requestAnimationFrame(() => {
    colBody.style.scrollBehavior = '';
  });
}

/** 列宽变化后重新对齐所有可见列 */
function realignAllColumns() {
  const vs = state.vizState;
  if (!vs.expandedPath || vs.expandedPath.length === 0) return;
  for (let i = 1; i < vs.expandedPath.length + 1; i++) {
    const parentId = vs.expandedPath[i - 1];
    if (parentId) {
      alignColumnToBlock(i, parentId);
    }
  }
}

/** 绘制 SVG 连接线 */
function renderEdges(vizConfig, colBody) {
  const svg = colBody.querySelector('.viz-edges-svg');
  if (!svg || !vizConfig.edges) return;

  // 清空已有路径
  svg.innerHTML = '';

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
      // 列宽变化后触发重新对齐和重绘连接线
      realignAllColumns();
      const colBody = col.querySelector('.viz-col-body');
      if (colBody) {
        const nameEl = document.getElementById('modelBreadcrumbName');
        const modelName = nameEl ? nameEl.textContent : '';
        const config = VIZ_CONFIGS[modelName];
        if (config) {
          requestAnimationFrame(() => renderEdges(config, colBody));
        }
      }
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
  const maxDisplayNeurons = 50;

  // 性能优化：对高密度层进行简化表示
  layers.forEach(layer => {
    if (layer.size > maxDisplayNeurons) {
      layer.displaySize = maxDisplayNeurons;
      layer.isSimplified = true;
    } else {
      layer.displaySize = layer.size;
      layer.isSimplified = false;
    }
  });

  const maxNeurons = Math.max(...layers.map(l => l.displaySize));
  const svgWidth = layers.length * layerGap + 60;
  const svgHeight = Math.max(maxNeurons * neuronGap + 80, 300);
  const layerWidth = 60;

  let svg = `<svg width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}" xmlns="http://www.w3.org/2000/svg">`;

  // 连接线（简化模式下只绘制部分代表性连接）
  for (let i = 0; i < layers.length - 1; i++) {
    const x1 = 40 + i * layerGap + layerWidth;
    const x2 = 40 + (i + 1) * layerGap;
    const y1Start = (svgHeight - layers[i].displaySize * neuronGap) / 2 + neuronGap / 2;
    const y2Start = (svgHeight - layers[i + 1].displaySize * neuronGap) / 2 + neuronGap / 2;

    const isActive = state.vizState.selectedBlock &&
      (state.vizState.selectedBlock === layers[i].id || state.vizState.selectedBlock === layers[i + 1].id);

    if (layers[i].isSimplified || layers[i + 1].isSimplified) {
      // 简化表示：绘制稀疏的连接线
      const step1 = Math.max(1, Math.floor(layers[i].displaySize / 12));
      const step2 = Math.max(1, Math.floor(layers[i + 1].displaySize / 12));
      for (let n1 = 0; n1 < layers[i].displaySize; n1 += step1) {
        for (let n2 = 0; n2 < layers[i + 1].displaySize; n2 += step2) {
          const y1 = y1Start + n1 * neuronGap;
          const y2 = y2Start + n2 * neuronGap;
          svg += `<line class="nn-connection ${isActive ? 'active' : ''}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
        }
      }
    } else {
      for (let n1 = 0; n1 < layers[i].displaySize; n1++) {
        for (let n2 = 0; n2 < layers[i + 1].displaySize; n2++) {
          const y1 = y1Start + n1 * neuronGap;
          const y2 = y2Start + n2 * neuronGap;
          svg += `<line class="nn-connection ${isActive ? 'active' : ''}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
        }
      }
    }
  }

  // 层
  for (let i = 0; i < layers.length; i++) {
    const layer = layers[i];
    const x = 40 + i * layerGap;
    const yStart = (svgHeight - layer.displaySize * neuronGap) / 2;
    const rectHeight = layer.displaySize * neuronGap + 10;
    const rectY = yStart - 5;
    const isSelected = state.vizState.selectedBlock === layer.id;

    svg += `<g class="nn-layer-group ${isSelected ? 'selected' : ''}" onclick="onMLPLayerClick('${layer.id}')">`;
    svg += `<rect class="nn-layer-rect" x="${x}" y="${rectY}" width="${layerWidth}" height="${rectHeight}" rx="8" fill="#1a1d27" stroke="${isSelected ? '#38bdf8' : '#2d3148'}" stroke-width="${isSelected ? 2.5 : 1}"/>`;

    for (let n = 0; n < layer.displaySize; n++) {
      const ny = yStart + n * neuronGap + neuronGap / 2;
      const nx = x + layerWidth / 2;
      svg += `<circle class="nn-neuron ${isSelected ? 'active' : ''}" cx="${nx}" cy="${ny}" r="${neuronRadius}"/>`;
    }

    svg += `<text class="nn-layer-label" x="${x + layerWidth / 2}" y="${rectY - 10}">${escapeHtml(layer.label)}</text>`;
    const subLabel = layer.isSimplified ? `${layer.size} neurons (显示前${layer.displaySize}个)` : `${layer.size} neurons`;
    svg += `<text class="nn-layer-sublabel" x="${x + layerWidth / 2}" y="${rectY + rectHeight + 16}">${subLabel}</text>`;
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

// ==================== 代码生成 ====================

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
  html = html.replace(/("""[\s\S]*?"""|'''[\s\S]*?''')/g, '<span class="syn-string">$1</span>');
  html = html.replace(/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g, '<span class="syn-string">$1</span>');

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
    } else if (block.type === 'attention' && block.params) {
      const p = block.params;
      addLine(`        self.${block.id} = nn.MultiheadAttention(${p.embed_dim}, ${p.num_heads}, batch_first=True)`, block.id);
    } else if (block.type === 'norm' && block.params) {
      const p = block.params;
      if (p.norm_type === 'layer') {
        addLine(`        self.${block.id} = nn.LayerNorm(${p.normalized_shape})`, block.id);
      } else if (p.norm_type === 'batch2d') {
        addLine(`        self.${block.id} = nn.BatchNorm2d(${p.num_features})`, block.id);
      } else if (p.norm_type === 'batch1d') {
        addLine(`        self.${block.id} = nn.BatchNorm1d(${p.num_features})`, block.id);
      } else {
        addLine(`        self.${block.id} = nn.LayerNorm(${p.normalized_shape || p.num_features})`, block.id);
      }
    } else if (block.type === 'activation' && block.params) {
      const p = block.params;
      const actName = p.act || 'ReLU';
      addLine(`        self.${block.id} = nn.${actName}()`, block.id);
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
    if (['conv', 'linear', 'mlp', 'pool', 'dropout', 'attention', 'norm', 'activation'].includes(block.type) && block.params) {
      if (block.type === 'attention') {
        addLine(`        x, _ = self.${block.id}(x, x, x)`, block.id);
      } else {
        addLine(`        x = self.${block.id}(x)`, block.id);
      }
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

  // 先让浮窗可见以获取实际尺寸
  codeTooltip.style.visibility = 'hidden';
  codeTooltip.classList.add('visible');

  const triggerRect = element.getBoundingClientRect();
  const tooltipRect = codeTooltip.getBoundingClientRect();
  const margin = 12;

  let left = triggerRect.right + margin;
  let top = triggerRect.top;

  // 检测右边界：如果超出则显示在元素左侧
  if (left + tooltipRect.width > window.innerWidth - margin) {
    left = triggerRect.left - tooltipRect.width - margin;
  }
  // 如果左侧也超出，则靠右对齐
  if (left < margin) {
    left = window.innerWidth - tooltipRect.width - margin;
  }
  // 最终兜底
  if (left < margin) left = margin;

  // 检测下边界：如果超出则向上显示
  if (top + tooltipRect.height > window.innerHeight - margin) {
    top = triggerRect.bottom - tooltipRect.height;
  }
  // 如果上方也超出，则贴底
  if (top < margin) {
    top = window.innerHeight - tooltipRect.height - margin;
  }
  // 最终兜底
  if (top < margin) top = margin;

  codeTooltip.style.top = top + 'px';
  codeTooltip.style.left = left + 'px';
  codeTooltip.style.visibility = 'visible';
}

/** 隐藏代码浮窗 */
function hideCodeTooltip() {
  if (codeTooltip) {
    codeTooltip.classList.remove('visible');
    codeTooltip.style.visibility = '';
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

/** 滚动时隐藏代码浮窗 */
window.addEventListener('scroll', function() {
  hideCodeTooltip();
}, true);

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
    } else if (block.type === 'attention' && block.params) {
      const p = block.params;
      addLine(`        self.${block.id} = nn.MultiheadAttention(${p.embed_dim}, ${p.num_heads}, batch_first=True)`, block.id);
    } else if (block.type === 'norm' && block.params) {
      const p = block.params;
      if (p.norm_type === 'layer') {
        addLine(`        self.${block.id} = nn.LayerNorm(${p.normalized_shape})`, block.id);
      } else if (p.norm_type === 'batch2d') {
        addLine(`        self.${block.id} = nn.BatchNorm2d(${p.num_features})`, block.id);
      } else if (p.norm_type === 'batch1d') {
        addLine(`        self.${block.id} = nn.BatchNorm1d(${p.num_features})`, block.id);
      } else {
        addLine(`        self.${block.id} = nn.LayerNorm(${p.normalized_shape || p.num_features})`, block.id);
      }
    } else if (block.type === 'activation' && block.params) {
      const p = block.params;
      const actName = p.act || 'ReLU';
      addLine(`        self.${block.id} = nn.${actName}()`, block.id);
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
    if (['conv', 'linear', 'mlp', 'pool', 'dropout', 'attention', 'norm', 'activation'].includes(block.type) && block.params) {
      if (block.type === 'attention') {
        addLine(`        x, _ = self.${block.id}(x, x, x)`, block.id);
      } else {
        addLine(`        x = self.${block.id}(x)`, block.id);
      }
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

// ==================== 模态框 ====================

/** 模态框打开计数器，防止多模态框时 overflow 状态混乱 */
let modalOpenCount = 0;

/** 显示模态框 */
function openModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;

  // 清除可能残留的 exiting 状态
  modal.classList.remove('exiting');

  // 记录触发元素
  modal._triggerEl = document.activeElement;

  modal.classList.add('active');

  // 引用计数管理 overflow
  modalOpenCount++;
  document.body.style.overflow = 'hidden';
  
  // 将焦点移入弹窗
  requestAnimationFrame(() => {
    const firstFocusable = modal.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (firstFocusable) firstFocusable.focus();
  });
  
  // 焦点陷阱
  modal._trapFocus = (e) => {
    if (e.key !== 'Tab') return;
    const focusables = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };
  modal.addEventListener('keydown', modal._trapFocus);
}

/** 关闭模态框 */
function closeModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;

  // 移除焦点陷阱
  if (modal._trapFocus) {
    modal.removeEventListener('keydown', modal._trapFocus);
  }

  // 引用计数递减，只有全部关闭时才恢复 overflow
  modalOpenCount = Math.max(0, modalOpenCount - 1);

  // 安全恢复焦点
  const restoreFocus = () => {
    try { if (modal._triggerEl) modal._triggerEl.focus(); } catch(e) {}
    modal._triggerEl = null;
  };

  // 检查用户是否偏好减少动画
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (prefersReducedMotion) {
    modal.classList.remove('active');
    if (modalOpenCount === 0) document.body.style.overflow = '';
    restoreFocus();
  } else {
    // 添加退出动画，使用 animationend 事件确保与CSS动画时长精确同步
    modal.classList.add('exiting');
    const onEnd = () => {
      modal.removeEventListener('animationend', onEnd);
      modal.classList.remove('active', 'exiting');
      if (modalOpenCount === 0) document.body.style.overflow = '';
      restoreFocus();
    };
    modal.addEventListener('animationend', onEnd, { once: true });
    // 安全回退：300ms后强制清理（覆盖CSS中最长的退出动画时长）
    setTimeout(() => {
      if (modal.classList.contains('exiting')) {
        modal.removeEventListener('animationend', onEnd);
        modal.classList.remove('active', 'exiting');
        if (modalOpenCount === 0) document.body.style.overflow = '';
        restoreFocus();
      }
    }, 300);
  }
}

/** 显示模型详情模态框 */
function showDetail(id) {
  const m = state.models.find(x => x.id === id);
  if (!m) return;
  navigate('model', {name: m.name});
}

// ==================== 登录/注册模态框 ====================

/** 显示交互指南弹窗 */
function showInteractionGuide() {
  openModal('interactionGuideModal');
  initInteractionSettings();
  // 焦点管理：聚焦到弹窗内第一个可交互元素
  setTimeout(() => {
    const firstToggle = document.querySelector('#interactionGuideModal .ios-toggle-input');
    if (firstToggle) firstToggle.focus();
  }, 100);
}

/** 初始化交互设置（iOS 风格开关 + 总开关/子开关联动） */
function initInteractionSettings() {
  const config = window.LetterSystem?.config;
  if (!config) return;

  // 总开关 → 子开关映射
  const groupMap = {
    mouseInteractions: ['hover', 'clickGaze', 'bodyReaction', 'scaredBounce', 'squashStretch'],
    lazyActions: ['lazyNodOff', 'lazyYawn', 'lazyStretch', 'lazyZoneOut', 'lazyPeek', 'lazyRubEyes'],
    socialInteractions: ['socialWhisper', 'socialEyeContact', 'snakeFollow', 'socialCelebrate'],
  };

  // 子开关 → config 映射
  const settingToConfig = {
    hover: 'hover',
    clickGaze: 'clickGaze',
    bodyReaction: 'bodyReaction',
    scaredBounce: 'scaredBounce',
    squashStretch: 'squashStretch',
    eyeTracking: 'eyeTracking',
    lazyActions: 'lazyActions',
    socialInteractions: 'socialInteractions',
    snakeFollow: 'snakeFollow',
    lazyNodOff: 'lazyNodOff',
    lazyYawn: 'lazyYawn',
    lazyStretch: 'lazyStretch',
    lazyZoneOut: 'lazyZoneOut',
    lazyPeek: 'lazyPeek',
    lazyRubEyes: 'lazyRubEyes',
    socialWhisper: 'socialWhisper',
    socialEyeContact: 'socialEyeContact',
    socialCelebrate: 'socialCelebrate',
  };

  // 确保所有子开关 key 在 config 中存在
  Object.keys(settingToConfig).forEach(key => {
    if (config[key] === undefined) config[key] = true;
  });

  // 获取所有开关
  const allToggles = document.querySelectorAll('.ios-toggle-input[data-setting]');

  allToggles.forEach(input => {
    const key = input.dataset.setting;

    // 从 localStorage 恢复
    const saved = localStorage.getItem(`letter-${key}`);
    if (saved !== null) {
      input.checked = saved === 'true';
    } else {
      input.checked = config[key] !== false;
    }
    config[key] = input.checked;

    // 监听变化
    input.addEventListener('change', () => {
      config[key] = input.checked;
      input.setAttribute('aria-checked', input.checked);
      localStorage.setItem(`letter-${key}`, input.checked);

      // 总开关变化 → 同步所有子开关
      if (groupMap[key]) {
        const children = groupMap[key];
        children.forEach(childKey => {
          config[childKey] = input.checked;
          localStorage.setItem(`letter-${childKey}`, input.checked);
          const childInput = document.querySelector(`.ios-toggle-input[data-setting="${childKey}"]`);
          if (childInput) {
            childInput.checked = input.checked;
            childInput.setAttribute('aria-checked', input.checked);
          }
        });
      }

      // I19创新：子开关变化 → 更新总开关状态（支持indeterminate）
      Object.entries(groupMap).forEach(([groupKey, children]) => {
        const groupInput = document.querySelector(`.ios-toggle-input[data-setting="${groupKey}"]`);
        if (!groupInput) return;
        if (children.includes(key)) {
          const allOn = children.every(c => config[c]);
          const allOff = children.every(c => !config[c]);
          
          // I19创新：设置indeterminate状态
          if (allOn) {
            groupInput.checked = true;
            groupInput.indeterminate = false;
          } else if (allOff) {
            groupInput.checked = false;
            groupInput.indeterminate = false;
          } else {
            // 部分开启：indeterminate状态
            groupInput.checked = false;
            groupInput.indeterminate = true;
          }
          
          config[groupKey] = allOn; // 只有全部开启才算开启
          localStorage.setItem(`letter-${groupKey}`, allOn);
          groupInput.setAttribute('aria-checked', allOn ? 'true' : 'mixed');
        }
      });

      // 检查是否需要重启动画循环（当开关从全部关闭变为部分开启时）
      if (window.LetterSystem?.restartAnimation) {
        window.LetterSystem.restartAnimation();
      }
    });
  });
}

/** 显示登录模态框（带可选的登录后回调） */
function showLoginModal(callback) {
  state.pendingLoginCallback = callback || null;
  switchAuthTab('login');
  // 清空表单
  const loginForm = document.getElementById('loginForm');
  if (loginForm) loginForm.reset();
  const regForm = document.getElementById('registerForm');
  if (regForm) regForm.reset();
  // 隐藏错误
  const loginErr = document.getElementById('loginFormError');
  if (loginErr) loginErr.style.display = 'none';
  const regErr = document.getElementById('registerFormError');
  if (regErr) regErr.style.display = 'none';
  openModal('loginModal');
  setTimeout(() => {
    const firstInput = document.getElementById('loginUsername');
    if (firstInput) firstInput.focus();
  }, 100);
}

/** 切换登录/注册标签 */
function switchAuthTab(tab) {
  const loginTab = document.getElementById('authTabLogin');
  const regTab = document.getElementById('authTabRegister');
  const loginPanel = document.getElementById('loginPanel');
  const regPanel = document.getElementById('registerPanel');
  const indicator = document.getElementById('authTabIndicator');

  if (tab === 'login') {
    if (loginTab) { loginTab.classList.add('active'); loginTab.setAttribute('aria-selected', 'true'); }
    if (regTab) { regTab.classList.remove('active'); regTab.setAttribute('aria-selected', 'false'); }
    if (loginPanel) loginPanel.style.display = 'block';
    if (regPanel) regPanel.style.display = 'none';
    if (indicator) indicator.style.left = '0';
  } else {
    if (loginTab) { loginTab.classList.remove('active'); loginTab.setAttribute('aria-selected', 'false'); }
    if (regTab) { regTab.classList.add('active'); regTab.setAttribute('aria-selected', 'true'); }
    if (loginPanel) loginPanel.style.display = 'none';
    if (regPanel) regPanel.style.display = 'block';
    if (indicator) indicator.style.left = '50%';
  }
}

/** 处理登录表单提交 */
async function handleLogin(e) {
  if (e) e.preventDefault();
  const usernameEl = document.getElementById('loginUsername');
  const passwordEl = document.getElementById('loginPassword');
  const username = usernameEl ? usernameEl.value.trim() : '';
  const password = passwordEl ? passwordEl.value : '';
  const errorEl = document.getElementById('loginFormError');

  // 验证
  if (!username || !password) {
    if (errorEl) {
      errorEl.textContent = '请填写用户名和密码';
      errorEl.style.display = 'block';
    }
    return;
  }

  const success = await loginUser(username, password);
  if (success) {
    closeModal('loginModal');
    // 执行待处理的回调
    if (state.pendingLoginCallback) {
      const cb = state.pendingLoginCallback;
      state.pendingLoginCallback = null;
      setTimeout(cb, 100);
    }
  } else {
    if (errorEl) {
      errorEl.textContent = '用户名或密码错误';
      errorEl.style.display = 'block';
    }
  }
}

/** 处理注册表单提交 */
async function handleRegister(e) {
  if (e) e.preventDefault();
  const username = document.getElementById('regUsername').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPassword').value;
  const confirmPassword = document.getElementById('regConfirmPassword').value;
  const errorEl = document.getElementById('registerFormError');

  // 验证用户名
  if (!username || username.length < 3 || username.length > 20) {
    if (errorEl) {
      errorEl.textContent = '用户名需要3-20个字符';
      errorEl.style.display = 'block';
    }
    return;
  }

  // 验证邮箱
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    if (errorEl) {
      errorEl.textContent = '请输入有效的邮箱地址';
      errorEl.style.display = 'block';
    }
    return;
  }

  // 验证密码
  if (!password || password.length < 6) {
    if (errorEl) {
      errorEl.textContent = '密码至少需要6个字符';
      errorEl.style.display = 'block';
    }
    return;
  }

  // 验证确认密码
  if (password !== confirmPassword) {
    if (errorEl) {
      errorEl.textContent = '两次输入的密码不一致';
      errorEl.style.display = 'block';
    }
    return;
  }

  const success = await registerUser(username, email, password);
  if (success) {
    showToast('注册成功，请登录', 'success');
    switchAuthTab('login');
    // 自动填充用户名
    const loginUsername = document.getElementById('loginUsername');
    if (loginUsername) loginUsername.value = username;
    const loginPassword = document.getElementById('loginPassword');
    if (loginPassword) loginPassword.focus();
  }
}

/** 密码强度检测 */
function checkPasswordStrength(password) {
  const indicator = document.getElementById('passwordStrength');
  if (!indicator) return;

  let strength = 0;
  if (password.length >= 6) strength++;
  if (password.length >= 10) strength++;
  if (/[A-Z]/.test(password)) strength++;
  if (/[0-9]/.test(password)) strength++;
  if (/[^A-Za-z0-9]/.test(password)) strength++;

  const labels = ['', '弱', '较弱', '中等', '较强', '强'];
  const colors = ['', '#ef4444', '#f97316', '#f59e0b', '#22c55e', '#22c55e'];
  const widths = ['0%', '20%', '40%', '60%', '80%', '100%'];

  indicator.style.width = widths[strength];
  indicator.style.background = colors[strength];
  indicator.textContent = password ? labels[strength] : '';
}

/** 用户菜单下拉切换 */
function toggleUserMenu() {
  const menu = document.getElementById('userMenu');
  const btn = document.querySelector('.user-avatar-btn');
  if (menu) {
    const isOpen = menu.classList.toggle('active');
    if (btn) btn.setAttribute('aria-expanded', isOpen);
  }
}

/** 点击外部关闭用户菜单 */
document.addEventListener('click', function (e) {
  const userNav = document.getElementById('userNav');
  const menu = document.getElementById('userMenu');
  const btn = document.querySelector('.user-avatar-btn');
  if (userNav && menu && !userNav.contains(e.target)) {
    menu.classList.remove('active');
    if (btn) btn.setAttribute('aria-expanded', 'false');
  }
});

/** 退出管理 */
function logoutAdmin() {
  logoutUser();
  navigate('home');
}

/** 检查认证状态（兼容旧逻辑） */
function checkAuth() {
  // 由 restoreSession 统一处理
}

/** 渲染管理表格 */
function renderAdminTable() {
  const wrapper = document.getElementById('adminTable');
  if (!wrapper) return;
  if (state.models.length === 0) {
    wrapper.innerHTML = '<p style="color: var(--text-muted); padding: 40px; text-align: center;">暂无模型数据，点击"添加模型"开始</p>';
    return;
  }

  const sorted = [...state.models].sort((a, b) => {
    if (a.category !== b.category) return (a.category || '').localeCompare(b.category || '');
    return (a.year || 0) - (b.year || 0);
  });

  wrapper.innerHTML = `
    <table class="admin-table">
      <thead>
        <tr>
          <th>ID</th>
          <th>名称</th>
          <th>类别</th>
          <th>年份</th>
          <th>架构</th>
          <th>作者</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        ${sorted.map(m => `
          <tr>
            <td>${m.id}</td>
            <td><strong>${escapeHtml(m.name)}</strong></td>
            <td>${escapeHtml(m.category || '-')}</td>
            <td>${m.year || '-'}</td>
            <td>${escapeHtml(m.architecture || '-')}</td>
            <td>${escapeHtml(m.author || '-')}</td>
            <td class="actions">
              <button class="btn btn-secondary btn-sm" onclick="showEditForm(${m.id})">编辑</button>
              <button class="btn btn-danger btn-sm" onclick="deleteModel(${m.id})">删除</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

/** 显示添加表单 */
function showAddForm() {
  document.getElementById('editTitle').textContent = '添加模型';
  document.getElementById('editForm').reset();
  document.getElementById('editId').value = '';
  openModal('editModal');
}

/** 显示编辑表单 */
function showEditForm(id) {
  const m = state.models.find(x => x.id === id);
  if (!m) return;

  document.getElementById('editTitle').textContent = '编辑模型';
  document.getElementById('editId').value = m.id;
  document.getElementById('editName').value = m.name || '';
  document.getElementById('editFullName').value = m.fullName || '';
  document.getElementById('editYear').value = m.year || '';
  document.getElementById('editAuthor').value = m.author || '';
  document.getElementById('editOrganization').value = m.organization || '';
  document.getElementById('editCategory').value = m.category || '';
  document.getElementById('editArchitecture').value = m.architecture || '';
  document.getElementById('editParameters').value = m.parameters || '';
  document.getElementById('editDescription').value = m.description || '';
  document.getElementById('editKeyInnovation').value = m.keyInnovation || '';
  document.getElementById('editDatasets').value = m.datasets || '';
  document.getElementById('editPerformance').value = m.performance || '';
  document.getElementById('editPaperUrl').value = m.paperUrl || '';
  document.getElementById('editCodeUrl').value = m.codeUrl || '';
  document.getElementById('editTags').value = (m.tags || []).join(', ');

  openModal('editModal');
}

/** 保存模型（添加或编辑） */
function saveModel(e) {
  e.preventDefault();

  const id = document.getElementById('editId').value;
  const tagsStr = document.getElementById('editTags').value;
  const tags = tagsStr ? tagsStr.split(',').map(t => t.trim()).filter(Boolean) : [];

  const modelData = {
    name: document.getElementById('editName').value.trim(),
    fullName: document.getElementById('editFullName').value.trim(),
    year: parseInt(document.getElementById('editYear').value, 10) || null,
    author: document.getElementById('editAuthor').value.trim(),
    organization: document.getElementById('editOrganization').value.trim(),
    category: document.getElementById('editCategory').value.trim(),
    architecture: document.getElementById('editArchitecture').value.trim(),
    parameters: document.getElementById('editParameters').value.trim(),
    description: document.getElementById('editDescription').value.trim(),
    keyInnovation: document.getElementById('editKeyInnovation').value.trim(),
    datasets: document.getElementById('editDatasets').value.trim(),
    performance: document.getElementById('editPerformance').value.trim(),
    paperUrl: document.getElementById('editPaperUrl').value.trim(),
    codeUrl: document.getElementById('editCodeUrl').value.trim(),
    tags: tags
  };

  // 数据验证
  if (!modelData.name) { showToast('模型名称不能为空', 'error'); return; }
  if (modelData.year && (modelData.year < 1940 || modelData.year > 2030)) { showToast('年份范围应在1940-2030之间', 'error'); return; }
  if (modelData.paperUrl && !/^https?:\/\/.+/.test(modelData.paperUrl)) { showToast('论文链接格式不正确', 'error'); return; }
  if (modelData.codeUrl && !/^https?:\/\/.+/.test(modelData.codeUrl)) { showToast('代码链接格式不正确', 'error'); return; }

  if (id) {
    const idx = state.models.findIndex(x => x.id === parseInt(id, 10));
    if (idx !== -1) {
      state.models[idx] = { ...state.models[idx], ...modelData };
      showToast('模型已更新', 'success');
    }
  } else {
    const newId = state.models.length > 0 ? Math.max(...state.models.map(m => m.id)) + 1 : 1;
    modelData.id = newId;
    state.models.push(modelData);
    showToast('模型已添加', 'success');
  }

  saveModels();
  renderAdminTable();
  closeModal('editModal');
}

/** 删除模型 */
function deleteModel(id) {
  const m = state.models.find(x => x.id === id);
  if (!m) return;
  // TODO: 替换为自定义确认模态框，避免使用原生confirm与Apple设计风格不协调
  if (!confirm(`确定要删除模型 "${m.name}" 吗？此操作不可撤销。`)) return;

  state.models = state.models.filter(x => x.id !== id);
  saveModels();

  // 清理收藏数据中已删除模型的残留条目
  if (userState.favorites) {
    const favIdx = userState.favorites.indexOf(m.name);
    if (favIdx !== -1) {
      userState.favorites.splice(favIdx, 1);
      saveUserState();
    }
  }

  renderAdminTable();
  showToast('模型已删除', 'success');
}

/** 导出数据 */
function exportData() {
  const json = JSON.stringify(state.models, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'models.json';
  a.click();
  // 延迟释放 Blob URL，避免 Firefox 等浏览器下载尚未开始就 revoke
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast('数据已导出', 'success');
}

/** 显示导入对话框 */
function showImportDialog() {
  document.getElementById('importData').value = '';
  document.getElementById('importError').style.display = 'none';
  openModal('importModal');
}

/** 导入数据 */
function importData() {
  const text = document.getElementById('importData').value.trim();
  const errorEl = document.getElementById('importError');

  // 输入长度限制，防止恶意超大数据
  if (text.length > 5 * 1024 * 1024) {
    errorEl.textContent = '导入失败：数据过大，最大支持5MB';
    errorEl.style.display = 'block';
    return;
  }

  // 允许的字段白名单，防止原型污染和注入
  const ALLOWED_KEYS = ['id', 'name', 'fullName', 'year', 'author', 'organization', 'category', 'architecture', 'parameters', 'description', 'keyInnovation', 'datasets', 'performance', 'paperUrl', 'codeUrl', 'tags'];

  try {
    const data = JSON.parse(text);
    if (!Array.isArray(data)) {
      throw new Error('数据必须是 JSON 数组');
    }
    if (data.length > 500) {
      throw new Error('数据量过大，最多支持500个模型');
    }
    const seenNames = new Set();
    const sanitizedData = data.map((item, i) => {
      if (!item || typeof item !== 'object') throw new Error(`第 ${i + 1} 项不是有效对象`);
      if (!item.name || typeof item.name !== 'string') throw new Error(`第 ${i + 1} 项缺少有效的 name 字段`);
      if (seenNames.has(item.name)) throw new Error(`第 ${i + 1} 项名称 "${item.name}" 重复`);
      seenNames.add(item.name);

      // 使用字段白名单创建干净的对象，防止原型污染
      const cleanItem = {};
      ALLOWED_KEYS.forEach(key => {
        if (item[key] !== undefined) cleanItem[key] = item[key];
      });
      if (!cleanItem.id) cleanItem.id = Date.now() + i;
      return cleanItem;
    });

    state.models = sanitizedData;
    saveModels();
    renderAdminTable();
    closeModal('importModal');
    showToast(`成功导入 ${sanitizedData.length} 个模型`, 'success');
  } catch (e) {
    errorEl.textContent = '导入失败：' + e.message;
    errorEl.style.display = 'block';
  }
}

// ==================== 键盘快捷键 ====================
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape' && !e.isComposing) {
    // 关闭用户菜单
    const userMenu = document.getElementById('userMenu');
    if (userMenu && userMenu.classList.contains('active')) {
      userMenu.classList.remove('active');
      const avatarBtn = document.getElementById('userAvatarBtn');
      if (avatarBtn) avatarBtn.setAttribute('aria-expanded', 'false');
      return;
    }
    // 关闭所有模态框
    document.querySelectorAll('.modal-overlay.active').forEach(modal => {
      closeModal(modal.id);
    });
  }
});

// 点击模态框外部关闭
document.addEventListener('click', function (e) {
  if (e.target.classList.contains('modal-overlay') && e.target.classList.contains('active')) {
    closeModal(e.target.id);
  }
});

// ==================== Hash 路由监听 ====================
window.addEventListener('hashchange', function () {
  const { view, params } = parseHash();
  if (view !== state.currentView) {
    navigate(view, params);
  }
});

// ==================== 初始化 ====================
async function init() {
  try {
    console.log('[Init] 开始初始化...');
    
    // 恢复主题
    restoreTheme();
    console.log('[Init] 主题恢复完成');

    // I10创新：访问计数与庆祝
    let visitCount = 0;
    let favLetter = null;
    try {
      visitCount = LetterMemory.incrementVisit();
      favLetter = LetterMemory.getFavoriteLetter();
      console.log('[Init] 访问计数:', visitCount);
    } catch (e) {
      console.warn('[Init] LetterMemory 初始化失败:', e);
    }

    // 初始化管理员密码（首次运行时）
    try {
      initAdminPassword();
      console.log('[Init] 管理员密码初始化完成');
    } catch (e) {
      console.warn('[Init] 管理员密码初始化失败:', e);
    }

    // 显示骨架屏
    const skeleton = document.getElementById('skeletonOverlay');
    if (skeleton) skeleton.style.display = 'block';

    // 加载数据
    console.log('[Init] 开始加载模型数据...');
    state.models = await loadModels();
    console.log('[Init] 模型数据加载完成，数量:', state.models.length);

    // 检查数据是否加载成功
    if (!state.models || state.models.length === 0) {
      console.error('[Init] 模型数据加载失败，请检查 models.json 文件是否存在且格式正确');
      if (skeleton) skeleton.style.display = 'none';

      // 检测是否为 file:// 协议
      const isFileProtocol = location.protocol === 'file:';
      const errorMessage = isFileProtocol
        ? `<p style="font-size:14px;color:#FF3B30;margin-bottom:10px;">检测到您正在通过 file:// 协议直接打开 HTML 文件</p>
           <p style="font-size:13px;margin-bottom:15px;">这会导致浏览器安全限制，无法加载数据文件</p>
           <div style="text-align:left;background:rgba(0,0,0,0.05);padding:15px;border-radius:8px;margin-bottom:15px;font-size:12px;">
             <p style="margin:0 0 8px 0;font-weight:600;">解决方案（任选其一）：</p>
             <p style="margin:0 0 5px 0;">1. 使用本地服务器：<code style="background:rgba(0,0,0,0.1);padding:2px 5px;border-radius:3px;">npx serve</code></p>
             <p style="margin:0 0 5px 0;">2. 使用 Python：<code style="background:rgba(0,0,0,0.1);padding:2px 5px;border-radius:3px;">python -m http.server</code></p>
             <p style="margin:0;">3. 使用 VS Code Live Server 扩展</p>
           </div>`
        : `<p style="font-size:14px;">请检查浏览器控制台获取详细信息</p>`;

      const errorOverlay = document.createElement('div');
      errorOverlay.id = 'errorOverlay';
      errorOverlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:10000;';
      errorOverlay.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:auto;color:var(--text-secondary);padding:30px;max-width:500px;margin:0 auto;background:var(--bg-primary);border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
          <p style="font-size:20px;margin-bottom:10px;color:var(--text-primary);">⚠️ 数据加载失败</p>
          ${errorMessage}
          <div style="display:flex;gap:10px;margin-top:10px;">
            <button onclick="location.reload()" style="padding:10px 20px;background:var(--accent-primary);color:white;border:none;border-radius:8px;cursor:pointer;">刷新页面</button>
            <button onclick="location.href=location.pathname+'?clear=true'" style="padding:10px 20px;background:var(--bg-surface);color:var(--text-primary);border:1px solid var(--border-color);border-radius:8px;cursor:pointer;">清除缓存</button>
          </div>
        </div>`;
      document.body.appendChild(errorOverlay);
      try {
        initLetterStage();
        initHeroInteractions();
      } catch (e) {
        console.warn('[Init] 字母系统初始化失败:', e);
      }
      // Still render home page so UI is complete even without data
      try {
        const skeleton = document.getElementById('skeletonOverlay');
        if (skeleton) skeleton.style.display = 'none';
        navigate('home');
      } catch (e) {
        console.warn('[Init] 首页渲染失败:', e);
      }
      return;
    }

    // 恢复会话（登录状态）
    console.log('[Init] 恢复会话...');
    restoreSession();

    // 初始化术语tooltip
    console.log('[Init] 初始化术语tooltip...');
    initTermTooltips();

    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      searchInput.addEventListener('input', () => applyFilters());
    }

    initLetterStage();
    initHeroInteractions();

    // 隐藏骨架屏
    console.log('[Init] 隐藏骨架屏...');
    if (skeleton) skeleton.style.display = 'none';

    // 解析当前 URL hash 并导航
    console.log('[Init] 解析路由并导航...');
    const { view, params } = parseHash();
    console.log('[Init] 导航到:', view, params);
    navigate(view, params);
  } catch (e) {
    console.error('初始化失败:', e);
    const skeleton = document.getElementById('skeletonOverlay');
    if (skeleton) skeleton.style.display = 'none';
    const errorOverlay = document.createElement('div');
    errorOverlay.id = 'errorOverlay';
    errorOverlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:10000;';
    errorOverlay.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;min-height:auto;color:var(--text-secondary);padding:30px;background:var(--bg-primary);border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,0.3);"><p>加载失败，请刷新页面重试</p></div>';
    document.body.appendChild(errorOverlay);
  }
}

// 安全初始化：处理 DOMContentLoaded 可能已触发的情况
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
