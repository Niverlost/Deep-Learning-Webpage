// ============================================================
// Deep Learning Explorer - Utils Module (Optimized)
// 纯工具函数（格式化、校验、debounce/throttle、DOM 辅助函数）
// ============================================================

// ==================== 配置与常量 ====================
const CONFIG = {
  STORAGE_KEY: 'dl_viz_pro_models',
  STORAGE_VERSION_KEY: 'dl_viz_pro_version',
  DATA_VERSION: 'v6',
  AUTH_KEY: 'dl_viz_pro_auth',
  USERS_KEY: 'dlviz_users',
  SESSION_KEY: 'dlviz_session',
  THEME_KEY: 'dlviz_theme',
  TOAST_DURATION: 3000,
  SEARCH_DEBOUNCE: 300,
  SEARCH_HISTORY_KEY: 'dl_search_history',
  CACHE_EXPIRY_MS: 3600000
};

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

// ==================== 块类型颜色映射 ====================
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

// ==================== 类别渐变映射 ====================
const CATEGORY_GRADIENTS = {
  '图像分类': 'linear-gradient(180deg, #6366f1 0%, #818cf8 50%, #a78bfa 100%)',
  '目标检测': 'linear-gradient(180deg, #f97316 0%, #ef4444 50%, #dc2626 100%)',
  '自然语言处理': 'linear-gradient(180deg, #a855f7 0%, #ec4899 50%, #f472b6 100%)',
  '图像生成': 'linear-gradient(180deg, #ec4899 0%, #f59e0b 50%, #fbbf24 100%)',
  '大语言模型': 'linear-gradient(180deg, #06b6d4 0%, #38bdf8 50%, #6366f1 100%)'
};

// ==================== 模块分类配置 ====================
const MODULE_CATEGORIES = {
  '基础算法': {
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
    color: 'blue'
  },
  '图像分类': {
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>',
    color: 'blue'
  },
  '目标检测': {
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="22" y1="12" x2="18" y2="12"/><line x1="6" y1="12" x2="2" y2="12"/><line x1="12" y1="6" x2="12" y2="2"/><line x1="12" y1="22" x2="12" y2="18"/></svg>',
    color: 'orange'
  },
  '语义分割': {
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/></svg>',
    color: 'green'
  },
  '自然语言处理': {
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    color: 'purple'
  },
  '图像生成': {
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="10.5" r="2.5"/><circle cx="8.5" cy="7.5" r="2.5"/><circle cx="6.5" cy="12.5" r="2.5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>',
    color: 'pink'
  },
  '大语言模型': {
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>',
    color: 'cyan'
  },
  '多模态': {
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
    color: 'pink'
  }
};

// ==================== 学习路径配置 ====================
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

// ==================== 工具函数 ====================

/**
 * 安全写入 localStorage，防止 QuotaExceededError 导致后续代码不执行
 * @param {string} key - 存储键名
 * @param {string|any} value - 存储值
 * @returns {boolean} 是否成功
 */
function safeSetItem(key, value) {
  try {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    localStorage.setItem(key, serialized);
    return true;
  } catch(e) {
    console.warn('[safeSetItem] localStorage error:', e);
    if (e.name === 'QuotaExceededError') {
      console.error('[safeSetItem] Storage quota exceeded');
    }
    return false;
  }
}

/**
 * 安全读取 localStorage
 * @param {string} key - 存储键名
 * @param {any} defaultValue - 默认值
 * @returns {any} 读取的值
 */
function safeGetItem(key, defaultValue = null) {
  try {
    const value = localStorage.getItem(key);
    if (value === null) return defaultValue;
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  } catch(e) {
    console.warn('[safeGetItem] localStorage error:', e);
    return defaultValue;
  }
}

/**
 * 检测用户是否偏好减少动画 - 集中管理避免重复查询
 * @returns {boolean} 是否偏好减少动画
 */
const prefersReducedMotion = (() => {
  let cached = null;
  
  return () => {
    if (cached !== null) return cached;
    
    try {
      if (typeof window.matchMedia !== 'function') {
        cached = false;
        return false;
      }
      
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      cached = mediaQuery.matches;
      
      mediaQuery.addEventListener('change', (e) => {
        cached = e.matches;
      });
      
      return cached;
    } catch (e) {
      console.warn('[prefersReducedMotion] Error:', e);
      cached = false;
      return false;
    }
  };
})();

/**
 * HTML 转义，防止 XSS
 * @param {string|any} str - 原始字符串
 * @returns {string} 转义后的 HTML 字符串
 */
function escapeHtml(str) {
  if (str == null) return '';
  const safeStr = String(str);
  const div = document.createElement('div');
  div.textContent = safeStr;
  return div.innerHTML;
}

