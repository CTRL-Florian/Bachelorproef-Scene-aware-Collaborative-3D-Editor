/**
 * Shared conflict-resolution test matrix — all scenarios run against every variant.
 *
 * Scenarios cover:
 *   S1  — Same property conflict (LWW race)
 *   S2  — Different property conflict (intent preservation)
 *   S3  — Delete vs. concurrent update
 *   S4  — Concurrent delta moves (commutativity probe)
 *   S5  — Concurrent reparenting (parent-child integrity)
 *   S6  — Concurrent object creation with the same ID
 *   S7  — Delete parent while child is being edited (orphan problem)
 *   S8  — Batch ops from one peer vs. single op from another
 *   S9  — Idempotent double-delete
 *   S10 — Concurrent linkObject to different parents
 *
 * Each scenario logs a structured verdict line so results are easy to compare
 * across variants in the terminal output.
 *
 * Academic grounding:
 *   - S1/S2: Sun & Ellis 1998 (TP1, intent preservation)
 *   - S3:    situations.md §7, Sun et al. 2012 (CCR)
 *   - S4:    Preguiça 2018 (commutativity of CmRDTs), Zhou 2023 (3D list CRDTs)
 *   - S5:    situations.md §5, Zhou 2023 (hierarchy conflicts)
 *   - S6:    situations.md §9 (concurrent add, same ID)
 *   - S7:    situations.md §7, cascading deletes
 *   - S8:    situations.md §8 (batch / netto operations)
 *   - S9:    Shapiro 2011 (idempotence of CmRDTs)
 *   - S10:   situations.md §4 (concurrent linking)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { CollaborationStrategy, SceneObject, TestEnv } from '../../collaboration/types';

type EnvFactory = () => TestEnv;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function defaultBox(overrides: Partial<SceneObject> = {}): SceneObject {
  return {
    id: 'box-1',
    type: 'box',
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale:    [1, 1, 1],
    color:    '#FFFFFF',
    parentId: null,
    childIds: [],
    ...overrides,
  };
}

/** Assert convergence and return the converged object. */
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

/** Assert convergence when both peers may have deleted the object. */
function assertConvergedOrDeleted(
  alice: CollaborationStrategy,
  bob: CollaborationStrategy,
  id: string,
): SceneObject | undefined {
  const a = alice.getObject(id);
  const b = bob.getObject(id);
  expect(a).toEqual(b);
  return a;
}

/**
 * Intent-preservation score [0, 1].
 * Counts how many of the caller's intended properties appear unchanged in the
 * final converged state.
 */
function intentScore(intended: Record<string, unknown>, actual: SceneObject): number {
  const keys = Object.keys(intended);
  if (keys.length === 0) return 1;
  const preserved = keys.filter(k => {
    const av = (actual as Record<string, unknown>)[k];
    return JSON.stringify(av) === JSON.stringify(intended[k]);
  });
  return preserved.length / keys.length;
}

/**
 * Print a structured result line.
 *
 * Example output:
 *   [Variant B] S2  converged=✓  alice=100%  bob=100%  BOTH PRESERVED
 *   [Variant A] S2  converged=✓  alice=0%    bob=100%  INTENT LOST
 */
function report(
  variant: string,
  scenario: string,
  opts: {
    converged: boolean;
    aliceScore?: number;
    bobScore?: number;
    note?: string;
  },
): void {
  const { converged, aliceScore, bobScore, note } = opts;
  const conv = converged ? '✓' : '✗';

  const intentParts: string[] = [];
  if (aliceScore !== undefined) intentParts.push(`alice=${Math.round(aliceScore * 100)}%`);
  if (bobScore   !== undefined) intentParts.push(`bob=${Math.round(bobScore * 100)}%`);

  let verdict = '';
  if (aliceScore !== undefined && bobScore !== undefined) {
    if (aliceScore === 1 && bobScore === 1) verdict = 'BOTH PRESERVED';
    else if (aliceScore === 0 || bobScore === 0) verdict = 'INTENT LOST';
    else verdict = 'PARTIAL';
  }

  const parts = [
    `[${variant}] ${scenario}`,
    `converged=${conv}`,
    ...intentParts,
    verdict,
    note ?? '',
  ].filter(Boolean);

  console.log(parts.join('  '));
}

