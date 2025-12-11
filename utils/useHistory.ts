import { useState, useCallback, useRef } from 'react';

// Wrapper to track metadata
interface HistoryWrapper<T> {
  data: T;
  id: number;
  action: string;
  timestamp: number;
}

interface HistoryState<T> {
  past: HistoryWrapper<T>[];
  present: HistoryWrapper<T>;
  future: HistoryWrapper<T>[];
}

export function useHistory<T>(initialPresent: T) {
  // Global counter for history steps
  const historyCounter = useRef(0);

  const createWrapper = (data: T, action: string = 'Initial'): HistoryWrapper<T> => ({
    data,
    id: historyCounter.current++,
    action,
    timestamp: Date.now()
  });

  const [state, setState] = useState<HistoryState<T>>({
    past: [],
    present: createWrapper(initialPresent),
    future: [],
  });

  const canUndo = state.past.length > 0;
  const canRedo = state.future.length > 0;

  const undo = useCallback(() => {
    setState((currentState) => {
      if (currentState.past.length === 0) {
        console.log('[History] Undo: No past states.');
        return currentState;
      }

      const previous = currentState.past[currentState.past.length - 1];
      const newPast = currentState.past.slice(0, currentState.past.length - 1);

      console.log(`[History] Undo: Reverting "${currentState.present.action}" (ID: ${currentState.present.id}) -> "${previous.action}" (ID: ${previous.id})`);

      return {
        past: newPast,
        present: previous,
        future: [currentState.present, ...currentState.future],
      };
    });
  }, []);

  const redo = useCallback(() => {
    setState((currentState) => {
      if (currentState.future.length === 0) {
        console.log('[History] Redo: No future states.');
        return currentState;
      }

      const next = currentState.future[0];
      const newFuture = currentState.future.slice(1);

      console.log(`[History] Redo: Restoring "${next.action}" (ID: ${next.id})`);

      return {
        past: [...currentState.past, currentState.present],
        present: next,
        future: newFuture,
      };
    });
  }, []);

  // Record new state with action description
  const set = useCallback((newPresent: T, action: string = 'Update') => {
    // Generate Metadata OUTSIDE setState (Side Effect)
    const nextId = historyCounter.current++;
    const timestamp = Date.now();
    const nextWrapper = {
      data: newPresent,
      id: nextId,
      action,
      timestamp
    };

    console.log(`[History] Action: "${action}" (ID: ${nextId})`);

    setState((currentState) => {
      // Purity Check: If data hasn't changed, return exact same state object
      if (currentState.present.data === newPresent) return currentState;

      return {
        past: [...currentState.past, currentState.present],
        present: nextWrapper,
        future: [], // Clear future on new branch
      };
    });
  }, []);

  // Manual push for granular control (e.g. debounced text edits)
  // We need to match the signature expected by logic: pushStateManual(newData, oldDataSnapshot, action)
  // Converting oldDataSnapshot to a wrapper on the fly is tricky if we lost its ID.
  // Ideally, useMindMapInteraction shouldn't manage `lastCommittedData` as raw T, but as the wrapper?
  // Or we just create a synthetic wrapper for the 'past' entry if strictly needed, 
  // BUT ensuring the ID continuity is better.
  // However, simpler approach to fit existing logic: 
  // We assume the `pastSnapshot` passed in VALIDLY represents the `currentState.present` (or what it WAS).
  // Actually, standard `set` pushes `currentState.present` to `past`.
  // `pushStateManual` was forcing a specific `past` state.
  // Let's adapt: The "pastSnapshot" argument in previous code was `lastCommittedData.current`.
  // If we want to maintain the chain, `lastCommittedData` should probably just be the data, and we wrap it.
  // We will generate a new ID for the snapshot if needed, or arguably we should have stored the wrapper.
  // For now, let's treat the snapshot as a "previous state" that we are committing to history just now.

  const pushStateManual = useCallback((newPresent: T, pastSnapshotData: T, action: string = 'Manual Update') => {
    setState(currentState => {
      // We construct a wrapper for the past snapshot. 
      // Note: Ideally this snapshot *was* the state at some point.
      // If we assign a new ID, it might break the "Traceability" if we really care about exact ID continuity.
      // But for preventing data loss, it works.
      // Better: `pastSnapshot` is just the data of what `present` effectively WAS before this change.

      const pastWrapper = {
        data: pastSnapshotData,
        id: historyCounter.current++, // This might be confusing if we retroactively create history
        action: `Snapshot for ${action}`,
        timestamp: Date.now()
      };

      const nextWrapper = {
        data: newPresent,
        id: historyCounter.current++,
        action,
        timestamp: Date.now()
      };

      console.log(`[History] Manual Push: "${action}" (ID: ${nextWrapper.id}), Snapshotting Prev (ID: ${pastWrapper.id})`);

      return {
        past: [...currentState.past, pastWrapper],
        present: nextWrapper,
        future: []
      };
    });
  }, []);

  const setSilent = useCallback((newPresent: T) => {
    setState(currentState => ({
      ...currentState,
      present: {
        ...currentState.present,
        data: newPresent,
        // We keep the ID/Action of the current "frame" even if content changes silently? 
        // Or update data but keep ID? 
        // Usually silent update is "transient". 
        // Let's keep ID to allow stable reference, or creates new "Transient" wrapper?
        // If we keep ID, it means "Step 5" changed content.
      }
    }));
  }, []);

  return {
    state: state.present.data, // Expose raw data
    currentMeta: state.present, // Expose metadata (optional)
    set,
    setSilent,
    pushStateManual,
    undo,
    redo,
    canUndo,
    canRedo,
    historyState: state
  };
}