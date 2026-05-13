# Deep Learning Explorer

<p align="center">
  <strong>交互式深度学习模型可视化与学习平台</strong>
</p>

<p align="center">
  <a href="https://gitee.com/never-lost/deep-learning-explorer" target="_blank">
    <img src="https://img.shields.io/badge/HTML5-E34F26?style=flat-square&logo=html5&logoColor=white" alt="HTML5">
  </a>
  <a href="https://gitee.com/never-lost/deep-learning-explorer" target="_blank">
    <img src="https://img.shields.io/badge/CSS3-1572B6?style=flat-square&logo=css3&logoColor=white" alt="CSS3">
  </a>
  <a href="https://gitee.com/never-lost/deep-learning-explorer" target="_blank">
    <img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=flat-square&logo=javascript&logoColor=black" alt="JavaScript">
  </a>
  <a href="https://gitee.com/never-lost/deep-learning-explorer/pages" target="_blank">
    <img src="https://img.shields.io/badge/Gitee%20Pages-2D8CF0?style=flat-square&logo=gitee&logoColor=white" alt="Gitee Pages">
  </a>
  <a href="https://github.com/never-lost/deep-learning-explorer/blob/main/LICENSE" target="_blank">
    <img src="https://img.shields.io/badge/License-GPL--3.0-green?style=flat-square&logo=gnu&logoColor=white" alt="GPL-3.0">
  </a>
</p>

<p align="center">
  <a href="https://never-lost.gitee.io/deep-learning-explorer" target="_blank">
    <img src="https://img.shields.io/badge/在线演示-点击访问-007AFF?style=for-the-badge&logo=safari&logoColor=white" alt="在线演示">
  </a>
</p>

---

> 一个纯前端实现的交互式深度学习模型浏览与学习平台，涵盖 **35+ 经典模型**，从 LeNet-5 到 GPT-4，带你纵览深度学习发展脉络。

---

## 功能特性

| 功能 | 描述 | 状态 |
|------|------|------|
| 模型浏览 | 35+ 经典深度学习模型卡片展示，涵盖 CNN、Transformer、扩散模型等 | ✅ |
| 分类筛选 | 按图像分类、目标检测、语义分割、NLP、多模态等领域分类浏览 | ✅ |
| 智能搜索 | 支持模型名称、标签、架构类型、作者等多维度搜索，带防抖与高亮 | ✅ |
| 收藏对比 | 登录后可收藏模型，支持多模型横向对比（参数量、性能指标、创新点） | ✅ |
| 架构可视化 | 交互式模型架构图，动态展示网络结构与数据流向 | ✅ |
| 学习路径 | 按时间线与难度推荐学习顺序，从入门到进阶 | ✅ |
| 管理后台 | 模型数据的增删改查、JSON 导入导出、本地持久化 | ✅ |
| 主题切换 | 明暗双主题，跟随系统偏好，切换无闪烁 | ✅ |
| 响应式设计 | 完美适配桌面、平板、手机等各种屏幕尺寸 | ✅ |
| 字母小人 | 趣味交互系统：悬停、点击、靠近、按住等多种互动反馈 | ✅ |

<!--
### 功能截图

> 以下为截图占位区域，请替换为实际截图

| 首页浏览 | 模型详情 | 架构可视化 |
|----------|----------|------------|
| ![首页](docs/screenshots/home.png) | ![详情](docs/screenshots/detail.png) | ![可视化](docs/screenshots/viz.png) |

| 收藏对比 | 学习路径 | 管理后台 |
|----------|----------|----------|
| ![对比](docs/screenshots/compare.png) | ![路径](docs/screenshots/path.png) | ![管理](docs/screenshots/admin.png) |
-->

---

## 项目数据

<div align="center">

| 统计项 | 数值 |
|--------|------|
| 经典模型 | **35+** |
| 功能模块 | **8+** |
| 前端纯度 | **100%** 纯前端实现 |
| 框架依赖 | **0** 零框架依赖 |
| 响应式支持 | **全平台** 桌面/平板/手机 |

</div>

---

## 技术架构

### 模块化 ES6+ 架构

```
js/
├── app.js           # 应用主入口，视图渲染与事件绑定
├── auth.js          # 用户认证（登录/注册/会话管理）
├── letter-system.js # 字母小人交互系统（FSM 状态机）
├── router.js        # 前端路由管理（Hash 路由）
├── state.js         # 全局状态管理（收藏/对比/主题/用户）
├── ui-components.js # UI 组件工厂（模态框/Toast/骨架屏）
├── utils.js         # 工具函数（防抖/节流/XSS 过滤/格式化）
├── viz-configs.js   # 可视化配置数据
└── viz-engine.js    # 架构可视化渲染引擎
```

### 核心技术特点

- **纯原生实现**：无 React/Vue/Angular 等框架依赖，浏览器原生运行
- **ES6+ Modules**：模块化代码组织，按需加载
- **零构建依赖**：可直接在浏览器中打开运行，也可使用 Vite 构建
- **本地持久化**：localStorage 存储用户数据、收藏、主题偏好
- **性能优化**：骨架屏加载、防抖搜索、缓存策略、内存泄漏防护
- **安全加固**：XSS 输入过滤、CSP 内容安全策略

