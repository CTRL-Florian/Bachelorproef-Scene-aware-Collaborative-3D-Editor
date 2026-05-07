import { useState, useEffect } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import type { CollaborationStrategy, SceneObject } from '../../../collaboration/types';
import { createYjsStrategy, activeVariant } from '../../../collaboration/factory';
import { OTWebSocketClient } from '../../../collaboration/variants/variant-d';

export type { SceneObject };

interface SceneState {
  objects: SceneObject[];
  selectedObjectId: string | null;
}

const YJS_SERVER_URL = 'ws://localhost:1234';
const OT_SERVER_URL  = 'ws://localhost:1235';
const ROOM_NAME = 'scene-room';

const DEFAULT_BOX = () => ({
  id: 'box-default',
  type: 'box' as const,
  position: [0, 0, 0] as [number, number, number],
  rotation: [0, 0, 0] as [number, number, number],
  scale:    [1, 1, 1] as [number, number, number],
  color: 'orange',
  parentId: null,
  childIds: [],
});

class YjsSceneStore {
  private ydoc: Y.Doc | null = null;
  private wsProvider: WebsocketProvider | null = null;
  private strategy: CollaborationStrategy;
  private listeners = new Set<() => void>();

  constructor() {
    const variant = activeVariant();

    if (variant === 'D') {
      // Variant D: pure OT over WebSocket — no Y.js involved
      this.strategy = new OTWebSocketClient(
        OT_SERVER_URL,
        ROOM_NAME,
        undefined,
        (client) => {
          // Add the default box on first connect if the room is empty
          if (client.getAllObjects().size === 0) {
            this.addObject('box-default', 'box', [0, 0, 0], [0, 0, 0], [1, 1, 1], 'orange');
          }
        },
      );
    } else {
      // Variants A, B, C: Y.js CRDT over WebSocket
      this.ydoc = new Y.Doc();
      this.wsProvider = new WebsocketProvider(YJS_SERVER_URL, ROOM_NAME, this.ydoc);
      this.strategy = createYjsStrategy(variant, this.ydoc);

      this.wsProvider.on('sync', (isSynced: boolean) => {
        if (isSynced && this.strategy.getAllObjects().size === 0) {
          this.addObject('box-default', 'box', [0, 0, 0], [0, 0, 0], [1, 1, 1], 'orange');
        }
      });
    }

    this.strategy.subscribe(() => this.notifyListeners());
  }

  /** Returns a synced-like object so E2E hooks work for all variants. */
  getSyncStatus(): { synced: boolean } {
    if (this.wsProvider) return this.wsProvider;
    // For variant D: read the OTWebSocketClient's synced property
    return { synced: (this.strategy as OTWebSocketClient).synced ?? false };
  }

  /** @deprecated use getSyncStatus() — kept for legacy test-hooks compatibility */
  getProvider(): { synced: boolean } {
    return this.getSyncStatus();
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
    addObject:            store.addObject.bind(store),
    removeObject:         store.removeObject.bind(store),
    updateObject:         store.updateObject.bind(store),
    moveObject:           store.moveObject.bind(store),
    updateObjectPosition: store.updateObjectPosition.bind(store),
    updateObjectRotation: store.updateObjectRotation.bind(store),
    updateObjectScale:    store.updateObjectScale.bind(store),
    updateObjectColor:    store.updateObjectColor.bind(store),
    getObject:            store.getObject.bind(store),
    linkObject:           store.linkObject.bind(store),
    unlinkObject:         store.unlinkObject.bind(store),
  };
}
