import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { MindNode, ViewState, Theme } from '../types';
import { getContrastingTextColor, getSmartBorderColor } from '../utils/helpers';
import { useMindMapLayout } from './useMindMapLayout';
import { useMindMapInteraction } from './useMindMapInteraction';


interface MindMapProps {
  data: MindNode;
  viewState: ViewState;
  theme: Theme;
  onChange: (newData: MindNode) => void;
  onViewStateChange: (newState: ViewState) => void;
  isActive: boolean;
}

const MindMap: React.FC<MindMapProps> = ({ data, viewState, theme, onChange, onViewStateChange, isActive }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const layoutCache = useRef<any[]>([]);

  const {
    layoutNodes,
    centerView,
    autoPan
  } = useMindMapLayout({
    internalData: data, // Interaction hook will manage the state, layout just needs data
    svgRef,
    wrapperRef,
    viewState,
    theme,
    isSelecting: false, // Will get this from interaction hook
    onViewStateChange,
  });

  // Update layout cache when nodes change
  useEffect(() => {
    layoutCache.current = layoutNodes;
  }, [layoutNodes]);

  const {
    internalData,
    editingId,
    selectedIds,
    isSelecting,
    selectionRect,
    draggedNodeId,
    dropTarget,
    handleTextChange,
    handleTextBlur,
    handleInputKeyDown,
    handleInputDoubleClick,
    handleInputSelect,
    handleNodeClick,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDrop,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,


  } = useMindMapInteraction({
    data,
    viewState,
    isActive,
    onChange,
    onViewStateChange,
    centerView,
    autoPan,
    wrapperRef,
    svgRef,
    layoutCache,
  });

  // Recalculate layout based on the state from the interaction hook
  const { layoutNodes: currentLayoutNodes } = useMindMapLayout({
    internalData, // Use the state managed by the interaction hook
    svgRef,
    wrapperRef,
    viewState,
    theme,
    isSelecting, // Pass the actual isSelecting state
    onViewStateChange,
  });

  // --- Initial Centering ---
  useEffect(() => {
    if (viewState.needsCentering) {
      centerView(viewState.focusedNodeId, false);
    }
  }, [viewState.needsCentering, centerView, viewState.focusedNodeId]);


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
      <svg ref={svgRef} className="w-full h-full absolute top-0 left-0 cursor-default active:cursor-grabbing">
        <g className="mindmap-group pointer-events-auto">
          <g className="links"></g>
          <g className="nodes"></g>
          {currentLayoutNodes.map((node) => {
            const isFocused = editingId === node.data.id;
            const isSelected = selectedIds.has(node.data.id);
            const isRoot = !!node.data.isRoot;
            const bgColor = theme.nodeColors[node.depth % theme.nodeColors.length];
            const borderColor = getSmartBorderColor(bgColor);
            const textColor = getContrastingTextColor(bgColor);
            const width = node.width;

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
                      onBlur={() => handleTextBlur()}
                      onKeyDown={(e) => handleInputKeyDown(e, node.data.id)}
                      onDoubleClick={handleInputDoubleClick}
                      onSelect={handleInputSelect}
                      onKeyUp={handleInputSelect}
                      onClick={handleInputSelect}
                      disabled={selectedIds.size > 1}
                      className={`bg-transparent outline-none w-full text-center leading-tight placeholder-opacity-50 cursor-text ${selectedIds.size > 1 ? 'pointer-events-none' : ''}`}
                      style={{
                        color: textColor,
                        caretColor: textColor,
                      }}
                      ref={(el) => {
                        if (el && isFocused && selectedIds.size === 1) {
                          if (document.activeElement !== el) {
                            el.focus({ preventScroll: true });
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
