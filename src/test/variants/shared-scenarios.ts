/**
 * Shared conflict-resolution test matrix — all scenarios run against every variant.
 *
 * Scenarios:
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
 *   S11 — Multi-property stress (5 properties, two users)
 *   S12 — Regression move (undo-like scenario)
 *   S13 — Sequential edits from one user + concurrent from another
 *   S14 — Clean 4-property split (the definitive A-vs-B test)
 *   S15 — Nudge accumulation (the definitive A/B-vs-C test)
 *
 * VariantConfig controls which hard assertions are enabled:
 *
 *   propertyLevel:    true for B, C, D — their guarantee is that concurrent edits
 *                     to *different* properties MUST both survive. Scenarios that
 *                     test this (S2, S8, S14) add expect() calls that fail if the
 *                     variant regresses.
 *
 *   deltaCommutative: true for C only — moveObject deltas MUST accumulate (sum),
 *                     not race. Scenarios S4, S15 add expect() calls for this.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { CollaborationStrategy, SceneObject, TestEnv } from '../../collaboration/types';

type EnvFactory = () => TestEnv;

// ---------------------------------------------------------------------------
// VariantConfig — controls which hard assertions are active
// ---------------------------------------------------------------------------

export interface VariantConfig {
  /**
   * Set true for Variants B, C, D.
   * Adds assertions: concurrent edits to different properties MUST both survive.
   */
  propertyLevel: boolean;
  /**
   * Set true for Variant C only.
   * Adds assertions: concurrent moveObject deltas MUST sum (not overwrite).
   */
  deltaCommutative: boolean;
}

export const BASELINE_CONFIG:        VariantConfig = { propertyLevel: false, deltaCommutative: false };
export const PROPERTY_LEVEL_CONFIG:  VariantConfig = { propertyLevel: true,  deltaCommutative: false };
export const DELTA_COMMUTATIVE_CONFIG: VariantConfig = { propertyLevel: true,  deltaCommutative: true  };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function defaultBox(overrides: Partial<SceneObject> = {}): SceneObject {
  return {
    id: 'box-1', type: 'box',
    position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1],
    color: '#FFFFFF', parentId: null, childIds: [],
    ...overrides,
  };
}

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

function intentScore(intended: Record<string, unknown>, actual: SceneObject): number {
  const keys = Object.keys(intended);
  if (keys.length === 0) return 1;
  const preserved = keys.filter(k => {
    const av = (actual as Record<string, unknown>)[k];
    return JSON.stringify(av) === JSON.stringify(intended[k]);
  });
  return preserved.length / keys.length;
}

function pct(score: number | null): string {
  return score === null ? '—' : `${Math.round(score * 100)}%`;
}

/**
 * Emits two lines per call:
 *  1. A short human-readable verdict for the terminal.
 *  2. A [DETAIL] JSON line parsed by scripts/report.cjs for the HTML report.
 *
 * The JSON contains the full intent/actual diff so the report can show
 * exactly which properties were lost and why.
 */
function reportDetailed(
  variant: string,
  scenario: string,
  opts: {
    converged: boolean;
    aliceIntended?: Record<string, unknown>;
    bobIntended?:   Record<string, unknown>;
    initialState?:  Record<string, unknown>;
    finalState?:    Record<string, unknown>;
    aliceScore?:    number;
    bobScore?:      number;
    note?:          string;
  },
): void {
  const { converged, aliceScore, bobScore, note } = opts;

  // Derive verdict
  let verdict: string | undefined;
  if (aliceScore !== undefined && bobScore !== undefined) {
    if (aliceScore === 1 && bobScore === 1)          verdict = 'BOTH PRESERVED';
    else if (aliceScore === 0 || bobScore === 0)     verdict = 'INTENT LOST';
    else                                              verdict = 'PARTIAL';
  }

  // Terminal line
  const parts: string[] = [
    `[${variant}] ${scenario}`,
    `converged=${converged ? '✓' : '✗'}`,
    aliceScore !== undefined ? `alice=${pct(aliceScore)}` : '',
    bobScore   !== undefined ? `bob=${pct(bobScore)}`     : '',
    verdict ?? '',
    note ?? '',
  ].filter(Boolean);
  console.log(parts.join('  '));

  // Machine-readable detail for HTML report
  console.log(`[DETAIL] ${JSON.stringify({
    variant,
    scenario,
    converged,
    aliceIntended: opts.aliceIntended ?? {},
    bobIntended:   opts.bobIntended   ?? {},
    initialState:  opts.initialState  ?? {},
    finalState:    opts.finalState    ?? {},
    aliceScore:    aliceScore ?? null,
    bobScore:      bobScore   ?? null,
    verdict:       verdict    ?? null,
    note:          note       ?? '',
  })}`);
}

