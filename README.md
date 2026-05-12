# Deep Learning Explorer

交互式探索 35+ 经典深度学习模型的架构与原理。

## 在线访问

https://你的用户名.gitee.io/deep-learning-explorer/

## 功能特性

- **35+ 经典深度学习模型** — 从 LeNet 到 GPT-4，覆盖图像分类、目标检测、NLP、生成模型等领域
- **交互式字母小人** — 带有表情、眼睛追踪、社交互动等丰富动画
- **模型可视化** — 网络架构图、代码生成、参数可视化
- **学习路径** — 从入门到精通的深度学习学习路线
- **模型对比** — 并排对比不同模型的架构差异
- **收藏系统** — 收藏感兴趣的模型，快速访问

## 技术栈

- HTML5 / CSS3（无框架）
- Vanilla JavaScript（原生 JS）
- CSS 自定义属性（主题系统）
- requestAnimationFrame 动画引擎
- localStorage 本地存储

## 本地运行

```bash
# 方式 1：Python 简易服务器
python -m http.server 8080

# 方式 2：Node.js
npx serve .

# 方式 3：VS Code Live Server 扩展
```

然后访问 http://localhost:8080

## 项目结构

```
.
├── index.html          # 主页面
├── app.js              # 应用逻辑（~6400 行）
├── style.css           # 样式（~6400 行）
├── viz-configs.js      # 可视化配置
├── models.json         # 模型数据
└── README.md           # 本文件
```

## 部署

本项目为纯前端静态网页，可部署到任何静态托管平台：

- [Gitee Pages](https://gitee.com)
- [GitHub Pages](https://github.com)
- [Vercel](https://vercel.com)
- [Netlify](https://netlify.com)
- [腾讯云云开发](https://cloud.tencent.com)

## 浏览器支持

- Chrome / Edge（推荐）
- Firefox
- Safari

## 许可证

MIT
