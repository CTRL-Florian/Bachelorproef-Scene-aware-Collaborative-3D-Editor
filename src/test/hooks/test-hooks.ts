/**
 * Test Hooks
 * 
 * Dit bestand voegt window functies toe die door E2E tests gebruikt kunnen worden
 * om de scene state te inspecteren en te manipuleren.
 * 
 * Deze functies worden alleen geladen in development/test mode.
 */

import { sceneStore } from '@/playground/scene/hooks/useYjsSceneStore';

declare global {
  interface Window {
    // Test hooks
    getSceneObjectCount: () => number;
    getSceneState: () => any;
    getSceneObjectById: (id: string) => any;
    isSceneReady: () => boolean;
    addTestBox: (position?: [number, number, number]) => string;
    removeTestObject: (id: string) => void;
    updateTestObjectPosition: (id: string, position: [number, number, number]) => void;
    updateTestObjectRotation: (id: string, rotation: [number, number, number]) => void;
    updateTestObjectScale: (id: string, scale: [number, number, number]) => void;
    updateTestObjectColor: (id: string, color: string) => void;
    resetCameraView: () => void;
  }
}

/**
 * Initialiseer test hooks op het window object
 */
export function initializeTestHooks(): void {
  // Check of we in development/test mode zijn
  if (import.meta.env.MODE === 'production') {
    return;
  }

  /**
   * Krijg het aantal scene objecten
   */
  window.getSceneObjectCount = () => {
    const objects = sceneStore.getObjects();
    return objects.length;
  };

  /**
   * Krijg de volledige scene state als JSON
   */
  window.getSceneState = () => {
    const objects = sceneStore.getObjects();
    return {
      objects: objects.map(obj => ({
        id: obj.id,
        type: obj.type,
        position: obj.position,
        rotation: obj.rotation,
        scale: obj.scale,
        color: obj.color,
        parentId: obj.parentId,
        childIds: obj.childIds,
      })),
      objectCount: objects.length,
    };
  };

  /**
   * Krijg een specifiek object by id
   */
  window.getSceneObjectById = (id: string) => {
    const obj = sceneStore.getObject(id);
    if (!obj) return null;
    return {
      id: obj.id,
      type: obj.type,
      position: obj.position,
      rotation: obj.rotation,
      scale: obj.scale,
      color: obj.color,
      parentId: obj.parentId,
      childIds: obj.childIds,
    };
  };

  /**
   * Check of de scene klaar is (Yjs is gesynct)
   */
  window.isSceneReady = () => {
    const provider = sceneStore.getProvider();
    return provider.synced;
  };

  /**
   * Voeg een test box toe
   */
  window.addTestBox = (position: [number, number, number] = [0, 0, 0]) => {
    const id = `test-box-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    sceneStore.addObject(id, 'box', position, [0, 0, 0], [1, 1, 1], '#FF6B6B');
    return id;
  };

  /**
   * Verwijder een test object
   */
  window.removeTestObject = (id: string) => {
    sceneStore.removeObject(id);
  };

  /**
   * Update positie van een test object
   */
  window.updateTestObjectPosition = (id: string, position: [number, number, number]) => {
    sceneStore.updateObjectPosition(id, position);
  };

  /**
   * Update rotatie van een test object
   */
  window.updateTestObjectRotation = (id: string, rotation: [number, number, number]) => {
    sceneStore.updateObjectRotation(id, rotation);
  };

  /**
   * Update schaal van een test object
   */
  window.updateTestObjectScale = (id: string, scale: [number, number, number]) => {
    sceneStore.updateObjectScale(id, scale);
  };

  /**
   * Update kleur van een test object
   */
  window.updateTestObjectColor = (id: string, color: string) => {
    sceneStore.updateObjectColor(id, color);
  };

  /**
   * Reset camera naar isometrische view (10, 10, 10)
   * Simuleert het drukken van de 'r' toets in de editor
   */
  window.resetCameraView = () => {
    const event = new KeyboardEvent('keydown', {
      key: 'r',
      bubbles: true,
    });
    document.dispatchEvent(event);
  };

  console.log('🧪 Test hooks initialized');
}
