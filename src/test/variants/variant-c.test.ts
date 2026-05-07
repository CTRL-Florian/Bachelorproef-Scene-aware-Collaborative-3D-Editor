/**
 * Variant C — Delta-based operation log (Y.Array<Op>)
 *
 * Key properties:
 *   1. moveObject() appends a delta (Δx, Δy, Δz) to the log — concurrent deltas
 *      are commutative: Δ1 + Δ2 = Δ2 + Δ1. Both always survive.
 *   2. updateObject() with an absolute position appends a setPosition op, which
 *      is LWW (the last absolute value in the log wins).
 *   3. The entire scene is derived by replaying the append-only log on every
 *      change, so the log is the ground truth.
 *
 * Academic grounding:
 *   - Commutativity: Preguiça et al. 2018 (CmRDT property)
 *   - Append-only log for 3D: Zhou et al. 2023 (list CRDT for 3D editors)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestEnv } from '../../collaboration/factory';
import { runSharedScenarios } from './shared-scenarios';
import type { SceneObject, TestEnv } from '../../collaboration/types';

runSharedScenarios('Variant C', () => createTestEnv('C'));

// ---------------------------------------------------------------------------
// Variant C specific: commutativity and log accumulation
// ---------------------------------------------------------------------------

describe('[Variant C] Commutative delta moves', () => {
  let env: TestEnv;
  beforeEach(() => { env = createTestEnv('C'); });
  afterEach(() => env.cleanup());

  it('applies BOTH concurrent move deltas — result is the sum', () => {
    env.alice.addObject('box-1', {
      id: 'box-1', type: 'box',
      position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1],
      color: '#FFFFFF', parentId: null, childIds: [],
    });
    env.disableSync();

    env.alice.moveObject('box-1', [5, 0, 0]);
    env.bob.moveObject('box-1',   [3, 0, 0]);

    env.enableSync();

    const final = env.alice.getObject('box-1')!;
    expect(env.alice.getObject('box-1')).toEqual(env.bob.getObject('box-1'));
    // 0 + 5 + 3 = 8
    expect(final.position[0]).toBeCloseTo(8);
    console.log('[Variant C] Δ5 + Δ3 = x:', final.position[0], '(expected 8 ✓)');
  });

  it('two-axis concurrent moves both applied independently', () => {
    env.alice.addObject('box-1', {
      id: 'box-1', type: 'box',
      position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1],
      color: '#FFFFFF', parentId: null, childIds: [],
    });
    env.disableSync();

    env.alice.moveObject('box-1', [10, 0, 0]);  // move along X
    env.bob.moveObject('box-1',   [0,  7, 0]);  // move along Y

    env.enableSync();

    const final = env.alice.getObject('box-1')!;
    expect(env.alice.getObject('box-1')).toEqual(env.bob.getObject('box-1'));
    expect(final.position[0]).toBeCloseTo(10);
    expect(final.position[1]).toBeCloseTo(7);
    console.log('[Variant C] X+Y independent deltas:', final.position);
  });

  it('is commutative: flush order does not change the final position', () => {
    // Order 1: alice first
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
    const x1 = env1.alice.getObject('box-1')!.position[0];
    env1.cleanup();

    // Order 2: bob first (swap the order inside enableSync)
    // We recreate a fresh env and call the same moves but rely on Y.js to merge
    // commutatively — both orderings must give x=8.
    const env2 = createTestEnv('C');
    env2.alice.addObject('box-1', {
      id: 'box-1', type: 'box',
      position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1],
      color: '#FFFFFF', parentId: null, childIds: [],
    });
    env2.disableSync();
    env2.bob.moveObject('box-1',   [3, 0, 0]);
    env2.alice.moveObject('box-1', [5, 0, 0]);
    env2.enableSync();
    const x2 = env2.alice.getObject('box-1')!.position[0];
    env2.cleanup();

    expect(x1).toBeCloseTo(8);
    expect(x2).toBeCloseTo(8);
    expect(x1).toBeCloseTo(x2);
    console.log('[Variant C] Commutativity: x1=', x1, 'x2=', x2, '(both 8 ✓)');
  });

  it('accumulates many sequential moves from one peer correctly', () => {
    env.alice.addObject('box-1', {
      id: 'box-1', type: 'box',
      position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1],
      color: '#FFFFFF', parentId: null, childIds: [],
    });

    // Sequential moves — no concurrency — should accumulate
    env.alice.moveObject('box-1', [1, 0, 0]);
    env.alice.moveObject('box-1', [1, 0, 0]);
    env.alice.moveObject('box-1', [1, 0, 0]);
    env.alice.moveObject('box-1', [1, 0, 0]);
    env.alice.moveObject('box-1', [1, 0, 0]);

    const final = env.alice.getObject('box-1')!;
    expect(final.position[0]).toBeCloseTo(5);
    console.log('[Variant C] 5 sequential +1 deltas: x=', final.position[0], '(expected 5 ✓)');
  });
});

describe('[Variant C] Absolute vs. delta writes', () => {
  let env: TestEnv;
  beforeEach(() => { env = createTestEnv('C'); });
  afterEach(() => env.cleanup());

  it('updateObject (absolute setPosition) is LWW — not commutative', () => {
    env.alice.addObject('box-1', {
      id: 'box-1', type: 'box',
      position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1],
      color: '#FFFFFF', parentId: null, childIds: [],
    });
    env.disableSync();

    env.alice.updateObject('box-1', { position: [10, 0, 0] });
    env.bob.updateObject('box-1',   { position: [5,  0, 0] });

    env.enableSync();

    const final = env.alice.getObject('box-1')!;
    expect(env.alice.getObject('box-1')).toEqual(env.bob.getObject('box-1'));
    expect([10, 5]).toContain(final.position[0]);
    // Result is NOT 15 — this is LWW, not summation
    expect(final.position[0]).not.toBeCloseTo(15);
    console.log('[Variant C] Absolute LWW winner x:', final.position[0], '(NOT 15 ✓)');
  });

  it('mixing absolute and delta: delta applied on top of the LWW absolute', () => {
    env.alice.addObject('box-1', {
      id: 'box-1', type: 'box',
      position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1],
      color: '#FFFFFF', parentId: null, childIds: [],
    });

    // Alice sets an absolute position, then bob moves relative
    env.alice.updateObject('box-1', { position: [10, 0, 0] });
    env.bob.moveObject('box-1', [3, 0, 0]);

    const final = env.alice.getObject('box-1')!;
    expect(env.alice.getObject('box-1')).toEqual(env.bob.getObject('box-1'));
    // 10 + 3 = 13
    expect(final.position[0]).toBeCloseTo(13);
    console.log('[Variant C] setPosition(10) + moveObject(+3): x=', final.position[0], '(expected 13 ✓)');
  });

  it('concurrent delta move + independent color change: both preserved', () => {
    env.alice.addObject('box-1', {
      id: 'box-1', type: 'box',
      position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1],
      color: '#FFFFFF', parentId: null, childIds: [],
    });
    env.disableSync();

    env.alice.moveObject('box-1',   [5, 0, 0]);
    env.bob.updateObject('box-1', { color: '#AABBCC' });

    env.enableSync();

    const final = env.alice.getObject('box-1')!;
    expect(env.alice.getObject('box-1')).toEqual(env.bob.getObject('box-1'));
    expect(final.position[0]).toBeCloseTo(5);
    expect(final.color).toBe('#AABBCC');
    console.log('[Variant C] delta move + color: x=', final.position[0], 'color=', final.color, '✓');
  });
});
