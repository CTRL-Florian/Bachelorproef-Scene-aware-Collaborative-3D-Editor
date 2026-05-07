/**
 * Variant B test suite — Property-level CRDT (nested Y.Map)
 *
 * Runs the shared five-scenario matrix plus Variant-B-specific assertions
 * that verify property-level intent preservation.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestEnv } from '../../collaboration/factory';
import { runSharedScenarios } from './shared-scenarios';
import type { SceneObject, TestEnv } from '../../collaboration/types';

runSharedScenarios('Variant B', () => createTestEnv('B'));

describe('[Variant B] Property-level intent preservation', () => {
  let env: TestEnv;

  beforeEach(() => { env = createTestEnv('B'); });
  afterEach(() => env.cleanup());

  it('preserves BOTH position and color when edited concurrently by different peers', () => {
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

    env.alice.updateObject('box-1', { position: [10, 0, 0] });
    env.bob.updateObject('box-1', { color: '#FF0000' });

    env.enableSync();

    const final = env.alice.getObject('box-1')!;
    expect(env.alice.getObject('box-1')).toEqual(env.bob.getObject('box-1'));

    // Variant B MUST preserve both independent property edits
    expect(final.position).toEqual([10, 0, 0]);
    expect(final.color).toBe('#FF0000');

    console.log('[Variant B] Both intents preserved:', {
      position: final.position,
      color: final.color,
    });
  });

  it('preserves all three independent property edits from three dimensions of change', () => {
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

    env.alice.updateObject('box-1', { position: [5, 5, 5] });
    env.bob.updateObject('box-1', { rotation: [Math.PI / 4, 0, 0], color: '#00FF00' });

    env.enableSync();

    const final = env.alice.getObject('box-1')!;
    expect(env.alice.getObject('box-1')).toEqual(env.bob.getObject('box-1'));

    expect(final.position).toEqual([5, 5, 5]);
    expect(final.color).toBe('#00FF00');
    expect(final.rotation[0]).toBeCloseTo(Math.PI / 4);
  });

  it('still uses LWW when the same property is edited concurrently', () => {
    env.alice.addObject('box-1', {
      id: 'box-1', type: 'box',
      position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1],
      color: '#FFFFFF', parentId: null, childIds: [],
    });
    env.disableSync();

    env.alice.updateObject('box-1', { color: '#FF0000' });
    env.bob.updateObject('box-1', { color: '#0000FF' });

    env.enableSync();

    const final = env.alice.getObject('box-1')!;
    expect(env.alice.getObject('box-1')).toEqual(env.bob.getObject('box-1'));
    // One of the two values must win — they cannot both be true
    expect(['#FF0000', '#0000FF']).toContain(final.color);
    console.log('[Variant B] Same-property LWW winner:', final.color);
  });
});
