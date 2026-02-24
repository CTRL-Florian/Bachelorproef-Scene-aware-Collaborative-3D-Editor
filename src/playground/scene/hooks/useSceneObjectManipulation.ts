import { useYjsSceneStore, sceneStore } from './useYjsSceneStore';
import { getCommandManager } from '@/commands';
import {
  AddObjectCommand,
  RemoveObjectCommand,
  MoveObjectCommand,
  RotateObjectCommand,
  ScaleObjectCommand,
  ColorObjectCommand,
  DuplicateObjectCommand,
} from '@/commands';

/**
 * Hook for easy object creation and manipulation
 * Nu met Command Pattern voor undo/redo support
 */
export function useSceneObjectManipulation() {
  const store = useYjsSceneStore();
  const commandManager = getCommandManager();

  return {
    addBox: (position: [number, number, number] = [0, 0, 0], color: string = 'orange') => {
      const id = `box-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const command = new AddObjectCommand({
        objectId: id,
        objectType: 'box',
        position,
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        color,
      });
      commandManager.execute(command);
      return id;
    },

    moveObject: (id: string, position: [number, number, number]) => {
      const obj = sceneStore.getObject(id);
      if (!obj) return;
      
      const command = new MoveObjectCommand(
        id,
        obj.position,
        position,
        'absolute'
      );
      commandManager.execute(command);
    },

    rotateObject: (id: string, rotation: [number, number, number]) => {
      const obj = sceneStore.getObject(id);
      if (!obj) return;
      
      const command = new RotateObjectCommand(
        id,
        obj.rotation,
        rotation
      );
      commandManager.execute(command);
    },

    scaleObject: (id: string, scale: [number, number, number]) => {
      const obj = sceneStore.getObject(id);
      if (!obj) return;
      
      const command = new ScaleObjectCommand(
        id,
        obj.scale,
        scale
      );
      commandManager.execute(command);
    },

    colorObject: (id: string, color: string) => {
      const obj = sceneStore.getObject(id);
      if (!obj) return;
      
      const command = new ColorObjectCommand(
        id,
        obj.color,
        color
      );
      commandManager.execute(command);
    },

    deleteObject: (id: string) => {
      const command = new RemoveObjectCommand(id);
      commandManager.execute(command);
    },

    duplicateObject: (id: string) => {
      const obj = store.getObject(id);
      if (obj) {
        const newId = `${obj.type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const newPosition: [number, number, number] = [
          obj.position[0] + 2,
          obj.position[1],
          obj.position[2],
        ];
        
        const command = new DuplicateObjectCommand(id, newId, newPosition);
        commandManager.execute(command);
        return newId;
      }
    },
  };
}
