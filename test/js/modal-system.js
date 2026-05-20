// ========================================
// 弹窗系统 (Modal System) - Apple风格
// ========================================

(function() {
  'use strict';

  // 状态管理
  const state = {
    openModals: [],
    modalStack: [],
    focusStore: new WeakMap()
  };

  // ========================================
  // 工具函数
  // ========================================

  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function generateId() {
    return 'modal-' + Math.random().toString(36).substr(2, 9);
  }

  function getNextZIndex() {
    const baseIndex = 1000;
    return baseIndex + (state.modalStack.length * 10);
  }

  // ========================================
  // 焦点管理
  // ========================================

  function createFocusTrap(modal) {
    const focusableElements = modal.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    if (focusableElements.length === 0) return { trap: () => {}, release: () => {} };

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    function handleKeyDown(e) {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    }

    function trap() {
      modal.addEventListener('keydown', handleKeyDown);
      firstElement.focus();
    }

    function release() {
      modal.removeEventListener('keydown', handleKeyDown);
    }

    return { trap, release };
  }

  // ========================================
  // 核心弹窗函数
  // ========================================

  function createModal(options = {}) {
    const {
      id = generateId(),
      title = '',
      subtitle = '',
      content = '',
      size = 'medium',
      type = 'modal',
      zIndex,
      showClose = true,
      onOpen,
      onClose,
      footer = ''
    } = options;

    // 创建遮罩层
    const overlay = document.createElement('div');
    overlay.id = id;
    overlay.className = `modal-overlay ${type === 'sheet' ? 'sheet-overlay' : ''}`;
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', `${id}-title`);
    
    if (zIndex) {
      overlay.style.zIndex = zIndex;
    }

    // 背景遮罩
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';

    // 容器
    const container = document.createElement('div');
    container.className = `modal-container`;

    // 弹窗内容
    const modal = document.createElement('div');
    modal.className = `modal modal-${size} ${type === 'sheet' ? 'sheet' : ''}`;

    // Sheet 手柄
    if (type === 'sheet') {
      const handle = document.createElement('div');
      handle.className = 'sheet-handle';
      modal.appendChild(handle);
    }

    // 头部
    if (title || showClose) {
      const header = document.createElement('div');
      header.className = 'modal-header';
      
      const titleWrapper = document.createElement('div');
      if (title) {
        const titleEl = document.createElement('h2');
        titleEl.id = `${id}-title`;
        titleEl.className = 'modal-title';
        titleEl.textContent = title;
        titleWrapper.appendChild(titleEl);
      }
      if (subtitle) {
        const subtitleEl = document.createElement('p');
        subtitleEl.className = 'modal-subtitle';
        subtitleEl.textContent = subtitle;
        titleWrapper.appendChild(subtitleEl);
      }
      
      header.appendChild(titleWrapper);

      if (showClose) {
        const closeBtn = document.createElement('button');
        closeBtn.className = 'modal-close';
        closeBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
        closeBtn.setAttribute('aria-label', '关闭');
        closeBtn.addEventListener('click', () => closeModal(id));
        header.appendChild(closeBtn);
      }
      
      modal.appendChild(header);
    }

    // 内容
    if (content) {
      const body = document.createElement('div');
      body.className = 'modal-body';
      if (typeof content === 'string') {
        body.innerHTML = content;
      } else {
        body.appendChild(content);
      }
      modal.appendChild(body);
    }

    // 底部
    if (footer) {
      const footerEl = document.createElement('div');
      footerEl.className = 'modal-footer';
      if (typeof footer === 'string') {
        footerEl.innerHTML = footer;
      } else {
        footerEl.appendChild(footer);
      }
      modal.appendChild(footerEl);
    }

    container.appendChild(modal);
    overlay.appendChild(backdrop);
    overlay.appendChild(container);
    document.body.appendChild(overlay);

    // 事件绑定
    backdrop.addEventListener('click', () => closeModal(id));

    // 存储回调
    if (onOpen || onClose) {
      state.focusStore.set(overlay, { onOpen, onClose });
    }

    return overlay;
  }

  function openModal(idOrElement) {
    let overlay;
    
    if (typeof idOrElement === 'string') {
      overlay = document.getElementById(idOrElement);
    } else if (idOrElement instanceof HTMLElement) {
      overlay = idOrElement;
    }

    if (!overlay) {
      console.warn('Modal not found:', idOrElement);
      return;
    }

    // 保存当前焦点
    const previousFocus = document.activeElement;
    state.focusStore.set(overlay, { ...state.focusStore.get(overlay), previousFocus });

    // 阻止背景滚动
    document.body.style.overflow = 'hidden';

    // 添加到栈
    if (!state.modalStack.includes(overlay)) {
      state.modalStack.push(overlay);
    }

    // 设置z-index
    overlay.style.zIndex = getNextZIndex();

    // 打开弹窗
    requestAnimationFrame(() => {
      overlay.classList.add('active');
    });

    // 创建焦点陷阱
    const focusTrap = createFocusTrap(overlay.querySelector('.modal-container'));
    focusTrap.trap();
    state.focusStore.set(overlay, { ...state.focusStore.get(overlay), focusTrap });

    // ESC 关闭
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        const topModal = state.modalStack[state.modalStack.length - 1];
        if (topModal === overlay) {
          closeModal(overlay);
        }
      }
    };
    document.addEventListener('keydown', handleEsc);
    state.focusStore.set(overlay, { ...state.focusStore.get(overlay), handleEsc });

    // 回调
    const store = state.focusStore.get(overlay);
    if (store && store.onOpen) {
      store.onOpen();
    }
  }

  function closeModal(idOrElement) {
    let overlay;
    
    if (typeof idOrElement === 'string') {
      overlay = document.getElementById(idOrElement);
    } else if (idOrElement instanceof HTMLElement) {
      overlay = idOrElement;
    }

    if (!overlay || !overlay.classList.contains('active')) {
      return;
    }

    // 移除焦点陷阱
    const store = state.focusStore.get(overlay);
    if (store && store.focusTrap) {
      store.focusTrap.release();
    }

    // 移除ESC监听
    if (store && store.handleEsc) {
      document.removeEventListener('keydown', store.handleEsc);
    }

    // 关闭动画
    overlay.classList.remove('active');

    // 从栈中移除
    const index = state.modalStack.indexOf(overlay);
    if (index > -1) {
      state.modalStack.splice(index, 1);
    }

    // 恢复滚动
    if (state.modalStack.length === 0) {
      document.body.style.overflow = '';
    }

    // 恢复焦点
    if (store && store.previousFocus && typeof store.previousFocus.focus === 'function') {
      setTimeout(() => {
        store.previousFocus.focus();
      }, 300);
    }

    // 回调
    if (store && store.onClose) {
      store.onClose();
    }
  }

  function closeAllModals() {
    [...state.modalStack].reverse().forEach(modal => closeModal(modal));
  }

  // ========================================
  // Alert 弹窗
  // ========================================

  function alert(options = {}) {
    const {
      title = '提示',
      message = '',
      icon = 'info',
      confirmText = '确定',
      onConfirm
    } = typeof options === 'string' ? { message: options } : options;

    const iconClasses = {
      success: 'modal-icon-success',
      warning: 'modal-icon-warning',
      error: 'modal-icon-error',
      info: 'modal-icon-info'
    };

    const iconSvgs = {
      success: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>',
      warning: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
      error: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>',
      info: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>'
    };

    const modalId = generateId();
    
    const content = `
      <div class="modal-icon ${iconClasses[icon] || iconClasses.info}">
        ${iconSvgs[icon] || iconSvgs.info}
      </div>
      <p class="modal-message">${escapeHtml(message)}</p>
    `;

    const footer = `
      <button class="btn btn-primary" data-action="confirm">${escapeHtml(confirmText)}</button>
    `;

    const modal = createModal({
      id: modalId,
      title,
      content,
      size: 'small',
      footer,
      showClose: false,
      onClose: () => {
        setTimeout(() => {
          const el = document.getElementById(modalId);
          if (el) el.remove();
        }, 300);
      }
    });

    modal.querySelector('[data-action="confirm"]').addEventListener('click', () => {
      closeModal(modalId);
      if (onConfirm) onConfirm();
    });

    openModal(modal);
  }

  // ========================================
  // Confirm 弹窗
  // ========================================

  function confirm(options = {}) {
    return new Promise((resolve) => {
      const {
        title = '确认',
        message = '',
        icon = 'warning',
        confirmText = '确定',
        cancelText = '取消',
        confirmType = 'primary'
      } = typeof options === 'string' ? { message: options } : options;

      const iconClasses = {
        success: 'modal-icon-success',
        warning: 'modal-icon-warning',
        error: 'modal-icon-error',
        info: 'modal-icon-info'
      };

      const iconSvgs = {
        success: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>',
        warning: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
        error: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>',
        info: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>'
      };

      const modalId = generateId();
      
      const content = `
        <div class="modal-icon ${iconClasses[icon] || iconClasses.warning}">
          ${iconSvgs[icon] || iconSvgs.warning}
        </div>
        <p class="modal-message">${escapeHtml(message)}</p>
      `;

      const footer = `
        <button class="btn btn-secondary" data-action="cancel">${escapeHtml(cancelText)}</button>
        <button class="btn btn-${confirmType}" data-action="confirm">${escapeHtml(confirmText)}</button>
      `;

      const modal = createModal({
        id: modalId,
        title,
        content,
        size: 'small',
        footer,
        showClose: true,
        onClose: () => {
          setTimeout(() => {
            const el = document.getElementById(modalId);
            if (el) el.remove();
          }, 300);
        }
      });

      const handleConfirm = () => {
        closeModal(modalId);
        resolve(true);
      };

      const handleCancel = () => {
        closeModal(modalId);
        resolve(false);
      };

      modal.querySelector('[data-action="confirm"]').addEventListener('click', handleConfirm);
      modal.querySelector('[data-action="cancel"]').addEventListener('click', handleCancel);

      openModal(modal);
    });
  }

  // ========================================
  // Sheet 弹窗
  // ========================================

  function sheet(options = {}) {
    const {
      id = generateId(),
      title = '',
      content = '',
      size = 'medium',
      footer = '',
      onOpen,
      onClose
    } = options;

    const modal = createModal({
      id,
      title,
      content,
      size,
      type: 'sheet',
      footer,
      onOpen,
      onClose
    });

    openModal(modal);
    return modal;
  }

  // ========================================
  // 代码弹窗
  // ========================================

  let currentCode = '';
  const CODE_SAMPLES = {
    'conv2d': `import torch
import torch.nn as nn

class Conv2DBlock(nn.Module):
    """标准2D卷积块 - Conv2d + BatchNorm + Activation
    
    Args:
        in_channels: 输入通道数
        out_channels: 输出通道数
        kernel_size: 卷积核大小
        stride: 步长
        padding: 填充
        activation: 激活函数类型
    """
    def __init__(
        self,
        in_channels: int,
        out_channels: int,
        kernel_size: int = 3,
        stride: int = 1,
        padding: int = 1,
        activation: str = 'relu'
    ):
        super().__init__()
        
        self.conv = nn.Conv2d(
            in_channels,
            out_channels,
            kernel_size=kernel_size,
            stride=stride,
            padding=padding,
            bias=False
        )
        
        self.bn = nn.BatchNorm2d(out_channels)
        
        self.activation = self._get_activation(activation)
    
    def _get_activation(self, name: str) -> nn.Module:
        activations = {
            'relu': nn.ReLU(inplace=True),
            'leaky_relu': nn.LeakyReLU(0.2, inplace=True),
            'swish': nn.SiLU(inplace=True),
            'gelu': nn.GELU()
        }
        return activations.get(name, nn.ReLU(inplace=True))
    
    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = self.conv(x)
        x = self.bn(x)
        x = self.activation(x)
        return x`,
    
    'bottleneck': `import torch
import torch.nn as nn

class Bottleneck(nn.Module):
    """ResNet瓶颈块 - 1x1降维 -> 3x3卷积 -> 1x1升维
    
    减少计算量的同时保持特征表达能力
    
    Args:
        in_channels: 输入通道数
        out_channels: 输出通道数
        stride: 步长
        downsample: 是否下采样
    """
    expansion: int = 4
    
    def __init__(
        self,
        in_channels: int,
        out_channels: int,
        stride: int = 1,
        downsample: nn.Module = None
    ):
        super().__init__()
        
        # 1x1 卷积降维
        self.conv1 = nn.Conv2d(
            in_channels,
            out_channels,
            kernel_size=1,
            bias=False
        )
        self.bn1 = nn.BatchNorm2d(out_channels)
        
        # 3x3 卷积
        self.conv2 = nn.Conv2d(
            out_channels,
            out_channels,
            kernel_size=3,
            stride=stride,
            padding=1,
            bias=False
        )
        self.bn2 = nn.BatchNorm2d(out_channels)
        
        # 1x1 卷积升维
        self.conv3 = nn.Conv2d(
            out_channels,
            out_channels * self.expansion,
            kernel_size=1,
            bias=False
        )
        self.bn3 = nn.BatchNorm2d(out_channels * self.expansion)
        
        self.relu = nn.ReLU(inplace=True)
        self.downsample = downsample
    
    def forward(self, x: torch.Tensor) -> torch.Tensor:
        identity = x
        
        out = self.conv1(x)
        out = self.bn1(out)
        out = self.relu(out)
        
        out = self.conv2(out)
        out = self.bn2(out)
        out = self.relu(out)
        
        out = self.conv3(out)
        out = self.bn3(out)
        
        if self.downsample is not None:
            identity = self.downsample(x)
        
        out += identity
        out = self.relu(out)
        
        return out`,
    
    'mha': `import torch
import torch.nn as nn
import torch.nn.functional as F

class MultiHeadAttention(nn.Module):
    """多头注意力机制
    
    将输入投影到多个子空间进行注意力计算，
    捕获不同位置的关系
    
    Args:
        embed_dim: 嵌入维度
        num_heads: 注意力头数
        dropout: dropout比例
        bias: 是否使用偏置
    """
    def __init__(
        self,
        embed_dim: int,
        num_heads: int,
        dropout: float = 0.1,
        bias: bool = True
    ):
        super().__init__()
        self.embed_dim = embed_dim
        self.num_heads = num_heads
        self.head_dim = embed_dim // num_heads
        
        assert self.head_dim * num_heads == embed_dim, \
            "embed_dim must be divisible by num_heads"
        
        # Q, K, V 投影矩阵
        self.q_proj = nn.Linear(embed_dim, embed_dim, bias=bias)
        self.k_proj = nn.Linear(embed_dim, embed_dim, bias=bias)
        self.v_proj = nn.Linear(embed_dim, embed_dim, bias=bias)
        
        # 输出投影
        self.out_proj = nn.Linear(embed_dim, embed_dim, bias=bias)
        
        self.dropout = nn.Dropout(dropout)
    
    def split_heads(self, x: torch.Tensor) -> torch.Tensor:
        """将输入分割为多个头
        
        Args:
            x: [batch_size, seq_len, embed_dim]
        
        Returns:
            [batch_size, num_heads, seq_len, head_dim]
        """
        batch_size = x.shape[0]
        return x.view(batch_size, -1, self.num_heads, self.head_dim).transpose(1, 2)
    
    def forward(
        self,
        query: torch.Tensor,
        key: torch.Tensor,
        value: torch.Tensor,
        mask: torch.Tensor = None
    ) -> tuple[torch.Tensor, torch.Tensor]:
        """
        Args:
            query: 查询 [batch_size, seq_len, embed_dim]
            key: 键 [batch_size, seq_len, embed_dim]
            value: 值 [batch_size, seq_len, embed_dim]
            mask: 注意力掩码
        
        Returns:
            output: 输出
            attn_weights: 注意力权重
        """
        batch_size = query.shape[0]
        
        # 投影 Q, K, V
        q = self.q_proj(query)
        k = self.k_proj(key)
        v = self.v_proj(value)
        
        # 分割多头
        q = self.split_heads(q)
        k = self.split_heads(k)
        v = self.split_heads(v)
        
        # 计算注意力得分
        attn_weights = torch.matmul(q, k.transpose(-2, -1)) / (self.head_dim ** 0.5)
        
        # 应用掩码
        if mask is not None:
            attn_weights = attn_weights.masked_fill(mask == 0, float('-inf'))
        
        # softmax 归一化
        attn_weights = F.softmax(attn_weights, dim=-1)
        attn_weights = self.dropout(attn_weights)
        
        # 聚合值
        out = torch.matmul(attn_weights, v)
        
        # 合并头
        out = out.transpose(1, 2).contiguous().view(batch_size, -1, self.embed_dim)
        
        # 输出投影
        out = self.out_proj(out)
        
        return out, attn_weights`
  };

  function highlightCode(code, language = 'python') {
    let highlighted = escapeHtml(code);
    
    const KEYWORDS = {
      python: ['def', 'class', 'import', 'from', 'return', 'if', 'else', 'elif', 'for', 'while', 'try', 'except', 'finally', 'with', 'as', 'pass', 'break', 'continue', 'and', 'or', 'not', 'in', 'is', 'True', 'False', 'None', 'lambda', 'yield', 'global', 'nonlocal', 'assert', 'raise', 'del', 'async', 'await', 'self', 'print', 'len', 'range', 'list', 'dict', 'set', 'tuple', 'str', 'int', 'float', 'bool', 'type', 'super', '__init__', '__new__'],
      pytorch: ['nn', 'torch', 'Tensor', 'Module', 'forward', 'backward', 'optim', 'DataLoader', 'Dataset', 'transforms', 'utils', 'autograd', 'F', 'functional', 'Conv2d', 'Linear', 'ReLU', 'Sigmoid', 'Tanh', 'Softmax', 'Dropout', 'BatchNorm', 'LayerNorm', 'Sequential', 'Parameter', 'state_dict', 'load_state_dict', 'to', 'cuda', 'cpu', 'train', 'eval', 'zero_grad', 'step']
    };

    const keywords = KEYWORDS[language] || KEYWORDS.python;
    
    highlighted = highlighted.replace(/(#.*$)/gm, '<span class="code-comment">$1</span>');
    highlighted = highlighted.replace(/(['"`])(?:(?!\1)[^\\]|\\.)*\1/g, (match) => {
      if (match.startsWith('#')) return match;
      return `<span class="code-string">${match}</span>`;
    });
    highlighted = highlighted.replace(/\b(\d+\.?\d*(?:e[+-]?\d+)?|0x[\da-f]+|0b[01]+|0o[0-7]+)\b/gi, '<span class="code-number">$1</span>');
    
    keywords.forEach(kw => {
      const regex = new RegExp(`\\b(${kw})\\b`, 'g');
      highlighted = highlighted.replace(regex, '<span class="code-keyword">$1</span>');
    });
    
    highlighted = highlighted.replace(/\b([A-Z]\w*)\s*\(/g, '<span class="code-class">$1</span>(');
    highlighted = highlighted.replace(/\b([a-z_]\w*)\s*\(/g, '<span class="code-function">$1</span>(');
    
    return highlighted;
  }

  function showCodeModal(options = {}) {
    const {
      code,
      title = '代码示例',
      subtitle = 'Python',
      language = 'python',
      moduleName
    } = options;

    let displayCode = code;
    
    if (!displayCode && moduleName && CODE_SAMPLES[moduleName]) {
      displayCode = CODE_SAMPLES[moduleName];
    }
    
    if (!displayCode) {
      displayCode = '# 代码示例\nprint("Hello, World!")';
    }

    currentCode = displayCode;

    const modalId = generateId();

    const lines = displayCode.split('\n');
    const lineNumbers = lines.map((_, i) => i + 1).join('\n');
    const highlightedCode = highlightCode(displayCode, language);

    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'code-modal';
    contentWrapper.innerHTML = `
      <div class="code-modal-header">
        <div>
          <div class="code-modal-title">${escapeHtml(title)}</div>
          <div class="code-modal-subtitle">${escapeHtml(subtitle)}</div>
        </div>
        <div class="code-modal-actions">
          <button class="code-copy-btn" id="${modalId}-copy">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            <span>复制</span>
          </button>
        </div>
      </div>
      <div class="code-modal-body">
        <div class="code-line-numbers">${escapeHtml(lineNumbers)}</div>
        <pre class="code-content">${highlightedCode}</pre>
      </div>
    `;

    const modal = createModal({
      id: modalId,
      content: contentWrapper,
      size: 'large',
      showClose: true,
      onClose: () => {
        setTimeout(() => {
          const el = document.getElementById(modalId);
          if (el) el.remove();
        }, 300);
      }
    });

    const copyBtn = modal.querySelector('.code-copy-btn');
    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(currentCode);
        copyBtn.classList.add('copied');
        copyBtn.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
          <span>已复制</span>
        `;
        setTimeout(() => {
          copyBtn.classList.remove('copied');
          copyBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            <span>复制</span>
          `;
        }, 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    });

    openModal(modal);
    return modal;
  }

  // ========================================
  // 自定义弹窗
  // ========================================

  function showModal(options) {
    const modal = createModal(options);
    openModal(modal);
    return modal;
  }

  // ========================================
  // 导出 API
  // ========================================

  window.ModalSystem = {
    createModal,
    openModal,
    closeModal,
    closeAllModals,
    alert,
    confirm,
    sheet,
    showCodeModal,
    showModal,
    highlightCode
  };

})();
