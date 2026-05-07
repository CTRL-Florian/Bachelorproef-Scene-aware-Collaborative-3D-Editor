/**
 * Variant B — Property-level CRDT (nested Y.Map)
 *
 * Each scene object is represented as a nested Y.Map where every scalar
 * property (position_x, color, …) is an independent entry. Y.js applies LWW
 * at property granularity, so concurrent edits to *different* properties of
 * the same object are both preserved. Edits to the *same* property still follow
 * LWW (one value wins).
 *
 * The key improvement over Variant A: Alice moving an object and Bob changing
 * its colour simultaneously will preserve BOTH changes.
 *
 * `childIds` is serialised as JSON because Y.Array nested inside a Y.Map
 * requires extra care during synchronisation that is out of scope for this
 * research. Concurrent childIds modifications still result in LWW for that
 * property.
 */

import * as Y from 'yjs';
import type { CollaborationStrategy, SceneObject } from '../types';
import { computeLinkTransform, computeUnlinkTransform } from '../transforms';

type PropMap = Y.Map<unknown>;

function toYMap(ydoc: Y.Doc, obj: SceneObject): PropMap {
  const ymap = new Y.Map<unknown>();
  ydoc.transact(() => {
    ymap.set('id', obj.id);
    ymap.set('type', obj.type);
    ymap.set('position_x', obj.position[0]);
    ymap.set('position_y', obj.position[1]);
    ymap.set('position_z', obj.position[2]);
    ymap.set('rotation_x', obj.rotation[0]);
    ymap.set('rotation_y', obj.rotation[1]);
    ymap.set('rotation_z', obj.rotation[2]);
    ymap.set('scale_x', obj.scale[0]);
    ymap.set('scale_y', obj.scale[1]);
    ymap.set('scale_z', obj.scale[2]);
    ymap.set('color', obj.color);
    ymap.set('parentId', obj.parentId ?? null);
    ymap.set('childIds', JSON.stringify(obj.childIds));
  });
  return ymap;
}

function fromYMap(ymap: PropMap): SceneObject {
  return {
    id: ymap.get('id') as string,
    type: ymap.get('type') as SceneObject['type'],
    position: [
      (ymap.get('position_x') as number) ?? 0,
      (ymap.get('position_y') as number) ?? 0,
      (ymap.get('position_z') as number) ?? 0,
    ],
    rotation: [
      (ymap.get('rotation_x') as number) ?? 0,
      (ymap.get('rotation_y') as number) ?? 0,
      (ymap.get('rotation_z') as number) ?? 0,
    ],
    scale: [
      (ymap.get('scale_x') as number) ?? 1,
      (ymap.get('scale_y') as number) ?? 1,
      (ymap.get('scale_z') as number) ?? 1,
    ],
    color: (ymap.get('color') as string) ?? '#FF6B6B',
    parentId: (ymap.get('parentId') as string | null) ?? null,
    childIds: JSON.parse((ymap.get('childIds') as string) ?? '[]') as string[],
  };
}

export class VariantB implements CollaborationStrategy {
  readonly yobjects: Y.Map<PropMap>;
  private listeners = new Set<() => void>();
  private observer: () => void;

  constructor(readonly ydoc: Y.Doc) {
    this.yobjects = ydoc.getMap<PropMap>('objects-b');
    this.observer = () => this.notifyListeners();
    // observeDeep captures changes to nested Y.Map entries
    this.yobjects.observeDeep(this.observer);
  }

  addObject(id: string, obj: SceneObject): void {
    const ymap = toYMap(this.ydoc, { ...obj, id });
    this.yobjects.set(id, ymap);
  }

  updateObject(id: string, updates: Partial<SceneObject>): void {
    const ymap = this.yobjects.get(id);
    if (!ymap) return;

    this.ydoc.transact(() => {
      if (updates.position) {
        ymap.set('position_x', updates.position![0]);
        ymap.set('position_y', updates.position![1]);
        ymap.set('position_z', updates.position![2]);
      }
      if (updates.rotation) {
        ymap.set('rotation_x', updates.rotation![0]);
        ymap.set('rotation_y', updates.rotation![1]);
        ymap.set('rotation_z', updates.rotation![2]);
      }
      if (updates.scale) {
        ymap.set('scale_x', updates.scale![0]);
        ymap.set('scale_y', updates.scale![1]);
        ymap.set('scale_z', updates.scale![2]);
      }
      if (updates.color !== undefined) ymap.set('color', updates.color);
      if (updates.parentId !== undefined) ymap.set('parentId', updates.parentId ?? null);
      if (updates.childIds !== undefined) ymap.set('childIds', JSON.stringify(updates.childIds));
    });
  }

