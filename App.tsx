import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Note, MindNode, ViewState, ThemeId } from './types';
import { createNewNote, noteToMarkdown, THEMES } from './utils/helpers';
import MindMap from './components/MindMap';
import Dock from './components/Dock';
import { Plus, Download, Copy, Trash2, Menu } from 'lucide-react';

const STORAGE_KEY = 'mindflow_notes_v1';
const ACTIVE_ID_KEY = 'mindflow_active_id';
const DEFAULT_THEME_KEY = 'mindflow_default_theme';
const DOCK_POS_KEY = 'mindflow_dock_pos';

const App: React.FC = () => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [defaultTheme, setDefaultTheme] = useState<ThemeId>('night');
  const [isDragOverNew, setIsDragOverNew] = useState(false);
  const [dockPosition, setDockPosition] = useState<'right' | 'bottom'>('right');

  // Load from Storage
  useEffect(() => {
    try {
      const savedNotesStr = localStorage.getItem(STORAGE_KEY);
      const savedActiveId = localStorage.getItem(ACTIVE_ID_KEY);
      const savedDefaultTheme = localStorage.getItem(DEFAULT_THEME_KEY) as ThemeId;
      const savedDockPos = localStorage.getItem(DOCK_POS_KEY) as 'right' | 'bottom';

      if (savedDockPos) {
          setDockPosition(savedDockPos);
      }

      if (savedDefaultTheme && THEMES[savedDefaultTheme]) {
          setDefaultTheme(savedDefaultTheme);
      }

      if (savedNotesStr) {
        const parsedNotes = JSON.parse(savedNotesStr);
        if (Array.isArray(parsedNotes) && parsedNotes.length > 0) {
            // Migration: Ensure notes have themeId if coming from old version
            const migratedNotes = parsedNotes.map((n: any) => ({
                ...n,
                themeId: n.themeId || 'night' 
            }));
            
            // Do NOT sort by updatedAt here to respect user's manual order or previous state
            setNotes(migratedNotes);
            
            if (savedActiveId && migratedNotes.some((n: Note) => n.id === savedActiveId)) {
                setActiveNoteId(savedActiveId);
            } else {
                setActiveNoteId(migratedNotes[0].id);
            }
        } else {
            // Empty array in storage
            initFirstNote();
        }
      } else {
         // No storage
         initFirstNote();
      }
    } catch (e) {
      console.error("Failed to load notes", e);
      initFirstNote();
    } finally {
      setIsLoading(false);
    }
  }, []);

  const initFirstNote = () => {
      const newNote = createNewNote(defaultTheme, window.innerWidth, window.innerHeight);
      setNotes([newNote]);
      setActiveNoteId(newNote.id);
  };

  // Auto Save - Strict dependency check and isLoading gate
  useEffect(() => {
    if (!isLoading) {
       localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
    }
  }, [notes, isLoading]);

  useEffect(() => {
    if (!isLoading && activeNoteId) {
        localStorage.setItem(ACTIVE_ID_KEY, activeNoteId);
    }
  }, [activeNoteId, isLoading]);

  useEffect(() => {
      localStorage.setItem(DEFAULT_THEME_KEY, defaultTheme);
  }, [defaultTheme]);

  useEffect(() => {
      localStorage.setItem(DOCK_POS_KEY, dockPosition);
  }, [dockPosition]);


  // Actions
  const handleCreateNote = (overrideTheme?: ThemeId) => {
    const themeToUse = overrideTheme || defaultTheme;
    // Pass screen dimensions to center the root
    const newNote = createNewNote(themeToUse, window.innerWidth, window.innerHeight);
    // Add to BEGINNING of array (Newest first)
    setNotes(prev => [newNote, ...prev]);
    setActiveNoteId(newNote.id);
  };

  const handleDeleteNote = (id?: string) => {
    const targetId = id || activeNoteId;
    if (!targetId) return;

    // Optional confirmation handled by caller or here
    if (!id && !confirm('确定要删除这个便签吗？')) return; // Confirm only for button click, context menu handles its own logic/assumption

    const newNotes = notes.filter(n => n.id !== targetId);
    setNotes(newNotes);
    
    // If we deleted the active note, switch to another one
    if (activeNoteId === targetId) {
        if (newNotes.length > 0) {
            setActiveNoteId(newNotes[0].id);
        } else {
            // Don't leave empty, create new immediately
            const newNote = createNewNote(defaultTheme, window.innerWidth, window.innerHeight);
            setNotes([newNote]);
            setActiveNoteId(newNote.id);
        }
    }
  };

  const handleUpdateNoteData = useCallback((newData: MindNode) => {
    setNotes(prev => prev.map(note => {
      if (note.id === activeNoteId) {
        return { 
            ...note, 
            root: newData, 
            title: newData.text || '未命名', 
            updatedAt: Date.now() 
        };
      }
      return note;
    }));
  }, [activeNoteId]);

  const handleUpdateViewState = useCallback((viewState: ViewState) => {
    setNotes(prev => prev.map(note => {
      if (note.id === activeNoteId) {
        return { ...note, viewState };
      }
      return note;
    }));
  }, [activeNoteId]);

  const handleThemeChange = (newThemeId: ThemeId) => {
      // If we click a theme bubble, update current note theme
      if (activeNoteId) {
          setNotes(prev => prev.map(note => {
              if (note.id === activeNoteId) {
                  return { ...note, themeId: newThemeId, themeColor: THEMES[newThemeId].buttonColor };
              }
              return note;
          }));
      }
  };

  // Dock Actions
  const handleReorderNotes = (fromIndex: number, toIndex: number) => {
      if (fromIndex === toIndex) return;
      setNotes(prev => {
          const result = [...prev];
          const [removed] = result.splice(fromIndex, 1);
          result.splice(toIndex, 0, removed);
          return result;
      });
  };

  const handlePinNote = (id: string) => {
      setNotes(prev => {
          const index = prev.findIndex(n => n.id === id);
          if (index <= 0) return prev;
          const result = [...prev];
          const [removed] = result.splice(index, 1);
          result.unshift(removed);
          return result;
      });
  };

  // Helper for context menu actions
  const getNoteActions = (id: string) => {
      const note = notes.find(n => n.id === id);
      return {
          download: () => {
              if (note) {
                const text = noteToMarkdown(note.root);
                const blob = new Blob([text], { type: 'text/markdown' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${note.title || 'note'}.md`;
                a.click();
              }
          },
          copy: () => {
              if (note) {
                  const text = noteToMarkdown(note.root);
                  navigator.clipboard.writeText(text);
              }
          },
          delete: () => handleDeleteNote(id),
          pin: () => handlePinNote(id)
      };
  };


  // Drag and Drop Logic (Create New)
  const handleDragStart = (e: React.DragEvent, themeId: ThemeId) => {
      e.dataTransfer.setData("themeId", themeId);
  };

  const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOverNew(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
      setIsDragOverNew(false);
  };

  const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOverNew(false);
      const themeId = e.dataTransfer.getData("themeId") as ThemeId;
      if (themeId && THEMES[themeId]) {
          setDefaultTheme(themeId);
          handleCreateNote(themeId);
      }
  };


  const handleCopyToClipboard = () => {
      const actions = activeNoteId ? getNoteActions(activeNoteId) : null;
      actions?.copy();
      if(actions) alert('已复制为 Markdown');
  };

  const handleDownloadMarkdown = () => {
     const actions = activeNoteId ? getNoteActions(activeNoteId) : null;
     actions?.download();
  };

  // derived
  const activeNote = notes.find(n => n.id === activeNoteId);
  const activeTheme = activeNote ? THEMES[activeNote.themeId] || THEMES['night'] : THEMES['night'];

  if (isLoading || !activeNote) return <div className="bg-neutral-900 w-screen h-screen"></div>;

  return (
    <div className="w-screen h-screen overflow-hidden relative font-sans transition-colors duration-500" style={{ backgroundColor: activeTheme.background }}>
      
      {/* Main Workspace */}
      <MindMap 
        key={activeNote.id} 
        data={activeNote.root} 
        viewState={activeNote.viewState}
        theme={activeTheme}
        isActive={true}
        onChange={handleUpdateNoteData}
        onViewStateChange={handleUpdateViewState}
      />

      {/* Top Left: New Note & Theme Selector */}
      <div className="fixed top-0 left-0 p-6 z-50 flex items-start gap-4 group/area">
         {/* New Button */}
         <div 
            className="relative"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
         >
            <button 
                onClick={() => handleCreateNote()}
                className={`
                    p-3 rounded-full shadow-lg transition-all duration-300 transform border border-white/20
                    ${isDragOverNew ? 'scale-125 ring-4 ring-white' : 'scale-90 opacity-0 group-hover/area:opacity-100 group-hover/area:scale-100'}
                `}
                style={{ 
                    backgroundColor: THEMES[defaultTheme].buttonColor,
                    color: '#fff' 
                }}
                title="新建便签 (拖拽主题球到此可修改默认主题并新建)"
            >
                <Plus size={32} strokeWidth={3} />
            </button>
         </div>

         {/* Theme Bubbles (Reveal on hover) */}
         <div className="flex gap-2 pt-2 opacity-0 -translate-x-10 group-hover/area:opacity-100 group-hover/area:translate-x-0 transition-all duration-500 delay-75">
            {Object.values(THEMES).map(theme => (
                <div 
                    key={theme.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, theme.id)}
                    onClick={() => handleThemeChange(theme.id)}
                    className="w-8 h-8 rounded-full cursor-grab active:cursor-grabbing border-2 border-white/20 hover:scale-110 transition-transform shadow-md"
                    style={{ backgroundColor: theme.buttonColor }}
                    title={`切换主题: ${theme.name} (拖拽我到+号可设为默认)`}
                />
            ))}
         </div>
      </div>

      {/* Top Right: Menu Actions (Current Note) */}
      <div className="fixed top-0 right-24 p-6 z-50 group flex gap-2">
         <div className="flex flex-col gap-2 opacity-0 group-hover:opacity-100 translate-y-[-10px] group-hover:translate-y-0 transition-all duration-300 delay-100 bg-black/20 backdrop-blur p-2 rounded-xl border border-white/10 shadow-xl">
            <button onClick={handleDownloadMarkdown} className="p-2 text-white/70 hover:text-sky-400 hover:bg-white/10 rounded transition" title="保存为 Markdown">
                <Download size={20} />
            </button>
            <button onClick={handleCopyToClipboard} className="p-2 text-white/70 hover:text-sky-400 hover:bg-white/10 rounded transition" title="复制文本">
                <Copy size={20} />
            </button>
            <div className="h-[1px] bg-white/10 my-1"></div>
            <button onClick={() => handleDeleteNote()} className="p-2 text-red-400 hover:text-red-300 hover:bg-red-900/30 rounded transition" title="删除便签">
                <Trash2 size={20} />
            </button>
         </div>
         <div className="opacity-0 group-hover:opacity-0 transition-opacity absolute right-4 top-4 pointer-events-none text-white/50">
             <Menu />
         </div>
      </div>

      {/* Dock */}
      <Dock 
        notes={notes} 
        activeNoteId={activeNoteId || ''} 
        onSelectNote={setActiveNoteId} 
        onReorder={handleReorderNotes}
        onAction={getNoteActions}
        position={dockPosition}
        onPositionChange={setDockPosition}
      />

    </div>
  );
};

export default App;