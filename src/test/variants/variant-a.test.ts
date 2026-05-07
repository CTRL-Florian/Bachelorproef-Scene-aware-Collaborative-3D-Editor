/**
 * Variant A test suite — Object-level Last-Write-Wins
 *
 * Runs the shared five-scenario matrix plus Variant-A-specific assertions
 * that document the whole-object replacement behaviour.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestEnv } from '../../collaboration/factory';
import { runSharedScenarios } from './shared-scenarios';
import type { SceneObject, TestEnv } from '../../collaboration/types';

// Run the shared matrix
runSharedScenarios('Variant A', () => createTestEnv('A'));

// Variant-A-specific: document the data-loss behaviour
describe('[Variant A] Whole-object replacement — data loss documentation', () => {
  let env: TestEnv;

  beforeEach(() => { env = createTestEnv('A'); });
  afterEach(() => env.cleanup());

  it('loses the update of the peer that is overwritten', () => {
    const initial: SceneObject = {
      id: 'box-1',
      type: 'box',
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      color: '#FFFFFF',
      parentId: null,
      childIds: [],
    };

    env.alice.addObject('box-1', initial);
    env.disableSync();

    // Alice changes position only, Bob changes color only
    env.alice.updateObject('box-1', { position: [10, 0, 0] });
    env.bob.updateObject('box-1', { color: '#FF0000' });

    env.enableSync();

    const final = env.alice.getObject('box-1')!;
    expect(env.alice.getObject('box-1')).toEqual(env.bob.getObject('box-1'));

    const positionPreserved = JSON.stringify(final.position) === JSON.stringify([10, 0, 0]);
    const colorPreserved    = final.color === '#FF0000';
    const bothPreserved     = positionPreserved && colorPreserved;

    // Variant A CANNOT preserve both — one full object write wins.
    // We document which user's intent survives.
    console.log('[Variant A] data-loss scenario:', {
      positionPreserved,
      colorPreserved,
      bothPreserved,
      winner: positionPreserved && !colorPreserved ? 'alice'
            : colorPreserved && !positionPreserved ? 'bob'
            : bothPreserved ? 'both (unexpected for A)' : 'neither',
    });

    // The critical invariant: exactly one user's update survives (never both).
    expect(bothPreserved).toBe(false);
  });
});
