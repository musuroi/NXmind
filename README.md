# NXmind (心流导图)

> **哪怕只为了整理一个念头，也不该被繁琐的菜单打断。**

![Banner](logo/banner.jpg)

![License](https://img.shields.io/badge/license-MIT-blue.svg) ![Tauri](https://img.shields.io/badge/Built_with-Tauri_2.0-orange) ![React](https://img.shields.io/badge/Frontend-React_19-blue) ![Author](https://img.shields.io/badge/Author-thehuan-purple)

## 👋 为什么要造这个轮子？

说实话，写这个软件纯粹是因为我**受够了**。

作为一个喜欢随手记录灵感的人，我试过市面上无数款思维导图工具。它们都很强大，但也**太繁琐了**。每次我想整理一点思绪，都要面对复杂的工具栏、各种各样的格式选项、选不完的模版……哪怕只是想改个字，都要点好几层菜单。

**我只想要一个简单的、直接的、能让我专注在“思考”这件事本身的工具。**

我不想要排版，不想要富文本，不想要花里胡哨的边框。我只想要打开它，把脑子里的东西倒出来，然后关掉它。

于是，就有了 **NXmind**。

## 💡 它是怎么工作的？

NXmind 的设计哲学就是**做减法**。

*   **没有富文本**：你不需要考虑加粗、斜体还是换字体。只有文字。
*   **没有模版**：打开就是一个纯净的节点，直接开始写。
*   **没有格式**：别在调整颜色和线框上浪费时间了，逻辑才是思维导图的核心。

### 极简的工作流：
1.  **安装 & 打开**：秒开，不等待。
2.  **输入**：用键盘搞定一切（`Tab` 新建子节点，`Enter` 新建同级节点）。
3.  **钉在桌面**：把它像便利贴一样钉在桌面上。
4.  **随时呼出**：想到了什么？呼出它，记下来，隐藏它。

就是这么简单。它应该像空气一样，在你需要的时候存在，不需要的时候消失。

## ✨ 我做的一些小细节

虽然追求极简，但作为开发者，体验必须丝滑：

*   **完全沉浸**：无边框窗口，甚至 Dock 栏都会自动隐藏，屏幕上只有你的思想。
*   **物理手感**：基于 D3.js 写的节点动画，拖拽起来会有种很解压的物理回弹感（这点我很喜欢）。
*   **自动记忆**：你把窗口放哪了、写到哪了，下次打开还在那。
*   **轻量级**：用 Rust (Tauri 2.0) 写后端，React 19 写前端。占用资源极低，这可是我的电脑，不能让一个记事软件占满内存。

## 🛠️ 技术栈 (Tech Stack)

如果你也是开发者，可能对这个感兴趣。这是我目前觉得写桌面应用最舒服的组合：

*   **Core**: [Tauri 2.0](https://tauri.app/) (Rust) - 为了小体积和高性能。
*   **UI**: React 19 + TypeScript - 为了用上最新的 Hooks 处理复杂状态。
*   **Engine**: D3.js - 处理树状布局和物理引擎。
*   **Style**: Tailwind CSS - 手写样式太累了，原子化真香。

## 📦 跑起来 (Get Started)

如果你想自己构建或修改：

### 环境准备
确保你有 Rust 和 Node.js 环境。

### 开发
```bash
# 装依赖
npm install

# 跑起来 (热重载)
npm run tauri dev
```

### 打包
```bash
# 生成 Windows .exe
npm run tauri build
```
产物在 `src-tauri/target/release/bundle/nsis/` 里。

## 📄 License

MIT License.
代码就在这，随意折腾，希望能帮到和我一样喜欢简单的你。

Copyright (c) 2025 thehuan