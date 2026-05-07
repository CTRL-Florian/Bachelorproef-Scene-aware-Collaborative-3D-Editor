/**
 * Variant D test suite — Operational Transformation with authoritative server
 *
 * Runs the shared five-scenario matrix plus Variant-D-specific assertions
 * that verify the explicit transform() function and the server-first ordering
 * of conflict resolution.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestEnv } from '../../collaboration/factory';
import { runSharedScenarios } from './shared-scenarios';
import { InMemoryOTServer, VariantDClient, transform } from '../../collaboration/variants/variant-d';
import type { SceneObject, TestEnv } from '../../collaboration/types';

runSharedScenarios('Variant D', () => createTestEnv('D'));

// ----------------------------------------------------------------
// Unit tests for the transform() function itself
// ----------------------------------------------------------------

describe('[Variant D] transform() function — OT correctness', () => {
  const base = { clientId: 'alice', clientRevision: 0 };
  const server = { ...base, serverRevision: 1, clientId: 'bob' };

  it('setProperty vs setProperty — same property → noop', () => {
    const op1 = { ...base, type: 'setProperty' as const, id: 'box-1', property: 'color' as const, value: '#FF0000' };
    const op2 = { ...server, type: 'setProperty' as const, id: 'box-1', property: 'color' as const, value: '#0000FF' };
    expect(transform(op1, op2).type).toBe('noop');
  });

  it('setProperty vs setProperty — different property → unchanged', () => {
    const op1 = { ...base, type: 'setProperty' as const, id: 'box-1', property: 'color' as const, value: '#FF0000' };
    const op2 = { ...server, type: 'setProperty' as const, id: 'box-1', property: 'position' as const, value: [10, 0, 0] };
    expect(transform(op1, op2).type).toBe('setProperty');
    expect(transform(op1, op2).value).toBe('#FF0000');
  });

  it('setProperty vs delete — same object → noop', () => {
    const op1 = { ...base, type: 'setProperty' as const, id: 'box-1', property: 'color' as const, value: '#FF0000' };
    const op2 = { ...server, type: 'delete' as const, id: 'box-1' };
    expect(transform(op1, op2).type).toBe('noop');
  });

  it('setProperty vs delete — different object → unchanged', () => {
    const op1 = { ...base, type: 'setProperty' as const, id: 'box-1', property: 'color' as const, value: '#FF0000' };
    const op2 = { ...server, type: 'delete' as const, id: 'box-2' };
    expect(transform(op1, op2).type).toBe('setProperty');
  });

  it('delete vs delete — same object → noop', () => {
    const op1 = { ...base, type: 'delete' as const, id: 'box-1' };
    const op2 = { ...server, type: 'delete' as const, id: 'box-1' };
    expect(transform(op1, op2).type).toBe('noop');
  });

  it('reparent vs delete — deleted parent → reparent to root', () => {
    const op1 = { ...base, type: 'reparent' as const, id: 'child', newParentId: 'parent-A', oldParentId: null };
    const op2 = { ...server, type: 'delete' as const, id: 'parent-A' };
    const result = transform(op1, op2);
    expect(result.type).toBe('reparent');
    expect(result.newParentId).toBeNull();
  });

  it('reparent vs reparent — same child → noop (first-to-server wins)', () => {
    const op1 = { ...base, type: 'reparent' as const, id: 'child', newParentId: 'parent-A', oldParentId: null };
    const op2 = { ...server, type: 'reparent' as const, id: 'child', newParentId: 'parent-B', oldParentId: null };
    expect(transform(op1, op2).type).toBe('noop');
  });
});

// ----------------------------------------------------------------
// Integration: explicit server-ordering semantics
// ----------------------------------------------------------------

describe('[Variant D] Server-first ordering semantics', () => {
  let env: TestEnv;

  beforeEach(() => { env = createTestEnv('D'); });
  afterEach(() => env.cleanup());

  it('alice wins same-property conflict because she flushes first', () => {
    const box: SceneObject = {
      id: 'box-1', type: 'box',
      position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1],
      color: '#FFFFFF', parentId: null, childIds: [],
    };

    env.alice.addObject('box-1', box);
    env.disableSync();

    env.alice.updateObject('box-1', { color: '#FF0000' });
    env.bob.updateObject('box-1',   { color: '#0000FF' });

    // enableSync() calls alice.flush() then bob.flush() (see createOTTestEnv)
    env.enableSync();

    const final = env.alice.getObject('box-1')!;
    expect(env.alice.getObject('box-1')).toEqual(env.bob.getObject('box-1'));

    // Bob's op is transformed to noop → alice's colour wins
    expect(final.color).toBe('#FF0000');
    console.log('[Variant D] same-property winner (alice): ', final.color);
  });

  it('both intents preserved when properties are different', () => {
    const box: SceneObject = {
      id: 'box-1', type: 'box',
      position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1],
      color: '#FFFFFF', parentId: null, childIds: [],
    };

    env.alice.addObject('box-1', box);
    env.disableSync();

    env.alice.updateObject('box-1', { position: [10, 0, 0] });
    env.bob.updateObject('box-1',   { color: '#0000FF' });

    env.enableSync();

    const final = env.alice.getObject('box-1')!;
    expect(env.alice.getObject('box-1')).toEqual(env.bob.getObject('box-1'));

    // Different properties → no conflict → both preserved
    expect(final.position).toEqual([10, 0, 0]);
    expect(final.color).toBe('#0000FF');
    console.log('[Variant D] different properties: both preserved ✓');
  });

  it('delete wins over a concurrent update (delete arrived first at server)', () => {
    const box: SceneObject = {
      id: 'box-1', type: 'box',
      position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1],
      color: '#FFFFFF', parentId: null, childIds: [],
    };

    env.alice.addObject('box-1', box);
    env.disableSync();

    env.alice.removeObject('box-1');
    env.bob.updateObject('box-1', { position: [99, 99, 99] });

    env.enableSync();

    expect(env.alice.getObject('box-1')).toBeUndefined();
    expect(env.bob.getObject('box-1')).toBeUndefined();
    console.log('[Variant D] delete wins: object absent ✓');
  });
});

// ----------------------------------------------------------------
// Multi-operation: create → concurrent edits
// ----------------------------------------------------------------

describe('[Variant D] Multi-step scenarios', () => {
  it('handles rapid sequential ops from one client followed by concurrent op from another', () => {
    const server = new InMemoryOTServer();
    const alice = new VariantDClient('alice', server);
    const bob   = new VariantDClient('bob',   server);

    const box: SceneObject = {
      id: 'box-1', type: 'box',
      position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1],
      color: '#FFFFFF', parentId: null, childIds: [],
    };

    alice.addObject('box-1', box);

    // Bob goes offline (pauses send + receive)
    bob.pause();

    // Alice does three sequential ops while online — each uses the confirmed
    // revision of the previous, so they are never transformed against each other.
    alice.updateObject('box-1', { position: [1, 0, 0] });
    alice.updateObject('box-1', { position: [2, 0, 0] });
    alice.updateObject('box-1', { position: [3, 0, 0] });

    // Bob concurrently changes color (stored with the revision before Alice's ops)
    bob.updateObject('box-1', { color: '#ABCDEF' });

    // Bob comes back online: first receives Alice's ops, then sends his own.
    // The server transforms Bob's color op against Alice's position ops —
    // different property → no conflict → both preserved.
    bob.flush();

    expect(alice.getObject('box-1')).toEqual(bob.getObject('box-1'));

    // Alice's last position value wins (all her ops applied sequentially)
    expect(alice.getObject('box-1')!.position).toEqual([3, 0, 0]);
    // Bob's color is preserved (different property)
    expect(alice.getObject('box-1')!.color).toBe('#ABCDEF');

    alice.destroy();
    bob.destroy();
  });
});
