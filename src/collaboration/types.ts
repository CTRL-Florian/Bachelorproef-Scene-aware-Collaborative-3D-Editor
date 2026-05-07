import * as Y from 'yjs';

export interface SceneObject {
  id: string;
  type: 'box' | 'sphere' | 'cylinder';
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  color: string;
  parentId: string | null;
  childIds: string[];
}

export function defaultSceneObject(id: string, type: SceneObject['type'] = 'box'): SceneObject {
  return {
    id,
    type,
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    color: '#FF6B6B',
    parentId: null,
    childIds: [],
  };
}

/**
 * Common interface implemented by all four conflict-resolution variants.
 * Tests and the production store depend only on this interface, never on a
 * concrete variant class.
 */
export interface CollaborationStrategy {
  addObject(id: string, object: SceneObject): void;
  updateObject(id: string, updates: Partial<SceneObject>): void;
  /**
   * Move an object by a relative delta. In Variant C this is fully additive
   * (commutative); in Variants A, B and D it falls back to an absolute write.
   */
  moveObject(id: string, delta: [number, number, number]): void;
  removeObject(id: string): void;
  linkObject(childId: string, parentId: string): void;
  unlinkObject(childId: string): void;
  getObject(id: string): SceneObject | undefined;
  getAllObjects(): Map<string, SceneObject>;
  subscribe(listener: () => void): () => void;
  destroy(): void;
}

/**
 * Test environment returned by createTestEnv().
 * Abstracts over Y.js sync (variants A/B/C) and OT pausing (variant D).
 */
export interface TestEnv {
  alice: CollaborationStrategy;
  bob: CollaborationStrategy;
  /** Stop propagating changes between peers (simulate concurrent offline work). */
  disableSync(): void;
  /** Re-enable propagation and merge all pending changes. */
  enableSync(): void;
  cleanup(): void;
}

export type VariantKey = 'A' | 'B' | 'C' | 'D';

export function createYjsTestEnv(
  createStrategy: (doc: Y.Doc) => CollaborationStrategy,
): TestEnv {
  const aliceDoc = new Y.Doc();
  const bobDoc = new Y.Doc();
  let syncEnabled = true;

  aliceDoc.on('update', (update: Uint8Array, origin: unknown) => {
    if (origin !== 'remote' && syncEnabled) Y.applyUpdate(bobDoc, update, 'remote');
  });
  bobDoc.on('update', (update: Uint8Array, origin: unknown) => {
    if (origin !== 'remote' && syncEnabled) Y.applyUpdate(aliceDoc, update, 'remote');
  });

  function syncAll() {
    const a = Y.encodeStateAsUpdate(aliceDoc);
    const b = Y.encodeStateAsUpdate(bobDoc);
    Y.applyUpdate(bobDoc, a, 'remote');
    Y.applyUpdate(aliceDoc, b, 'remote');
  }

  const alice = createStrategy(aliceDoc);
  const bob = createStrategy(bobDoc);

  return {
    alice,
    bob,
    disableSync() { syncEnabled = false; },
    enableSync() {
      syncEnabled = true;
      syncAll();
    },
    cleanup() {
      alice.destroy();
      bob.destroy();
      aliceDoc.destroy();
      bobDoc.destroy();
    },
  };
}
