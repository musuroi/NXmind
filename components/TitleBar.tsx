import React, { useState, useEffect } from 'react';
import { Minus, Square, X, Pin, Maximize2, Minimize2, Settings, HelpCircle } from 'lucide-react';
import { getCurrentWindow } from '@tauri-apps/api/window';

interface TitleBarProps {
    onOpenSettings: () => void;
    isAlwaysOnTop: boolean;
    toggleAlwaysOnTop: () => void;
    baseColor: string; // '#000000' or '#ffffff'
}

export const TitleBar: React.FC<TitleBarProps> = ({ onOpenSettings, isAlwaysOnTop, toggleAlwaysOnTop, baseColor }) => {
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
        await getCurrentWindow().hide();
    };

    // Helper for hover styles
    // Since we can't easily use Tailwind's `hover:` with dynamic colors for everything,
    // we use a group approach or simple opacity adjustments.
    // For "Muted", we use baseColor with opacity 0.6.
    // For Hover, we use baseColor with opacity 1 and a background bubble.

    const isDarkTheme = baseColor === '#ffffff';
    const hoverBg = isDarkTheme ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
    const iconColor = baseColor; // e.g. white or black

    // --------------------------------------------------------------------------------
    // Window Button Component (Internal)
    // --------------------------------------------------------------------------------
    // Purpose: 
    // 1. Hitbox: Large, touches top edge (and right edge for close btn). Handles Mouse Events.
    // 2. Visual: Circular background, centered (or margined) within Hitbox.
    // 3. Icon: Centered in visual.

    const WindowButton = ({
        icon: Icon,
        onClick,
        isClose = false,
        isActive = false,
        label,
        customColor // Optional override for active state
    }: { icon: any, onClick: () => void, isClose?: boolean, isActive?: boolean, label: string, customColor?: string }) => {

        // State for hover effect on the *Visual* layer
        const [isHovered, setIsHovered] = useState(false);

        // Styles
        const activeColor = customColor || (isDarkTheme ? '#38bdf8' : '#0284c7'); // Sky blue for active
        const currentColor = isActive ? activeColor : iconColor;

        // Hitbox Style
        // Standard: w-12 (48px) x h-10 (40px). 
        // Visual Circle: 32px.
        // If h-10, top gap? 
        // We want the hitbox to be flush top.
        // Let's use h-12 (48px) for comfortable top click.

        // For Close Button: Width extends to right edge.

        return (
            <div
                className={`relative group/btn flex items-start justify-center cursor-pointer ${isClose ? 'w-16' : 'w-12'} h-12`}
                onClick={onClick}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                title={label}
            >
                {/* 1. Hitbox Layer (Implicitly the container div, but we verify z-index if needed) */}
                {/* We just need to ensure this container is flush with top. 
                    The parent Flex container 'items-start' + 'top-0' ensures this starts at y=0.
                */}

                {/* 2. Visual Layer (Circle Base) */}
                {/* Centered horizontally. Top margin e.g., mt-2 to maintain design spacing. */}
                <div
                    className={`
                        mt-2 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200
                        ${isClose && isHovered ? 'bg-red-500' : ''}
                    `}
                    style={{
                        backgroundColor: !isClose && isHovered ? hoverBg : (isClose && isHovered ? undefined : 'transparent'),
                        // Close button turns red on hover, others transparent/tinted
                    }}
                >
                    {/* 3. Icon Layer */}
                    <Icon
                        size={20}
                        strokeWidth={1.5}
                        style={{
                            color: isClose && isHovered ? 'white' : currentColor,
                            opacity: isActive || isHovered ? 1 : 0.6 // Subtle when idle
                        }}
                    />
                </div>
            </div>
        );
    };

    return (
        <div className="h-0 fixed top-0 left-0 right-0 z-50 pointer-events-none select-none">
            {/* Drag Region - Center Handle */}
            <div className="absolute top-0 left-0 right-32 h-8 pointer-events-auto" data-tauri-drag-region />

            {/* Window Controls Container */}
            {/* fixed top-0 right-0. Flex row. items-start guarantees y=0 linkage. */}
            <div
                className="fixed top-0 right-0 flex items-start pointer-events-auto transition-opacity duration-300 opacity-0 hover:opacity-100"
                style={{
                    // Use a slightly larger hit area for the CONTAINER itself so users don't lose it easily
                    paddingBottom: '20px',
                    paddingLeft: '20px'
                }}
            >
                {/* Gap spacer if needed, or margin on first item */}

                {/* Settings */}
                <WindowButton
                    icon={Settings}
                    onClick={onOpenSettings}
                    label="设置"
                />

                {/* Pin */}
                {/* Pin */}
                <WindowButton
                    icon={Pin}
                    onClick={toggleAlwaysOnTop}
                    isActive={isAlwaysOnTop}
                    label="置顶 (Alt+Z)"
                />

                {/* Maximize */}
                <WindowButton
                    icon={isMaximized ? Minimize2 : Maximize2}
                    onClick={isMaximized ? handleMinimize : handleMaximize} // Wait, max/restore logic
                    // My handleVisualize logic was toggle. 
                    // Let's use standard toggle logic passed from parent or internal.
                    // The 'handleMaximize' function toggles.
                    label={isMaximized ? "还原" : "最大化"}
                />

                {/* Close */}
                <WindowButton
                    icon={X}
                    onClick={handleClose}
                    isClose={true}
                    label="关闭 (后台运行)"
                />
            </div>
        </div>
    );
};
