import { useState, useEffect, useCallback } from 'react';
import { getCommandManager } from './CommandManager';
import type { Command, CommandHistoryState } from './types';
import {
  AddObjectCommand,
  RemoveObjectCommand,
  MoveObjectCommand,
  RotateObjectCommand,
  ScaleObjectCommand,
  ColorObjectCommand,
  LinkObjectCommand,
  UnlinkObjectCommand,
  DuplicateObjectCommand,
} from './Commands';
import { sceneStore } from '@/playground/scene/hooks/useYjsSceneStore';

/**
 * React hook voor het command systeem met undo/redo
 */
export function useCommandHistory() {
  const manager = getCommandManager();
  const [state, setState] = useState<CommandHistoryState>(manager.getState());

  useEffect(() => {
    const unsubscribe = manager.subscribe(() => {
      setState(manager.getState());
    });
    return unsubscribe;
  }, [manager]);

  const execute = useCallback((command: Command) => {
    manager.execute(command);
  }, [manager]);

  const undo = useCallback(() => {
    return manager.undo();
  }, [manager]);

  const redo = useCallback(() => {
    return manager.redo();
  }, [manager]);

  const canUndo = manager.canUndo();
  const canRedo = manager.canRedo();
  const undoCount = manager.getUndoCount();
  const redoCount = manager.getRedoCount();
  const undoCommand = manager.getUndoCommand();
  const redoCommand = manager.getRedoCommand();

  return {
    // State
    history: state.history,
    currentIndex: state.currentIndex,
    
    // Actions
    execute,
    undo,
    redo,
    clear: () => manager.clear(),
    
    // Flags
    canUndo,
    canRedo,
    undoCount,
    redoCount,
    
    // Info
    undoCommand,
    redoCommand,
  };
}

/**
 * Hook die command-based versies van alle object manipulatie functies biedt
 * Dit vervangt useSceneObjectManipulation voor wanneer je undo/redo wilt
 */
export function useCommandBasedManipulation() {
  const { execute } = useCommandHistory();

  const addBox = useCallback((
    position: [number, number, number] = [0, 0, 0],
    color: string = 'orange'
  ): string => {
    const id = `box-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const command = new AddObjectCommand({
      objectId: id,
      objectType: 'box',
      position,
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      color,
    });
    execute(command);
    return id;
  }, [execute]);

  const moveObject = useCallback((
    id: string,
    newPosition: [number, number, number],
    mode: 'offset' | 'absolute' | 'relative' = 'absolute'
  ) => {
    const obj = sceneStore.getObject(id);
    if (!obj) return;
    
    let finalPosition: [number, number, number];
    if (mode === 'offset') {
      finalPosition = [
        obj.position[0] + newPosition[0],
        obj.position[1] + newPosition[1],
        obj.position[2] + newPosition[2],
      ];
    } else {
      finalPosition = newPosition;
    }
    
    const command = new MoveObjectCommand(
      id,
      obj.position,
      finalPosition,
      mode
    );
    execute(command);
  }, [execute]);

  const rotateObject = useCallback((
    id: string,
    newRotation: [number, number, number]
  ) => {
    const obj = sceneStore.getObject(id);
    if (!obj) return;
    
    const command = new RotateObjectCommand(
      id,
      obj.rotation,
      newRotation
    );
    execute(command);
  }, [execute]);

  const scaleObject = useCallback((
    id: string,
    newScale: [number, number, number]
  ) => {
    const obj = sceneStore.getObject(id);
    if (!obj) return;
    
    const command = new ScaleObjectCommand(
      id,
      obj.scale,
      newScale
    );
    execute(command);
  }, [execute]);

  const colorObject = useCallback((
    id: string,
    newColor: string
  ) => {
    const obj = sceneStore.getObject(id);
    if (!obj) return;
    
    const command = new ColorObjectCommand(
      id,
      obj.color,
      newColor
    );
    execute(command);
  }, [execute]);

  const deleteObject = useCallback((id: string) => {
    const command = new RemoveObjectCommand(id);
    execute(command);
  }, [execute]);

  const duplicateObject = useCallback((id: string): string | undefined => {
    const obj = sceneStore.getObject(id);
    if (!obj) return;
    
    const newId = `${obj.type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newPosition: [number, number, number] = [
      obj.position[0] + 2,
      obj.position[1],
      obj.position[2],
    ];
    
    const command = new DuplicateObjectCommand(id, newId, newPosition);
    execute(command);
    return newId;
  }, [execute]);

  const linkObject = useCallback((childId: string, parentId: string) => {
    const child = sceneStore.getObject(childId);
    if (!child) return;
    
    const command = new LinkObjectCommand(
      childId,
      parentId,
      child.parentId || null,
      child.position,
      child.rotation
    );
    execute(command);
  }, [execute]);

  const unlinkObject = useCallback((childId: string) => {
    const child = sceneStore.getObject(childId);
    if (!child || !child.parentId) return;
    
    const command = new UnlinkObjectCommand(
      childId,
      child.parentId,
      child.position,
      child.rotation
    );
    execute(command);
  }, [execute]);

  return {
    addBox,
    moveObject,
    rotateObject,
    scaleObject,
    colorObject,
    deleteObject,
    duplicateObject,
    linkObject,
    unlinkObject,
  };
}

// Re-export voor gemak
export { getCommandManager } from './CommandManager';
export type { Command, SerializedCommand, CommandHistoryState } from './types';