/**
 * 净化用户输入，防止 XSS
 * @param {string} input - 用户输入字符串
 * @returns {string} 净化后的字符串
 */
function sanitizeInput(input) {
  if (typeof input !== 'string') return '';
  return input.replace(/[<>&"']/g, (match) => ({
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    '"': '&quot;',
    "'": '&#x27;'
  })[match]);
}

/**
 * 防抖函数
 * @param {Function} fn - 需要防抖的函数
 * @param {number} ms - 延迟毫秒数
 * @returns {Function} 防抖后的函数
 */
function debounce(fn, ms) {
  let timer = null;
  return function (...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      fn.apply(this, args);
      timer = null;
    }, ms);
  };
}

/**
 * 节流函数
 * @param {Function} fn - 需要节流的函数
 * @param {number} ms - 节流间隔毫秒数
 * @returns {Function} 节流后的函数
 */
function throttle(fn, ms) {
  let lastCall = 0;
  let timer = null;
  
  return function (...args) {
    const now = Date.now();
    
    if (now - lastCall >= ms) {
      lastCall = now;
      fn.apply(this, args);
    } else {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        lastCall = Date.now();
        fn.apply(this, args);
        timer = null;
      }, ms);
    }
  };
}

/**
 * 将十六进制字符串转为 ArrayBuffer
 * @param {string} hex - 十六进制字符串
 * @returns {ArrayBuffer|null} 转换后的 ArrayBuffer
 */
function hexToBuffer(hex) {
  if (typeof hex !== 'string' || hex.length % 2 !== 0) {
    console.warn('[hexToBuffer] Invalid hex string');
    return null;
  }
  
  try {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      const byte = parseInt(hex.slice(i, i + 2), 16);
      if (isNaN(byte)) {
        console.warn('[hexToBuffer] Invalid hex character');
        return null;
      }
      bytes[i / 2] = byte;
    }
    return bytes.buffer;
  } catch (e) {
    console.error('[hexToBuffer] Error:', e);
    return null;
  }
}

/**
 * 将 ArrayBuffer 转为十六进制字符串
 * @param {ArrayBuffer} buffer - ArrayBuffer 数据
 * @returns {string} 十六进制字符串
 */
function bufferToHex(buffer) {
  if (!buffer || !(buffer instanceof ArrayBuffer)) {
    console.warn('[bufferToHex] Invalid buffer');
    return '';
  }
  
  try {
    return Array.from(new Uint8Array(buffer))
      .map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (e) {
    console.error('[bufferToHex] Error:', e);
    return '';
  }
}

/**
 * 生成随机盐值（32字节）
 * @returns {string|null} 64位十六进制盐值字符串
 */
function generateSalt() {
  try {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      return Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map(b => b.toString(16).padStart(2, '0')).join('');
    } else {
      console.warn('[generateSalt] crypto.getRandomValues not available, using fallback');
      let result = '';
      const chars = '0123456789abcdef';
      for (let i = 0; i < 64; i++) {
        result += chars[Math.floor(Math.random() * 16)];
      }
      return result;
    }
  } catch (e) {
    console.error('[generateSalt] Error:', e);
    return null;
  }
}

/**
 * 密码哈希函数（PBKDF2-SHA256，100,000次迭代）
 * @param {string} password - 原始密码
 * @param {string} salt - 十六进制盐值
 * @returns {Promise<string>} 哈希后的密码十六进制字符串
 */
async function hashPassword(password, salt) {
  try {
    if (!crypto.subtle) {
      console.warn('[hashPassword] crypto.subtle not available, using fallback');
      let hash = 0;
      const str = password + salt;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      return 'legacy:' + Math.abs(hash).toString(16).padStart(16, '0') + salt.slice(0, 16);
    }

    const encoder = new TextEncoder();
    const passwordBuffer = encoder.encode(password);
    const saltBuffer = hexToBuffer(salt);
    
    if (!saltBuffer) {
      throw new Error('Invalid salt');
    }

    const passwordKey = await crypto.subtle.importKey(
      'raw',
      passwordBuffer,
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    );

    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: saltBuffer,
        iterations: 100000,
        hash: 'SHA-256'
      },
      passwordKey,
      256
    );

    return bufferToHex(derivedBits);
  } catch (e) {
    console.error('[hashPassword] Error:', e);
    throw new Error('Password hashing failed');
  }
}

/**
 * 获取类别对应的渐变色
 * @param {string} category - 类别名称
 * @returns {string} CSS 渐变字符串
 */
function getCategoryGradient(category) {
  return CATEGORY_GRADIENTS[category] || 'linear-gradient(180deg, #6366f1 0%, #818cf8 100%)';
}

/**
 * 高亮搜索关键词
 * @param {string} text - 原始文本
 * @param {string} keyword - 搜索关键词
 * @returns {string} 高亮后的 HTML 字符串
 */
