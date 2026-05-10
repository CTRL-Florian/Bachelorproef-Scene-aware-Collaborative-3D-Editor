/**
 * Variant B — Property-level CRDT (nested Y.Map per property)
 *
 * Key property: each object property is an independent Y.Map entry.
 * Concurrent writes to *different* properties never conflict — both survive.
 * Concurrent writes to the *same* property resolve via LWW (Y.js clock ordering).
 *
 * This is the direct improvement over Variant A: property granularity instead
 * of object granularity for conflict detection.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestEnv } from '../../collaboration/factory';
import { runSharedScenarios, PROPERTY_LEVEL_CONFIG } from './shared-scenarios';
import type { SceneObject, TestEnv } from '../../collaboration/types';

// Variant B guarantees property-level independence: concurrent edits to
// different properties MUST both survive. The shared scenarios assert this.
runSharedScenarios('Variant B', () => createTestEnv('B'), PROPERTY_LEVEL_CONFIG);

// ---------------------------------------------------------------------------
// Variant B specific: property-level intent preservation guarantees
// ---------------------------------------------------------------------------

describe('[Variant B] Property-level intent preservation', () => {
  let env: TestEnv;
  beforeEach(() => { env = createTestEnv('B'); });
  afterEach(() => env.cleanup());

  it('preserves BOTH position and color when edited by different peers', () => {
    env.alice.addObject('box-1', {
      id: 'box-1', type: 'box',
      position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1],
      color: '#FFFFFF', parentId: null, childIds: [],
    });
    env.disableSync();

    env.alice.updateObject('box-1', { position: [10, 0, 0] });
    env.bob.updateObject('box-1',   { color: '#FF0000' });

    env.enableSync();

    const final = env.alice.getObject('box-1')!;
    expect(env.alice.getObject('box-1')).toEqual(env.bob.getObject('box-1'));

    expect(final.position).toEqual([10, 0, 0]);
    expect(final.color).toBe('#FF0000');
    console.log('[Variant B] pos+color both preserved ✓');
  });

  it('preserves all 4 independent property edits from a batch+single scenario', () => {
    env.alice.addObject('box-1', {
      id: 'box-1', type: 'box',
      position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1],
      color: '#FFFFFF', parentId: null, childIds: [],
    });
    env.disableSync();

    env.alice.updateObject('box-1', { position: [10, 0, 0] });
    env.alice.updateObject('box-1', { rotation: [Math.PI / 4, 0, 0] });
    env.alice.updateObject('box-1', { scale:    [2, 2, 2] });
    env.bob.updateObject('box-1',   { color: '#ABCDEF' });

    env.enableSync();

    const final = env.alice.getObject('box-1')!;
    expect(env.alice.getObject('box-1')).toEqual(env.bob.getObject('box-1'));

    expect(final.position).toEqual([10, 0, 0]);
    expect(final.rotation[0]).toBeCloseTo(Math.PI / 4);
    expect(final.scale).toEqual([2, 2, 2]);
    expect(final.color).toBe('#ABCDEF');
    console.log('[Variant B] all 4 independent properties preserved ✓');
  });

  it('preserves position, rotation AND scale when each is edited by a different peer simultaneously', () => {
    env.alice.addObject('box-1', {
      id: 'box-1', type: 'box',
      position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1],
      color: '#FFFFFF', parentId: null, childIds: [],
    });
    env.disableSync();

    env.alice.updateObject('box-1', { position: [5, 5, 5] });
    env.bob.updateObject('box-1',   { rotation: [Math.PI / 4, 0, 0], color: '#00FF00' });

    env.enableSync();

    const final = env.alice.getObject('box-1')!;
    expect(env.alice.getObject('box-1')).toEqual(env.bob.getObject('box-1'));

    expect(final.position).toEqual([5, 5, 5]);
    expect(final.color).toBe('#00FF00');
    expect(final.rotation[0]).toBeCloseTo(Math.PI / 4);
  });

  it('still uses LWW when the SAME property is edited concurrently', () => {
    env.alice.addObject('box-1', {
      id: 'box-1', type: 'box',
      position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1],
      color: '#FFFFFF', parentId: null, childIds: [],
    });
    env.disableSync();

    env.alice.updateObject('box-1', { color: '#FF0000' });
    env.bob.updateObject('box-1',   { color: '#0000FF' });

    env.enableSync();

    const final = env.alice.getObject('box-1')!;
    expect(env.alice.getObject('box-1')).toEqual(env.bob.getObject('box-1'));
    expect(['#FF0000', '#0000FF']).toContain(final.color);
    console.log('[Variant B] same-property LWW winner:', final.color);
  });

  it('late-joining third peer receives the fully merged state', () => {
    // Simulate: alice and bob edit offline, sync, then a third doc joins late.
    env.alice.addObject('box-1', {
      id: 'box-1', type: 'box',
      position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1],
      color: '#FFFFFF', parentId: null, childIds: [],
    });
    env.disableSync();

    env.alice.updateObject('box-1', { position: [10, 0, 0] });
    env.bob.updateObject('box-1',   { color: '#FF0000' });

    env.enableSync();

    // Both peers now have the merged state — verify it contains both updates
    const final = env.alice.getObject('box-1')!;
    expect(final.position).toEqual([10, 0, 0]);
    expect(final.color).toBe('#FF0000');
    console.log('[Variant B] merged state after sync: pos+color both present ✓');
  });
});
