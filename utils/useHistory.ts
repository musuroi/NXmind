import { useState, useCallback } from 'react';

interface HistoryState<T> {
  past: T[];
  present: T;
  future: T[];
}

export function useHistory<T>(initialPresent: T) {
  const [state, setState] = useState<HistoryState<T>>({
    past: [],
    present: initialPresent,
    future: [],
  });

  const canUndo = state.past.length > 0;
  const canRedo = state.future.length > 0;

  const undo = useCallback(() => {
    setState((currentState) => {
      if (currentState.past.length === 0) return currentState;

      const previous = currentState.past[currentState.past.length - 1];
      const newPast = currentState.past.slice(0, currentState.past.length - 1);

      return {
        past: newPast,
        present: previous,
        future: [currentState.present, ...currentState.future],
      };
    });
  }, []);

  const redo = useCallback(() => {
    setState((currentState) => {
      if (currentState.future.length === 0) return currentState;

      const next = currentState.future[0];
      const newFuture = currentState.future.slice(1);

      return {
        past: [...currentState.past, currentState.present],
        present: next,
        future: newFuture,
      };
    });
  }, []);

  // 记录新状态 (添加到历史)
  const set = useCallback((newPresent: T) => {
    setState((currentState) => {
      if (currentState.present === newPresent) return currentState;
      return {
        past: [...currentState.past, currentState.present],
        present: newPresent,
        future: [], // 产生新历史时，清空 future
      };
    });
  }, []);

  // 静默更新 (不添加到历史，用于初始化或外部同步)
  const setSilent = useCallback((newPresent: T) => {
      setState(currentState => ({
          ...currentState,
          present: newPresent
      }));
  }, []);

  return {
    state: state.present,
    set,
    setSilent,
    undo,
    redo,
    canUndo,
    canRedo,
    historyState: state // 暴露完整状态以便调试或保存
  };
}