function highlightText(text, keyword) {
  if (!keyword || !text) return escapeHtml(text || '');
  
  try {
    const escaped = escapeHtml(text);
    const escapedKeyword = escapeHtml(keyword);
    const sanitizedKeyword = escapedKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${sanitizedKeyword})`, 'gi');
    return escaped.replace(regex, '<mark class="search-highlight">$1</mark>');
  } catch (e) {
    console.error('[highlightText] Error:', e);
    return escapeHtml(text || '');
  }
}

/**
 * easeOutExpo 缓动函数
 * @param {number} t - 时间进度（0-1）
 * @returns {number} 缓动后的进度值
 */
function easeOutExpo(t) {
  if (typeof t !== 'number') return 0;
  const clamped = Math.max(0, Math.min(1, t));
  return clamped === 1 ? 1 : 1 - Math.pow(2, -10 * clamped);
}

/**
 * 计数动画：从 0 滚动到目标值
 * @param {HTMLElement} el - 目标 DOM 元素
 * @param {number} target - 目标数值
 * @param {number} [duration=1500] - 动画时长（毫秒）
 */
function animateCount(el, target, duration = 1500) {
  if (!el) {
    console.warn('[animateCount] No element provided');
    return;
  }
  
  if (typeof target !== 'number' || isNaN(target)) {
    el.textContent = '--';
    return;
  }
  
  if (prefersReducedMotion()) {
    el.textContent = target;
    return;
  }
  
  const startTime = performance.now();
  const startValue = parseInt(el.textContent) || 0;
  let animationId = null;

  function update(currentTime) {
    try {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeOutExpo(progress);
      const currentValue = Math.round(startValue + (easedProgress * (target - startValue)));
      el.textContent = currentValue;

      if (progress < 1) {
        animationId = requestAnimationFrame(update);
      } else {
        el.textContent = target;
      }
    } catch (e) {
      console.error('[animateCount] Animation error:', e);
      el.textContent = target;
    }
  }

  animationId = requestAnimationFrame(update);
}

// ==================== Polyfills ====================

if (!Object.fromEntries) {
  Object.fromEntries = function(entries) {
    const obj = {};
    if (Array.isArray(entries)) {
      for (const [key, value] of entries) {
        obj[key] = value;
      }
    }
    return obj;
  };
}

// 术语tooltip缓存
let termTooltipEl = null;

// 预编译术语正则（单次构建，避免每次调用重建110个正则）
let termRegexCache = null;

/**
 * 构建术语正则表达式缓存
 * @returns {{regex: RegExp, terms: string[]}} 正则表达式和术语列表
 */
function buildTermRegex() {
  if (termRegexCache) return termRegexCache;
  
  try {
    const terms = Object.keys(GLOSSARY).sort((a, b) => b.length - a.length);
    const escaped = terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    termRegexCache = {
      regex: new RegExp(`\\b(${escaped.join('|')})\\b`, 'gi'),
      terms
    };
  } catch (e) {
    console.error('[buildTermRegex] Error:', e);
    termRegexCache = {
      regex: /$^/,
      terms: []
    };
  }
  
  return termRegexCache;
}

/**
 * 在渲染模型详情和描述时，自动为术语添加tooltip
 * @param {string} text - 原始文本
 * @returns {string} 带术语高亮的 HTML 字符串
 */
function addTermTooltips(text) {
  if (!text) return '';
  
  try {
    let result = escapeHtml(text);
    const { regex, terms } = buildTermRegex();
    
    if (terms.length > 0) {
      result = result.replace(regex, (match) => {
        const key = terms.find(t => t.toLowerCase() === match.toLowerCase());
        if (!key) return match;
        const def = GLOSSARY[key].replace(/"/g, '&quot;');
        return `<span class="term" data-term="${escapeHtml(key)}" title="${def}">${match}</span>`;
      });
    }
  } catch (e) {
    console.error('[addTermTooltips] Error:', e);
  }
  
  return escapeHtml(text);
}

/**
 * 初始化术语tooltip事件委托
 */
function initTermTooltips() {
  try {
    if (!termTooltipEl) {
      termTooltipEl = document.createElement('div');
      termTooltipEl.className = 'term-tooltip';
      document.body.appendChild(termTooltipEl);
    }

    document.addEventListener('mouseenter', function(e) {
      if (!e.target || !e.target.closest) return;
      const termEl = e.target.closest('.term');
      if (!termEl) return;
      const definition = termEl.getAttribute('title');
      if (!definition) return;
      termTooltipEl.textContent = definition;
      termTooltipEl.classList.add('visible');
      positionTooltip(termEl);
    }, true);

    document.addEventListener('mouseleave', function(e) {
      if (!e.target || !e.target.closest) return;
      const termEl = e.target.closest('.term');
      if (!termEl) return;
      termTooltipEl.classList.remove('visible');
    }, true);

    const updateTooltipPosition = throttle(function(e) {
      if (termTooltipEl && termTooltipEl.classList.contains('visible')) {
        let x = e.clientX + 12;
        let y = e.clientY + 12;
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
    }, 16);

    document.addEventListener('mousemove', updateTooltipPosition);
  } catch (e) {
    console.error('[initTermTooltips] Error:', e);
  }
}

/**
 * 定位tooltip到目标元素
 * @param {HTMLElement} el - 目标元素
 */
function positionTooltip(el) {
  try {
    if (!el || !termTooltipEl) return;
    const rect = el.getBoundingClientRect();
    termTooltipEl.style.left = (rect.left + rect.width / 2) + 'px';
    termTooltipEl.style.top = (rect.bottom + 8) + 'px';
  } catch (e) {
    console.error('[positionTooltip] Error:', e);
  }
}

/**
 * 获取块类型图标
 * @param {string} type - 块类型
 * @returns {string} SVG 图标 HTML 字符串
 */
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

/**
 * HTML 转义特殊字符（代码用）
 * @param {string} str - 原始字符串
 * @returns {string} 转义后的字符串
 */
function escapeCodeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * PyTorch 语法高亮（正则替换）
 * @param {string} code - PyTorch 代码字符串
 * @returns {string} 高亮后的 HTML 字符串
 */
function highlightSyntax(code) {
  if (code == null) return '';
  
  try {
    let html = escapeCodeHtml(code);

    html = html.replace(/(#.*?)(\n|$)/g, '<span class="syn-comment">$1</span>$2');
    html = html.replace(/("""[\s\S]*?"""|\'\'\'[\s\S]*?\'\'\')/g, '<span class="syn-string">$1</span>');
    html = html.replace(/("(?:[^"\\]|\\.)*"|\'(?:[^\'\\]|\\.)*\')/g, '<span class="syn-string">$1</span>');

    const keywords = ['def', 'class', 'import', 'from', 'return', 'if', 'elif', 'else', 'for', 'while', 'with', 'as', 'try', 'except', 'finally', 'raise', 'yield', 'lambda', 'pass', 'break', 'continue', 'and', 'or', 'not', 'in', 'is', 'global', 'nonlocal', 'assert', 'del'];
    const kwPattern = new RegExp('\\b(' + keywords.join('|') + ')\\b', 'g');
    html = html.replace(kwPattern, '<span class="syn-keyword">$1</span>');

    html = html.replace(/\b(self)\b/g, '<span class="syn-param">$1</span>');

    const classNames = ['nn\\.Module', 'nn\\.Sequential', 'nn\\.Linear', 'nn\\.Conv2d', 'nn\\.Conv1d', 'nn\\.MaxPool2d', 'nn\\.AvgPool2d', 'nn\\.Dropout', 'nn\\.ReLU', 'nn\\.Sigmoid', 'nn\\.Tanh', 'nn\\.BatchNorm2d', 'nn\\.LayerNorm', 'nn\\.Embedding', 'nn\\.Transformer', 'nn\\.MultiheadAttention', 'nn\\.CrossEntropyLoss', 'nn\\.MSELoss', 'nn\\.Softmax', 'nn\\.Flatten', 'torch', 'nn', 'F', 'MLP', 'super'];
    const classPattern = new RegExp('\\b(' + classNames.join('|') + ')\\b', 'g');
    html = html.replace(classPattern, '<span class="syn-class">$1</span>');

    html = html.replace(/\b(\d+\.?\d*)\b/g, '<span class="syn-number">$1</span>');

    html = html.replace(/\b([a-zA-Z_]\w*)\s*(?=\()/g, function(match, fname) {
      if (match.includes('span')) return match;
      return '<span class="syn-func">' + fname + '</span>';
    });

    html = html.replace(/([+\-*=\/%&lt;&gt;!]=?)/g, '<span class="syn-op">$1</span>');

    return html;
  } catch (e) {
    console.error('[highlightSyntax] Error:', e);
    return escapeCodeHtml(code);
  }
}

/**
 * 安全的 DOM 操作工具函数
 * @param {string} html - HTML 字符串
 * @returns {DocumentFragment} 文档片段
 */
function createSafeElement(html) {
  const template = document.createElement('template');
  template.innerHTML = html;
  return template.content;
}

// Global exports for inline event handlers
window.CONFIG = CONFIG;
window.GLOSSARY = GLOSSARY;
window.BLOCK_COLORS = BLOCK_COLORS;
window.CATEGORY_GRADIENTS = CATEGORY_GRADIENTS;
window.MODULE_CATEGORIES = MODULE_CATEGORIES;
window.LEARNING_PATHS = LEARNING_PATHS;
