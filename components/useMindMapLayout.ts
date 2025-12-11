import React, { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import * as d3 from 'd3';
import { MindNode, ViewState, Theme } from '../types';
import { getSmartBorderColor } from '../utils/helpers';

const NODE_HEIGHT = 50;
const MIN_NODE_WIDTH = 80;
const DURATION = 300;
const HORIZONTAL_GAP = 60;

interface useMindMapLayoutProps {
  internalData: MindNode;
  svgRef: React.RefObject<SVGSVGElement>;
  wrapperRef: React.RefObject<HTMLDivElement>;
  viewState: ViewState;
  theme: Theme;
  isSelecting: boolean;
  onViewStateChange: (newState: ViewState) => void;
}

export const useMindMapLayout = ({
  internalData,
  svgRef,
  wrapperRef,
  viewState,
  theme,
  isSelecting,
  onViewStateChange,
}: useMindMapLayoutProps) => {
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const viewStateRef = useRef(viewState);
  useEffect(() => {
    viewStateRef.current = viewState;
  }, [viewState]);

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

    const maxWidhtsPerDepth: { [key: number]: number } = {};
    root.descendants().forEach((d: any) => {
      const currentMax = maxWidhtsPerDepth[d.depth] || 0;
      if (d.width > currentMax) maxWidhtsPerDepth[d.depth] = d.width;
    });

    const depthOffsets: { [key: number]: number } = { 0: 0 };
    let currentOffset = 0;
    const maxDepth = Math.max(...root.descendants().map(d => d.depth));

    for (let i = 0; i < maxDepth; i++) {
      currentOffset += (maxWidhtsPerDepth[i] || MIN_NODE_WIDTH) + HORIZONTAL_GAP;
      depthOffsets[i + 1] = currentOffset;
    }

    root.descendants().forEach((d: any) => {
      d.y = depthOffsets[d.depth] || 0;
    });

    return root;
  }, [internalData]);

  const layoutNodes = calculateLayout().descendants() as any[];

  // --- Center View Logic ---
  const centerView = useCallback((targetId?: string | null, clearFocus = true, preserveScale = false) => {
    if (!wrapperRef.current || !svgRef.current || !zoomBehaviorRef.current) return;

    const root = calculateLayout();
    const idToFind = targetId || internalData.id;
    const targetNode = root.descendants().find((d: any) => d.data.id === idToFind) as any;

    if (!targetNode) return;

    const width = wrapperRef.current.clientWidth;
    const height = wrapperRef.current.clientHeight;

    const currentTransform = d3.zoomTransform(svgRef.current);
    const targetScale = preserveScale ? currentTransform.k : 1;

    const nodeScreenX = targetNode.y - 10;
    const nodeScreenY = targetNode.x - 40;
    const nodeW = targetNode.width + 20;
    const nodeH = 80;

    const nodeCenterX = nodeScreenX + nodeW / 2;
    const nodeCenterY = nodeScreenY + nodeH / 2;

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

  // --- Auto Pan for New Nodes ---
  const autoPan = useCallback((editingId: string | null) => {
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

    if (nodeX + nodeW > viewportW - padding) dx = viewportW - padding - (nodeX + nodeW);
    if (nodeX < padding) dx = padding - nodeX;
    if (nodeY + nodeH > viewportH - padding) dy = viewportH - padding - (nodeY + nodeH);
    if (nodeY < padding) dy = padding - nodeY;

    if (dx !== 0 || dy !== 0) {
      const newTransform = transform.translate(dx / transform.k, dy / transform.k);
      d3.select(svgRef.current)
        .transition().duration(300)
        .call(zoomBehaviorRef.current.transform, newTransform);
    }
  }, [calculateLayout]);


  // --- Zoom & Pan ---
  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    const g = svg.select<SVGGElement>('.mindmap-group');

    const zoomed = (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
      g.attr('transform', event.transform.toString());
      if (!isSelecting && event.sourceEvent) {
        onViewStateChange({
          ...viewStateRef.current,
          x: event.transform.x,
          y: event.transform.y,
          k: event.transform.k,
        });
      }
    };

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .filter((event) => {
        if (event.type === 'wheel') return true;
        if (event.button === 2 || event.button === 1) return true;
        if (event.type === 'touchstart') return true;
        return false;
      })
      .on('zoom', zoomed);

    zoomBehaviorRef.current = zoom;
    svg.call(zoom);

    const transform = d3.zoomIdentity.translate(viewState.x, viewState.y).scale(viewState.k);
    svg.call(zoom.transform, transform);

    svg.on("dblclick.zoom", null);

  }, [svgRef, internalData.id, isSelecting, onViewStateChange]);


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
      .attr('opacity', 1)
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
  }, [calculateLayout, theme, svgRef]);

  useLayoutEffect(() => {
    renderTreeLinks();
  }, [renderTreeLinks]);
  
  // Expose necessary values and functions
  return { layoutNodes, centerView, autoPan, zoomBehaviorRef };
};
