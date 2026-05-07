/**
 * Variant D — Operational Transformation with authoritative server
 *
 * This variant leaves the CRDT paradigm entirely. Instead of merging states
 * on every peer, a central server maintains the canonical operation log.
 * Clients submit operations with a *revision number* (the last server op they
 * have seen). The server transforms incoming ops against any ops that were
 * applied since that revision and then broadcasts the (possibly transformed)
 * op to all peers.
 *
 * Key properties:
 *   - Clients never merge on their own; only the server transforms.
 *   - Conflict resolution policy is explicit and inspectable in transform().
 *   - The operation set is small and bounded (four types), making the full
 *     transformation matrix manageable.
 *
 * In-memory variant (for unit tests)
 * -----------------------------------
 * InMemoryOTServer runs the server logic synchronously. OTClients connect to
 * it and call pause()/flush() to simulate concurrent offline work:
 *
 *   alice.pause(); bob.pause();
 *   alice.updateObject(…); bob.updateObject(…);
 *   alice.flush();   // server transforms alice's op, broadcasts to both
 *   bob.flush();     // server transforms bob's op against alice's, broadcasts
 *
 * Network variant (for production with server-ot.cjs)
 * ---------------------------------------------------
 * OTWebSocketClient replaces InMemoryOTServer with a real WebSocket connection
 * to server-ot.cjs.
 */

import type { CollaborationStrategy, SceneObject } from '../types';
import { computeLinkTransform, computeUnlinkTransform } from '../transforms';

// ---------------------------------------------------------------------------
// Operation types
// ---------------------------------------------------------------------------

export type OTOpType = 'create' | 'delete' | 'setProperty' | 'reparent' | 'noop';

export interface OTOperation {
  type: OTOpType;
  id: string;
  // setProperty
  property?: keyof SceneObject;
  value?: unknown;
  // create
  object?: SceneObject;
  // reparent
  newParentId?: string | null;
  oldParentId?: string | null;
  // tracking
  clientId: string;
  clientRevision: number;
}

export interface ServerOperation extends OTOperation {
  serverRevision: number;
}

// ---------------------------------------------------------------------------
// Transformation function (OT core)
// ---------------------------------------------------------------------------

/**
 * Transform op1 assuming op2 has already been applied.
 * Returns op1 possibly as a noop if the conflict resolution policy
 * dictates that op2's effect makes op1 redundant.
 *
 * Transformation matrix (op1 rows × op2 cols):
 *
 *                | setProperty  | delete | create | reparent
 * setProperty    |  LWW / pass  | noop   | n/a    | pass
 * delete         |  pass        | noop   | n/a    | pass
 * create         |  n/a         | n/a    | n/a    | n/a
 * reparent       |  pass        | noop*  | n/a    | LWW
 *
 * *reparent vs delete: if the target parent was deleted, reparent to root.
 */
export function transform(op1: OTOperation, op2: ServerOperation): OTOperation {
  if (op1.type === 'noop') return op1;

  if (op1.type === 'setProperty' && op2.type === 'setProperty'
    && op1.id === op2.id && op1.property === op2.property) {
    // Same property written concurrently → op2 already applied, op1 is a no-op
    return { ...op1, type: 'noop' };
  }

  if (op1.type === 'setProperty' && op2.type === 'delete' && op1.id === op2.id) {
    // Object deleted → property write is meaningless
    return { ...op1, type: 'noop' };
  }

  if (op1.type === 'delete' && op2.type === 'delete' && op1.id === op2.id) {
    // Already deleted
    return { ...op1, type: 'noop' };
  }

  if (op1.type === 'reparent' && op2.type === 'delete' && op1.newParentId === op2.id) {
    // The intended parent was deleted → reparent to scene root instead
    return { ...op1, newParentId: null };
  }

  if (op1.type === 'reparent' && op2.type === 'reparent' && op1.id === op2.id) {
    // Two concurrent reparents for the same child → op2 already applied, op1 loses
    return { ...op1, type: 'noop' };
  }

  return op1;
}

