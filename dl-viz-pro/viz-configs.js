// ============================================================
// 深度学习模型可视化配置
// 每个模型定义：整体架构块 + 可展开的子模块 + 可调参数 + 代码模板
// ============================================================

// Lucide-style SVG icons (replacing emoji)
const LUCIDE_ICONS = {
  // Block types
  '📦': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a9 9 0 0 0 9 9"/><path d="M12 3a9 9 0 0 1 9 9"/><path d="M12 3v9h9"/></svg>',
  '🧩': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19.439 7.85c-.049.322.059.648.289.878l1.568 1.568c.47.47.706 1.087.706 1.704s-.235 1.233-.706 1.704l-1.611 1.611a.98.98 0 0 1-.837.276c-.47-.07-.802-.48-.968-.925a2.501 2.501 0 1 0-3.214 2.932 4.5 4.5 0 0 1-.326-.116 6 6 0 0 1-2.695-2.694l-.116-.326a2.501 2.501 0 1 0-3.214-2.932c-.166.445-.498.855-.968.925a.979.979 0 0 1-.837-.276L3.063 11.504a2.405 2.405 0 0 1 0-3.408l1.568-1.568a1.026 1.026 0 0 0 .289-.878.98.98 0 0 0-.276-.837L3.063 3.063a2.405 2.405 0 0 1 3.408 0l1.568 1.568a1.026 1.026 0 0 0 .878.289.98.98 0 0 0 .837-.276 2.5 2.5 0 1 0 3.214-2.932c.166-.445.498-.855.968-.925a.979.979 0 0 1 .837.276l1.611 1.611a2.405 2.405 0 0 1 0 3.408l-1.568 1.568a1.026 1.026 0 0 0-.289.878"/></svg>',
  '↪️': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>',
  '🔧': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>',
  '🔗': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
  '📋': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/></svg>',
  '⬇️': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="m19 12-7 7-7-7"/></svg>',
  '⬆️': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg>',
  '🔄': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74"/><path d="M21 3v6h-6"/></svg>',
  '🧱': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>',
  '⚡': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
  '🎯': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>',
  '🏗️': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>',
  '📐': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z"/><path d="m14.5 12.5 2-2"/><path d="m11.5 9.5 2-2"/><path d="m8.5 6.5 2-2"/><path d="m17.5 15.5 2-2"/></svg>',
  '⚙️': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>',
  '🎭': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>',
  '➕': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>',
  '🧠': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>',
  '🚪': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/></svg>',
  '📝': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>',
  '💾': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7"/><path d="M16 3h5v5"/><path d="M21 3l-9 9"/></svg>',
  '📤': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
  '📚': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>',
  '🏷️': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/></svg>',
  '📍': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>',
  '🎓': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 10 3 12 0v-5"/></svg>',
  '🔢': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16"/><path d="M4 12h8"/><path d="M4 18h16"/><rect x="14" y="10" width="4" height="4" rx="1"/></svg>',
  '👁️': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>',
  '🔀': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3h5v5"/><path d="M8 3H3v5"/><path d="M12 22v-5"/><path d="m21 3-7 7"/><path d="M3 3l7 7"/></svg>',
  '🔺': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m12 2 10 18H2Z"/></svg>',
  '🪟': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M9 3v18"/><path d="M15 3v18"/></svg>',
  '📊': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
  '📥': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>',
  '🔲': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>',
  '🔽': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>',
  '💨': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2"/><path d="M9.6 4.6A2 2 0 1 1 11 8H2"/><path d="M12.6 19.4A2 2 0 1 0 14 16H2"/></svg>',
  '📏': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z"/></svg>',
  '🎨': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="10.5" r="2.5"/><circle cx="8.5" cy="7.5" r="2.5"/><circle cx="6.5" cy="12.5" r="2.5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>'
};

// ---- 通用块类型 ----
// 'input'    - 输入层
// 'conv'     - 卷积块 (Conv + Activation + Pooling)
// 'linear'   - 全连接层
// 'mlp'      - 多层感知机块
// 'pool'     - 池化层
// 'dropout'  - Dropout 层
// 'attention'- 注意力模块
// 'norm'     - 归一化层
// 'activation'- 激活函数
// 'output'   - 输出层
// 'custom'   - 自定义复合模块（可展开）

