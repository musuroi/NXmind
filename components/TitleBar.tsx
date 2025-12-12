import React, { useState, useEffect } from 'react';
import { Minus, Square, X, Pin, Maximize2, Minimize2, Settings } from 'lucide-react';
import { getCurrentWindow } from '@tauri-apps/api/window';

interface TitleBarProps {
    onOpenSettings: () => void;
    isAlwaysOnTop: boolean;
    toggleAlwaysOnTop: () => void;
}

export const TitleBar: React.FC<TitleBarProps> = ({ onOpenSettings, isAlwaysOnTop, toggleAlwaysOnTop }) => {
    const [isMaximized, setIsMaximized] = useState(false);

    useEffect(() => {
        const updateState = async () => {
            const win = getCurrentWindow();
            setIsMaximized(await win.isMaximized());
        };
        window.addEventListener('resize', updateState);
        return () => window.removeEventListener('resize', updateState);
    }, []);

    const handleMinimize = async () => {
        await getCurrentWindow().minimize();
    };

    const handleMaximize = async () => {
        const win = getCurrentWindow();
        await win.toggleMaximize();
        setIsMaximized(await win.isMaximized());
    };

    const handleClose = async () => {
        // Implement "Hide" behavior as requested for background running
        await getCurrentWindow().hide();
    };

    return (
        <div data-tauri-drag-region className="h-8 bg-neutral-900 flex justify-end items-center select-none fixed top-0 left-0 right-0 z-50 group border-b border-neutral-800/50">
            {/* Drag Region is implicit via CSS/Attribute, but we can make the whole bar draggable except buttons */}

            {/* Window Controls - Hidden by default, show on group hover as requested "mouse move up" */}
            <div className="flex items-center space-x-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <button
                    onClick={onOpenSettings}
                    className="p-1.5 hover:bg-neutral-800 rounded-md text-neutral-400 hover:text-white transition-colors"
                    title="设置"
                >
                    <Settings size={14} />
                </button>
                <button
                    onClick={toggleAlwaysOnTop}
                    className={`p-1.5 hover:bg-neutral-800 rounded-md transition-colors ${isAlwaysOnTop ? 'text-sky-400' : 'text-neutral-400'}`}
                    title="置顶 (Alt+Z)"
                >
                    <Pin size={14} />
                </button>
                <button
                    onClick={handleMaximize}
                    className="p-1.5 hover:bg-neutral-800 rounded-md text-neutral-400 hover:text-white transition-colors"
                    title="最大化"
                >
                    {isMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                </button>
                <button
                    onClick={handleClose}
                    className="p-1.5 hover:bg-red-500/20 hover:text-red-400 rounded-md text-neutral-400 transition-colors"
                    title="关闭 (后台运行)"
                >
                    <X size={14} />
                </button>
            </div>
        </div>
    );
};
