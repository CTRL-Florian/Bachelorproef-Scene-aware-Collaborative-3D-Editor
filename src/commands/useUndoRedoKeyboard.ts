import { useEffect, useCallback } from 'react';
import { useCommandHistory } from './useCommandHistory';

/**
 * Hook die keyboard shortcuts voor undo/redo registreert
 * Ctrl+Z = Undo
 * Ctrl+Y of Ctrl+Shift+Z = Redo
 */
export function useUndoRedoKeyboard() {
  const { undo, redo, canUndo, canRedo } = useCommandHistory();

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Negeer als we in een input veld zitten
    const target = event.target as HTMLElement;
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable
    ) {
      return;
    }

    // Ctrl+Z voor Undo (maar niet Shift)
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && !event.shiftKey) {
      event.preventDefault();
      event.stopPropagation();
      if (canUndo) {
        console.log('[UndoRedo] Executing undo');
        undo();
      } else {
        console.log('[UndoRedo] Cannot undo - no history');
      }
      return;
    }

    // Ctrl+Y of Ctrl+Shift+Z voor Redo
    if (
      ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') ||
      ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'z')
    ) {
      event.preventDefault();
      event.stopPropagation();
      if (canRedo) {
        console.log('[UndoRedo] Executing redo');
        redo();
      } else {
        console.log('[UndoRedo] Cannot redo - no forward history');
      }
      return;
    }
  }, [undo, redo, canUndo, canRedo]);

  useEffect(() => {
    // Gebruik capture phase om events te onderscheppen VOOR OrbitControls
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, [handleKeyDown]);
}
