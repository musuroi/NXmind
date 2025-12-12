import { MindNode, Note, Theme, ThemeId } from '../types';

// ---------------- 色彩算法工具 ----------------

// 计算对比色 (黑/白) - 基于 YIQ 亮度算法
export const getContrastingTextColor = (hex: string): string => {
  // 处理简写 hex
  const fullHex = hex.length === 4 ? '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3] : hex;
  const r = parseInt(fullHex.substring(1, 3), 16);
  const g = parseInt(fullHex.substring(3, 5), 16);
  const b = parseInt(fullHex.substring(5, 7), 16);
  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
  return yiq >= 128 ? '#000000' : '#ffffff';
};

// 调整颜色亮度 (amount > 0 变亮, amount < 0 变暗)
export const adjustColor = (hex: string, amount: number): string => {
  let usePound = false;
  if (hex[0] === "#") {
    hex = hex.slice(1);
    usePound = true;
  }
  const num = parseInt(hex, 16);
  let r = (num >> 16) + amount;
  if (r > 255) r = 255;
  else if (r < 0) r = 0;

  let b = ((num >> 8) & 0x00FF) + amount;
  if (b > 255) b = 255;
  else if (b < 0) b = 0;

  let g = (num & 0x0000FF) + amount;
  if (g > 255) g = 255;
  else if (g < 0) g = 0;

  return (usePound ? "#" : "") + (g | (b << 8) | (r << 16)).toString(16).padStart(6, '0');
};

// 获取智能边框色：如果是深色背景，则边框变亮；浅色背景，边框变暗
export const getSmartBorderColor = (hex: string): string => {
  const textColor = getContrastingTextColor(hex);
  // 如果文字是黑色，说明背景是浅色，边框应该加深 (-40)
  // 如果文字是白色，说明背景是深色，边框应该提亮 (+40)
  return textColor === '#000000' ? adjustColor(hex, -50) : adjustColor(hex, 50);
};


// ---------------- 主题定义 ----------------

export const THEMES: Record<ThemeId, Theme> = {
  dawn: {
    id: 'dawn',
    name: '晨曦',
    background: '#fef6e4', // 暖白
    lineColor: '#d6d3d1',  // 默认占位，实际会动态计算
    // 根 -> L1 -> L2 -> L3 -> L4 (循环)
    nodeColors: ['#f582ae', '#9DC5BB', '#17B890', '#5E807F', '#082D0F'], // 柔和糖果色
    textColor: '#1e293b',
    buttonColor: '#f87171' // Red-400
  },
  noon: {
    id: 'noon',
    name: '正午',
    background: '#ffffff',
    lineColor: '#e5e5e5',
    // 清新高亮色
    nodeColors: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'], // 强烈的纯色
    textColor: '#0f172a',
    buttonColor: '#3b82f6'
  },
  dusk: {
    id: 'dusk',
    name: '黄昏',
    background: '#4a1d1d', // 深红褐
    lineColor: '#7f1d1d',
    // 晚霞色系
    nodeColors: ['#fb923c', '#D5695B', '#c084fc', '#f472b6', '#fbbf24'],
    textColor: '#fff7ed',
    buttonColor: '#fb923c'
  },
  night: {
    id: 'night',
    name: '深夜',
    background: '#16161a', // slate-900
    lineColor: '#334155',
    // 赛博朋克深色系
    nodeColors: ['#1e3a8a', '#7f5af0', '#be185d', '#7A2026', '#0f766e'], // 深沉的宝石色
    textColor: '#e5e5e5',
    buttonColor: '#6366f1'
  },
  dream: {
    id: 'dream',
    name: '梦幻',
    background: '#2e1065', // violet-950
    lineColor: '#581c87',
    // 霓虹渐变感
    nodeColors: ['#d946ef', '#8b5cf6', '#6366f1', '#3b82f6', '#06b6d4'],
    textColor: '#fae8ff',
    buttonColor: '#d946ef'
  }
};

// 生成唯一ID
export const generateId = (): string => {
  return Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
};

