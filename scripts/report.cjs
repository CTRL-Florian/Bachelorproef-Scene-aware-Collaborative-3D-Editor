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

/**
 * Lines emitted by report() in shared-scenarios.ts look like:
 *   [Variant B] S2-pos+color  converged=✓  alice=100%  bob=100%  BOTH PRESERVED
 *   [Variant A] S1-position   converged=✓  alice=0%    bob=100%  INTENT LOST  winner=bob [5,0,0]
 *   [Variant C] S4-concurrent-move  converged=✓  x=8 (both deltas ✓)
 */
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

// Deduplicate: cross-variant.test.ts runs some of the same scenarios again.
// Keep only the first occurrence per (variant, scenario) pair.
const seen = new Set();
const results = allResults.filter(r => {
  const key = `${r.variant}:${r.scenario}`;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});

// Ordered list of scenarios and variants
const VARIANTS = ['A', 'B', 'C', 'D'];
const VARIANT_LABELS = {
  A: 'A — Object LWW',
  B: 'B — Property CRDT',
  C: 'C — Delta log',
  D: 'D — OT server',
};
const VARIANT_DESC = {
  A: 'Heel object wordt vervangen bij elke update. Concurrent edits op verschillende properties verliezen altijd één update.',
  B: 'Elke property heeft zijn eigen CRDT-slot. Concurrent edits op verschillende properties bewaren altijd beide intents.',
  C: 'Bewerkingen worden als delta\'s in een log opgeslagen. moveObject-deltas zijn commutatief: +5 en +3 geeft altijd 8.',
  D: 'Een centrale server transformeert concurrent operaties. "Eerst bij server" wint bij conflicten. Volledig auditeerbaar.',
};

const scenarios = [...new Set(results.map(r => r.scenario))];

// Matrix: scenario → variant → result
const matrix = {};
for (const r of results) {
  if (!matrix[r.scenario]) matrix[r.scenario] = {};
  // If multiple results for same scenario+variant (shouldn't happen after dedup), take first
  if (!matrix[r.scenario][r.variant]) matrix[r.scenario][r.variant] = r;
}

// Parse overall test summary
const summaryMatch = clean.match(/Tests\s+(\d+) passed[^\n]*\((\d+)\)/);
const passed = summaryMatch ? parseInt(summaryMatch[1]) : '?';
const total  = summaryMatch ? parseInt(summaryMatch[2]) : '?';

// ---------------------------------------------------------------------------
// 3. Helpers for HTML generation
// ---------------------------------------------------------------------------

const SCENARIO_LABELS = {
  'S1-position':          'S1 — Zelfde property (positie)',
  'S1-color':             'S1 — Zelfde property (kleur)',
  'S2-pos+color':         'S2 — Andere properties (positie + kleur)',
  'S2-rot+scale':         'S2 — Andere properties (rotatie + schaal)',
  'S3-del+move':          'S3 — Delete vs. verplaats',
  'S3-del+color':         'S3 — Delete vs. kleurwijziging',
  'S4-concurrent-move':   'S4 — Gelijktijdig moveObject (delta)',
  'S4-batch-move':        'S4 — 3 moves + 1 kleur (batch)',
  'S5-reparent':          'S5 — Concurrent reparenting (parentId)',
  'S5-childIds':          'S5 — Concurrent reparenting (childIds)',
  'S6-concurrent-create': 'S6 — Zelfde ID aanmaken',
  'S6-object-count':      'S6 — Objecttelling na concurrent create',
  'S7-del-parent+edit-child': 'S7 — Ouder verwijderd, kind bewerkt',
  'S7-orphan-on-create':  'S7 — Kind aangemaakt met verdwenen ouder',
  'S8-batch3+single':     'S8 — 3 batch ops vs. 1 op',
  'S8-chain-same-prop':   'S8 — Ketting van zelfde property',
  'S9-double-delete':     'S9 — Dubbele delete (idempotentie)',
  'S9-untouched-neighbour': 'S9 — Naburig object onaangetast',
  'S10-concurrent-link':  'S10 — Gelijktijdig linkObject',
  'S10-link-vs-unlink':   'S10 — Link vs. unlink gelijktijdig',
};

