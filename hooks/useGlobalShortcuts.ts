import { useState, useEffect, useCallback, useRef } from 'react';
import { register, unregisterAll } from '@tauri-apps/plugin-global-shortcut';

interface Shortcuts {
    alwaysOnTop: string;
    toggleWindow: string;
}

const DEFAULT_SHORTCUTS: Shortcuts = {
    alwaysOnTop: 'Alt+Z',
    toggleWindow: 'Alt+Q'
};

export const useGlobalShortcuts = (
    onToggleAlwaysOnTop: () => void,
    onToggleWindow: () => void
) => {
    const [shortcuts, setShortcuts] = useState<Shortcuts>(() => {
        try {
            const saved = localStorage.getItem('mindflow_shortcuts');
            return saved ? { ...DEFAULT_SHORTCUTS, ...JSON.parse(saved) } : DEFAULT_SHORTCUTS;
        } catch {
            return DEFAULT_SHORTCUTS;
        }
    });

    // Refs to hold latest handlers to avoid re-registering when handlers change
    const handlersRef = useRef({ onToggleAlwaysOnTop, onToggleWindow });
    useEffect(() => {
        handlersRef.current = { onToggleAlwaysOnTop, onToggleWindow };
    }, [onToggleAlwaysOnTop, onToggleWindow]);

    const registerShortcuts = useCallback(async (currentShortcuts: Shortcuts) => {
        try {
            // Safe unregister before registering new ones
            await unregisterAll();

            console.log("Registering shortcuts:", currentShortcuts);

            // Register Always On Top
            await register(currentShortcuts.alwaysOnTop, (event) => {
                if (event.state === "Pressed") {
                    console.log("Shortcut Triggered: AlwaysOnTop");
                    handlersRef.current.onToggleAlwaysOnTop();
                }
            });

            // Register Toggle Window
            await register(currentShortcuts.toggleWindow, (event) => {
                if (event.state === "Pressed") {
                    console.log("Shortcut Triggered: ToggleWindow");
                    handlersRef.current.onToggleWindow();
                }
            });

            console.log("Global Shortcuts Registered Successfully:", currentShortcuts);

        } catch (e) {
            console.error("Failed to register shortcuts", e);
        }
    }, []);

    // Initial Registration
    useEffect(() => {
        registerShortcuts(shortcuts);
        // Clean up on unmount is removed to avoid StrictMode/HMR race conditions
        return () => { };
    }, []);

    const updateShortcut = async (key: keyof Shortcuts, newShortcut: string) => {
        if (newShortcut === shortcuts[key]) return;

        try {
            await unregisterAll();

            const nextShortcuts = { ...shortcuts, [key]: newShortcut };

            // Attempt registration with new shortcut
            await register(nextShortcuts.alwaysOnTop, (e) => {
                if (e.state === "Pressed") handlersRef.current.onToggleAlwaysOnTop();
            });
            await register(nextShortcuts.toggleWindow, (e) => {
                if (e.state === "Pressed") handlersRef.current.onToggleWindow();
            });

            // Success
            setShortcuts(nextShortcuts);
            localStorage.setItem('mindflow_shortcuts', JSON.stringify(nextShortcuts));

        } catch (e) {
            console.error("Shortcut conflict", e);
            // Revert to old shortcuts
            await registerShortcuts(shortcuts);
            throw e;
        }
    };

    return { shortcuts, updateShortcut };
};