// 获取确定性的颜色 (基于字符串hash) - 仍用于 Dock 图标
export const getDeterministicColor = (str: string): string => {
  const colors = [
    '#ef4444', '#f97316', '#eab308', '#22c55e',
    '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899',
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colors.length;
  return colors[index];
};

// 创建一个新的默认便签
// screenCenter is optional, used to center the initial view
export const createNewNote = (themeId: ThemeId = 'night', screenWidth = 0, screenHeight = 0): Note => {
  const rootId = generateId();

  // Calculate center if dimensions provided, otherwise 0,0
  const initialX = screenWidth > 0 ? screenWidth / 2 : 0;
  const initialY = screenHeight > 0 ? screenHeight / 2 : 0;
  const isPortrait = screenHeight > screenWidth;

  return {
    id: generateId(),
    title: '中心主题',
    root: {
      id: rootId,
      text: '中心主题',
      children: [],
      isRoot: true,
      parentId: null
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
    viewState: {
      x: initialX,
      y: initialY,
      k: 1,
      focusedNodeId: rootId,
      needsCentering: true,
      layout: isPortrait ? 'tree' : 'mindmap' // 竖屏默认使用树状图
    },
    themeColor: THEMES[themeId].buttonColor, // Use theme main color for dock icon
    themeId: themeId
  };
};

// 递归查找节点
export const findNodeById = (node: MindNode, id: string): MindNode | null => {
  if (node.id === id) return node;
  for (const child of node.children) {
    const found = findNodeById(child, id);
    if (found) return found;
  }
  return null;
};

// 递归查找父节点
export const findParentNode = (root: MindNode, childId: string): MindNode | null => {
  for (const child of root.children) {
    if (child.id === childId) return root;
    const found = findParentNode(child, childId);
    if (found) return found;
  }
  return null;
};

// 将树转换为 Markdown 列表
export const noteToMarkdown = (node: MindNode, level: number = 0): string => {
  const indent = '  '.repeat(level);
  const bullet = level === 0 ? '# ' : '- ';
  let md = `${indent}${bullet}${node.text}\n`;
  for (const child of node.children) {
    md += noteToMarkdown(child, level + 1);
  }
  return md;
};

// 检查是否是后代节点 (用于防止将节点拖入自己的子节点中)
export const isDescendant = (root: MindNode, targetId: string, potentialAncestorId: string): boolean => {
  if (targetId === potentialAncestorId) return true;

  const ancestor = findNodeById(root, potentialAncestorId);
  if (!ancestor) return false;

  const foundInDescendants = findNodeById(ancestor, targetId);
  return !!foundInDescendants;
};

// 移动节点逻辑 (单个)
export const moveNode = (
  root: MindNode,
  draggedId: string,
  targetId: string,
  position: 'inside' | 'prev' | 'next'
): MindNode => {
  if (draggedId === root.id) return root; // Cannot move root
  if (draggedId === targetId) return root; // Cannot move to self

  // 1. 查找被拖拽的节点数据 并 从树中移除
  let draggedNode: MindNode | null = null;

  const remove = (node: MindNode): MindNode => {
    const idx = node.children.findIndex(c => c.id === draggedId);
    if (idx !== -1) {
      draggedNode = node.children[idx]; // 捕获数据
      const newChildren = [...node.children];
      newChildren.splice(idx, 1); // 移除
      return { ...node, children: newChildren };
    }
    return { ...node, children: node.children.map(remove) };
  };

  const rootWithoutDragged = remove(root);
  if (!draggedNode) return root;

  // 2. 将节点插入到新位置
  const insert = (node: MindNode): MindNode => {
    if (position === 'inside') {
      if (node.id === targetId) {
        return { ...node, children: [...node.children, draggedNode!] };
      }
    }
    else {
      const idx = node.children.findIndex(c => c.id === targetId);
      if (idx !== -1) {
        const newChildren = [...node.children];
        const insertIndex = position === 'prev' ? idx : idx + 1;
        newChildren.splice(insertIndex, 0, draggedNode!);
        return { ...node, children: newChildren };
      }
    }
    return { ...node, children: node.children.map(insert) };
  };

  return insert(rootWithoutDragged);
};

// 批量移动节点逻辑 (仅支持移动到目标节点内部)
export const moveNodes = (
  root: MindNode,
  draggedIds: string[],
  targetId: string
): MindNode => {
  // 过滤无效操作
  const validIds = draggedIds.filter(id => {
    if (id === root.id) return false; // 根节点不可移
    if (id === targetId) return false; // 目标不能是自己
    // 目标不能是当前被拖拽节点的后代 (防止循环引用)
    if (isDescendant(root, targetId, id)) return false;
    return true;
  });

  if (validIds.length === 0) return root;

  // 1. 从树中移除所有选中的节点，并收集它们的数据
  let movedNodes: MindNode[] = [];

  // 使用递归移除函数，它需要能够一次性处理多个移除，
  // 或者我们简单地多次调用移除。鉴于树的不可变性，单次遍历移除更高效。
  // 但为了逻辑简单，我们先收集数据，再构建新树。

  const nodesMap = new Map<string, MindNode>();
  validIds.forEach(id => {
    const node = findNodeById(root, id);
    if (node) nodesMap.set(id, node);
  });

  if (nodesMap.size === 0) return root;

  const removeRecursive = (node: MindNode): MindNode => {
    // 过滤掉所有在 validIds 里的子节点
    const filteredChildren = node.children.filter(c => !nodesMap.has(c.id));

    // 如果子节点数量没变，说明当前层级没有要删除的，继续递归
    // 如果变了，说明删除了直接子节点
    // 对剩余的子节点继续递归，以防有嵌套的被选节点 (虽然UI上通常不会选父子，但逻辑要健壮)

    return {
      ...node,
      children: filteredChildren.map(removeRecursive)
    };
  };

  const rootWithoutNodes = removeRecursive(root);

  // 2. 将收集到的节点添加到目标节点 children 中
  const insertRecursive = (node: MindNode): MindNode => {
    if (node.id === targetId) {
      // 将所有被移动的节点加到这里
      // 注意：我们需要用之前保存的节点对象，但要确保它们的 children 也经过了 removeRecursive 处理?
      // 不，移动时，节点内部结构保持不变。
      // 唯一的问题是：如果选中了 A 和 A的子节点 B，
      // 上面的 removeRecursive 会把 A 和 B 都从原位置移除。
      // 插入时，如果我们把 A 和 B 平行插入到 Target，结构就平铺了。
      // 通常多选拖拽逻辑是：如果选中了父子，只拖动父，子随父动。

      // 修正逻辑：只移动“最顶层”的被选节点
      // 如果 validIds 中包含 id1 和 id2，且 id2 是 id1 的后代，则忽略 id2
      return {
        ...node,
        children: [...node.children, ...Array.from(nodesMap.values())]
      };
    }
    return {
      ...node,
      children: node.children.map(insertRecursive)
    };
  };

  // 优化：只移动顶层选区
  // 重新计算 nodesMap，移除那些祖先也在 validIds 里的节点
  const topLevelNodes: MindNode[] = [];
  nodesMap.forEach((node, id) => {
    let isChildOfSelection = false;
    // 向上查找父级是否也在 selection 中
    let curr = findParentNode(root, id); // 这是一个昂贵操作，但暂时可行
    while (curr) {
      if (validIds.includes(curr.id)) {
        isChildOfSelection = true;
        break;
      }
      curr = findParentNode(root, curr.id); // 继续向上
      if (curr?.id === root.id) break;
    }

    if (!isChildOfSelection) {
      topLevelNodes.push(node);
    }
  });

  // 重新执行移除，只移除 topLevelNodes
  const topLevelIds = new Set(topLevelNodes.map(n => n.id));

  const removeFinal = (node: MindNode): MindNode => {
    const filteredChildren = node.children.filter(c => !topLevelIds.has(c.id));
    return { ...node, children: filteredChildren.map(removeFinal) };
  };

  const rootCleaned = removeFinal(root);

  // 插入
  const insertFinal = (node: MindNode): MindNode => {
    if (node.id === targetId) {
      return { ...node, children: [...node.children, ...topLevelNodes] };
    }
    return { ...node, children: node.children.map(insertFinal) };
  };

  return insertFinal(rootCleaned);
};

// 复制节点逻辑 (单个，但包含所有子节点)
export const copyNode = (
  root: MindNode,
  sourceId: string,
  targetId: string,
  position: 'inside' | 'prev' | 'next'
): MindNode => {
  if (sourceId === targetId) return root; // 不能复制到自身

  // 1. 查找源节点数据
  const sourceNode = findNodeById(root, sourceId);
  if (!sourceNode) return root;

  // 2. 深度复制源节点，并为每个节点生成新 ID
  const cloneWithNewIds = (node: MindNode): MindNode => ({
    ...node,
    id: generateId(),
    children: node.children.map(cloneWithNewIds),
  });

  const copiedNode = cloneWithNewIds(sourceNode);

  // 3. 将复制的节点插入到新位置
  const insert = (node: MindNode): MindNode => {
    if (position === 'inside') {
      if (node.id === targetId) {
        return { ...node, children: [...node.children, copiedNode] };
      }
    } else {
      const idx = node.children.findIndex(c => c.id === targetId);
      if (idx !== -1) {
        const newChildren = [...node.children];
        const insertIndex = position === 'prev' ? idx : idx + 1;
        newChildren.splice(insertIndex, 0, copiedNode);
        return { ...node, children: newChildren };
      }
    }
    return { ...node, children: node.children.map(insert) };
  };

  return insert(root);
};