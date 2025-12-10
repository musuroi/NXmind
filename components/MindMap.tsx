import React, { useEffect, useRef, useState, useCallback, useLayoutEffect } from 'react';
import * as d3 from 'd3';
import { MindNode, ViewState, D3Node, Theme } from '../types';
import { generateId, findNodeById, findParentNode, getContrastingTextColor, getSmartBorderColor, moveNode, moveNodes, isDescendant } from '../utils/helpers';
import { useHistory } from '../utils/useHistory';

interface MindMapProps {
  data: MindNode;
  viewState: ViewState;
  theme: Theme;
  onChange: (newData: MindNode) => void;
  onViewStateChange: (newState: ViewState) => void;
  isActive: boolean;
}

interface DropTargetState {
  nodeId: string;
  position: 'inside' | 'prev' | 'next';
}

interface SelectionRect {
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
}

const NODE_HEIGHT = 50; 
const MIN_NODE_WIDTH = 80;
const DURATION = 300;
const HORIZONTAL_GAP = 60; 

// Helper: 根据鼠标在节点中的位置计算逻辑位置
const getDropPosition = (e: React.DragEvent, isRoot: boolean): 'inside' | 'prev' | 'next' => {
    if (isRoot) return 'inside';
    const rect = e.currentTarget.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    const height = rect.height;

    if (offsetY < height * 0.25) return 'prev';
    if (offsetY > height * 0.75) return 'next';
    return 'inside';
};