// ---------------------------------------------------------------------------
// In-memory OT server
// ---------------------------------------------------------------------------

export class InMemoryOTServer {
  private log: ServerOperation[] = [];
  private state = new Map<string, SceneObject>();
  private clients = new Map<string, (op: ServerOperation) => void>();
  private revision = 0;

  connect(clientId: string, callback: (op: ServerOperation) => void): void {
    this.clients.set(clientId, callback);
  }

  disconnect(clientId: string): void {
    this.clients.delete(clientId);
  }

  getState(): ReadonlyMap<string, SceneObject> {
    return this.state;
  }

  getRevision(): number {
    return this.revision;
  }

  submit(op: OTOperation): void {
    // Transform op against all ops the client has not yet seen
    const missed = this.log.slice(op.clientRevision);
    let transformed: OTOperation = { ...op };
    for (const missed_op of missed) {
      transformed = transform(transformed, missed_op);
    }

    this.revision++;
    const serverOp: ServerOperation = { ...transformed, serverRevision: this.revision };
    this.log.push(serverOp);
    this.applyToState(serverOp);

    // Broadcast to all connected clients (including the sender — no optimistic
    // updates on the client side, so the sender needs the confirmation)
    this.clients.forEach(cb => cb(serverOp));
  }

  private applyToState(op: ServerOperation): void {
    switch (op.type) {
      case 'create':
        if (op.object) this.state.set(op.id, { ...op.object });
        break;
      case 'delete':
        this.state.delete(op.id);
        break;
      case 'setProperty': {
        const obj = this.state.get(op.id);
        if (obj && op.property) (obj as Record<string, unknown>)[op.property] = op.value;
        break;
      }
      case 'reparent': {
        const child = this.state.get(op.id);
        if (!child) break;
        if (child.parentId) {
          const old = this.state.get(child.parentId);
          if (old) old.childIds = old.childIds.filter(id => id !== op.id);
        }
        child.parentId = op.newParentId ?? null;
        if (op.newParentId) {
          const np = this.state.get(op.newParentId);
          if (np && !np.childIds.includes(op.id)) np.childIds = [...np.childIds, op.id];
        }
        break;
      }
      case 'noop':
        break;
    }
  }
}

// ---------------------------------------------------------------------------
// OT client (in-memory transport)
// ---------------------------------------------------------------------------

export class VariantDClient implements CollaborationStrategy {
  private localState = new Map<string, SceneObject>();
  private clientRevision = 0;
  private pendingOps: OTOperation[] = [];
  /** Ops received from server while paused — delivered on flush() before sending. */
  private receiveQueue: ServerOperation[] = [];
  private paused = false;
  private listeners = new Set<() => void>();

  constructor(
    private readonly clientId: string,
    private readonly server: InMemoryOTServer,
  ) {
    server.connect(clientId, op => this.onServerOp(op));
  }

  // -- Pause/flush for test simulation --

  /**
   * Pause both sending and receiving (simulates offline).
   * Incoming server ops are buffered and applied on flush().
   */
  pause(): void {
    this.paused = true;
  }

  /**
   * Reconnect: first apply buffered received ops (updating local state and
   * clientRevision), then send all pending ops using their stored revisions.
   * The server will transform them against any ops applied since those revisions.
   */
  flush(): void {
    // Deliver queued ops from other clients first
    for (const op of this.receiveQueue) this.applyServerOp(op);
    this.receiveQueue = [];

    this.paused = false;
    const ops = [...this.pendingOps];
    this.pendingOps = [];
    for (const op of ops) this.server.submit(op);
  }

  // -- Internal --

  private onServerOp(op: ServerOperation): void {
    if (this.paused) {
      this.receiveQueue.push(op);
      return;
    }
    this.applyServerOp(op);
  }

  private applyServerOp(op: ServerOperation): void {
    this.clientRevision = op.serverRevision;
    this.applyToLocal(op);
    this.notifyListeners();
  }

