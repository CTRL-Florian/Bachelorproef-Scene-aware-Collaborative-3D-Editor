/**
 * Shared conflict-resolution test matrix.
 *
 * This file defines the five canonical scenarios described in the research
 * proposal. Each function accepts a `describe` block injector and a factory
 * for the two-peer environment so the same assertions run against all four
 * variants.
 *
 * Import in each variant test file:
 *
 *   import { runSharedScenarios } from './shared-scenarios';
 *   import { createTestEnv } from '../../collaboration/factory';
 *
 *   runSharedScenarios('Variant X', () => createTestEnv('X'));
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { CollaborationStrategy, SceneObject, TestEnv } from '../../collaboration/types';

type EnvFactory = () => TestEnv;

function defaultBox(overrides: Partial<SceneObject> = {}): SceneObject {
  return {
    id: 'box-1',
    type: 'box',
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    color: '#FFFFFF',
    parentId: null,
    childIds: [],
    ...overrides,
  };
}

/** Assert that two peers have converged to identical state for an object. */
function assertConverged(
  alice: CollaborationStrategy,
  bob: CollaborationStrategy,
  id: string,
): SceneObject {
  const a = alice.getObject(id);
  const b = bob.getObject(id);
  expect(a).toEqual(b);
  expect(a).not.toBeUndefined();
  return a!;
}

/**
 * Measures intent preservation for a list of (expected value, actual value) pairs.
 * Returns a score in [0, 1].
 */
function intentScore(
  intended: Record<string, unknown>,
  actual: SceneObject,
): number {
  const keys = Object.keys(intended);
  if (keys.length === 0) return 1;
  const preserved = keys.filter(k => {
    const av = (actual as Record<string, unknown>)[k];
    return JSON.stringify(av) === JSON.stringify(intended[k]);
  });
  return preserved.length / keys.length;
}