---

## 快速开始

### 在线访问

直接访问 Gitee Pages 部署地址：

👉 **[https://never-lost.gitee.io/deep-learning-explorer](https://never-lost.gitee.io/deep-learning-explorer)**

### 本地运行

#### 方式一：Python 简易服务器

```bash
# 进入项目目录
cd "deep learning"

# Python 3
python -m http.server 8000

# Python 2
python -m SimpleHTTPServer 8000
```

然后打开浏览器访问 `http://localhost:8000`

#### 方式二：VS Code Live Server

1. 安装 VS Code 扩展 **Live Server**
2. 右键点击 `index.html` → **Open with Live Server**

#### 方式三：Vite 构建（可选）

```bash
# 安装依赖
npm install

# 开发服务器
npm run dev

# 生产构建
npm run build
```

---

## 项目结构

```
deep-learning/
├── assets/
│   └── models.json          # 35+ 深度学习模型数据
├── css/
│   └── style.css            # 全局样式（明暗主题、响应式布局）
├── js/
│   ├── app.js               # 应用主入口
│   ├── auth.js              # 用户认证模块
│   ├── letter-system.js     # 字母小人交互系统
│   ├── router.js            # 前端路由
│   ├── state.js             # 全局状态管理
│   ├── ui-components.js     # UI 组件
│   ├── utils.js             # 工具函数
│   ├── viz-configs.js       # 可视化配置
│   └── viz-engine.js        # 可视化引擎
├── index.html               # 主页面（单页应用）
├── CHANGELOG.md             # 更新日志
├── README.md                # 项目说明
└── .gitignore               # Git 忽略配置
```

---

## 浏览器支持

| 浏览器 | 最低版本 | 支持状态 |
|--------|----------|----------|
| Chrome | 90+ | ✅ 完全支持 |
| Firefox | 88+ | ✅ 完全支持 |
| Safari | 14+ | ✅ 完全支持 |
| Edge | 90+ | ✅ 完全支持 |

> 项目使用 ES6+ 语法、CSS 变量、CSS Grid/Flexbox 等现代 Web 特性，建议使用最新版浏览器以获得最佳体验。

---

## 模型数据

当前收录 **35 个经典深度学习模型**，涵盖以下领域：

| 领域 | 模型数量 | 代表模型 |
|------|----------|----------|
| 图像分类 | 10 | LeNet-5, AlexNet, VGGNet, ResNet, ViT, ConvNeXt... |
| 目标检测 | 7 | YOLO(v1/v3/v5/v8), Faster R-CNN, SSD, RetinaNet... |
| 语义分割 | 3 | FCN, U-Net, DeepLab v3+ |
| 自然语言处理 | 6 | Transformer, BERT, GPT-2/4, T5, LSTM, GRU |
| 图像生成 | 1 | Stable Diffusion |
| 多模态 | 1 | CLIP |
| 基础算法 | 1 | BP (反向传播) |

> 模型数据以 JSON 格式存储于 [`assets/models.json`](assets/models.json)，包含名称、年份、作者、机构、架构、参数量、性能指标、论文链接等完整信息。

---

## 交互特色

### 字母小人系统

首页 Hero 区域的 "Deep Learning" 字母小人拥有丰富的交互行为：

- **鼠标交互**：悬停弹跳、点击注视、靠近好奇、按住压扁、快速移动贪吃蛇跟随
- **偷懒动作**：打瞌睡、打哈欠、伸懒腰、走神发呆、偷看别处、揉眼睛
- **社交互动**：相邻字母窃窃私语、传递眼神、庆祝跳跃
- **独特性格**：每个字母拥有独立的性格标签与配色

### 5 种 Hero 聚光灯效果

| 方案 | 风格 | 描述 |
|------|------|------|
| A | Apple 纯净追光 | 柔和蓝紫渐变跟随鼠标 |
| B | Vercel 极简光晕 | 极淡光晕，几乎不可见 |
| C | Linear 边框流光 | 卡片边缘旋转渐变边框 |
| D | Stripe 卡片内发光 | 鼠标位置产生内部光斑 |
| E | Magic UI 光束连接 | 动态虚线光束连接元素 |

---

## 贡献与反馈

欢迎提交 Issue 和 Pull Request！

- **Bug 报告**：请描述复现步骤、期望行为与实际行为
- **功能建议**：欢迎提出新功能想法与改进建议
- **模型补充**：欢迎提交新的深度学习模型数据

### 反馈渠道

- 项目内反馈：点击右下角「反馈」按钮提交
- Gitee Issues：[提交 Issue](https://gitee.com/never-lost/deep-learning-explorer/issues)

---

## 开源协议

本项目采用 [GNU General Public License v3.0](https://www.gnu.org/licenses/gpl-3.0.html) 开源协议。

```
Deep Learning Explorer
Copyright (C) 2025

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.
```

---

## 致谢

感谢所有为本项目提供建议、反馈和贡献的朋友们。

特别感谢深度学习领域的先驱研究者们，正是他们的杰出工作让这个项目有了丰富的内容。

---

<p align="center">
  Made with ❤️ for the Deep Learning Community
</p>
