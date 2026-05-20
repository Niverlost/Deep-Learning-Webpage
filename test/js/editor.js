class NetworkEditor {
    constructor() {
        this.modules = [];
        this.connections = [];
        this.selectedModules = new Set();
        this.selectedConnection = null;
        this.editMode = true;
        this.viewMode = 'select';
        this.zoom = 1;
        this.panOffset = { x: 0, y: 0 };
        this.isDragging = false;
        this.isPanning = false;
        this.isConnecting = false;
        this.isSelecting = false;
        this.connectionStart = null;
        this.tempLine = null;
        this.moduleIdCounter = 0;
        this.connectionIdCounter = 0;
        this.gridEnabled = false;
        this.snapEnabled = true;
        this.gridSize = 20;
        this.lineStyle = 'curve';
        this.arrowStyle = true;
        this.showGrid = false;
        this.history = [];
        this.historyIndex = -1;
        this.maxHistory = 50;
        this.customModules = this.loadCustomModules();
        this.pendingDeleteCallback = null;
        this.selectionBox = null;
        this.selectionStart = null;
        this.dragOffset = { x: 0, y: 0 };
        this.panStart = { x: 0, y: 0 };
        this.clipboard = null;
        this.spacePressed = false;
        this.previousViewMode = null;

        this.moduleDefinitions = [
            { id: 'input', name: 'Input', category: 'input', icon: '📥', desc: '输入层', properties: [{ name: 'shape', type: 'string', default: '[B, C, H, W]' }] },
            { id: 'embedding', name: 'Embedding', category: 'input', icon: '📝', desc: '词嵌入层', properties: [{ name: 'num_embeddings', type: 'number', default: 10000 }, { name: 'embedding_dim', type: 'number', default: 512 }] },
            
            { id: 'conv2d', name: 'Conv2d', category: 'conv', icon: '🔲', desc: '二维卷积层', properties: [{ name: 'in_channels', type: 'number', default: 3 }, { name: 'out_channels', type: 'number', default: 64 }, { name: 'kernel_size', type: 'number', default: 3 }, { name: 'stride', type: 'number', default: 1 }, { name: 'padding', type: 'number', default: 1 }] },
            { id: 'conv3d', name: 'Conv3d', category: 'conv', icon: '🧊', desc: '三维卷积层', properties: [{ name: 'in_channels', type: 'number', default: 3 }, { name: 'out_channels', type: 'number', default: 64 }, { name: 'kernel_size', type: 'number', default: 3 }] },
            { id: 'convtranspose2d', name: 'ConvTranspose2d', category: 'conv', icon: '⬆️', desc: '转置卷积', properties: [{ name: 'in_channels', type: 'number', default: 64 }, { name: 'out_channels', type: 'number', default: 3 }, { name: 'kernel_size', type: 'number', default: 3 }] },
            { id: 'depthwiseconv2d', name: 'DepthwiseConv2d', category: 'conv', icon: '🎯', desc: '深度可分离卷积', properties: [{ name: 'in_channels', type: 'number', default: 3 }, { name: 'out_channels', type: 'number', default: 64 }] },
            
            { id: 'linear', name: 'Linear', category: 'linear', icon: '➡️', desc: '全连接层', properties: [{ name: 'in_features', type: 'number', default: 512 }, { name: 'out_features', type: 'number', default: 10 }] },
            { id: 'bilinear', name: 'Bilinear', category: 'linear', icon: '🔀', desc: '双线性层', properties: [{ name: 'in1_features', type: 'number', default: 512 }, { name: 'in2_features', type: 'number', default: 512 }, { name: 'out_features', type: 'number', default: 10 }] },
            
            { id: 'maxpool2d', name: 'MaxPool2d', category: 'pool', icon: '📉', desc: '最大池化', properties: [{ name: 'kernel_size', type: 'number', default: 2 }, { name: 'stride', type: 'number', default: 2 }] },
            { id: 'avgpool2d', name: 'AvgPool2d', category: 'pool', icon: '📊', desc: '平均池化', properties: [{ name: 'kernel_size', type: 'number', default: 2 }, { name: 'stride', type: 'number', default: 2 }] },
            { id: 'adaptiveavgpool2d', name: 'AdaptiveAvgPool2d', category: 'pool', icon: '📈', desc: '自适应平均池化', properties: [{ name: 'output_size', type: 'number', default: 1 }] },
            { id: 'globalavgpool', name: 'GlobalAvgPool', category: 'pool', icon: '🌐', desc: '全局平均池化', properties: [] },
            
            { id: 'multiheadattention', name: 'MultiHeadAttention', category: 'attention', icon: '👁️', desc: '多头注意力', properties: [{ name: 'embed_dim', type: 'number', default: 512 }, { name: 'num_heads', type: 'number', default: 8 }] },
            { id: 'selfattention', name: 'SelfAttention', category: 'attention', icon: '🔍', desc: '自注意力层', properties: [{ name: 'embed_dim', type: 'number', default: 512 }, { name: 'num_heads', type: 'number', default: 8 }] },
            { id: 'transformerencoderlayer', name: 'TransformerEncoderLayer', category: 'attention', icon: '⚡', desc: 'Transformer编码器层', properties: [{ name: 'd_model', type: 'number', default: 512 }, { name: 'nhead', type: 'number', default: 8 }] },
            { id: 'transformerdecoderlayer', name: 'TransformerDecoderLayer', category: 'attention', icon: '🔄', desc: 'Transformer解码器层', properties: [{ name: 'd_model', type: 'number', default: 512 }, { name: 'nhead', type: 'number', default: 8 }] },
            
            { id: 'batchnorm2d', name: 'BatchNorm2d', category: 'norm', icon: '📏', desc: '批归一化', properties: [{ name: 'num_features', type: 'number', default: 64 }, { name: 'eps', type: 'number', default: 1e-05 }] },
            { id: 'layernorm', name: 'LayerNorm', category: 'norm', icon: '📐', desc: '层归一化', properties: [{ name: 'normalized_shape', type: 'number', default: 512 }, { name: 'eps', type: 'number', default: 1e-05 }] },
            { id: 'instancenorm2d', name: 'InstanceNorm2d', category: 'norm', icon: '🎨', desc: '实例归一化', properties: [{ name: 'num_features', type: 'number', default: 64 }] },
            
            { id: 'relu', name: 'ReLU', category: 'activation', icon: '⚡', desc: 'ReLU激活', properties: [{ name: 'inplace', type: 'boolean', default: false }] },
            { id: 'gelu', name: 'GELU', category: 'activation', icon: '✨', desc: 'GELU激活', properties: [] },
            { id: 'sigmoid', name: 'Sigmoid', category: 'activation', icon: '📈', desc: 'Sigmoid激活', properties: [] },
            { id: 'tanh', name: 'Tanh', category: 'activation', icon: '📉', desc: 'Tanh激活', properties: [] },
            { id: 'softmax', name: 'Softmax', category: 'activation', icon: '🎯', desc: 'Softmax激活', properties: [{ name: 'dim', type: 'number', default: 1 }] },
            { id: 'leakyrelu', name: 'LeakyReLU', category: 'activation', icon: '💧', desc: 'LeakyReLU激活', properties: [{ name: 'negative_slope', type: 'number', default: 0.01 }] },
            { id: 'selu', name: 'SELU', category: 'activation', icon: '🌟', desc: 'SELU激活', properties: [] },
            { id: 'swish', name: 'Swish', category: 'activation', icon: '🦢', desc: 'Swish激活函数', properties: [] },
            
            { id: 'dropout', name: 'Dropout', category: 'dropout', icon: '💧', desc: 'Dropout层', properties: [{ name: 'p', type: 'number', default: 0.5 }] },
            { id: 'dropout2d', name: 'Dropout2d', category: 'dropout', icon: '💦', desc: '2D Dropout', properties: [{ name: 'p', type: 'number', default: 0.5 }] },
            
            { id: 'lstm', name: 'LSTM', category: 'recurrent', icon: '🔄', desc: '长短期记忆', properties: [{ name: 'input_size', type: 'number', default: 128 }, { name: 'hidden_size', type: 'number', default: 256 }, { name: 'num_layers', type: 'number', default: 2 }, { name: 'bidirectional', type: 'boolean', default: false }] },
            { id: 'gru', name: 'GRU', category: 'recurrent', icon: '🔁', desc: '门控循环单元', properties: [{ name: 'input_size', type: 'number', default: 128 }, { name: 'hidden_size', type: 'number', default: 256 }, { name: 'num_layers', type: 'number', default: 2 }] },
            { id: 'rnn', name: 'RNN', category: 'recurrent', icon: '🔃', desc: '简单循环神经网络', properties: [{ name: 'input_size', type: 'number', default: 128 }, { name: 'hidden_size', type: 'number', default: 256 }] },
            
            { id: 'flatten', name: 'Flatten', category: 'transform', icon: '📋', desc: '展平层', properties: [] },
            { id: 'reshape', name: 'Reshape', category: 'transform', icon: '🔲', desc: '重塑层', properties: [{ name: 'shape', type: 'string', default: '[-1, 784]' }] },
            { id: 'transpose', name: 'Transpose', category: 'transform', icon: '↔️', desc: '转置层', properties: [{ name: 'dims', type: 'string', default: '[0, 2, 1]' }] },
            { id: 'permute', name: 'Permute', category: 'transform', icon: '🔀', desc: '维度置换', properties: [{ name: 'dims', type: 'string', default: '[0, 3, 1, 2]' }] },
            { id: 'upsample', name: 'Upsample', category: 'transform', icon: '📏', desc: '上采样', properties: [{ name: 'scale_factor', type: 'number', default: 2 }, { name: 'mode', type: 'string', default: 'nearest' }] },
            
            { id: 'concat', name: 'Concat', category: 'combine', icon: '🔗', desc: '拼接层', properties: [{ name: 'dim', type: 'number', default: 1 }] },
            { id: 'add', name: 'Add', category: 'combine', icon: '➕', desc: '相加层', properties: [] },
            { id: 'multiply', name: 'Multiply', category: 'combine', icon: '✖️', desc: '相乘层', properties: [] },
            
            { id: 'output', name: 'Output', category: 'output', icon: '📤', desc: '输出层', properties: [{ name: 'units', type: 'number', default: 10 }] },
            { id: 'identity', name: 'Identity', category: 'output', icon: '🆔', desc: '恒等映射', properties: [] }
        ];

        this.init();
    }

    init() {
        this.setupElements();
        this.setupEventListeners();
        this.renderModuleLibrary();
        this.renderCustomModules();
        this.renderCanvas();
        this.updateModeUI();
        this.updateUndoRedoButtons();
        this.saveState();
    }

    setupElements() {
        this.canvas = document.getElementById('network-canvas');
        this.modulesLayer = document.getElementById('modules-layer');
        this.connectionsLayer = document.getElementById('connections-layer');
        this.selectionLayer = document.getElementById('selection-layer');
        this.guidesLayer = document.getElementById('guides-layer');
        this.modulesList = document.getElementById('modules-list');
        this.customModulesList = document.getElementById('custom-modules-list');
        this.panelContent = document.getElementById('panel-content');
        this.zoomLevelEl = document.getElementById('zoom-level');
        this.canvasWrapper = document.getElementById('canvas-wrapper');
        this.selectionInfoEl = document.getElementById('selection-info');
        this.gridBackground = this.canvas.querySelector('.grid-background');

        this.importModal = document.getElementById('import-modal');
        this.exportModal = document.getElementById('export-modal');
        this.createModuleModal = document.getElementById('create-module-modal');
        this.confirmModal = document.getElementById('confirm-modal');
        this.importData = document.getElementById('import-data');
        this.exportData = document.getElementById('export-data');
    }

    setupEventListeners() {
        document.querySelectorAll('.library-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.library-tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.library-panel').forEach(p => p.classList.remove('active'));
                tab.classList.add('active');
                document.getElementById(`${tab.dataset.tab}-panel`).classList.add('active');
            });
        });

        document.querySelectorAll('.category-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.renderModuleLibrary(btn.dataset.category);
            });
        });

        document.getElementById('btn-undo').addEventListener('click', () => this.undo());
        document.getElementById('btn-redo').addEventListener('click', () => this.redo());
        document.getElementById('btn-zoom-in').addEventListener('click', () => this.adjustZoom(0.1));
        document.getElementById('btn-zoom-out').addEventListener('click', () => this.adjustZoom(-0.1));
        document.getElementById('btn-fit').addEventListener('click', () => this.fitToView());
        document.getElementById('btn-select').addEventListener('click', () => this.setViewMode('select'));
        document.getElementById('btn-pan').addEventListener('click', () => this.setViewMode('pan'));
        document.getElementById('btn-grid').addEventListener('click', () => this.toggleGrid());
        document.getElementById('btn-snap').addEventListener('click', () => this.toggleSnap());

        document.getElementById('btn-line-straight').addEventListener('click', () => this.setLineStyle('straight'));
        document.getElementById('btn-line-orthogonal').addEventListener('click', () => this.setLineStyle('orthogonal'));
        document.getElementById('btn-line-curve').addEventListener('click', () => this.setLineStyle('curve'));
        document.getElementById('btn-arrow-style').addEventListener('click', () => this.toggleArrow());

        document.getElementById('btn-import').addEventListener('click', () => this.openImportModal());
        document.getElementById('btn-export').addEventListener('click', () => this.openExportModal());
        document.getElementById('btn-clear').addEventListener('click', () => this.confirmClear());
        document.getElementById('btn-create-module').addEventListener('click', () => this.openCreateModuleModal());

        document.getElementById('toggle-edit-mode').addEventListener('change', (e) => {
            this.editMode = e.target.checked;
            this.updateModeUI();
            this.renderCanvas();
        });

        document.getElementById('view-mode-btn').addEventListener('click', () => {
            this.editMode = false;
            document.getElementById('toggle-edit-mode').checked = false;
            this.updateModeUI();
            this.renderCanvas();
        });
        document.getElementById('edit-mode-btn').addEventListener('click', () => {
            this.editMode = true;
            document.getElementById('toggle-edit-mode').checked = true;
            this.updateModeUI();
            this.renderCanvas();
        });

        document.getElementById('close-import-modal').addEventListener('click', () => this.closeImportModal());
        document.getElementById('cancel-import').addEventListener('click', () => this.closeImportModal());
        document.getElementById('confirm-import').addEventListener('click', () => this.doImport());
        document.getElementById('close-export-modal').addEventListener('click', () => this.closeExportModal());
        document.getElementById('close-export').addEventListener('click', () => this.closeExportModal());
        document.getElementById('copy-export').addEventListener('click', () => this.copyExportData());
        document.getElementById('download-export').addEventListener('click', () => this.downloadExportData());
        document.getElementById('close-create-modal').addEventListener('click', () => this.closeCreateModuleModal());
        document.getElementById('cancel-create').addEventListener('click', () => this.closeCreateModuleModal());
        document.getElementById('confirm-create').addEventListener('click', () => this.createCustomModule());
        document.getElementById('cancel-confirm').addEventListener('click', () => this.closeConfirmModal());
        document.getElementById('confirm-delete').addEventListener('click', () => this.executePendingDelete());

        this.canvas.addEventListener('mousedown', (e) => this.handleCanvasMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleCanvasMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleCanvasMouseUp(e));
        this.canvas.addEventListener('mouseleave', (e) => this.handleCanvasMouseLeave(e));
        this.canvas.addEventListener('wheel', (e) => this.handleWheel(e), { passive: false });
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        document.addEventListener('keyup', (e) => this.handleKeyUp(e));

        document.querySelectorAll('.modal-overlay').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('active');
                }
            });
        });

        this.setupDragAndDrop();
    }

    setupDragAndDrop() {
        const setupItems = () => {
            this.modulesList.querySelectorAll('.module-item').forEach(item => {
                item.addEventListener('dragstart', (e) => this.handleDragStart(e));
                item.addEventListener('dragend', (e) => this.handleDragEnd(e));
            });
            this.customModulesList.querySelectorAll('.module-item').forEach(item => {
                item.addEventListener('dragstart', (e) => this.handleDragStart(e));
                item.addEventListener('dragend', (e) => this.handleDragEnd(e));
            });
        };

        setupItems();

        const originalRenderModuleLibrary = this.renderModuleLibrary.bind(this);
        const originalRenderCustomModules = this.renderCustomModules.bind(this);
        this.renderModuleLibrary = (category) => {
            originalRenderModuleLibrary(category);
            setupItems();
        };
        this.renderCustomModules = () => {
            originalRenderCustomModules();
            setupItems();
        };

        this.canvasWrapper.addEventListener('dragover', (e) => e.preventDefault());
        this.canvasWrapper.addEventListener('drop', (e) => this.handleDrop(e));
    }

    updateModeUI() {
        const modeIndicator = document.getElementById('mode-indicator');
        const viewModeBadge = modeIndicator.querySelector('.view-mode');
        const editModeBadge = modeIndicator.querySelector('.edit-mode');
        const connectionTools = document.getElementById('connection-tools');

        if (this.editMode) {
            editModeBadge.classList.add('active');
            viewModeBadge.classList.remove('active');
            connectionTools.style.display = 'flex';
        } else {
            viewModeBadge.classList.add('active');
            editModeBadge.classList.remove('active');
            connectionTools.style.display = 'none';
        }

        this.canvas.className = `network-canvas ${this.viewMode}-mode`;
        if (!this.editMode) {
            this.canvas.classList.add('view-mode');
        }
    }

    setViewMode(mode) {
        this.viewMode = mode;
        document.querySelectorAll('.canvas-toolbar .tool-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.getElementById(`btn-${mode}`).classList.add('active');
        this.updateModeUI();
    }

    toggleGrid() {
        this.showGrid = !this.showGrid;
        document.getElementById('btn-grid').classList.toggle('active', this.showGrid);
        this.gridBackground.classList.toggle('visible', this.showGrid);
    }

    toggleSnap() {
        this.snapEnabled = !this.snapEnabled;
        document.getElementById('btn-snap').classList.toggle('active', this.snapEnabled);
    }

    setLineStyle(style) {
        this.lineStyle = style;
        document.querySelectorAll('.connection-tools .tool-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.getElementById(`btn-line-${style}`).classList.add('active');
        this.renderCanvas();
    }

    toggleArrow() {
        this.arrowStyle = !this.arrowStyle;
        document.getElementById('btn-arrow-style').classList.toggle('active', this.arrowStyle);
        this.renderCanvas();
    }

    saveState() {
        const state = JSON.stringify({ modules: this.modules, connections: this.connections });
        if (this.historyIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyIndex + 1);
        }
        this.history.push(state);
        if (this.history.length > this.maxHistory) {
            this.history.shift();
        } else {
            this.historyIndex++;
        }
        this.updateUndoRedoButtons();
    }

    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            const state = JSON.parse(this.history[this.historyIndex]);
            this.modules = state.modules;
            this.connections = state.connections;
            this.selectedModules.clear();
            this.selectedConnection = null;
            this.renderCanvas();
            this.renderEmptyPanel();
            this.updateUndoRedoButtons();
        }
    }

    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            const state = JSON.parse(this.history[this.historyIndex]);
            this.modules = state.modules;
            this.connections = state.connections;
            this.selectedModules.clear();
            this.selectedConnection = null;
            this.renderCanvas();
            this.renderEmptyPanel();
            this.updateUndoRedoButtons();
        }
    }

    updateUndoRedoButtons() {
        document.getElementById('btn-undo').disabled = this.historyIndex <= 0;
        document.getElementById('btn-redo').disabled = this.historyIndex >= this.history.length - 1;
    }

    renderModuleLibrary(category = 'all') {
        const filtered = category === 'all'
            ? this.moduleDefinitions
            : this.moduleDefinitions.filter(m => m.category === category);

        this.modulesList.innerHTML = filtered.map(def => `
            <div class="module-item" draggable="true" data-module-id="${def.id}">
                <div class="module-icon">${def.icon}</div>
                <div class="module-info">
                    <div class="module-name">${def.name}</div>
                    <div class="module-desc">${def.desc}</div>
                </div>
            </div>
        `).join('');
    }

    renderCustomModules() {
        if (this.customModules.length === 0) {
            this.customModulesList.innerHTML = '<p style="text-align: center; color: var(--text-secondary); font-size: 12px; padding: 20px;">暂无自定义模块<br/>点击上方按钮创建</p>';
            return;
        }

        this.customModulesList.innerHTML = this.customModules.map((def, idx) => `
            <div class="module-item" draggable="true" data-module-id="custom_${idx}">
                <div class="module-icon">${def.icon}</div>
                <div class="module-info">
                    <div class="module-name">${def.name}</div>
                    <div class="module-desc">${def.desc}</div>
                </div>
            </div>
        `).join('');
    }

    loadCustomModules() {
        try {
            const saved = localStorage.getItem('customModules');
            return saved ? JSON.parse(saved) : [];
        } catch {
            return [];
        }
    }

    saveCustomModules() {
        localStorage.setItem('customModules', JSON.stringify(this.customModules));
    }

    openCreateModuleModal() {
        this.createModuleModal.classList.add('active');
    }

    closeCreateModuleModal() {
        this.createModuleModal.classList.remove('active');
        document.getElementById('custom-module-name').value = '';
        document.getElementById('custom-module-icon').value = '';
        document.getElementById('custom-module-desc').value = '';
        document.getElementById('custom-module-props').value = '';
    }

    createCustomModule() {
        const name = document.getElementById('custom-module-name').value.trim();
        const icon = document.getElementById('custom-module-icon').value.trim() || '📦';
        const desc = document.getElementById('custom-module-desc').value.trim() || '自定义模块';
        const propsStr = document.getElementById('custom-module-props').value.trim();

        if (!name) {
            alert('请输入模块名称');
            return;
        }

        let properties = [];
        if (propsStr) {
            try {
                properties = JSON.parse(propsStr);
            } catch {
                alert('属性 JSON 格式错误');
                return;
            }
        }

        const newModule = { id: `custom_${Date.now()}`, name, icon, desc, properties, category: 'custom' };
        this.customModules.push(newModule);
        this.saveCustomModules();
        this.renderCustomModules();
        this.closeCreateModuleModal();
    }

    handleDragStart(e) {
        e.target.classList.add('dragging');
        e.dataTransfer.setData('text/plain', e.target.dataset.moduleId);
        e.dataTransfer.effectAllowed = 'copy';
    }

    handleDragEnd(e) {
        e.target.classList.remove('dragging');
    }

    handleDrop(e) {
        e.preventDefault();
        if (!this.editMode) return;

        const moduleId = e.dataTransfer.getData('text/plain');
        const rect = this.canvas.getBoundingClientRect();
        let x = (e.clientX - rect.left - this.panOffset.x) / this.zoom;
        let y = (e.clientY - rect.top - this.panOffset.y) / this.zoom;

        if (this.snapEnabled) {
            x = Math.round(x / this.gridSize) * this.gridSize;
            y = Math.round(y / this.gridSize) * this.gridSize;
        }

        let def;
        if (moduleId.startsWith('custom_')) {
            const idx = parseInt(moduleId.replace('custom_', ''));
            def = { ...this.customModules[idx], id: moduleId };
        } else {
            def = this.moduleDefinitions.find(m => m.id === moduleId);
        }

        if (def) {
            this.addModule(def, x, y);
        }
    }

    addModule(def, x, y) {
        this.saveState();
        const module = {
            id: `module_${++this.moduleIdCounter}`,
            type: def.id,
            name: def.name,
            icon: def.icon,
            x: x - 75,
            y: y - 35,
            width: 150,
            height: 70,
            properties: {}
        };

        def.properties.forEach(prop => {
            module.properties[prop.name] = prop.default;
        });

        this.modules.push(module);
        this.selectModule(module);
        this.renderCanvas();
    }

    renderCanvas() {
        this.renderModules();
        this.renderConnections();
        this.renderSelectionBox();
        this.updateSelectionInfo();
    }

    renderModules() {
        this.modulesLayer.innerHTML = '';

        this.modules.forEach(module => {
            const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            const isSelected = this.selectedModules.has(module.id);
            g.setAttribute('class', `module-node ${isSelected ? 'selected' : ''} ${!this.editMode ? 'view-mode' : ''}`);
            g.setAttribute('data-module-id', module.id);
            g.setAttribute('transform', `translate(${this.panOffset.x + module.x * this.zoom}, ${this.panOffset.y + module.y * this.zoom}) scale(${this.zoom})`);

            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.setAttribute('class', 'module-bg');
            rect.setAttribute('x', '0');
            rect.setAttribute('y', '0');
            rect.setAttribute('width', module.width);
            rect.setAttribute('height', module.height);
            rect.setAttribute('rx', '12');
            g.appendChild(rect);

            const iconText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            iconText.setAttribute('class', 'module-icon-text');
            iconText.setAttribute('x', module.width / 2);
            iconText.setAttribute('y', 24);
            iconText.setAttribute('text-anchor', 'middle');
            iconText.textContent = module.icon;
            g.appendChild(iconText);

            const nameText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            nameText.setAttribute('class', 'module-title');
            nameText.setAttribute('x', module.width / 2);
            nameText.setAttribute('y', 50);
            nameText.setAttribute('text-anchor', 'middle');
            nameText.textContent = module.name;
            g.appendChild(nameText);

            if (this.editMode) {
                const deleteBtn = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                deleteBtn.setAttribute('class', 'delete-btn');
                deleteBtn.setAttribute('transform', `translate(${module.width - 18}, 4)`);
                const deleteRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                deleteRect.setAttribute('x', '0');
                deleteRect.setAttribute('y', '0');
                deleteRect.setAttribute('width', '14');
                deleteRect.setAttribute('height', '14');
                deleteRect.setAttribute('rx', '3');
                deleteRect.setAttribute('fill', 'var(--accent-red)');
                const deleteText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                deleteText.setAttribute('x', '7');
                deleteText.setAttribute('y', '11');
                deleteText.setAttribute('text-anchor', 'middle');
                deleteText.setAttribute('fill', 'white');
                deleteText.setAttribute('font-size', '12');
                deleteText.setAttribute('font-weight', 'bold');
                deleteText.textContent = '×';
                deleteBtn.appendChild(deleteRect);
                deleteBtn.appendChild(deleteText);
                deleteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.confirmDeleteModule(module.id);
                });
                g.appendChild(deleteBtn);

                const leftPoint = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                leftPoint.setAttribute('class', 'connection-point');
                leftPoint.setAttribute('cx', '0');
                leftPoint.setAttribute('cy', module.height / 2);
                leftPoint.setAttribute('r', '6');
                leftPoint.dataset.side = 'left';
                leftPoint.addEventListener('mousedown', (e) => {
                    e.stopPropagation();
                    this.startConnection(module, 'left', e);
                });
                leftPoint.addEventListener('mouseup', (e) => {
                    e.stopPropagation();
                    this.endConnection(module, 'left');
                });
                g.appendChild(leftPoint);

                const rightPoint = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                rightPoint.setAttribute('class', 'connection-point');
                rightPoint.setAttribute('cx', module.width);
                rightPoint.setAttribute('cy', module.height / 2);
                rightPoint.setAttribute('r', '6');
                rightPoint.dataset.side = 'right';
                rightPoint.addEventListener('mousedown', (e) => {
                    e.stopPropagation();
                    this.startConnection(module, 'right', e);
                });
                rightPoint.addEventListener('mouseup', (e) => {
                    e.stopPropagation();
                    this.endConnection(module, 'right');
                });
                g.appendChild(rightPoint);
            }

            this.modulesLayer.appendChild(g);
        });
    }

    renderConnections() {
        this.connectionsLayer.innerHTML = '';

        this.connections.forEach((conn, idx) => {
            const fromModule = this.modules.find(m => m.id === conn.from);
            const toModule = this.modules.find(m => m.id === conn.to);

            if (!fromModule || !toModule) return;

            const x1 = this.panOffset.x + (fromModule.x + fromModule.width) * this.zoom;
            const y1 = this.panOffset.y + (fromModule.y + fromModule.height / 2) * this.zoom;
            const x2 = this.panOffset.x + toModule.x * this.zoom;
            const y2 = this.panOffset.y + (toModule.y + toModule.height / 2) * this.zoom;

            const path = this.createConnectionPath(x1, y1, x2, y2);
            const isSelected = this.selectedConnection === idx;
            path.setAttribute('class', `connection-path ${isSelected ? 'selected' : ''} ${!this.arrowStyle ? 'no-arrow' : ''}`);
            path.dataset.connectionIndex = idx;
            path.addEventListener('click', (e) => {
                e.stopPropagation();
                if (this.editMode) {
                    this.selectConnection(idx);
                }
            });
            this.connectionsLayer.appendChild(path);
        });
    }

    createConnectionPath(x1, y1, x2, y2) {
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');

        switch (this.lineStyle) {
            case 'straight':
                path.setAttribute('d', `M ${x1} ${y1} L ${x2} ${y2}`);
                break;
            case 'orthogonal':
                const midX = (x1 + x2) / 2;
                path.setAttribute('d', `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`);
                break;
            case 'curve':
            default:
                const cpOffset = Math.abs(x2 - x1) * 0.5;
                path.setAttribute('d', `M ${x1} ${y1} C ${x1 + cpOffset} ${y1}, ${x2 - cpOffset} ${y2}, ${x2} ${y2}`);
                break;
        }

        return path;
    }

    startConnection(module, side, e) {
        if (!this.editMode) return;

        this.isConnecting = true;
        this.connectionStart = { module, side };

        const startX = this.panOffset.x + (module.x + (side === 'right' ? module.width : 0)) * this.zoom;
        const startY = this.panOffset.y + (module.y + module.height / 2) * this.zoom;

        this.tempLine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        this.tempLine.setAttribute('class', 'connection-path');
        this.tempLine.setAttribute('d', `M ${startX} ${startY} L ${startX} ${startY}`);
        this.tempLine.style.strokeDasharray = '5,5';
        this.connectionsLayer.appendChild(this.tempLine);
    }

    endConnection(module, side) {
        if (!this.isConnecting || !this.connectionStart) return;

        const start = this.connectionStart;

        if (start.module.id !== module.id && start.side !== side) {
            const exists = this.connections.some(c =>
                (c.from === start.module.id && c.to === module.id) ||
                (c.from === module.id && c.to === start.module.id)
            );

            if (!exists) {
                this.saveState();
                if (start.side === 'right') {
                    this.connections.push({ id: `conn_${++this.connectionIdCounter}`, from: start.module.id, to: module.id });
                } else {
                    this.connections.push({ id: `conn_${++this.connectionIdCounter}`, from: module.id, to: start.module.id });
                }
            }
        }

        this.isConnecting = false;
        this.connectionStart = null;
        if (this.tempLine) {
            this.tempLine.remove();
            this.tempLine = null;
        }
        this.renderCanvas();
    }

    selectConnection(idx) {
        this.selectedConnection = idx;
        this.selectedModules.clear();
        this.renderCanvas();
        this.renderConnectionProperties(idx);
    }

    renderConnectionProperties(idx) {
        const conn = this.connections[idx];
        if (!conn) return;

        const fromModule = this.modules.find(m => m.id === conn.from);
        const toModule = this.modules.find(m => m.id === conn.to);

        this.panelContent.innerHTML = `
            <div class="connection-properties">
                <div class="form-group">
                    <label class="form-label">连接信息</label>
                    <p style="font-size: 13px; color: var(--text-secondary); margin: 0;">
                        ${fromModule?.name || 'Unknown'} → ${toModule?.name || 'Unknown'}
                    </p>
                </div>
                <div class="form-group">
                    <label class="form-label">连线样式</label>
                    <select class="form-input" id="conn-line-style">
                        <option value="straight" ${this.lineStyle === 'straight' ? 'selected' : ''}>直线</option>
                        <option value="orthogonal" ${this.lineStyle === 'orthogonal' ? 'selected' : ''}>折线</option>
                        <option value="curve" ${this.lineStyle === 'curve' ? 'selected' : ''}>曲线</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">
                        <input type="checkbox" id="conn-arrow" ${this.arrowStyle ? 'checked' : ''}>
                        显示箭头
                    </label>
                </div>
                <button class="btn btn-danger" style="width: 100%;" onclick="editor.confirmDeleteConnection(${idx})">
                    删除连接
                </button>
            </div>
        `;

        document.getElementById('conn-line-style')?.addEventListener('change', (e) => {
            this.setLineStyle(e.target.value);
        });
        document.getElementById('conn-arrow')?.addEventListener('change', (e) => {
            this.arrowStyle = e.target.checked;
            this.renderCanvas();
        });
    }

    confirmDeleteConnection(index) {
        this.saveState();
        this.connections.splice(index, 1);
        this.selectedConnection = null;
        this.renderCanvas();
        this.renderEmptyPanel();
    }

    handleCanvasMouseDown(e) {
        if (e.button === 2 || e.button === 1) {
            this.isPanning = true;
            this.panStart = { x: e.clientX - this.panOffset.x, y: e.clientY - this.panOffset.y };
            this.canvas.style.cursor = 'grabbing';
            return;
        }

        if (!this.editMode) return;

        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left - this.panOffset.x) / this.zoom;
        const y = (e.clientY - rect.top - this.panOffset.y) / this.zoom;

        if (this.viewMode === 'pan') {
            this.isPanning = true;
            this.panStart = { x: e.clientX - this.panOffset.x, y: e.clientY - this.panOffset.y };
            this.canvas.style.cursor = 'grabbing';
            return;
        }

        let clickedModule = null;
        for (let i = this.modules.length - 1; i >= 0; i--) {
            const module = this.modules[i];
            if (x >= module.x && x <= module.x + module.width &&
                y >= module.y && y <= module.y + module.height) {
                clickedModule = module;
                break;
            }
        }

        if (clickedModule) {
            if (e.shiftKey) {
                if (this.selectedModules.has(clickedModule.id)) {
                    this.selectedModules.delete(clickedModule.id);
                } else {
                    this.selectedModules.add(clickedModule.id);
                }
            } else if (!this.selectedModules.has(clickedModule.id)) {
                this.selectedModules.clear();
                this.selectedModules.add(clickedModule.id);
            }
            this.selectedConnection = null;
            this.isDragging = true;
            this.dragOffset = { x: x - clickedModule.x, y: y - clickedModule.y };
            this.saveState();
        } else {
            if (!e.shiftKey) {
                this.selectedModules.clear();
                this.selectedConnection = null;
            }
            this.isSelecting = true;
            this.selectionStart = { x: e.clientX, y: e.clientY };
            this.renderEmptyPanel();
        }

        this.renderCanvas();
    }

    handleCanvasMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();

        if (this.isPanning) {
            this.panOffset.x = e.clientX - this.panStart.x;
            this.panOffset.y = e.clientY - this.panStart.y;
            this.renderCanvas();
            return;
        }

        if (this.isConnecting && this.tempLine && this.connectionStart) {
            const start = this.connectionStart;
            const startX = this.panOffset.x + (start.module.x + (start.side === 'right' ? start.module.width : 0)) * this.zoom;
            const startY = this.panOffset.y + (start.module.y + start.module.height / 2) * this.zoom;
            const endX = e.clientX - rect.left;
            const endY = e.clientY - rect.top;

            const tempPath = this.createConnectionPath(startX, startY, endX, endY);
            this.tempLine.setAttribute('d', tempPath.getAttribute('d'));
            return;
        }

        if (this.isDragging && this.selectedModules.size > 0) {
            const dx = (e.clientX - rect.left - this.panOffset.x) / this.zoom - this.dragOffset.x;
            const dy = (e.clientY - rect.top - this.panOffset.y) / this.zoom - this.dragOffset.y;

            let snapX = dx;
            let snapY = dy;
            if (this.snapEnabled) {
                snapX = Math.round(dx / this.gridSize) * this.gridSize;
                snapY = Math.round(dy / this.gridSize) * this.gridSize;
            }

            const firstModule = this.modules.find(m => m.id === [...this.selectedModules][0]);
            if (firstModule) {
                const deltaX = snapX - firstModule.x;
                const deltaY = snapY - firstModule.y;

                this.selectedModules.forEach(id => {
                    const module = this.modules.find(m => m.id === id);
                    if (module) {
                        module.x += deltaX;
                        module.y += deltaY;
                    }
                });

                this.dragOffset.x += deltaX;
                this.dragOffset.y += deltaY;
            }

            this.renderCanvas();
            return;
        }

        if (this.isSelecting) {
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            this.selectionBox = {
                x: Math.min(this.selectionStart.x - rect.left, x),
                y: Math.min(this.selectionStart.y - rect.top, y),
                width: Math.abs(x - (this.selectionStart.x - rect.left)),
                height: Math.abs(y - (this.selectionStart.y - rect.top))
            };
            this.renderSelectionBox();
        }
    }

    handleCanvasMouseUp(e) {
        if (this.isPanning) {
            this.isPanning = false;
            this.canvas.style.cursor = this.viewMode === 'pan' ? 'grab' : 'default';
        }

        if (this.isDragging) {
            this.isDragging = false;
            this.renderCanvas();
        }

        if (this.isSelecting && this.selectionBox) {
            this.selectModulesInBox(this.selectionBox);
            this.isSelecting = false;
            this.selectionBox = null;
            this.renderSelectionBox();
        }
    }

    handleCanvasMouseLeave(e) {
        if (this.isConnecting) {
            this.isConnecting = false;
            this.connectionStart = null;
            if (this.tempLine) {
                this.tempLine.remove();
                this.tempLine = null;
            }
            this.renderCanvas();
        }
    }

    renderSelectionBox() {
        this.selectionLayer.innerHTML = '';
        if (this.selectionBox && this.isSelecting) {
            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.setAttribute('class', 'selection-box');
            rect.setAttribute('x', this.selectionBox.x);
            rect.setAttribute('y', this.selectionBox.y);
            rect.setAttribute('width', this.selectionBox.width);
            rect.setAttribute('height', this.selectionBox.height);
            this.selectionLayer.appendChild(rect);
        }
    }

    selectModulesInBox(box) {
        const boxRect = {
            left: (box.x - this.panOffset.x) / this.zoom,
            top: (box.y - this.panOffset.y) / this.zoom,
            right: (box.x + box.width - this.panOffset.x) / this.zoom,
            bottom: (box.y + box.height - this.panOffset.y) / this.zoom
        };

        this.modules.forEach(module => {
            if (module.x >= boxRect.left && module.x + module.width <= boxRect.right &&
                module.y >= boxRect.top && module.y + module.height <= boxRect.bottom) {
                this.selectedModules.add(module.id);
            }
        });

        if (this.selectedModules.size === 1) {
            const module = this.modules.find(m => m.id === [...this.selectedModules][0]);
            this.selectModule(module);
        } else if (this.selectedModules.size > 1) {
            this.renderMultiSelectPanel();
        }

        this.renderCanvas();
    }

    updateSelectionInfo() {
        if (this.selectedModules.size > 1) {
            this.selectionInfoEl.textContent = `已选中 ${this.selectedModules.size} 个模块`;
        } else if (this.selectedModules.size === 1) {
            const module = this.modules.find(m => m.id === [...this.selectedModules][0]);
            this.selectionInfoEl.textContent = module?.name || '';
        } else {
            this.selectionInfoEl.textContent = '';
        }
    }

    handleWheel(e) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const oldZoom = this.zoom;
        this.zoom = Math.max(0.2, Math.min(3, this.zoom + delta));

        this.panOffset.x = mouseX - (mouseX - this.panOffset.x) * (this.zoom / oldZoom);
        this.panOffset.y = mouseY - (mouseY - this.panOffset.y) * (this.zoom / oldZoom);

        this.zoomLevelEl.textContent = Math.round(this.zoom * 100) + '%';
        this.renderCanvas();
    }

    handleKeyDown(e) {
        const isInputFocused = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName);
        if (isInputFocused) return;

        if (e.code === 'Space' && !this.spacePressed) {
            this.spacePressed = true;
            if (!this.isPanning && !this.isDragging) {
                this.previousViewMode = this.viewMode;
                this.setViewMode('pan');
            }
            return;
        }

        if (e.key === 'Delete' || e.key === 'Backspace') {
            if (this.selectedModules.size > 0) {
                this.confirmDeleteSelected();
            } else if (this.selectedConnection !== null) {
                this.confirmDeleteConnection(this.selectedConnection);
            }
        } else if (e.key === 'Escape') {
            this.deselectAll();
            if (this.isConnecting) {
                this.isConnecting = false;
                this.connectionStart = null;
                if (this.tempLine) {
                    this.tempLine.remove();
                    this.tempLine = null;
                }
                this.renderCanvas();
            }
        } else if (e.ctrlKey || e.metaKey) {
            switch (e.key.toLowerCase()) {
                case 'z':
                    e.preventDefault();
                    if (e.shiftKey) {
                        this.redo();
                    } else {
                        this.undo();
                    }
                    break;
                case 'y':
                    e.preventDefault();
                    this.redo();
                    break;
                case 'a':
                    e.preventDefault();
                    this.selectAll();
                    break;
                case 'd':
                    e.preventDefault();
                    this.duplicateSelected();
                    break;
                case 'c':
                    e.preventDefault();
                    this.copySelected();
                    break;
                case 'v':
                    e.preventDefault();
                    this.pasteClipboard();
                    break;
                case '=':
                case '+':
                    e.preventDefault();
                    this.adjustZoom(0.1);
                    break;
                case '-':
                    e.preventDefault();
                    this.adjustZoom(-0.1);
                    break;
                case '0':
                    e.preventDefault();
                    this.fitToView();
                    break;
            }
        } else {
            switch (e.key.toLowerCase()) {
                case 'v':
                    this.setViewMode('select');
                    break;
                case 'h':
                    this.setViewMode('pan');
                    break;
            }
        }
    }

    handleKeyUp(e) {
        if (e.code === 'Space') {
            this.spacePressed = false;
            if (this.previousViewMode) {
                this.setViewMode(this.previousViewMode);
                this.previousViewMode = null;
            }
        }
    }

    copySelected() {
        if (this.selectedModules.size === 0) return;

        this.clipboard = [...this.selectedModules].map(id => {
            const module = this.modules.find(m => m.id === id);
            return module ? JSON.parse(JSON.stringify(module)) : null;
        }).filter(Boolean);
    }

    pasteClipboard() {
        if (!this.clipboard || this.clipboard.length === 0) return;

        this.saveState();
        const newModules = [];
        const offset = 30;

        this.clipboard.forEach(original => {
            const newId = `module_${++this.moduleIdCounter}`;
            newModules.push({
                ...JSON.parse(JSON.stringify(original)),
                id: newId,
                x: original.x + offset,
                y: original.y + offset
            });
        });

        this.modules.push(...newModules);
        this.selectedModules.clear();
        newModules.forEach(m => this.selectedModules.add(m.id));
        this.renderCanvas();
        if (newModules.length === 1) {
            this.selectModule(newModules[0]);
        } else {
            this.renderMultiSelectPanel();
        }
    }

    duplicateSelected() {
        if (this.selectedModules.size === 0) return;
        this.copySelected();
        this.pasteClipboard();
    }

    selectModule(module) {
        if (!module) return;
        this.selectedModules.clear();
        this.selectedModules.add(module.id);
        this.selectedConnection = null;
        this.renderCanvas();
        this.renderModuleProperties(module);
    }

    renderModuleProperties(module) {
        const moduleDef = this.moduleDefinitions.find(d => d.id === module.type);
        
        let propertiesHTML = '';
        
        if (moduleDef && moduleDef.properties) {
            propertiesHTML = moduleDef.properties.map(prop => {
                let inputHTML = '';
                const value = module.properties[prop.name] !== undefined ? module.properties[prop.name] : prop.default;
                
                if (prop.type === 'boolean') {
                    inputHTML = `
                        <label class="form-label">
                            <input type="checkbox" data-prop="${prop.name}" ${value ? 'checked' : ''}>
                            ${prop.name}
                        </label>
                    `;
                } else if (prop.type === 'number') {
                    inputHTML = `
                        <label class="form-label">${prop.name}</label>
                        <input type="number" class="form-input" data-prop="${prop.name}" value="${value}">
                    `;
                } else {
                    inputHTML = `
                        <label class="form-label">${prop.name}</label>
                        <input type="text" class="form-input" data-prop="${prop.name}" value="${value}">
                    `;
                }
                
                return `<div class="form-group">${inputHTML}</div>`;
            }).join('');
        }
        
        this.panelContent.innerHTML = `
            <div class="module-properties">
                <div class="form-group">
                    <label class="form-label">模块名称</label>
                    <input type="text" class="form-input" id="module-name" value="${module.name}">
                </div>
                <div class="form-group">
                    <label class="form-label">类型</label>
                    <p style="font-size: 13px; color: var(--text-secondary); margin: 0;">${moduleDef?.desc || module.type}</p>
                </div>
                <div class="form-group">
                    <label class="form-label">位置</label>
                    <p style="font-size: 12px; color: var(--text-tertiary); margin: 0;">X: ${Math.round(module.x)}, Y: ${Math.round(module.y)}</p>
                </div>
                ${propertiesHTML}
                <button class="btn btn-danger" style="width: 100%; margin-top: 20px;" onclick="editor.confirmDeleteModule('${module.id}')">
                    删除模块
                </button>
            </div>
        `;
        
        this.panelContent.querySelectorAll('[data-prop]').forEach(input => {
            input.addEventListener('change', (e) => {
                const propName = e.target.dataset.prop;
                let value;
                if (e.target.type === 'checkbox') {
                    value = e.target.checked;
                } else if (e.target.type === 'number') {
                    value = parseFloat(e.target.value);
                } else {
                    value = e.target.value;
                }
                module.properties[propName] = value;
            });
        });
        
        document.getElementById('module-name').addEventListener('change', (e) => {
            module.name = e.target.value;
            this.renderCanvas();
        });
    }

    renderEmptyPanel() {
        this.panelContent.innerHTML = `
            <div class="empty-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.5">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="9" y1="9" x2="15" y2="9"></line>
                    <line x1="9" y1="15" x2="15" y2="15"></line>
                </svg>
                <p>选择一个模块来编辑其属性</p>
                <p class="empty-hint">提示：拖拽模块到画布开始，按住Shift多选</p>
            </div>
        `;
    }

    renderMultiSelectPanel() {
        this.panelContent.innerHTML = `
            <div class="empty-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.5">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    <rect x="8" y="8" width="18" height="18" rx="2" ry="2" transform="translate(4, -4)"></rect>
                </svg>
                <p>已选中 ${this.selectedModules.size} 个模块</p>
                <div style="margin-top: 16px; display: flex; gap: 8px; flex-wrap: wrap;">
                    <button class="btn btn-primary btn-sm" onclick="editor.copySelected(); editor.pasteClipboard();">复制</button>
                    <button class="btn btn-danger btn-sm" onclick="editor.confirmDeleteSelected();">删除</button>
                </div>
            </div>
        `;
    }

    selectAll() {
        if (!this.editMode) return;
        this.selectedModules.clear();
        this.modules.forEach(m => this.selectedModules.add(m.id));
        this.selectedConnection = null;
        this.renderCanvas();
        if (this.selectedModules.size > 1) {
            this.renderMultiSelectPanel();
        }
    }

    deselectAll() {
        this.selectedModules.clear();
        this.selectedConnection = null;
        this.renderCanvas();
        this.renderEmptyPanel();
    }

    confirmDeleteModule(moduleId) {
        this.pendingDeleteCallback = () => {
            this.saveState();
            this.modules = this.modules.filter(m => m.id !== moduleId);
            this.connections = this.connections.filter(c => c.from !== moduleId && c.to !== moduleId);
            this.selectedModules.clear();
            this.selectedConnection = null;
            this.renderCanvas();
            this.renderEmptyPanel();
        };
        this.confirmModal.classList.add('active');
        document.getElementById('confirm-message').textContent = '确定要删除这个模块吗？';
    }

    confirmDeleteSelected() {
        if (this.selectedModules.size === 0) return;
        this.pendingDeleteCallback = () => {
            this.saveState();
            const moduleIds = [...this.selectedModules];
            this.modules = this.modules.filter(m => !moduleIds.includes(m.id));
            this.connections = this.connections.filter(c => !moduleIds.includes(c.from) && !moduleIds.includes(c.to));
            this.selectedModules.clear();
            this.selectedConnection = null;
            this.renderCanvas();
            this.renderEmptyPanel();
        };
        this.confirmModal.classList.add('active');
        document.getElementById('confirm-message').textContent = `确定要删除选中的 ${this.selectedModules.size} 个模块吗？`;
    }

    executePendingDelete() {
        if (this.pendingDeleteCallback) {
            this.pendingDeleteCallback();
            this.pendingDeleteCallback = null;
        }
        this.closeConfirmModal();
    }

    closeConfirmModal() {
        this.confirmModal.classList.remove('active');
    }

    confirmClear() {
        this.pendingDeleteCallback = () => {
            this.saveState();
            this.modules = [];
            this.connections = [];
            this.selectedModules.clear();
            this.selectedConnection = null;
            this.renderCanvas();
            this.renderEmptyPanel();
        };
        this.confirmModal.classList.add('active');
        document.getElementById('confirm-message').textContent = '确定要清空画布上的所有内容吗？';
    }

    adjustZoom(delta) {
        const oldZoom = this.zoom;
        this.zoom = Math.max(0.2, Math.min(3, this.zoom + delta));
        const centerX = this.canvas.getBoundingClientRect().width / 2;
        const centerY = this.canvas.getBoundingClientRect().height / 2;
        this.panOffset.x = centerX - (centerX - this.panOffset.x) * (this.zoom / oldZoom);
        this.panOffset.y = centerY - (centerY - this.panOffset.y) * (this.zoom / oldZoom);
        this.zoomLevelEl.textContent = Math.round(this.zoom * 100) + '%';
        this.renderCanvas();
    }

    fitToView() {
        if (this.modules.length === 0) {
            this.zoom = 1;
            this.panOffset = { x: 0, y: 0 };
            this.zoomLevelEl.textContent = '100%';
            this.renderCanvas();
            return;
        }

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        this.modules.forEach(m => {
            minX = Math.min(minX, m.x);
            minY = Math.min(minY, m.y);
            maxX = Math.max(maxX, m.x + m.width);
            maxY = Math.max(maxY, m.y + m.height);
        });

        const padding = 60;
        const canvasRect = this.canvas.getBoundingClientRect();
        const contentWidth = maxX - minX;
        const contentHeight = maxY - minY;
        const scaleX = (canvasRect.width - padding * 2) / contentWidth;
        const scaleY = (canvasRect.height - padding * 2) / contentHeight;
        
        this.zoom = Math.min(scaleX, scaleY, 1);
        
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        this.panOffset.x = canvasRect.width / 2 - centerX * this.zoom;
        this.panOffset.y = canvasRect.height / 2 - centerY * this.zoom;
        
        this.zoomLevelEl.textContent = Math.round(this.zoom * 100) + '%';
        this.renderCanvas();
    }

    openImportModal() {
        this.importModal.classList.add('active');
        document.getElementById('import-data').value = '';
    }

    closeImportModal() {
        this.importModal.classList.remove('active');
    }

    doImport() {
        const dataText = document.getElementById('import-data').value.trim();
        if (!dataText) {
            alert('请输入要导入的数据');
            return;
        }

        try {
            const data = JSON.parse(dataText);
            this.saveState();
            
            if (data.modules) {
                this.modules = data.modules;
                this.moduleIdCounter = Math.max(...this.modules.map(m => {
                    const match = m.id.match(/module_(\d+)/);
                    return match ? parseInt(match[1]) : 0;
                }), this.moduleIdCounter);
            }
            if (data.connections) {
                this.connections = data.connections;
                this.connectionIdCounter = Math.max(...this.connections.map(c => {
                    const match = c.id.match(/conn_(\d+)/);
                    return match ? parseInt(match[1]) : 0;
                }), this.connectionIdCounter);
            }
            
            this.selectedModules.clear();
            this.selectedConnection = null;
            this.renderCanvas();
            this.renderEmptyPanel();
            this.closeImportModal();
        } catch (e) {
            alert('导入失败：数据格式不正确');
        }
    }

    openExportModal() {
        this.exportModal.classList.add('active');
        const data = {
            modules: this.modules,
            connections: this.connections,
            version: '1.0',
            exportedAt: new Date().toISOString()
        };
        document.getElementById('export-data').value = JSON.stringify(data, null, 2);
    }

    closeExportModal() {
        this.exportModal.classList.remove('active');
    }

    copyExportData() {
        const textarea = document.getElementById('export-data');
        textarea.select();
        document.execCommand('copy');
        alert('数据已复制到剪贴板');
    }

    downloadExportData() {
        const exportType = document.querySelector('input[name="export-type"]:checked').value;
        
        if (exportType === 'json') {
            const data = document.getElementById('export-data').value;
            const blob = new Blob([data], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'network-structure.json';
            a.click();
            URL.revokeObjectURL(url);
        } else if (exportType === 'png') {
            const svg = this.canvas;
            const svgData = new XMLSerializer().serializeToString(svg);
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            
            canvas.width = svg.getBoundingClientRect().width * 2;
            canvas.height = svg.getBoundingClientRect().height * 2;
            ctx.scale(2, 2);
            ctx.fillStyle = '#050505';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            img.onload = () => {
                ctx.drawImage(img, 0, 0);
                const link = document.createElement('a');
                link.download = 'network-structure.png';
                link.href = canvas.toDataURL('image/png');
                link.click();
            };
            
            img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
        }
    }
}

const editor = new NetworkEditor();