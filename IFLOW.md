# Mindflow 项目指南

## 1. 项目概述
Mindflow 是一个基于 Web 的现代化思维导图与便签应用。它结合了 React 的组件化优势与 D3.js 的强大可视化能力，提供流畅的交互体验（拖拽、缩放、主题切换）。

## 2. 技术栈
- **核心框架**: React 19, TypeScript 5.8
- **构建工具**: Vite 6
- **可视化**: D3.js v7 (用于树状图布局计算与交互)
- **样式**: Tailwind CSS
- **图标**: Lucide React
- **AI 能力**: @google/genai (目前已安装依赖，待集成)

## 3. 开发环境设置
### 启动项目
```bash
npm install
npm run dev
```

### 环境变量
需在 `.env.local` 中配置：
```env
GEMINI_API_KEY=your_api_key_here
```

## 4. 架构与目录结构

### 核心文件
- **`App.tsx`**: 应用入口与状态容器。管理便签列表 (`notes`)、当前激活便签 (`activeNoteId`)、主题 (`defaultTheme`) 以及 Dock 位置。处理全局持久化 (`localStorage`)。
- **`types.ts`**: 定义核心数据结构 (`MindNode`, `Note`, `Theme`, `ViewState`)。
- **`utils/helpers.ts`**: 纯函数工具库。包含：
  - 树操作逻辑：`moveNode` (单节点移动), `moveNodes` (批量移动), `findNodeById`.
  - 主题定义：`THEMES` (dawn, noon, dusk, night, dream).
  - 颜色算法：`getContrastingTextColor`, `getSmartBorderColor`.

### 组件 (Components)
- **`components/MindMap.tsx`**: 核心画布组件。
  - **混合渲染模式**: 使用 D3.js 计算树布局 (`d3.tree`) 和处理缩放/平移 (`d3.zoom`)，但节点渲染使用 React 的 `<foreignObject>` 以支持 HTML 输入控件和 Tailwind 样式。
  - **交互**: 支持框选 (Box Selection)、拖拽节点 (Drag & Drop)、快捷键 (Tab 新增子节点, Enter 新增兄弟节点, Delete 删除)。
  - **历史记录**: 使用 `useHistory` hook 实现撤销/重做。
- **`components/Dock.tsx`**: 底部/右侧导航栏。
  - 模仿 macOS Dock 效果 (放大动画)。
  - 支持便签切换、拖拽排序、右键菜单 (置顶、下载、复制、删除)。

## 5. 数据模型 (`types.ts`)

### MindNode (节点树)
```typescript
interface MindNode {
  id: string;
  text: string;
  children: MindNode[]; // 递归结构
  isRoot?: boolean;
  parentId?: string | null;
}
```

### Note (便签/文档)
每个便签包含一个完整的思维导图树 (`root`) 和视图状态 (`viewState`)。
```typescript
interface Note {
  id: string;
  title: string; // 通常同步根节点文本
  root: MindNode; 
  viewState: {
    x: number; y: number; k: number; // 画布变换状态
    focusedNodeId: string | null;
  };
  themeId: ThemeId;
}
```

## 6. 开发规范
1.  **语言**: 代码注释、文档、Commit Message 请使用 **简体中文**。
2.  **状态管理**: 尽量保持状态的不可变性 (Immutability)，修改树结构时应返回新对象而非修改原对象（参考 `utils/helpers.ts`）。
3.  **D3 集成**: 
    - D3 负责计算 (`calculateLayout`) 和全局事件 (`zoom`)。
    - React 负责渲染 DOM 元素。
    - 避免直接操作 DOM，除非是 D3 必须的 `select(ref).call(...)`。
4.  **样式**: 优先使用 Tailwind CSS 类名。涉及动态颜色计算时（如根据主题变化的边框），使用 `style` 属性。

## 7. 待办事项 / 已知问题
- AI 功能尚未集成 (GEMINI_API_KEY 已就绪)。
- 移动端适配待优化（目前主要针对桌面端）。