// ---------------------------------------------------------------------------
// Shared scenario suite
// ---------------------------------------------------------------------------

export function runSharedScenarios(variantName: string, makeEnv: EnvFactory): void {

  // ── S1: Same property ────────────────────────────────────────────────────

  describe(`[${variantName}] S1 — Concurrent edit, same property`, () => {
    let env: TestEnv;
    beforeEach(() => { env = makeEnv(); });
    afterEach(() => env.cleanup());

    it('converges after concurrent position writes (LWW expected)', () => {
      env.alice.addObject('box-1', defaultBox());
      env.disableSync();

      env.alice.updateObject('box-1', { position: [10, 0, 0] });
      env.bob.updateObject('box-1',   { position: [5,  0, 0] });

      env.enableSync();

      const final = assertConverged(env.alice, env.bob, 'box-1');
      const aliceWon = JSON.stringify(final.position) === JSON.stringify([10, 0, 0]);
      const bobWon   = JSON.stringify(final.position) === JSON.stringify([5,  0, 0]);
      const winner   = aliceWon ? 'alice [10,0,0]' : bobWon ? 'bob [5,0,0]' : `merged ${JSON.stringify(final.position)}`;

      report(variantName, 'S1-position', {
        converged: true,
        aliceScore: aliceWon ? 1 : 0,
        bobScore:   bobWon   ? 1 : 0,
        note: `winner=${winner}`,
      });
    });

    it('converges after concurrent color writes (LWW expected)', () => {
      env.alice.addObject('box-1', defaultBox({ color: '#000000' }));
      env.disableSync();

      env.alice.updateObject('box-1', { color: '#FF0000' });
      env.bob.updateObject('box-1',   { color: '#0000FF' });

      env.enableSync();

      const final = assertConverged(env.alice, env.bob, 'box-1');
      const aliceWon = final.color === '#FF0000';
      const bobWon   = final.color === '#0000FF';

      report(variantName, 'S1-color', {
        converged: true,
        aliceScore: aliceWon ? 1 : 0,
        bobScore:   bobWon   ? 1 : 0,
        note: `winner=${final.color}`,
      });
    });
  });

  // ── S2: Different properties ──────────────────────────────────────────────

  describe(`[${variantName}] S2 — Concurrent edit, different properties`, () => {
    let env: TestEnv;
    beforeEach(() => { env = makeEnv(); });
    afterEach(() => env.cleanup());

    it('preserves both intents when position vs. color are edited', () => {
      env.alice.addObject('box-1', defaultBox({ position: [0, 0, 0], color: '#FFFFFF' }));
      env.disableSync();

      env.alice.updateObject('box-1', { position: [10, 0, 0] });
      env.bob.updateObject('box-1',   { color: '#FF0000' });

      env.enableSync();

      const final = assertConverged(env.alice, env.bob, 'box-1');
      const as = intentScore({ position: [10, 0, 0] }, final);
      const bs = intentScore({ color: '#FF0000' },     final);

      report(variantName, 'S2-pos+color', { converged: true, aliceScore: as, bobScore: bs });
    });

    it('preserves both intents when rotation vs. scale are edited', () => {
      env.alice.addObject('box-1', defaultBox({ rotation: [0, 0, 0], scale: [1, 1, 1] }));
      env.disableSync();

      env.alice.updateObject('box-1', { rotation: [Math.PI / 2, 0, 0] });
      env.bob.updateObject('box-1',   { scale:    [2, 2, 2] });

      env.enableSync();

      const final = assertConverged(env.alice, env.bob, 'box-1');
      const as = intentScore({ rotation: [Math.PI / 2, 0, 0] }, final);
      const bs = intentScore({ scale: [2, 2, 2] },               final);

      report(variantName, 'S2-rot+scale', { converged: true, aliceScore: as, bobScore: bs });
    });
  });

  // ── S3: Delete vs. update ─────────────────────────────────────────────────

  describe(`[${variantName}] S3 — Delete vs. concurrent update`, () => {
    let env: TestEnv;
    beforeEach(() => { env = makeEnv(); });
    afterEach(() => env.cleanup());

    it('converges when one peer deletes and the other moves', () => {
      env.alice.addObject('box-1', defaultBox());
      env.disableSync();

      env.alice.removeObject('box-1');
      env.bob.updateObject('box-1', { position: [99, 99, 99] });

      env.enableSync();

      const result = assertConvergedOrDeleted(env.alice, env.bob, 'box-1');
      report(variantName, 'S3-del+move', {
        converged: true,
        note: result ? `survived pos=${JSON.stringify(result.position)}` : 'deleted',
      });
    });

    it('converges when one peer deletes and the other changes color', () => {
      env.alice.addObject('box-1', defaultBox({ color: '#FFFFFF' }));
      env.disableSync();

      env.alice.removeObject('box-1');
      env.bob.updateObject('box-1', { color: '#00FF00' });

      env.enableSync();

      const result = assertConvergedOrDeleted(env.alice, env.bob, 'box-1');
      report(variantName, 'S3-del+color', {
        converged: true,
        note: result ? `survived color=${result.color}` : 'deleted',
      });
    });
  });

  // ── S4: Concurrent delta moves (commutativity) ───────────────────────────

  describe(`[${variantName}] S4 — Concurrent moveObject (delta commutativity)`, () => {
    let env: TestEnv;
    beforeEach(() => { env = makeEnv(); });
    afterEach(() => env.cleanup());

    it('converges after concurrent moveObject calls; notes if both deltas applied', () => {
      env.alice.addObject('box-1', defaultBox({ position: [0, 0, 0] }));
      env.disableSync();

      env.alice.moveObject('box-1', [5, 0, 0]);
      env.bob.moveObject('box-1',   [3, 0, 0]);

      env.enableSync();

      const final = assertConverged(env.alice, env.bob, 'box-1');
      const bothApplied = Math.abs(final.position[0] - 8) < 0.001;

      report(variantName, 'S4-concurrent-move', {
        converged: true,
        note: `x=${final.position[0]} ${bothApplied ? '(both deltas ✓)' : '(one delta lost)'}`,
      });
    });

    it('multi-step: 3 sequential moves from alice + 1 color from bob (offline)', () => {
      env.alice.addObject('box-1', defaultBox({ position: [0, 0, 0], color: '#FFFFFF' }));
      env.disableSync();

      env.alice.moveObject('box-1', [1, 0, 0]);
      env.alice.moveObject('box-1', [1, 0, 0]);
      env.alice.moveObject('box-1', [1, 0, 0]);
      env.bob.updateObject('box-1', { color: '#ABCDEF' });

      env.enableSync();

      const final = assertConverged(env.alice, env.bob, 'box-1');
      const as = intentScore({ color: '#ABCDEF' }, final);
      const note = `x=${final.position[0]} color=${final.color}`;

      report(variantName, 'S4-batch-move', { converged: true, bobScore: as, note });
    });
  });

  // ── S5: Parent-child reparenting ──────────────────────────────────────────

  describe(`[${variantName}] S5 — Concurrent reparenting (parent-child integrity)`, () => {
    let env: TestEnv;
    beforeEach(() => { env = makeEnv(); });
    afterEach(() => env.cleanup());

    it('child ends up with exactly one parentId after concurrent reparent ops', () => {
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

      report(variantName, 'S5-reparent', {
        converged: true,
        note: `winning parentId=${childA?.parentId}`,
      });
    });

    it('childIds arrays stay consistent with the winning parentId', () => {
      env.alice.addObject('parent-A', { ...defaultBox(), id: 'parent-A', childIds: [] });
      env.alice.addObject('parent-B', { ...defaultBox(), id: 'parent-B', childIds: [] });
      env.alice.addObject('child',    { ...defaultBox(), id: 'child',    childIds: [] });
      env.disableSync();

      // Each peer updates both the child's parentId and the new parent's childIds
      env.alice.updateObject('child',    { parentId: 'parent-A' });
      env.alice.updateObject('parent-A', { childIds: ['child'] });

      env.bob.updateObject('child',    { parentId: 'parent-B' });
      env.bob.updateObject('parent-B', { childIds: ['child'] });

      env.enableSync();

      expect(env.alice.getObject('child')).toEqual(env.bob.getObject('child'));
      expect(env.alice.getObject('parent-A')).toEqual(env.bob.getObject('parent-A'));
      expect(env.alice.getObject('parent-B')).toEqual(env.bob.getObject('parent-B'));

      const child   = env.alice.getObject('child');
      const pA      = env.alice.getObject('parent-A');
      const pB      = env.alice.getObject('parent-B');
      const winner  = child?.parentId;
      const inA     = pA?.childIds?.includes('child') ?? false;
      const inB     = pB?.childIds?.includes('child') ?? false;
      const consistent = (winner === 'parent-A' && inA && !inB)
                      || (winner === 'parent-B' && !inA && inB)
                      || winner === null;

      report(variantName, 'S5-childIds', {
        converged: true,
        note: `winner=${winner} inA=${inA} inB=${inB} consistent=${consistent}`,
      });
    });
  });

  // ── S6: Concurrent creation with same ID ─────────────────────────────────
  // situations.md §9: twee gebruikers voegen tegelijk object met zelfde id toe.
  // Expected: converges to one consistent object regardless of which color wins.

  describe(`[${variantName}] S6 — Concurrent object creation (same ID)`, () => {
    let env: TestEnv;
    beforeEach(() => { env = makeEnv(); });
    afterEach(() => env.cleanup());

    it('converges when two peers create an object with the same ID but different color', () => {
      env.disableSync();

      env.alice.addObject('box-shared', defaultBox({ id: 'box-shared', color: '#FF0000' }));
      env.bob.addObject('box-shared',   defaultBox({ id: 'box-shared', color: '#0000FF' }));

      env.enableSync();

      const a = env.alice.getObject('box-shared');
      const b = env.bob.getObject('box-shared');
      expect(a).toEqual(b);
      expect(a).not.toBeUndefined();

      report(variantName, 'S6-concurrent-create', {
        converged: true,
        note: `winner color=${a?.color}`,
      });
    });

    it('both peers end up with a consistent object count after concurrent creation', () => {
      env.disableSync();

      env.alice.addObject('box-shared', defaultBox({ id: 'box-shared', position: [1, 0, 0] }));
      env.bob.addObject('box-shared',   defaultBox({ id: 'box-shared', position: [2, 0, 0] }));

      // Each peer also adds its own unique object
      env.alice.addObject('box-alice', { ...defaultBox(), id: 'box-alice' });
      env.bob.addObject('box-bob',     { ...defaultBox(), id: 'box-bob' });

      env.enableSync();

      const allA = env.alice.getAllObjects();
      const allB = env.bob.getAllObjects();
      expect(allA.size).toBe(allB.size);

      report(variantName, 'S6-object-count', {
        converged: true,
        note: `total objects=${allA.size}`,
      });
    });
  });

  // ── S7: Delete parent while child is being edited ─────────────────────────
  // situations.md §7: object verwijderd terwijl andere user aanpassingen maakt.
  // Child may survive (orphaned) or be deleted; variant decides — must converge.

  describe(`[${variantName}] S7 — Delete parent while child is edited`, () => {
    let env: TestEnv;
    beforeEach(() => { env = makeEnv(); });
    afterEach(() => env.cleanup());

    it('child is consistent on both peers after parent is deleted concurrently', () => {
      env.alice.addObject('parent', { ...defaultBox(), id: 'parent' });
      env.alice.addObject('child',  { ...defaultBox(), id: 'child', parentId: 'parent' });
      env.disableSync();

      env.alice.removeObject('parent');
      env.bob.updateObject('child', { position: [5, 0, 0] });

      env.enableSync();

      const parentGone = env.alice.getObject('parent') === undefined
                      && env.bob.getObject('parent') === undefined;
      expect(parentGone).toBe(true);

      const childA = env.alice.getObject('child');
      const childB = env.bob.getObject('child');
      expect(childA).toEqual(childB);

      report(variantName, 'S7-del-parent+edit-child', {
        converged: true,
        note: childA
          ? `child survived pos=${JSON.stringify(childA.position)} parentId=${childA.parentId}`
          : 'child also deleted',
      });
    });

    it('child created simultaneously with parent deletion stays consistent', () => {
      env.alice.addObject('parent', { ...defaultBox(), id: 'parent' });
      env.disableSync();

      env.alice.removeObject('parent');
      // Bob creates a child that references the being-deleted parent
      env.bob.addObject('child', { ...defaultBox(), id: 'child', parentId: 'parent' });

      env.enableSync();

      const childA = env.alice.getObject('child');
      const childB = env.bob.getObject('child');
      expect(childA).toEqual(childB);

      report(variantName, 'S7-orphan-on-create', {
        converged: true,
        note: childA ? `child exists parentId=${childA.parentId}` : 'child absent',
      });
    });
  });

  // ── S8: Batch ops vs. single op ───────────────────────────────────────────
  // situations.md §8: meerdere bewerkingen van 1 gebruiker vs 1 bewerking andere.
  // All should be preserved when they touch independent properties.

  describe(`[${variantName}] S8 — Batch ops from one peer vs. single op from another`, () => {
    let env: TestEnv;
    beforeEach(() => { env = makeEnv(); });
    afterEach(() => env.cleanup());

    it('3 independent property updates from alice preserved alongside bob color change', () => {
      env.alice.addObject('box-1', defaultBox());
      env.disableSync();

      env.alice.updateObject('box-1', { position: [10, 0, 0] });
      env.alice.updateObject('box-1', { rotation: [Math.PI / 4, 0, 0] });
      env.alice.updateObject('box-1', { scale:    [2, 2, 2] });
      env.bob.updateObject('box-1',   { color: '#ABCDEF' });

      env.enableSync();

      const final = assertConverged(env.alice, env.bob, 'box-1');
      const as = intentScore({ position: [10, 0, 0], rotation: [Math.PI / 4, 0, 0], scale: [2, 2, 2] }, final);
      const bs = intentScore({ color: '#ABCDEF' }, final);

      report(variantName, 'S8-batch3+single', { converged: true, aliceScore: as, bobScore: bs });
    });

    it('alice does many color changes; only the last one should survive (LWW on same property)', () => {
      env.alice.addObject('box-1', defaultBox({ color: '#000000' }));
      env.disableSync();

      // Alice chains multiple color updates; in an LWW system only the last matters
      env.alice.updateObject('box-1', { color: '#111111' });
      env.alice.updateObject('box-1', { color: '#222222' });
      env.alice.updateObject('box-1', { color: '#333333' });
      env.bob.updateObject('box-1',   { color: '#0000FF' });

      env.enableSync();

      const final = assertConverged(env.alice, env.bob, 'box-1');
      const aliceLastWon = final.color === '#333333';
      const bobWon       = final.color === '#0000FF';

      report(variantName, 'S8-chain-same-prop', {
        converged: true,
        aliceScore: aliceLastWon ? 1 : 0,
        bobScore:   bobWon ? 1 : 0,
        note: `winner=${final.color}`,
      });
    });
  });

  // ── S9: Idempotent double-delete ──────────────────────────────────────────
  // Shapiro 2011: CmRDTs must be idempotent on the state level.
  // Both peers delete the same object — should not crash, must converge to deleted.

  describe(`[${variantName}] S9 — Idempotent double-delete`, () => {
    let env: TestEnv;
    beforeEach(() => { env = makeEnv(); });
    afterEach(() => env.cleanup());

    it('object stays deleted when both peers delete it concurrently', () => {
      env.alice.addObject('box-1', defaultBox());
      env.disableSync();

      env.alice.removeObject('box-1');
      env.bob.removeObject('box-1');

      env.enableSync();

      expect(env.alice.getObject('box-1')).toBeUndefined();
      expect(env.bob.getObject('box-1')).toBeUndefined();

      report(variantName, 'S9-double-delete', { converged: true, note: 'object absent on both ✓' });
    });

    it('unrelated object is untouched by neighbour delete', () => {
      env.alice.addObject('box-1', defaultBox({ id: 'box-1' }));
      env.alice.addObject('box-2', { ...defaultBox(), id: 'box-2', color: '#BEEF00' });
      env.disableSync();

      env.alice.removeObject('box-1');
      env.bob.removeObject('box-1');

      env.enableSync();

      expect(env.alice.getObject('box-1')).toBeUndefined();
      const box2 = assertConverged(env.alice, env.bob, 'box-2');
      expect(box2.color).toBe('#BEEF00');

      report(variantName, 'S9-untouched-neighbour', { converged: true, note: 'box-2 intact ✓' });
    });
  });

  // ── S10: Concurrent linkObject to different parents ───────────────────────
  // situations.md §4: twee gebruikers proberen zelfde object aan verschillende
  // objecten te linken.  Child must end up in exactly one parent, consistently.

  describe(`[${variantName}] S10 — Concurrent linkObject to different parents`, () => {
    let env: TestEnv;
    beforeEach(() => { env = makeEnv(); });
    afterEach(() => env.cleanup());

    it('child has consistent parentId after concurrent linkObject calls', () => {
      env.alice.addObject('parent-A', { ...defaultBox(), id: 'parent-A', childIds: [] });
      env.alice.addObject('parent-B', { ...defaultBox(), id: 'parent-B', childIds: [] });
      env.alice.addObject('child',    { ...defaultBox(), id: 'child',    childIds: [] });
      env.disableSync();

      env.alice.linkObject('child', 'parent-A');
      env.bob.linkObject('child',   'parent-B');

      env.enableSync();

      const childA  = env.alice.getObject('child');
      const childB  = env.bob.getObject('child');
      expect(childA?.parentId).toBe(childB?.parentId);

      const winner = childA?.parentId;
      const pA = env.alice.getObject('parent-A');
      const pB = env.alice.getObject('parent-B');
      const inA = pA?.childIds?.includes('child') ?? false;
      const inB = pB?.childIds?.includes('child') ?? false;

      report(variantName, 'S10-concurrent-link', {
        converged: true,
        note: `winner=${winner} inA=${inA} inB=${inB}`,
      });
    });

    it('unlinkObject is consistent when one peer unlinks concurrently with another linking', () => {
      env.alice.addObject('parent-A', { ...defaultBox(), id: 'parent-A', childIds: ['child'] });
      env.alice.addObject('parent-B', { ...defaultBox(), id: 'parent-B', childIds: [] });
      env.alice.addObject('child',    { ...defaultBox(), id: 'child', parentId: 'parent-A' });
      env.disableSync();

      env.alice.unlinkObject('child');         // detach from parent-A
      env.bob.linkObject('child', 'parent-B'); // attach to parent-B

      env.enableSync();

      const childA = env.alice.getObject('child');
      const childB = env.bob.getObject('child');
      expect(childA?.parentId).toBe(childB?.parentId);

      report(variantName, 'S10-link-vs-unlink', {
        converged: true,
        note: `final parentId=${childA?.parentId ?? 'null'}`,
      });
    });
  });
}