function cellColor(r) {
  if (!r) return { bg: '#374151', text: '#9ca3af', label: '—' };
  if (!r.converged) return { bg: '#7f1d1d', text: '#fca5a5', label: '✗ DIVERGED' };
  if (r.verdict === 'BOTH PRESERVED') return { bg: '#14532d', text: '#86efac', label: '✓ BOTH' };
  if (r.verdict === 'INTENT LOST')    return { bg: '#7f1d1d', text: '#fca5a5', label: '✗ LOST' };
  if (r.verdict === 'PARTIAL')        return { bg: '#78350f', text: '#fde68a', label: '~ PARTIAL' };
  // No intent score available — convergence only
  return { bg: '#1e3a5f', text: '#93c5fd', label: '✓ CONV' };
}

function intentBar(score) {
  if (score === null) return '<span style="color:#6b7280">—</span>';
  const color = score === 100 ? '#22c55e' : score === 0 ? '#ef4444' : '#eab308';
  return `<span style="color:${color};font-weight:700">${score}%</span>`;
}

function scoreRow(r) {
  if (!r) return '<tr><td colspan="6" style="color:#4b5563">geen data</td></tr>';

  const conv  = r.converged
    ? '<span style="color:#22c55e">✓ ja</span>'
    : '<span style="color:#ef4444">✗ NEE</span>';

  const v = r.verdict ?? (r.aliceScore === null && r.bobScore === null ? '(geen score)' : '');
  const vColor = r.verdict === 'BOTH PRESERVED' ? '#22c55e'
               : r.verdict === 'INTENT LOST'    ? '#ef4444'
               : r.verdict === 'PARTIAL'         ? '#eab308'
               : '#9ca3af';

  return `
    <tr>
      <td style="padding:6px 10px;font-family:monospace;color:#c084fc">Variant ${r.variant}</td>
      <td style="padding:6px 10px;text-align:center">${conv}</td>
      <td style="padding:6px 10px;text-align:center">${intentBar(r.aliceScore)}</td>
      <td style="padding:6px 10px;text-align:center">${intentBar(r.bobScore)}</td>
      <td style="padding:6px 10px;font-weight:600;color:${vColor}">${v}</td>
      <td style="padding:6px 10px;color:#9ca3af;font-size:12px">${r.note}</td>
    </tr>`;
}

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
};

// ---------------------------------------------------------------------------
// 4. Build HTML
// ---------------------------------------------------------------------------

const now = new Date().toLocaleString('nl-BE');

const matrixRows = scenarios.map(s => {
  const label = SCENARIO_LABELS[s] ?? s;
  const cells = VARIANTS.map(v => {
    const r = matrix[s]?.[v];
    const c = cellColor(r);
    const score = r && (r.aliceScore !== null || r.bobScore !== null)
      ? `<div style="font-size:10px;margin-top:2px;opacity:.8">${r.aliceScore ?? '—'}% / ${r.bobScore ?? '—'}%</div>`
      : '';
    const tip = r ? `converged=${r.converged ? '✓' : '✗'} | ${r.note || r.verdict || ''}` : 'geen data';
    return `<td title="${tip}" style="background:${c.bg};color:${c.text};text-align:center;padding:8px 4px;font-size:12px;font-weight:600;min-width:80px">${c.label}${score}</td>`;
  }).join('');
  return `<tr><td style="padding:8px 12px;font-size:13px;color:#d1d5db;white-space:nowrap">${label}</td>${cells}</tr>`;
}).join('');

