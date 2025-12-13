# NXmind (心流导图)

> **极简、流畅、无感。让思维整理效率提升 1000% 的下一代生产力工具。**

![Banner](logo/banner.jpg)

![License](https://img.shields.io/badge/license-MIT-blue.svg) ![Tauri](https://img.shields.io/badge/Built_with-Tauri_2.0-orange) ![React](https://img.shields.io/badge/Frontend-React_19-blue) ![Author](https://img.shields.io/badge/Author-thehuan-purple)

NXmind (心流导图) 将**便利贴的自由**与**思维导图的逻辑**完美融合。我们抛弃了传统导图软件繁琐的菜单和边框，打造了一个"存在即合理"的纯净思考空间。

---

## ✨ 核心特性 (Highlights)

### 🚀 极致效率 & 无感体验
- **零干扰设计**：无边框窗口、自动隐藏的 Dock、极简 UI。应用仿佛"消失"在桌面，只留下你的思想。
- **光速启动**：基于 Rust (Tauri) 构建，秒级启动，极低资源占用。
- **智能记忆**：自动记忆窗口位置、大小和所有操作状态。随时关闭，随时接续，心流不断。

### 🌊 心流般的交互
- **混合视图引擎**：既是自由拖拽的无限白板，也是逻辑严密的树状结构。一键无缝切换。
- **D3 物理驱动**：丝般顺滑的节点动画，让整理思绪变成一种享受。
- **全键盘流操作**：
    - `Tab`：衍生新想法（子节点）
    - `Enter`：追加同级想法
    - `拖拽`：重组逻辑结构

### 🎨 现代美学
- **智能配色**：内置 Dawn, Noon, Dusk, Night, Dream 等多套精心调制的 HSL 主题。
- **原生质感**：磨砂玻璃特效、细腻的非线性动画。

## 🛠️ 技术架构 (Architecture)

NXmind 采用最前沿的 **Tauri 2.0** 架构，实现了 Web 的灵活与 Native 的性能完美统一。

*   **Backend (Rust)**
    *   `Tauri 2.0`: 提供系统级能力（文件系统、全局快捷键、窗口管理）。
    *   `Plugins`: Window State (状态持久化), Single Instance (单例锁), Auto Start (自启)。

*   **Frontend (TypeScript)**
    *   `React 19`: 利用最新的 Hooker 和并发特性管理复杂状态。
    *   `D3.js`: 负责计算复杂的树状布局 (Tree Layout) 和物理交互 (Zoom/Drag)。
    *   `Tailwind CSS`: 原子化样式引擎，构建像素级精细的界面。

## 📦 安装与使用 (Installation)

### 开发环境
确保已安装 Rust 和 Node.js 环境。

```bash
# 安装依赖
npm install

# 启动开发服务器 (热重载)
npm run tauri dev
```

### 构建生产版本
```bash
# 生成 Windows 安装包 (.exe)
npm run tauri build
```

构建产物位于 `src-tauri/target/release/bundle/nsis/`。

## 📄 开源协议
MIT License. 自由使用，自由创造。
Copyright (c) 2025 thehuan