  /**
   * Read-modify-write per property axis. Still LWW at the property level
   * (two concurrent moveObject calls on the same axis → one value wins).
   * Use Variant C for truly commutative delta moves.
   */
  moveObject(id: string, delta: [number, number, number]): void {
    const ymap = this.yobjects.get(id);
    if (!ymap) return;
    this.ydoc.transact(() => {
      ymap.set('position_x', ((ymap.get('position_x') as number) ?? 0) + delta[0]);
      ymap.set('position_y', ((ymap.get('position_y') as number) ?? 0) + delta[1]);
      ymap.set('position_z', ((ymap.get('position_z') as number) ?? 0) + delta[2]);
    });
  }

  removeObject(id: string): void {
    this.yobjects.delete(id);
  }

  linkObject(childId: string, parentId: string): void {
    const childYMap = this.yobjects.get(childId);
    const parentYMap = this.yobjects.get(parentId);
    if (!childYMap || !parentYMap) return;

    const child = fromYMap(childYMap);
    const all = this.getAllObjects();
    const { position, rotation } = computeLinkTransform(child, parentId, all);

    if (child.parentId) {
      const oldParentYMap = this.yobjects.get(child.parentId);
      if (oldParentYMap) {
        const ids: string[] = JSON.parse((oldParentYMap.get('childIds') as string) ?? '[]');
        oldParentYMap.set('childIds', JSON.stringify(ids.filter(id => id !== childId)));
      }
    }

    const parentChildIds: string[] = JSON.parse((parentYMap.get('childIds') as string) ?? '[]');
    if (!parentChildIds.includes(childId)) {
      parentYMap.set('childIds', JSON.stringify([...parentChildIds, childId]));
    }

    this.ydoc.transact(() => {
      childYMap.set('parentId', parentId);
      childYMap.set('position_x', position[0]);
      childYMap.set('position_y', position[1]);
      childYMap.set('position_z', position[2]);
      childYMap.set('rotation_x', rotation[0]);
      childYMap.set('rotation_y', rotation[1]);
      childYMap.set('rotation_z', rotation[2]);
    });
  }

  unlinkObject(childId: string): void {
    const childYMap = this.yobjects.get(childId);
    if (!childYMap) return;

    const child = fromYMap(childYMap);
    if (!child.parentId) return;

    const all = this.getAllObjects();
    const { position, rotation } = computeUnlinkTransform(child, all);

    const parentYMap = this.yobjects.get(child.parentId);
    if (parentYMap) {
      const ids: string[] = JSON.parse((parentYMap.get('childIds') as string) ?? '[]');
      parentYMap.set('childIds', JSON.stringify(ids.filter(id => id !== childId)));
    }

    this.ydoc.transact(() => {
      childYMap.set('parentId', null);
      childYMap.set('position_x', position[0]);
      childYMap.set('position_y', position[1]);
      childYMap.set('position_z', position[2]);
      childYMap.set('rotation_x', rotation[0]);
      childYMap.set('rotation_y', rotation[1]);
      childYMap.set('rotation_z', rotation[2]);
    });
  }

  getObject(id: string): SceneObject | undefined {
    const ymap = this.yobjects.get(id);
    return ymap ? fromYMap(ymap) : undefined;
  }

  getAllObjects(): Map<string, SceneObject> {
    const map = new Map<string, SceneObject>();
    this.yobjects.forEach((ymap, key) => map.set(key, fromYMap(ymap)));
    return map;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  destroy(): void {
    this.yobjects.unobserveDeep(this.observer);
    this.listeners.clear();
  }

  private notifyListeners(): void {
    this.listeners.forEach(l => l());
  }
}