const MindMap: React.FC<MindMapProps> = ({ data, viewState, theme, onChange, onViewStateChange, isActive }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  
  const { 
      state: internalData, 
      set: setInternalDataWithHistory, 
      setSilent: setInternalDataSilent,
      undo, 
      redo 
  } = useHistory<MindNode>(data);

  const [editingId, setEditingId] = useState<string | null>(viewState.focusedNodeId);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Selection Box State
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionRect, setSelectionRect] = useState<SelectionRect | null>(null);

  // Drag & Drop State
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTargetState | null>(null);

  // Layout cache to help with selection calculation
  const layoutCache = useRef<any[]>([]);

  // Key press tracking for double-tap detection
  const lastKeyRef = useRef<{ key: string; time: number }>({ key: '', time: 0 });

  // Ref to hold the latest viewState to avoid stale closures in d3 callbacks
  const viewStateRef = useRef(viewState);
  useEffect(() => {
      viewStateRef.current = viewState;
  }, [viewState]);

  useEffect(() => {
      if (data.id !== internalData.id) {
          setInternalDataSilent(data);
      }
  }, [data.id]); 

  // Sync focusedNodeId to editingId but also handle selection
  useEffect(() => {
      setEditingId(viewState.focusedNodeId);
      if (viewState.focusedNodeId) {
          setSelectedIds(new Set([viewState.focusedNodeId]));
      }
  }, [viewState.focusedNodeId]);


  // --- Undo/Redo/Delete Shortcuts ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (!isActive) return;

        // Undo/Redo
        if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
            e.preventDefault();
            if (e.shiftKey) redo();
            else undo();
        } else if ((e.metaKey || e.ctrlKey) && (e.key === 'y')) {
             e.preventDefault();
             redo();
        } 
        
        // Batch Delete
        else if (e.key === 'Delete' || e.key === 'Backspace') {
             // 只有当没有正在编辑的输入框时，或者焦点不在输入框上时才删除
             const activeTag = document.activeElement?.tagName.toLowerCase();
             if (activeTag === 'input' || activeTag === 'textarea') return;

             if (selectedIds.size > 0) {
                 e.preventDefault();
                 batchDelete();
             }
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive, undo, redo, selectedIds, internalData]);

  // 当撤销/重做导致 internalData 变化时，通知父组件保存
  useEffect(() => {
      onChange(internalData);
  }, [internalData, onChange]);


  // --- Zoom & Pan ---
  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    const g = svg.select<SVGGElement>('.mindmap-group');

    const zoomed = (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
      g.attr('transform', event.transform.toString());
      // 只有在非框选状态下才更新 viewState，避免重渲染性能问题
      if (!isSelecting && event.sourceEvent) {
         onViewStateChange({
          ...viewStateRef.current, // Use the latest state from the ref
          x: event.transform.x,
          y: event.transform.y,
          k: event.transform.k,
        });
      }
    };

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      // 禁用左键拖拽平移，留给框选。只允许右键或中键平移，或滚轮缩放
      .filter((event) => {
          if (event.type === 'wheel') return true;
          // Right click (2) or Middle click (1) for panning
          if (event.button === 2 || event.button === 1) return true;
          // Allow touch drag
          if (event.type === 'touchstart') return true;
          return false;
      })
      .on('zoom', zoomed);
    
    zoomBehaviorRef.current = zoom;
    svg.call(zoom);
    
    const transform = d3.zoomIdentity.translate(viewState.x, viewState.y).scale(viewState.k);
    svg.call(zoom.transform, transform);
    
    svg.on("dblclick.zoom", null);

  }, [svgRef.current, data.id]); // data.id dependency ensures reset on load

  // --- D3 Layout Calculation ---
  const calculateLayout = useCallback(() => {
    const root = d3.hierarchy(internalData);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.font = '16px system-ui, -apple-system, sans-serif';

    root.descendants().forEach((d: any) => {
        const text = d.data.text || (d.data.isRoot ? "中心主题" : " ");
        const textMetrics = ctx ? ctx.measureText(text) : { width: 50 };
        d.width = Math.max(MIN_NODE_WIDTH, textMetrics.width + 50);
    });

    const treeLayout = d3.tree<MindNode>()
      .nodeSize([NODE_HEIGHT + 10, 0])
      .separation((a, b) => (a.parent === b.parent ? 1.1 : 1.25));

    treeLayout(root);

    const maxWidhtsPerDepth: {[key: number]: number} = {};
    root.descendants().forEach((d: any) => {
        const currentMax = maxWidhtsPerDepth[d.depth] || 0;
        if (d.width > currentMax) maxWidhtsPerDepth[d.depth] = d.width;
    });

    const depthOffsets: {[key: number]: number} = { 0: 0 };
    let currentOffset = 0;
    const maxDepth = Math.max(...root.descendants().map(d => d.depth));
    
    for (let i = 0; i < maxDepth; i++) {
        currentOffset += (maxWidhtsPerDepth[i] || MIN_NODE_WIDTH) + HORIZONTAL_GAP;
        depthOffsets[i + 1] = currentOffset;
    }

    root.descendants().forEach((d: any) => {
        d.y = depthOffsets[d.depth] || 0;
    });

    // Update Cache for selection calculation
    layoutCache.current = root.descendants();
    
    return root;
  }, [internalData]);

  // --- Center View Logic ---
    const centerView = useCallback((targetId?: string | null, clearFocus = true, preserveScale = false) => {
    if (!wrapperRef.current || !svgRef.current || !zoomBehaviorRef.current) return;
    
    const root = calculateLayout();
    // Default to root if no targetId provided
    const idToFind = targetId || internalData.id;
    const targetNode = root.descendants().find((d: any) => d.data.id === idToFind) as any;
    
    if (!targetNode) return;

    const width = wrapperRef.current.clientWidth;
    const height = wrapperRef.current.clientHeight;

    const currentTransform = d3.zoomTransform(svgRef.current);
    // Determine the target scale
    const targetScale = preserveScale ? currentTransform.k : 1;

    // Node: x=vertical, y=horizontal (D3 Tree)
    const nodeScreenX = targetNode.y - 10;
    const nodeScreenY = targetNode.x - 40;
    const nodeW = targetNode.width + 20;
    const nodeH = 80;

    // Center of the target node in its own coordinate system
    const nodeCenterX = nodeScreenX + nodeW / 2;
    const nodeCenterY = nodeScreenY + nodeH / 2;

    // Calculate new translation based on the target scale
    const targetX = (width / 2) - (nodeCenterX * targetScale);
    const targetY = (height / 2) - (nodeCenterY * targetScale);

    const transform = d3.zoomIdentity.translate(targetX, targetY).scale(targetScale);
    
    d3.select(svgRef.current)
      .transition().duration(500)
      .call(zoomBehaviorRef.current.transform, transform);

    onViewStateChange({
        x: targetX,
        y: targetY,
        k: targetScale,
        focusedNodeId: clearFocus ? null : (targetId || viewState.focusedNodeId),
        needsCentering: false
    });
  }, [calculateLayout, internalData.id, onViewStateChange, viewState.focusedNodeId]);

  // --- Reset View (ESC) ---
  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && isActive) {
            if (isSelecting) {
                setIsSelecting(false);
                setSelectionRect(null);
                return;
            }
            setSelectedIds(new Set());
            setEditingId(null);
            centerView(null, true); // Reset to Root and Clear Focus
        }
    };
    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, [isActive, isSelecting, centerView]);

  // --- Initial Centering ---
  useEffect(() => {
      if (viewState.needsCentering) {
          centerView(viewState.focusedNodeId, false); // Center on focused node if possible
      }
  }, [viewState.needsCentering, centerView, viewState.focusedNodeId]);

  // --- Input Caret Color Logic ---
  const handleInputSelect = (e: React.SyntheticEvent<HTMLInputElement>) => {
      const input = e.currentTarget;
      // Change caret color if at boundary to indicate navigation readiness
      if (input.selectionStart === 0 && input.selectionEnd === 0) {
          input.style.caretColor = '#f472b6'; // Pink-400 (Left Ready)
      } else if (input.selectionStart === input.value.length) {
          input.style.caretColor = '#22d3ee'; // Cyan-400 (Right Ready)
      } else {
          input.style.caretColor = ''; // Default (Inherit/White)
      }
  };

  // --- Auto Pan for New Nodes ---
  useEffect(() => {
      if (!editingId || !svgRef.current || !zoomBehaviorRef.current || !wrapperRef.current) return;
      
      const root = calculateLayout();
      const node = root.descendants().find((d: any) => d.data.id === editingId) as any;
      if (!node) return;

      const transform = d3.zoomTransform(svgRef.current);
      
      const nodeX = transform.applyX(node.y - 10);
      const nodeY = transform.applyY(node.x - 40);
      const nodeW = (node.width + 20) * transform.k;
      const nodeH = 80 * transform.k;
      
      const viewportW = wrapperRef.current.clientWidth;
      const viewportH = wrapperRef.current.clientHeight;
      const padding = 60;

      let dx = 0, dy = 0;

      if (nodeX + nodeW > viewportW - padding) {
          dx = viewportW - padding - (nodeX + nodeW);
      }
      if (nodeX < padding) {
          dx = padding - nodeX;
      }
      if (nodeY + nodeH > viewportH - padding) {
          dy = viewportH - padding - (nodeY + nodeH);
      }
      if (nodeY < padding) {
          dy = padding - nodeY;
      }

      if (dx !== 0 || dy !== 0) {
          const newTransform = transform.translate(dx / transform.k, dy / transform.k);
          d3.select(svgRef.current)
            .transition().duration(300)
            .call(zoomBehaviorRef.current.transform, newTransform);
      }
  }, [editingId, calculateLayout]);

  // --- D3 Render Links ---
  const renderTreeLinks = useCallback(() => {
    if (!svgRef.current) return;
    const root = calculateLayout();
    const g = d3.select(svgRef.current).select('.mindmap-group');
    const linkGroup = g.select('.links');

    const getNodeBaseColor = (depth: number) => theme.nodeColors[depth % theme.nodeColors.length];
    const getNodeBorderColor = (depth: number) => getSmartBorderColor(getNodeBaseColor(depth));

    const links = linkGroup.selectAll<SVGPathElement, d3.HierarchyPointLink<MindNode>>('path')
      .data(root.links(), (d) => d.target.data.id);

    links.enter()
      .append('path')
      .attr('d', d => {
        const o = { x: d.source.x, y: d.source.y }; 
        return `M${o.y},${o.x}C${o.y},${o.x} ${o.y},${o.x} ${o.y},${o.x}`; 
      })
      .attr('fill', 'none')
      .attr('stroke-width', 2)
      .merge(links as any)
      .transition().duration(DURATION)
      .attr('stroke', (d) => getNodeBorderColor(d.source.depth)) 
      .attr('opacity', 1) // Always 1, hiding logic handled in React nodes for cleaner drag
      .attr('d', d => {
         const sourceNode = d.source as any;
         const targetNode = d.target as any;
         const sx = sourceNode.y + sourceNode.width; 
         const sy = sourceNode.x; 
         const tx = targetNode.y; 
         const ty = targetNode.x;
         return `M${sx},${sy}C${(sx + tx) / 2},${sy} ${(sx + tx) / 2},${ty} ${tx},${ty}`;
      });

    links.exit().transition().duration(DURATION).attr('opacity', 0).remove();
  }, [calculateLayout, theme]); 

  useLayoutEffect(() => {
    renderTreeLinks();
  }, [renderTreeLinks]);

  // --- Data Mutation Handlers ---
  
  const handleTextChange = (id: string, newText: string) => {
      const updateText = (node: MindNode): MindNode => {
          if (node.id === id) return { ...node, text: newText };
          return { ...node, children: node.children.map(updateText) };
      };
      setInternalDataSilent(updateText(internalData));
  };

  const handleTextBlur = (id: string) => {
      setInternalDataWithHistory(internalData);
  };

  const addChild = (parentId: string) => {
    const newId = generateId();
    const newNode: MindNode = { id: newId, text: '', children: [] };
    const addToNode = (node: MindNode): MindNode => {
        if (node.id === parentId) return { ...node, children: [...node.children, newNode] };
        return { ...node, children: node.children.map(addToNode) };
    };
    const newData = addToNode(internalData);
    setInternalDataWithHistory(newData);
    setEditingId(newId);
    setSelectedIds(new Set([newId]));
    onViewStateChange({...viewState, focusedNodeId: newId});
  };

  const addSibling = (currentId: string) => {
    if (currentId === internalData.id) return; 
    const newId = generateId();
    const newNode: MindNode = { id: newId, text: '', children: [] };
    const addSib = (node: MindNode): MindNode => {
        if (node.children.some(c => c.id === currentId)) {
            const idx = node.children.findIndex(c => c.id === currentId);
            const newChildren = [...node.children];
            newChildren.splice(idx + 1, 0, newNode);
            return { ...node, children: newChildren };
        }
        return { ...node, children: node.children.map(addSib) };
    };
    const newData = addSib(internalData);
    setInternalDataWithHistory(newData);
    setEditingId(newId);
    setSelectedIds(new Set([newId]));
    onViewStateChange({...viewState, focusedNodeId: newId});
  };

  const deleteNode = (id: string, nextFocusId?: string) => {
      if (id === internalData.id) return;
      let parentId: string | null = null;
      const remove = (node: MindNode): MindNode => {
          if(node.children.some(c => c.id === id)) {
             parentId = node.id;
             return { ...node, children: node.children.filter(c => c.id !== id) };
          }
          return { ...node, children: node.children.map(remove) };
      };
      const newData = remove(internalData);
      setInternalDataWithHistory(newData);
      
      const targetId = nextFocusId || parentId;
      if (targetId) {
        setEditingId(targetId);
        setSelectedIds(new Set([targetId]));
        onViewStateChange({...viewState, focusedNodeId: targetId});
      }
  };

  const batchDelete = () => {
      const idsToDelete: string[] = Array.from(selectedIds);
      if (idsToDelete.includes(internalData.id)) {
          // Cannot delete root
          idsToDelete.splice(idsToDelete.indexOf(internalData.id), 1);
      }
      if (idsToDelete.length === 0) return;

      // Find a fallback node to focus (parent of the first deleted node)
      let fallbackId: string | null = null;
      if (idsToDelete.length > 0) {
          const firstId = idsToDelete[0];
          const parent = findParentNode(internalData, firstId);
          if (parent) fallbackId = parent.id;
      }

      const removeRecursive = (node: MindNode): MindNode => {
          return {
              ...node,
              children: node.children
                .filter(c => !idsToDelete.includes(c.id))
                .map(removeRecursive)
          };
      };
      
      const newData = removeRecursive(internalData);
      setInternalDataWithHistory(newData);
      setSelectedIds(new Set());
      
      if (fallbackId && findNodeById(newData, fallbackId)) {
          setEditingId(fallbackId);
          onViewStateChange({...viewState, focusedNodeId: fallbackId});
      } else {
          setEditingId(null);
      }
  };

  const handleKeyDown = (e: React.KeyboardEvent, nodeId: string) => {
      e.stopPropagation();
      
      const now = Date.now();
      const DOUBLE_TAP_DELAY = 300;
      
      // Helper to check double tap
      const isDoubleTap = (key: string) => {
          const isDt = lastKeyRef.current && 
                       lastKeyRef.current.key === key && 
                       (now - lastKeyRef.current.time) < DOUBLE_TAP_DELAY;
          lastKeyRef.current = { key, time: now };
          return isDt;
      };

      if (e.altKey && e.key === 'Enter') {
                      e.preventDefault();
           // Focus View on Current Node, preserving zoom
           centerView(nodeId, false, true);
      } else if (e.key === 'Tab') {
          e.preventDefault();
          if (e.repeat) return;
          addChild(nodeId);
      } else if (e.key === 'Enter') {
          e.preventDefault();
          addSibling(nodeId);
      } else if (e.key === 'Escape') {
          (e.target as HTMLInputElement).blur();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
          if (e.key === 'Delete') {
              e.preventDefault();
              const parent = findParentNode(internalData, nodeId);
              let nextFocusId: string | undefined;
              if (parent) {
                  const idx = parent.children.findIndex(c => c.id === nodeId);
                  if (idx > 0) {
                      nextFocusId = parent.children[idx - 1].id;
                  } else {
                      nextFocusId = parent.id;
                  }
              }
              deleteNode(nodeId, nextFocusId);
          }
            } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault();
          const currentNodeLayout = layoutCache.current.find(d => d.data.id === nodeId);
          if (!currentNodeLayout) return;

          const isUp = e.key === 'ArrowUp';
          
          // Find all potential candidates in the desired direction
          const candidates = layoutCache.current.filter(d => {
              if (d.data.id === nodeId) return false; // Exclude self
              // d.x is vertical position in D3 tree layout
              return isUp ? d.x < currentNodeLayout.x : d.x > currentNodeLayout.x;
          });

          if (candidates.length > 0) {
              let closestNode: any = null;
              let minDistanceSq = Infinity;

              // Find the geometrically closest node among the candidates
              candidates.forEach(d => {
                  const dx = d.y - currentNodeLayout.y; // Horizontal distance
                  const dy = d.x - currentNodeLayout.x; // Vertical distance
                  const distanceSq = dx * dx + dy * dy; // Using squared distance is faster

                  if (distanceSq < minDistanceSq) {
                      minDistanceSq = distanceSq;
                      closestNode = d;
                  }
              });

              if (closestNode) {
                  setEditingId(closestNode.data.id);
                  onViewStateChange({ ...viewState, focusedNodeId: closestNode.data.id });
              }
          }
      } else if (e.key === 'ArrowLeft') {
          const input = e.target as HTMLInputElement;
          // Only allow navigation if cursor is at the START (0)
          if (input.selectionStart === 0 && input.selectionEnd === 0) {
             if (isDoubleTap('ArrowLeft')) {
                 e.preventDefault();
                 const parent = findParentNode(internalData, nodeId);
                 if (parent) {
                     setEditingId(parent.id);
                     onViewStateChange({...viewState, focusedNodeId: parent.id});
                 }
             }
          } else {
              lastKeyRef.current = { key: '', time: 0 };
          }
      } else if (e.key === 'ArrowRight') {
          const input = e.target as HTMLInputElement;
          // Only allow navigation if cursor is at the END
          if (input.selectionStart === input.value.length) {
              if (isDoubleTap('ArrowRight')) {
                  e.preventDefault();
                  const node = findNodeById(internalData, nodeId);
                  if (node && node.children.length > 0) {
                      const child = node.children[0];
                      setEditingId(child.id);
                      onViewStateChange({...viewState, focusedNodeId: child.id});
                  }
              }
          } else {
              lastKeyRef.current = { key: '', time: 0 };
          }
      }
  };

  // --- Helper: 获取相对于容器的坐标 (修复跳变问题) ---
  const getLocalPoint = (e: React.MouseEvent) => {
      if (!wrapperRef.current) return { x: 0, y: 0 };
      const rect = wrapperRef.current.getBoundingClientRect();
      return {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top
      };
  };

  // --- Box Selection Handlers ---

  const handleMouseDown = (e: React.MouseEvent) => {
      if (e.button !== 0) return; // Only Left Click
      // 注意：点击节点时的冒泡会被节点上的 stopPropagation 阻止，
      // 所以这里的事件仅来自于点击背景画布。
      
      const { x, y } = getLocalPoint(e);
      
      setIsSelecting(true);
      setSelectionRect({
          startX: x,
          startY: y,
          currentX: x,
          currentY: y
      });
      // Clear selection if clicking background without Shift/Ctrl
      if (!e.shiftKey && !e.metaKey && !e.ctrlKey) {
          setSelectedIds(new Set());
          setEditingId(null);
      }
  };

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
      if (!isSelecting || !selectionRect) return;
      
      // 使用 getLocalPoint 替代 e.nativeEvent.offsetX，确保坐标系稳定
      const { x: currentX, y: currentY } = getLocalPoint(e);

      setSelectionRect(prev => prev ? ({ ...prev, currentX, currentY }) : null);

      // Calculate intersection
      const x = Math.min(selectionRect.startX, currentX);
      const y = Math.min(selectionRect.startY, currentY);
      const w = Math.abs(currentX - selectionRect.startX);
      const h = Math.abs(currentY - selectionRect.startY);

      // Transform Box from Screen Space to D3 Space? 
      // Easier: Transform Nodes from D3 Space to Screen Space
      const transform = d3.zoomTransform(svgRef.current!);
      const newSelected = new Set<string>();

      layoutCache.current.forEach((d: any) => {
          // Node D3 coordinates
          const nodeX = d.y - 10;
          const nodeY = d.x - 40;
          const nodeW = d.width + 20;
          const nodeH = 80;

          // Project to Screen Space
          const screenX = transform.applyX(nodeX);
          const screenY = transform.applyY(nodeY);
          const screenW = nodeW * transform.k;
          const screenH = nodeH * transform.k;

          // AABB Intersection
          if (
              x < screenX + screenW &&
              x + w > screenX &&
              y < screenY + screenH &&
              y + h > screenY
          ) {
              newSelected.add(d.data.id);
          }
      });
      
      setSelectedIds(newSelected);

  }, [isSelecting, selectionRect]);

  const handleMouseUp = () => {
      setIsSelecting(false);
      setSelectionRect(null);
  };


  // --- Drag & Drop Handlers ---
  
  const handleDragStart = (e: React.DragEvent, nodeId: string) => {
      e.stopPropagation(); 
      setDraggedNodeId(nodeId);
      
      // Check if we are dragging a selection group
      if (!selectedIds.has(nodeId)) {
          // If dragging an unselected node, select only it
          setSelectedIds(new Set([nodeId]));
          setEditingId(null);
      }

      e.dataTransfer.effectAllowed = 'move';
      const img = new Image();
      img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'; 
      e.dataTransfer.setDragImage(img, 0, 0);
  };

  const handleDragEnd = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDraggedNodeId(null);
      setDropTarget(null);
  };

  const handleDragOver = (e: React.DragEvent, targetId: string, isRoot: boolean) => {
      e.preventDefault(); 
      e.stopPropagation();
      
      if (!draggedNodeId) return;
      if (draggedNodeId === targetId) return;
      
      // Prevent dropping parent into child (Circular)
      if (isDescendant(internalData, targetId, draggedNodeId)) return; 

      // If Multi-Select Drag, force 'inside' logic (disable reordering)
      const isMultiDrag = selectedIds.size > 1;

      let pos: 'inside' | 'prev' | 'next';
      if (isMultiDrag) {
          pos = 'inside';
      } else {
          pos = getDropPosition(e, isRoot);
      }

      setDropTarget({ nodeId: targetId, position: pos });
  };

  const handleDrop = (e: React.DragEvent, targetId: string, isRoot: boolean) => {
      e.preventDefault();
      e.stopPropagation();

      const isMultiDrag = selectedIds.size > 1;
      const pos = isMultiDrag ? 'inside' : getDropPosition(e, isRoot);

      if (isMultiDrag) {
          // Batch Move
          const newData = moveNodes(internalData, Array.from(selectedIds), targetId);
          setInternalDataWithHistory(newData);
      } else if (draggedNodeId && draggedNodeId !== targetId) {
          // Single Move
          if (!isDescendant(internalData, targetId, draggedNodeId)) {
             const newData = moveNode(internalData, draggedNodeId, targetId, pos);
             setInternalDataWithHistory(newData); 
          }
      }
      setDraggedNodeId(null);
      setDropTarget(null);
  };

  // --- Click & Focus Logic ---
  
  const handleNodeClick = (e: React.MouseEvent, nodeId: string) => {
      e.stopPropagation();
      
      if (e.metaKey || e.ctrlKey) {
          // Toggle Selection
          setSelectedIds(prev => {
              const next = new Set(prev);
              if (next.has(nodeId)) next.delete(nodeId);
              else next.add(nodeId);
              return next;
          });
          setEditingId(null); // Disable editing when multi-selecting
      } else {
          // Single Select / Edit
          setEditingId(nodeId);
          setSelectedIds(new Set([nodeId]));
          onViewStateChange({...viewState, focusedNodeId: nodeId});
      }
  };

  const layoutNodes = calculateLayout().descendants() as any[];

  return (
    <div 
        ref={wrapperRef} 
        className="w-full h-full relative overflow-hidden select-none transition-colors duration-500" 
        style={{ backgroundColor: theme.background }}
        onContextMenu={(e) => e.preventDefault()}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
    >
      {/* 
        修复：移除 pointer-events-none，允许 D3 在 SVG 上捕获右键/中键事件。
        同时使用 absolute 定位确保与 div 重合
      */}
      <svg ref={svgRef} className="w-full h-full absolute top-0 left-0 cursor-default active:cursor-grabbing">
        <g className="mindmap-group pointer-events-auto">
          <g className="links"></g>
          <g className="nodes"></g>
          {layoutNodes.map((node) => {
             const isFocused = editingId === node.data.id;
             const isSelected = selectedIds.has(node.data.id);
             const isRoot = !!node.data.isRoot;
             const bgColor = theme.nodeColors[node.depth % theme.nodeColors.length];
             const borderColor = getSmartBorderColor(bgColor);
             const textColor = getContrastingTextColor(bgColor);
             const width = node.width;

             // Visual hiding for single drag
             let isHidden = false;
             if (selectedIds.size <= 1 && draggedNodeId === node.data.id) {
                 isHidden = true;
             }

             const isDropTarget = dropTarget?.nodeId === node.data.id;
             const dropPos = isDropTarget ? dropTarget?.position : null;

             return (
             <foreignObject
                key={node.data.id}
                x={node.y - 10} 
                y={node.x - 40} 
                width={width + 20}
                height={80} 
                className={`overflow-visible transition-opacity duration-300 ${isHidden ? 'opacity-20' : 'opacity-100'}`}
             >
                <div 
                    className="h-full flex items-center justify-center" 
                    draggable={!isRoot} 
                    onDragStart={(e) => handleDragStart(e, node.data.id)}
                    onDragEnd={handleDragEnd} 
                    onDragOver={(e) => handleDragOver(e, node.data.id, isRoot)}
                    onDrop={(e) => handleDrop(e, node.data.id, isRoot)} 
                    onClick={(e) => handleNodeClick(e, node.data.id)}
                    // 修复：阻止节点上的鼠标按下事件冒泡到父容器，防止触发框选
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    <div className={`
                        relative flex items-center justify-center px-4 py-2 rounded-lg shadow-sm transition-all duration-300 border
                        ${isFocused ? 'ring-2 ring-white scale-105 z-20 shadow-lg' : 'hover:scale-105 z-10 cursor-pointer'}
                        ${isSelected && !isFocused ? 'ring-2 ring-cyan-400 z-10' : ''}
                        ${isDropTarget && dropPos === 'inside' ? 'ring-4 ring-sky-400/70' : ''}
                    `}
                    style={{ 
                        backgroundColor: bgColor,
                        borderColor: borderColor,
                        width: `${width}px`,
                        minHeight: '40px'
                    }}
                    >
                        {isDropTarget && dropPos === 'prev' && (
                            <div className="absolute -top-3 left-0 right-0 h-1 bg-sky-400 rounded-full shadow-lg shadow-sky-400/50" />
                        )}
                        {isDropTarget && dropPos === 'next' && (
                            <div className="absolute -bottom-3 left-0 right-0 h-1 bg-sky-400 rounded-full shadow-lg shadow-sky-400/50" />
                        )}

                        <input 
                            value={node.data.text}
                            onChange={(e) => handleTextChange(node.data.id, e.target.value)}
                            onBlur={() => handleTextBlur(node.data.id)}
                            onKeyDown={(e) => handleKeyDown(e, node.data.id)}
                            onSelect={handleInputSelect}
                            onKeyUp={handleInputSelect}
                            onClick={handleInputSelect}
                            disabled={selectedIds.size > 1} // Disable input when multi-selected
                            className={`bg-transparent outline-none w-full text-center leading-tight placeholder-opacity-50 cursor-text ${selectedIds.size > 1 ? 'pointer-events-none' : ''}`}
                            style={{ 
                                color: textColor,
                                caretColor: textColor, // Will be overridden by inline style in handleInputSelect
                            }}
                            ref={(el) => {
                                if (el && isFocused && selectedIds.size === 1) {
                                    if (document.activeElement !== el) {
                                        el.focus({ preventScroll: true });
                                        // Update caret color initially if needed
                                        // But we can't easily trigger the event here without extra logic. 
                                        // Default is fine.
                                    }
                                }
                            }}
                            placeholder={isRoot ? "主题" : "节点"}
                        />
                    </div>
                </div>
             </foreignObject>
            );
          })}
        </g>
      </svg>
      
      {/* Selection Box Overlay */}
      {isSelecting && selectionRect && (
          <div 
             className="absolute bg-sky-500/20 border border-sky-400 z-50 pointer-events-none"
             style={{
                 left: Math.min(selectionRect.startX, selectionRect.currentX),
                 top: Math.min(selectionRect.startY, selectionRect.currentY),
                 width: Math.abs(selectionRect.currentX - selectionRect.startX),
                 height: Math.abs(selectionRect.currentY - selectionRect.startY),
             }}
          />
      )}
    </div>
  );
};

export default React.memo(MindMap);