/**
 * Variant C test suite — Delta-based operation log (Y.Array)
 *
 * Runs the shared five-scenario matrix plus Variant-C-specific assertions
 * that verify the commutativity of moveObject().
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestEnv } from '../../collaboration/factory';
import { runSharedScenarios } from './shared-scenarios';
import type { SceneObject, TestEnv } from '../../collaboration/types';

runSharedScenarios('Variant C', () => createTestEnv('C'));

describe('[Variant C] Commutative delta moves', () => {
  let env: TestEnv;

  beforeEach(() => { env = createTestEnv('C'); });
  afterEach(() => env.cleanup());

  it('applies BOTH concurrent move deltas (sum semantics)', () => {
    const initial: SceneObject = {
      id: 'box-1', type: 'box',
      position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1],
      color: '#FFFFFF', parentId: null, childIds: [],
    };

    env.alice.addObject('box-1', initial);
    env.disableSync();

    env.alice.moveObject('box-1', [5, 0, 0]);
    env.bob.moveObject('box-1', [3, 0, 0]);

    env.enableSync();

    const final = env.alice.getObject('box-1')!;
    expect(env.alice.getObject('box-1')).toEqual(env.bob.getObject('box-1'));

    // Both deltas must be applied: 0 + 5 + 3 = 8
    expect(final.position[0]).toBeCloseTo(8);
    console.log('[Variant C] Delta-move result x:', final.position[0], '(expected 8)');
  });

  it('handles three concurrent move deltas from different axes', () => {
    env.alice.addObject('box-1', {
      id: 'box-1', type: 'box',
      position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1],
      color: '#FFFFFF', parentId: null, childIds: [],
    });
    env.disableSync();

    env.alice.moveObject('box-1', [10, 0, 0]);
    env.bob.moveObject('box-1',  [0, 7, 0]);

    env.enableSync();

    const final = env.alice.getObject('box-1')!;
    expect(env.alice.getObject('box-1')).toEqual(env.bob.getObject('box-1'));

    expect(final.position[0]).toBeCloseTo(10);
    expect(final.position[1]).toBeCloseTo(7);
  });

  it('is commutative: order of flushing does not affect the final position', () => {
    // env1: alice flushes first
    const env1 = createTestEnv('C');
    env1.alice.addObject('box-1', {
      id: 'box-1', type: 'box',
      position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1],
      color: '#FFFFFF', parentId: null, childIds: [],
    });
    env1.disableSync();
    env1.alice.moveObject('box-1', [5, 0, 0]);
    env1.bob.moveObject('box-1',   [3, 0, 0]);
    env1.enableSync();
    const result1 = env1.alice.getObject('box-1')!.position;
    env1.cleanup();

    // For Y.js variants, order of sync matters only for LWW ties.
    // For Variant C with delta moves, the final result must be identical
    // regardless of who "flushed" first because addition is commutative.
    const env2 = createTestEnv('C');
    env2.alice.addObject('box-1', {
      id: 'box-1', type: 'box',
      position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1],
      color: '#FFFFFF', parentId: null, childIds: [],
    });
    env2.disableSync();
    env2.bob.moveObject('box-1',   [3, 0, 0]);  // bob first this time
    env2.alice.moveObject('box-1', [5, 0, 0]);
    env2.enableSync();
    const result2 = env2.alice.getObject('box-1')!.position;
    env2.cleanup();

    expect(result1[0]).toBeCloseTo(result2[0]);
    console.log('[Variant C] Commutativity: env1.x=', result1[0], 'env2.x=', result2[0]);
  });

  it('updateObject with absolute position is NOT commutative (LWW for setPosition ops)', () => {
    const env1 = createTestEnv('C');
    env1.alice.addObject('box-1', {
      id: 'box-1', type: 'box',
      position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1],
      color: '#FFFFFF', parentId: null, childIds: [],
    });
    env1.disableSync();

    // Using updateObject (absolute) rather than moveObject (delta)
    env1.alice.updateObject('box-1', { position: [10, 0, 0] });
    env1.bob.updateObject('box-1',   { position: [5, 0, 0] });

    env1.enableSync();

    const final = env1.alice.getObject('box-1')!;
    expect(env1.alice.getObject('box-1')).toEqual(env1.bob.getObject('box-1'));
    // One of the two absolute values wins — they cannot both be true
    expect([10, 5]).toContain(final.position[0]);
    console.log('[Variant C] Absolute setPosition winner x:', final.position[0]);
    env1.cleanup();
  });
});