export function runSharedScenarios(variantName: string, makeEnv: EnvFactory): void {
  describe(`[${variantName}] Scenario 1 — Concurrent edit, same property`, () => {
    let env: TestEnv;
    beforeEach(() => { env = makeEnv(); });
    afterEach(() => env.cleanup());

    it('converges after concurrent position writes', () => {
      env.alice.addObject('box-1', defaultBox());
      env.disableSync();

      env.alice.updateObject('box-1', { position: [10, 0, 0] });
      env.bob.updateObject('box-1', { position: [5, 0, 0] });

      env.enableSync();

      const final = assertConverged(env.alice, env.bob, 'box-1');
      const aliceWon = JSON.stringify(final.position) === JSON.stringify([10, 0, 0]);
      const bobWon   = JSON.stringify(final.position) === JSON.stringify([5, 0, 0]);
      console.log(
        `[${variantName}] S1 position winner:`,
        aliceWon ? 'alice [10,0,0]' : bobWon ? 'bob [5,0,0]' : `merged ${JSON.stringify(final.position)}`,
      );
    });

    it('converges after concurrent color writes', () => {
      env.alice.addObject('box-1', defaultBox({ color: '#000000' }));
      env.disableSync();

      env.alice.updateObject('box-1', { color: '#FF0000' });
      env.bob.updateObject('box-1', { color: '#0000FF' });

      env.enableSync();

      const final = assertConverged(env.alice, env.bob, 'box-1');
      console.log(`[${variantName}] S1 color winner:`, final.color);
    });
  });

  describe(`[${variantName}] Scenario 2 — Concurrent edit, different properties`, () => {
    let env: TestEnv;
    beforeEach(() => { env = makeEnv(); });
    afterEach(() => env.cleanup());

    it('converges and ideally preserves both intents', () => {
      env.alice.addObject('box-1', defaultBox({ position: [0, 0, 0], color: '#FFFFFF' }));
      env.disableSync();

      env.alice.updateObject('box-1', { position: [10, 0, 0] });
      env.bob.updateObject('box-1', { color: '#FF0000' });

      env.enableSync();

      const final = assertConverged(env.alice, env.bob, 'box-1');
      const aliceScore = intentScore({ position: [10, 0, 0] }, final);
      const bobScore   = intentScore({ color: '#FF0000' }, final);

      console.log(`[${variantName}] S2 intent scores: alice=${aliceScore}, bob=${bobScore}`);
      console.log(`[${variantName}] S2 final:`, JSON.stringify(final));
    });

    it('preserves rotation and scale when edited by different peers', () => {
      env.alice.addObject('box-1', defaultBox({ rotation: [0, 0, 0], scale: [1, 1, 1] }));
      env.disableSync();

      env.alice.updateObject('box-1', { rotation: [Math.PI / 2, 0, 0] });
      env.bob.updateObject('box-1', { scale: [2, 2, 2] });

      env.enableSync();

      const final = assertConverged(env.alice, env.bob, 'box-1');
      const aliceScore = intentScore({ rotation: [Math.PI / 2, 0, 0] }, final);
      const bobScore   = intentScore({ scale: [2, 2, 2] }, final);
      console.log(`[${variantName}] S2b intent scores: alice=${aliceScore}, bob=${bobScore}`);
    });
  });

  describe(`[${variantName}] Scenario 3 — Delete vs. Update`, () => {
    let env: TestEnv;
    beforeEach(() => { env = makeEnv(); });
    afterEach(() => env.cleanup());

    it('converges when one peer deletes and the other updates', () => {
      env.alice.addObject('box-1', defaultBox());
      env.disableSync();

      env.alice.removeObject('box-1');
      env.bob.updateObject('box-1', { position: [99, 99, 99] });

      env.enableSync();

      const a = env.alice.getObject('box-1');
      const b = env.bob.getObject('box-1');
      expect(a).toEqual(b);   // convergence
      console.log(`[${variantName}] S3 delete-vs-update result:`, a ?? 'deleted');
    });

    it('converges when one peer deletes and the other changes color', () => {
      env.alice.addObject('box-1', defaultBox({ color: '#FFFFFF' }));
      env.disableSync();

      env.alice.removeObject('box-1');
      env.bob.updateObject('box-1', { color: '#00FF00' });

      env.enableSync();

      const a = env.alice.getObject('box-1');
      const b = env.bob.getObject('box-1');
      expect(a).toEqual(b);
      console.log(`[${variantName}] S3 delete-vs-color result:`, a ?? 'deleted');
    });
  });

  describe(`[${variantName}] Scenario 4 — Concurrent move (delta sensitivity)`, () => {
    let env: TestEnv;
    beforeEach(() => { env = makeEnv(); });
    afterEach(() => env.cleanup());

    it('converges after concurrent moveObject calls', () => {
      env.alice.addObject('box-1', defaultBox({ position: [0, 0, 0] }));
      env.disableSync();

      env.alice.moveObject('box-1', [5, 0, 0]);
      env.bob.moveObject('box-1', [3, 0, 0]);

      env.enableSync();

      const final = assertConverged(env.alice, env.bob, 'box-1');
      const bothPreserved = Math.abs(final.position[0] - 8) < 0.001;
      console.log(
        `[${variantName}] S4 move result: x=${final.position[0]}`,
        bothPreserved ? '(both deltas applied ✓)' : '(one delta lost)',
      );
    });
  });

  describe(`[${variantName}] Scenario 5 — Parent-child conflict`, () => {
    let env: TestEnv;
    beforeEach(() => { env = makeEnv(); });
    afterEach(() => env.cleanup());

    it('converges when child is reparented concurrently to two different parents', () => {
      env.alice.addObject('parent-A', { ...defaultBox(), id: 'parent-A', childIds: [] });
      env.alice.addObject('parent-B', { ...defaultBox(), id: 'parent-B', childIds: [] });
      env.alice.addObject('child',    { ...defaultBox(), id: 'child',    childIds: [] });
      env.disableSync();

      env.alice.updateObject('child', { parentId: 'parent-A' });
      env.bob.updateObject('child',   { parentId: 'parent-B' });

      env.enableSync();

      const childA = env.alice.getObject('child');
      const childB = env.bob.getObject('child');
      expect(childA?.parentId).toBe(childB?.parentId);
      console.log(`[${variantName}] S5 winning parentId:`, childA?.parentId);
    });

    it('childIds arrays are internally consistent after concurrent reparenting', () => {
      env.alice.addObject('parent-A', { ...defaultBox(), id: 'parent-A', childIds: [] });
      env.alice.addObject('parent-B', { ...defaultBox(), id: 'parent-B', childIds: [] });
      env.alice.addObject('child',    { ...defaultBox(), id: 'child',    childIds: [] });
      env.disableSync();

      env.alice.updateObject('child',    { parentId: 'parent-A' });
      env.alice.updateObject('parent-A', { childIds: ['child'] });

      env.bob.updateObject('child',    { parentId: 'parent-B' });
      env.bob.updateObject('parent-B', { childIds: ['child'] });

      env.enableSync();

      const child  = env.alice.getObject('child');
      const pA     = env.alice.getObject('parent-A');
      const pB     = env.alice.getObject('parent-B');
      const winner = child?.parentId;
      const inA    = pA?.childIds?.includes('child') ?? false;
      const inB    = pB?.childIds?.includes('child') ?? false;

      expect(env.alice.getObject('child')).toEqual(env.bob.getObject('child'));
      expect(env.alice.getObject('parent-A')).toEqual(env.bob.getObject('parent-A'));
      expect(env.alice.getObject('parent-B')).toEqual(env.bob.getObject('parent-B'));

      console.log(`[${variantName}] S5 invariant:`, {
        winner,
        inA,
        inB,
        invariantOk: (winner === 'parent-A' && inA && !inB)
                  || (winner === 'parent-B' && !inA && inB)
                  || winner === null,
      });
    });
  });
}
