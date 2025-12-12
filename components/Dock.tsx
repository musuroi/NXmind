import React, { useRef, useState, useEffect } from 'react';
import { Note } from '../types';
import { GripHorizontal, GripVertical, Pin, Download, Copy, Trash2 } from 'lucide-react';

interface NoteActions {
    download: () => void;
    copy: () => void;
    delete: () => void;
    pin: () => void;
}

interface DockProps {
  notes: Note[];
  activeNoteId: string;
  onSelectNote: (id: string) => void;
  onReorder: (from: number, to: number) => void;
  onAction: (id: string) => NoteActions;
  position: 'right' | 'bottom';
  onPositionChange: (pos: 'right' | 'bottom') => void;
}

interface ContextMenuState {
    x: number;
    y: number;
    noteId: string;
}

const Dock: React.FC<DockProps> = ({ notes, activeNoteId, onSelectNote, onReorder, onAction, position, onPositionChange }) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  
  // Dock Position Dragging
  const [isDockDragging, setIsDockDragging] = useState(false);
  const [previewPos, setPreviewPos] = useState<'right' | 'bottom'>(position);

  // Item Dragging
  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);
  
  // Context Menu
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Auto Hide State
  const [isVisible, setIsVisible] = useState(false);
  // Intro Animation State
  const [showIntro, setShowIntro] = useState(true);
  
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initial Flash Logic
  useEffect(() => {
      const timer = setTimeout(() => {
          setShowIntro(false);
      }, 2000); // Keep visible for 2 seconds on mount
      return () => clearTimeout(timer);
  }, []);

  // Close context menu on global click
  useEffect(() => {
      const handleClick = (e: MouseEvent) => {
          if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
              setContextMenu(null);
          }
      };
      window.addEventListener('click', handleClick);
      return () => window.removeEventListener('click', handleClick);
  }, []);

  // Show logic
  const handleShow = () => {
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
      setIsVisible(true);
  };

  // Hide logic
  const handleHide = () => {
      hideTimeoutRef.current = setTimeout(() => {
          setIsVisible(false);
      }, 500); // 500ms delay
  };

  // Wheel event handler for horizontal scrolling when in bottom mode
  const handleWheel = (e: React.WheelEvent) => {
    if (position === 'bottom' && scrollContainerRef.current) {
        scrollContainerRef.current.scrollLeft += e.deltaY;
    }
  };

  // --- Dock Position Drag Logic ---
  const handleDockDragStart = (e: React.MouseEvent) => {
      e.preventDefault(); 
      setIsDockDragging(true);
      setPreviewPos(position);
  };

  useEffect(() => {
      const handleMouseMove = (e: MouseEvent) => {
          if (!isDockDragging) return;
          const { clientX, clientY } = e;
          const { innerWidth, innerHeight } = window;
          if (clientY > innerHeight * 0.85) setPreviewPos('bottom');
          else if (clientX > innerWidth * 0.8) setPreviewPos('right');
      };

      const handleMouseUp = () => {
          if (!isDockDragging) return;
          setIsDockDragging(false);
          onPositionChange(previewPos);
      };

      if (isDockDragging) {
          window.addEventListener('mousemove', handleMouseMove);
          window.addEventListener('mouseup', handleMouseUp);
          document.body.style.cursor = 'grabbing';
      } else {
          document.body.style.cursor = 'default';
      }

      return () => {
          window.removeEventListener('mousemove', handleMouseMove);
          window.removeEventListener('mouseup', handleMouseUp);
          document.body.style.cursor = 'default';
      };
  }, [isDockDragging, previewPos, onPositionChange]);


  // --- Item Reorder Drag Logic ---
  const handleItemDragStart = (e: React.DragEvent, index: number) => {
      e.stopPropagation();
      setDraggedItemIndex(index);
      e.dataTransfer.effectAllowed = 'move';
      // Set data mainly for firefox compatibility
      e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleItemDragOver = (e: React.DragEvent, index: number) => {
      e.preventDefault();
      if (draggedItemIndex === null || draggedItemIndex === index) return;
  };

  const handleItemDrop = (e: React.DragEvent, dropIndex: number) => {
      e.preventDefault();
      if (draggedItemIndex !== null) {
          onReorder(draggedItemIndex, dropIndex);
      }
      setDraggedItemIndex(null);
  };

  const handleItemDragEnd = () => {
      setDraggedItemIndex(null);
  };

  // --- Context Menu ---
  const handleContextMenu = (e: React.MouseEvent, noteId: string) => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({
          x: e.clientX,
          y: e.clientY,
          noteId
      });
  };

  const executeAction = (actionName: keyof NoteActions) => {
      if (!contextMenu) return;
      const actions = onAction(contextMenu.noteId);
      actions[actionName]();
      setContextMenu(null);
  };


  // --- Render ---

  const isRight = position === 'right';
  const containerClasses = isRight 
    ? "fixed right-4 top-0 bottom-0 flex flex-col justify-center items-end pointer-events-none z-40 transition-transform duration-300"
    : "fixed bottom-4 left-0 right-0 flex flex-row justify-center items-end pointer-events-none z-40 transition-transform duration-300";
    
  // Translation for auto-hide
  // Logic: Show if (hovered OR dragging OR menuOpen OR showIntro)
  const shouldShow = isVisible || isDockDragging || contextMenu || showIntro;

  const style = {
      transform: shouldShow
        ? 'none' 
        : (isRight ? 'translateX(120%)' : 'translateY(120%)')
  };

  const listClasses = isRight
    ? "pointer-events-auto flex flex-col items-center gap-3 bg-neutral-900/50 backdrop-blur-md border border-neutral-800 rounded-2xl py-2 px-2 shadow-2xl transition-all duration-300 max-h-[85vh] overflow-y-auto scrollbar-hide w-[4.5rem]"
    : "pointer-events-auto flex flex-row items-center gap-3 bg-neutral-900/50 backdrop-blur-md border border-neutral-800 rounded-2xl px-4 py-2 shadow-2xl transition-all duration-300 max-w-[85vw] overflow-x-auto scrollbar-hide h-[4.5rem]";

  const handleClasses = isRight
    ? "w-full h-6 flex items-center justify-center cursor-grab active:cursor-grabbing text-neutral-500 hover:text-neutral-300 mb-2 shrink-0"
    : "h-full w-6 flex items-center justify-center cursor-grab active:cursor-grabbing text-neutral-500 hover:text-neutral-300 mr-2 shrink-0";

  const SPACER_SIZE = 48; 

  return (
    <>
    {/* Sensor Zone for Auto-Hide */}
    <div 
        className={`fixed z-30 ${isRight ? 'right-0 top-0 bottom-0 w-8' : 'bottom-0 left-0 right-0 h-8'}`}
        onMouseEnter={handleShow}
        onMouseLeave={handleHide}
    />

    <div 
        className={containerClasses}
        style={style}
        onMouseEnter={handleShow}
        onMouseLeave={handleHide}
    >
      <div 
        ref={scrollContainerRef}
        className={listClasses}
        onMouseLeave={() => setHoveredIndex(null)}
        onWheel={handleWheel}
        style={{
             transform: isDockDragging && previewPos !== position 
                ? (position === 'right' ? 'translateY(20px) opacity-50' : 'translateY(-20px) opacity-50')
                : 'none'
        }}
      >
        {/* Dock Handle */}
        <div 
            className={handleClasses}
            onMouseDown={handleDockDragStart}
            title="拖动我改变 Dock 位置"
        >
            {isRight ? <GripHorizontal size={20} /> : <GripVertical size={20} />}
        </div>

        <div style={{ [isRight ? 'height' : 'width']: SPACER_SIZE, flexShrink: 0 }} />

        {/* Note List */}
        {notes.map((note, index) => {
            const isHovered = hoveredIndex === index;
            const isNeighbor = hoveredIndex !== null && Math.abs(hoveredIndex - index) === 1;
            const isBeingDragged = draggedItemIndex === index;
            
            let scale = 1;
            if (isHovered && !isBeingDragged) scale = 1.3;
            else if (isNeighbor && !isBeingDragged) scale = 1.1;

            return (
                <div
                    key={note.id}
                    draggable
                    onDragStart={(e) => handleItemDragStart(e, index)}
                    onDragOver={(e) => handleItemDragOver(e, index)}
                    onDrop={(e) => handleItemDrop(e, index)}
                    onDragEnd={handleItemDragEnd}
                    className={`relative shrink-0 transition-all duration-200 ease-out ${isBeingDragged ? 'opacity-30' : 'opacity-100'}`}
                    style={{
                        transform: `scale(${scale})`,
                        transformOrigin: isRight ? 'right center' : 'bottom center',
                        margin: isRight 
                            ? (isHovered ? '8px 0' : '0') 
                            : (isHovered ? '0 8px' : '0')
                    }}
                >
                    <button
                        onClick={() => onSelectNote(note.id)}
                        onMouseEnter={() => setHoveredIndex(index)}
                        onContextMenu={(e) => handleContextMenu(e, note.id)}
                        className="group relative block"
                    >
                        {/* Tooltip */}
                        <span 
                            className={`
                                absolute bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50
                                ${isRight 
                                    ? "right-full mr-3 top-1/2 -translate-y-1/2" 
                                    : "bottom-full mb-3 left-1/2 -translate-x-1/2"
                                }
                            `}
                        >
                            {note.title || 'Untitled'}
                        </span>
                        
                        {/* Icon */}
                        <div 
                            className={`
                                w-10 h-10 rounded-xl flex items-center justify-center shadow-lg transition-all
                                ${activeNoteId === note.id ? 'ring-2 ring-white' : ''}
                            `}
                            style={{ backgroundColor: note.themeColor }}
                        >
                            <span className="text-white font-bold text-sm select-none">
                                {note.title.substring(0, 1).toUpperCase() || '#'}
                            </span>
                        </div>
                    </button>
                </div>
            );
        })}

        <div style={{ [isRight ? 'height' : 'width']: SPACER_SIZE, flexShrink: 0 }} />
      </div>

      {/* Ghost Preview for Dock Position */}
      {isDockDragging && previewPos !== position && (
          <div className={`fixed z-30 border-2 border-dashed border-sky-400/50 rounded-2xl bg-sky-400/10 pointer-events-none transition-all duration-300
              ${previewPos === 'right' 
                  ? "right-4 top-1/2 -translate-y-1/2 w-[4.5rem] h-[50vh]" 
                  : "bottom-4 left-1/2 -translate-x-1/2 h-[4.5rem] w-[50vw]"
              }
          `}>
              <div className="w-full h-full flex items-center justify-center text-sky-400 font-bold">
                  {previewPos === 'right' ? '放置于右侧' : '放置于底部'}
              </div>
          </div>
      )}
    </div>

    {/* Context Menu Portal/Overlay */}
    {contextMenu && (
        <div 
            ref={contextMenuRef}
            className="fixed z-50 w-32 bg-neutral-900/90 backdrop-blur-md border border-white/10 rounded-lg shadow-xl overflow-hidden flex flex-col py-1 animate-in fade-in zoom-in-95 duration-100"
            style={{ 
                left: Math.min(contextMenu.x, window.innerWidth - 130), 
                top: Math.min(contextMenu.y, window.innerHeight - 150) 
            }}
        >
            <button onClick={() => executeAction('pin')} className="px-3 py-2 text-left text-sm text-white/80 hover:bg-white/10 flex items-center gap-2">
                <Pin size={14} /> 置顶
            </button>
            <div className="h-[1px] bg-white/10 my-1 mx-2" />
            <button onClick={() => executeAction('download')} className="px-3 py-2 text-left text-sm text-white/80 hover:bg-white/10 flex items-center gap-2">
                <Download size={14} /> 下载
            </button>
            <button onClick={() => executeAction('copy')} className="px-3 py-2 text-left text-sm text-white/80 hover:bg-white/10 flex items-center gap-2">
                <Copy size={14} /> 复制
            </button>
            <div className="h-[1px] bg-white/10 my-1 mx-2" />
            <button onClick={() => executeAction('delete')} className="px-3 py-2 text-left text-sm text-red-400 hover:bg-red-500/20 flex items-center gap-2">
                <Trash2 size={14} /> 删除
            </button>
        </div>
    )}

    <style>{`
          .scrollbar-hide::-webkit-scrollbar { display: none; }
          .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
    `}</style>
    </>
  );
};

export default Dock;