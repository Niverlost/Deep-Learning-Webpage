# Deep-Learning-Webpage

<p align="center">
  <strong>An experimental front-end project for deep learning development.</strong>
</p>

<p align="center">
  <a href="https://github.com/Niverlost/Deep-Learning-Webpage" target="_blank">
    <img src="https://img.shields.io/badge/HTML5-E34F26?style=flat-square&logo=html5&logoColor=white" alt="HTML5">
  </a>
  <a href="https://github.com/Niverlost/Deep-Learning-Webpage" target="_blank">
    <img src="https://img.shields.io/badge/CSS3-1572B6?style=flat-square&logo=css3&logoColor=white" alt="CSS3">
  </a>
  <a href="https://github.com/Niverlost/Deep-Learning-Webpage" target="_blank">
    <img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=flat-square&logo=javascript&logoColor=black" alt="JavaScript">
  </a>
  <a href="https://niverlost.github.io/Deep-Learning-Webpage" target="_blank">
    <img src="https://img.shields.io/badge/GitHub%20Pages-222222?style=flat-square&logo=github&logoColor=white" alt="GitHub Pages">
  </a>
  <a href="https://github.com/Niverlost/Deep-Learning-Webpage/blob/main/LICENSE" target="_blank">
    <img src="https://img.shields.io/badge/License-Apache%202.0-blue?style=flat-square&logo=apache&logoColor=white" alt="Apache 2.0">
  </a>
</p>

<p align="center">
  <a href="https://niverlost.github.io/Deep-Learning-Webpage" target="_blank">
    <img src="https://img.shields.io/badge/在线访问-点击打开-007AFF?style=for-the-badge&logo=safari&logoColor=white" alt="在线访问">
  </a>
</p>

---

> 一个纯前端实现的交互式深度学习模型浏览与学习平台，涵盖 **35+ 经典模型**，从 LeNet-5 到 GPT-4，带你纵览深度学习发展脉络。

---

## 网页前端功能

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

---

## 在线访问

直接访问 GitHub Pages 部署地址：

👉 **[https://niverlost.github.io/Deep-Learning-Webpage](https://niverlost.github.io/Deep-Learning-Webpage)**

---

## 项目结构

```
Deep-Learning-Webpage/
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

## 贡献与反馈

欢迎提交 Issue 和 Pull Request！

- **Bug 报告**：请描述复现步骤、期望行为与实际行为
- **功能建议**：欢迎提出新功能想法与改进建议
- **模型补充**：欢迎提交新的深度学习模型数据

### 反馈渠道

- 项目内反馈：点击右下角「反馈」按钮提交
- GitHub Issues：[提交 Issue](https://github.com/Niverlost/Deep-Learning-Webpage/issues)

---

## 开源协议

本项目采用 [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0) 开源协议。

```
Copyright 2025 Deep-Learning-Webpage

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
```

---

## 致谢

感谢所有为本项目提供建议、反馈和贡献的朋友们。

特别感谢深度学习领域的先驱研究者们，正是他们的杰出工作让这个项目有了丰富的内容。

---

<p align="center">
  Made with ❤️ for the Deep Learning Community
</p>