// ---------------------------------------------------------------------------
// Shared scenario suite
// ---------------------------------------------------------------------------

export function runSharedScenarios(
  variantName: string,
  makeEnv: EnvFactory,
  config: VariantConfig = BASELINE_CONFIG,
): void {

  // ── S1: Same property ────────────────────────────────────────────────────

  describe(`[${variantName}] S1 — Concurrent edit, same property`, () => {
    let env: TestEnv;
    beforeEach(() => { env = makeEnv(); });
    afterEach(() => env.cleanup());

    it('converges after concurrent position writes (LWW expected)', () => {
      const initial = defaultBox({ position: [0, 0, 0] });
      env.alice.addObject('box-1', initial);
      env.disableSync();

      env.alice.updateObject('box-1', { position: [10, 0, 0] });
      env.bob.updateObject('box-1',   { position: [5,  0, 0] });

      env.enableSync();

      const final = assertConverged(env.alice, env.bob, 'box-1');
      const aliceWon = JSON.stringify(final.position) === JSON.stringify([10, 0, 0]);
      const bobWon   = JSON.stringify(final.position) === JSON.stringify([5,  0, 0]);

      reportDetailed(variantName, 'S1-position', {
        converged: true,
        aliceIntended: { position: [10, 0, 0] },
        bobIntended:   { position: [5,  0, 0] },
        initialState:  { position: [0, 0, 0] },
        finalState:    { position: final.position },
        aliceScore: aliceWon ? 1 : 0,
        bobScore:   bobWon   ? 1 : 0,
        note: `winner=${aliceWon ? 'alice' : bobWon ? 'bob' : 'merged'} → ${JSON.stringify(final.position)}`,
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

      reportDetailed(variantName, 'S1-color', {
        converged: true,
        aliceIntended: { color: '#FF0000' },
        bobIntended:   { color: '#0000FF' },
        initialState:  { color: '#000000' },
        finalState:    { color: final.color },
        aliceScore: aliceWon ? 1 : 0,
        bobScore:   bobWon   ? 1 : 0,
        note: `winner=${aliceWon ? 'alice (#FF0000)' : bobWon ? 'bob (#0000FF)' : 'onbekend'}`,
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

      // Hard assertion for B, C, D: independent properties MUST both survive
      if (config.propertyLevel) {
        expect(final.position).toEqual([10, 0, 0]);
        expect(final.color).toBe('#FF0000');
      }

      const as = intentScore({ position: [10, 0, 0] }, final);
      const bs = intentScore({ color: '#FF0000' },     final);

      reportDetailed(variantName, 'S2-pos+color', {
        converged: true,
        aliceIntended: { position: [10, 0, 0] },
        bobIntended:   { color: '#FF0000' },
        initialState:  { position: [0, 0, 0], color: '#FFFFFF' },
        finalState:    { position: final.position, color: final.color },
        aliceScore: as,
        bobScore:   bs,
      });
    });

    it('preserves both intents when rotation vs. scale are edited', () => {
      env.alice.addObject('box-1', defaultBox({ rotation: [0, 0, 0], scale: [1, 1, 1] }));
      env.disableSync();

      env.alice.updateObject('box-1', { rotation: [Math.PI / 2, 0, 0] });
      env.bob.updateObject('box-1',   { scale:    [2, 2, 2] });

      env.enableSync();

      const final = assertConverged(env.alice, env.bob, 'box-1');

      // Hard assertion for B, C, D
      if (config.propertyLevel) {
        expect(final.rotation[0]).toBeCloseTo(Math.PI / 2);
        expect(final.scale).toEqual([2, 2, 2]);
      }

      const as = intentScore({ rotation: [Math.PI / 2, 0, 0] }, final);
      const bs = intentScore({ scale: [2, 2, 2] },               final);

      reportDetailed(variantName, 'S2-rot+scale', {
        converged: true,
        aliceIntended: { rotation: [Math.PI / 2, 0, 0] },
        bobIntended:   { scale: [2, 2, 2] },
        initialState:  { rotation: [0, 0, 0], scale: [1, 1, 1] },
        finalState:    { rotation: final.rotation, scale: final.scale },
        aliceScore: as,
        bobScore:   bs,
      });
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

      reportDetailed(variantName, 'S3-del+move', {
        converged: true,
        aliceIntended: { deleted: true },
        bobIntended:   { position: [99, 99, 99] },
        initialState:  { position: [0, 0, 0] },
        finalState:    result ? { exists: true, position: result.position } : { exists: false },
        note: result ? `object survived pos=${JSON.stringify(result.position)}` : 'deleted',
      });
    });

    it('converges when one peer deletes and the other changes color', () => {
      env.alice.addObject('box-1', defaultBox({ color: '#FFFFFF' }));
      env.disableSync();

      env.alice.removeObject('box-1');
      env.bob.updateObject('box-1', { color: '#00FF00' });

      env.enableSync();

      const result = assertConvergedOrDeleted(env.alice, env.bob, 'box-1');

      reportDetailed(variantName, 'S3-del+color', {
        converged: true,
        aliceIntended: { deleted: true },
        bobIntended:   { color: '#00FF00' },
        initialState:  { color: '#FFFFFF' },
        finalState:    result ? { exists: true, color: result.color } : { exists: false },
        note: result ? `survived color=${result.color}` : 'deleted',
      });
    });
  });

  // ── S4: Concurrent delta moves ────────────────────────────────────────────

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

      // Hard assertion for C: delta commutativity means BOTH deltas must be applied
      if (config.deltaCommutative) {
        expect(final.position[0]).toBeCloseTo(8);
      }

      const bothApplied = Math.abs(final.position[0] - 8) < 0.001;
      const x = final.position[0];

      reportDetailed(variantName, 'S4-concurrent-move', {
        converged: true,
        aliceIntended: { moveBy: [5, 0, 0] },
        bobIntended:   { moveBy: [3, 0, 0] },
        initialState:  { position: [0, 0, 0] },
        finalState:    { position: final.position },
        aliceScore: bothApplied ? 1 : x === 5 ? 1 : 0,
        bobScore:   bothApplied ? 1 : x === 3 ? 1 : 0,
        note: `x=${x} ideaal=8 ${bothApplied ? '(beide deltas ✓)' : '(één delta verloren)'}`,
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
      const bs = intentScore({ color: '#ABCDEF' }, final);

      reportDetailed(variantName, 'S4-batch-move', {
        converged: true,
        aliceIntended: { position: 'moved +3 via 3 delta ops' },
        bobIntended:   { color: '#ABCDEF' },
        initialState:  { position: [0, 0, 0], color: '#FFFFFF' },
        finalState:    { position: final.position, color: final.color },
        bobScore: bs,
        note: `x=${final.position[0]} color=${final.color}`,
      });
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

      reportDetailed(variantName, 'S5-reparent', {
        converged: true,
        aliceIntended: { parentId: 'parent-A' },
        bobIntended:   { parentId: 'parent-B' },
        initialState:  { parentId: null },
        finalState:    { parentId: childA?.parentId },
        note: `winner=${childA?.parentId}`,
      });
    });

    it('childIds arrays stay consistent with the winning parentId', () => {
      env.alice.addObject('parent-A', { ...defaultBox(), id: 'parent-A', childIds: [] });
      env.alice.addObject('parent-B', { ...defaultBox(), id: 'parent-B', childIds: [] });
      env.alice.addObject('child',    { ...defaultBox(), id: 'child',    childIds: [] });
      env.disableSync();

      env.alice.updateObject('child',    { parentId: 'parent-A' });
      env.alice.updateObject('parent-A', { childIds: ['child'] });
      env.bob.updateObject('child',      { parentId: 'parent-B' });
      env.bob.updateObject('parent-B',   { childIds: ['child'] });

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

      reportDetailed(variantName, 'S5-childIds', {
        converged: true,
        aliceIntended: { 'child.parentId': 'parent-A', 'parent-A.childIds': ['child'] },
        bobIntended:   { 'child.parentId': 'parent-B', 'parent-B.childIds': ['child'] },
        finalState:    { 'child.parentId': winner, 'inParentA': inA, 'inParentB': inB, consistent },
        note: `winner=${winner} inA=${inA} inB=${inB} consistent=${consistent}`,
      });
    });
  });

  // ── S6: Concurrent creation with same ID ─────────────────────────────────

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

      reportDetailed(variantName, 'S6-concurrent-create', {
        converged: true,
        aliceIntended: { 'box-shared.color': '#FF0000' },
        bobIntended:   { 'box-shared.color': '#0000FF' },
        finalState:    { color: a?.color },
        note: `winner color=${a?.color}`,
      });
    });

    it('both peers end up with a consistent object count after concurrent creation', () => {
      env.disableSync();

      env.alice.addObject('box-shared', defaultBox({ id: 'box-shared', position: [1, 0, 0] }));
      env.bob.addObject('box-shared',   defaultBox({ id: 'box-shared', position: [2, 0, 0] }));
      env.alice.addObject('box-alice', { ...defaultBox(), id: 'box-alice' });
      env.bob.addObject('box-bob',     { ...defaultBox(), id: 'box-bob' });

      env.enableSync();

      const allA = env.alice.getAllObjects();
      const allB = env.bob.getAllObjects();
      expect(allA.size).toBe(allB.size);

      reportDetailed(variantName, 'S6-object-count', {
        converged: true,
        aliceIntended: { objectCount: 2 },
        bobIntended:   { objectCount: 2 },
        finalState:    { objectCount: allA.size },
        note: `total objects=${allA.size}`,
      });
    });
  });

  // ── S7: Delete parent while child is edited ───────────────────────────────

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

      reportDetailed(variantName, 'S7-del-parent+edit-child', {
        converged: true,
        aliceIntended: { 'parent': 'deleted' },
        bobIntended:   { 'child.position': [5, 0, 0] },
        initialState:  { 'child.parentId': 'parent', 'child.position': [0, 0, 0] },
        finalState:    childA
          ? { 'child.exists': true, 'child.position': childA.position, 'child.parentId': childA.parentId }
          : { 'child.exists': false },
        note: childA
          ? `child survived pos=${JSON.stringify(childA.position)} parentId=${childA.parentId}`
          : 'child also deleted',
      });
    });

    it('child created simultaneously with parent deletion stays consistent', () => {
      env.alice.addObject('parent', { ...defaultBox(), id: 'parent' });
      env.disableSync();

      env.alice.removeObject('parent');
      env.bob.addObject('child', { ...defaultBox(), id: 'child', parentId: 'parent' });

      env.enableSync();

      const childA = env.alice.getObject('child');
      const childB = env.bob.getObject('child');
      expect(childA).toEqual(childB);

      reportDetailed(variantName, 'S7-orphan-on-create', {
        converged: true,
        aliceIntended: { parent: 'deleted' },
        bobIntended:   { 'new child.parentId': 'parent' },
        finalState:    childA ? { 'child.exists': true, 'child.parentId': childA.parentId } : { 'child.exists': false },
        note: childA ? `child exists parentId=${childA.parentId}` : 'child absent',
      });
    });
  });

  // ── S8: Batch ops vs. single op ───────────────────────────────────────────

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

      // Hard assertion for B, C, D: all 4 independent properties must survive
      if (config.propertyLevel) {
        expect(final.position).toEqual([10, 0, 0]);
        expect(final.rotation[0]).toBeCloseTo(Math.PI / 4);
        expect(final.scale).toEqual([2, 2, 2]);
        expect(final.color).toBe('#ABCDEF');
      }

      const as = intentScore({ position: [10, 0, 0], rotation: [Math.PI / 4, 0, 0], scale: [2, 2, 2] }, final);
      const bs = intentScore({ color: '#ABCDEF' }, final);

      reportDetailed(variantName, 'S8-batch3+single', {
        converged: true,
        aliceIntended: { position: [10, 0, 0], rotation: [Math.PI / 4, 0, 0], scale: [2, 2, 2] },
        bobIntended:   { color: '#ABCDEF' },
        initialState:  { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], color: '#FFFFFF' },
        finalState:    { position: final.position, rotation: final.rotation, scale: final.scale, color: final.color },
        aliceScore: as,
        bobScore:   bs,
      });
    });

    it('alice does many color changes; only the last one should survive (LWW on same property)', () => {
      env.alice.addObject('box-1', defaultBox({ color: '#000000' }));
      env.disableSync();

      env.alice.updateObject('box-1', { color: '#111111' });
      env.alice.updateObject('box-1', { color: '#222222' });
      env.alice.updateObject('box-1', { color: '#333333' });
      env.bob.updateObject('box-1',   { color: '#0000FF' });

      env.enableSync();

      const final = assertConverged(env.alice, env.bob, 'box-1');
      const aliceLastWon = final.color === '#333333';
      const bobWon       = final.color === '#0000FF';

      reportDetailed(variantName, 'S8-chain-same-prop', {
        converged: true,
        aliceIntended: { color: '#333333' },
        bobIntended:   { color: '#0000FF' },
        initialState:  { color: '#000000' },
        finalState:    { color: final.color },
        aliceScore: aliceLastWon ? 1 : 0,
        bobScore:   bobWon       ? 1 : 0,
        note: `winner=${final.color}`,
      });
    });
  });

  // ── S9: Idempotent double-delete ──────────────────────────────────────────

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

      reportDetailed(variantName, 'S9-double-delete', {
        converged: true,
        aliceIntended: { deleted: true },
        bobIntended:   { deleted: true },
        finalState:    { exists: false },
        note: 'object absent on both ✓',
      });
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

      reportDetailed(variantName, 'S9-untouched-neighbour', {
        converged: true,
        aliceIntended: { 'box-1': 'deleted', 'box-2': 'untouched' },
        bobIntended:   { 'box-1': 'deleted' },
        finalState:    { 'box-1.exists': false, 'box-2.color': box2.color },
        note: 'box-2 intact ✓',
      });
    });
  });

  // ── S10: Concurrent linkObject ────────────────────────────────────────────

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

      reportDetailed(variantName, 'S10-concurrent-link', {
        converged: true,
        aliceIntended: { 'child.parentId': 'parent-A' },
        bobIntended:   { 'child.parentId': 'parent-B' },
        initialState:  { 'child.parentId': null },
        finalState:    { 'child.parentId': winner, 'inParentA': inA, 'inParentB': inB },
        note: `winner=${winner} inA=${inA} inB=${inB}`,
      });
    });

    it('unlinkObject is consistent when one peer unlinks concurrently with another linking', () => {
      env.alice.addObject('parent-A', { ...defaultBox(), id: 'parent-A', childIds: ['child'] });
      env.alice.addObject('parent-B', { ...defaultBox(), id: 'parent-B', childIds: [] });
      env.alice.addObject('child',    { ...defaultBox(), id: 'child', parentId: 'parent-A' });
      env.disableSync();

      env.alice.unlinkObject('child');
      env.bob.linkObject('child', 'parent-B');

      env.enableSync();

      const childA = env.alice.getObject('child');
      const childB = env.bob.getObject('child');
      expect(childA?.parentId).toBe(childB?.parentId);

      reportDetailed(variantName, 'S10-link-vs-unlink', {
        converged: true,
        aliceIntended: { 'child.parentId': null },
        bobIntended:   { 'child.parentId': 'parent-B' },
        initialState:  { 'child.parentId': 'parent-A' },
        finalState:    { 'child.parentId': childA?.parentId ?? null },
        note: `final parentId=${childA?.parentId ?? 'null'}`,
      });
    });
  });

  // ── S11: Multi-property stress ────────────────────────────────────────────
  // Alice edits 5 properties, Bob edits 2 of them (overlap) + 1 unique.
  // Shows how many of the 8 total intended changes survive per variant.

  describe(`[${variantName}] S11 — Multi-property stress (5 vs 3 properties)`, () => {
    let env: TestEnv;
    beforeEach(() => { env = makeEnv(); });
    afterEach(() => env.cleanup());

    it('tracks how many of 8 total intended changes survive', () => {
      env.alice.addObject('box-1', defaultBox());
      env.disableSync();

      // Alice: 5 independent properties
      env.alice.updateObject('box-1', { position: [10, 0, 0] });
      env.alice.updateObject('box-1', { rotation: [1, 0, 0] });
      env.alice.updateObject('box-1', { scale:    [3, 3, 3] });
      env.alice.updateObject('box-1', { color:    '#FF0000' });

      // Bob: overlapping color (conflict!) + unique property
      env.bob.updateObject('box-1', { color:    '#0000FF' }); // CONFLICTS with alice
      env.bob.updateObject('box-1', { rotation: [0, 0, 2] }); // CONFLICTS with alice

      env.enableSync();

      const final = assertConverged(env.alice, env.bob, 'box-1');

      // Score per property
      const posOk  = JSON.stringify(final.position) === JSON.stringify([10, 0, 0]);
      const rotOkA = Math.abs(final.rotation[0] - 1) < 0.001;
      const rotOkB = Math.abs(final.rotation[2] - 2) < 0.001;
      const scaleOk = JSON.stringify(final.scale) === JSON.stringify([3, 3, 3]);
      const colorAlice = final.color === '#FF0000';
      const colorBob   = final.color === '#0000FF';

      const alicePreserved = [posOk, rotOkA, scaleOk, colorAlice].filter(Boolean).length;
      const bobPreserved   = [rotOkB, colorBob].filter(Boolean).length;

      reportDetailed(variantName, 'S11-stress', {
        converged: true,
        aliceIntended: { position: [10, 0, 0], rotation: [1, 0, 0], scale: [3, 3, 3], color: '#FF0000' },
        bobIntended:   { color: '#0000FF', rotation: [0, 0, 2] },
        initialState:  { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], color: '#FFFFFF' },
        finalState:    { position: final.position, rotation: final.rotation, scale: final.scale, color: final.color },
        aliceScore: alicePreserved / 4,
        bobScore:   bobPreserved   / 2,
        note: `alice ${alicePreserved}/4 bob ${bobPreserved}/2 — pos=${posOk} scale=${scaleOk} color=${final.color}`,
      });
    });
  });

  // ── S12: Regression move (undo-like) ──────────────────────────────────────
  // Object is al verplaatst naar [5,5,5]. Alice "ondoet" dit (→ [0,0,0]).
  // Bob verplaatst verder (→ [10,10,10]). Wie wint?

  describe(`[${variantName}] S12 — Regression move (undo-like scenario)`, () => {
    let env: TestEnv;
    beforeEach(() => { env = makeEnv(); });
    afterEach(() => env.cleanup());

    it('concurrent undo vs. continue-move: documents which intent wins', () => {
      env.alice.addObject('box-1', defaultBox({ position: [5, 5, 5] }));
      env.disableSync();

      env.alice.updateObject('box-1', { position: [0, 0, 0] }); // "undo"
      env.bob.updateObject('box-1',   { position: [10, 10, 10] }); // continue

      env.enableSync();

      const final = assertConverged(env.alice, env.bob, 'box-1');
      const aliceWon = JSON.stringify(final.position) === JSON.stringify([0, 0, 0]);
      const bobWon   = JSON.stringify(final.position) === JSON.stringify([10, 10, 10]);

      reportDetailed(variantName, 'S12-undo-vs-move', {
        converged: true,
        aliceIntended: { position: [0, 0, 0] },
        bobIntended:   { position: [10, 10, 10] },
        initialState:  { position: [5, 5, 5] },
        finalState:    { position: final.position },
        aliceScore: aliceWon ? 1 : 0,
        bobScore:   bobWon   ? 1 : 0,
        note: `winner=${aliceWon ? 'alice (undo)' : bobWon ? 'bob (continue)' : 'merged'} → ${JSON.stringify(final.position)}`,
      });
    });
  });

  // ── S13: Sequential edits + late concurrent edit ──────────────────────────
  // Alice maakt 4 opeenvolgende wijzigingen (offline).
  // Bob maakt 1 wijziging op een niet-conflicterende property.
  // Test: hoeveel van Alice's 4 wijzigingen overleven naast Bob's 1?

  describe(`[${variantName}] S13 — Sequential chain from one peer + late concurrent edit`, () => {
    let env: TestEnv;
    beforeEach(() => { env = makeEnv(); });
    afterEach(() => env.cleanup());

    it('4 sequential property changes from alice + 1 concurrent from bob: all should survive if independent', () => {
      env.alice.addObject('box-1', defaultBox());
      env.disableSync();

      // Alice maakt 4 opeenvolgende wijzigingen aan verschillende properties
      env.alice.updateObject('box-1', { position: [1, 0, 0] });
      env.alice.updateObject('box-1', { rotation: [0.5, 0, 0] });
      env.alice.updateObject('box-1', { scale:    [2, 2, 2] });
      env.alice.updateObject('box-1', { color:    '#AAAAAA' });

      // Bob wijzigt alleen de positie (conflicteert met Alice!)
      env.bob.updateObject('box-1', { position: [99, 0, 0] });

      env.enableSync();

      const final = assertConverged(env.alice, env.bob, 'box-1');

      const rotOk   = Math.abs(final.rotation[0] - 0.5) < 0.001;
      const scaleOk = JSON.stringify(final.scale) === JSON.stringify([2, 2, 2]);
      const colorOk = final.color === '#AAAAAA';
      const alicePosWon = JSON.stringify(final.position) === JSON.stringify([1, 0, 0]);
      const bobPosWon   = JSON.stringify(final.position) === JSON.stringify([99, 0, 0]);

      // Alice's non-conflicting properties should survive in good variants
      if (config.propertyLevel) {
        expect(rotOk).toBe(true);
        expect(scaleOk).toBe(true);
        expect(colorOk).toBe(true);
        // position IS conflicting — one of them wins; we don't assert which
        expect(alicePosWon || bobPosWon).toBe(true);
      }

      const aliceNonConflict = [rotOk, scaleOk, colorOk].filter(Boolean).length;

      reportDetailed(variantName, 'S13-sequential-chain', {
        converged: true,
        aliceIntended: { position: [1, 0, 0], rotation: [0.5, 0, 0], scale: [2, 2, 2], color: '#AAAAAA' },
        bobIntended:   { position: [99, 0, 0] },
        initialState:  { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], color: '#FFFFFF' },
        finalState:    { position: final.position, rotation: final.rotation, scale: final.scale, color: final.color },
        aliceScore: (aliceNonConflict / 3 + (alicePosWon ? 1 : 0)) / 2,
        bobScore:   bobPosWon ? 1 : 0,
        note: `alice non-conflict ${aliceNonConflict}/3 rot=${rotOk} scale=${scaleOk} color=${colorOk} pos-winner=${alicePosWon ? 'alice' : 'bob'}`,
      });
    });
  });

  // ── S14: Clean 4-property split ───────────────────────────────────────────
  // THE definitive test for property-level independence.
  //
  // Alice and Bob each edit two DIFFERENT properties — zero overlap.
  //
  //   Variant A:   whole-object LWW → exactly one peer's two writes survive
  //                (either position+rotation OR scale+color, never all 4)
  //   Variant B/C/D: property-level → ALL 4 changes survive (guaranteed)
  //
  // For B, C, D this test has hard assertions. For A it documents the loss.

  describe(`[${variantName}] S14 — Clean 4-property split (definitive A-vs-B test)`, () => {
    let env: TestEnv;
    beforeEach(() => { env = makeEnv(); });
    afterEach(() => env.cleanup());

    it('alice: position+rotation  bob: scale+color — zero overlap, all 4 must survive in property-level variants', () => {
      env.alice.addObject('box-1', defaultBox());
      env.disableSync();

      env.alice.updateObject('box-1', { position: [7, 0, 0], rotation: [1, 0, 0] });
      env.bob.updateObject('box-1',   { scale: [3, 3, 3],    color: '#ABCDEF' });

      env.enableSync();

      const final = assertConverged(env.alice, env.bob, 'box-1');
      const posOk   = JSON.stringify(final.position) === JSON.stringify([7, 0, 0]);
      const rotOk   = Math.abs(final.rotation[0] - 1) < 0.001;
      const scaleOk = JSON.stringify(final.scale)    === JSON.stringify([3, 3, 3]);
      const colorOk = final.color === '#ABCDEF';
      const total   = [posOk, rotOk, scaleOk, colorOk].filter(Boolean).length;

      // B, C, D MUST preserve all 4 — this is their core guarantee
      if (config.propertyLevel) {
        expect(posOk).toBe(true);
        expect(rotOk).toBe(true);
        expect(scaleOk).toBe(true);
        expect(colorOk).toBe(true);
      } else {
        // A: whole-object LWW → exactly one peer's writes survive (never all 4)
        expect(total).toBeLessThan(4);
      }

      reportDetailed(variantName, 'S14-clean-split', {
        converged: true,
        aliceIntended: { position: [7, 0, 0], rotation: [1, 0, 0] },
        bobIntended:   { scale: [3, 3, 3], color: '#ABCDEF' },
        initialState:  { position: [0,0,0], rotation: [0,0,0], scale: [1,1,1], color: '#FFFFFF' },
        finalState:    { position: final.position, rotation: final.rotation, scale: final.scale, color: final.color },
        aliceScore: (posOk && rotOk) ? 1 : (posOk || rotOk) ? 0.5 : 0,
        bobScore:   (scaleOk && colorOk) ? 1 : (scaleOk || colorOk) ? 0.5 : 0,
        note: `${total}/4 properties preserved  pos=${posOk} rot=${rotOk} scale=${scaleOk} color=${colorOk}`,
      });
    });
  });

  // ── S15: Nudge accumulation ───────────────────────────────────────────────
  // THE definitive test for delta commutativity.
  //
  // Both peers go offline and each nudge the object multiple times.
  // After sync the expected result depends on the variant:
  //
  //   Variant A/B/D: moveObject uses LWW → one peer's nudges overwrite the other
  //                  Result: either alice's total (+3) or bob's total (+2), never 5
  //   Variant C:     delta log → ALL nudges accumulate
  //                  Result: always +3+2 = +5 regardless of arrival order
  //
  // For C this test has a hard assertion. For A/B/D it documents the loss.

  describe(`[${variantName}] S15 — Nudge accumulation (definitive A/B-vs-C test)`, () => {
    let env: TestEnv;
    beforeEach(() => { env = makeEnv(); });
    afterEach(() => env.cleanup());

    it('alice nudges 3× and bob nudges 2× offline — C must sum to 5, A/B/D lose some nudges', () => {
      env.alice.addObject('box-1', defaultBox({ position: [0, 0, 0] }));
      env.disableSync();

      env.alice.moveObject('box-1', [1, 0, 0]);
      env.alice.moveObject('box-1', [1, 0, 0]);
      env.alice.moveObject('box-1', [1, 0, 0]);  // alice total: +3

      env.bob.moveObject('box-1', [1, 0, 0]);
      env.bob.moveObject('box-1', [1, 0, 0]);    // bob total: +2

      env.enableSync();

      const final = assertConverged(env.alice, env.bob, 'box-1');
      const x = final.position[0];
      const allAccumulated = Math.abs(x - 5) < 0.001;

      // C MUST apply all nudges — this is its core delta commutativity guarantee
      if (config.deltaCommutative) {
        expect(x).toBeCloseTo(5);
      } else {
        // A, B, D: one set of nudges wins; result is 3 or 2, never 5
        expect(Math.abs(x - 5)).toBeGreaterThan(0.1);
      }

      reportDetailed(variantName, 'S15-nudge-accumulation', {
        converged: true,
        aliceIntended: { 'nudges': '+3 (three ×[1,0,0])' },
        bobIntended:   { 'nudges': '+2 (two ×[1,0,0])' },
        initialState:  { position: [0, 0, 0] },
        finalState:    { position: final.position },
        aliceScore: allAccumulated ? 1 : Math.abs(x - 3) < 0.001 ? 1 : 0,
        bobScore:   allAccumulated ? 1 : Math.abs(x - 2) < 0.001 ? 1 : 0,
        note: `x=${x}  ideal=5  ${allAccumulated ? 'ALL nudges accumulated ✓' : `only partial (LWW): ${x}`}`,
      });
    });
  });
}
