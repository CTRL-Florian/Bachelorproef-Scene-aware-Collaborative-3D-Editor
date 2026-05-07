/**
 * Variant A — Object-level Last-Write-Wins (baseline)
 *
 * Each scene object is stored as a single opaque value in a Y.Map.
 * Updates replace the entire object. Conflict resolution is pure LWW at the
 * object level: when two clients concurrently write to the same key, Y.js
 * picks the operation with the higher (clientId, clock) tuple.
 *
 * Consequence: concurrent edits to *different* properties of the same object
 * still result in one full update being discarded (data loss).
 */

import * as Y from 'yjs';
import type { CollaborationStrategy, SceneObject } from '../types';
import { computeLinkTransform, computeUnlinkTransform } from '../transforms';

export class VariantA implements CollaborationStrategy {
  readonly yobjects: Y.Map<SceneObject>;
  private listeners = new Set<() => void>();
  private observer: () => void;

  constructor(readonly ydoc: Y.Doc) {
    this.yobjects = ydoc.getMap('objects');
    this.observer = () => this.notifyListeners();
    this.yobjects.observe(this.observer);
  }

  addObject(id: string, obj: SceneObject): void {
    this.yobjects.set(id, { ...obj, id });
  }

  updateObject(id: string, updates: Partial<SceneObject>): void {
    const current = this.yobjects.get(id);
    if (!current) return;
    this.yobjects.set(id, { ...current, ...updates });
  }

  moveObject(id: string, delta: [number, number, number]): void {
    const current = this.yobjects.get(id);
    if (!current) return;
    const [x, y, z] = current.position;
    this.yobjects.set(id, {
      ...current,
      position: [x + delta[0], y + delta[1], z + delta[2]],
    });
  }

  removeObject(id: string): void {
    this.yobjects.delete(id);
  }

  linkObject(childId: string, parentId: string): void {
    const child = this.yobjects.get(childId);
    const parent = this.yobjects.get(parentId);
    if (!child || !parent) return;

    const all = this.getAllObjects();
    const { position, rotation } = computeLinkTransform(child, parentId, all);

    if (child.parentId) {
      const oldParent = this.yobjects.get(child.parentId);
      if (oldParent) {
        this.yobjects.set(child.parentId, {
          ...oldParent,
          childIds: oldParent.childIds.filter(id => id !== childId),
        });
      }
    }

    this.yobjects.set(parentId, {
      ...parent,
      childIds: [...parent.childIds.filter(id => id !== childId), childId],
    });

    this.yobjects.set(childId, { ...child, parentId, position, rotation });
  }

  unlinkObject(childId: string): void {
    const child = this.yobjects.get(childId);
    if (!child || !child.parentId) return;

    const all = this.getAllObjects();
    const { position, rotation } = computeUnlinkTransform(child, all);

    const parent = this.yobjects.get(child.parentId);
    if (parent) {
      this.yobjects.set(child.parentId, {
        ...parent,
        childIds: parent.childIds.filter(id => id !== childId),
      });
    }

    this.yobjects.set(childId, { ...child, parentId: null, position, rotation });
  }

  getObject(id: string): SceneObject | undefined {
    return this.yobjects.get(id);
  }

  getAllObjects(): Map<string, SceneObject> {
    const map = new Map<string, SceneObject>();
    this.yobjects.forEach((v, k) => map.set(k, v));
    return map;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  destroy(): void {
    this.yobjects.unobserve(this.observer);
    this.listeners.clear();
  }

  private notifyListeners(): void {
    this.listeners.forEach(l => l());
  }
}