const detailSections = Object.entries(scenarioGroups).map(([group, slist]) => {
  const title = S_TITLES[group] ?? group;
  const tables = slist.map(s => {
    const label = SCENARIO_LABELS[s] ?? s;
    const rows = VARIANTS.map(v => scoreRow(matrix[s]?.[v])).join('');
    return `
      <div style="margin-bottom:20px">
        <h4 style="color:#a78bfa;font-size:14px;margin:0 0 8px">${label}</h4>
        <table style="width:100%;border-collapse:collapse;background:#1f2937;border-radius:6px;overflow:hidden">
          <thead>
            <tr style="background:#111827;color:#6b7280;font-size:12px">
              <th style="padding:6px 10px;text-align:left">Variant</th>
              <th style="padding:6px 10px">Converged</th>
              <th style="padding:6px 10px">Alice intent</th>
              <th style="padding:6px 10px">Bob intent</th>
              <th style="padding:6px 10px">Verdict</th>
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
  const total     = myResults.filter(r => r.verdict != null).length;

  const pct = total > 0 ? Math.round(preserved / total * 100) : 0;
  const barColor = pct >= 80 ? '#22c55e' : pct >= 50 ? '#eab308' : '#ef4444';

  return `
    <div style="background:#1f2937;border-radius:12px;padding:20px;flex:1;min-width:180px">
      <div style="font-size:20px;font-weight:700;color:#c084fc;margin-bottom:4px">Variant ${v}</div>
      <div style="font-size:13px;color:#9ca3af;margin-bottom:16px">${VARIANT_LABELS[v].split('—')[1].trim()}</div>
      <div style="font-size:12px;color:#6b7280;margin-bottom:12px">${VARIANT_DESC[v]}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
        <span style="background:#14532d;color:#86efac;padding:3px 8px;border-radius:4px;font-size:12px">✓ ${preserved} bewaard</span>
        <span style="background:#7f1d1d;color:#fca5a5;padding:3px 8px;border-radius:4px;font-size:12px">✗ ${lost} verloren</span>
        ${partial > 0 ? `<span style="background:#78350f;color:#fde68a;padding:3px 8px;border-radius:4px;font-size:12px">~ ${partial} gedeeltelijk</span>` : ''}
      </div>
      <div style="background:#111827;border-radius:4px;height:8px;overflow:hidden">
        <div style="background:${barColor};width:${pct}%;height:100%;transition:width .3s"></div>
      </div>
      <div style="font-size:11px;color:#6b7280;margin-top:4px">${pct}% van scorable scenarios: beide intents bewaard</div>
    </div>`;
}).join('');

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
    h2 { font-size: 20px; font-weight: 700; color: #f3f4f6; margin: 32px 0 16px; }
    h3 { font-size: 16px; font-weight: 600; color: #d1d5db; margin: 0 0 12px; }
    details summary::-webkit-details-marker { display: none; }
    details[open] summary span:first-child { transform: rotate(90deg); display: inline-block; }
    table { border-collapse: collapse; }
    tr:hover td { filter: brightness(1.15); }
    .legend-dot { display: inline-block; width: 12px; height: 12px; border-radius: 2px; margin-right: 6px; vertical-align: middle; }
    @media (max-width: 700px) { body { padding: 16px; } }
  </style>
</head>
<body>

  <!-- Header -->
  <div style="margin-bottom: 32px">
    <h1>Conflict Resolution — Test Report</h1>
    <p style="color:#6b7280;font-size:14px">Gegenereerd op ${now} &nbsp;·&nbsp; <span style="color:${passed === total ? '#22c55e' : '#ef4444'}">${passed}/${total} tests geslaagd</span></p>
  </div>

  <!-- Variant cards -->
  <h2>Varianten</h2>
  <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:40px">
    ${variantCards}
  </div>

  <!-- Matrix heatmap -->
  <h2>Scenario Matrix</h2>
  <p style="color:#6b7280;font-size:13px;margin-bottom:12px">Hover over een cel voor details. Rij = scenario, kolom = variant.</p>
  <div style="overflow-x:auto;margin-bottom:12px">
    <table style="border-collapse:separate;border-spacing:2px">
      <thead>
        <tr>
          <th style="padding:8px 12px;text-align:left;color:#6b7280;font-size:13px;background:#1f2937;border-radius:6px">Scenario</th>
          ${VARIANTS.map(v => `<th style="padding:8px 12px;text-align:center;color:#a78bfa;font-size:13px;background:#1f2937;border-radius:6px;min-width:90px">${v}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${matrixRows}
      </tbody>
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
  <p style="color:#6b7280;font-size:13px;margin-bottom:20px">Klik op een scenariogroep om de details te tonen.</p>
  ${detailSections}

  <!-- Raw output -->
  <details style="margin-top:32px">
    <summary style="cursor:pointer;padding:12px 16px;background:#1f2937;border-radius:8px;color:#6b7280;font-size:14px;list-style:none;display:flex;align-items:center;gap:8px">
      <span style="color:#4b5563">▶</span> Ruwe test output
    </summary>
    <pre style="background:#0f172a;color:#94a3b8;font-size:11px;padding:16px;border-radius:8px;overflow-x:auto;margin-top:8px;line-height:1.6;white-space:pre-wrap">${clean.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
  </details>

  <p style="margin-top:32px;color:#374151;font-size:12px;text-align:center">Bachelorproef — Scene-aware Collaborative 3D Editor</p>
</body>
</html>`;

// ---------------------------------------------------------------------------
// 5. Write output
// ---------------------------------------------------------------------------

const outPath = path.resolve(__dirname, '..', 'test-report.html');
fs.writeFileSync(outPath, html, 'utf8');
console.log(`\nReport written to: ${outPath}`);
console.log(`Open in browser:   start "" "${outPath}"`);
