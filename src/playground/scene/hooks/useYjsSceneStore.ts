import { useState, useEffect } from 'react';
import * as Y from 'yjs';

export interface SceneObject {
  id: string;
  type: 'box' | 'sphere' | 'cylinder'; // Can be extended later
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  color: string;
  parentId?: string | null; // id van parent object
  childIds?: string[]; // ids van child objects
}

interface SceneState {
  objects: SceneObject[];
  selectedObjectId: string | null;
}

class YjsSceneStore {
  private ydoc: Y.Doc;
  private yobjects: Y.Map<any>;
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.ydoc = new Y.Doc();
    this.yobjects = this.ydoc.getMap('objects');

    // Initialize with a default box if empty
    if (this.yobjects.size === 0) {
      this.addObject('box-default', 'box', [0, 0, 0], [0, 0, 0], [1, 1, 1], 'orange');
    }

    // Subscribe to changes
    this.yobjects.observe(() => {
      this.notifyListeners();
    });
  }

  // Link een child aan een parent
  linkObject(childId: string, parentId: string) {
    const child = this.yobjects.get(childId);
    const parent = this.yobjects.get(parentId);
    if (!child || !parent) return;
    // Verwijder child uit oude parent
    if (child.parentId) {
      const oldParent = this.yobjects.get(child.parentId);
      if (oldParent && oldParent.childIds) {
        oldParent.childIds = oldParent.childIds.filter((id: string) => id !== childId);
        this.yobjects.set(child.parentId, oldParent);
      }
    }
    // Voeg toe aan nieuwe parent
    child.parentId = parentId;
    parent.childIds = parent.childIds || [];
    if (!parent.childIds.includes(childId)) parent.childIds.push(childId);
    this.yobjects.set(childId, child);
    this.yobjects.set(parentId, parent);
  }

  // Unlink een child van zijn parent
  unlinkObject(childId: string) {
    const child = this.yobjects.get(childId);
    if (!child || !child.parentId) return;
    const parent = this.yobjects.get(child.parentId);
    if (parent && parent.childIds) {
      parent.childIds = parent.childIds.filter((id: string) => id !== childId);
      this.yobjects.set(parent.id, parent);
    }
    child.parentId = null;
    this.yobjects.set(childId, child);
  }
  private notifyListeners() {
    this.listeners.forEach(listener => listener());
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  addObject(
    id: string,
    type: 'box' | 'sphere' | 'cylinder',
    position: [number, number, number],
    rotation: [number, number, number],
    scale: [number, number, number],
    color: string
  ) {
    const objectData = { id, type, position, rotation, scale, color };
    this.yobjects.set(id, objectData);
  }

  removeObject(id: string) {
    this.yobjects.delete(id);
  }

  updateObject(id: string, updates: Partial<SceneObject>) {
    const current = this.yobjects.get(id);
    if (current) {
      const updated = { ...current, ...updates };
      this.yobjects.set(id, updated);
    }
  }

  updateObjectPosition(id: string, position: [number, number, number]) {
    this.updateObject(id, { position });
  }

  updateObjectRotation(id: string, rotation: [number, number, number]) {
    this.updateObject(id, { rotation });
  }

  updateObjectScale(id: string, scale: [number, number, number]) {
    this.updateObject(id, { scale });
  }

  updateObjectColor(id: string, color: string) {
    this.updateObject(id, { color });
  }

  getObjects(): SceneObject[] {
    const objects: SceneObject[] = [];
    this.yobjects.forEach((value) => {
      objects.push(value as SceneObject);
    });
    return objects;
  }

  getObject(id: string): SceneObject | undefined {
    return this.yobjects.get(id);
  }

  getState(): SceneState {
    return {
      objects: this.getObjects(),
      selectedObjectId: null,
    };
  }
}

// Singleton instance
let storeInstance: YjsSceneStore | null = null;

function getYjsSceneStore(): YjsSceneStore {
  if (!storeInstance) {
    storeInstance = new YjsSceneStore();
  }
  return storeInstance;
}

// React hook for using the store
export function useYjsSceneStore() {
  const store = getYjsSceneStore();
  const [state, setState] = useState<SceneState>(store.getState());

  useEffect(() => {
    const unsubscribe = store.subscribe(() => {
      setState(store.getState());
    });

    return unsubscribe;
  }, []);

  return {
    state,
    addObject: store.addObject.bind(store),
    removeObject: store.removeObject.bind(store),
    updateObject: store.updateObject.bind(store),
    updateObjectPosition: store.updateObjectPosition.bind(store),
    updateObjectRotation: store.updateObjectRotation.bind(store),
    updateObjectScale: store.updateObjectScale.bind(store),
    updateObjectColor: store.updateObjectColor.bind(store),
    getObject: store.getObject.bind(store),
    linkObject: store.linkObject.bind(store),
    unlinkObject: store.unlinkObject.bind(store),
  };
}