const VIZ_CONFIGS = {

  // ==================== BP ====================
  'BP': {
    type: 'mlp',
    params: {
      inputSize: { label: '输入层神经元', min: 1, max: 20, default: 4, step: 1 },
      hiddenLayers: { label: '隐藏层数', min: 1, max: 6, default: 2, step: 1 },
      hiddenSize: { label: '每层隐藏神经元', min: 2, max: 32, default: 8, step: 1 },
      outputSize: { label: '输出层神经元', min: 1, max: 10, default: 3, step: 1 },
      activation: { label: '激活函数', type: 'select', options: ['ReLU', 'Sigmoid', 'Tanh'], default: 'ReLU' }
    },
    layerInfo: {
      input: '输入层接收原始数据特征，神经元数量等于特征维度。',
      hidden: '隐藏层通过权重矩阵和激活函数进行非线性变换，是学习复杂模式的核心。',
      output: '输出层产生最终预测结果。分类任务配合 Softmax，回归任务直接输出数值。'
    }
  },

  // ==================== LeNet-5 ====================
  'LeNet-5': {
    type: 'cnn',
    params: {
      inputChannels: { label: '输入通道数', type: 'select', options: ['1', '3'], default: '1' },
      numClasses: { label: '分类数', min: 2, max: 100, default: 10, step: 1 }
    },
    blocks: [
      { id: 'input', type: 'input', label: 'Input', desc: '32×32 灰度图像', detail: '输入为 32×32 的单通道灰度图像' },
      { id: 'conv1', type: 'conv', label: 'Conv Block 1', desc: 'Conv 6@5×5 + Tanh + AvgPool 2×2', params: { in_ch: 1, out_ch: 6, kernel: 5, pool: 'avg', pool_size: 2, act: 'Tanh' },
        detail: '6 个 5×5 卷积核 → Tanh 激活 → 2×2 平均池化，输出 14×14×6' },
      { id: 'conv2', type: 'conv', label: 'Conv Block 2', desc: 'Conv 16@5×5 + Tanh + AvgPool 2×2', params: { in_ch: 6, out_ch: 16, kernel: 5, pool: 'avg', pool_size: 2, act: 'Tanh' },
        detail: '16 个 5×5 卷积核 → Tanh 激活 → 2×2 平均池化，输出 5×5×16' },
      { id: 'fc1', type: 'linear', label: 'FC1', desc: 'Linear 120', params: { in_f: 400, out_f: 120, act: 'Tanh' }, detail: '展平后接 120 个神经元的全连接层 + Tanh 激活' },
      { id: 'fc2', type: 'linear', label: 'FC2', desc: 'Linear 84', params: { in_f: 120, out_f: 84, act: 'Tanh' }, detail: '84 个神经元的全连接层 + Tanh 激活' },
      { id: 'output', type: 'output', label: 'Output', desc: 'Linear 10', params: { out_f: 10 }, detail: '输出 10 维向量，对应 10 个数字类别' }
    ]
  },

  // ==================== AlexNet ====================
  'AlexNet': {
    type: 'cnn',
    params: {
      numClasses: { label: '分类数', min: 2, max: 1000, default: 1000, step: 1 },
      dropout: { label: 'Dropout 率', min: 0, max: 0.8, default: 0.5, step: 0.1 }
    },
    blocks: [
      { id: 'input', type: 'input', label: 'Input', desc: '224×224×3 RGB图像', detail: '输入为 224×224 的三通道 RGB 图像' },
      { id: 'conv1', type: 'conv', label: 'Conv Block 1', desc: 'Conv 96@11×11, stride 4 + ReLU + LRN + MaxPool 3×3', params: { in_ch: 3, out_ch: 96, kernel: 11, stride: 4, pool: 'max', pool_size: 3, act: 'ReLU', lrn: true },
        detail: '96 个 11×11 卷积核(stride=4) → ReLU → Local Response Normalization → 3×3 最大池化' },
      { id: 'conv2', type: 'conv', label: 'Conv Block 2', desc: 'Conv 256@5×5 + ReLU + LRN + MaxPool 3×3', params: { in_ch: 96, out_ch: 256, kernel: 5, pool: 'max', pool_size: 3, act: 'ReLU', lrn: true },
        detail: '256 个 5×5 卷积核 → ReLU → LRN → 3×3 最大池化' },
      { id: 'conv3', type: 'conv', label: 'Conv Block 3', desc: 'Conv 384@3×3 + ReLU', params: { in_ch: 256, out_ch: 384, kernel: 3, act: 'ReLU' },
        detail: '384 个 3×3 卷积核 → ReLU（无池化）' },
      { id: 'conv4', type: 'conv', label: 'Conv Block 4', desc: 'Conv 384@3×3 + ReLU', params: { in_ch: 384, out_ch: 384, kernel: 3, act: 'ReLU' },
        detail: '384 个 3×3 卷积核 → ReLU（无池化）' },
      { id: 'conv5', type: 'conv', label: 'Conv Block 5', desc: 'Conv 256@3×3 + ReLU + MaxPool 3×3', params: { in_ch: 384, out_ch: 256, kernel: 3, pool: 'max', pool_size: 3, act: 'ReLU' },
        detail: '256 个 3×3 卷积核 → ReLU → 3×3 最大池化' },
      { id: 'fc1', type: 'mlp', label: 'FC Block 1', desc: 'Dropout → Linear 4096 → ReLU', params: { in_f: 9216, out_f: 4096, act: 'ReLU', dropout: 0.5 },
        detail: 'Dropout(0.5) → 4096 个神经元的全连接层 → ReLU' },
      { id: 'fc2', type: 'mlp', label: 'FC Block 2', desc: 'Dropout → Linear 4096 → ReLU', params: { in_f: 4096, out_f: 4096, act: 'ReLU', dropout: 0.5 },
        detail: 'Dropout(0.5) → 4096 个神经元的全连接层 → ReLU' },
      { id: 'output', type: 'output', label: 'Output', desc: 'Linear 1000', params: { out_f: 1000 }, detail: '输出 1000 维向量，对应 ImageNet 1000 类' }
    ]
  },

  // ==================== ZFNet ====================
  'ZFNet': {
    type: 'cnn',
    params: { numClasses: { label: '分类数', min: 2, max: 1000, default: 1000, step: 1 } },
    blocks: [
      { id: 'input', type: 'input', label: 'Input', desc: '224×224×3', detail: '输入为 224×224 的三通道 RGB 图像' },
      { id: 'conv1', type: 'conv', label: 'Conv Block 1', desc: 'Conv 96@7×7, stride 2 + ReLU + LRN + MaxPool 3×3', params: { in_ch: 3, out_ch: 96, kernel: 7, stride: 2, pool: 'max', pool_size: 3, act: 'ReLU', lrn: true },
        detail: '相比 AlexNet 将 11×11 改为 7×7，stride 从 4 改为 2，保留更多早期特征' },
      { id: 'conv2', type: 'conv', label: 'Conv Block 2', desc: 'Conv 256@5×5 + ReLU + LRN + MaxPool 3×3', params: { in_ch: 96, out_ch: 256, kernel: 5, pool: 'max', pool_size: 3, act: 'ReLU', lrn: true },
        detail: '256 个 5×5 卷积核 → ReLU → LRN → MaxPool' },
      { id: 'conv3', type: 'conv', label: 'Conv Block 3', desc: 'Conv 384@3×3 + ReLU', params: { in_ch: 256, out_ch: 384, kernel: 3, act: 'ReLU' },
        detail: '384 个 3×3 卷积核 → ReLU' },
      { id: 'conv4', type: 'conv', label: 'Conv Block 4', desc: 'Conv 384@3×3 + ReLU', params: { in_ch: 384, out_ch: 384, kernel: 3, act: 'ReLU' },
        detail: '384 个 3×3 卷积核 → ReLU' },
      { id: 'conv5', type: 'conv', label: 'Conv Block 5', desc: 'Conv 256@3×3 + ReLU + MaxPool 3×3', params: { in_ch: 384, out_ch: 256, kernel: 3, pool: 'max', pool_size: 3, act: 'ReLU' },
        detail: '256 个 3×3 卷积核 → ReLU → MaxPool' },
      { id: 'fc1', type: 'mlp', label: 'FC Block 1', desc: 'Dropout → Linear 4096 → ReLU', params: { in_f: 9216, out_f: 4096, act: 'ReLU', dropout: 0.5 }, detail: 'Dropout → FC 4096 → ReLU' },
      { id: 'fc2', type: 'mlp', label: 'FC Block 2', desc: 'Dropout → Linear 4096 → ReLU', params: { in_f: 4096, out_f: 4096, act: 'ReLU', dropout: 0.5 }, detail: 'Dropout → FC 4096 → ReLU' },
      { id: 'output', type: 'output', label: 'Output', desc: 'Linear 1000', params: { out_f: 1000 }, detail: '输出 1000 类' }
    ]
  },

  // ==================== VGGNet ====================
  'VGGNet': {
    type: 'cnn',
    params: {
      variant: { label: 'VGG 变体', type: 'select', options: ['VGG-11', 'VGG-13', 'VGG-16', 'VGG-19'], default: 'VGG-16' },
      numClasses: { label: '分类数', min: 2, max: 1000, default: 1000, step: 1 }
    },
    blocks: [
      { id: 'input', type: 'input', label: 'Input', desc: '224×224×3', detail: '输入为 224×224 的三通道 RGB 图像' },
      { id: 'conv1', type: 'custom', label: 'Stage 1', desc: '2× Conv 64@3×3 + ReLU + MaxPool 2×2', icon: LUCIDE_ICONS['📦'],
        detail: '两个 3×3 卷积(64通道) → ReLU → MaxPool 2×2，输出 112×112×64',
        children: [
          { id: 'conv1_1', type: 'conv', label: 'Conv 1-1', desc: 'Conv 64@3×3 + ReLU', params: { in_ch: 3, out_ch: 64, kernel: 3, act: 'ReLU' } },
          { id: 'conv1_2', type: 'conv', label: 'Conv 1-2', desc: 'Conv 64@3×3 + ReLU', params: { in_ch: 64, out_ch: 64, kernel: 3, act: 'ReLU' } },
          { id: 'pool1', type: 'pool', label: 'MaxPool', desc: 'MaxPool 2×2', params: { pool: 'max', pool_size: 2 } }
        ]},
      { id: 'conv2', type: 'custom', label: 'Stage 2', desc: '2× Conv 128@3×3 + ReLU + MaxPool 2×2', icon: LUCIDE_ICONS['📦'],
        detail: '两个 3×3 卷积(128通道) → ReLU → MaxPool 2×2，输出 56×56×128',
        children: [
          { id: 'conv2_1', type: 'conv', label: 'Conv 2-1', desc: 'Conv 128@3×3 + ReLU', params: { in_ch: 64, out_ch: 128, kernel: 3, act: 'ReLU' } },
          { id: 'conv2_2', type: 'conv', label: 'Conv 2-2', desc: 'Conv 128@3×3 + ReLU', params: { in_ch: 128, out_ch: 128, kernel: 3, act: 'ReLU' } },
          { id: 'pool2', type: 'pool', label: 'MaxPool', desc: 'MaxPool 2×2', params: { pool: 'max', pool_size: 2 } }
        ]},
      { id: 'conv3', type: 'custom', label: 'Stage 3', desc: '3× Conv 256@3×3 + ReLU + MaxPool 2×2', icon: LUCIDE_ICONS['📦'],
        detail: '三个 3×3 卷积(256通道) → ReLU → MaxPool 2×2，输出 28×28×256',
        children: [
          { id: 'conv3_1', type: 'conv', label: 'Conv 3-1', desc: 'Conv 256@3×3 + ReLU', params: { in_ch: 128, out_ch: 256, kernel: 3, act: 'ReLU' } },
          { id: 'conv3_2', type: 'conv', label: 'Conv 3-2', desc: 'Conv 256@3×3 + ReLU', params: { in_ch: 256, out_ch: 256, kernel: 3, act: 'ReLU' } },
          { id: 'conv3_3', type: 'conv', label: 'Conv 3-3', desc: 'Conv 256@3×3 + ReLU', params: { in_ch: 256, out_ch: 256, kernel: 3, act: 'ReLU' } },
          { id: 'pool3', type: 'pool', label: 'MaxPool', desc: 'MaxPool 2×2', params: { pool: 'max', pool_size: 2 } }
        ]},
      { id: 'conv4', type: 'custom', label: 'Stage 4', desc: '3× Conv 512@3×3 + ReLU + MaxPool 2×2', icon: LUCIDE_ICONS['📦'],
        detail: '三个 3×3 卷积(512通道) → ReLU → MaxPool 2×2，输出 14×14×512',
        children: [
          { id: 'conv4_1', type: 'conv', label: 'Conv 4-1', desc: 'Conv 512@3×3 + ReLU', params: { in_ch: 256, out_ch: 512, kernel: 3, act: 'ReLU' } },
          { id: 'conv4_2', type: 'conv', label: 'Conv 4-2', desc: 'Conv 512@3×3 + ReLU', params: { in_ch: 512, out_ch: 512, kernel: 3, act: 'ReLU' } },
          { id: 'conv4_3', type: 'conv', label: 'Conv 4-3', desc: 'Conv 512@3×3 + ReLU', params: { in_ch: 512, out_ch: 512, kernel: 3, act: 'ReLU' } },
          { id: 'pool4', type: 'pool', label: 'MaxPool', desc: 'MaxPool 2×2', params: { pool: 'max', pool_size: 2 } }
        ]},
      { id: 'conv5', type: 'custom', label: 'Stage 5', desc: '3× Conv 512@3×3 + ReLU + MaxPool 2×2', icon: LUCIDE_ICONS['📦'],
        detail: '三个 3×3 卷积(512通道) → ReLU → MaxPool 2×2，输出 7×7×512',
        children: [
          { id: 'conv5_1', type: 'conv', label: 'Conv 5-1', desc: 'Conv 512@3×3 + ReLU', params: { in_ch: 512, out_ch: 512, kernel: 3, act: 'ReLU' } },
          { id: 'conv5_2', type: 'conv', label: 'Conv 5-2', desc: 'Conv 512@3×3 + ReLU', params: { in_ch: 512, out_ch: 512, kernel: 3, act: 'ReLU' } },
          { id: 'conv5_3', type: 'conv', label: 'Conv 5-3', desc: 'Conv 512@3×3 + ReLU', params: { in_ch: 512, out_ch: 512, kernel: 3, act: 'ReLU' } },
          { id: 'pool5', type: 'pool', label: 'MaxPool', desc: 'MaxPool 2×2', params: { pool: 'max', pool_size: 2 } }
        ]},
      { id: 'fc1', type: 'mlp', label: 'FC Block', desc: 'Linear 4096 → ReLU → Dropout', params: { in_f: 25088, out_f: 4096, act: 'ReLU', dropout: 0.5 }, detail: '展平 7×7×512=25088 → FC 4096 → ReLU → Dropout' },
      { id: 'fc2', type: 'mlp', label: 'FC Block', desc: 'Linear 4096 → ReLU → Dropout', params: { in_f: 4096, out_f: 4096, act: 'ReLU', dropout: 0.5 }, detail: 'FC 4096 → ReLU → Dropout' },
      { id: 'output', type: 'output', label: 'Output', desc: 'Linear 1000', params: { out_f: 1000 }, detail: '输出 1000 类' }
    ]
  },

  // ==================== GoogLeNet ====================
  'GoogLeNet': {
    type: 'cnn',
    params: { numClasses: { label: '分类数', min: 2, max: 1000, default: 1000, step: 1 } },
    blocks: [
      { id: 'input', type: 'input', label: 'Input', desc: '224×224×3', detail: '输入为 224×224 的三通道 RGB 图像' },
      // --- Stem ---
      { id: 'stem_conv1', type: 'conv', label: 'Conv 7×7', desc: '7×7 Conv, stride 2 → 112×112×64', detail: '7×7 卷积，stride=2，输出 64 通道，尺寸从 224×224 降至 112×112', params: { in_ch: 3, out_ch: 64, kernel: 7, stride: 2, act: 'ReLU' } },
      { id: 'maxpool_1', type: 'pool', label: 'MaxPool', desc: '3×3 MaxPool, stride 2 → 56×56×64', detail: '3×3 最大池化，stride=2，尺寸从 112×112 降至 56×56', params: { pool: 'max', pool_size: 3, stride: 2 } },
      { id: 'stem_conv2', type: 'conv', label: 'Conv 3×3', desc: '3×3 Conv → 56×56×192', detail: '3×3 卷积，输出 192 通道，尺寸保持 56×56', params: { in_ch: 64, out_ch: 192, kernel: 3, stride: 1, act: 'ReLU' } },
      { id: 'maxpool_2', type: 'pool', label: 'MaxPool', desc: '3×3 MaxPool, stride 2 → 28×28×192', detail: '3×3 最大池化，stride=2，尺寸从 56×56 降至 28×28', params: { pool: 'max', pool_size: 3, stride: 2 } },
      // --- Inception 3a ---
      { id: 'inception_3a', type: 'custom', label: 'Inception 3a', desc: '28×28×256 (64+128+32+32)', icon: LUCIDE_ICONS['🧩'],
        detail: '输入 192 通道，4 个并行分支：1×1 Conv(64) + 1×1→3×3 Conv(96→128) + 1×1→5×5 Conv(16→32) + MaxPool→1×1 Conv(32)，输出 256 通道',
        parallel: true,
        children: [
          { id: 'i3a_b1', type: 'conv', label: '1×1 Conv', desc: '1×1 Conv 64', detail: '1×1 卷积，192→64 通道', params: { in_ch: 192, out_ch: 64, kernel: 1, act: 'ReLU' } },
          { id: 'i3a_b2', type: 'custom', label: '3×3 Branch', desc: '1×1→3×3 Conv 128', icon: LUCIDE_ICONS['↪️'],
            children: [
              { id: 'i3a_b2_reduce', type: 'conv', label: 'Reduce', desc: '1×1 Conv 96', detail: '1×1 降维卷积，192→96 通道', params: { in_ch: 192, out_ch: 96, kernel: 1, act: 'ReLU' } },
              { id: 'i3a_b2_conv', type: 'conv', label: 'Conv 3×3', desc: '3×3 Conv 128', detail: '3×3 卷积，96→128 通道，padding=1', params: { in_ch: 96, out_ch: 128, kernel: 3, padding: 1, act: 'ReLU' } }
            ]},
          { id: 'i3a_b3', type: 'custom', label: '5×5 Branch', desc: '1×1→5×5 Conv 32', icon: LUCIDE_ICONS['↪️'],
            children: [
              { id: 'i3a_b3_reduce', type: 'conv', label: 'Reduce', desc: '1×1 Conv 16', detail: '1×1 降维卷积，192→16 通道', params: { in_ch: 192, out_ch: 16, kernel: 1, act: 'ReLU' } },
              { id: 'i3a_b3_conv', type: 'conv', label: 'Conv 5×5', desc: '5×5 Conv 32', detail: '5×5 卷积，16→32 通道，padding=2', params: { in_ch: 16, out_ch: 32, kernel: 5, padding: 2, act: 'ReLU' } }
            ]},
          { id: 'i3a_b4', type: 'custom', label: 'Pool Branch', desc: 'MaxPool→1×1 Conv 32', icon: LUCIDE_ICONS['↪️'],
            children: [
              { id: 'i3a_b4_pool', type: 'pool', label: 'MaxPool', desc: '3×3 MaxPool', detail: '3×3 最大池化，stride=1，padding=1，尺寸不变', params: { pool: 'max', pool_size: 3, stride: 1, padding: 1 } },
              { id: 'i3a_b4_conv', type: 'conv', label: 'Conv 1×1', desc: '1×1 Conv 32', detail: '1×1 卷积，192→32 通道', params: { in_ch: 192, out_ch: 32, kernel: 1, act: 'ReLU' } }
            ]}
        ]},
      // --- Inception 3b ---
      { id: 'inception_3b', type: 'custom', label: 'Inception 3b', desc: '28×28×480 (128+192+96+64)', icon: LUCIDE_ICONS['🧩'],
        detail: '输入 256 通道，4 个并行分支：1×1 Conv(128) + 1×1→3×3 Conv(128→192) + 1×1→5×5 Conv(32→96) + MaxPool→1×1 Conv(64)，输出 480 通道',
        parallel: true,
        children: [
          { id: 'i3b_b1', type: 'conv', label: '1×1 Conv', desc: '1×1 Conv 128', detail: '1×1 卷积，256→128 通道', params: { in_ch: 256, out_ch: 128, kernel: 1, act: 'ReLU' } },
          { id: 'i3b_b2', type: 'custom', label: '3×3 Branch', desc: '1×1→3×3 Conv 192', icon: LUCIDE_ICONS['↪️'],
            children: [
              { id: 'i3b_b2_reduce', type: 'conv', label: 'Reduce', desc: '1×1 Conv 128', detail: '1×1 降维卷积，256→128 通道', params: { in_ch: 256, out_ch: 128, kernel: 1, act: 'ReLU' } },
              { id: 'i3b_b2_conv', type: 'conv', label: 'Conv 3×3', desc: '3×3 Conv 192', detail: '3×3 卷积，128→192 通道，padding=1', params: { in_ch: 128, out_ch: 192, kernel: 3, padding: 1, act: 'ReLU' } }
            ]},
          { id: 'i3b_b3', type: 'custom', label: '5×5 Branch', desc: '1×1→5×5 Conv 96', icon: LUCIDE_ICONS['↪️'],
            children: [
              { id: 'i3b_b3_reduce', type: 'conv', label: 'Reduce', desc: '1×1 Conv 32', detail: '1×1 降维卷积，256→32 通道', params: { in_ch: 256, out_ch: 32, kernel: 1, act: 'ReLU' } },
              { id: 'i3b_b3_conv', type: 'conv', label: 'Conv 5×5', desc: '5×5 Conv 96', detail: '5×5 卷积，32→96 通道，padding=2', params: { in_ch: 32, out_ch: 96, kernel: 5, padding: 2, act: 'ReLU' } }
            ]},
          { id: 'i3b_b4', type: 'custom', label: 'Pool Branch', desc: 'MaxPool→1×1 Conv 64', icon: LUCIDE_ICONS['↪️'],
            children: [
              { id: 'i3b_b4_pool', type: 'pool', label: 'MaxPool', desc: '3×3 MaxPool', detail: '3×3 最大池化，stride=1，padding=1，尺寸不变', params: { pool: 'max', pool_size: 3, stride: 1, padding: 1 } },
              { id: 'i3b_b4_conv', type: 'conv', label: 'Conv 1×1', desc: '1×1 Conv 64', detail: '1×1 卷积，256→64 通道', params: { in_ch: 256, out_ch: 64, kernel: 1, act: 'ReLU' } }
            ]}
        ]},
      // --- MaxPool 3 ---
      { id: 'maxpool_3', type: 'pool', label: 'MaxPool', desc: '3×3 MaxPool, stride 2 → 14×14×480', detail: '3×3 最大池化，stride=2，尺寸从 28×28 降至 14×14', params: { pool: 'max', pool_size: 3, stride: 2 } },
      // --- Inception 4a ---
      { id: 'inception_4a', type: 'custom', label: 'Inception 4a', desc: '14×14×512 (192+208+48+64)', icon: LUCIDE_ICONS['🧩'],
        detail: '输入 480 通道，4 个并行分支：1×1 Conv(192) + 1×1→3×3 Conv(96→208) + 1×1→5×5 Conv(16→48) + MaxPool→1×1 Conv(64)，输出 512 通道',
        parallel: true,
        children: [
          { id: 'i4a_b1', type: 'conv', label: '1×1 Conv', desc: '1×1 Conv 192', detail: '1×1 卷积，480→192 通道', params: { in_ch: 480, out_ch: 192, kernel: 1, act: 'ReLU' } },
          { id: 'i4a_b2', type: 'custom', label: '3×3 Branch', desc: '1×1→3×3 Conv 208', icon: LUCIDE_ICONS['↪️'],
            children: [
              { id: 'i4a_b2_reduce', type: 'conv', label: 'Reduce', desc: '1×1 Conv 96', detail: '1×1 降维卷积，480→96 通道', params: { in_ch: 480, out_ch: 96, kernel: 1, act: 'ReLU' } },
              { id: 'i4a_b2_conv', type: 'conv', label: 'Conv 3×3', desc: '3×3 Conv 208', detail: '3×3 卷积，96→208 通道，padding=1', params: { in_ch: 96, out_ch: 208, kernel: 3, padding: 1, act: 'ReLU' } }
            ]},
          { id: 'i4a_b3', type: 'custom', label: '5×5 Branch', desc: '1×1→5×5 Conv 48', icon: LUCIDE_ICONS['↪️'],
            children: [
              { id: 'i4a_b3_reduce', type: 'conv', label: 'Reduce', desc: '1×1 Conv 16', detail: '1×1 降维卷积，480→16 通道', params: { in_ch: 480, out_ch: 16, kernel: 1, act: 'ReLU' } },
              { id: 'i4a_b3_conv', type: 'conv', label: 'Conv 5×5', desc: '5×5 Conv 48', detail: '5×5 卷积，16→48 通道，padding=2', params: { in_ch: 16, out_ch: 48, kernel: 5, padding: 2, act: 'ReLU' } }
            ]},
          { id: 'i4a_b4', type: 'custom', label: 'Pool Branch', desc: 'MaxPool→1×1 Conv 64', icon: LUCIDE_ICONS['↪️'],
            children: [
              { id: 'i4a_b4_pool', type: 'pool', label: 'MaxPool', desc: '3×3 MaxPool', detail: '3×3 最大池化，stride=1，padding=1，尺寸不变', params: { pool: 'max', pool_size: 3, stride: 1, padding: 1 } },
              { id: 'i4a_b4_conv', type: 'conv', label: 'Conv 1×1', desc: '1×1 Conv 64', detail: '1×1 卷积，480→64 通道', params: { in_ch: 480, out_ch: 64, kernel: 1, act: 'ReLU' } }
            ]}
        ]},
      // --- Aux Classifier 1 (after 4a) ---
      { id: 'aux_4a', type: 'custom', label: 'Aux Classifier', desc: 'Auxiliary Classifier #1', icon: LUCIDE_ICONS['🔧'],
        detail: '辅助分类器 #1：AvgPool 5×5 → 1×1 Conv 128 → FC 1024 → Dropout(70%) → FC 1000 → Softmax，用于训练时提供额外梯度',
        children: [
          { id: 'aux4a_pool', type: 'pool', label: 'AvgPool', desc: '5×5 AvgPool, stride 3', detail: '5×5 平均池化，stride=3，将 14×14 降至 4×4', params: { pool: 'avg', pool_size: 5, stride: 3 } },
          { id: 'aux4a_conv', type: 'conv', label: 'Conv 1×1', desc: '1×1 Conv 128', detail: '1×1 卷积，512→128 通道', params: { in_ch: 512, out_ch: 128, kernel: 1, act: 'ReLU' } },
          { id: 'aux4a_fc1', type: 'linear', label: 'FC', desc: 'Linear 1024', detail: '全连接层，128×4×4=2048→1024', params: { in_f: 2048, out_f: 1024, act: 'ReLU' } },
          { id: 'aux4a_dropout', type: 'dropout', label: 'Dropout', desc: 'Dropout 70%', detail: 'Dropout 以 0.7 概率随机丢弃神经元', params: { rate: 0.7 } },
          { id: 'aux4a_fc2', type: 'linear', label: 'FC', desc: 'Linear 1000', detail: '全连接层，1024→1000 类', params: { in_f: 1024, out_f: 1000 } }
        ]},
      // --- Inception 4b ---
      { id: 'inception_4b', type: 'custom', label: 'Inception 4b', desc: '14×14×512 (160+224+64+64)', icon: LUCIDE_ICONS['🧩'],
        detail: '输入 512 通道，4 个并行分支：1×1 Conv(160) + 1×1→3×3 Conv(112→224) + 1×1→5×5 Conv(24→64) + MaxPool→1×1 Conv(64)，输出 512 通道',
        parallel: true,
        children: [
          { id: 'i4b_b1', type: 'conv', label: '1×1 Conv', desc: '1×1 Conv 160', detail: '1×1 卷积，512→160 通道', params: { in_ch: 512, out_ch: 160, kernel: 1, act: 'ReLU' } },
          { id: 'i4b_b2', type: 'custom', label: '3×3 Branch', desc: '1×1→3×3 Conv 224', icon: LUCIDE_ICONS['↪️'],
            children: [
              { id: 'i4b_b2_reduce', type: 'conv', label: 'Reduce', desc: '1×1 Conv 112', detail: '1×1 降维卷积，512→112 通道', params: { in_ch: 512, out_ch: 112, kernel: 1, act: 'ReLU' } },
              { id: 'i4b_b2_conv', type: 'conv', label: 'Conv 3×3', desc: '3×3 Conv 224', detail: '3×3 卷积，112→224 通道，padding=1', params: { in_ch: 112, out_ch: 224, kernel: 3, padding: 1, act: 'ReLU' } }
            ]},
          { id: 'i4b_b3', type: 'custom', label: '5×5 Branch', desc: '1×1→5×5 Conv 64', icon: LUCIDE_ICONS['↪️'],
            children: [
              { id: 'i4b_b3_reduce', type: 'conv', label: 'Reduce', desc: '1×1 Conv 24', detail: '1×1 降维卷积，512→24 通道', params: { in_ch: 512, out_ch: 24, kernel: 1, act: 'ReLU' } },
              { id: 'i4b_b3_conv', type: 'conv', label: 'Conv 5×5', desc: '5×5 Conv 64', detail: '5×5 卷积，24→64 通道，padding=2', params: { in_ch: 24, out_ch: 64, kernel: 5, padding: 2, act: 'ReLU' } }
            ]},
          { id: 'i4b_b4', type: 'custom', label: 'Pool Branch', desc: 'MaxPool→1×1 Conv 64', icon: LUCIDE_ICONS['↪️'],
            children: [
              { id: 'i4b_b4_pool', type: 'pool', label: 'MaxPool', desc: '3×3 MaxPool', detail: '3×3 最大池化，stride=1，padding=1，尺寸不变', params: { pool: 'max', pool_size: 3, stride: 1, padding: 1 } },
              { id: 'i4b_b4_conv', type: 'conv', label: 'Conv 1×1', desc: '1×1 Conv 64', detail: '1×1 卷积，512→64 通道', params: { in_ch: 512, out_ch: 64, kernel: 1, act: 'ReLU' } }
            ]}
        ]},
      // --- Inception 4c ---
      { id: 'inception_4c', type: 'custom', label: 'Inception 4c', desc: '14×14×512 (128+256+64+64)', icon: LUCIDE_ICONS['🧩'],
        detail: '输入 512 通道，4 个并行分支：1×1 Conv(128) + 1×1→3×3 Conv(128→256) + 1×1→5×5 Conv(24→64) + MaxPool→1×1 Conv(64)，输出 512 通道',
        parallel: true,
        children: [
          { id: 'i4c_b1', type: 'conv', label: '1×1 Conv', desc: '1×1 Conv 128', detail: '1×1 卷积，512→128 通道', params: { in_ch: 512, out_ch: 128, kernel: 1, act: 'ReLU' } },
          { id: 'i4c_b2', type: 'custom', label: '3×3 Branch', desc: '1×1→3×3 Conv 256', icon: LUCIDE_ICONS['↪️'],
            children: [
              { id: 'i4c_b2_reduce', type: 'conv', label: 'Reduce', desc: '1×1 Conv 128', detail: '1×1 降维卷积，512→128 通道', params: { in_ch: 512, out_ch: 128, kernel: 1, act: 'ReLU' } },
              { id: 'i4c_b2_conv', type: 'conv', label: 'Conv 3×3', desc: '3×3 Conv 256', detail: '3×3 卷积，128→256 通道，padding=1', params: { in_ch: 128, out_ch: 256, kernel: 3, padding: 1, act: 'ReLU' } }
            ]},
          { id: 'i4c_b3', type: 'custom', label: '5×5 Branch', desc: '1×1→5×5 Conv 64', icon: LUCIDE_ICONS['↪️'],
            children: [
              { id: 'i4c_b3_reduce', type: 'conv', label: 'Reduce', desc: '1×1 Conv 24', detail: '1×1 降维卷积，512→24 通道', params: { in_ch: 512, out_ch: 24, kernel: 1, act: 'ReLU' } },
              { id: 'i4c_b3_conv', type: 'conv', label: 'Conv 5×5', desc: '5×5 Conv 64', detail: '5×5 卷积，24→64 通道，padding=2', params: { in_ch: 24, out_ch: 64, kernel: 5, padding: 2, act: 'ReLU' } }
            ]},
          { id: 'i4c_b4', type: 'custom', label: 'Pool Branch', desc: 'MaxPool→1×1 Conv 64', icon: LUCIDE_ICONS['↪️'],
            children: [
              { id: 'i4c_b4_pool', type: 'pool', label: 'MaxPool', desc: '3×3 MaxPool', detail: '3×3 最大池化，stride=1，padding=1，尺寸不变', params: { pool: 'max', pool_size: 3, stride: 1, padding: 1 } },
              { id: 'i4c_b4_conv', type: 'conv', label: 'Conv 1×1', desc: '1×1 Conv 64', detail: '1×1 卷积，512→64 通道', params: { in_ch: 512, out_ch: 64, kernel: 1, act: 'ReLU' } }
            ]}
        ]},
      // --- Inception 4d ---
      { id: 'inception_4d', type: 'custom', label: 'Inception 4d', desc: '14×14×528 (112+288+64+64)', icon: LUCIDE_ICONS['🧩'],
        detail: '输入 512 通道，4 个并行分支：1×1 Conv(112) + 1×1→3×3 Conv(144→288) + 1×1→5×5 Conv(32→64) + MaxPool→1×1 Conv(64)，输出 528 通道',
        parallel: true,
        children: [
          { id: 'i4d_b1', type: 'conv', label: '1×1 Conv', desc: '1×1 Conv 112', detail: '1×1 卷积，512→112 通道', params: { in_ch: 512, out_ch: 112, kernel: 1, act: 'ReLU' } },
          { id: 'i4d_b2', type: 'custom', label: '3×3 Branch', desc: '1×1→3×3 Conv 288', icon: LUCIDE_ICONS['↪️'],
            children: [
              { id: 'i4d_b2_reduce', type: 'conv', label: 'Reduce', desc: '1×1 Conv 144', detail: '1×1 降维卷积，512→144 通道', params: { in_ch: 512, out_ch: 144, kernel: 1, act: 'ReLU' } },
              { id: 'i4d_b2_conv', type: 'conv', label: 'Conv 3×3', desc: '3×3 Conv 288', detail: '3×3 卷积，144→288 通道，padding=1', params: { in_ch: 144, out_ch: 288, kernel: 3, padding: 1, act: 'ReLU' } }
            ]},
          { id: 'i4d_b3', type: 'custom', label: '5×5 Branch', desc: '1×1→5×5 Conv 64', icon: LUCIDE_ICONS['↪️'],
            children: [
              { id: 'i4d_b3_reduce', type: 'conv', label: 'Reduce', desc: '1×1 Conv 32', detail: '1×1 降维卷积，512→32 通道', params: { in_ch: 512, out_ch: 32, kernel: 1, act: 'ReLU' } },
              { id: 'i4d_b3_conv', type: 'conv', label: 'Conv 5×5', desc: '5×5 Conv 64', detail: '5×5 卷积，32→64 通道，padding=2', params: { in_ch: 32, out_ch: 64, kernel: 5, padding: 2, act: 'ReLU' } }
            ]},
          { id: 'i4d_b4', type: 'custom', label: 'Pool Branch', desc: 'MaxPool→1×1 Conv 64', icon: LUCIDE_ICONS['↪️'],
            children: [
              { id: 'i4d_b4_pool', type: 'pool', label: 'MaxPool', desc: '3×3 MaxPool', detail: '3×3 最大池化，stride=1，padding=1，尺寸不变', params: { pool: 'max', pool_size: 3, stride: 1, padding: 1 } },
              { id: 'i4d_b4_conv', type: 'conv', label: 'Conv 1×1', desc: '1×1 Conv 64', detail: '1×1 卷积，512→64 通道', params: { in_ch: 512, out_ch: 64, kernel: 1, act: 'ReLU' } }
            ]}
        ]},
      // --- Aux Classifier 2 (after 4d) ---
      { id: 'aux_4d', type: 'custom', label: 'Aux Classifier', desc: 'Auxiliary Classifier #2', icon: LUCIDE_ICONS['🔧'],
        detail: '辅助分类器 #2：AvgPool 5×5 → 1×1 Conv 128 → FC 1024 → Dropout(70%) → FC 1000 → Softmax，用于训练时提供额外梯度',
        children: [
          { id: 'aux4d_pool', type: 'pool', label: 'AvgPool', desc: '5×5 AvgPool, stride 3', detail: '5×5 平均池化，stride=3，将 14×14 降至 4×4', params: { pool: 'avg', pool_size: 5, stride: 3 } },
          { id: 'aux4d_conv', type: 'conv', label: 'Conv 1×1', desc: '1×1 Conv 128', detail: '1×1 卷积，528→128 通道', params: { in_ch: 528, out_ch: 128, kernel: 1, act: 'ReLU' } },
          { id: 'aux4d_fc1', type: 'linear', label: 'FC', desc: 'Linear 1024', detail: '全连接层，128×4×4=2048→1024', params: { in_f: 2048, out_f: 1024, act: 'ReLU' } },
          { id: 'aux4d_dropout', type: 'dropout', label: 'Dropout', desc: 'Dropout 70%', detail: 'Dropout 以 0.7 概率随机丢弃神经元', params: { rate: 0.7 } },
          { id: 'aux4d_fc2', type: 'linear', label: 'FC', desc: 'Linear 1000', detail: '全连接层，1024→1000 类', params: { in_f: 1024, out_f: 1000 } }
        ]},
      // --- Inception 4e ---
      { id: 'inception_4e', type: 'custom', label: 'Inception 4e', desc: '14×14×832 (256+320+128+128)', icon: LUCIDE_ICONS['🧩'],
        detail: '输入 528 通道，4 个并行分支：1×1 Conv(256) + 1×1→3×3 Conv(160→320) + 1×1→5×5 Conv(32→128) + MaxPool→1×1 Conv(128)，输出 832 通道',
        parallel: true,
        children: [
          { id: 'i4e_b1', type: 'conv', label: '1×1 Conv', desc: '1×1 Conv 256', detail: '1×1 卷积，528→256 通道', params: { in_ch: 528, out_ch: 256, kernel: 1, act: 'ReLU' } },
          { id: 'i4e_b2', type: 'custom', label: '3×3 Branch', desc: '1×1→3×3 Conv 320', icon: LUCIDE_ICONS['↪️'],
            children: [
              { id: 'i4e_b2_reduce', type: 'conv', label: 'Reduce', desc: '1×1 Conv 160', detail: '1×1 降维卷积，528→160 通道', params: { in_ch: 528, out_ch: 160, kernel: 1, act: 'ReLU' } },
              { id: 'i4e_b2_conv', type: 'conv', label: 'Conv 3×3', desc: '3×3 Conv 320', detail: '3×3 卷积，160→320 通道，padding=1', params: { in_ch: 160, out_ch: 320, kernel: 3, padding: 1, act: 'ReLU' } }
            ]},
          { id: 'i4e_b3', type: 'custom', label: '5×5 Branch', desc: '1×1→5×5 Conv 128', icon: LUCIDE_ICONS['↪️'],
            children: [
              { id: 'i4e_b3_reduce', type: 'conv', label: 'Reduce', desc: '1×1 Conv 32', detail: '1×1 降维卷积，528→32 通道', params: { in_ch: 528, out_ch: 32, kernel: 1, act: 'ReLU' } },
              { id: 'i4e_b3_conv', type: 'conv', label: 'Conv 5×5', desc: '5×5 Conv 128', detail: '5×5 卷积，32→128 通道，padding=2', params: { in_ch: 32, out_ch: 128, kernel: 5, padding: 2, act: 'ReLU' } }
            ]},
          { id: 'i4e_b4', type: 'custom', label: 'Pool Branch', desc: 'MaxPool→1×1 Conv 128', icon: LUCIDE_ICONS['↪️'],
            children: [
              { id: 'i4e_b4_pool', type: 'pool', label: 'MaxPool', desc: '3×3 MaxPool', detail: '3×3 最大池化，stride=1，padding=1，尺寸不变', params: { pool: 'max', pool_size: 3, stride: 1, padding: 1 } },
              { id: 'i4e_b4_conv', type: 'conv', label: 'Conv 1×1', desc: '1×1 Conv 128', detail: '1×1 卷积，528→128 通道', params: { in_ch: 528, out_ch: 128, kernel: 1, act: 'ReLU' } }
            ]}
        ]},
      // --- MaxPool 4 ---
      { id: 'maxpool_4', type: 'pool', label: 'MaxPool', desc: '3×3 MaxPool, stride 2 → 7×7×832', detail: '3×3 最大池化，stride=2，尺寸从 14×14 降至 7×7', params: { pool: 'max', pool_size: 3, stride: 2 } },
      // --- Inception 5a ---
      { id: 'inception_5a', type: 'custom', label: 'Inception 5a', desc: '7×7×832 (256+320+128+128)', icon: LUCIDE_ICONS['🧩'],
        detail: '输入 832 通道，4 个并行分支：1×1 Conv(256) + 1×1→3×3 Conv(160→320) + 1×1→5×5 Conv(32→128) + MaxPool→1×1 Conv(128)，输出 832 通道',
        parallel: true,
        children: [
          { id: 'i5a_b1', type: 'conv', label: '1×1 Conv', desc: '1×1 Conv 256', detail: '1×1 卷积，832→256 通道', params: { in_ch: 832, out_ch: 256, kernel: 1, act: 'ReLU' } },
          { id: 'i5a_b2', type: 'custom', label: '3×3 Branch', desc: '1×1→3×3 Conv 320', icon: LUCIDE_ICONS['↪️'],
            children: [
              { id: 'i5a_b2_reduce', type: 'conv', label: 'Reduce', desc: '1×1 Conv 160', detail: '1×1 降维卷积，832→160 通道', params: { in_ch: 832, out_ch: 160, kernel: 1, act: 'ReLU' } },
              { id: 'i5a_b2_conv', type: 'conv', label: 'Conv 3×3', desc: '3×3 Conv 320', detail: '3×3 卷积，160→320 通道，padding=1', params: { in_ch: 160, out_ch: 320, kernel: 3, padding: 1, act: 'ReLU' } }
            ]},
          { id: 'i5a_b3', type: 'custom', label: '5×5 Branch', desc: '1×1→5×5 Conv 128', icon: LUCIDE_ICONS['↪️'],
            children: [
              { id: 'i5a_b3_reduce', type: 'conv', label: 'Reduce', desc: '1×1 Conv 32', detail: '1×1 降维卷积，832→32 通道', params: { in_ch: 832, out_ch: 32, kernel: 1, act: 'ReLU' } },
              { id: 'i5a_b3_conv', type: 'conv', label: 'Conv 5×5', desc: '5×5 Conv 128', detail: '5×5 卷积，32→128 通道，padding=2', params: { in_ch: 32, out_ch: 128, kernel: 5, padding: 2, act: 'ReLU' } }
            ]},
          { id: 'i5a_b4', type: 'custom', label: 'Pool Branch', desc: 'MaxPool→1×1 Conv 128', icon: LUCIDE_ICONS['↪️'],
            children: [
              { id: 'i5a_b4_pool', type: 'pool', label: 'MaxPool', desc: '3×3 MaxPool', detail: '3×3 最大池化，stride=1，padding=1，尺寸不变', params: { pool: 'max', pool_size: 3, stride: 1, padding: 1 } },
              { id: 'i5a_b4_conv', type: 'conv', label: 'Conv 1×1', desc: '1×1 Conv 128', detail: '1×1 卷积，832→128 通道', params: { in_ch: 832, out_ch: 128, kernel: 1, act: 'ReLU' } }
            ]}
        ]},
      // --- Inception 5b ---
      { id: 'inception_5b', type: 'custom', label: 'Inception 5b', desc: '7×7×1024 (384+384+128+128)', icon: LUCIDE_ICONS['🧩'],
        detail: '输入 832 通道，4 个并行分支：1×1 Conv(384) + 1×1→3×3 Conv(192→384) + 1×1→5×5 Conv(48→128) + MaxPool→1×1 Conv(128)，输出 1024 通道',
        parallel: true,
        children: [
          { id: 'i5b_b1', type: 'conv', label: '1×1 Conv', desc: '1×1 Conv 384', detail: '1×1 卷积，832→384 通道', params: { in_ch: 832, out_ch: 384, kernel: 1, act: 'ReLU' } },
          { id: 'i5b_b2', type: 'custom', label: '3×3 Branch', desc: '1×1→3×3 Conv 384', icon: LUCIDE_ICONS['↪️'],
            children: [
              { id: 'i5b_b2_reduce', type: 'conv', label: 'Reduce', desc: '1×1 Conv 192', detail: '1×1 降维卷积，832→192 通道', params: { in_ch: 832, out_ch: 192, kernel: 1, act: 'ReLU' } },
              { id: 'i5b_b2_conv', type: 'conv', label: 'Conv 3×3', desc: '3×3 Conv 384', detail: '3×3 卷积，192→384 通道，padding=1', params: { in_ch: 192, out_ch: 384, kernel: 3, padding: 1, act: 'ReLU' } }
            ]},
          { id: 'i5b_b3', type: 'custom', label: '5×5 Branch', desc: '1×1→5×5 Conv 128', icon: LUCIDE_ICONS['↪️'],
            children: [
              { id: 'i5b_b3_reduce', type: 'conv', label: 'Reduce', desc: '1×1 Conv 48', detail: '1×1 降维卷积，832→48 通道', params: { in_ch: 832, out_ch: 48, kernel: 1, act: 'ReLU' } },
              { id: 'i5b_b3_conv', type: 'conv', label: 'Conv 5×5', desc: '5×5 Conv 128', detail: '5×5 卷积，48→128 通道，padding=2', params: { in_ch: 48, out_ch: 128, kernel: 5, padding: 2, act: 'ReLU' } }
            ]},
          { id: 'i5b_b4', type: 'custom', label: 'Pool Branch', desc: 'MaxPool→1×1 Conv 128', icon: LUCIDE_ICONS['↪️'],
            children: [
              { id: 'i5b_b4_pool', type: 'pool', label: 'MaxPool', desc: '3×3 MaxPool', detail: '3×3 最大池化，stride=1，padding=1，尺寸不变', params: { pool: 'max', pool_size: 3, stride: 1, padding: 1 } },
              { id: 'i5b_b4_conv', type: 'conv', label: 'Conv 1×1', desc: '1×1 Conv 128', detail: '1×1 卷积，832→128 通道', params: { in_ch: 832, out_ch: 128, kernel: 1, act: 'ReLU' } }
            ]}
        ]},
      // --- Classifier ---
      { id: 'global_avgpool', type: 'pool', label: 'Global AvgPool', desc: '7×7 AvgPool → 1×1×1024', detail: '全局平均池化，7×7→1×1，将每个通道的空间维度压缩为单个值', params: { pool: 'avg', pool_size: 7, stride: 1 } },
      { id: 'dropout', type: 'dropout', label: 'Dropout', desc: 'Dropout 40%', detail: 'Dropout 以 0.4 概率随机丢弃神经元，防止过拟合', params: { rate: 0.4 } },
      { id: 'output', type: 'output', label: 'Output', desc: 'Linear 1000 + Softmax', detail: '全连接层 1024→1000 类，接 Softmax 输出分类概率', params: { out_f: 1000 } }
    ]
  },

  // ==================== ResNet ====================
  'ResNet': {
    type: 'cnn',
    params: {
      variant: { label: 'ResNet 变体', type: 'select', options: ['ResNet-18', 'ResNet-34', 'ResNet-50', 'ResNet-101', 'ResNet-152'], default: 'ResNet-50' },
      numClasses: { label: '分类数', min: 2, max: 1000, default: 1000, step: 1 }
    },
    blocks: [
      { id: 'input', type: 'input', label: 'Input', desc: '224×224×3', detail: '输入为 224×224 的三通道 RGB 图像' },
      { id: 'stem', type: 'custom', label: 'Stem', desc: 'Conv 64@7×7 + BN + ReLU + MaxPool', icon: LUCIDE_ICONS['🔧'],
        detail: 'Conv 64@7×7(stride=2) → BatchNorm → ReLU → MaxPool 3×3(stride=2)，输出 56×56×64',
        children: [
          { id: 'stem_conv', type: 'conv', label: 'Conv 7×7', desc: 'Conv 64@7×7, stride 2', params: { in_ch: 3, out_ch: 64, kernel: 7, stride: 2, norm: 'batch' } },
          { id: 'stem_bn', type: 'norm', label: 'BatchNorm', desc: 'BatchNorm2d(64)' },
          { id: 'stem_act', type: 'activation', label: 'ReLU', desc: 'ReLU 激活' },
          { id: 'stem_pool', type: 'pool', label: 'MaxPool', desc: 'MaxPool 3×3, stride 2', params: { pool: 'max', pool_size: 3, stride: 2 } }
        ]},
      { id: 'layer1', type: 'custom', label: 'Layer 1 (conv2_x)', desc: '3× Bottleneck, 64→256, 56×56', icon: LUCIDE_ICONS['📦'],
        detail: '3 个 Bottleneck 残差块，通道 64→256，空间尺寸保持 56×56。每个 Bottleneck：1×1 Conv(64) → 3×3 Conv(64) → 1×1 Conv(256) + Skip Connection',
        children: [
          { id: 'l1_b1', type: 'custom', label: 'Bottleneck 1', desc: '1×1(64)→3×3(64)→1×1(256) + shortcut', icon: LUCIDE_ICONS['🔗'],
            children: [
              { id: 'l1b1_1x1', type: 'conv', label: '1×1 Conv', desc: 'Conv 64@1×1 + BN + ReLU', params: { in_ch: 64, out_ch: 64, kernel: 1, norm: 'batch', act: 'ReLU' } },
              { id: 'l1b1_3x3', type: 'conv', label: '3×3 Conv', desc: 'Conv 64@3×3 + BN + ReLU', params: { in_ch: 64, out_ch: 64, kernel: 3, norm: 'batch', act: 'ReLU' } },
              { id: 'l1b1_out', type: 'conv', label: '1×1 Conv', desc: 'Conv 256@1×1 + BN (+shortcut)', params: { in_ch: 64, out_ch: 256, kernel: 1, norm: 'batch' } }
            ]},
          { id: 'l1_b2', type: 'custom', label: 'Bottleneck 2-3 ×2', desc: '相同结构，stride=1', icon: LUCIDE_ICONS['🔗'], detail: '2 个相同 Bottleneck，stride=1，无维度变化' }
        ]},
      { id: 'layer2', type: 'custom', label: 'Layer 2 (conv3_x)', desc: '4× Bottleneck, 128→512, 28×28', icon: LUCIDE_ICONS['📦'],
        detail: '4 个 Bottleneck 残差块，第一个 stride=2 下采样，通道 128→512，尺寸 28×28',
        children: [
          { id: 'l2_b1', type: 'custom', label: 'Bottleneck 1 (stride=2)', desc: '1×1(128)→3×3(128)→1×1(512) + shortcut', icon: LUCIDE_ICONS['🔗'],
            children: [
              { id: 'l2b1_1x1', type: 'conv', label: '1×1 Conv', desc: 'Conv 128@1×1 + BN + ReLU', params: { in_ch: 256, out_ch: 128, kernel: 1, norm: 'batch', act: 'ReLU' } },
              { id: 'l2b1_3x3', type: 'conv', label: '3×3 Conv', desc: 'Conv 128@3×3, stride 2 + BN + ReLU', params: { in_ch: 128, out_ch: 128, kernel: 3, stride: 2, norm: 'batch', act: 'ReLU' } },
              { id: 'l2b1_out', type: 'conv', label: '1×1 Conv', desc: 'Conv 512@1×1 + BN (+shortcut)', params: { in_ch: 128, out_ch: 512, kernel: 1, norm: 'batch' } }
            ]},
          { id: 'l2_b2', type: 'custom', label: 'Bottleneck 2-4 ×3', desc: '相同结构，stride=1', icon: LUCIDE_ICONS['🔗'],
            detail: '3 个相同 Bottleneck，stride=1，通道 128→512，无维度变化' }
        ]},
      { id: 'layer3', type: 'custom', label: 'Layer 3 (conv4_x)', desc: '6× Bottleneck, 256→1024, 14×14', icon: LUCIDE_ICONS['📦'],
        detail: '6 个 Bottleneck 残差块，第一个 stride=2 下采样，通道 256→1024，尺寸 14×14',
        children: [
          { id: 'l3_b1', type: 'custom', label: 'Bottleneck 1 (stride=2)', desc: '1×1(256)→3×3(256)→1×1(1024) + shortcut', icon: LUCIDE_ICONS['🔗'],
            children: [
              { id: 'l3b1_1x1', type: 'conv', label: '1×1 Conv', desc: 'Conv 256@1×1 + BN + ReLU', params: { in_ch: 512, out_ch: 256, kernel: 1, norm: 'batch', act: 'ReLU' } },
              { id: 'l3b1_3x3', type: 'conv', label: '3×3 Conv', desc: 'Conv 256@3×3, stride 2 + BN + ReLU', params: { in_ch: 256, out_ch: 256, kernel: 3, stride: 2, norm: 'batch', act: 'ReLU' } },
              { id: 'l3b1_out', type: 'conv', label: '1×1 Conv', desc: 'Conv 1024@1×1 + BN (+shortcut)', params: { in_ch: 256, out_ch: 1024, kernel: 1, norm: 'batch' } }
            ]},
          { id: 'l3_b2', type: 'custom', label: 'Bottleneck 2-6 ×5', desc: '相同结构，stride=1', icon: LUCIDE_ICONS['🔗'],
            detail: '5 个相同 Bottleneck，stride=1，通道 256→1024，无维度变化' }
        ]},
      { id: 'layer4', type: 'custom', label: 'Layer 4 (conv5_x)', desc: '3× Bottleneck, 512→2048, 7×7', icon: LUCIDE_ICONS['📦'],
        detail: '3 个 Bottleneck 残差块，第一个 stride=2 下采样，通道 512→2048，尺寸 7×7',
        children: [
          { id: 'l4_b1', type: 'custom', label: 'Bottleneck 1 (stride=2)', desc: '1×1(512)→3×3(512)→1×1(2048) + shortcut', icon: LUCIDE_ICONS['🔗'],
            children: [
              { id: 'l4b1_1x1', type: 'conv', label: '1×1 Conv', desc: 'Conv 512@1×1 + BN + ReLU', params: { in_ch: 1024, out_ch: 512, kernel: 1, norm: 'batch', act: 'ReLU' } },
              { id: 'l4b1_3x3', type: 'conv', label: '3×3 Conv', desc: 'Conv 512@3×3, stride 2 + BN + ReLU', params: { in_ch: 512, out_ch: 512, kernel: 3, stride: 2, norm: 'batch', act: 'ReLU' } },
              { id: 'l4b1_out', type: 'conv', label: '1×1 Conv', desc: 'Conv 2048@1×1 + BN (+shortcut)', params: { in_ch: 512, out_ch: 2048, kernel: 1, norm: 'batch' } }
            ]},
          { id: 'l4_b2', type: 'custom', label: 'Bottleneck 2-3 ×2', desc: '相同结构，stride=1', icon: LUCIDE_ICONS['🔗'],
            detail: '2 个相同 Bottleneck，stride=1，通道 512→2048，无维度变化' }
        ]},
      { id: 'avgpool', type: 'pool', label: 'Global AvgPool', desc: 'AdaptiveAvgPool 1×1', params: { pool: 'avg', pool_size: 1, global: true }, detail: '全局平均池化，将 7×7 特征图压缩为 1×1' },
      { id: 'output', type: 'output', label: 'Output', desc: 'Linear 1000', params: { out_f: 1000 }, detail: '全连接层输出 1000 类' }
    ]
  },

  // ==================== YOLO ====================
  'YOLO': {
    type: 'cnn',
    params: { numClasses: { label: '检测类别数', min: 1, max: 200, default: 20, step: 1 } },
    blocks: [
      { id: 'input', type: 'input', label: 'Input', desc: '448×448×3', detail: '输入为 448×448 的三通道 RGB 图像' },
      { id: 'conv1', type: 'conv', label: 'Conv Block 1', desc: 'Conv 64@7×7, stride 2 + LeakyReLU + MaxPool', params: { in_ch: 3, out_ch: 64, kernel: 7, stride: 2, pool: 'max', pool_size: 2, act: 'LeakyReLU' },
        detail: '64 个 7×7 卷积核(stride=2) → LeakyReLU → MaxPool 2×2' },
      { id: 'conv2', type: 'conv', label: 'Conv Block 2', desc: 'Conv 192@3×3 + LeakyReLU + MaxPool', params: { in_ch: 64, out_ch: 192, kernel: 3, pool: 'max', pool_size: 2, act: 'LeakyReLU' },
        detail: '192 个 3×3 卷积核 → LeakyReLU → MaxPool 2×2' },
      { id: 'conv3_6', type: 'custom', label: 'Conv Blocks 3-6', desc: '4× Conv + Pool 层', icon: LUCIDE_ICONS['📋'],
        detail: 'Conv 128→256→512→1024→1024 + 交替 MaxPool',
        children: [
          { id: 'conv3', type: 'conv', label: 'Conv Block 3', desc: 'Conv 128@3×3 + LeakyReLU + MaxPool', params: { in_ch: 192, out_ch: 128, kernel: 3, pool: 'max', pool_size: 2, act: 'LeakyReLU' }, detail: '128 个 3×3 卷积核 → LeakyReLU → MaxPool 2×2' },
          { id: 'conv4', type: 'conv', label: 'Conv Block 4', desc: 'Conv 256@3×3 + LeakyReLU + MaxPool', params: { in_ch: 128, out_ch: 256, kernel: 3, pool: 'max', pool_size: 2, act: 'LeakyReLU' }, detail: '256 个 3×3 卷积核 → LeakyReLU → MaxPool 2×2' },
          { id: 'conv5', type: 'conv', label: 'Conv Block 5', desc: 'Conv 512@3×3 + LeakyReLU + MaxPool', params: { in_ch: 256, out_ch: 512, kernel: 3, pool: 'max', pool_size: 2, act: 'LeakyReLU' }, detail: '512 个 3×3 卷积核 → LeakyReLU → MaxPool 2×2' },
          { id: 'conv6', type: 'conv', label: 'Conv Block 6', desc: 'Conv 512@3×3 + LeakyReLU + MaxPool', params: { in_ch: 512, out_ch: 512, kernel: 3, pool: 'max', pool_size: 2, act: 'LeakyReLU' }, detail: '512 个 3×3 卷积核 → LeakyReLU → MaxPool 2×2' }
        ]},
      { id: 'conv7_8', type: 'custom', label: 'Conv Blocks 7-8', desc: '2× Conv 1024@3×3 + LeakyReLU', icon: LUCIDE_ICONS['📋'],
        detail: '两个 1024 通道的 3×3 卷积 + LeakyReLU',
        children: [
          { id: 'conv7', type: 'conv', label: 'Conv Block 7', desc: 'Conv 1024@3×3 + LeakyReLU', params: { in_ch: 512, out_ch: 1024, kernel: 3, act: 'LeakyReLU' }, detail: '1024 个 3×3 卷积核 → LeakyReLU（无池化）' },
          { id: 'conv8', type: 'conv', label: 'Conv Block 8', desc: 'Conv 1024@3×3 + LeakyReLU', params: { in_ch: 1024, out_ch: 1024, kernel: 3, act: 'LeakyReLU' }, detail: '1024 个 3×3 卷积核 → LeakyReLU（无池化）' }
        ]},
      { id: 'fc', type: 'mlp', label: 'Detection Head', desc: 'Linear 4096 → Linear(S×S×(B×5+C))', params: { in_f: 7*7*1024, out_f: 4096, act: 'LeakyReLU', dropout: 0.5 },
        detail: 'FC 4096 → LeakyReLU → Dropout → FC 输出 S×S×(B×5+C) 的张量' },
      { id: 'output', type: 'output', label: 'Output', desc: 'S×S×(B×5+C) 检测张量', params: { out_f: 1470 }, detail: '7×7 网格，每格预测 2 个边界框(x,y,w,h,confidence) + 20 类概率 = 7×7×30' }
    ]
  },

  // ==================== DenseNet ====================
  'DenseNet': {
    type: 'cnn',
    params: { variant: { label: '变体', type: 'select', options: ['DenseNet-121', 'DenseNet-169', 'DenseNet-201'], default: 'DenseNet-121' } },
    blocks: [
      { id: 'input', type: 'input', label: 'Input', desc: '224×224×3', detail: '输入为 224×224 的三通道 RGB 图像' },
      { id: 'stem', type: 'custom', label: 'Stem', desc: 'Conv 64@7×7 + BN + ReLU + MaxPool', icon: LUCIDE_ICONS['🔧'],
        detail: 'Conv 64@7×7(stride=2) → BN → ReLU → MaxPool 3×3(stride=2)',
        children: [
          { id: 'stem_conv', type: 'conv', label: 'Conv 7×7', desc: 'Conv 64@7×7 + BN + ReLU', params: { in_ch: 3, out_ch: 64, kernel: 7, stride: 2, norm: 'batch', act: 'ReLU' } },
          { id: 'stem_pool', type: 'pool', label: 'MaxPool', desc: 'MaxPool 3×3, stride 2', params: { pool: 'max', pool_size: 3, stride: 2 } }
        ]},
      { id: 'dense1', type: 'custom', label: 'Dense Block 1', desc: '6× Dense Layer, growth=32', icon: LUCIDE_ICONS['🔗'],
        detail: '6 个 Dense Layer（每层 growth_rate=32），每层输入为前面所有层的特征拼接。BN→ReLU→1×1 Conv→ReLU→3×3 Conv',
        children: [
          { id: 'd1_l', type: 'custom', label: 'Dense Layer ×6', desc: 'BN→ReLU→1×1(128)→ReLU→3×3(32)', icon: LUCIDE_ICONS['🧱'],
            detail: '每层：BatchNorm → ReLU → 1×1 Conv(128, 降维) → ReLU → 3×3 Conv(32, growth_rate)，输出与所有前层拼接',
            children: [
              { id: 'd1l_bn', type: 'norm', label: 'BatchNorm', desc: 'BatchNorm2d', detail: '对输入特征做批归一化' },
              { id: 'd1l_relu1', type: 'activation', label: 'ReLU', desc: 'ReLU 激活' },
              { id: 'd1l_conv1', type: 'conv', label: '1×1 Conv', desc: 'Conv 128@1×1 (降维)', params: { in_ch: 64, out_ch: 128, kernel: 1, act: 'none' }, detail: '1×1 卷积将通道数降到 bottleneck 大小(128)，减少计算量' },
              { id: 'd1l_relu2', type: 'activation', label: 'ReLU', desc: 'ReLU 激活' },
              { id: 'd1l_conv2', type: 'conv', label: '3×3 Conv', desc: 'Conv 32@3×3 (growth)', params: { in_ch: 128, out_ch: 32, kernel: 3, act: 'none' }, detail: '3×3 卷积生成 growth_rate=32 个新特征图，与前面所有层拼接' }
            ]}
        ]},
      { id: 'trans1', type: 'custom', label: 'Transition 1', desc: 'BN→Conv 1×1→AvgPool 2×2', icon: LUCIDE_ICONS['⬇️'],
        detail: 'BatchNorm → 1×1 Conv(降维至 128) → 2×2 AvgPool（压缩通道和空间）',
        children: [
          { id: 't1_bn', type: 'norm', label: 'BatchNorm', desc: 'BatchNorm2d', detail: '对 Dense Block 1 的输出做批归一化' },
          { id: 't1_conv', type: 'conv', label: '1×1 Conv', desc: 'Conv 128@1×1 (降维)', params: { in_ch: 256, out_ch: 128, kernel: 1, act: 'ReLU' }, detail: '1×1 卷积将通道数压缩到 128（压缩率 θ=0.5）' },
          { id: 't1_pool', type: 'pool', label: 'AvgPool 2×2', desc: '2×2 Average Pooling', params: { pool: 'avg', pool_size: 2 }, detail: '2×2 平均池化将空间尺寸减半' }
        ]},
      { id: 'dense2', type: 'custom', label: 'Dense Block 2', desc: '12× Dense Layer, growth=32', icon: LUCIDE_ICONS['🔗'],
        detail: '12 个 Dense Layer（每层 growth_rate=32），BN→ReLU→1×1 Conv→ReLU→3×3 Conv',
        children: [
          { id: 'd2_l', type: 'custom', label: 'Dense Layer ×12', desc: 'BN→ReLU→1×1(128)→ReLU→3×3(32)', icon: LUCIDE_ICONS['🧱'],
            detail: '每层：BatchNorm → ReLU → 1×1 Conv(128, 降维) → ReLU → 3×3 Conv(32, growth_rate)，输出与所有前层拼接',
            children: [
              { id: 'd2l_bn', type: 'norm', label: 'BatchNorm', desc: 'BatchNorm2d', detail: '对输入特征做批归一化' },
              { id: 'd2l_relu1', type: 'activation', label: 'ReLU', desc: 'ReLU 激活' },
              { id: 'd2l_conv1', type: 'conv', label: '1×1 Conv', desc: 'Conv 128@1×1 (降维)', params: { in_ch: 128, out_ch: 128, kernel: 1, act: 'none' }, detail: '1×1 卷积将通道数降到 bottleneck 大小(128)' },
              { id: 'd2l_relu2', type: 'activation', label: 'ReLU', desc: 'ReLU 激活' },
              { id: 'd2l_conv2', type: 'conv', label: '3×3 Conv', desc: 'Conv 32@3×3 (growth)', params: { in_ch: 128, out_ch: 32, kernel: 3, act: 'none' }, detail: '3×3 卷积生成 growth_rate=32 个新特征图' }
            ]}
        ]},
      { id: 'trans2', type: 'custom', label: 'Transition 2', desc: 'BN→Conv 1×1→AvgPool 2×2', icon: LUCIDE_ICONS['⬇️'],
        detail: 'BatchNorm → 1×1 Conv → 2×2 AvgPool',
        children: [
          { id: 't2_bn', type: 'norm', label: 'BatchNorm', desc: 'BatchNorm2d', detail: '对 Dense Block 2 的输出做批归一化' },
          { id: 't2_conv', type: 'conv', label: '1×1 Conv', desc: 'Conv 128@1×1 (降维)', params: { in_ch: 512, out_ch: 128, kernel: 1, act: 'ReLU' }, detail: '1×1 卷积将通道数压缩到 128' },
          { id: 't2_pool', type: 'pool', label: 'AvgPool 2×2', desc: '2×2 Average Pooling', params: { pool: 'avg', pool_size: 2 }, detail: '2×2 平均池化将空间尺寸减半' }
        ]},
      { id: 'dense3', type: 'custom', label: 'Dense Block 3', desc: '24× Dense Layer, growth=32', icon: LUCIDE_ICONS['🔗'],
        detail: '24 个 Dense Layer（每层 growth_rate=32），BN→ReLU→1×1 Conv→ReLU→3×3 Conv',
        children: [
          { id: 'd3_l', type: 'custom', label: 'Dense Layer ×24', desc: 'BN→ReLU→1×1(128)→ReLU→3×3(32)', icon: LUCIDE_ICONS['🧱'],
            detail: '每层：BatchNorm → ReLU → 1×1 Conv(128, 降维) → ReLU → 3×3 Conv(32, growth_rate)，输出与所有前层拼接',
            children: [
              { id: 'd3l_bn', type: 'norm', label: 'BatchNorm', desc: 'BatchNorm2d', detail: '对输入特征做批归一化' },
              { id: 'd3l_relu1', type: 'activation', label: 'ReLU', desc: 'ReLU 激活' },
              { id: 'd3l_conv1', type: 'conv', label: '1×1 Conv', desc: 'Conv 128@1×1 (降维)', params: { in_ch: 128, out_ch: 128, kernel: 1, act: 'none' }, detail: '1×1 卷积将通道数降到 bottleneck 大小(128)' },
              { id: 'd3l_relu2', type: 'activation', label: 'ReLU', desc: 'ReLU 激活' },
              { id: 'd3l_conv2', type: 'conv', label: '3×3 Conv', desc: 'Conv 32@3×3 (growth)', params: { in_ch: 128, out_ch: 32, kernel: 3, act: 'none' }, detail: '3×3 卷积生成 growth_rate=32 个新特征图' }
            ]}
        ]},
      { id: 'trans3', type: 'custom', label: 'Transition 3', desc: 'BN→Conv 1×1→AvgPool 2×2', icon: LUCIDE_ICONS['⬇️'],
        detail: 'BatchNorm → 1×1 Conv → 2×2 AvgPool',
        children: [
          { id: 't3_bn', type: 'norm', label: 'BatchNorm', desc: 'BatchNorm2d', detail: '对 Dense Block 3 的输出做批归一化' },
          { id: 't3_conv', type: 'conv', label: '1×1 Conv', desc: 'Conv 128@1×1 (降维)', params: { in_ch: 896, out_ch: 128, kernel: 1, act: 'ReLU' }, detail: '1×1 卷积将通道数压缩到 128' },
          { id: 't3_pool', type: 'pool', label: 'AvgPool 2×2', desc: '2×2 Average Pooling', params: { pool: 'avg', pool_size: 2 }, detail: '2×2 平均池化将空间尺寸减半' }
        ]},
      { id: 'dense4', type: 'custom', label: 'Dense Block 4', desc: '16× Dense Layer, growth=32', icon: LUCIDE_ICONS['🔗'],
        detail: '16 个 Dense Layer（每层 growth_rate=32），BN→ReLU→1×1 Conv→ReLU→3×3 Conv',
        children: [
          { id: 'd4_l', type: 'custom', label: 'Dense Layer ×16', desc: 'BN→ReLU→1×1(128)→ReLU→3×3(32)', icon: LUCIDE_ICONS['🧱'],
            detail: '每层：BatchNorm → ReLU → 1×1 Conv(128, 降维) → ReLU → 3×3 Conv(32, growth_rate)，输出与所有前层拼接',
            children: [
              { id: 'd4l_bn', type: 'norm', label: 'BatchNorm', desc: 'BatchNorm2d', detail: '对输入特征做批归一化' },
              { id: 'd4l_relu1', type: 'activation', label: 'ReLU', desc: 'ReLU 激活' },
              { id: 'd4l_conv1', type: 'conv', label: '1×1 Conv', desc: 'Conv 128@1×1 (降维)', params: { in_ch: 128, out_ch: 128, kernel: 1, act: 'none' }, detail: '1×1 卷积将通道数降到 bottleneck 大小(128)' },
              { id: 'd4l_relu2', type: 'activation', label: 'ReLU', desc: 'ReLU 激活' },
              { id: 'd4l_conv2', type: 'conv', label: '3×3 Conv', desc: 'Conv 32@3×3 (growth)', params: { in_ch: 128, out_ch: 32, kernel: 3, act: 'none' }, detail: '3×3 卷积生成 growth_rate=32 个新特征图' }
            ]}
        ]},
      { id: 'avgpool', type: 'pool', label: 'Global AvgPool', desc: 'AdaptiveAvgPool 1×1', params: { pool: 'avg', global: true }, detail: '全局平均池化' },
      { id: 'output', type: 'output', label: 'Output', desc: 'Linear 1000', params: { out_f: 1000 }, detail: '全连接层输出 1000 类' }
    ]
  },

  // ==================== SENet ====================
  'SENet': {
    type: 'cnn',
    params: {},
    blocks: [
      { id: 'input', type: 'input', label: 'Input', desc: '224×224×3', detail: '输入为 224×224 的三通道 RGB 图像' },
      { id: 'stem', type: 'custom', label: 'Stem', desc: 'Conv 64@7×7 + BN + ReLU + MaxPool', icon: LUCIDE_ICONS['🔧'],
        detail: '与 ResNet 相同的 Stem 结构',
        children: [
          { id: 'se_stem_conv', type: 'conv', label: 'Conv 7×7', desc: 'Conv 64@7×7, stride 2', params: { in_ch: 3, out_ch: 64, kernel: 7, stride: 2, norm: 'batch' } },
          { id: 'se_stem_bn', type: 'norm', label: 'BatchNorm', desc: 'BatchNorm2d(64)' },
          { id: 'se_stem_act', type: 'activation', label: 'ReLU', desc: 'ReLU 激活' },
          { id: 'se_stem_pool', type: 'pool', label: 'MaxPool', desc: 'MaxPool 3×3, stride 2', params: { pool: 'max', pool_size: 3, stride: 2 } }
        ]},
      { id: 'se_layer', type: 'custom', label: 'SE-ResNet Block', desc: 'ResNet Block + SE Module', icon: LUCIDE_ICONS['🧩'],
        detail: '在 ResNet 残差块基础上加入 Squeeze-and-Excitation 模块：Global AvgPool → FC → ReLU → FC → Sigmoid → Scale',
        children: [
          { id: 'se_conv', type: 'conv', label: 'Conv Block', desc: 'Conv→BN→ReLU→Conv→BN', params: { in_ch: 64, out_ch: 256, kernel: 3, norm: 'batch', act: 'ReLU' }, detail: '标准残差卷积块' },
          { id: 'se_squeeze', type: 'custom', label: 'SE Module', desc: 'Squeeze → Excitation → Scale', icon: LUCIDE_ICONS['⚡'],
            detail: 'Squeeze: Global AvgPool 将 H×W 压缩为 1×1 → Excitation: FC(reduction=16) → ReLU → FC → Sigmoid → Scale: 将通道权重乘以原特征图',
            children: [
              { id: 'se_gap', type: 'pool', label: 'Squeeze', desc: 'Global AvgPool', params: { pool: 'avg', global: true } },
              { id: 'se_fc1', type: 'linear', label: 'FC (reduce)', desc: 'Linear(C/r) → ReLU', params: { in_f: 256, out_f: 16, act: 'ReLU' } },
              { id: 'se_fc2', type: 'linear', label: 'FC (expand)', desc: 'Linear(C) → Sigmoid', params: { in_f: 16, out_f: 256, act: 'Sigmoid' } },
              { id: 'se_scale', type: 'activation', label: 'Scale', desc: '通道加权乘法' }
            ]}
        ]},
      { id: 'stages', type: 'custom', label: 'SE-ResNet Stages', desc: 'Layer 1-4 含 SE 模块的残差阶段', icon: LUCIDE_ICONS['📋'],
        detail: '4 个阶段，每个阶段包含多个 SE-ResNet Block',
        children: [
          { id: 'se_stage1', type: 'custom', label: 'Stage 1', desc: '3× SE-ResNet Block, 64→256', icon: LUCIDE_ICONS['📦'], detail: '3 个 SE-ResNet Bottleneck，通道 64→256，空间尺寸保持 56×56' },
          { id: 'se_stage2', type: 'custom', label: 'Stage 2', desc: '4× SE-ResNet Block, 128→512', icon: LUCIDE_ICONS['📦'], detail: '4 个 SE-ResNet Bottleneck，通道 128→512，第一个 stride=2 下采样至 28×28' },
          { id: 'se_stage3', type: 'custom', label: 'Stage 3', desc: '6× SE-ResNet Block, 256→1024', icon: LUCIDE_ICONS['📦'], detail: '6 个 SE-ResNet Bottleneck，通道 256→1024，第一个 stride=2 下采样至 14×14' },
          { id: 'se_stage4', type: 'custom', label: 'Stage 4', desc: '3× SE-ResNet Block, 512→2048', icon: LUCIDE_ICONS['📦'], detail: '3 个 SE-ResNet Bottleneck，通道 512→2048，第一个 stride=2 下采样至 7×7' }
        ]},
      { id: 'output', type: 'output', label: 'Output', desc: 'Linear 1000', params: { out_f: 1000 }, detail: '输出 1000 类' }
    ]
  },

  // ==================== MobileNetV1 ====================
  'MobileNetV1': {
    type: 'cnn',
    params: { widthMult: { label: '宽度乘子', type: 'select', options: ['0.25', '0.5', '0.75', '1.0'], default: '1.0' } },
    blocks: [
      { id: 'input', type: 'input', label: 'Input', desc: '224×224×3', detail: '输入为 224×224 的三通道 RGB 图像' },
      { id: 'conv1', type: 'conv', label: 'Conv 3×3', desc: 'Conv 32@3×3, stride 2 + BN + ReLU', params: { in_ch: 3, out_ch: 32, kernel: 3, stride: 2, norm: 'batch', act: 'ReLU' },
        detail: '标准 3×3 卷积（非深度可分离），stride=2 下采样' },
      { id: 'dsconv', type: 'custom', label: 'Depthwise Separable Conv', desc: 'DW Conv 3×3 + PW Conv 1×1', icon: LUCIDE_ICONS['🧩'],
        detail: 'MobileNet 的核心模块：Depthwise Conv（每个通道独立卷积）→ Pointwise Conv（1×1 卷积跨通道混合），计算量减少 8-9 倍',
        children: [
          { id: 'dw', type: 'conv', label: 'Depthwise Conv', desc: 'DW Conv 3×3 + BN + ReLU', params: { in_ch: 32, out_ch: 32, kernel: 3, depthwise: true, norm: 'batch', act: 'ReLU' },
            detail: 'Depthwise 卷积：每个输入通道使用一个独立的 3×3 卷积核，参数量 = in_ch × 3 × 3' },
          { id: 'pw', type: 'conv', label: 'Pointwise Conv', desc: 'PW Conv 1×1 + BN + ReLU', params: { in_ch: 32, out_ch: 64, kernel: 1, norm: 'batch', act: 'ReLU' },
            detail: 'Pointwise 卷积：1×1 卷积实现跨通道信息融合，参数量 = in_ch × out_ch' }
        ]},
      { id: 'stages', type: 'custom', label: 'DW Separable Stages ×13', desc: '13 个 Depthwise Separable Conv 模块', icon: LUCIDE_ICONS['📋'],
        detail: '共 13 个 DW Separable Conv 模块，交替使用 stride=1 和 stride=2，通道数逐渐增加',
        children: [
          { id: 'ds1', type: 'custom', label: 'DSConv 1', desc: 'DW 64@3×3, s=1 + PW 64@1×1', icon: LUCIDE_ICONS['🧩'],
            children: [
              { id: 'ds1_dw', type: 'conv', label: 'DW Conv', desc: 'DW 64@3×3, stride 1 + BN + ReLU', params: { in_ch: 32, out_ch: 64, kernel: 3, depthwise: true, norm: 'batch', act: 'ReLU' } },
              { id: 'ds1_pw', type: 'conv', label: 'PW Conv', desc: 'PW 64@1×1 + BN + ReLU', params: { in_ch: 64, out_ch: 64, kernel: 1, norm: 'batch', act: 'ReLU' } }
            ]},
          { id: 'ds2', type: 'custom', label: 'DSConv 2', desc: 'DW 128@3×3, s=2 + PW 128@1×1', icon: LUCIDE_ICONS['🧩'],
            children: [
              { id: 'ds2_dw', type: 'conv', label: 'DW Conv', desc: 'DW 128@3×3, stride 2 + BN + ReLU', params: { in_ch: 64, out_ch: 128, kernel: 3, stride: 2, depthwise: true, norm: 'batch', act: 'ReLU' } },
              { id: 'ds2_pw', type: 'conv', label: 'PW Conv', desc: 'PW 128@1×1 + BN + ReLU', params: { in_ch: 128, out_ch: 128, kernel: 1, norm: 'batch', act: 'ReLU' } }
            ]},
          { id: 'ds3', type: 'custom', label: 'DSConv 3-4 ×2', desc: 'DW 256@3×3 + PW 256@1×1', icon: LUCIDE_ICONS['🔄'], detail: '2 个 DSConv，stride=1，通道 128→256' },
          { id: 'ds4', type: 'custom', label: 'DSConv 5-6 ×2', desc: 'DW 512@3×3 + PW 512@1×1', icon: LUCIDE_ICONS['🔄'], detail: '2 个 DSConv，第一个 stride=2，通道 256→512' },
          { id: 'ds5', type: 'custom', label: 'DSConv 7-12 ×6', desc: 'DW 512@3×3 + PW 512@1×1', icon: LUCIDE_ICONS['🔄'], detail: '6 个 DSConv，stride=1，通道保持 512' },
          { id: 'ds6', type: 'custom', label: 'DSConv 13', desc: 'DW 1024@3×3, s=2 + PW 1024@1×1', icon: LUCIDE_ICONS['🧩'],
            children: [
              { id: 'ds6_dw', type: 'conv', label: 'DW Conv', desc: 'DW 1024@3×3, stride 2 + BN + ReLU', params: { in_ch: 512, out_ch: 1024, kernel: 3, stride: 2, depthwise: true, norm: 'batch', act: 'ReLU' } },
              { id: 'ds6_pw', type: 'conv', label: 'PW Conv', desc: 'PW 1024@1×1 + BN + ReLU', params: { in_ch: 1024, out_ch: 1024, kernel: 1, norm: 'batch', act: 'ReLU' } }
            ]}
        ]},
      { id: 'avgpool', type: 'pool', label: 'Global AvgPool', desc: 'AdaptiveAvgPool 1×1', params: { pool: 'avg', global: true }, detail: '全局平均池化' },
      { id: 'output', type: 'output', label: 'Output', desc: 'Linear 1000', params: { out_f: 1000 }, detail: '全连接层输出 1000 类' }
    ]
  },

  // ==================== Transformer ====================
  'Transformer': {
    type: 'transformer',
    params: {
      dModel: { label: '模型维度 d_model', min: 64, max: 1024, default: 512, step: 64 },
      nHeads: { label: '注意力头数', min: 1, max: 16, default: 8, step: 1 },
      dFF: { label: '前馈网络维度', min: 128, max: 4096, default: 2048, step: 128 },
      nLayers: { label: '编码器/解码器层数', min: 1, max: 12, default: 6, step: 1 }
    },
    blocks: [
      { id: 'input', type: 'input', label: 'Input', desc: 'Token 序列 + 位置编码', detail: '输入为 Token Embedding + Positional Encoding 的序列' },
      { id: 'encoder', type: 'custom', label: 'Encoder ×N', desc: 'N 层编码器堆叠', icon: LUCIDE_ICONS['📦'],
        detail: 'N 个相同的编码器层堆叠，每层包含 Multi-Head Self-Attention 和 Feed-Forward Network',
        children: [
          { id: 'enc_mha', type: 'attention', label: 'Multi-Head Self-Attention', desc: 'Q, K, V = Linear → Scaled Dot-Product Attention → Concat → Linear',
            detail: '将输入映射为 Q、K、V 三个矩阵，分头计算注意力 → 拼接 → 线性变换。Attention(Q,K,V) = softmax(QK^T/√d_k)V' },
          { id: 'enc_ffn', type: 'mlp', label: 'Feed-Forward Network', desc: 'Linear(d_model, d_ff) → ReLU → Linear(d_ff, d_model)',
            params: { in_f: 512, out_f: 2048, act: 'ReLU' },
            detail: '两层全连接网络：先升维到 d_ff，再降维回 d_model，中间加 ReLU 激活' },
          { id: 'enc_norm', type: 'norm', label: 'LayerNorm ×2', desc: 'Add & Norm（残差连接 + 层归一化）', detail: '每个子层后都有残差连接 + LayerNorm：LayerNorm(x + Sublayer(x))' }
        ]},
      { id: 'decoder', type: 'custom', label: 'Decoder ×N', desc: 'N 层解码器堆叠', icon: LUCIDE_ICONS['📦'],
        detail: 'N 个相同的解码器层，比编码器多一个 Cross-Attention 子层',
        children: [
          { id: 'dec_masked_mha', type: 'attention', label: 'Masked Self-Attention', desc: '带因果掩码的自注意力', detail: '防止解码器看到未来位置的信息，通过 mask 将未来位置的注意力分数设为 -∞' },
          { id: 'dec_cross_mha', type: 'attention', label: 'Cross-Attention', desc: 'Q=decoder, K/V=encoder output', detail: 'Q 来自解码器，K 和 V 来自编码器输出，实现编码器-解码器注意力' },
          { id: 'dec_ffn', type: 'mlp', label: 'Feed-Forward Network', desc: 'Linear → ReLU → Linear', params: { in_f: 512, out_f: 2048, act: 'ReLU' }, detail: '与编码器相同的 FFN 结构' },
          { id: 'dec_norm', type: 'norm', label: 'LayerNorm ×3', desc: 'Add & Norm ×3', detail: '三个子层各有一个残差连接 + LayerNorm' }
        ]},
      { id: 'output', type: 'output', label: 'Output', desc: 'Linear + Softmax', params: { out_f: 30000 }, detail: 'Linear 投影到词表大小 → Softmax 输出概率分布' }
    ]
  },

  // ==================== BERT ====================
  'BERT': {
    type: 'transformer',
    params: {
      variant: { label: '变体', type: 'select', options: ['BERT-Base', 'BERT-Large'], default: 'BERT-Base' },
      nHeads: { label: '注意力头数', min: 1, max: 16, default: 12, step: 1 }
    },
    blocks: [
      { id: 'input', type: 'input', label: 'Input', desc: 'Token + Segment + Position Embedding', detail: 'Token Embedding + Segment Embedding(区分句子A/B) + Position Embedding → 求和' },
      { id: 'encoder', type: 'custom', label: 'Transformer Encoder ×12', desc: '12 层 Transformer Encoder', icon: LUCIDE_ICONS['📦'],
        detail: '12 层相同的 Transformer Encoder 块堆叠',
        children: [
          { id: 'enc_mha', type: 'attention', label: 'Multi-Head Self-Attention', desc: '12头注意力', detail: '双向自注意力，可以同时关注上下文信息' },
          { id: 'enc_ffn', type: 'mlp', label: 'Feed-Forward', desc: 'Linear(768, 3072) → GELU → Linear(3072, 768)', params: { in_f: 768, out_f: 3072, act: 'GELU' }, detail: 'GELU 激活的前馈网络' },
          { id: 'enc_norm', type: 'norm', label: 'LayerNorm ×2', desc: 'Add & Norm', detail: '残差连接 + LayerNorm' }
        ]},
      { id: 'mlm_head', type: 'custom', label: 'MLM Head', desc: 'Masked Language Model 预测头', icon: LUCIDE_ICONS['🎯'],
        detail: 'Linear(768) → GELU → LayerNorm → Linear(vocab_size) → Softmax，预测被 [MASK] 遮盖的 token',
        children: [
          { id: 'mlm_fc1', type: 'linear', label: 'Linear', desc: 'Linear(768, 768) → GELU', params: { in_f: 768, out_f: 768, act: 'GELU' }, detail: '全连接层将编码器输出映射到隐藏层，使用 GELU 激活' },
          { id: 'mlm_ln', type: 'norm', label: 'LayerNorm', desc: 'LayerNorm(768)', detail: '对隐藏层输出做层归一化' },
          { id: 'mlm_fc2', type: 'linear', label: 'Linear', desc: 'Linear(768, 30522)', params: { in_f: 768, out_f: 30522 }, detail: '将 768 维特征映射到 30522 个词表 token 的概率' }
        ]},
      { id: 'nsp_head', type: 'custom', label: 'NSP Head', desc: 'Next Sentence Prediction 头', icon: LUCIDE_ICONS['🎯'],
        detail: '取 [CLS] token 的输出 → Linear(768, 2) → Softmax，预测句子 B 是否是句子 A 的下一句',
        children: [
          { id: 'nsp_fc', type: 'linear', label: 'Linear', desc: 'Linear(768, 2)', params: { in_f: 768, out_f: 2 }, detail: '将 [CLS] token 的 768 维特征映射到 2 类（IsNext/NotNext）' },
          { id: 'nsp_sm', type: 'activation', label: 'Softmax', desc: 'Softmax', detail: 'Softmax 输出两类的概率分布' }
        ]}
    ]
  },

  // ==================== EfficientNet ====================
  'EfficientNet': {
    type: 'cnn',
    params: { variant: { label: '变体', type: 'select', options: ['B0', 'B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7'], default: 'B0' } },
    blocks: [
      { id: 'input', type: 'input', label: 'Input', desc: '224×224×3', detail: '输入为 224×224 的三通道 RGB 图像' },
      { id: 'stem', type: 'conv', label: 'Stem Conv', desc: 'Conv 32@3×3, stride 2 + BN + Swish', params: { in_ch: 3, out_ch: 32, kernel: 3, stride: 2, norm: 'batch', act: 'Swish' },
        detail: '3×3 卷积 + BatchNorm + Swish 激活' },
      { id: 'mbconv', type: 'custom', label: 'MBConv Block', desc: 'Inverted Residual + SE + Depthwise', icon: LUCIDE_ICONS['🧩'],
        detail: 'EfficientNet 的核心模块：1×1 Expansion → Depthwise Conv → SE → 1×1 Projection + Residual',
        children: [
          { id: 'mb_expand', type: 'conv', label: '1×1 Expand', desc: '1×1 Conv(升维) + BN + Swish', params: { in_ch: 32, out_ch: 16, kernel: 1, norm: 'batch', act: 'Swish' },
            detail: '1×1 卷积将通道数扩展 t 倍（expansion ratio）' },
          { id: 'mb_dw', type: 'conv', label: 'Depthwise Conv', desc: 'DW Conv k×k + BN + Swish', params: { in_ch: 16, out_ch: 16, kernel: 3, depthwise: true, norm: 'batch', act: 'Swish' },
            detail: 'Depthwise 卷积提取空间特征' },
          { id: 'mb_se', type: 'custom', label: 'SE Module', desc: 'Squeeze-and-Excitation', icon: LUCIDE_ICONS['⚡'],
            detail: '通道注意力机制：GAP → FC → Swish → FC → Sigmoid → Scale',
            children: [
              { id: 'mb_se_gap', type: 'pool', label: 'Global AvgPool', desc: 'Squeeze: GAP', params: { pool: 'avg', global: true }, detail: '全局平均池化将 H×W 压缩为 1×1' },
              { id: 'mb_se_fc1', type: 'linear', label: 'FC (reduce)', desc: 'Linear(C/r) → Swish', params: { in_f: 16, out_f: 4, act: 'Swish' }, detail: '全连接层降维到 C/r（reduction ratio）' },
              { id: 'mb_se_fc2', type: 'linear', label: 'FC (expand)', desc: 'Linear(C) → Sigmoid', params: { in_f: 4, out_f: 16, act: 'Sigmoid' }, detail: '全连接层升维回 C，Sigmoid 生成 0~1 通道权重' },
              { id: 'mb_se_scale', type: 'activation', label: 'Scale', desc: '通道加权乘法', detail: '将 Sigmoid 输出的通道权重乘以原特征图' }
            ]},
          { id: 'mb_proj', type: 'conv', label: '1×1 Project', desc: '1×1 Conv(降维) + BN', params: { in_ch: 16, out_ch: 32, kernel: 1, norm: 'batch' },
            detail: '1×1 卷积将通道数降回，如果输入输出通道相同则加残差连接' }
        ]},
      { id: 'stages', type: 'custom', label: 'MBConv Stages ×7', desc: '7 组 MBConv 模块', icon: LUCIDE_ICONS['📋'],
        detail: '7 组 MBConv 模块，逐步增加通道数和分辨率，复合缩放 φ 同时控制深度、宽度和分辨率',
        children: [
          { id: 'mb_s1', type: 'custom', label: 'MBConv1 (16→24)', desc: '1×1 expand(6x) → DW 3×3, s=2 → SE → 1×1 proj', icon: LUCIDE_ICONS['🧩'],
            children: [
              { id: 'mb_s1_exp', type: 'conv', label: '1×1 Expand', desc: '1×1 Conv 96 + BN + Swish', params: { in_ch: 16, out_ch: 96, kernel: 1, norm: 'batch', act: 'Swish' } },
              { id: 'mb_s1_dw', type: 'conv', label: 'DW Conv', desc: 'DW 3×3, stride 2 + BN + Swish', params: { in_ch: 96, out_ch: 96, kernel: 3, stride: 2, depthwise: true, norm: 'batch', act: 'Swish' } },
              { id: 'mb_s1_se', type: 'custom', label: 'SE', desc: 'Squeeze-and-Excitation', icon: LUCIDE_ICONS['⚡'], detail: 'GAP → FC → Swish → FC → Sigmoid → Scale' },
              { id: 'mb_s1_proj', type: 'conv', label: '1×1 Project', desc: '1×1 Conv 24 + BN', params: { in_ch: 96, out_ch: 24, kernel: 1, norm: 'batch' } }
            ]},
          { id: 'mb_s2', type: 'custom', label: 'MBConv2 (24→40)', desc: '1×1 expand(6x) → DW 5×5, s=2 → SE → 1×1 proj', icon: LUCIDE_ICONS['🧩'],
            children: [
              { id: 'mb_s2_exp', type: 'conv', label: '1×1 Expand', desc: '1×1 Conv 144 + BN + Swish', params: { in_ch: 24, out_ch: 144, kernel: 1, norm: 'batch', act: 'Swish' } },
              { id: 'mb_s2_dw', type: 'conv', label: 'DW Conv', desc: 'DW 5×5, stride 2 + BN + Swish', params: { in_ch: 144, out_ch: 144, kernel: 5, stride: 2, depthwise: true, norm: 'batch', act: 'Swish' } },
              { id: 'mb_s2_se', type: 'custom', label: 'SE', desc: 'Squeeze-and-Excitation', icon: LUCIDE_ICONS['⚡'], detail: 'GAP → FC → Swish → FC → Sigmoid → Scale' },
              { id: 'mb_s2_proj', type: 'conv', label: '1×1 Project', desc: '1×1 Conv 40 + BN', params: { in_ch: 144, out_ch: 40, kernel: 1, norm: 'batch' } }
            ]},
          { id: 'mb_s3', type: 'custom', label: 'MBConv3-7', desc: '后续 5 组 MBConv，通道 40→80→112→192→320', icon: LUCIDE_ICONS['🔄'], detail: '后续 5 组 MBConv 模块，逐步增加通道数，使用不同 kernel size(3×3/5×3/5×3/3×3) 和 expansion ratio(6x)' }
        ]},
      { id: 'head', type: 'custom', label: 'Head', desc: 'Conv 1×1 + BN + Swish + Global AvgPool + Dropout + FC', icon: LUCIDE_ICONS['🔧'],
        detail: '1×1 Conv → BN → Swish → Global AvgPool → Dropout → FC 输出',
        children: [
          { id: 'hd_conv', type: 'conv', label: 'Conv 1×1', desc: 'Conv 1280@1×1 + BN + Swish', params: { in_ch: 320, out_ch: 1280, kernel: 1, norm: 'batch', act: 'Swish' }, detail: '1×1 卷积将通道数提升到 1280' },
          { id: 'hd_pool', type: 'pool', label: 'Global AvgPool', desc: 'AdaptiveAvgPool 1×1', params: { pool: 'avg', global: true }, detail: '全局平均池化将空间维度压缩为 1×1' },
          { id: 'hd_drop', type: 'dropout', label: 'Dropout', desc: 'Dropout', params: { rate: 0.2 }, detail: 'Dropout 正则化' },
          { id: 'hd_fc', type: 'linear', label: 'FC', desc: 'Linear(1280, 1000)', params: { in_f: 1280, out_f: 1000 }, detail: '全连接层输出 1000 类' }
        ]},
      { id: 'output', type: 'output', label: 'Output', desc: 'Linear 1000', params: { out_f: 1000 }, detail: '输出 1000 类' }
    ]
  },

  // ==================== ViT ====================
  'ViT': {
    type: 'transformer',
    params: {
      patchSize: { label: 'Patch 大小', type: 'select', options: ['8', '16', '32'], default: '16' },
      dModel: { label: '模型维度', min: 256, max: 1024, default: 768, step: 128 },
      nHeads: { label: '注意力头数', min: 1, max: 16, default: 12, step: 1 },
      nLayers: { label: 'Transformer 层数', min: 1, max: 24, default: 12, step: 1 }
    },
    blocks: [
      { id: 'input', type: 'input', label: 'Input', desc: '224×224 图像 → Patch 序列', detail: '将 224×224 图像分割为 14×14=196 个 16×16 的 patch，每个 patch 线性嵌入为 768 维向量' },
      { id: 'patch_embed', type: 'custom', label: 'Patch Embedding', desc: '图像 → Patch → Linear Projection', icon: LUCIDE_ICONS['🔧'],
        detail: 'Conv2d(3, 768, 16, stride=16) 将每个 16×16 patch 映射为 768 维向量，等价于对每个 patch 做 Linear Projection',
        parallel: true,
        children: [
          { id: 'patch_conv', type: 'conv', label: 'Patch Split', desc: 'Conv 768@16×16, stride 16', params: { in_ch: 3, out_ch: 768, kernel: 16, stride: 16 }, detail: '将图像分割为 patch 并嵌入' },
          { id: 'cls_token', type: 'linear', label: '[CLS] Token', desc: '可学习的分类 token', params: { in_f: 1, out_f: 768 }, detail: '预置一个可学习的 [CLS] token，用于最终的分类预测' },
          { id: 'pos_embed', type: 'linear', label: 'Position Embedding', desc: '197 个位置编码', params: { in_f: 197, out_f: 768 }, detail: '为 196 个 patch + 1 个 [CLS] token 添加位置信息' }
        ]},
      { id: 'encoder', type: 'custom', label: 'Transformer Encoder ×12', desc: '12 层 Transformer Encoder', icon: LUCIDE_ICONS['📦'],
        detail: '12 层标准 Transformer Encoder（与原始 Transformer 相同的 Pre-Norm 版本）',
        children: [
          { id: 'vit_mha', type: 'attention', label: 'Multi-Head Self-Attention', desc: '12头注意力', detail: '对 patch 序列做自注意力，每个 patch 可以关注所有其他 patch' },
          { id: 'vit_mlp', type: 'mlp', label: 'MLP Block', desc: 'Linear(768, 3072) → GELU → Linear(3072, 768)', params: { in_f: 768, out_f: 3072, act: 'GELU' }, detail: '两层 MLP + GELU 激活' },
          { id: 'vit_norm', type: 'norm', label: 'LayerNorm ×2', desc: 'Pre-LayerNorm', detail: 'Pre-Norm 变体：先 LayerNorm 再进入子层' }
        ]},
      { id: 'head', type: 'custom', label: 'Classification Head', desc: 'LayerNorm → [CLS] → Linear', icon: LUCIDE_ICONS['🎯'],
        detail: '最终 LayerNorm → 取 [CLS] token 的输出 → Linear(768, num_classes)',
        children: [
          { id: 'vit_head_ln', type: 'norm', label: 'LayerNorm', desc: 'LayerNorm(768)', detail: '最终 LayerNorm 对 [CLS] token 的输出做归一化' },
          { id: 'vit_head_fc', type: 'linear', label: 'Linear', desc: 'Linear(768, 1000)', params: { in_f: 768, out_f: 1000 }, detail: '全连接层将 [CLS] token 的 768 维特征映射到 1000 类' }
        ]},
      { id: 'output', type: 'output', label: 'Output', desc: 'Linear 1000', params: { out_f: 1000 }, detail: '输出 1000 类' }
    ]
  },

  // ==================== Stable Diffusion ====================
  'Stable Diffusion': {
    type: 'diffusion',
    params: {},
    blocks: [
      { id: 'input_text', type: 'input', label: 'Text Input', desc: '文本提示词', detail: '用户输入的文本描述，如 "a cat sitting on a table"' },
      { id: 'clip', type: 'custom', label: 'CLIP Text Encoder', desc: 'Transformer 文本编码器', icon: LUCIDE_ICONS['📝'],
        detail: '使用 CLIP 的 Text Transformer 将文本编码为 77×768 的条件向量，引导图像生成',
        children: [
          { id: 'clip_tok', type: 'linear', label: 'Tokenizer', desc: '文本 → Token IDs', detail: 'CLIP Tokenizer 将文本转换为 77 个 token' },
          { id: 'clip_enc', type: 'attention', label: 'Transformer', desc: '12层 Transformer 编码', detail: '12 层 Transformer 将 token 编码为语义特征向量' }
        ]},
      { id: 'unet', type: 'custom', label: 'U-Net (核心去噪网络)', desc: '带时间/文本条件注入的 U-Net', icon: LUCIDE_ICONS['🎨'],
        detail: 'U-Net 是 Stable Diffusion 的核心，负责在潜在空间中逐步去噪。通过 Cross-Attention 注入文本条件',
        children: [
          { id: 'unet_enc', type: 'custom', label: 'Encoder', desc: '下采样路径：ResBlock + Attention + Downsample', icon: LUCIDE_ICONS['⬇️'],
            detail: '逐步降低空间分辨率，提取多尺度特征',
            children: [
              { id: 'ue_res1', type: 'custom', label: 'ResBlock 1', desc: 'ResBlock(320→320)', icon: LUCIDE_ICONS['🔗'], detail: '残差块：GroupNorm → SiLU → Conv → GroupNorm → SiLU → Conv + skip' },
              { id: 'ue_attn1', type: 'attention', label: 'Self-Attention', desc: '320 维自注意力', detail: '对特征图做 Self-Attention，注入时间步条件' },
              { id: 'ue_down1', type: 'conv', label: 'Downsample', desc: 'Conv 2×2, stride 2', params: { in_ch: 320, out_ch: 320, kernel: 2, stride: 2 }, detail: '2×2 卷积下采样，空间尺寸减半' },
              { id: 'ue_res2', type: 'custom', label: 'ResBlock 2', desc: 'ResBlock(320→640)', icon: LUCIDE_ICONS['🔗'], detail: '残差块：通道数从 320 增加到 640' },
              { id: 'ue_attn2', type: 'attention', label: 'Self-Attention', desc: '640 维自注意力', detail: '640 维 Self-Attention' },
              { id: 'ue_down2', type: 'conv', label: 'Downsample', desc: 'Conv 2×2, stride 2', params: { in_ch: 640, out_ch: 640, kernel: 2, stride: 2 }, detail: '2×2 卷积下采样' }
            ]},
          { id: 'unet_mid', type: 'custom', label: 'Middle Block', desc: 'ResBlock + Self-Attention + ResBlock', icon: LUCIDE_ICONS['🔄'],
            detail: '最低分辨率的处理模块',
            children: [
              { id: 'um_res1', type: 'custom', label: 'ResBlock', desc: 'ResBlock(1280→1280)', icon: LUCIDE_ICONS['🔗'], detail: '残差块：GroupNorm → SiLU → Conv → GroupNorm → SiLU → Conv + skip' },
              { id: 'um_attn', type: 'attention', label: 'Self-Attention', desc: '1280 维自注意力', detail: '最低分辨率的 Self-Attention，注入文本条件' },
              { id: 'um_res2', type: 'custom', label: 'ResBlock', desc: 'ResBlock(1280→1280)', icon: LUCIDE_ICONS['🔗'], detail: '残差块：GroupNorm → SiLU → Conv → GroupNorm → SiLU → Conv + skip' }
            ]},
          { id: 'unet_dec', type: 'custom', label: 'Decoder', desc: '上采样路径：Upsample + ResBlock + Attention', icon: LUCIDE_ICONS['⬆️'],
            detail: '逐步恢复空间分辨率，与编码器特征拼接（Skip Connection）',
            children: [
              { id: 'ud_up1', type: 'conv', label: 'Upsample', desc: 'Nearest Upsample 2× + Conv', params: { in_ch: 1280, out_ch: 1280, kernel: 3 }, detail: '最近邻上采样 2 倍 + 3×3 卷积平滑' },
              { id: 'ud_res1', type: 'custom', label: 'ResBlock + Skip', desc: 'ResBlock(1280+1280→1280)', icon: LUCIDE_ICONS['🔗'], detail: '与编码器特征拼接后做残差块' },
              { id: 'ud_attn1', type: 'attention', label: 'Cross-Attention', desc: '1280 维交叉注意力', detail: 'Cross-Attention：Q=图像特征, K/V=文本条件' },
              { id: 'ud_up2', type: 'conv', label: 'Upsample', desc: 'Nearest Upsample 2× + Conv', params: { in_ch: 1280, out_ch: 640, kernel: 3 }, detail: '最近邻上采样 2 倍 + 3×3 卷积平滑' },
              { id: 'ud_res2', type: 'custom', label: 'ResBlock + Skip', desc: 'ResBlock(640+640→640)', icon: LUCIDE_ICONS['🔗'], detail: '与编码器特征拼接后做残差块' },
              { id: 'ud_attn2', type: 'attention', label: 'Cross-Attention', desc: '640 维交叉注意力', detail: 'Cross-Attention 注入文本条件' }
            ]}
        ]},
      { id: 'vae', type: 'custom', label: 'VAE (变分自编码器)', desc: '图像 ↔ 潜在空间转换', icon: LUCIDE_ICONS['🔄'],
        detail: 'VAE Encoder 将 512×512 图像压缩为 64×64×4 的潜在表示；VAE Decoder 将潜在表示还原为图像',
        parallel: true,
        children: [
          { id: 'vae_enc', type: 'conv', label: 'VAE Encoder', desc: '图像 → 潜在表示', params: { in_ch: 3, out_ch: 4 }, detail: '将 512×512×3 图像编码为 64×64×4 的潜在向量' },
          { id: 'vae_dec', type: 'conv', label: 'VAE Decoder', desc: '潜在表示 → 图像', params: { in_ch: 4, out_ch: 3 }, detail: '将 64×64×4 的潜在向量解码为 512×512×3 图像' }
        ]},
      { id: 'output', type: 'output', label: 'Output', desc: '512×512×3 生成图像', detail: '最终输出的生成图像' }
    ]
  },

  // ==================== ConvNeXt ====================
  'ConvNeXt': {
    type: 'cnn',
    params: { variant: { label: '变体', type: 'select', options: ['Tiny', 'Small', 'Base', 'Large', 'XLarge'], default: 'Base' } },
    blocks: [
      { id: 'input', type: 'input', label: 'Input', desc: '224×224×3', detail: '输入为 224×224 的三通道 RGB 图像' },
      { id: 'stem', type: 'custom', label: 'Stem', desc: 'Conv 4×4, stride 4 + LayerNorm', icon: LUCIDE_ICONS['🔧'],
        detail: '借鉴 Swin Transformer：使用 4×4 大卷积核(stride=4) 替代 7×7，使用 LayerNorm 替代 BatchNorm',
        children: [
          { id: 'stem_conv', type: 'conv', label: 'Conv 4×4', desc: 'Conv 96@4×4, stride 4', params: { in_ch: 3, out_ch: 96, kernel: 4, stride: 4, norm: 'none' } },
          { id: 'stem_ln', type: 'norm', label: 'LayerNorm', desc: 'LayerNorm2d(96)' }
        ]},
      { id: 'convnext_block', type: 'custom', label: 'ConvNeXt Block', desc: 'DW Conv 7×7 + LayerNorm + GELU + PW Conv', icon: LUCIDE_ICONS['🧩'],
        detail: '借鉴 Transformer 设计的现代化 Conv Block：7×7 Depthwise Conv → LayerNorm → 1×1 Conv(GELU) → 1×1 Conv + 残差',
        children: [
          { id: 'cn_dw', type: 'conv', label: 'DW Conv 7×7', desc: 'Depthwise Conv 7×7', params: { in_ch: 96, out_ch: 96, kernel: 7, depthwise: true }, detail: '使用 7×7 大卷积核（借鉴 Transformer 的全局感受野）' },
          { id: 'cn_ln', type: 'norm', label: 'LayerNorm', desc: 'LayerNorm（在 DW Conv 后）' },
          { id: 'cn_pw1', type: 'conv', label: 'PW Conv (expand)', desc: '1×1 Conv(4x) + GELU', params: { in_ch: 96, out_ch: 384, kernel: 1, act: 'GELU' }, detail: '1×1 卷积扩展通道数 4 倍 + GELU 激活' },
          { id: 'cn_pw2', type: 'conv', label: 'PW Conv (project)', desc: '1×1 Conv + Scale + residual', params: { in_ch: 384, out_ch: 96, kernel: 1 }, detail: '1×1 卷积降维 + LayerScale + 残差连接' }
        ]},
      { id: 'stages', type: 'custom', label: '4 Stages', desc: '4 个阶段，逐步增加通道数', icon: LUCIDE_ICONS['📋'],
        detail: 'Stage 1(96) → Stage 2(192) → Stage 3(384) → Stage 4(768)，每个阶段包含多个 ConvNeXt Block + Downsample',
        children: [
          { id: 'cn_s1', type: 'custom', label: 'Stage 1', desc: '3× ConvNeXt Block, 96ch, 56×56', icon: LUCIDE_ICONS['📦'], detail: '3 个 ConvNeXt Block，通道数 96，空间尺寸 56×56' },
          { id: 'cn_s2', type: 'custom', label: 'Stage 2', desc: '3× ConvNeXt Block, 192ch, 28×28', icon: LUCIDE_ICONS['📦'],
            detail: '3 个 ConvNeXt Block，通道数 192，空间尺寸 28×28',
            children: [
              { id: 'cn_s2_down', type: 'conv', label: 'Downsample', desc: 'LayerNorm + Conv 2×2, stride 2', params: { in_ch: 96, out_ch: 192, kernel: 2, stride: 2 }, detail: 'LayerNorm → 2×2 Conv(stride=2) 下采样，通道数翻倍' },
              { id: 'cn_s2_blocks', type: 'custom', label: 'ConvNeXt Blocks ×3', desc: '3× DW 7×7 + LN + GELU + PW', icon: LUCIDE_ICONS['🔄'], detail: '3 个 ConvNeXt Block，通道 192' }
            ]},
          { id: 'cn_s3', type: 'custom', label: 'Stage 3', desc: '9× ConvNeXt Block, 384ch, 14×14', icon: LUCIDE_ICONS['📦'],
            detail: '9 个 ConvNeXt Block，通道数 384，空间尺寸 14×14',
            children: [
              { id: 'cn_s3_down', type: 'conv', label: 'Downsample', desc: 'LayerNorm + Conv 2×2, stride 2', params: { in_ch: 192, out_ch: 384, kernel: 2, stride: 2 }, detail: 'LayerNorm → 2×2 Conv(stride=2) 下采样，通道数翻倍' },
              { id: 'cn_s3_blocks', type: 'custom', label: 'ConvNeXt Blocks ×9', desc: '9× DW 7×7 + LN + GELU + PW', icon: LUCIDE_ICONS['🔄'], detail: '9 个 ConvNeXt Block，通道 384' }
            ]},
          { id: 'cn_s4', type: 'custom', label: 'Stage 4', desc: '3× ConvNeXt Block, 768ch, 7×7', icon: LUCIDE_ICONS['📦'],
            detail: '3 个 ConvNeXt Block，通道数 768，空间尺寸 7×7',
            children: [
              { id: 'cn_s4_down', type: 'conv', label: 'Downsample', desc: 'LayerNorm + Conv 2×2, stride 2', params: { in_ch: 384, out_ch: 768, kernel: 2, stride: 2 }, detail: 'LayerNorm → 2×2 Conv(stride=2) 下采样，通道数翻倍' },
              { id: 'cn_s4_blocks', type: 'custom', label: 'ConvNeXt Blocks ×3', desc: '3× DW 7×7 + LN + GELU + PW', icon: LUCIDE_ICONS['🔄'], detail: '3 个 ConvNeXt Block，通道 768' }
            ]}
        ]},
      { id: 'head', type: 'custom', label: 'Head', desc: 'LayerNorm → Global AvgPool → Linear', icon: LUCIDE_ICONS['🎯'],
        detail: 'LayerNorm → Global AvgPool → Linear(768, 1000)',
        children: [
          { id: 'cn_head_ln', type: 'norm', label: 'LayerNorm', desc: 'LayerNorm(768)', detail: '最终 LayerNorm 归一化' },
          { id: 'cn_head_pool', type: 'pool', label: 'Global AvgPool', desc: 'AdaptiveAvgPool 1×1', params: { pool: 'avg', global: true }, detail: '全局平均池化将空间维度压缩为 1×1' },
          { id: 'cn_head_fc', type: 'linear', label: 'Linear', desc: 'Linear(768, 1000)', params: { in_f: 768, out_f: 1000 }, detail: '全连接层输出 1000 类' }
        ]},
      { id: 'output', type: 'output', label: 'Output', desc: 'Linear 1000', params: { out_f: 1000 }, detail: '输出 1000 类' }
    ]
  },

  // ==================== GPT-4 ====================
  'GPT-4': {
    type: 'transformer',
    params: {},
    blocks: [
      { id: 'input', type: 'input', label: 'Input', desc: 'Token 序列（文本 + 图像）', detail: '支持文本和图像的多模态输入，文本经过 Tokenizer，图像经过视觉编码器' },
      { id: 'vision', type: 'custom', label: 'Vision Encoder', desc: '图像编码模块', icon: LUCIDE_ICONS['👁️'],
        detail: '将输入图像编码为视觉 token 序列，与文本 token 拼接后输入 Transformer',
        parallel: true,
        children: [
          { id: 'vis_patch', type: 'conv', label: 'Patch Embedding', desc: '图像 → Patch 序列', params: { in_ch: 3, out_ch: 1024, kernel: 14, stride: 14 }, detail: '将图像分割为 patch 并嵌入' },
          { id: 'vis_enc', type: 'attention', label: 'Vision Transformer', desc: '多层 Transformer 编码', detail: '多层 Transformer 处理视觉 patch 序列' }
        ]},
      { id: 'tokenizer', type: 'custom', label: 'Tokenizer', desc: 'BPE 文本分词', icon: LUCIDE_ICONS['📝'], detail: 'Byte-Pair Encoding 将文本分割为 subword token', parallel: true },
      { id: 'decoder', type: 'custom', label: 'Transformer Decoder ×N', desc: 'N 层 Transformer Decoder (MoE)', icon: LUCIDE_ICONS['📦'],
        detail: '推测使用混合专家(MoE)架构，每层包含多个前馈网络专家，路由机制选择激活的专家',
        children: [
          { id: 'gpt_mha', type: 'attention', label: 'Multi-Head Attention', desc: '多头自注意力 + RoPE', detail: '带 Rotary Position Embedding (RoPE) 的多头注意力' },
          { id: 'gpt_ffn', type: 'custom', label: 'MoE FFN', desc: '混合专家前馈网络', icon: LUCIDE_ICONS['🧩'],
            detail: '多个 FFN 专家 + 路由门控，每次只激活部分专家，大幅提升参数量同时控制计算成本',
            children: [
              { id: 'gpt_router', type: 'linear', label: 'Router Gate', desc: '路由门控网络', params: { in_f: 4096, out_f: 8 }, detail: '将 token 表示映射为专家权重，选择 top-k 个专家激活' },
              { id: 'gpt_expert1', type: 'mlp', label: 'Expert 1', desc: 'Linear → GELU → Linear', params: { in_f: 4096, out_f: 16384, act: 'GELU' }, detail: '第 1 个 FFN 专家：4096 → 16384 → 4096' },
              { id: 'gpt_expert2', type: 'mlp', label: 'Expert 2', desc: 'Linear → GELU → Linear', params: { in_f: 4096, out_f: 16384, act: 'GELU' }, detail: '第 2 个 FFN 专家：4096 → 16384 → 4096' },
              { id: 'gpt_expert_n', type: 'custom', label: 'Experts 3-N', desc: '更多 FFN 专家', icon: LUCIDE_ICONS['🔄'], detail: '推测共 8~128 个专家（具体数量未公开），每个专家结构相同' },
              { id: 'gpt_wsum', type: 'linear', label: 'Weighted Sum', desc: '加权求和', params: { in_f: 4096, out_f: 4096 }, detail: '将各专家的输出按路由权重加权求和，得到最终 FFN 输出' }
            ]},
          { id: 'gpt_norm', type: 'norm', label: 'RMSNorm', desc: 'RMSNorm（非 LayerNorm）', detail: '使用 RMSNorm 替代 LayerNorm，计算效率更高' }
        ]},
      { id: 'output', type: 'output', label: 'Output', desc: 'Linear + Softmax → Token', params: { out_f: 100000 }, detail: 'Linear 投影到词表大小 → Softmax → 采样生成下一个 token' }
    ]
  },

  // ==================== YOLOv8 ====================
  'YOLOv8': {
    type: 'cnn',
    params: { numClasses: { label: '检测类别数', min: 1, max: 200, default: 80, step: 1 } },
    blocks: [
      { id: 'input', type: 'input', label: 'Input', desc: '640×640×3', detail: '输入为 640×640 的三通道 RGB 图像' },
      { id: 'stem', type: 'conv', label: 'Stem', desc: 'Conv 32@3×3, stride 2 + SiLU', params: { in_ch: 3, out_ch: 32, kernel: 3, stride: 2, act: 'SiLU' }, detail: '32 个 3×3 卷积核(stride=2) → SiLU，输出 320×320×32' },
      { id: 'p2', type: 'custom', label: 'P2', desc: 'C2f 模块, 256 通道', icon: LUCIDE_ICONS['🧱'],
        detail: 'C2f 模块处理，输出 160×160×64 特征图',
        children: [
          { id: 'p2_c2f', type: 'custom', label: 'C2f', desc: 'Conv→Split→2×Bottleneck→Concat→Conv', icon: LUCIDE_ICONS['🔀'],
            detail: 'C2f (Cross Stage Partial with 2 convolutions)：将输入一分为二，一半经过 2 个 Bottleneck，与另一半拼接后通过 1×1 Conv',
            children: [
              { id: 'p2_c2f_conv1', type: 'conv', label: 'Conv 1×1', desc: 'Conv 64@1×1', params: { in_ch: 32, out_ch: 64, kernel: 1, act: 'SiLU' }, detail: '1×1 卷积调整通道数' },
              { id: 'p2_c2f_split', type: 'custom', label: 'Split', desc: '特征图一分为二', detail: '将特征图沿通道维度分成两半' },
              { id: 'p2_c2f_bn', type: 'custom', label: 'Bottleneck ×2', desc: '2× Bottleneck(64→64)', icon: LUCIDE_ICONS['🔗'],
                detail: '每个 Bottleneck：Conv 1×1(降维) → Conv 3×3 → 残差连接',
                children: [
                  { id: 'p2_bn1', type: 'custom', label: 'Bottleneck 1', desc: '64→64', detail: 'Conv 64@1×1 → SiLU → Conv 64@3×3 → SiLU + skip' },
                  { id: 'p2_bn2', type: 'custom', label: 'Bottleneck 2', desc: '64→64', detail: 'Conv 64@1×1 → SiLU → Conv 64@3×3 → SiLU + skip' }
                ]},
              { id: 'p2_c2f_cat', type: 'custom', label: 'Concat', desc: '拼接 Split 和 Bottleneck 输出', detail: '将 Split 的另一半与 Bottleneck 序列的输出沿通道维度拼接' },
              { id: 'p2_c2f_conv2', type: 'conv', label: 'Conv 1×1', desc: 'Conv 64@1×1', params: { in_ch: 128, out_ch: 64, kernel: 1, act: 'SiLU' }, detail: '1×1 卷积融合拼接后的特征' }
            ]},
          { id: 'p2_conv', type: 'conv', label: 'Conv 3×3, stride 2', desc: 'Conv 64@3×3, stride 2', params: { in_ch: 64, out_ch: 64, kernel: 3, stride: 2, act: 'SiLU' }, detail: '3×3 卷积下采样至 160×160×64' }
        ]},
      { id: 'p3', type: 'custom', label: 'P3', desc: 'C2f 模块, 128 通道 (skip to FPN & Head)', icon: LUCIDE_ICONS['🧱'],
        detail: 'C2f 模块处理，输出 80×80×128 特征图，作为 FPN 和检测头的 skip 连接源',
        children: [
          { id: 'p3_c2f', type: 'custom', label: 'C2f', desc: 'Conv→Split→3×Bottleneck→Concat→Conv', icon: LUCIDE_ICONS['🔀'],
            detail: 'C2f 模块：将输入一分为二，一半经过 3 个 Bottleneck，与另一半拼接后通过 1×1 Conv',
            children: [
              { id: 'p3_c2f_conv1', type: 'conv', label: 'Conv 1×1', desc: 'Conv 128@1×1', params: { in_ch: 64, out_ch: 128, kernel: 1, act: 'SiLU' }, detail: '1×1 卷积调整通道数' },
              { id: 'p3_c2f_split', type: 'custom', label: 'Split', desc: '特征图一分为二', detail: '将特征图沿通道维度分成两半' },
              { id: 'p3_c2f_bn', type: 'custom', label: 'Bottleneck ×3', desc: '3× Bottleneck(64→64)', icon: LUCIDE_ICONS['🔗'],
                detail: '每个 Bottleneck：Conv 1×1(降维) → Conv 3×3 → 残差连接',
                children: [
                  { id: 'p3_bn1', type: 'custom', label: 'Bottleneck 1', desc: '64→64', detail: 'Conv 64@1×1 → SiLU → Conv 64@3×3 → SiLU + skip' },
                  { id: 'p3_bn2', type: 'custom', label: 'Bottleneck 2', desc: '64→64', detail: 'Conv 64@1×1 → SiLU → Conv 64@3×3 → SiLU + skip' },
                  { id: 'p3_bn3', type: 'custom', label: 'Bottleneck 3', desc: '64→64', detail: 'Conv 64@1×1 → SiLU → Conv 64@3×3 → SiLU + skip' }
                ]},
              { id: 'p3_c2f_cat', type: 'custom', label: 'Concat', desc: '拼接 Split 和 Bottleneck 输出', detail: '将 Split 的另一半与 Bottleneck 序列的输出沿通道维度拼接' },
              { id: 'p3_c2f_conv2', type: 'conv', label: 'Conv 1×1', desc: 'Conv 128@1×1', params: { in_ch: 192, out_ch: 128, kernel: 1, act: 'SiLU' }, detail: '1×1 卷积融合拼接后的特征' }
            ]},
          { id: 'p3_conv', type: 'conv', label: 'Conv 3×3, stride 2', desc: 'Conv 128@3×3, stride 2', params: { in_ch: 128, out_ch: 128, kernel: 3, stride: 2, act: 'SiLU' }, detail: '3×3 卷积下采样至 80×80×128' }
        ]},
      { id: 'p4', type: 'custom', label: 'P4', desc: 'C2f 模块, 256 通道 (skip to FPN & Head)', icon: LUCIDE_ICONS['🧱'],
        detail: 'C2f 模块处理，输出 40×40×256 特征图，作为 FPN 和检测头的 skip 连接源',
        children: [
          { id: 'p4_c2f', type: 'custom', label: 'C2f', desc: 'Conv→Split→6×Bottleneck→Concat→Conv', icon: LUCIDE_ICONS['🔀'],
            detail: 'C2f 模块：将输入一分为二，一半经过 6 个 Bottleneck，与另一半拼接后通过 1×1 Conv',
            children: [
              { id: 'p4_c2f_conv1', type: 'conv', label: 'Conv 1×1', desc: 'Conv 256@1×1', params: { in_ch: 128, out_ch: 256, kernel: 1, act: 'SiLU' }, detail: '1×1 卷积调整通道数' },
              { id: 'p4_c2f_split', type: 'custom', label: 'Split', desc: '特征图一分为二', detail: '将特征图沿通道维度分成两半' },
              { id: 'p4_c2f_bn', type: 'custom', label: 'Bottleneck ×6', desc: '6× Bottleneck(128→128)', icon: LUCIDE_ICONS['🔗'],
                detail: '每个 Bottleneck：Conv 1×1(降维) → Conv 3×3 → 残差连接',
                children: [
                  { id: 'p4_bn1', type: 'custom', label: 'Bottleneck 1', desc: '128→128', detail: 'Conv 128@1×1 → SiLU → Conv 128@3×3 → SiLU + skip' },
                  { id: 'p4_bn2', type: 'custom', label: 'Bottleneck 2', desc: '128→128', detail: 'Conv 128@1×1 → SiLU → Conv 128@3×3 → SiLU + skip' },
                  { id: 'p4_bn3', type: 'custom', label: 'Bottleneck 3', desc: '128→128', detail: 'Conv 128@1×1 → SiLU → Conv 128@3×3 → SiLU + skip' },
                  { id: 'p4_bn4', type: 'custom', label: 'Bottleneck 4', desc: '128→128', detail: 'Conv 128@1×1 → SiLU → Conv 128@3×3 → SiLU + skip' },
                  { id: 'p4_bn5', type: 'custom', label: 'Bottleneck 5', desc: '128→128', detail: 'Conv 128@1×1 → SiLU → Conv 128@3×3 → SiLU + skip' },
                  { id: 'p4_bn6', type: 'custom', label: 'Bottleneck 6', desc: '128→128', detail: 'Conv 128@1×1 → SiLU → Conv 128@3×3 → SiLU + skip' }
                ]},
              { id: 'p4_c2f_cat', type: 'custom', label: 'Concat', desc: '拼接 Split 和 Bottleneck 输出', detail: '将 Split 的另一半与 Bottleneck 序列的输出沿通道维度拼接' },
              { id: 'p4_c2f_conv2', type: 'conv', label: 'Conv 1×1', desc: 'Conv 256@1×1', params: { in_ch: 384, out_ch: 256, kernel: 1, act: 'SiLU' }, detail: '1×1 卷积融合拼接后的特征' }
            ]},
          { id: 'p4_conv', type: 'conv', label: 'Conv 3×3, stride 2', desc: 'Conv 256@3×3, stride 2', params: { in_ch: 256, out_ch: 256, kernel: 3, stride: 2, act: 'SiLU' }, detail: '3×3 卷积下采样至 40×40×256' }
        ]},
      { id: 'p5', type: 'custom', label: 'P5', desc: 'C2f 模块, 512 通道 (skip to FPN & Head)', icon: LUCIDE_ICONS['🧱'],
        detail: 'C2f 模块处理，输出 20×20×512 特征图，作为 FPN 和检测头的 skip 连接源',
        children: [
          { id: 'p5_c2f', type: 'custom', label: 'C2f', desc: 'Conv→Split→6×Bottleneck→Concat→Conv', icon: LUCIDE_ICONS['🔀'],
            detail: 'C2f 模块：将输入一分为二，一半经过 6 个 Bottleneck，与另一半拼接后通过 1×1 Conv',
            children: [
              { id: 'p5_c2f_conv1', type: 'conv', label: 'Conv 1×1', desc: 'Conv 512@1×1', params: { in_ch: 256, out_ch: 512, kernel: 1, act: 'SiLU' }, detail: '1×1 卷积调整通道数' },
              { id: 'p5_c2f_split', type: 'custom', label: 'Split', desc: '特征图一分为二', detail: '将特征图沿通道维度分成两半' },
              { id: 'p5_c2f_bn', type: 'custom', label: 'Bottleneck ×6', desc: '6× Bottleneck(256→256)', icon: LUCIDE_ICONS['🔗'],
                detail: '每个 Bottleneck：Conv 1×1(降维) → Conv 3×3 → 残差连接',
                children: [
                  { id: 'p5_bn1', type: 'custom', label: 'Bottleneck 1', desc: '256→256', detail: 'Conv 256@1×1 → SiLU → Conv 256@3×3 → SiLU + skip' },
                  { id: 'p5_bn2', type: 'custom', label: 'Bottleneck 2', desc: '256→256', detail: 'Conv 256@1×1 → SiLU → Conv 256@3×3 → SiLU + skip' },
                  { id: 'p5_bn3', type: 'custom', label: 'Bottleneck 3', desc: '256→256', detail: 'Conv 256@1×1 → SiLU → Conv 256@3×3 → SiLU + skip' },
                  { id: 'p5_bn4', type: 'custom', label: 'Bottleneck 4', desc: '256→256', detail: 'Conv 256@1×1 → SiLU → Conv 256@3×3 → SiLU + skip' },
                  { id: 'p5_bn5', type: 'custom', label: 'Bottleneck 5', desc: '256→256', detail: 'Conv 256@1×1 → SiLU → Conv 256@3×3 → SiLU + skip' },
                  { id: 'p5_bn6', type: 'custom', label: 'Bottleneck 6', desc: '256→256', detail: 'Conv 256@1×1 → SiLU → Conv 256@3×3 → SiLU + skip' }
                ]},
              { id: 'p5_c2f_cat', type: 'custom', label: 'Concat', desc: '拼接 Split 和 Bottleneck 输出', detail: '将 Split 的另一半与 Bottleneck 序列的输出沿通道维度拼接' },
              { id: 'p5_c2f_conv2', type: 'conv', label: 'Conv 1×1', desc: 'Conv 512@1×1', params: { in_ch: 768, out_ch: 512, kernel: 1, act: 'SiLU' }, detail: '1×1 卷积融合拼接后的特征' }
            ]},
          { id: 'p5_conv', type: 'conv', label: 'Conv 3×3, stride 2', desc: 'Conv 512@3×3, stride 2', params: { in_ch: 512, out_ch: 512, kernel: 3, stride: 2, act: 'SiLU' }, detail: '3×3 卷积下采样至 20×20×512' }
        ]},
      { id: 'sppf', type: 'custom', label: 'SPPF', desc: '空间金字塔池化-快速', icon: LUCIDE_ICONS['🔺'],
        detail: 'SPPF (Spatial Pyramid Pooling - Fast)：连续 3 次 5×5 MaxPool 后拼接，等效于不同尺度的池化感受野',
        children: [
          { id: 'sppf_conv', type: 'conv', label: 'Conv 1×1', desc: 'Conv 512@1×1', params: { in_ch: 512, out_ch: 512, kernel: 1, act: 'SiLU' }, detail: '1×1 卷积调整通道数' },
          { id: 'sppf_pool', type: 'custom', label: 'MaxPool ×3', desc: '3× 连续 MaxPool 5×5', detail: '对输入连续做 3 次 5×5 MaxPool，每次的输入都来自上一次的输出，产生不同感受野的特征' },
          { id: 'sppf_cat', type: 'custom', label: 'Concat', desc: '拼接 4 路特征', detail: '将原始输入和 3 次 MaxPool 的输出沿通道维度拼接，得到 512×4=2048 通道' },
          { id: 'sppf_conv2', type: 'conv', label: 'Conv 1×1', desc: 'Conv 512@1×1', params: { in_ch: 2048, out_ch: 512, kernel: 1, act: 'SiLU' }, detail: '1×1 卷积将通道数压缩回 512' }
        ]},
      { id: 'fpn_up1', type: 'conv', label: 'FPN Upsample 1', desc: 'Conv 256@1×1 + Upsample 2×', params: { in_ch: 512, out_ch: 256, kernel: 1, act: 'SiLU' }, detail: '1×1 卷积降维至 256 通道，然后上采样 2× 至 40×40' },
      { id: 'fpn_cat1', type: 'custom', label: 'FPN Concat 1', desc: 'Concat P4 特征', icon: LUCIDE_ICONS['🔗'], detail: '将上采样后的特征与 Backbone P4 层的特征沿通道维度拼接' },
      { id: 'fpn_c2f1', type: 'custom', label: 'FPN C2f 1', desc: 'C2f 模块, 256 通道', icon: LUCIDE_ICONS['🔀'],
        detail: 'C2f 模块处理拼接后的特征，输出 40×40×256',
        children: [
          { id: 'fpn_c2f1_conv1', type: 'conv', label: 'Conv 1×1', desc: 'Conv 256@1×1', params: { in_ch: 512, out_ch: 256, kernel: 1, act: 'SiLU' }, detail: '1×1 卷积调整通道数' },
          { id: 'fpn_c2f1_split', type: 'custom', label: 'Split', desc: '特征图一分为二' },
          { id: 'fpn_c2f1_bn', type: 'custom', label: 'Bottleneck ×3', desc: '3× Bottleneck(128→128)', icon: LUCIDE_ICONS['🔗'], detail: '3 个 Bottleneck 处理' },
          { id: 'fpn_c2f1_cat', type: 'custom', label: 'Concat', desc: '拼接输出' },
          { id: 'fpn_c2f1_conv2', type: 'conv', label: 'Conv 1×1', desc: 'Conv 256@1×1', params: { in_ch: 384, out_ch: 256, kernel: 1, act: 'SiLU' }, detail: '1×1 卷积融合特征' }
        ]},
      { id: 'fpn_up2', type: 'conv', label: 'FPN Upsample 2', desc: 'Conv 128@1×1 + Upsample 2×', params: { in_ch: 256, out_ch: 128, kernel: 1, act: 'SiLU' }, detail: '1×1 卷积降维至 128 通道，然后上采样 2× 至 80×80' },
      { id: 'fpn_cat2', type: 'custom', label: 'FPN Concat 2', desc: 'Concat P3 特征', icon: LUCIDE_ICONS['🔗'], detail: '将上采样后的特征与 Backbone P3 层的特征沿通道维度拼接' },
      { id: 'pan_conv2', type: 'conv', label: 'PAN Conv 2', desc: 'Conv 128@3×3, stride 2', params: { in_ch: 256, out_ch: 128, kernel: 3, stride: 2, act: 'SiLU' }, detail: '3×3 卷积下采样至 40×40×128' },
      { id: 'pan_cat2', type: 'custom', label: 'PAN Concat 2', desc: 'Concat P4 特征', icon: LUCIDE_ICONS['🔗'], detail: '将下采样后的特征与 FPN C2f 1 的输出沿通道维度拼接' },
      { id: 'fpn_c2f2', type: 'custom', label: 'FPN C2f 2', desc: 'C2f 模块, 256 通道', icon: LUCIDE_ICONS['🔀'],
        detail: 'C2f 模块处理拼接后的特征，输出 40×40×256',
        children: [
          { id: 'fpn_c2f2_conv1', type: 'conv', label: 'Conv 1×1', desc: 'Conv 256@1×1', params: { in_ch: 512, out_ch: 256, kernel: 1, act: 'SiLU' }, detail: '1×1 卷积调整通道数' },
          { id: 'fpn_c2f2_split', type: 'custom', label: 'Split', desc: '特征图一分为二' },
          { id: 'fpn_c2f2_bn', type: 'custom', label: 'Bottleneck ×3', desc: '3× Bottleneck(128→128)', icon: LUCIDE_ICONS['🔗'], detail: '3 个 Bottleneck 处理' },
          { id: 'fpn_c2f2_cat', type: 'custom', label: 'Concat', desc: '拼接输出' },
          { id: 'fpn_c2f2_conv2', type: 'conv', label: 'Conv 1×1', desc: 'Conv 256@1×1', params: { in_ch: 384, out_ch: 256, kernel: 1, act: 'SiLU' }, detail: '1×1 卷积融合特征' }
        ]},
      { id: 'pan_conv1', type: 'conv', label: 'PAN Conv 1', desc: 'Conv 256@3×3, stride 2', params: { in_ch: 256, out_ch: 256, kernel: 3, stride: 2, act: 'SiLU' }, detail: '3×3 卷积下采样至 20×20×256' },
      { id: 'pan_cat1', type: 'custom', label: 'PAN Concat 1', desc: 'Concat P5 特征', icon: LUCIDE_ICONS['🔗'], detail: '将下采样后的特征与 Backbone P5 层的特征沿通道维度拼接' },
      { id: 'pan_c2f1', type: 'custom', label: 'PAN C2f 1', desc: 'C2f 模块, 512 通道', icon: LUCIDE_ICONS['🔀'],
        detail: 'C2f 模块处理拼接后的特征，输出 20×20×512',
        children: [
          { id: 'pan_c2f1_conv1', type: 'conv', label: 'Conv 1×1', desc: 'Conv 512@1×1', params: { in_ch: 1024, out_ch: 512, kernel: 1, act: 'SiLU' }, detail: '1×1 卷积调整通道数' },
          { id: 'pan_c2f1_split', type: 'custom', label: 'Split', desc: '特征图一分为二' },
          { id: 'pan_c2f1_bn', type: 'custom', label: 'Bottleneck ×3', desc: '3× Bottleneck(256→256)', icon: LUCIDE_ICONS['🔗'], detail: '3 个 Bottleneck 处理' },
          { id: 'pan_c2f1_cat', type: 'custom', label: 'Concat', desc: '拼接输出' },
          { id: 'pan_c2f1_conv2', type: 'conv', label: 'Conv 1×1', desc: 'Conv 512@1×1', params: { in_ch: 768, out_ch: 512, kernel: 1, act: 'SiLU' }, detail: '1×1 卷积融合特征' }
        ]},
      { id: 'pan_c2f2', type: 'custom', label: 'PAN C2f 2', desc: 'C2f 模块, 256 通道', icon: LUCIDE_ICONS['🔀'],
        detail: 'C2f 模块处理，输出 40×40×256',
        children: [
          { id: 'pan_c2f2_conv1', type: 'conv', label: 'Conv 1×1', desc: 'Conv 256@1×1', params: { in_ch: 512, out_ch: 256, kernel: 1, act: 'SiLU' }, detail: '1×1 卷积调整通道数' },
          { id: 'pan_c2f2_split', type: 'custom', label: 'Split', desc: '特征图一分为二' },
          { id: 'pan_c2f2_bn', type: 'custom', label: 'Bottleneck ×3', desc: '3× Bottleneck(128→128)', icon: LUCIDE_ICONS['🔗'], detail: '3 个 Bottleneck 处理' },
          { id: 'pan_c2f2_cat', type: 'custom', label: 'Concat', desc: '拼接输出' },
          { id: 'pan_c2f2_conv2', type: 'conv', label: 'Conv 1×1', desc: 'Conv 256@1×1', params: { in_ch: 384, out_ch: 256, kernel: 1, act: 'SiLU' }, detail: '1×1 卷积融合特征' }
        ]},
      { id: 'head_p3', type: 'custom', label: 'Head P3', desc: '检测头 (80×80, 小目标)', icon: LUCIDE_ICONS['🎯'],
        detail: 'Anchor-Free 解耦检测头，处理 80×80 特征图用于小目标检测。分类和回归分支解耦',
        children: [
          { id: 'head_p3_conv1', type: 'conv', label: 'Conv 3×3', desc: 'Conv 128@3×3', params: { in_ch: 256, out_ch: 128, kernel: 3, act: 'SiLU' }, detail: '3×3 卷积提取特征' },
          { id: 'head_p3_conv2', type: 'conv', label: 'Conv 3×3', desc: 'Conv 128@3×3', params: { in_ch: 128, out_ch: 128, kernel: 3, act: 'SiLU' }, detail: '3×3 卷积进一步提取特征' },
          { id: 'head_p3_cls', type: 'conv', label: 'Cls Head', desc: 'Conv numClasses@1×1', params: { in_ch: 128, out_ch: 'numClasses', kernel: 1 }, detail: '分类分支：1×1 卷积输出类别概率' },
          { id: 'head_p3_reg', type: 'conv', label: 'Reg Head', desc: 'Conv 4×DFL@1×1', params: { in_ch: 128, out_ch: 64, kernel: 1 }, detail: '回归分支：1×1 卷积输出 4×16=64 维 DFL 分布' }
        ]},
      { id: 'head_p4', type: 'custom', label: 'Head P4', desc: '检测头 (40×40, 中目标)', icon: LUCIDE_ICONS['🎯'],
        detail: 'Anchor-Free 解耦检测头，处理 40×40 特征图用于中目标检测',
        children: [
          { id: 'head_p4_conv1', type: 'conv', label: 'Conv 3×3', desc: 'Conv 256@3×3', params: { in_ch: 256, out_ch: 256, kernel: 3, act: 'SiLU' }, detail: '3×3 卷积提取特征' },
          { id: 'head_p4_conv2', type: 'conv', label: 'Conv 3×3', desc: 'Conv 256@3×3', params: { in_ch: 256, out_ch: 256, kernel: 3, act: 'SiLU' }, detail: '3×3 卷积进一步提取特征' },
          { id: 'head_p4_cls', type: 'conv', label: 'Cls Head', desc: 'Conv numClasses@1×1', params: { in_ch: 256, out_ch: 'numClasses', kernel: 1 }, detail: '分类分支：1×1 卷积输出类别概率' },
          { id: 'head_p4_reg', type: 'conv', label: 'Reg Head', desc: 'Conv 4×DFL@1×1', params: { in_ch: 256, out_ch: 64, kernel: 1 }, detail: '回归分支：1×1 卷积输出 4×16=64 维 DFL 分布' }
        ]},
      { id: 'head_p5', type: 'custom', label: 'Head P5', desc: '检测头 (20×20, 大目标)', icon: LUCIDE_ICONS['🎯'],
        detail: 'Anchor-Free 解耦检测头，处理 20×20 特征图用于大目标检测',
        children: [
          { id: 'head_p5_conv1', type: 'conv', label: 'Conv 3×3', desc: 'Conv 512@3×3', params: { in_ch: 512, out_ch: 512, kernel: 3, act: 'SiLU' }, detail: '3×3 卷积提取特征' },
          { id: 'head_p5_conv2', type: 'conv', label: 'Conv 3×3', desc: 'Conv 512@3×3', params: { in_ch: 512, out_ch: 512, kernel: 3, act: 'SiLU' }, detail: '3×3 卷积进一步提取特征' },
          { id: 'head_p5_cls', type: 'conv', label: 'Cls Head', desc: 'Conv numClasses@1×1', params: { in_ch: 512, out_ch: 'numClasses', kernel: 1 }, detail: '分类分支：1×1 卷积输出类别概率' },
          { id: 'head_p5_reg', type: 'conv', label: 'Reg Head', desc: 'Conv 4×DFL@1×1', params: { in_ch: 512, out_ch: 64, kernel: 1 }, detail: '回归分支：1×1 卷积输出 4×16=64 维 DFL 分布' }
        ]},
      { id: 'output', type: 'output', label: 'Output', desc: '检测输出 (分类 + 回归)', detail: '三个尺度的检测头输出合并，包含类别概率和边界框坐标（通过 DFL 解码）' }
    ],
    edges: [
      { from: 'p3', to: 'fpn_cat2', edgeType: 'concat', style: 'dashed', color: '#22c55e', label: 'P3→FPN', fromAnchor: 'right', toAnchor: 'left' },
      { from: 'p4', to: 'fpn_cat1', edgeType: 'concat', style: 'dashed', color: '#22c55e', label: 'P4→FPN', fromAnchor: 'right', toAnchor: 'left' },
      { from: 'p3', to: 'head_p3', edgeType: 'skip', style: 'dashed', color: '#f59e0b', label: 'P3→Head', fromAnchor: 'right', toAnchor: 'left' },
      { from: 'p4', to: 'head_p4', edgeType: 'skip', style: 'dashed', color: '#f59e0b', label: 'P4→Head', fromAnchor: 'right', toAnchor: 'left' },
      { from: 'p5', to: 'head_p5', edgeType: 'skip', style: 'dashed', color: '#f59e0b', label: 'P5→Head', fromAnchor: 'right', toAnchor: 'left' }
    ]
  },

  // ==================== Faster R-CNN ====================
  'Faster R-CNN': {
    type: 'detection',
    params: {
      backbone: { label: 'Backbone', type: 'select', options: ['ResNet-50', 'ResNet-101', 'VGG-16'], default: 'ResNet-50' },
      numClasses: { label: '检测类别数', min: 1, max: 200, default: 80, step: 1 }
    },
    blocks: [
      { id: 'input', type: 'input', label: 'Input', desc: '任意尺寸 RGB 图像', detail: '输入为任意尺寸的三通道 RGB 图像' },
      { id: 'backbone', type: 'custom', label: 'Backbone (ResNet-50)', desc: '特征提取骨干网络', icon: LUCIDE_ICONS['🏗️'],
        detail: 'ResNet-50 作为特征提取器，输出多尺度特征图 C2(256ch), C3(512ch), C4(1024ch), C5(2048ch)',
        children: [
          { id: 'bb_stem', type: 'conv', label: 'Stem', desc: 'Conv 64@7×7 + BN + ReLU + MaxPool', params: { in_ch: 3, out_ch: 64, kernel: 7, stride: 2, norm: 'batch', act: 'ReLU' }, detail: '7×7 卷积 stride=2 → BN → ReLU → MaxPool 3×3 stride=2' },
          { id: 'bb_c2', type: 'custom', label: 'Layer 1 (C2)', desc: '3× Bottleneck, 256ch, 56×56', icon: LUCIDE_ICONS['📦'], detail: '3 个 Bottleneck，输出 56×56×256' },
          { id: 'bb_c3', type: 'custom', label: 'Layer 2 (C3)', desc: '4× Bottleneck, 512ch, 28×28', icon: LUCIDE_ICONS['📦'], detail: '4 个 Bottleneck，第一个 stride=2，输出 28×28×512' },
          { id: 'bb_c4', type: 'custom', label: 'Layer 3 (C4)', desc: '6× Bottleneck, 1024ch, 14×14', icon: LUCIDE_ICONS['📦'], detail: '6 个 Bottleneck，第一个 stride=2，输出 14×14×1024' },
          { id: 'bb_c5', type: 'custom', label: 'Layer 4 (C5)', desc: '3× Bottleneck, 2048ch, 7×7', icon: LUCIDE_ICONS['📦'], detail: '3 个 Bottleneck，第一个 stride=2，输出 7×7×2048' }
        ]},
      { id: 'rpn', type: 'custom', label: 'RPN (区域提议网络)', desc: '生成候选区域', icon: LUCIDE_ICONS['🎯'],
        detail: 'Region Proposal Network：在 C4 特征图上滑动，预测锚框前景/背景和边界框回归',
        children: [
          { id: 'rpn_conv', type: 'conv', label: 'RPN Conv', desc: 'Conv 512@3×3 + ReLU', params: { in_ch: 1024, out_ch: 512, kernel: 3, act: 'ReLU' }, detail: '3×3 卷积提取 RPN 特征，保持空间分辨率' },
          { id: 'rpn_cls', type: 'conv', label: 'RPN Cls', desc: 'Conv 18@1×1 (9 anchors × 2)', params: { in_ch: 512, out_ch: 18, kernel: 1 }, detail: '1×1 卷积输出每个位置 9 个锚框的前景/背景分类分数' },
          { id: 'rpn_reg', type: 'conv', label: 'RPN Reg', desc: 'Conv 36@1×1 (9 anchors × 4)', params: { in_ch: 512, out_ch: 36, kernel: 1 }, detail: '1×1 卷积输出每个位置 9 个锚框的边界框回归偏移量' },
          { id: 'rpn_proposal', type: 'custom', label: 'Proposal Layer', desc: 'NMS + Top-K', icon: LUCIDE_ICONS['⚙️'], detail: '根据 RPN 输出，应用 NMS 选择 Top-2000 候选框（训练）/ Top-300（测试）' }
        ]},
      { id: 'roi_pool', type: 'custom', label: 'RoI Pooling', desc: '候选框特征提取', icon: LUCIDE_ICONS['📦'],
        detail: '将 RPN 生成的候选框映射到 C4 特征图，使用 RoI Pooling 提取固定尺寸 7×7 特征' },
      { id: 'head', type: 'custom', label: 'Detection Head', desc: '分类与回归', icon: LUCIDE_ICONS['🎯'],
        detail: 'Fast R-CNN 检测头：对 RoI 特征进行分类和边界框精修',
        children: [
          { id: 'head_fc1', type: 'linear', label: 'FC1', desc: 'Linear 2048 → ReLU', params: { in_f: 25088, out_f: 2048, act: 'ReLU' }, detail: '展平 7×7×512=25088 → 全连接层 2048' },
          { id: 'head_fc2', type: 'linear', label: 'FC2', desc: 'Linear 2048 → ReLU', params: { in_f: 2048, out_f: 2048, act: 'ReLU' }, detail: '全连接层 2048 → 2048' },
          { id: 'head_cls', type: 'linear', label: 'Cls Score', desc: 'Linear(numClasses+1)', params: { in_f: 2048, out_f: 'numClasses+1' }, detail: '分类分支：输出类别概率（含背景）' },
          { id: 'head_reg', type: 'linear', label: 'BBox Reg', desc: 'Linear(numClasses×4)', params: { in_f: 2048, out_f: 'numClasses×4' }, detail: '回归分支：输出每个类别的边界框回归偏移量' }
        ]},
      { id: 'output', type: 'output', label: 'Output', desc: '检测结果', detail: '输出检测框坐标、类别标签和置信度分数' }
    ]
  },

  // ==================== Mask R-CNN ====================
  'Mask R-CNN': {
    type: 'detection',
    params: {
      backbone: { label: 'Backbone', type: 'select', options: ['ResNet-50-FPN', 'ResNet-101-FPN'], default: 'ResNet-50-FPN' },
      numClasses: { label: '检测类别数', min: 1, max: 200, default: 80, step: 1 }
    },
    blocks: [
      { id: 'input', type: 'input', label: 'Input', desc: '任意尺寸 RGB 图像', detail: '输入为任意尺寸的三通道 RGB 图像' },
      { id: 'backbone', type: 'custom', label: 'Backbone + FPN', desc: 'ResNet + 特征金字塔', icon: LUCIDE_ICONS['🏗️'],
        detail: 'ResNet-FPN 输出多尺度特征图 P2(256ch), P3(256ch), P4(256ch), P5(256ch), P6(256ch)',
        children: [
          { id: 'fpn_bottom', type: 'custom', label: 'Bottom-Up Path', desc: 'ResNet C2-C5', icon: LUCIDE_ICONS['⬇️'], detail: 'ResNet 自底向上路径，输出 C2-C5 特征' },
          { id: 'fpn_top', type: 'custom', label: 'Top-Down Path', desc: 'FPN P2-P5', icon: LUCIDE_ICONS['⬆️'], detail: 'FPN 自顶向下路径，通过上采样和横向连接生成 P2-P5' },
          { id: 'fpn_p6', type: 'conv', label: 'P6', desc: 'Conv C5 stride 2', params: { in_ch: 2048, out_ch: 256, kernel: 3, stride: 2 }, detail: 'C5 上 stride=2 卷积生成 P6 用于 RPN' }
        ]},
      { id: 'rpn', type: 'custom', label: 'RPN', desc: '区域提议网络', icon: LUCIDE_ICONS['🎯'],
        detail: '在 FPN 的 P2-P6 上并行运行 RPN，每个尺度独立预测锚框' },
      { id: 'roi_align', type: 'custom', label: 'RoI Align', desc: '双线性插值特征提取', icon: LUCIDE_ICONS['📐'],
        detail: 'RoI Align：使用双线性插值替代量化，消除 RoI Pooling 的像素级错位，输出 7×7 特征' },
      { id: 'box_head', type: 'custom', label: 'Box Head', desc: '检测头 (分类+回归)', icon: LUCIDE_ICONS['🎯'],
        detail: '与 Faster R-CNN 相同的检测头，输出类别和边界框',
        children: [
          { id: 'box_fc', type: 'mlp', label: 'FC Layers', desc: '2× FC 1024', params: { in_f: 12544, out_f: 1024, act: 'ReLU' }, detail: '展平 7×7×256=12544 → FC 1024 → FC 1024' },
          { id: 'box_cls', type: 'linear', label: 'Cls Score', desc: 'Linear(numClasses+1)', params: { in_f: 1024, out_f: 'numClasses+1' }, detail: '分类输出' },
          { id: 'box_reg', type: 'linear', label: 'BBox Reg', desc: 'Linear(numClasses×4)', params: { in_f: 1024, out_f: 'numClasses×4' }, detail: '边界框回归' }
        ]},
      { id: 'mask_head', type: 'custom', label: 'Mask Head', desc: '掩码预测分支', icon: LUCIDE_ICONS['🎭'],
        detail: '全卷积网络 (FCN) 预测每个 RoI 的像素级分割掩码，与 Box Head 并行',
        children: [
          { id: 'mask_conv1', type: 'conv', label: 'Conv 256@3×3', desc: 'Conv + ReLU', params: { in_ch: 256, out_ch: 256, kernel: 3, act: 'ReLU' }, detail: '第 1 个 3×3 卷积' },
          { id: 'mask_conv2', type: 'conv', label: 'Conv 256@3×3', desc: 'Conv + ReLU', params: { in_ch: 256, out_ch: 256, kernel: 3, act: 'ReLU' }, detail: '第 2 个 3×3 卷积' },
          { id: 'mask_conv3', type: 'conv', label: 'Conv 256@3×3', desc: 'Conv + ReLU', params: { in_ch: 256, out_ch: 256, kernel: 3, act: 'ReLU' }, detail: '第 3 个 3×3 卷积' },
          { id: 'mask_conv4', type: 'conv', label: 'Conv 256@3×3', desc: 'Conv + ReLU', params: { in_ch: 256, out_ch: 256, kernel: 3, act: 'ReLU' }, detail: '第 4 个 3×3 卷积' },
          { id: 'mask_deconv', type: 'conv', label: 'Deconv 2×2', desc: '转置卷积上采样', params: { in_ch: 256, out_ch: 256, kernel: 2, stride: 2 }, detail: '2×2 转置卷积上采样至 14×14' },
          { id: 'mask_out', type: 'conv', label: 'Mask Output', desc: 'Conv numClasses@1×1', params: { in_ch: 256, out_ch: 'numClasses', kernel: 1 }, detail: '1×1 卷积输出 numClasses 个 14×14 掩码（每类一个二进制掩码）' }
        ]},
      { id: 'output', type: 'output', label: 'Output', desc: '检测+分割结果', detail: '输出检测框、类别、置信度和像素级分割掩码' }
    ]
  },

  // ==================== SSD ====================
  'SSD': {
    type: 'detection',
    params: {
      backbone: { label: 'Backbone', type: 'select', options: ['VGG-16', 'ResNet-50'], default: 'VGG-16' },
      inputSize: { label: '输入尺寸', type: 'select', options: ['300', '512'], default: '300' },
      numClasses: { label: '检测类别数', min: 1, max: 200, default: 20, step: 1 }
    },
    blocks: [
      { id: 'input', type: 'input', label: 'Input', desc: '300×300 或 512×512 RGB', detail: '输入为固定尺寸的三通道 RGB 图像' },
      { id: 'backbone', type: 'custom', label: 'Backbone (VGG-16)', desc: '特征提取骨干', icon: LUCIDE_ICONS['🏗️'],
        detail: 'VGG-16 前 4 个卷积块，输出 conv4_3 作为第一个预测层特征源',
        children: [
          { id: 'vgg_conv1', type: 'custom', label: 'Conv Block 1', desc: '2× Conv 64@3×3 + MaxPool', icon: LUCIDE_ICONS['📦'], detail: '输出 150×150×64' },
          { id: 'vgg_conv2', type: 'custom', label: 'Conv Block 2', desc: '2× Conv 128@3×3 + MaxPool', icon: LUCIDE_ICONS['📦'], detail: '输出 75×75×128' },
          { id: 'vgg_conv3', type: 'custom', label: 'Conv Block 3', desc: '3× Conv 256@3×3 + MaxPool', icon: LUCIDE_ICONS['📦'], detail: '输出 38×38×256' },
          { id: 'vgg_conv4', type: 'custom', label: 'Conv Block 4 (conv4_3)', desc: '3× Conv 512@3×3', icon: LUCIDE_ICONS['📦'], detail: '输出 38×38×512，作为第一个预测层 (38×38)' }
        ]},
      { id: 'extra_layers', type: 'custom', label: 'Extra Feature Layers', desc: '额外特征层', icon: LUCIDE_ICONS['📋'],
        detail: '在 VGG-16 后添加 6 个卷积层，生成多尺度特征图用于检测',
        children: [
          { id: 'extra_fc7', type: 'conv', label: 'FC7 (Conv)', desc: 'Conv 1024@3×3', params: { in_ch: 512, out_ch: 1024, kernel: 3 }, detail: '原 VGG FC6/FC7 改为卷积层，输出 19×19×1024' },
          { id: 'extra_conv8', type: 'conv', label: 'Conv8', desc: 'Conv 256@1×1 + Conv 512@3×3', params: { in_ch: 1024, out_ch: 512, kernel: 3, stride: 2 }, detail: '输出 10×10×512' },
          { id: 'extra_conv9', type: 'conv', label: 'Conv9', desc: 'Conv 128@1×1 + Conv 256@3×3', params: { in_ch: 512, out_ch: 256, kernel: 3, stride: 2 }, detail: '输出 5×5×256' },
          { id: 'extra_conv10', type: 'conv', label: 'Conv10', desc: 'Conv 128@1×1 + Conv 256@3×3', params: { in_ch: 256, out_ch: 256, kernel: 3 }, detail: '输出 3×3×256' },
          { id: 'extra_conv11', type: 'conv', label: 'Conv11', desc: 'Conv 128@1×1 + Conv 256@3×3', params: { in_ch: 256, out_ch: 256, kernel: 3 }, detail: '输出 1×1×256' }
        ]},
      { id: 'pred_38', type: 'custom', label: 'Pred 38×38', desc: '小目标检测层', icon: LUCIDE_ICONS['🎯'],
        detail: '在 conv4_3 (512ch) 上预测，4 个默认框，负责检测小目标',
        children: [
          { id: 'p38_loc', type: 'conv', label: 'Loc', desc: 'Conv 16@3×3 (4×4)', params: { in_ch: 512, out_ch: 16, kernel: 3 }, detail: '4 个默认框 × 4 个坐标' },
          { id: 'p38_conf', type: 'conv', label: 'Conf', desc: 'Conv 84@3×3 (4×21)', params: { in_ch: 512, out_ch: 84, kernel: 3 }, detail: '4 个默认框 × 21 类（含背景）' }
        ]},
      { id: 'pred_19', type: 'custom', label: 'Pred 19×19', desc: 'FC7 检测层', icon: LUCIDE_ICONS['🎯'],
        detail: '在 FC7 (1024ch) 上预测，6 个默认框',
        children: [
          { id: 'p19_loc', type: 'conv', label: 'Loc', desc: 'Conv 24@3×3 (6×4)', params: { in_ch: 1024, out_ch: 24, kernel: 3 }, detail: '6 个默认框 × 4 个坐标' },
          { id: 'p19_conf', type: 'conv', label: 'Conf', desc: 'Conv 126@3×3 (6×21)', params: { in_ch: 1024, out_ch: 126, kernel: 3 }, detail: '6 个默认框 × 21 类' }
        ]},
      { id: 'pred_10', type: 'custom', label: 'Pred 10×10', desc: 'Conv8 检测层', icon: LUCIDE_ICONS['🎯'],
        detail: '在 Conv8 (512ch) 上预测，6 个默认框，负责检测大目标' },
      { id: 'pred_5', type: 'custom', label: 'Pred 5×5', desc: 'Conv9 检测层', icon: LUCIDE_ICONS['🎯'],
        detail: '在 Conv9 (256ch) 上预测，6 个默认框' },
      { id: 'pred_3', type: 'custom', label: 'Pred 3×3', desc: 'Conv10 检测层', icon: LUCIDE_ICONS['🎯'],
        detail: '在 Conv10 (256ch) 上预测，4 个默认框' },
      { id: 'pred_1', type: 'custom', label: 'Pred 1×1', desc: 'Conv11 检测层', icon: LUCIDE_ICONS['🎯'],
        detail: '在 Conv11 (256ch) 上预测，4 个默认框' },
      { id: 'nms', type: 'custom', label: 'NMS', desc: '非极大值抑制', icon: LUCIDE_ICONS['⚙️'], detail: '对所有预测框应用 NMS，去除重叠框' },
      { id: 'output', type: 'output', label: 'Output', desc: '检测结果', detail: '输出最终检测框、类别和置信度' }
    ]
  },

  // ==================== RetinaNet ====================
  'RetinaNet': {
    type: 'detection',
    params: {
      backbone: { label: 'Backbone', type: 'select', options: ['ResNet-50', 'ResNet-101'], default: 'ResNet-50' },
      numClasses: { label: '检测类别数', min: 1, max: 200, default: 80, step: 1 }
    },
    blocks: [
      { id: 'input', type: 'input', label: 'Input', desc: '任意尺寸 RGB 图像', detail: '输入为任意尺寸的三通道 RGB 图像' },
      { id: 'backbone', type: 'custom', label: 'Backbone (ResNet-50)', desc: '特征提取骨干', icon: LUCIDE_ICONS['🏗️'],
        detail: 'ResNet-50 输出 C3(512ch), C4(1024ch), C5(2048ch)' },
      { id: 'fpn', type: 'custom', label: 'FPN (特征金字塔)', desc: '金字塔特征融合', icon: LUCIDE_ICONS['🔺'],
        detail: 'FPN 生成 P3-P7 五个尺度的特征图，每个 256 通道',
        children: [
          { id: 'fpn_p5', type: 'conv', label: 'P5', desc: '1×1 Conv C5→256', params: { in_ch: 2048, out_ch: 256, kernel: 1 }, detail: 'C5 经 1×1 卷积降维至 256ch' },
          { id: 'fpn_p4', type: 'custom', label: 'P4', desc: 'Upsample P5 + C4', icon: LUCIDE_ICONS['🔗'], detail: 'P5 上采样 2× 后与 C4 相加' },
          { id: 'fpn_p3', type: 'custom', label: 'P3', desc: 'Upsample P4 + C3', icon: LUCIDE_ICONS['🔗'], detail: 'P4 上采样 2× 后与 C3 相加' },
          { id: 'fpn_p6', type: 'conv', label: 'P6', desc: 'Conv C5 stride 2', params: { in_ch: 2048, out_ch: 256, kernel: 3, stride: 2 }, detail: 'C5 经 stride=2 卷积生成 P6' },
          { id: 'fpn_p7', type: 'conv', label: 'P7', desc: 'ReLU + Conv P6 stride 2', params: { in_ch: 256, out_ch: 256, kernel: 3, stride: 2 }, detail: 'P6 经 ReLU 和 stride=2 卷积生成 P7' }
        ]},
      { id: 'subnet_cls', type: 'custom', label: 'Classification Subnet', desc: '分类子网络', icon: LUCIDE_ICONS['🎯'],
        detail: '对每个 FPN 层并行预测类别，使用 Focal Loss 解决类别不平衡',
        children: [
          { id: 'cls_conv1', type: 'conv', label: 'Conv 256@3×3', desc: 'Conv + ReLU', params: { in_ch: 256, out_ch: 256, kernel: 3, act: 'ReLU' }, detail: '第 1 个 3×3 卷积' },
          { id: 'cls_conv2', type: 'conv', label: 'Conv 256@3×3', desc: 'Conv + ReLU', params: { in_ch: 256, out_ch: 256, kernel: 3, act: 'ReLU' }, detail: '第 2 个 3×3 卷积' },
          { id: 'cls_conv3', type: 'conv', label: 'Conv 256@3×3', desc: 'Conv + ReLU', params: { in_ch: 256, out_ch: 256, kernel: 3, act: 'ReLU' }, detail: '第 3 个 3×3 卷积' },
          { id: 'cls_conv4', type: 'conv', label: 'Conv 256@3×3', desc: 'Conv + ReLU', params: { in_ch: 256, out_ch: 256, kernel: 3, act: 'ReLU' }, detail: '第 4 个 3×3 卷积' },
          { id: 'cls_out', type: 'conv', label: 'Cls Output', desc: 'Conv KA@3×3 (K×A)', params: { in_ch: 256, out_ch: 'KA', kernel: 3 }, detail: '输出 K 类 × A 个锚框的分类分数' }
        ]},
      { id: 'subnet_box', type: 'custom', label: 'Box Regression Subnet', desc: '回归子网络', icon: LUCIDE_ICONS['📦'],
        detail: '对每个 FPN 层并行预测边界框回归偏移量',
        children: [
          { id: 'box_conv1', type: 'conv', label: 'Conv 256@3×3', desc: 'Conv + ReLU', params: { in_ch: 256, out_ch: 256, kernel: 3, act: 'ReLU' }, detail: '第 1 个 3×3 卷积' },
          { id: 'box_conv2', type: 'conv', label: 'Conv 256@3×3', desc: 'Conv + ReLU', params: { in_ch: 256, out_ch: 256, kernel: 3, act: 'ReLU' }, detail: '第 2 个 3×3 卷积' },
          { id: 'box_conv3', type: 'conv', label: 'Conv 256@3×3', desc: 'Conv + ReLU', params: { in_ch: 256, out_ch: 256, kernel: 3, act: 'ReLU' }, detail: '第 3 个 3×3 卷积' },
          { id: 'box_conv4', type: 'conv', label: 'Conv 256@3×3', desc: 'Conv + ReLU', params: { in_ch: 256, out_ch: 256, kernel: 3, act: 'ReLU' }, detail: '第 4 个 3×3 卷积' },
          { id: 'box_out', type: 'conv', label: 'Box Output', desc: 'Conv 4A@3×3', params: { in_ch: 256, out_ch: '4A', kernel: 3 }, detail: '输出 4 个坐标 × A 个锚框的回归偏移量' }
        ]},
      { id: 'focal_loss', type: 'custom', label: 'Focal Loss', desc: '焦点损失', icon: LUCIDE_ICONS['⚡'],
        detail: 'FL(pt) = -α(1-pt)^γ log(pt)，降低易分类样本权重，聚焦难分类样本' },
      { id: 'output', type: 'output', label: 'Output', desc: '检测结果', detail: '输出检测框、类别和置信度' }
    ]
  },

  // ==================== FCN ====================
  'FCN': {
    type: 'segmentation',
    params: {
      backbone: { label: 'Backbone', type: 'select', options: ['VGG-16', 'ResNet-50'], default: 'VGG-16' },
      variant: { label: '变体', type: 'select', options: ['FCN-32s', 'FCN-16s', 'FCN-8s'], default: 'FCN-8s' },
      numClasses: { label: '分割类别数', min: 1, max: 200, default: 21, step: 1 }
    },
    blocks: [
      { id: 'input', type: 'input', label: 'Input', desc: '任意尺寸 RGB 图像', detail: '输入为任意尺寸的三通道 RGB 图像，全卷积网络可处理任意尺寸' },
      { id: 'encoder', type: 'custom', label: 'Encoder (VGG-16)', desc: '编码器（分类网络）', icon: LUCIDE_ICONS['🏗️'],
        detail: 'VGG-16 作为编码器，提取多层级特征',
        children: [
          { id: 'enc_pool3', type: 'custom', label: 'Pool3', desc: '256ch, H/8×W/8', icon: LUCIDE_ICONS['📦'], detail: '第 3 个池化层输出，256 通道，分辨率 1/8' },
          { id: 'enc_pool4', type: 'custom', label: 'Pool4', desc: '512ch, H/16×W/16', icon: LUCIDE_ICONS['📦'], detail: '第 4 个池化层输出，512 通道，分辨率 1/16' },
          { id: 'enc_pool5', type: 'custom', label: 'Pool5', desc: '512ch, H/32×W/32', icon: LUCIDE_ICONS['📦'], detail: '第 5 个池化层输出，512 通道，分辨率 1/32' },
          { id: 'enc_fc', type: 'conv', label: 'FC Conv', desc: 'Conv 4096@7×7 + Conv 4096@1×1', params: { in_ch: 512, out_ch: 4096, kernel: 7 }, detail: '将全连接层转换为卷积层' }
        ]},
      { id: 'fc7_conv', type: 'conv', label: 'Score Pool5', desc: 'Conv numClasses@1×1', params: { in_ch: 4096, out_ch: 'numClasses', kernel: 1 }, detail: '1×1 卷积输出类别分数，尺寸 H/32×W/32' },
      { id: 'deconv32', type: 'conv', label: 'Deconv 32×', desc: '转置卷积上采样 32 倍', params: { in_ch: 'numClasses', out_ch: 'numClasses', kernel: 64, stride: 32 }, detail: 'FCN-32s：直接上采样 32 倍至原图尺寸' },
      { id: 'skip16', type: 'custom', label: 'Skip Pool4', desc: 'Pool4 跳跃连接', icon: LUCIDE_ICONS['🔗'],
        detail: 'FCN-16s：Pool4 经 1×1 卷积后与上采样 2× 的 Pool5 相加',
        children: [
          { id: 'skip16_conv', type: 'conv', label: 'Score Pool4', desc: 'Conv numClasses@1×1', params: { in_ch: 512, out_ch: 'numClasses', kernel: 1 }, detail: 'Pool4 经 1×1 卷积降维' },
          { id: 'skip16_fuse', type: 'custom', label: 'Fuse', desc: '逐元素相加', icon: LUCIDE_ICONS['➕'], detail: '与上采样 2× 的 Pool5 逐元素相加' },
          { id: 'skip16_up', type: 'conv', label: 'Deconv 16×', desc: '转置卷积上采样 16 倍', params: { in_ch: 'numClasses', out_ch: 'numClasses', kernel: 32, stride: 16 }, detail: '上采样至原图尺寸' }
        ]},
      { id: 'skip8', type: 'custom', label: 'Skip Pool3', desc: 'Pool3 跳跃连接', icon: LUCIDE_ICONS['🔗'],
        detail: 'FCN-8s：Pool3 与上采样 2× 的融合特征相加，再上采样 8 倍',
        children: [
          { id: 'skip8_conv', type: 'conv', label: 'Score Pool3', desc: 'Conv numClasses@1×1', params: { in_ch: 256, out_ch: 'numClasses', kernel: 1 }, detail: 'Pool3 经 1×1 卷积降维' },
          { id: 'skip8_fuse', type: 'custom', label: 'Fuse', desc: '逐元素相加', icon: LUCIDE_ICONS['➕'], detail: '与上采样 2× 的特征逐元素相加' },
          { id: 'skip8_up', type: 'conv', label: 'Deconv 8×', desc: '转置卷积上采样 8 倍', params: { in_ch: 'numClasses', out_ch: 'numClasses', kernel: 16, stride: 8 }, detail: '上采样至原图尺寸' }
        ]},
      { id: 'output', type: 'output', label: 'Output', desc: '像素级分类', detail: '输出与输入图像相同尺寸的像素级类别预测' }
    ]
  },

  // ==================== U-Net ====================
  'U-Net': {
    type: 'segmentation',
    params: {
      numClasses: { label: '分割类别数', min: 1, max: 200, default: 2, step: 1 },
      baseChannels: { label: '基础通道数', min: 32, max: 128, default: 64, step: 32 }
    },
    blocks: [
      { id: 'input', type: 'input', label: 'Input', desc: '572×572 灰度/彩色图像', detail: '输入为 572×572 的图像（ biomedical 图像通常为灰度）' },
      { id: 'enc1', type: 'custom', label: 'Encoder Block 1', desc: 'Conv→Conv→MaxPool', icon: LUCIDE_ICONS['⬇️'],
        detail: '收缩路径第 1 层：2× Conv 64@3×3 → MaxPool 2×2，输出 284×284×64',
        children: [
          { id: 'e1_conv1', type: 'conv', label: 'Conv 64@3×3', desc: 'Conv + ReLU', params: { in_ch: 1, out_ch: 64, kernel: 3, act: 'ReLU' }, detail: '第 1 个 3×3 卷积' },
          { id: 'e1_conv2', type: 'conv', label: 'Conv 64@3×3', desc: 'Conv + ReLU', params: { in_ch: 64, out_ch: 64, kernel: 3, act: 'ReLU' }, detail: '第 2 个 3×3 卷积' },
          { id: 'e1_pool', type: 'pool', label: 'MaxPool 2×2', desc: '下采样', params: { pool: 'max', pool_size: 2 }, detail: '2×2 最大池化，尺寸减半' }
        ]},
      { id: 'enc2', type: 'custom', label: 'Encoder Block 2', desc: '128ch, 140×140', icon: LUCIDE_ICONS['⬇️'], detail: '收缩路径第 2 层，输出 140×140×128' },
      { id: 'enc3', type: 'custom', label: 'Encoder Block 3', desc: '256ch, 68×68', icon: LUCIDE_ICONS['⬇️'], detail: '收缩路径第 3 层，输出 68×68×256' },
      { id: 'enc4', type: 'custom', label: 'Encoder Block 4', desc: '512ch, 32×32', icon: LUCIDE_ICONS['⬇️'], detail: '收缩路径第 4 层，输出 32×32×512' },
      { id: 'bottleneck', type: 'custom', label: 'Bottleneck', desc: '1024ch, 28×28', icon: LUCIDE_ICONS['🔄'],
        detail: '最底层：2× Conv 1024@3×3，无池化，输出 28×28×1024',
        children: [
          { id: 'bn_conv1', type: 'conv', label: 'Conv 1024@3×3', desc: 'Conv + ReLU', params: { in_ch: 512, out_ch: 1024, kernel: 3, act: 'ReLU' }, detail: '第 1 个 3×3 卷积' },
          { id: 'bn_conv2', type: 'conv', label: 'Conv 1024@3×3', desc: 'Conv + ReLU', params: { in_ch: 1024, out_ch: 1024, kernel: 3, act: 'ReLU' }, detail: '第 2 个 3×3 卷积' }
        ]},
      { id: 'dec4', type: 'custom', label: 'Decoder Block 4', desc: '512ch, 52×52', icon: LUCIDE_ICONS['⬆️'],
        detail: '扩张路径第 4 层：上采样 → 拼接 Skip → 2× Conv',
        children: [
          { id: 'd4_up', type: 'conv', label: 'Up-Conv 2×2', desc: '转置卷积上采样', params: { in_ch: 1024, out_ch: 512, kernel: 2, stride: 2 }, detail: '2×2 转置卷积上采样，通道减半' },
          { id: 'd4_cat', type: 'custom', label: 'Concat', desc: '拼接 Encoder4', icon: LUCIDE_ICONS['🔗'], detail: '与 Encoder Block 4 的特征拼接（跳跃连接）' },
          { id: 'd4_conv1', type: 'conv', label: 'Conv 512@3×3', desc: 'Conv + ReLU', params: { in_ch: 1024, out_ch: 512, kernel: 3, act: 'ReLU' }, detail: '第 1 个 3×3 卷积' },
          { id: 'd4_conv2', type: 'conv', label: 'Conv 512@3×3', desc: 'Conv + ReLU', params: { in_ch: 512, out_ch: 512, kernel: 3, act: 'ReLU' }, detail: '第 2 个 3×3 卷积' }
        ]},
      { id: 'dec3', type: 'custom', label: 'Decoder Block 3', desc: '256ch, 100×100', icon: LUCIDE_ICONS['⬆️'], detail: '扩张路径第 3 层，拼接 Encoder3' },
      { id: 'dec2', type: 'custom', label: 'Decoder Block 2', desc: '128ch, 196×196', icon: LUCIDE_ICONS['⬆️'], detail: '扩张路径第 2 层，拼接 Encoder2' },
      { id: 'dec1', type: 'custom', label: 'Decoder Block 1', desc: '64ch, 388×388', icon: LUCIDE_ICONS['⬆️'], detail: '扩张路径第 1 层，拼接 Encoder1' },
      { id: 'output_conv', type: 'conv', label: 'Output Conv', desc: 'Conv numClasses@1×1', params: { in_ch: 64, out_ch: 'numClasses', kernel: 1 }, detail: '1×1 卷积输出分割图' },
      { id: 'output', type: 'output', label: 'Output', desc: '分割掩码', detail: '输出与输入图像相同尺寸（388×388）的像素级分割结果' }
    ]
  },

  // ==================== DeepLab v3+ ====================
  'DeepLab v3+': {
    type: 'segmentation',
    params: {
      backbone: { label: 'Backbone', type: 'select', options: ['Xception-65', 'Xception-71', 'ResNet-101'], default: 'Xception-65' },
      outputStride: { label: '输出步长', type: 'select', options: ['8', '16'], default: '16' },
      numClasses: { label: '分割类别数', min: 1, max: 200, default: 21, step: 1 }
    },
    blocks: [
      { id: 'input', type: 'input', label: 'Input', desc: '513×513 RGB 图像', detail: '输入为 513×513 的三通道 RGB 图像' },
      { id: 'backbone', type: 'custom', label: 'Backbone (Xception-65)', desc: '改进的 Xception 编码器', icon: LUCIDE_ICONS['🏗️'],
        detail: '改进的 Xception 作为编码器，使用深度可分离卷积和空洞卷积',
        children: [
          { id: 'xcep_entry', type: 'custom', label: 'Entry Flow', desc: '3× Conv + 3× SepConv', icon: LUCIDE_ICONS['📦'], detail: '入口流：标准卷积 + 深度可分离卷积' },
          { id: 'xcep_middle', type: 'custom', label: 'Middle Flow', desc: '16× SepConv', icon: LUCIDE_ICONS['📦'], detail: '中间流：16 个重复的深度可分离卷积块' },
          { id: 'xcep_exit', type: 'custom', label: 'Exit Flow', desc: '2× SepConv + Conv', icon: LUCIDE_ICONS['📦'], detail: '出口流：深度可分离卷积 + 标准卷积' }
        ]},
      { id: 'aspp', type: 'custom', label: 'ASPP', desc: '空洞空间金字塔池化', icon: LUCIDE_ICONS['🔺'],
        detail: 'Atrous Spatial Pyramid Pooling：使用不同扩张率的空洞卷积捕获多尺度上下文',
        children: [
          { id: 'aspp_conv1', type: 'conv', label: 'Conv 1×1', desc: 'Conv 256@1×1', params: { in_ch: 2048, out_ch: 256, kernel: 1 }, detail: '1×1 卷积（rate=1）' },
          { id: 'aspp_conv3_6', type: 'conv', label: 'Conv 3×3, rate=6', desc: 'Atrous Conv 256@3×3', params: { in_ch: 2048, out_ch: 256, kernel: 3, dilation: 6 }, detail: '扩张率 6 的空洞卷积' },
          { id: 'aspp_conv3_12', type: 'conv', label: 'Conv 3×3, rate=12', desc: 'Atrous Conv 256@3×3', params: { in_ch: 2048, out_ch: 256, kernel: 3, dilation: 12 }, detail: '扩张率 12 的空洞卷积' },
          { id: 'aspp_conv3_18', type: 'conv', label: 'Conv 3×3, rate=18', desc: 'Atrous Conv 256@3×3', params: { in_ch: 2048, out_ch: 256, kernel: 3, dilation: 18 }, detail: '扩张率 18 的空洞卷积' },
          { id: 'aspp_pool', type: 'custom', label: 'Image Pooling', desc: 'GAP + Conv 1×1', icon: LUCIDE_ICONS['📊'], detail: '全局平均池化 + 1×1 卷积' },
          { id: 'aspp_concat', type: 'custom', label: 'Concat', desc: '拼接 5 路特征', icon: LUCIDE_ICONS['🔗'], detail: '拼接 5 个分支的输出，256×5=1280 通道' },
          { id: 'aspp_proj', type: 'conv', label: 'Projection', desc: 'Conv 256@1×1', params: { in_ch: 1280, out_ch: 256, kernel: 1 }, detail: '1×1 卷积降维至 256 通道' }
        ]},
      { id: 'decoder', type: 'custom', label: 'Decoder', desc: '编码器-解码器结构', icon: LUCIDE_ICONS['⬆️'],
        detail: '逐步恢复空间分辨率，融合低层特征',
        children: [
          { id: 'dec_low', type: 'conv', label: 'Low-Level Conv', desc: 'Conv 48@1×1', params: { in_ch: 128, out_ch: 48, kernel: 1 }, detail: '将低层特征降维至 48 通道' },
          { id: 'dec_up4', type: 'conv', label: 'Upsample 4×', desc: '双线性插值上采样', params: { in_ch: 256, out_ch: 256 }, detail: 'ASPP 输出上采样 4 倍' },
          { id: 'dec_concat', type: 'custom', label: 'Concat', desc: '拼接低层特征', icon: LUCIDE_ICONS['🔗'], detail: '与低层特征拼接，256+48=304 通道' },
          { id: 'dec_conv1', type: 'conv', label: 'SepConv 3×3', desc: 'Depthwise Sep Conv 256@3×3', params: { in_ch: 304, out_ch: 256, kernel: 3, depthwise: true }, detail: '深度可分离卷积' },
          { id: 'dec_conv2', type: 'conv', label: 'SepConv 3×3', desc: 'Depthwise Sep Conv 256@3×3', params: { in_ch: 256, out_ch: 256, kernel: 3, depthwise: true }, detail: '深度可分离卷积' }
        ]},
      { id: 'output_up', type: 'conv', label: 'Upsample 4×', desc: '双线性插值上采样', params: { in_ch: 256, out_ch: 256 }, detail: '最终上采样 4 倍至原图尺寸' },
      { id: 'output_conv', type: 'conv', label: 'Output', desc: 'Conv numClasses@1×1', params: { in_ch: 256, out_ch: 'numClasses', kernel: 1 }, detail: '1×1 卷积输出分割图' },
      { id: 'output', type: 'output', label: 'Output', desc: '分割掩码', detail: '输出 513×513 的像素级分割结果' }
    ]
  },

  // ==================== LSTM ====================
  'LSTM': {
    type: 'rnn',
    params: {
      inputSize: { label: '输入维度', min: 10, max: 1000, default: 128, step: 10 },
      hiddenSize: { label: '隐藏层维度', min: 32, max: 1024, default: 256, step: 32 },
      numLayers: { label: 'LSTM 层数', min: 1, max: 4, default: 2, step: 1 },
      bidirectional: { label: '双向', type: 'select', options: ['true', 'false'], default: 'false' }
    },
    blocks: [
      { id: 'input', type: 'input', label: 'Input', desc: '序列输入 x_t', detail: '输入序列 x_1, x_2, ..., x_T，每个时间步的输入向量' },
      { id: 'embedding', type: 'linear', label: 'Embedding', desc: 'Input Embedding', params: { in_f: 'vocab_size', out_f: 'inputSize' }, detail: '将输入 token 嵌入为稠密向量（可选）' },
      { id: 'lstm_cell', type: 'custom', label: 'LSTM Cell', desc: '长短期记忆单元', icon: LUCIDE_ICONS['🧠'],
        detail: 'LSTM 核心单元：输入门、遗忘门、输出门和细胞状态',
        children: [
          { id: 'forget_gate', type: 'custom', label: 'Forget Gate', desc: 'f_t = σ(W_f·[h_{t-1}, x_t] + b_f)', icon: LUCIDE_ICONS['🚪'],
            detail: '遗忘门：决定保留多少历史信息，σ 输出 0~1' },
          { id: 'input_gate', type: 'custom', label: 'Input Gate', desc: 'i_t = σ(W_i·[h_{t-1}, x_t] + b_i)', icon: LUCIDE_ICONS['🚪'],
            detail: '输入门：控制新信息的写入比例' },
          { id: 'candidate', type: 'custom', label: 'Candidate', desc: 'C̃_t = tanh(W_C·[h_{t-1}, x_t] + b_C)', icon: LUCIDE_ICONS['📝'],
            detail: '候选细胞状态：tanh 生成新的候选值' },
          { id: 'cell_state', type: 'custom', label: 'Cell State', desc: 'C_t = f_t ⊙ C_{t-1} + i_t ⊙ C̃_t', icon: LUCIDE_ICONS['💾'],
            detail: '细胞状态更新：遗忘旧信息 + 写入新信息' },
          { id: 'output_gate', type: 'custom', label: 'Output Gate', desc: 'o_t = σ(W_o·[h_{t-1}, x_t] + b_o)', icon: LUCIDE_ICONS['🚪'],
            detail: '输出门：控制输出多少细胞状态信息' },
          { id: 'hidden_state', type: 'custom', label: 'Hidden State', desc: 'h_t = o_t ⊙ tanh(C_t)', icon: LUCIDE_ICONS['📤'],
            detail: '隐藏状态输出：输出门过滤后的细胞状态' }
        ]},
      { id: 'lstm_layer', type: 'custom', label: 'LSTM Layer ×N', desc: 'N 层 LSTM 堆叠', icon: LUCIDE_ICONS['📚'],
        detail: '多层 LSTM 堆叠，每层处理前一层的隐藏状态序列' },
      { id: 'output_proj', type: 'linear', label: 'Output Projection', desc: 'Linear(hiddenSize, outputSize)', params: { in_f: 'hiddenSize', out_f: 'outputSize' }, detail: '将隐藏状态映射到输出空间' },
      { id: 'output', type: 'output', label: 'Output', desc: '序列输出', detail: '输出序列 y_1, y_2, ..., y_T 或最后一个时间步的隐藏状态' }
    ]
  },

  // ==================== GRU ====================
  'GRU': {
    type: 'rnn',
    params: {
      inputSize: { label: '输入维度', min: 10, max: 1000, default: 128, step: 10 },
      hiddenSize: { label: '隐藏层维度', min: 32, max: 1024, default: 256, step: 32 },
      numLayers: { label: 'GRU 层数', min: 1, max: 4, default: 2, step: 1 },
      bidirectional: { label: '双向', type: 'select', options: ['true', 'false'], default: 'false' }
    },
    blocks: [
      { id: 'input', type: 'input', label: 'Input', desc: '序列输入 x_t', detail: '输入序列 x_1, x_2, ..., x_T' },
      { id: 'embedding', type: 'linear', label: 'Embedding', desc: 'Input Embedding', params: { in_f: 'vocab_size', out_f: 'inputSize' }, detail: '输入嵌入层（可选）' },
      { id: 'gru_cell', type: 'custom', label: 'GRU Cell', desc: '门控循环单元', icon: LUCIDE_ICONS['🧠'],
        detail: 'GRU 核心单元：更新门和重置门，融合细胞状态和隐藏状态',
        children: [
          { id: 'update_gate', type: 'custom', label: 'Update Gate', desc: 'z_t = σ(W_z·[h_{t-1}, x_t])', icon: LUCIDE_ICONS['🚪'],
            detail: '更新门：控制前一时刻隐藏状态的保留比例（融合输入门和遗忘门）' },
          { id: 'reset_gate', type: 'custom', label: 'Reset Gate', desc: 'r_t = σ(W_r·[h_{t-1}, x_t])', icon: LUCIDE_ICONS['🚪'],
            detail: '重置门：决定忽略多少历史信息' },
          { id: 'candidate', type: 'custom', label: 'Candidate', desc: 'h̃_t = tanh(W·[r_t ⊙ h_{t-1}, x_t])', icon: LUCIDE_ICONS['📝'],
            detail: '候选隐藏状态：重置门过滤后的历史信息 + 当前输入' },
          { id: 'hidden_update', type: 'custom', label: 'Hidden Update', desc: 'h_t = (1-z_t)⊙h_{t-1} + z_t⊙h̃_t', icon: LUCIDE_ICONS['📤'],
            detail: '隐藏状态更新：更新门插值旧状态和新候选状态' }
        ]},
      { id: 'gru_layer', type: 'custom', label: 'GRU Layer ×N', desc: 'N 层 GRU 堆叠', icon: LUCIDE_ICONS['📚'],
        detail: '多层 GRU 堆叠，参数量比 LSTM 少约 25%' },
      { id: 'output_proj', type: 'linear', label: 'Output Projection', desc: 'Linear(hiddenSize, outputSize)', params: { in_f: 'hiddenSize', out_f: 'outputSize' }, detail: '输出投影层' },
      { id: 'output', type: 'output', label: 'Output', desc: '序列输出', detail: '输出序列或最终隐藏状态' }
    ]
  },

  // ==================== GPT-2 ====================
  'GPT-2': {
    type: 'transformer',
    params: {
      variant: { label: '模型规模', type: 'select', options: ['Small(117M)', 'Medium(345M)', 'Large(762M)', 'XL(1.5B)'], default: 'Small(117M)' },
      nLayers: { label: '层数', min: 1, max: 48, default: 12, step: 1 },
      nHeads: { label: '注意力头数', min: 1, max: 25, default: 12, step: 1 }
    },
    blocks: [
      { id: 'input', type: 'input', label: 'Input', desc: 'Token 序列', detail: '输入 token ID 序列' },
      { id: 'token_embed', type: 'linear', label: 'Token Embedding', desc: 'W_e: vocab×d_model', params: { in_f: 50257, out_f: 768 }, detail: '词表 50257 → 768 维嵌入' },
      { id: 'pos_embed', type: 'linear', label: 'Position Embedding', desc: 'W_p: 1024×d_model', params: { in_f: 1024, out_f: 768 }, detail: '位置编码，最大序列长度 1024' },
      { id: 'dropout', type: 'dropout', label: 'Dropout', desc: 'Dropout 0.1', params: { rate: 0.1 }, detail: '嵌入层 Dropout' },
      { id: 'decoder', type: 'custom', label: 'Transformer Decoder ×12', desc: '12 层 Decoder', icon: LUCIDE_ICONS['📚'],
        detail: '12 层 Transformer Decoder，每层包含掩码自注意力和前馈网络',
        children: [
          { id: 'dec_ln1', type: 'norm', label: 'LayerNorm', desc: 'Pre-LN', detail: 'Pre-LayerNorm' },
          { id: 'dec_mha', type: 'attention', label: 'Masked Self-Attention', desc: '12头因果注意力', detail: '带因果掩码的自注意力，防止看到未来 token' },
          { id: 'dec_ln2', type: 'norm', label: 'LayerNorm', desc: 'Post-Attention LN', detail: '注意力后的 LayerNorm' },
          { id: 'dec_mlp', type: 'mlp', label: 'MLP', desc: 'Linear(3072) + GELU + Linear(768)', params: { in_f: 768, out_f: 3072, act: 'GELU' }, detail: '前馈网络：768 → 3072 → 768' }
        ]},
      { id: 'final_ln', type: 'norm', label: 'Final LayerNorm', desc: 'LayerNorm', detail: '最终 LayerNorm' },
      { id: 'lm_head', type: 'linear', label: 'LM Head', desc: 'Linear(768, 50257)', params: { in_f: 768, out_f: 50257 }, detail: '语言模型头：投影到词表大小' },
      { id: 'output', type: 'output', label: 'Output', desc: 'Token 概率分布', detail: '输出下一个 token 的概率分布' }
    ]
  },

  // ==================== T5 ====================
  'T5': {
    type: 'transformer',
    params: {
      variant: { label: '模型规模', type: 'select', options: ['Small(60M)', 'Base(220M)', 'Large(770M)', '3B', '11B'], default: 'Base(220M)' },
      nLayers: { label: 'Encoder/Decoder 层数', min: 1, max: 24, default: 12, step: 1 }
    },
    blocks: [
      { id: 'input', type: 'input', label: 'Input', desc: 'Text-to-Text 输入', detail: '输入文本，任务前缀如 "translate English to German:"' },
      { id: 'tokenizer', type: 'custom', label: 'SentencePiece', desc: '分词器', icon: LUCIDE_ICONS['📝'],
        detail: 'SentencePiece 分词，词表大小 32000' },
      { id: 'embed', type: 'linear', label: 'Embedding', desc: 'd_model=768', params: { in_f: 32000, out_f: 768 }, detail: '输入嵌入，维度 768' },
      { id: 'encoder', type: 'custom', label: 'Encoder ×12', desc: '12 层 Transformer Encoder', icon: LUCIDE_ICONS['📚'],
        detail: '标准 Transformer Encoder，双向自注意力',
        children: [
          { id: 'enc_ln1', type: 'norm', label: 'LayerNorm', desc: 'Pre-LN', detail: 'Pre-LayerNorm' },
          { id: 'enc_mha', type: 'attention', label: 'Self-Attention', desc: '12头双向注意力', detail: '双向自注意力，可以同时关注所有位置' },
          { id: 'enc_ln2', type: 'norm', label: 'LayerNorm', desc: 'Post-Attention LN', detail: '注意力后的 LayerNorm' },
          { id: 'enc_mlp', type: 'mlp', label: 'Dense ReLU', desc: 'Linear(2048) + ReLU + Linear(768)', params: { in_f: 768, out_f: 2048, act: 'ReLU' }, detail: '前馈网络：768 → 2048 → 768' }
        ]},
      { id: 'decoder', type: 'custom', label: 'Decoder ×12', desc: '12 层 Transformer Decoder', icon: LUCIDE_ICONS['📚'],
        detail: '标准 Transformer Decoder，带交叉注意力',
        children: [
          { id: 'dec_ln1', type: 'norm', label: 'LayerNorm', desc: 'Pre-LN', detail: 'Pre-LayerNorm' },
          { id: 'dec_masked_mha', type: 'attention', label: 'Masked Self-Attention', desc: '因果自注意力', detail: '带掩码的自注意力' },
          { id: 'dec_ln2', type: 'norm', label: 'LayerNorm', desc: 'Post-Attention LN', detail: 'LayerNorm' },
          { id: 'dec_cross_mha', type: 'attention', label: 'Cross-Attention', desc: '编码器-解码器注意力', detail: 'Q 来自解码器，K/V 来自编码器输出' },
          { id: 'dec_ln3', type: 'norm', label: 'LayerNorm', desc: 'Post-Attention LN', detail: 'LayerNorm' },
          { id: 'dec_mlp', type: 'mlp', label: 'Dense ReLU', desc: 'Linear(2048) + ReLU + Linear(768)', params: { in_f: 768, out_f: 2048, act: 'ReLU' }, detail: '前馈网络' }
        ]},
      { id: 'final_ln', type: 'norm', label: 'Final LayerNorm', desc: 'LayerNorm', detail: '最终 LayerNorm' },
      { id: 'output_proj', type: 'linear', label: 'Output Projection', desc: 'Linear(768, 32000)', params: { in_f: 768, out_f: 32000 }, detail: '投影到词表大小' },
      { id: 'output', type: 'output', label: 'Output', desc: '生成文本', detail: '输出目标文本序列' }
    ]
  },

  // ==================== YOLOv3 ====================
  'YOLOv3': {
    type: 'detection',
    params: {
      variant: { label: '变体', type: 'select', options: ['yolov3-spp', 'yolov3-tiny', 'yolov3'], default: 'yolov3-spp' },
      inputSize: { label: '输入尺寸', type: 'select', options: ['320', '416', '608'], default: '416' },
      numClasses: { label: '检测类别数', min: 1, max: 100, default: 80, step: 1 }
    },
    blocks: [
      { id: 'input', type: 'input', label: 'Input', desc: '416×416×3 RGB图像', detail: '输入为 416×416 的三通道 RGB 图像' },
      { id: 'darknet53', type: 'custom', label: 'Darknet-53', desc: '53层卷积骨干网络', icon: LUCIDE_ICONS['🏗️'],
        detail: 'Darknet-53 主干网络，使用残差连接增强特征提取能力，53层卷积层',
        children: [
          { id: 'db_input', type: 'conv', label: 'Conv 32', desc: 'Conv 32@3×3', params: { in_ch: 3, out_ch: 32, kernel: 3, act: 'LeakyReLU' }, detail: '首个卷积层' },
          { id: 'db_res1', type: 'custom', label: 'Residual ×1', desc: 'Conv+Residual 64', icon: LUCIDE_ICONS['🔄'], detail: '残差块 1，通道 32→64' },
          { id: 'db_res2', type: 'custom', label: 'Residual ×2', desc: 'Conv+Residual 128', icon: LUCIDE_ICONS['🔄'], detail: '残差块 2' },
          { id: 'db_res8', type: 'custom', label: 'Residual ×8', desc: 'Conv+Residual 256', icon: LUCIDE_ICONS['🔄'], detail: '残差块 3，输出 256 通道特征' },
          { id: 'db_res8_2', type: 'custom', label: 'Residual ×8', desc: 'Conv+Residual 512', icon: LUCIDE_ICONS['🔄'], detail: '残差块 4' },
          { id: 'db_res4', type: 'custom', label: 'Residual ×4', desc: 'Conv+Residual 1024', icon: LUCIDE_ICONS['🔄'], detail: '残差块 5，输出 1024 通道' }
        ]},
      { id: 'fpn', type: 'custom', label: 'FPN 多尺度', desc: '特征金字塔网络', icon: LUCIDE_ICONS['🔺'],
        detail: 'Feature Pyramid Network：三个不同分辨率的特征图进行多尺度预测',
        children: [
          { id: 'fpn_large', type: 'custom', label: '大目标 (52×52)', desc: '下采样层 + YOLO Head', icon: LUCIDE_ICONS['📦'], detail: '检测大目标，52×52 特征图' },
          { id: 'fpn_medium', type: 'custom', label: '中目标 (26×26)', desc: '上采样 + 融合 + YOLO Head', icon: LUCIDE_ICONS['📦'], detail: '检测中目标，26×26 特征图' },
          { id: 'fpn_small', type: 'custom', label: '小目标 (13×13)', desc: '上采样 + 融合 + YOLO Head', icon: LUCIDE_ICONS['📦'], detail: '检测小目标，13×13 特征图' }
        ]},
      { id: 'yolo_head', type: 'custom', label: 'YOLO Head', desc: '3个尺度，每个3锚框', icon: LUCIDE_ICONS['🎯'],
        detail: '每个尺度使用三个不同大小的锚框，每个位置预测 (4坐标 + 1置信度 + numClasses)',
        children: [
          { id: 'yh_anchors', type: 'custom', label: '锚框 (Anchors)', desc: '每尺度3个锚框', icon: LUCIDE_ICONS['📐'], detail: '如 [116,90],[156,198],[373,326] 等多尺度锚框' },
          { id: 'yh_conf', type: 'conv', label: '置信度预测', desc: 'Sigmoid', params: { act: 'Sigmoid' }, detail: '目标存在置信度，使用 Sigmoid 激活' },
          { id: 'yh_box', type: 'conv', label: '边界框预测', desc: 'Bbox xywh', detail: '预测边界框的中心坐标和宽高' },
          { id: 'yh_cls', type: 'conv', label: '类别预测', desc: 'Logistic + numClasses', detail: '使用 Logistic 替代 Softmax 实现多标签分类' }
        ]},
      { id: 'output', type: 'output', label: 'Output', desc: '[B, 3, S, S, 4+1+numClasses]', detail: '输出检测结果：边界框、置信度、类别概率' }
    ]
  },

  // ==================== YOLOv5 ====================
  'YOLOv5': {
    type: 'detection',
    params: {
      variant: { label: '变体', type: 'select', options: ['YOLOv5n', 'YOLOv5s', 'YOLOv5m', 'YOLOv5l', 'YOLOv5x', 'YOLOv5n6'], default: 'YOLOv5s' },
      numClasses: { label: '检测类别数', min: 1, max: 100, default: 80, step: 1 }
    },
    blocks: [
      { id: 'input', type: 'input', label: 'Input', desc: '640×640×3 RGB图像', detail: '输入为 640×640 的三通道 RGB 图像' },
      { id: 'cspdarknet', type: 'custom', label: 'CSPDarknet', desc: 'CSP骨干网络', icon: LUCIDE_ICONS['🏗️'],
        detail: 'Cross Stage Partial 骨干网络，增强梯度流同时减少计算量',
        children: [
          { id: 'csp_stem', type: 'conv', label: 'Focus', desc: '切片操作 + Conv', params: { in_ch: 3, out_ch: 64, kernel: 3 }, detail: 'Focus 模块：使用切片操作将图像下采样' },
          { id: 'csp_stage1', type: 'custom', label: 'CSP Stage 1', desc: 'Conv + C3 + MaxPool', icon: LUCIDE_ICONS['📦'], detail: 'CSP Stage 1，输出 128 通道' },
          { id: 'csp_stage2', type: 'custom', label: 'CSP Stage 2', desc: 'Conv + C3 + MaxPool', icon: LUCIDE_ICONS['📦'], detail: 'CSP Stage 2，输出 256 通道' },
          { id: 'csp_stage3', type: 'custom', label: 'CSP Stage 3', desc: 'Conv + C3 + MaxPool', icon: LUCIDE_ICONS['📦'], detail: 'CSP Stage 3，输出 512 通道' },
          { id: 'csp_stage4', type: 'custom', label: 'CSP Stage 4', desc: 'Conv + C3', icon: LUCIDE_ICONS['📦'], detail: 'CSP Stage 4，输出 1024 通道' }
        ]},
      { id: 'sppf', type: 'custom', label: 'SPPF', desc: '空间金字塔池化', icon: LUCIDE_ICONS['🔺'],
        detail: 'Spatial Pyramid Pooling - Fast：多次 MaxPool 的串行版本',
        children: [
          { id: 'sppf_pool1', type: 'pool', label: 'MaxPool 5×5', desc: 'MaxPool 5×5', params: { pool: 'max', pool_size: 5 }, detail: '5×5 最大池化' },
          { id: 'sppf_pool2', type: 'pool', label: 'MaxPool 5×5', desc: 'MaxPool 5×5', params: { pool: 'max', pool_size: 5 }, detail: '5×5 最大池化' },
          { id: 'sppf_pool3', type: 'pool', label: 'MaxPool 5×5', desc: 'MaxPool 5×5', params: { pool: 'max', pool_size: 5 }, detail: '5×5 最大池化' }
        ]},
      { id: 'pan', type: 'custom', label: 'PAN+FPN', desc: '路径聚合网络', icon: LUCIDE_ICONS['🔺'],
        detail: 'Path Aggregation Network + Feature Pyramid Network：双向特征金字塔',
        children: [
          { id: 'pan_fpn', type: 'custom', label: 'FPN 上融合', desc: '自顶向下', icon: LUCIDE_ICONS['⬆️'], detail: 'FPN 自顶向下融合语义特征' },
          { id: 'pan_pan', type: 'custom', label: 'PAN 下融合', desc: '自底向上', icon: LUCIDE_ICONS['⬇️'], detail: 'PAN 自底向上融合定位特征' }
        ]},
      { id: 'yolo_head', type: 'custom', label: 'YOLO Head', desc: '解耦头 (Anchor-free)', icon: LUCIDE_ICONS['🎯'],
        detail: 'Anchor-free 检测头，分类和回归分支解耦',
        children: [
          { id: 'yh_cls', type: 'conv', label: '分类分支', desc: 'Conv + Sigmoid', params: { act: 'Sigmoid' }, detail: '分类置信度预测' },
          { id: 'yh_reg', type: 'conv', label: '回归分支', desc: 'Conv', detail: '边界框回归（中心+宽高）' }
        ]},
      { id: 'output', type: 'output', label: 'Output', desc: '检测框 + 类别 + 置信度', detail: '输出目标检测结果' }
    ]
  },

  // ==================== Swin Transformer ====================
  'Swin Transformer': {
    type: 'transformer',
    params: {
      variant: { label: '变体', type: 'select', options: ['Swin-T', 'Swin-S', 'Swin-B', 'Swin-L'], default: 'Swin-B' },
      imageSize: { label: '输入尺寸', type: 'select', options: ['224', '384'], default: '224' },
      numClasses: { label: '分类数', min: 2, max: 1000, default: 1000, step: 1 }
    },
    blocks: [
      { id: 'input', type: 'input', label: 'Input', desc: '224×224×3 RGB图像', detail: '输入为 224×224 的三通道 RGB 图像' },
      { id: 'patch_embed', type: 'custom', label: 'Patch Embedding', desc: '4×4 Conv + LayerNorm', icon: LUCIDE_ICONS['🧩'],
        detail: '将图像分割为 4×4 patch，每个 patch 展平后通过线性投影',
        children: [
          { id: 'pe_conv', type: 'conv', label: 'Conv 4×4', desc: 'Conv 96@4×4, stride 4', params: { in_ch: 3, out_ch: 96, kernel: 4, stride: 4 }, detail: '4×4 卷积将图像分为 patch' },
          { id: 'pe_flat', type: 'custom', label: 'Flatten', desc: 'B×(56×56)×96', icon: LUCIDE_ICONS['📊'], detail: '展平为序列：(224/4)^2=56×56 个 token' }
        ]},
      { id: 'stage1', type: 'custom', label: 'Stage 1', desc: 'Swin-T: 56×56, 96ch', icon: LUCIDE_ICONS['📦'],
        detail: 'Stage 1: 56×56 特征图，96 通道',
        children: [
          { id: 's1_swin', type: 'custom', label: 'Swin Block ×2', desc: 'Shifted Window MSA + MLP', icon: LUCIDE_ICONS['🪟'],
            detail: '两层滑动窗口注意力 + FFN',
            children: [
              { id: 's1_ln1', type: 'norm', label: 'LayerNorm', desc: 'LN' },
              { id: 's1_wmsa', type: 'attention', label: 'W-MSA', desc: 'Window Attention 7×7', detail: '窗口大小 7×7 的窗口注意力' },
              { id: 's1_ln2', type: 'norm', label: 'LayerNorm', desc: 'LN' },
              { id: 's1_mlp', type: 'mlp', label: 'MLP', desc: 'Linear(384) + GELU', params: { in_f: 96, out_f: 384, act: 'GELU' } }
            ]}
        ]},
      { id: 'stage2', type: 'custom', label: 'Stage 2', desc: '28×28, 192ch, ×2', icon: LUCIDE_ICONS['📦'],
        detail: 'Stage 2: Patch Merging 后 28×28，192 通道',
        children: [
          { id: 's2_merge', type: 'custom', label: 'Patch Merging', desc: '2×下采样', icon: LUCIDE_ICONS['⬇️'], detail: 'Patch Merging 将 H/2×W/2×2C' },
          { id: 's2_swin', type: 'custom', label: 'Swin Block ×2', desc: 'Shifted Window MSA + MLP', icon: LUCIDE_ICONS['🪟'] }
        ]},
      { id: 'stage3', type: 'custom', label: 'Stage 3', desc: '14×14, 384ch, ×6', icon: LUCIDE_ICONS['📦'],
        detail: 'Stage 3: 14×14，384 通道，6 层',
        children: [
          { id: 's3_merge', type: 'custom', label: 'Patch Merging', desc: '2×下采样', icon: LUCIDE_ICONS['⬇️'] },
          { id: 's3_swin', type: 'custom', label: 'Swin Block ×6', desc: 'Shifted Window MSA + MLP', icon: LUCIDE_ICONS['🪟'] }
        ]},
      { id: 'stage4', type: 'custom', label: 'Stage 4', desc: '7×7, 768ch, ×2', icon: LUCIDE_ICONS['📦'],
        detail: 'Stage 4: 7×7，768 通道',
        children: [
          { id: 's4_merge', type: 'custom', label: 'Patch Merging', desc: '2×下采样', icon: LUCIDE_ICONS['⬇️'] },
          { id: 's4_swin', type: 'custom', label: 'Swin Block ×2', desc: 'Shifted Window MSA + MLP', icon: LUCIDE_ICONS['🪟'] }
        ]},
      { id: 'head', type: 'custom', label: 'Head', desc: 'Global AvgPool + Linear', icon: LUCIDE_ICONS['🎯'],
        detail: '分类头：全局平均池化 + 全连接层',
        children: [
          { id: 'gap', type: 'pool', label: 'Global AvgPool', desc: 'GAP', params: { pool: 'avg' }, detail: '全局平均池化' },
          { id: 'head_fc', type: 'linear', label: 'Linear', desc: 'Linear(768, numClasses)', params: { in_f: 768, out_f: 1000 }, detail: '分类全连接层' }
        ]},
      { id: 'output', type: 'output', label: 'Output', desc: '类别概率分布', detail: '输出 1000 类分类概率' }
    ]
  },

  // ==================== DeiT ====================
  'DeiT': {
    type: 'transformer',
    params: {
      variant: { label: '变体', type: 'select', options: ['DeiT-Tiny', 'DeiT-Small', 'DeiT-Base'], default: 'DeiT-Small' },
      imageSize: { label: '输入尺寸', type: 'select', options: ['224', '384'], default: '224' },
      numClasses: { label: '分类数', min: 2, max: 1000, default: 1000, step: 1 },
      useDistillation: { label: '使用蒸馏', type: 'select', options: ['true', 'false'], default: 'true' }
    },
    blocks: [
      { id: 'input', type: 'input', label: 'Input', desc: '224×224×3 RGB图像', detail: '输入为 224×224 的三通道 RGB 图像' },
      { id: 'patch_embed', type: 'custom', label: 'Patch Embedding', desc: '16×16 Conv + Linear', icon: LUCIDE_ICONS['🧩'],
        detail: '将图像分割为 16×16 的 patch，输出 (N=196) 个 token',
        children: [
          { id: 'pe_conv', type: 'conv', label: 'Conv 16×16', desc: 'Conv 768@16×16, stride 16', params: { in_ch: 3, out_ch: 768, kernel: 16, stride: 16 }, detail: '16×16 卷积实现 patch embedding' },
          { id: 'pe_cls', type: 'custom', label: 'CLS Token', desc: '可学习的 [CLS] token', icon: LUCIDE_ICONS['🏷️'], detail: '添加可学习的分类 token' },
          { id: 'pe_dist', type: 'custom', label: 'Distillation Token', desc: '蒸馏 token (可选)', icon: LUCIDE_ICONS['🏷️'], detail: '知识蒸馏用的额外 token，从 CNN 教师学习', visibleIf: 'useDistillation=true' },
          { id: 'pe_pos', type: 'custom', label: 'Position Embedding', desc: '位置编码', icon: LUCIDE_ICONS['📍'], detail: '可学习的位置编码，N+2 个位置嵌入' }
        ]},
      { id: 'transformer', type: 'custom', label: 'Transformer Encoder ×12', desc: '标准 ViT Encoder', icon: LUCIDE_ICONS['📚'],
        detail: '12 层 Transformer Encoder',
        children: [
          { id: 't_ln1', type: 'norm', label: 'LayerNorm', desc: 'Pre-LN' },
          { id: 't_mha', type: 'attention', label: 'Multi-Head Self-Attention', desc: '12头自注意力', detail: '标准自注意力机制' },
          { id: 't_ln2', type: 'norm', label: 'LayerNorm', desc: 'Post-Attention LN' },
          { id: 't_mlp', type: 'mlp', label: 'MLP', desc: 'Linear(3072) + GELU + Linear(768)', params: { in_f: 768, out_f: 3072, act: 'GELU' } }
        ]},
      { id: 'cls_head', type: 'custom', label: 'CLS Head', desc: '分类头', icon: LUCIDE_ICONS['🎯'],
        detail: '使用 CLS token 的输出进行分类',
        children: [
          { id: 'cls_ln', type: 'norm', label: 'LayerNorm', desc: 'LN' },
          { id: 'cls_fc', type: 'linear', label: 'Linear', desc: 'Linear(768, numClasses)', params: { in_f: 768, out_f: 1000 } }
        ]},
      { id: 'dist_head', type: 'custom', label: 'Distillation Head', desc: '蒸馏头 (可选)', icon: LUCIDE_ICONS['🎓'], detail: '从 CNN 教师蒸馏的预测头', visibleIf: 'useDistillation=true',
        children: [
          { id: 'dist_ln', type: 'norm', label: 'LayerNorm', desc: 'LN' },
          { id: 'dist_fc', type: 'linear', label: 'Linear', desc: 'Linear(768, numClasses)', params: { in_f: 768, out_f: 1000 } }
        ]},
      { id: 'output', type: 'output', label: 'Output', desc: '类别概率分布', detail: '输出分类结果（可选择蒸馏或标准预测）' }
    ]
  },

  // ==================== CLIP ====================
  'CLIP': {
    type: 'multimodal',
    params: {
      variant: { label: '变体', type: 'select', options: ['ViT-B/32', 'ViT-B/16', 'ViT-L/14', 'ViT-g/14'], default: 'ViT-L/14' },
      embedDim: { label: '嵌入维度', type: 'select', options: ['512', '768', '1024'], default: '768' },
      numClasses: { label: '零样本类别数', min: 2, max: 10000, default: 1000, step: 1 }
    },
    blocks: [
      { id: 'input_image', type: 'input', label: 'Input Image', desc: '224×224×3 RGB图像', detail: '输入图像' },
      { id: 'input_text', type: 'input', label: 'Input Text', desc: '文本描述序列', detail: '类别名称或文本描述' },
      { id: 'image_encoder', type: 'custom', label: 'Image Encoder (ViT)', desc: 'Vision Transformer', icon: LUCIDE_ICONS['🖼️'],
        detail: '图像编码器：标准 ViT',
        children: [
          { id: 'ie_patch', type: 'custom', label: 'Patch Embedding', desc: '16×16 Conv', icon: LUCIDE_ICONS['🧩'], detail: '图像分 patch 并嵌入' },
          { id: 'ie_transformer', type: 'custom', label: 'Transformer Encoder', desc: '12层 ViT', icon: LUCIDE_ICONS['📚'], detail: '标准 Transformer Encoder' },
          { id: 'ie_cls', type: 'custom', label: 'CLS Token', desc: '取 CLS token', icon: LUCIDE_ICONS['🏷️'], detail: '使用 CLS token 作为图像表示' }
        ]},
      { id: 'text_encoder', type: 'custom', label: 'Text Encoder', desc: 'Transformer Text Encoder', icon: LUCIDE_ICONS['📝'],
        detail: '文本编码器：Transformer Encoder + CLA',
        children: [
          { id: 'te_embed', type: 'custom', label: 'Text Embedding', desc: 'Token Embed + Pos Embed', icon: LUCIDE_ICONS['📝'], detail: '文本 token 嵌入 + 位置编码' },
          { id: 'te_transformer', type: 'custom', label: 'Transformer Encoder', desc: '12层 Transformer', icon: LUCIDE_ICONS['📚'], detail: '标准 Transformer Encoder，含上下文建模' },
          { id: 'te_cls', type: 'custom', label: 'Text Pooling', desc: '取 [EOS] token', icon: LUCIDE_ICONS['🏷️'], detail: '取 [EOS] token 或平均池化作为文本表示' }
        ]},
      { id: 'image_embedding', type: 'custom', label: 'Image Embedding', desc: 'Linear(embed_dim)', icon: LUCIDE_ICONS['🔢'],
        detail: '图像投影到统一嵌入空间',
        children: [
          { id: 'ie_proj', type: 'linear', label: 'Projection', desc: 'Linear(I_head_dim, embed_dim)', params: { in_f: 768, out_f: 768 }, detail: '图像特征投影' }
        ]},
      { id: 'text_embedding', type: 'custom', label: 'Text Embedding', desc: 'Linear(embed_dim)', icon: LUCIDE_ICONS['🔢'],
        detail: '文本投影到统一嵌入空间',
        children: [
          { id: 'te_proj', type: 'linear', label: 'Projection', desc: 'Linear(T_head_dim, embed_dim)', params: { in_f: 768, out_f: 768 }, detail: '文本特征投影' }
        ]},
      { id: 'logits', type: 'custom', label: 'Logits Computation', desc: 'cosine similarity × temperature', icon: LUCIDE_ICONS['⚖️'],
        detail: '计算图像-文本对的相似度',
        children: [
          { id: 'logit_scale', type: 'custom', label: 'Temperature', desc: '可学习的温度参数', icon: LUCIDE_ICONS['🌡️'], detail: 'logit_scale = exp(w) / T，控制相似度分布' },
          { id: 'logit_sim', type: 'custom', label: 'Similarity', desc: 'I · T^T / ||I|| ||T||', icon: LUCIDE_ICONS['🔗'], detail: '余弦相似度计算' }
        ]},
      { id: 'output', type: 'output', label: 'Output', desc: '零样本分类结果', detail: '输出零样本分类概率，可用于任意视觉识别任务' }
    ]
  }
};
