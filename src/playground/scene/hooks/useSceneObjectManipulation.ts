import { useYjsSceneStore } from './useYjsSceneStore';

/**
 * Hook for easy object creation and manipulation
 */
export function useSceneObjectManipulation() {
  const store = useYjsSceneStore();

  return {
    addBox: (position: [number, number, number] = [0, 0, 0], color: string = 'orange') => {
      const id = `box-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      store.addObject(id, 'box', position, [0, 0, 0], [1, 1, 1], color);
      return id;
    },

    moveObject: (id: string, position: [number, number, number]) => {
      store.updateObjectPosition(id, position);
    },

    rotateObject: (id: string, rotation: [number, number, number]) => {
      store.updateObjectRotation(id, rotation);
    },

    scaleObject: (id: string, scale: [number, number, number]) => {
      store.updateObjectScale(id, scale);
    },

    colorObject: (id: string, color: string) => {
      store.updateObjectColor(id, color);
    },

    deleteObject: (id: string) => {
      store.removeObject(id);
    },

    duplicateObject: (id: string) => {
      const obj = store.getObject(id);
      if (obj) {
        const newId = `${obj.type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        store.addObject(
          newId,
          obj.type,
          [obj.position[0] + 2, obj.position[1], obj.position[2]],
          obj.rotation,
          obj.scale,
          obj.color
        );
        return newId;
      }
    },
  };
}
