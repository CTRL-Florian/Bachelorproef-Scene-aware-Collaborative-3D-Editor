#!/usr/bin/env node
/**
 * Variant Test Report Generator
 *
 * Runs all variant tests, parses the structured output, and writes
 * a self-contained HTML report to test-report.html.
 *
 * Usage:  node scripts/report.cjs
 *         npm run report
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

const verdictRe = /\[Variant ([A-D])\] (S\d+[-\w]*)\s+converged=(✓|✗)(?:\s+alice=(\d+)%)?(?:\s+bob=(\d+)%)?(?:\s+(BOTH PRESERVED|INTENT LOST|PARTIAL))?(?:\s+(.+))?/g;

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

/**
 * Lines emitted by reportDetailed() look like:
 *   [DETAIL] {"variant":"Variant B","scenario":"S2-pos+color", ...}
 *
 * We normalise "Variant X" → "X" so we can join with the verdict results.
 */
const detailMap = {}; // key: "A:S2-pos+color"

for (const line of clean.split('\n')) {
  const idx = line.indexOf('[DETAIL] ');
  if (idx === -1) continue;
  try {
    const obj = JSON.parse(line.slice(idx + 9));
    // normalise variant field
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
  A: 'Het hele object wordt vervangen bij elke update. Concurrent edits op verschillende properties verliezen altijd één update.',
  B: 'Elke property heeft zijn eigen CRDT-slot. Concurrent edits op verschillende properties bewaren altijd beide intents.',
  C: "moveObject-deltas worden als commutative ops in een Y.Array opgeslagen (+5 en +3 geeft altijd 8). updateObject volgt property-level LWW.",
  D: 'Een centrale server transformeert concurrent operaties. "Eerst bij server" wint bij conflicten. Volledig auditeerbaar.',
};

const SCENARIO_LABELS = {
  'S1-position':              'S1 — Zelfde property (positie)',
  'S1-color':                 'S1 — Zelfde property (kleur)',
  'S2-pos+color':             'S2 — Andere properties (positie + kleur)',
  'S2-rot+scale':             'S2 — Andere properties (rotatie + schaal)',
  'S3-del+move':              'S3 — Delete vs. verplaats',
  'S3-del+color':             'S3 — Delete vs. kleurwijziging',
  'S4-concurrent-move':       'S4 — Gelijktijdig moveObject (delta)',
  'S4-batch-move':            'S4 — 3 moves + 1 kleur (batch)',
  'S5-reparent':              'S5 — Concurrent reparenting (parentId)',
  'S5-childIds':              'S5 — Concurrent reparenting (childIds)',
  'S6-concurrent-create':     'S6 — Zelfde ID aanmaken',
  'S6-object-count':          'S6 — Objecttelling na concurrent create',
  'S7-del-parent+edit-child': 'S7 — Ouder verwijderd, kind bewerkt',
  'S7-orphan-on-create':      'S7 — Kind aangemaakt met verdwenen ouder',
  'S8-batch3+single':         'S8 — 3 batch ops vs. 1 op',
  'S8-chain-same-prop':       'S8 — Ketting van zelfde property',
  'S9-double-delete':         'S9 — Dubbele delete (idempotentie)',
  'S9-untouched-neighbour':   'S9 — Naburig object onaangetast',
  'S10-concurrent-link':      'S10 — Gelijktijdig linkObject',
  'S10-link-vs-unlink':       'S10 — Link vs. unlink gelijktijdig',
  'S11-stress':               'S11 — Multi-property stress',
  'S12-undo-vs-move':         'S12 — Undo vs. verdere verplaatsing',
  'S13-sequential-chain':     'S13 — Sequentiële keten + concurrent',
};

/** What each test does — shown as the scenario description in the HTML */
const SCENARIO_DESCRIPTIONS = {
  'S1-position': 'Alice en Bob passen tegelijkertijd de <em>positie</em> van hetzelfde object aan. Dit is een directe botsing op dezelfde property — slechts één waarde kan winnen. De test meet convergentie en welke waarde overblijft.',
  'S1-color':    'Alice en Bob passen tegelijkertijd de <em>kleur</em> van hetzelfde object aan. Net als S1-positie is dit een directe botsing. De winnaar wordt bepaald door LWW (Last Write Wins) op timestamp- of revisieniveau.',
  'S2-pos+color':  'Alice verplaatst het object (positie), Bob verandert de kleur. Dit zijn <em>verschillende properties</em> — er is geen logische botsing. De kernvraag: bewaart het algoritme <em>beide</em> wijzigingen, of overschrijft de ene de andere?',
  'S2-rot+scale':  'Alice wijzigt de rotatie, Bob de schaal. Opnieuw onafhankelijke properties. Zoals S2-pos+color maar met andere property-paren om te bevestigen dat het gedrag generiek is.',
  'S3-del+move':   'Alice verwijdert het object, Bob verplaatst het tegelijkertijd. Welk intent wint: het verwijderen of de verplaatsing? En zijn beide peers daarna in dezelfde toestand?',
  'S3-del+color':  'Alice verwijdert het object, Bob wijzigt de kleur. Variant op S3-del+move om te testen of delete altijd wint, of soms het object overleeft met de nieuwe kleur.',
  'S4-concurrent-move':  'Alice en Bob roepen gelijktijdig <code>moveObject(+5)</code> resp. <code>moveObject(+3)</code> aan. Ideale uitkomst: positie = 8 (beide deltas toegepast). Variant C is ontworpen om dit te garanderen via commutatieve delta-operaties.',
  'S4-batch-move':       'Alice doet 3 opeenvolgende <code>moveObject(+1)</code> calls offline, Bob wijzigt de kleur. Test of meerdere sequentiële delta-operaties van één peer bewaard blijven naast een onafhankelijke update van de andere peer.',
  'S5-reparent':   'Alice en Bob koppelen hetzelfde kind-object elk aan een andere ouder (<em>parent-A</em> vs. <em>parent-B</em>). Slechts één parent kan winnen. De test verifica: convergeert de <code>parentId</code> naar één waarde op beide peers?',
  'S5-childIds':   'Uitbreiding van S5: naast de <code>parentId</code> op het kind, bijwerken ook de <code>childIds</code>-array op de respectievelijke ouders. Na sync: is er cross-object consistentie? D.w.z. bevat alleen de winnende ouder het kind in zijn <code>childIds</code>?',
  'S6-concurrent-create':  'Alice en Bob maken beiden een object aan met <em>hetzelfde ID</em> maar een andere kleur. Convergeert het systeem naar één object? En welke kleur wint?',
  'S6-object-count':       'Na concurrent create van een gedeeld ID plus eigen unieke objecten: telt het systeem hetzelfde aantal objecten op beide peers? Test objecttelling-consistentie.',
  'S7-del-parent+edit-child': 'Een kind-object heeft <code>parentId=parent</code>. Alice verwijdert de ouder, Bob past het kind aan. Na sync: zijn beide peers consistent over de staat van het kind — en staat het kind eventueel als wees?',
  'S7-orphan-on-create':   'Alice verwijdert een ouder-object, Bob maakt tegelijkertijd een kind aan met die ouder als parent. Na sync: is het kind aanwezig? Zo ja, is <code>parentId</code> een verwijzing naar een niet-bestaand object (wees)?',
  'S8-batch3+single':      'Alice doet 3 offline updates aan <em>verschillende</em> properties (positie, rotatie, schaal), Bob doet 1 update aan de kleur. Worden alle 4 updates bewaard? Dit test of de variant ook met meerdere eigenschappen tegelijk correct omgaat.',
  'S8-chain-same-prop':    'Alice past de kleur 3× opeenvolgend aan (offline), Bob past de kleur 1× aan. Na sync: welke kleur wint? De test verwacht de "laatste" kleur van Alice (#333333) of de van Bob (#0000FF) — maar niet een tussenliggende waarde.',
  'S9-double-delete':      'Beide peers verwijderen hetzelfde object tegelijkertijd. Convergeert het systeem naar "verwijderd"? Dit test idempotentie: een dubbele delete mag geen fout of inconsistentie veroorzaken.',
  'S9-untouched-neighbour':'Na de dubbele delete van <em>box-1</em>: staat <em>box-2</em> (een niet-aangeraakt object) nog correct op beide peers? Test dat een delete geen neveneffect heeft op andere objecten.',
  'S10-concurrent-link':   'Alice en Bob roepen gelijktijdig <code>linkObject(child, parent-A)</code> resp. <code>linkObject(child, parent-B)</code> aan. Convergeert <code>parentId</code> naar één waarde? En zijn ook de <code>childIds</code>-arrays op de ouders consistent?',
  'S10-link-vs-unlink':    'Alice ontkoppelt een kind van zijn ouder (<code>unlinkObject</code>), Bob koppelt hetzelfde kind aan een nieuwe ouder. Na sync: is <code>parentId</code> consistent op beide peers?',
  'S11-stress':            'Stresstest met 6 gelijktijdige edits: Alice past 4 properties aan (positie, rotatie, schaal, kleur), Bob past er 2 aan (kleur en rotatie — <em>beide overlappen</em> met Alice). Hoeveel van de 6 bedoelde wijzigingen overleven? En welke properties veroorzaken conflicten?',
  'S12-undo-vs-move':      'Het object staat op positie [5,5,5]. Alice "ondoet" de laatste bewerking en zet het terug op [0,0,0], Bob verplaatst verder naar [10,10,10]. Gelijktijdig. Wie wint: de undo of de vooruitgang? Illustreert dat geen enkele variant natively "undo" begrijpt — het is gewoon een LWW-conflict op positie.',
  'S13-sequential-chain':  'Alice doet 4 opeenvolgende offline wijzigingen aan <em>verschillende</em> properties (positie, rotatie, schaal, kleur), Bob doet 1 wijziging aan de positie (conflict!). Na sync: overleven Alice\'s 3 niet-conflicterende properties? En wie wint bij de positie?',
};

/** Per variant, per verdict: explain WHY */
const VARIANT_WHY = {
  A: {
    'BOTH PRESERVED': 'Variant A bewaart beide intents doordat de properties in dit geval in dezelfde write zitten, of omdat de winnende write toevallig dezelfde waarden bevat.',
    'INTENT LOST':    'Variant A slaat het hele object als één Y.Map-entry op. Bij elke <code>updateObject()</code> wordt het volledige object overschreven. Als Alice positie schrijft en Bob kleur schrijft, concurreren die twee writes voor het <em>volledige</em> object. De laatste timestamp wint en overschrijft alle properties — ook de property die de verliezende peer had aangepast maar niet had bedoeld te overschrijven.',
    'PARTIAL':        'Variant A: meerdere concurrent writes concurreren voor het volledige object. De winnende write bevat sommige van de gewenste waarden toevallig, maar niet alle.',
    null:             'Variant A convergeert, maar er is geen intent-score beschikbaar voor dit scenario.',
  },
  B: {
    'BOTH PRESERVED': 'Variant B slaat elke property op in een eigen geneste Y.Map-entry. Alice\'s write naar <em>positie</em> en Bob\'s write naar <em>kleur</em> raken nooit hetzelfde slot — er is geen conflict. Beide intents overleven automatisch.',
    'INTENT LOST':    'Variant B gebruikt per-property LWW. Wanneer twee peers <em>dezelfde property</em> concurrent aanpassen, wint de write met de hoogste timestamp. De verliezende write verdwijnt volledig — er is geen merge mogelijk voor scalaire waarden zoals kleur of positie.',
    'PARTIAL':        'Variant B: sommige properties werden concurrent geschreven en verloren via LWW. Niet-conflicterende properties werden bewaard.',
    null:             'Variant B convergeert, maar er is geen intent-score beschikbaar voor dit scenario.',
  },
  C: {
    'BOTH PRESERVED': 'Variant C: voor <code>moveObject</code> zijn deltas commutatief — ze worden als losse ops in een Y.Array opgeslagen en altijd allemaal toegepast, ongeacht volgorde. Voor <code>updateObject</code> gebruikt Variant C property-level LWW, net als B.',
    'INTENT LOST':    'Variant C gebruikt <code>updateObject</code> met property-level LWW voor absolute waarden. Concurrent schrijven naar dezelfde property → één verliest. Voor <code>moveObject</code> deltas zou dit niet optreden, maar in dit scenario werden absolute waarden geschreven.',
    'PARTIAL':        'Variant C: delta-ops (moveObject) zijn commutatief en bewaard. Absolute waarde-conflicten (updateObject op dezelfde property) worden via LWW opgelost en verliezen één intent.',
    null:             'Variant C convergeert, maar er is geen intent-score beschikbaar voor dit scenario.',
  },
  D: {
    'BOTH PRESERVED': 'Variant D stuurt operaties naar een centrale OT-server. De <code>transform()</code>-functie zorgt dat onafhankelijke operaties op verschillende properties altijd beide worden bewaard — dit is eigenschap TP1 van Operational Transformation.',
    'INTENT LOST':    'Variant D volgt het "eerst bij server wint"-principe. De tweede operatie die de server ontvangt, wordt getransformeerd t.o.v. de eerste. Bij een conflict op dezelfde property wint de eerste — de tweede verliest zijn intent. Dit is deterministisch en auditeerbaar.',
    'PARTIAL':        'Variant D: de OT-server transformeert operaties. Onafhankelijke properties worden bewaard. Conflicterende properties volgen "eerste bij server wint".',
    null:             'Variant D convergeert, maar er is geen intent-score beschikbaar voor dit scenario.',
  },
};

const S_TITLES = {
  S1:  'S1 — Zelfde property concurrent',
  S2:  'S2 — Verschillende properties concurrent',
  S3:  'S3 — Delete vs. update',
  S4:  'S4 — Concurrent moveObject (delta)',
  S5:  'S5 — Concurrent reparenting',
  S6:  'S6 — Concurrent object aanmaken (zelfde ID)',
  S7:  'S7 — Ouder verwijderd terwijl kind bewerkt',
  S8:  'S8 — Batch ops vs. enkele op',
  S9:  'S9 — Dubbele delete (idempotentie)',
  S10: 'S10 — Concurrent linkObject',
  S11: 'S11 — Multi-property stress',
  S12: 'S12 — Undo vs. verdere verplaatsing',
  S13: 'S13 — Sequentiële keten + concurrent',
};

// ---------------------------------------------------------------------------
// 5. Build data structures
// ---------------------------------------------------------------------------

const scenarios = [...new Set(results.map(r => r.scenario))];

// Matrix: scenario → variant → result
const matrix = {};
for (const r of results) {
  if (!matrix[r.scenario]) matrix[r.scenario] = {};
  if (!matrix[r.scenario][r.variant]) matrix[r.scenario][r.variant] = r;
}

const summaryMatch = clean.match(/Tests\s+(\d+) passed[^\n]*\((\d+)\)/);
const passed = summaryMatch ? parseInt(summaryMatch[1]) : '?';
const total  = summaryMatch ? parseInt(summaryMatch[2]) : '?';

// Group scenarios by S-number
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

/** Format a value for display — shorten long arrays/strings */
function fmtVal(v) {
  if (v === null || v === undefined) return '<em style="color:#6b7280">null</em>';
  const s = JSON.stringify(v);
  if (s.length > 40) return `<span title="${esc(s)}">${esc(s.slice(0, 38))}…</span>`;
  return esc(s);
}

/**
 * Build a property diff table from the [DETAIL] data.
 *
 * Shows each intended property, the final value, and ✓/✗ per peer.
 */
function buildDiffTable(detail) {
  if (!detail) return '';

  const ai = detail.aliceIntended ?? {};
  const bi = detail.bobIntended   ?? {};
  const fs = detail.finalState    ?? {};
  const is = detail.initialState  ?? {};

  // Collect all property keys involved
  const allKeys = [...new Set([...Object.keys(ai), ...Object.keys(bi)])];
  if (allKeys.length === 0) return '';

  const rows = allKeys.map(k => {
    const aWanted  = ai[k];
    const bWanted  = bi[k];
    const initial  = is[k];
    const final    = fs[k];

    const aHas   = k in ai;
    const bHas   = k in bi;

    // Determine if the intent was preserved
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
          <th style="padding:5px 10px">Begintoestand</th>
          <th style="padding:5px 10px;color:#c084fc">Alice wilde</th>
          <th style="padding:5px 10px;color:#c084fc">✓</th>
          <th style="padding:5px 10px;color:#60a5fa">Bob wilde</th>
          <th style="padding:5px 10px;color:#60a5fa">✓</th>
          <th style="padding:5px 10px">Eindwaarde</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

/** Build the WHY explanation for a variant+verdict combination */
function buildWhyBox(variant, verdict) {
  const why = (VARIANT_WHY[variant] ?? {})[verdict] ?? (VARIANT_WHY[variant] ?? {})[null] ?? '';
  if (!why) return '';
  const color = verdict === 'BOTH PRESERVED' ? '#14532d' : verdict === 'INTENT LOST' ? '#450a0a' : '#1c1917';
  const border = verdict === 'BOTH PRESERVED' ? '#166534' : verdict === 'INTENT LOST' ? '#7f1d1d' : '#78350f';
  return `
    <div style="background:${color};border-left:3px solid ${border};padding:10px 14px;border-radius:0 6px 6px 0;margin-top:10px;font-size:13px;line-height:1.6;color:#e5e7eb">
      <strong style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#9ca3af">Waarom?</strong><br>
      ${why}
    </div>`;
}

function scoreRow(scenario, variant, r, detail) {
  if (!r) return `<tr><td colspan="6" style="color:#4b5563;padding:6px 10px">geen data</td></tr>`;

  const conv  = r.converged
    ? '<span style="color:#22c55e">✓ ja</span>'
    : '<span style="color:#ef4444">✗ NEE</span>';

  const v = r.verdict ?? (r.aliceScore === null && r.bobScore === null ? '(geen score)' : '');
  const vColor = r.verdict === 'BOTH PRESERVED' ? '#22c55e'
               : r.verdict === 'INTENT LOST'    ? '#ef4444'
               : r.verdict === 'PARTIAL'         ? '#eab308'
               : '#9ca3af';

  const diffTable = buildDiffTable(detail);
  const whyBox    = buildWhyBox(variant, r.verdict);

  // Unique ID for the toggle
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
    const tip = r ? `converged=${r.converged ? '✓' : '✗'} | ${r.note || r.verdict || ''}` : 'geen data';
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
        <span style="background:#14532d;color:#86efac;padding:3px 8px;border-radius:4px;font-size:12px">✓ ${preserved} bewaard</span>
        <span style="background:#7f1d1d;color:#fca5a5;padding:3px 8px;border-radius:4px;font-size:12px">✗ ${lost} verloren</span>
        ${partial > 0 ? `<span style="background:#78350f;color:#fde68a;padding:3px 8px;border-radius:4px;font-size:12px">~ ${partial} gedeeltelijk</span>` : ''}
      </div>
      <div style="background:#111827;border-radius:4px;height:8px;overflow:hidden">
        <div style="background:${barColor};width:${pct}%;height:100%"></div>
      </div>
      <div style="font-size:11px;color:#6b7280;margin-top:4px">${pct}% van scorable scenarios: beide intents bewaard</div>
    </div>`;
}).join('');

// ---------------------------------------------------------------------------
// 8. Assemble full HTML
// ---------------------------------------------------------------------------

const now = new Date().toLocaleString('nl-BE');

const html = `<!DOCTYPE html>
<html lang="nl">
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
      Gegenereerd op ${now}
      &nbsp;·&nbsp;
      <span style="color:${passed === total ? '#22c55e' : '#ef4444'}">${passed}/${total} tests geslaagd</span>
    </p>
  </div>

  <!-- Variant cards -->
  <h2>Varianten</h2>
  <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:40px">
    ${variantCards}
  </div>

  <!-- Matrix heatmap -->
  <h2>Scenario Matrix</h2>
  <p style="color:#6b7280;font-size:13px;margin-bottom:12px">
    Rij = scenario, kolom = variant. Hover over een cel voor de note.
    Groen = beide intents bewaard · Rood = intent verloren · Geel = gedeeltelijk · Blauw = enkel convergentie
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
    <span><span class="legend-dot" style="background:#14532d"></span>BOTH — beide intents bewaard</span>
    <span><span class="legend-dot" style="background:#7f1d1d"></span>LOST — minstens één intent verloren</span>
    <span><span class="legend-dot" style="background:#78350f"></span>PARTIAL — gedeeltelijk bewaard</span>
    <span><span class="legend-dot" style="background:#1e3a5f"></span>CONV — enkel convergentie gemeten</span>
    <span><span class="legend-dot" style="background:#374151"></span>— — geen data</span>
  </div>

  <!-- Detail sections -->
  <h2>Scenario Details</h2>
  <p style="color:#6b7280;font-size:13px;margin-bottom:20px">
    Klik op een scenariogroep om de subtests te tonen.
    Klik op <span style="color:#6366f1">▼ detail</span> bij een variant-rij om de property-diff en verklaring te openen.
  </p>
  ${detailSections}

  <!-- Raw output -->
  <details style="margin-top:32px">
    <summary style="cursor:pointer;padding:12px 16px;background:#1f2937;border-radius:8px;color:#6b7280;font-size:14px;list-style:none;display:flex;align-items:center;gap:8px">
      <span style="color:#4b5563">▶</span> Ruwe test output
    </summary>
    <pre style="background:#0f172a;color:#94a3b8;font-size:11px;padding:16px;border-radius:8px;overflow-x:auto;margin-top:8px;line-height:1.6;white-space:pre-wrap">${clean.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
  </details>

  <p style="margin-top:32px;color:#374151;font-size:12px;text-align:center">Bachelorproef — Scene-aware Collaborative 3D Editor</p>
</body>
</html>`;

// ---------------------------------------------------------------------------
// 9. Write output
// ---------------------------------------------------------------------------

const outPath = path.resolve(__dirname, '..', 'test-report.html');
fs.writeFileSync(outPath, html, 'utf8');
console.log(`\nReport written to: ${outPath}`);
console.log(`Open in browser:   start "" "${outPath}"`);
