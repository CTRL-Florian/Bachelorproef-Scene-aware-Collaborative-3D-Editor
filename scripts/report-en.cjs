#!/usr/bin/env node
/**
 * Variant Test Report Generator — English version
 *
 * Runs all variant tests, parses the structured output, and writes
 * a self-contained HTML report to test-report-en.html.
 *
 * Usage:  node scripts/report-en.cjs
 *         npm run report:en
 */
'use strict';

const { execSync } = require('child_process');
const fs   = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// 1. Run the tests
// ---------------------------------------------------------------------------

console.log('Running variant tests...');
let raw = '';
try {
  raw = execSync('npm run test:variants', {
    cwd: path.resolve(__dirname, '..'),
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
} catch (e) {
  raw = (e.stdout ?? '') + (e.stderr ?? '');
}

// Strip ANSI colour codes
const strip = s => s
  .replace(/\x1b\[[0-9;]*[mGKHF]/g, '')
  .replace(/\x1b\[[?][0-9]*[lh]/g, '')
  .replace(/\x1b\[[0-9]*[a-zA-Z]/g, '');

const clean = strip(raw);

// ---------------------------------------------------------------------------
// 2. Parse verdict lines
// ---------------------------------------------------------------------------

const verdictRe = /\[Variant ([A-D])\] (S\d+[-\w+]*)\s+converged=(✓|✗)(?:\s+alice=(\d+)%)?(?:\s+bob=(\d+)%)?(?:\s+(BOTH PRESERVED|INTENT LOST|PARTIAL))?(?:\s+(.+))?/g;

const allResults = [];
let m;
while ((m = verdictRe.exec(clean)) !== null) {
  allResults.push({
    variant:    m[1],
    scenario:   m[2],
    converged:  m[3] === '✓',
    aliceScore: m[4] != null ? parseInt(m[4]) : null,
    bobScore:   m[5] != null ? parseInt(m[5]) : null,
    verdict:    m[6] ?? null,
    note:       m[7] ? m[7].trim() : '',
  });
}

// Deduplicate — cross-variant.test.ts re-runs some scenarios
const seen = new Set();
const results = allResults.filter(r => {
  const key = `${r.variant}:${r.scenario}`;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});

// ---------------------------------------------------------------------------
// 3. Parse [DETAIL] JSON lines
// ---------------------------------------------------------------------------

const detailMap = {};

for (const line of clean.split('\n')) {
  const idx = line.indexOf('[DETAIL] ');
  if (idx === -1) continue;
  try {
    const obj = JSON.parse(line.slice(idx + 9));
    const varLetter = (obj.variant ?? '').replace(/^Variant\s+/, '').trim();
    const key = `${varLetter}:${obj.scenario}`;
    if (!detailMap[key]) detailMap[key] = obj;
  } catch (_) { /* skip malformed lines */ }
}

// ---------------------------------------------------------------------------
// 4. Configuration — labels, descriptions, WHY explanations
// ---------------------------------------------------------------------------

const VARIANTS = ['A', 'B', 'C', 'D'];

const VARIANT_LABELS = {
  A: 'A — Object LWW',
  B: 'B — Property CRDT',
  C: 'C — Delta log',
  D: 'D — OT server',
};

const VARIANT_DESC = {
  A: 'The entire object is replaced on every update. Concurrent edits to different properties always result in one full update being discarded.',
  B: 'Each property has its own CRDT slot. Concurrent edits to different properties always preserve both intents.',
  C: 'moveObject deltas are stored as commutative ops in a Y.Array (+5 and +3 always gives 8). updateObject follows property-level LWW.',
  D: 'A central server transforms concurrent operations. "First to server wins" on conflicts. Fully auditable.',
};

const SCENARIO_LABELS = {
  'S1-position':              'S1 — Same property (position)',
  'S1-color':                 'S1 — Same property (color)',
  'S2-pos+color':             'S2 — Different properties (position + color)',
  'S2-rot+scale':             'S2 — Different properties (rotation + scale)',
  'S3-del+move':              'S3 — Delete vs. move',
  'S3-del+color':             'S3 — Delete vs. color change',
  'S4-concurrent-move':       'S4 — Concurrent moveObject (delta)',
  'S4-batch-move':            'S4 — 3 moves + 1 color (batch)',
  'S5-reparent':              'S5 — Concurrent reparenting (parentId)',
  'S5-childIds':              'S5 — Concurrent reparenting (childIds)',
  'S6-concurrent-create':     'S6 — Same ID creation',
  'S6-object-count':          'S6 — Object count after concurrent create',
  'S7-del-parent+edit-child': 'S7 — Parent deleted while child edited',
  'S7-orphan-on-create':      'S7 — Child created with missing parent',
  'S8-batch3+single':         'S8 — 3 batch ops vs. 1 op',
  'S8-chain-same-prop':       'S8 — Chain of same-property writes',
  'S9-double-delete':         'S9 — Double delete (idempotency)',
  'S9-untouched-neighbour':   'S9 — Adjacent object untouched',
  'S10-concurrent-link':      'S10 — Concurrent linkObject',
  'S10-link-vs-unlink':       'S10 — Link vs. unlink concurrently',
  'S11-stress':               'S11 — Multi-property stress',
  'S12-undo-vs-move':         'S12 — Undo vs. continued move',
  'S13-sequential-chain':     'S13 — Sequential chain + concurrent',
  'S14-clean-split':          'S14 ★ — Clean 4-property split, 0 overlap (A vs B/C/D)',
  'S15-nudge-accumulation':   'S15 ★ — Nudge accumulation: delta vs. LWW (A/B/D vs C)',
};

const SCENARIO_DESCRIPTIONS = {
  'S1-position': 'Alice and Bob concurrently update the <em>position</em> of the same object. This is a direct collision on the same property — only one value can win. The test measures convergence and which value survives.',
  'S1-color':    'Alice and Bob concurrently update the <em>color</em> of the same object. Like S1-position, this is a direct collision. The winner is determined by LWW (Last Write Wins) based on timestamp or revision number.',
  'S2-pos+color':  'Alice moves the object (position), Bob changes its color. These are <em>different properties</em> — there is no logical conflict. The key question: does the algorithm preserve <em>both</em> changes, or does one overwrite the other?',
  'S2-rot+scale':  'Alice updates rotation, Bob updates scale. Again independent properties. Same as S2-pos+color but with a different property pair to confirm the behavior is general.',
  'S3-del+move':   'Alice deletes the object while Bob moves it concurrently. Which intent wins: the deletion or the move? And are both peers in the same state afterwards?',
  'S3-del+color':  'Alice deletes the object while Bob changes its color. Variant of S3-del+move to test whether delete always wins, or whether the object sometimes survives with the new color.',
  'S4-concurrent-move':  'Alice and Bob concurrently call <code>moveObject(+5)</code> and <code>moveObject(+3)</code> respectively. Ideal outcome: position = 8 (both deltas applied). Variant C is designed to guarantee this via commutative delta operations.',
  'S4-batch-move':       'Alice makes 3 consecutive <code>moveObject(+1)</code> calls while offline, Bob changes the color. Tests whether multiple sequential delta operations from one peer are preserved alongside an independent update from the other.',
  'S5-reparent':   'Alice and Bob each attach the same child object to a different parent (<em>parent-A</em> vs. <em>parent-B</em>). Only one parent can win. The test verifies: does <code>parentId</code> converge to a single value on both peers?',
  'S5-childIds':   'Extension of S5: in addition to the <code>parentId</code> on the child, the <code>childIds</code> arrays on the respective parents are also updated. After sync: is there cross-object consistency? i.e., does only the winning parent contain the child in its <code>childIds</code>?',
  'S6-concurrent-create':  'Alice and Bob both create an object with the <em>same ID</em> but a different color. Does the system converge to one object? And which color wins?',
  'S6-object-count':       'After concurrent creation of a shared ID plus unique objects per peer: does the system show the same object count on both peers? Tests object-count consistency.',
  'S7-del-parent+edit-child': 'A child object has <code>parentId=parent</code>. Alice deletes the parent, Bob edits the child. After sync: are both peers consistent about the state of the child — and is the child potentially orphaned?',
  'S7-orphan-on-create':   'Alice deletes a parent object while Bob simultaneously creates a child with that parent. After sync: is the child present? If so, does <code>parentId</code> reference a non-existent object (orphan)?',
  'S8-batch3+single':      'Alice makes 3 offline updates to <em>different</em> properties (position, rotation, scale), Bob makes 1 update to color. Are all 4 updates preserved? Tests whether the variant handles multiple concurrent property changes correctly.',
  'S8-chain-same-prop':    'Alice changes the color 3 times in sequence (offline), Bob changes the color once. After sync: which color wins? The test expects Alice\'s last color (#333333) or Bob\'s (#0000FF) — not an intermediate value.',
  'S9-double-delete':      'Both peers delete the same object at the same time. Does the system converge to "deleted"? This tests idempotency: a double delete must not cause an error or inconsistency.',
  'S9-untouched-neighbour':'After the double delete of <em>box-1</em>: is <em>box-2</em> (an untouched object) still correct on both peers? Tests that a delete has no side-effect on unrelated objects.',
  'S10-concurrent-link':   'Alice and Bob concurrently call <code>linkObject(child, parent-A)</code> and <code>linkObject(child, parent-B)</code>. Does <code>parentId</code> converge to a single value? Are the <code>childIds</code> arrays on both candidate parents consistent?',
  'S10-link-vs-unlink':    'Alice detaches a child from its parent (<code>unlinkObject</code>), Bob attaches the same child to a new parent. After sync: is <code>parentId</code> consistent on both peers?',
  'S11-stress':            'Stress test with 6 concurrent edits: Alice updates 4 properties (position, rotation, scale, color), Bob updates 2 (color and rotation — <em>both overlap</em> with Alice). How many of the 6 intended changes survive? Which properties cause conflicts?',
  'S12-undo-vs-move':      'The object is at position [5,5,5]. Alice "undoes" the last edit and resets it to [0,0,0], Bob moves further to [10,10,10]. Concurrently. Who wins: the undo or the progress? Illustrates that no variant natively understands "undo" — it is simply a LWW conflict on position.',
  'S13-sequential-chain':  'Alice makes 4 consecutive offline changes to <em>different</em> properties (position, rotation, scale, color), Bob makes 1 change to position (conflict!). After sync: do Alice\'s 3 non-conflicting properties survive? And who wins the position?',
  'S14-clean-split':
    '<strong>★ Key demonstration: A vs. B/C/D.</strong> Alice and Bob each edit two <em>completely different</em> properties — zero overlap. ' +
    'Alice changes position + rotation, Bob changes scale + color. ' +
    'Variant A stores the entire object as a single blob: the losing write disappears entirely, including its two non-conflicting properties. ' +
    'Variants B, C, and D preserve all 4 properties because they track changes at the property level. ' +
    '<em>This is the best single scenario to demonstrate the advantage of property-level granularity.</em>',
  'S15-nudge-accumulation':
    '<strong>★ Key demonstration: A/B/D vs. C.</strong> Alice nudges the object 3× by [+1,0,0], Bob nudges 2× by [+1,0,0] — all offline. ' +
    'Ideal outcome: x = 5 (all five nudges summed). ' +
    'Variant C stores each <code>moveObject</code> call as a separate delta in a Y.Array log; on sync all deltas are summed — order does not matter. ' +
    'Variants A, B, and D use LWW on the position property: the last absolute value wins. One peer\'s nudges overwrite the other\'s. ' +
    '<em>This is the best scenario to demonstrate Variant C\'s unique delta-commutative behaviour.</em>',
};

const VARIANT_WHY = {
  A: {
    'BOTH PRESERVED': 'Variant A preserves both intents because the properties happen to be in the same write, or because the winning write coincidentally contains the same values.',
    'INTENT LOST':    'Variant A stores the entire object as a single Y.Map entry. Every <code>updateObject()</code> call overwrites the full object. When Alice writes position and Bob writes color, those two writes compete for the <em>entire</em> object. The higher timestamp wins and overwrites all properties — including the property the losing peer changed but did not intend to overwrite.',
    'PARTIAL':        'Variant A: multiple concurrent writes compete for the full object. The winning write happens to contain some of the desired values, but not all.',
    null:             'Variant A converges, but no intent score is available for this scenario.',
  },
  B: {
    'BOTH PRESERVED': 'Variant B stores each property in its own nested Y.Map entry. Alice\'s write to <em>position</em> and Bob\'s write to <em>color</em> never touch the same slot — there is no conflict. Both intents survive automatically.',
    'INTENT LOST':    'Variant B uses per-property LWW. When two peers concurrently update the <em>same property</em>, the write with the higher timestamp wins. The losing write is discarded entirely — there is no merge possible for scalar values such as color or position.',
    'PARTIAL':        'Variant B: some properties were written concurrently and lost via LWW. Non-conflicting properties were preserved.',
    null:             'Variant B converges, but no intent score is available for this scenario.',
  },
  C: {
    'BOTH PRESERVED': 'Variant C: for <code>moveObject</code>, deltas are commutative — they are stored as individual ops in a Y.Array and always all applied, regardless of order. For <code>updateObject</code>, Variant C uses property-level LWW, just like B.',
    'INTENT LOST':    'Variant C uses property-level LWW for absolute values written via <code>updateObject</code>. Concurrent writes to the same property → one loses. For <code>moveObject</code> deltas this would not occur, but in this scenario absolute values were written.',
    'PARTIAL':        'Variant C: delta ops (moveObject) are commutative and preserved. Absolute value conflicts (updateObject on the same property) are resolved via LWW and lose one intent.',
    null:             'Variant C converges, but no intent score is available for this scenario.',
  },
  D: {
    'BOTH PRESERVED': 'Variant D sends operations to a central OT server. The <code>transform()</code> function ensures that independent operations on different properties are always both preserved — this is transformation property TP1 from Operational Transformation.',
    'INTENT LOST':    'Variant D follows a "first to server wins" policy. The second operation received by the server is transformed against the first. On a conflict for the same property, the first wins — the second loses its intent. This is deterministic and fully auditable.',
    'PARTIAL':        'Variant D: the OT server transforms operations. Independent properties are preserved. Conflicting properties follow "first to server wins".',
    null:             'Variant D converges, but no intent score is available for this scenario.',
  },
};

const S_TITLES = {
  S1:  'S1 — Same property, concurrent edit',
  S2:  'S2 — Different properties, concurrent edit',
  S3:  'S3 — Delete vs. update',
  S4:  'S4 — Concurrent moveObject (delta)',
  S5:  'S5 — Concurrent reparenting',
  S6:  'S6 — Concurrent object creation (same ID)',
  S7:  'S7 — Parent deleted while child edited',
  S8:  'S8 — Batch ops vs. single op',
  S9:  'S9 — Double delete (idempotency)',
  S10: 'S10 — Concurrent linkObject',
  S11: 'S11 — Multi-property stress',
  S12: 'S12 — Undo vs. continued move',
  S13: 'S13 — Sequential chain + concurrent',
  S14: 'S14 ★ — Clean 4-property split, 0 overlap (A vs B/C/D)',
  S15: 'S15 ★ — Nudge accumulation: delta vs. LWW (A/B/D vs C)',
};

// ---------------------------------------------------------------------------
// 5. Build data structures
// ---------------------------------------------------------------------------

const scenarios = [...new Set(results.map(r => r.scenario))];

const matrix = {};
for (const r of results) {
  if (!matrix[r.scenario]) matrix[r.scenario] = {};
  if (!matrix[r.scenario][r.variant]) matrix[r.scenario][r.variant] = r;
}

const summaryMatch = clean.match(/Tests\s+(\d+) passed[^\n]*\((\d+)\)/);
const passed = summaryMatch ? parseInt(summaryMatch[1]) : '?';
const total  = summaryMatch ? parseInt(summaryMatch[2]) : '?';

function sGroup(scenario) {
  const m = scenario.match(/^(S\d+)/);
  return m ? m[1] : 'other';
}

const scenarioGroups = {};
for (const s of scenarios) {
  const g = sGroup(s);
  if (!scenarioGroups[g]) scenarioGroups[g] = [];
  scenarioGroups[g].push(s);
}

// ---------------------------------------------------------------------------
// 6. HTML generation helpers
// ---------------------------------------------------------------------------

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function cellColor(r) {
  if (!r) return { bg: '#374151', text: '#9ca3af', label: '—' };
  if (!r.converged) return { bg: '#7f1d1d', text: '#fca5a5', label: '✗ DIVERGED' };
  if (r.verdict === 'BOTH PRESERVED') return { bg: '#14532d', text: '#86efac', label: '✓ BOTH' };
  if (r.verdict === 'INTENT LOST')    return { bg: '#7f1d1d', text: '#fca5a5', label: '✗ LOST' };
  if (r.verdict === 'PARTIAL')        return { bg: '#78350f', text: '#fde68a', label: '~ PARTIAL' };
  return { bg: '#1e3a5f', text: '#93c5fd', label: '✓ CONV' };
}

function intentBar(score) {
  if (score === null) return '<span style="color:#6b7280">—</span>';
  const color = score === 100 ? '#22c55e' : score === 0 ? '#ef4444' : '#eab308';
  return `<span style="color:${color};font-weight:700">${score}%</span>`;
}

function fmtVal(v) {
  if (v === null || v === undefined) return '<em style="color:#6b7280">null</em>';
  const s = JSON.stringify(v);
  if (s.length > 40) return `<span title="${esc(s)}">${esc(s.slice(0, 38))}…</span>`;
  return esc(s);
}

function buildDiffTable(detail) {
  if (!detail) return '';

  const ai = detail.aliceIntended ?? {};
  const bi = detail.bobIntended   ?? {};
  const fs = detail.finalState    ?? {};
  const is = detail.initialState  ?? {};

  const allKeys = [...new Set([...Object.keys(ai), ...Object.keys(bi)])];
  if (allKeys.length === 0) return '';

  const rows = allKeys.map(k => {
    const aWanted  = ai[k];
    const bWanted  = bi[k];
    const initial  = is[k];
    const final    = fs[k];

    const aHas   = k in ai;
    const bHas   = k in bi;

    let aCheck = '', bCheck = '';
    if (aHas) {
      const preserved = JSON.stringify(final) === JSON.stringify(aWanted);
      aCheck = preserved
        ? '<span style="color:#22c55e;font-size:14px">✓</span>'
        : '<span style="color:#ef4444;font-size:14px">✗</span>';
    }
    if (bHas) {
      const preserved = JSON.stringify(final) === JSON.stringify(bWanted);
      bCheck = preserved
        ? '<span style="color:#22c55e;font-size:14px">✓</span>'
        : '<span style="color:#ef4444;font-size:14px">✗</span>';
    }

    const initCell  = (k in is) ? `<span style="color:#9ca3af">${fmtVal(initial)}</span>` : '<span style="color:#4b5563">—</span>';
    const aCell     = aHas ? `<span style="color:#c084fc">${fmtVal(aWanted)}</span>` : '<span style="color:#4b5563">—</span>';
    const bCell     = bHas ? `<span style="color:#60a5fa">${fmtVal(bWanted)}</span>` : '<span style="color:#4b5563">—</span>';
    const finalCell = `<span style="color:#f9fafb">${fmtVal(final)}</span>`;

    return `
      <tr style="border-top:1px solid #374151">
        <td style="padding:5px 10px;font-family:monospace;font-size:12px;color:#e5e7eb;white-space:nowrap">${esc(k)}</td>
        <td style="padding:5px 10px;text-align:center;font-family:monospace;font-size:12px">${initCell}</td>
        <td style="padding:5px 10px;text-align:center;font-family:monospace;font-size:12px">${aCell}</td>
        <td style="padding:5px 10px;text-align:center">${aCheck}</td>
        <td style="padding:5px 10px;text-align:center;font-family:monospace;font-size:12px">${bCell}</td>
        <td style="padding:5px 10px;text-align:center">${bCheck}</td>
        <td style="padding:5px 10px;text-align:center;font-family:monospace;font-size:12px">${finalCell}</td>
      </tr>`;
  }).join('');

  return `
    <table style="width:100%;border-collapse:collapse;background:#111827;border-radius:6px;overflow:hidden;margin-top:10px">
      <thead>
        <tr style="background:#0f172a;color:#6b7280;font-size:11px;text-transform:uppercase;letter-spacing:.05em">
          <th style="padding:5px 10px;text-align:left">Property</th>
          <th style="padding:5px 10px">Initial</th>
          <th style="padding:5px 10px;color:#c084fc">Alice intended</th>
          <th style="padding:5px 10px;color:#c084fc">✓</th>
          <th style="padding:5px 10px;color:#60a5fa">Bob intended</th>
          <th style="padding:5px 10px;color:#60a5fa">✓</th>
          <th style="padding:5px 10px">Final value</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function buildWhyBox(variant, verdict) {
  const why = (VARIANT_WHY[variant] ?? {})[verdict] ?? (VARIANT_WHY[variant] ?? {})[null] ?? '';
  if (!why) return '';
  const color = verdict === 'BOTH PRESERVED' ? '#14532d' : verdict === 'INTENT LOST' ? '#450a0a' : '#1c1917';
  const border = verdict === 'BOTH PRESERVED' ? '#166534' : verdict === 'INTENT LOST' ? '#7f1d1d' : '#78350f';
  return `
    <div style="background:${color};border-left:3px solid ${border};padding:10px 14px;border-radius:0 6px 6px 0;margin-top:10px;font-size:13px;line-height:1.6;color:#e5e7eb">
      <strong style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#9ca3af">Why?</strong><br>
      ${why}
    </div>`;
}

function scoreRow(scenario, variant, r, detail) {
  if (!r) return `<tr><td colspan="6" style="color:#4b5563;padding:6px 10px">no data</td></tr>`;

  const conv  = r.converged
    ? '<span style="color:#22c55e">✓ yes</span>'
    : '<span style="color:#ef4444">✗ NO</span>';

  const v = r.verdict ?? (r.aliceScore === null && r.bobScore === null ? '(no score)' : '');
  const vColor = r.verdict === 'BOTH PRESERVED' ? '#22c55e'
               : r.verdict === 'INTENT LOST'    ? '#ef4444'
               : r.verdict === 'PARTIAL'         ? '#eab308'
               : '#9ca3af';

  const diffTable = buildDiffTable(detail);
  const whyBox    = buildWhyBox(variant, r.verdict);

  const uid = `detail-${variant}-${scenario.replace(/[^a-zA-Z0-9]/g, '_')}`;

  const expandLink = (diffTable || whyBox)
    ? `<a href="javascript:void(0)" onclick="toggle('${uid}')" style="color:#6366f1;font-size:11px;margin-left:8px;text-decoration:none">▼ detail</a>`
    : '';

  return `
    <tr>
      <td style="padding:6px 10px;font-family:monospace;color:#c084fc">Variant ${variant}</td>
      <td style="padding:6px 10px;text-align:center">${conv}</td>
      <td style="padding:6px 10px;text-align:center">${intentBar(r.aliceScore)}</td>
      <td style="padding:6px 10px;text-align:center">${intentBar(r.bobScore)}</td>
      <td style="padding:6px 10px;font-weight:600;color:${vColor}">${v}${expandLink}</td>
      <td style="padding:6px 10px;color:#9ca3af;font-size:12px">${esc(r.note)}</td>
    </tr>
    ${(diffTable || whyBox) ? `
    <tr id="${uid}" style="display:none">
      <td colspan="6" style="padding:0 10px 12px 10px;background:#111827">
        ${diffTable}${whyBox}
      </td>
    </tr>` : ''}`;
}

// ---------------------------------------------------------------------------
// 7. Build HTML sections
// ---------------------------------------------------------------------------

const matrixRows = scenarios.map(s => {
  const label = SCENARIO_LABELS[s] ?? s;
  const cells = VARIANTS.map(v => {
    const r = matrix[s]?.[v];
    const c = cellColor(r);
    const score = r && (r.aliceScore !== null || r.bobScore !== null)
      ? `<div style="font-size:10px;margin-top:2px;opacity:.8">${r.aliceScore ?? '—'}% / ${r.bobScore ?? '—'}%</div>`
      : '';
    const tip = r ? `converged=${r.converged ? '✓' : '✗'} | ${r.note || r.verdict || ''}` : 'no data';
    return `<td title="${esc(tip)}" style="background:${c.bg};color:${c.text};text-align:center;padding:8px 4px;font-size:12px;font-weight:600;min-width:80px">${c.label}${score}</td>`;
  }).join('');
  return `<tr><td style="padding:8px 12px;font-size:13px;color:#d1d5db;white-space:nowrap">${label}</td>${cells}</tr>`;
}).join('');

const detailSections = Object.entries(scenarioGroups).map(([group, slist]) => {
  const title = S_TITLES[group] ?? group;

  const tables = slist.map(s => {
    const label = SCENARIO_LABELS[s] ?? s;
    const desc  = SCENARIO_DESCRIPTIONS[s];
    const rows  = VARIANTS.map(v => {
      const key    = `${v}:${s}`;
      const detail = detailMap[key] ?? null;
      return scoreRow(s, v, matrix[s]?.[v], detail);
    }).join('');

    return `
      <div style="margin-bottom:24px">
        <h4 style="color:#a78bfa;font-size:14px;margin:0 0 6px">${label}</h4>
        ${desc ? `<p style="color:#9ca3af;font-size:13px;line-height:1.6;margin:0 0 12px">${desc}</p>` : ''}
        <table style="width:100%;border-collapse:collapse;background:#1f2937;border-radius:6px;overflow:hidden">
          <thead>
            <tr style="background:#111827;color:#6b7280;font-size:12px">
              <th style="padding:6px 10px;text-align:left">Variant</th>
              <th style="padding:6px 10px">Converged</th>
              <th style="padding:6px 10px;color:#c084fc">Alice %</th>
              <th style="padding:6px 10px;color:#60a5fa">Bob %</th>
              <th style="padding:6px 10px;text-align:left">Verdict</th>
              <th style="padding:6px 10px;text-align:left">Note</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }).join('');

  return `
    <details style="margin-bottom:16px" open>
      <summary style="cursor:pointer;padding:12px 16px;background:#1f2937;border-radius:8px;color:#e5e7eb;font-size:16px;font-weight:600;list-style:none;display:flex;align-items:center;gap:8px">
        <span style="color:#7c3aed">▶</span> ${title}
      </summary>
      <div style="padding:16px 0">${tables}</div>
    </details>`;
}).join('');

const variantCards = VARIANTS.map(v => {
  const myResults = results.filter(r => r.variant === v);
  const preserved = myResults.filter(r => r.verdict === 'BOTH PRESERVED').length;
  const lost      = myResults.filter(r => r.verdict === 'INTENT LOST').length;
  const partial   = myResults.filter(r => r.verdict === 'PARTIAL').length;
  const scorable  = myResults.filter(r => r.verdict != null).length;

  const pct      = scorable > 0 ? Math.round(preserved / scorable * 100) : 0;
  const barColor = pct >= 80 ? '#22c55e' : pct >= 50 ? '#eab308' : '#ef4444';

  return `
    <div style="background:#1f2937;border-radius:12px;padding:20px;flex:1;min-width:180px">
      <div style="font-size:20px;font-weight:700;color:#c084fc;margin-bottom:4px">Variant ${v}</div>
      <div style="font-size:13px;color:#9ca3af;margin-bottom:12px">${VARIANT_LABELS[v].split('—')[1].trim()}</div>
      <div style="font-size:12px;color:#6b7280;margin-bottom:12px;line-height:1.5">${VARIANT_DESC[v]}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
        <span style="background:#14532d;color:#86efac;padding:3px 8px;border-radius:4px;font-size:12px">✓ ${preserved} preserved</span>
        <span style="background:#7f1d1d;color:#fca5a5;padding:3px 8px;border-radius:4px;font-size:12px">✗ ${lost} lost</span>
        ${partial > 0 ? `<span style="background:#78350f;color:#fde68a;padding:3px 8px;border-radius:4px;font-size:12px">~ ${partial} partial</span>` : ''}
      </div>
      <div style="background:#111827;border-radius:4px;height:8px;overflow:hidden">
        <div style="background:${barColor};width:${pct}%;height:100%"></div>
      </div>
      <div style="font-size:11px;color:#6b7280;margin-top:4px">${pct}% of scorable scenarios: both intents preserved</div>
    </div>`;
}).join('');

// ---------------------------------------------------------------------------
// 8. Assemble full HTML
// ---------------------------------------------------------------------------

const now = new Date().toLocaleString('en-GB');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Variant Test Report — Collaborative 3D Editor</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #111827; color: #e5e7eb; padding: 32px; min-height: 100vh; }
    h1 { font-size: 28px; font-weight: 800; background: linear-gradient(135deg, #a78bfa, #60a5fa); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 8px; }
    h2 { font-size: 20px; font-weight: 700; color: #f3f4f6; margin: 36px 0 16px; }
    details summary::-webkit-details-marker { display: none; }
    details[open] summary span:first-child { transform: rotate(90deg); display: inline-block; }
    table { border-collapse: collapse; }
    tr:hover > td { filter: brightness(1.12); }
    .legend-dot { display: inline-block; width: 12px; height: 12px; border-radius: 2px; margin-right: 6px; vertical-align: middle; }
    @media (max-width: 700px) { body { padding: 16px; } }
  </style>
  <script>
    function toggle(id) {
      var el = document.getElementById(id);
      if (el) el.style.display = el.style.display === 'none' ? 'table-row' : 'none';
    }
  </script>
</head>
<body>

  <!-- Header -->
  <div style="margin-bottom:32px">
    <h1>Conflict Resolution — Test Report</h1>
    <p style="color:#6b7280;font-size:14px">
      Generated on ${now}
      &nbsp;·&nbsp;
      <span style="color:${passed === total ? '#22c55e' : '#ef4444'}">${passed}/${total} tests passed</span>
    </p>
  </div>

  <!-- Variant cards -->
  <h2>Variants</h2>
  <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:40px">
    ${variantCards}
  </div>

  <!-- Matrix heatmap -->
  <h2>Scenario Matrix</h2>
  <p style="color:#6b7280;font-size:13px;margin-bottom:12px">
    Row = scenario, column = variant. Hover over a cell for the note.
    Green = both intents preserved · Red = intent lost · Yellow = partial · Blue = convergence only
  </p>
  <div style="overflow-x:auto;margin-bottom:12px">
    <table style="border-collapse:separate;border-spacing:2px">
      <thead>
        <tr>
          <th style="padding:8px 12px;text-align:left;color:#6b7280;font-size:13px;background:#1f2937;border-radius:6px">Scenario</th>
          ${VARIANTS.map(v => `<th style="padding:8px 12px;text-align:center;color:#a78bfa;font-size:13px;background:#1f2937;border-radius:6px;min-width:90px">${v}</th>`).join('')}
        </tr>
      </thead>
      <tbody>${matrixRows}</tbody>
    </table>
  </div>

  <!-- Legend -->
  <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:40px;font-size:12px;color:#9ca3af">
    <span><span class="legend-dot" style="background:#14532d"></span>BOTH — both intents preserved</span>
    <span><span class="legend-dot" style="background:#7f1d1d"></span>LOST — at least one intent lost</span>
    <span><span class="legend-dot" style="background:#78350f"></span>PARTIAL — partially preserved</span>
    <span><span class="legend-dot" style="background:#1e3a5f"></span>CONV — convergence only</span>
    <span><span class="legend-dot" style="background:#374151"></span>— — no data</span>
  </div>

  <!-- Detail sections -->
  <h2>Scenario Details</h2>
  <p style="color:#6b7280;font-size:13px;margin-bottom:20px">
    Click a scenario group to expand.
    Click <span style="color:#6366f1">▼ detail</span> on a variant row to view the property diff and explanation.
  </p>
  ${detailSections}

  <!-- Raw output -->
  <details style="margin-top:32px">
    <summary style="cursor:pointer;padding:12px 16px;background:#1f2937;border-radius:8px;color:#6b7280;font-size:14px;list-style:none;display:flex;align-items:center;gap:8px">
      <span style="color:#4b5563">▶</span> Raw test output
    </summary>
    <pre style="background:#0f172a;color:#94a3b8;font-size:11px;padding:16px;border-radius:8px;overflow-x:auto;margin-top:8px;line-height:1.6;white-space:pre-wrap">${clean.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
  </details>

  <p style="margin-top:32px;color:#374151;font-size:12px;text-align:center">Bachelor's Thesis — Scene-aware Collaborative 3D Editor</p>
</body>
</html>`;

// ---------------------------------------------------------------------------
// 9. Write output
// ---------------------------------------------------------------------------

const outPath = path.resolve(__dirname, '..', 'test-report-en.html');
fs.writeFileSync(outPath, html, 'utf8');
console.log(`\nReport written to: ${outPath}`);
console.log(`Open in browser:   start "" "${outPath}"`);
