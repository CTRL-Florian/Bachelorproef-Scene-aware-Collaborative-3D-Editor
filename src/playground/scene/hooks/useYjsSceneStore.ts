import { useState, useEffect } from 'react';
import * as Y from 'yjs';
import { mat4, vec3 } from 'gl-matrix';

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

  // Helper: bouw een map van alle objecten
  private getObjectMap(): Record<string, SceneObject> {
    const map: Record<string, SceneObject> = {};
    this.yobjects.forEach((value, key) => {
      map[key] = value as SceneObject;
    });
    return map;
  }

  // Helper: bereken de lokale transformatiematrix van een object
  private getLocalMatrix(obj: SceneObject): mat4 {
    const matrix = mat4.create();
    mat4.translate(matrix, matrix, obj.position);
    mat4.rotateX(matrix, matrix, obj.rotation[0]);
    mat4.rotateY(matrix, matrix, obj.rotation[1]);
    mat4.rotateZ(matrix, matrix, obj.rotation[2]);
    return matrix;
  }

  // Helper: bereken de wereldmatrix van een object (recursief via parents)
  private getWorldMatrix(obj: SceneObject, allObjects: Record<string, SceneObject>): mat4 {
    const localMatrix = this.getLocalMatrix(obj);
    if (obj.parentId && allObjects[obj.parentId]) {
      const parentMatrix = this.getWorldMatrix(allObjects[obj.parentId], allObjects);
      const result = mat4.create();
      mat4.multiply(result, parentMatrix, localMatrix);
      return result;
    }
    return localMatrix;
  }

  // Link een child aan een parent
  linkObject(childId: string, parentId: string) {
    const child = this.yobjects.get(childId);
    const parent = this.yobjects.get(parentId);
    if (!child || !parent) return;

    const allObjects = this.getObjectMap();

    // Bereken de huidige wereldmatrix van de child
    const childWorldMatrix = this.getWorldMatrix(child, allObjects);
    const childWorldPos: vec3 = [childWorldMatrix[12], childWorldMatrix[13], childWorldMatrix[14]];

    // Bereken de wereldmatrix van de nieuwe parent
    const parentWorldMatrix = this.getWorldMatrix(parent, allObjects);

    // Inverteer de parent wereldmatrix om van wereld naar lokaal te gaan
    const parentWorldMatrixInv = mat4.create();
    mat4.invert(parentWorldMatrixInv, parentWorldMatrix);

    // Transformeer de child wereldpositie naar lokale coördinaten t.o.v. parent
    const localPos = vec3.create();
    vec3.transformMat4(localPos, childWorldPos, parentWorldMatrixInv);

    // Bereken de lokale rotatie: childWorldRotation - parentWorldRotation
    // We doen dit door de inverse parent rotatie matrix te vermenigvuldigen
    // Maak een matrix met alleen de child's lokale transformatie in parent space
    const localMatrix = mat4.create();
    mat4.multiply(localMatrix, parentWorldMatrixInv, childWorldMatrix);
    // Haal de lokale rotatie uit deze matrix
    const localRotation = this.extractRotationFromMatrix(localMatrix);

    // Verwijder child uit oude parent
    if (child.parentId) {
      const oldParent = this.yobjects.get(child.parentId);
      if (oldParent && oldParent.childIds) {
        oldParent.childIds = oldParent.childIds.filter((id: string) => id !== childId);
        this.yobjects.set(child.parentId, oldParent);
      }
    }

    // Update child met nieuwe parent, lokale positie en lokale rotatie
    child.parentId = parentId;
    child.position = [localPos[0], localPos[1], localPos[2]] as [number, number, number];
    child.rotation = localRotation;

    // Voeg toe aan nieuwe parent
    parent.childIds = parent.childIds || [];
    if (!parent.childIds.includes(childId)) parent.childIds.push(childId);

    this.yobjects.set(childId, child);
    this.yobjects.set(parentId, parent);
  }

  // Unlink een child van zijn parent (zet lokale coördinaten terug naar wereld)
  unlinkObject(childId: string) {
    const child = this.yobjects.get(childId);
    if (!child || !child.parentId) return;

    const allObjects = this.getObjectMap();

    // Bereken de huidige wereldpositie en rotatie voordat we unlinken
    const childWorldMatrix = this.getWorldMatrix(child, allObjects);
    const worldPos: [number, number, number] = [
      childWorldMatrix[12],
      childWorldMatrix[13],
      childWorldMatrix[14]
    ];

    // Haal rotatie uit de wereldmatrix (XYZ Euler)
    const worldRotation = this.extractRotationFromMatrix(childWorldMatrix);

    const parent = this.yobjects.get(child.parentId);
    if (parent && parent.childIds) {
      parent.childIds = parent.childIds.filter((id: string) => id !== childId);
      this.yobjects.set(parent.id, parent);
    }

    // Update child met wereldcoördinaten en verwijder parent link
    child.parentId = null;
    child.position = worldPos;
    child.rotation = worldRotation;
    this.yobjects.set(childId, child);
  }

  // Helper: Haal Euler-rotatie (XYZ volgorde) uit een transformatiematrix
  private extractRotationFromMatrix(matrix: mat4): [number, number, number] {
    let rotX: number, rotY: number, rotZ: number;
    const sinY = -matrix[2];

    if (sinY >= 1) {
      rotY = Math.PI / 2;
      rotX = Math.atan2(matrix[4], matrix[5]);
      rotZ = 0;
    } else if (sinY <= -1) {
      rotY = -Math.PI / 2;
      rotX = Math.atan2(-matrix[4], matrix[5]);
      rotZ = 0;
    } else {
      rotY = Math.asin(sinY);
      const cosY = Math.cos(rotY);
      rotX = Math.atan2(matrix[6] / cosY, matrix[10] / cosY);
      rotZ = Math.atan2(matrix[1] / cosY, matrix[0] / cosY);
    }

    return [rotX, rotY, rotZ];
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
