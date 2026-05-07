import { useState, useEffect } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import type { CollaborationStrategy, SceneObject } from '../../../collaboration/types';
import { createYjsStrategy, activeVariant } from '../../../collaboration/factory';

export type { SceneObject };

interface SceneState {
  objects: SceneObject[];
  selectedObjectId: string | null;
}

const WEBSOCKET_URL = 'ws://localhost:1234';
const ROOM_NAME = 'scene-room';

class YjsSceneStore {
  private ydoc: Y.Doc;
  private wsProvider: WebsocketProvider;
  private strategy: CollaborationStrategy;
  private listeners = new Set<() => void>();

  constructor() {
    this.ydoc = new Y.Doc();
    this.wsProvider = new WebsocketProvider(WEBSOCKET_URL, ROOM_NAME, this.ydoc);

    const variant = activeVariant();
    // Variant D uses the OT server; for the browser we still create a Y.js
    // strategy so the rest of the UI keeps working. Full Variant D production
    // integration (OTWebSocketClient) is handled by server-ot.cjs.
    this.strategy = createYjsStrategy(variant === 'D' ? 'A' : variant, this.ydoc);

    this.strategy.subscribe(() => this.notifyListeners());

    this.wsProvider.on('sync', (isSynced: boolean) => {
      if (isSynced && this.strategy.getAllObjects().size === 0) {
        this.addObject('box-default', 'box', [0, 0, 0], [0, 0, 0], [1, 1, 1], 'orange');
      }
    });
  }

  getProvider(): WebsocketProvider {
    return this.wsProvider;
  }

  addObject(
    id: string,
    type: SceneObject['type'],
    position: [number, number, number],
    rotation: [number, number, number],
    scale: [number, number, number],
    color: string,
  ): void {
    this.strategy.addObject(id, { id, type, position, rotation, scale, color, parentId: null, childIds: [] });
  }

  removeObject(id: string): void {
    this.strategy.removeObject(id);
  }

  updateObject(id: string, updates: Partial<SceneObject>): void {
    this.strategy.updateObject(id, updates);
  }

  moveObject(id: string, delta: [number, number, number]): void {
    this.strategy.moveObject(id, delta);
  }

  updateObjectPosition(id: string, position: [number, number, number]): void {
    this.strategy.updateObject(id, { position });
  }

  updateObjectRotation(id: string, rotation: [number, number, number]): void {
    this.strategy.updateObject(id, { rotation });
  }

  updateObjectScale(id: string, scale: [number, number, number]): void {
    this.strategy.updateObject(id, { scale });
  }

  updateObjectColor(id: string, color: string): void {
    this.strategy.updateObject(id, { color });
  }

  linkObject(childId: string, parentId: string): void {
    this.strategy.linkObject(childId, parentId);
  }

  unlinkObject(childId: string): void {
    this.strategy.unlinkObject(childId);
  }

  getObject(id: string): SceneObject | undefined {
    return this.strategy.getObject(id);
  }

  getObjects(): SceneObject[] {
    return Array.from(this.strategy.getAllObjects().values());
  }

  getState(): SceneState {
    return { objects: this.getObjects(), selectedObjectId: null };
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    this.listeners.forEach(l => l());
  }
}

let storeInstance: YjsSceneStore | null = null;

function getYjsSceneStore(): YjsSceneStore {
  if (!storeInstance) storeInstance = new YjsSceneStore();
  return storeInstance;
}

export const sceneStore = getYjsSceneStore();

export function useYjsSceneStore() {
  const store = getYjsSceneStore();
  const [state, setState] = useState<SceneState>(store.getState());

  useEffect(() => {
    const unsubscribe = store.subscribe(() => setState(store.getState()));
    return unsubscribe;
  }, []);

  return {
    state,
    addObject: store.addObject.bind(store),
    removeObject: store.removeObject.bind(store),
    updateObject: store.updateObject.bind(store),
    moveObject: store.moveObject.bind(store),
    updateObjectPosition: store.updateObjectPosition.bind(store),
    updateObjectRotation: store.updateObjectRotation.bind(store),
    updateObjectScale: store.updateObjectScale.bind(store),
    updateObjectColor: store.updateObjectColor.bind(store),
    getObject: store.getObject.bind(store),
    linkObject: store.linkObject.bind(store),
    unlinkObject: store.unlinkObject.bind(store),
  };
}
