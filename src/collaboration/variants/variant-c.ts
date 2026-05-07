/**
 * Variant C — Delta-based operation log (Y.Array)
 *
 * All mutations are expressed as operations appended to a Y.Array. Y.js
 * guarantees that all peers see the same ordering of array elements, so
 * convergence is automatic.
 *
 * The key semantic difference from Variants A and B:
 *   moveObject()  → pushes a DELTA op (dx, dy, dz). Two concurrent moves
 *                   are both applied → final position = start + Δ1 + Δ2.
 *   updateObject() with position → pushes a setPosition op (absolute).
 *                   Two concurrent setPosition calls follow LWW at the log level.
 *
 * Move deltas are commutative: Δ1 + Δ2 = Δ2 + Δ1, so move order in the log
 * does not affect the result. This is the primary research advantage of Variant C.
 *
 * Trade-off: the entire operation log is replayed on every change.
 * For a research prototype this is acceptable; a production system would
 * maintain checkpoints.
 */

import * as Y from 'yjs';
import type { CollaborationStrategy, SceneObject } from '../types';
import { computeLinkTransform, computeUnlinkTransform } from '../transforms';

type Op =
  | { t: 'create'; id: string; obj: SceneObject }
  | { t: 'delete'; id: string }
  | { t: 'move'; id: string; dx: number; dy: number; dz: number }
  | { t: 'rotate'; id: string; drx: number; dry: number; drz: number }
  | { t: 'setPosition'; id: string; x: number; y: number; z: number }
  | { t: 'setRotation'; id: string; rx: number; ry: number; rz: number }
  | { t: 'setScale'; id: string; sx: number; sy: number; sz: number }
  | { t: 'setColor'; id: string; color: string }
  | { t: 'setParent'; id: string; parentId: string | null }
  | { t: 'addChild'; parentId: string; childId: string }
  | { t: 'removeChild'; parentId: string; childId: string };

export class VariantC implements CollaborationStrategy {
  readonly yops: Y.Array<Op>;
  private cache = new Map<string, SceneObject>();
  private listeners = new Set<() => void>();

  constructor(readonly ydoc: Y.Doc) {
    this.yops = ydoc.getArray<Op>('ops-c');
    this.yops.observe(() => {
      this.rebuildCache();
      this.notifyListeners();
    });
  }

  private rebuildCache(): void {
    this.cache.clear();
    for (const op of this.yops.toArray()) this.applyOp(op);
  }

  private applyOp(op: Op): void {
    switch (op.t) {
      case 'create':
        this.cache.set(op.id, { ...op.obj });
        break;
      case 'delete':
        this.cache.delete(op.id);
        break;
      case 'move': {
        const o = this.cache.get(op.id);
        if (o) o.position = [o.position[0] + op.dx, o.position[1] + op.dy, o.position[2] + op.dz];
        break;
      }
      case 'rotate': {
        const o = this.cache.get(op.id);
        if (o) o.rotation = [o.rotation[0] + op.drx, o.rotation[1] + op.dry, o.rotation[2] + op.drz];
        break;
      }
      case 'setPosition': {
        const o = this.cache.get(op.id);
        if (o) o.position = [op.x, op.y, op.z];
        break;
      }
      case 'setRotation': {
        const o = this.cache.get(op.id);
        if (o) o.rotation = [op.rx, op.ry, op.rz];
        break;
      }
      case 'setScale': {
        const o = this.cache.get(op.id);
        if (o) o.scale = [op.sx, op.sy, op.sz];
        break;
      }
      case 'setColor': {
        const o = this.cache.get(op.id);
        if (o) o.color = op.color;
        break;
      }
      case 'setParent': {
        const o = this.cache.get(op.id);
        if (o) o.parentId = op.parentId;
        break;
      }
      case 'addChild': {
        const p = this.cache.get(op.parentId);
        if (p && !p.childIds.includes(op.childId)) p.childIds = [...p.childIds, op.childId];
        break;
      }
      case 'removeChild': {
        const p = this.cache.get(op.parentId);
        if (p) p.childIds = p.childIds.filter(id => id !== op.childId);
        break;
      }
    }
  }

  addObject(id: string, obj: SceneObject): void {
    this.yops.push([{ t: 'create', id, obj: { ...obj, id } }]);
  }

  updateObject(id: string, updates: Partial<SceneObject>): void {
    const ops: Op[] = [];
    if (updates.position !== undefined)
      ops.push({ t: 'setPosition', id, x: updates.position[0], y: updates.position[1], z: updates.position[2] });
    if (updates.rotation !== undefined)
      ops.push({ t: 'setRotation', id, rx: updates.rotation[0], ry: updates.rotation[1], rz: updates.rotation[2] });
    if (updates.scale !== undefined)
      ops.push({ t: 'setScale', id, sx: updates.scale[0], sy: updates.scale[1], sz: updates.scale[2] });
    if (updates.color !== undefined)
      ops.push({ t: 'setColor', id, color: updates.color });
    if (updates.parentId !== undefined)
      ops.push({ t: 'setParent', id, parentId: updates.parentId ?? null });
    if (updates.childIds !== undefined) {
      const current = this.cache.get(id);
      if (current) {
        current.childIds
          .filter(c => !updates.childIds!.includes(c))
          .forEach(childId => ops.push({ t: 'removeChild', parentId: id, childId }));
        updates.childIds
          .filter(c => !current.childIds.includes(c))
          .forEach(childId => ops.push({ t: 'addChild', parentId: id, childId }));
      }
    }
    if (ops.length > 0) this.yops.push(ops);
  }

  /**
   * The defining method of Variant C: additive delta that is commutative.
   * Two concurrent moveObject calls are both applied regardless of ordering.
   */
  moveObject(id: string, delta: [number, number, number]): void {
    this.yops.push([{ t: 'move', id, dx: delta[0], dy: delta[1], dz: delta[2] }]);
  }

  removeObject(id: string): void {
    this.yops.push([{ t: 'delete', id }]);
  }

  linkObject(childId: string, parentId: string): void {
    const child = this.cache.get(childId);
    if (!child) return;
    const all = this.getAllObjects();
    const { position, rotation } = computeLinkTransform(child, parentId, all);

    const ops: Op[] = [];
    if (child.parentId) ops.push({ t: 'removeChild', parentId: child.parentId, childId });
    ops.push(
      { t: 'setParent', id: childId, parentId },
      { t: 'addChild', parentId, childId },
      { t: 'setPosition', id: childId, x: position[0], y: position[1], z: position[2] },
      { t: 'setRotation', id: childId, rx: rotation[0], ry: rotation[1], rz: rotation[2] },
    );
    this.yops.push(ops);
  }

  unlinkObject(childId: string): void {
    const child = this.cache.get(childId);
    if (!child || !child.parentId) return;
    const all = this.getAllObjects();
    const { position, rotation } = computeUnlinkTransform(child, all);

    this.yops.push([
      { t: 'removeChild', parentId: child.parentId, childId },
      { t: 'setParent', id: childId, parentId: null },
      { t: 'setPosition', id: childId, x: position[0], y: position[1], z: position[2] },
      { t: 'setRotation', id: childId, rx: rotation[0], ry: rotation[1], rz: rotation[2] },
    ]);
  }

  getObject(id: string): SceneObject | undefined {
    return this.cache.get(id);
  }

  getAllObjects(): Map<string, SceneObject> {
    return new Map(this.cache);
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  destroy(): void {
    this.listeners.clear();
  }

  private notifyListeners(): void {
    this.listeners.forEach(l => l());
  }
}