  private applyToLocal(op: ServerOperation): void {
    switch (op.type) {
      case 'create':
        if (op.object) this.localState.set(op.id, { ...op.object });
        break;
      case 'delete':
        this.localState.delete(op.id);
        break;
      case 'setProperty': {
        const obj = this.localState.get(op.id);
        if (obj && op.property) (obj as Record<string, unknown>)[op.property] = op.value;
        break;
      }
      case 'reparent': {
        const child = this.localState.get(op.id);
        if (!child) break;
        if (child.parentId) {
          const old = this.localState.get(child.parentId);
          if (old) old.childIds = old.childIds.filter(id => id !== op.id);
        }
        child.parentId = op.newParentId ?? null;
        if (op.newParentId) {
          const np = this.localState.get(op.newParentId);
          if (np && !np.childIds.includes(op.id)) np.childIds = [...np.childIds, op.id];
        }
        break;
      }
      case 'noop':
        break;
    }
  }

  private send(partial: Omit<OTOperation, 'clientId' | 'clientRevision'>): void {
    const op: OTOperation = {
      ...partial,
      clientId: this.clientId,
      clientRevision: this.clientRevision,
    };
    if (this.paused) {
      this.pendingOps.push(op);
    } else {
      this.server.submit(op);
    }
  }

  // -- CollaborationStrategy --

  addObject(id: string, obj: SceneObject): void {
    this.send({ type: 'create', id, object: { ...obj, id } });
  }

  updateObject(id: string, updates: Partial<SceneObject>): void {
    for (const [k, v] of Object.entries(updates)) {
      this.send({ type: 'setProperty', id, property: k as keyof SceneObject, value: v });
    }
  }

  moveObject(id: string, delta: [number, number, number]): void {
    const obj = this.localState.get(id);
    if (!obj) return;
    const newPos: [number, number, number] = [
      obj.position[0] + delta[0],
      obj.position[1] + delta[1],
      obj.position[2] + delta[2],
    ];
    this.send({ type: 'setProperty', id, property: 'position', value: newPos });
  }

  removeObject(id: string): void {
    this.send({ type: 'delete', id });
  }

  linkObject(childId: string, parentId: string): void {
    const child = this.localState.get(childId);
    if (!child) return;
    const { position, rotation } = computeLinkTransform(child, parentId, this.getAllObjects());
    this.send({ type: 'reparent', id: childId, newParentId: parentId, oldParentId: child.parentId });
    this.send({ type: 'setProperty', id: childId, property: 'position', value: position });
    this.send({ type: 'setProperty', id: childId, property: 'rotation', value: rotation });
  }

  unlinkObject(childId: string): void {
    const child = this.localState.get(childId);
    if (!child || !child.parentId) return;
    const { position, rotation } = computeUnlinkTransform(child, this.getAllObjects());
    this.send({ type: 'reparent', id: childId, newParentId: null, oldParentId: child.parentId });
    this.send({ type: 'setProperty', id: childId, property: 'position', value: position });
    this.send({ type: 'setProperty', id: childId, property: 'rotation', value: rotation });
  }

  getObject(id: string): SceneObject | undefined {
    return this.localState.get(id);
  }

  getAllObjects(): Map<string, SceneObject> {
    return new Map(this.localState);
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  destroy(): void {
    this.server.disconnect(this.clientId);
    this.listeners.clear();
  }

  private notifyListeners(): void {
    this.listeners.forEach(l => l());
  }
}

// ---------------------------------------------------------------------------
// Test environment factory for Variant D
// ---------------------------------------------------------------------------

import type { TestEnv } from '../types';

export function createOTTestEnv(): TestEnv {
  const server = new InMemoryOTServer();
  const alice = new VariantDClient('alice', server);
  const bob = new VariantDClient('bob', server);

  return {
    alice,
    bob,
    disableSync() {
      alice.pause();
      bob.pause();
    },
    enableSync() {
      // Alice's pending ops arrive at the server first, then Bob's.
      // The server transforms Bob's ops against Alice's.
      alice.flush();
      bob.flush();
    },
    cleanup() {
      alice.destroy();
      bob.destroy();
    },
  };
}
