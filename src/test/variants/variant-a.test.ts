/**
 * Variant A — Object-level Last-Write-Wins (Y.Map<SceneObject>)
 *
 * Key property: the entire object is replaced atomically on every write.
 * Result: concurrent edits to *different* properties lose the losing peer's
 * entire snapshot, including properties they did not intend to change.
 *
 * This is documented as the "whole-object replacement" problem. The test
 * suite both proves convergence and quantifies the intent loss.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestEnv } from '../../collaboration/factory';
import { runSharedScenarios, BASELINE_CONFIG } from './shared-scenarios';
import type { SceneObject, TestEnv } from '../../collaboration/types';

// Variant A: no property-independence or delta-commutativity guarantees.
// The shared scenarios document its behaviour without expecting those guarantees.
runSharedScenarios('Variant A', () => createTestEnv('A'), BASELINE_CONFIG);

// ---------------------------------------------------------------------------
// Variant A specific: whole-object replacement and data loss quantification
// ---------------------------------------------------------------------------

describe('[Variant A] Whole-object replacement behaviour', () => {
  let env: TestEnv;
  beforeEach(() => { env = createTestEnv('A'); });
  afterEach(() => env.cleanup());

  it('EXACTLY ONE peer survives when two peers edit different properties', () => {
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

    const positionPreserved = JSON.stringify(final.position) === JSON.stringify([10, 0, 0]);
    const colorPreserved    = final.color === '#FF0000';

    console.log('[Variant A] different-property conflict:', {
      positionPreserved,
      colorPreserved,
      winner: positionPreserved && !colorPreserved ? 'alice'
            : colorPreserved && !positionPreserved ? 'bob'
            : 'both (unexpected)',
    });

    // Critical invariant: whole-object LWW means exactly one wins
    expect(positionPreserved && colorPreserved).toBe(false);
  });

  it('intent loss scales with number of concurrently edited properties', () => {
    env.alice.addObject('box-1', {
      id: 'box-1', type: 'box',
      position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1],
      color: '#FFFFFF', parentId: null, childIds: [],
    });
    env.disableSync();

    // Alice edits 3 independent properties
    env.alice.updateObject('box-1', { position: [10, 0, 0] });
    env.alice.updateObject('box-1', { rotation: [1, 0, 0] });
    env.alice.updateObject('box-1', { scale:    [2, 2, 2] });
    // Bob edits 1 property (color)
    env.bob.updateObject('box-1',   { color: '#FF0000' });

    env.enableSync();

    const final = env.alice.getObject('box-1')!;
    expect(env.alice.getObject('box-1')).toEqual(env.bob.getObject('box-1'));

    const preserved = [
      JSON.stringify(final.position) === JSON.stringify([10, 0, 0]),
      final.rotation[0] !== 0,
      JSON.stringify(final.scale) === JSON.stringify([2, 2, 2]),
      final.color === '#FF0000',
    ].filter(Boolean).length;

    console.log(`[Variant A] 3+1 property batch: ${preserved}/4 intents preserved`);
    // Cannot preserve all 4 with whole-object LWW
    expect(preserved).toBeLessThan(4);
  });

  it('same-property conflict: exactly one value wins (LWW determinism)', () => {
    env.alice.addObject('box-1', {
      id: 'box-1', type: 'box',
      position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1],
      color: '#FFFFFF', parentId: null, childIds: [],
    });
    env.disableSync();

    env.alice.updateObject('box-1', { color: '#AAAAAA' });
    env.bob.updateObject('box-1',   { color: '#BBBBBB' });

    env.enableSync();

    const final = env.alice.getObject('box-1')!;
    expect(env.alice.getObject('box-1')).toEqual(env.bob.getObject('box-1'));
    expect(['#AAAAAA', '#BBBBBB']).toContain(final.color);
    console.log('[Variant A] LWW color winner:', final.color);
  });

  it('object count stays correct after concurrent add and delete', () => {
    env.alice.addObject('box-1', { id: 'box-1', type: 'box', position: [0,0,0], rotation: [0,0,0], scale: [1,1,1], color: '#FFFFFF', parentId: null, childIds: [] });
    env.alice.addObject('box-2', { id: 'box-2', type: 'box', position: [0,0,0], rotation: [0,0,0], scale: [1,1,1], color: '#FFFFFF', parentId: null, childIds: [] });
    env.disableSync();

    env.alice.removeObject('box-1');
    env.bob.addObject('box-3', { id: 'box-3', type: 'box', position: [0,0,0], rotation: [0,0,0], scale: [1,1,1], color: '#00FF00', parentId: null, childIds: [] });

    env.enableSync();

    const countA = env.alice.getAllObjects().size;
    const countB = env.bob.getAllObjects().size;
    expect(countA).toBe(countB);
    expect(countA).toBe(2); // box-2 + box-3
    console.log('[Variant A] concurrent add+delete: final count =', countA);
  });
});
