#!/usr/bin/env node
/**
 * generate-table-pptx.cjs
 *
 * Generates a PowerPoint file containing Figure 2 — the result matrix —
 * with the original poster colors.
 *
 * Usage: node scripts/generate-table-pptx.cjs
 */
'use strict';

const PptxGenJS = require('pptxgenjs');
const path = require('path');

const pptx = new PptxGenJS();
const slide = pptx.addSlide();

// ── Colors (from poster CSS) ─────────────────────────────────────────────────
const NAVY    = '1F2F5C';
const WHITE   = 'FFFFFF';
const BLACK   = '14181F';
const SOFT    = 'F4F1EA';
const MUTED   = '6a7283';

// Pill colors
const OK_BG   = 'd3eccb'; const OK_FG   = '2e6b1a';
const BAD_BG  = 'f4d4cc'; const BAD_FG  = '9a2d12';
const WARN_BG = 'f6e6c0'; const WARN_FG = '8c5c10';
const LWW_BG  = 'e1ddcf'; const LWW_FG  = '14181F';

// ── Table data ───────────────────────────────────────────────────────────────
// Each cell: { text, bg, fg, bold }

// Data cells: white background, only the text color reflects the pill type
function lww()        { return { text: 'LWW',        bg: 'FFFFFF', fg: LWW_FG,  bold: true }; }
function first()      { return { text: '1st wins',   bg: 'FFFFFF', fg: LWW_FG,  bold: true }; }
function ok(t)        { return { text: t,             bg: 'FFFFFF', fg: OK_FG,   bold: true }; }
function bad(t)       { return { text: t,             bg: 'FFFFFF', fg: BAD_FG,  bold: true }; }
function warn(t)      { return { text: t,             bg: 'FFFFFF', fg: WARN_FG, bold: true }; }
// Scenario column: original soft cream background
function scenario(t, sub) {
  return { text: t, sub, bg: SOFT, fg: BLACK, bold: true };
}

const rows = [
  // Header
  [
    { text: 'Conflict scenario', bg: NAVY, fg: WHITE, bold: true, header: true },
    { text: 'A',                 bg: NAVY, fg: WHITE, bold: true, header: true },
    { text: 'B',                 bg: NAVY, fg: WHITE, bold: true, header: true },
    { text: 'C',                 bg: NAVY, fg: WHITE, bold: true, header: true },
    { text: 'D',                 bg: NAVY, fg: WHITE, bold: true, header: true },
  ],
  [scenario('Same-property edit', 'S1, S12'),       lww(),      lww(),      lww(),          first()    ],
  [scenario('Different property, same object', 'S2, S8'), bad('1 lost'), ok('both'),  ok('both'),     ok('both') ],
  [scenario('Four disjoint properties', 'S14'),     bad('2 lost'), ok('all 4'), ok('all 4'),   ok('all 4') ],
  [scenario('Repeated movement deltas', 'S4, S15'), bad('1 lost'), bad('1 lost'), ok('accumulate'), bad('1 lost')],
  [scenario('Edit on deleted object', 'S3, S9'),    warn('no-op'), warn('no-op'), warn('no-op'), warn('no-op')],
  [scenario('Concurrent reparent', 'S5, S10'),      lww(),      lww(),      lww(),          lww()      ],
];

// ── Build pptxgenjs rows ─────────────────────────────────────────────────────

const COL_WIDTHS = [3.8, 1.0, 1.0, 1.2, 1.0]; // inches

const tableRows = rows.map((row, rowIdx) => {
  return row.map((cell, colIdx) => {
    const isScenarioCol = colIdx === 0 && rowIdx > 0;
    const fontSize = rowIdx === 0 ? 11 : 10;

    // Scenario column: main text + muted sub-label
    if (isScenarioCol) {
      return {
        text: [
          { text: cell.text + ' ', options: { bold: true, color: BLACK, fontSize } },
          { text: cell.sub ?? '', options: { bold: false, color: MUTED, fontSize: fontSize - 1 } },
        ],
        options: {
          fill: { color: cell.bg },
          border: { pt: 0.5, color: 'cdc6b6' },
          valign: 'middle',
          align: 'left',
        },
      };
    }

    // Pill cell
    return {
      text: cell.text,
      options: {
        bold: cell.bold ?? false,
        color: cell.fg,
        fontSize,
        fill: { color: cell.bg },
        border: { pt: 0.5, color: 'cdc6b6' },
        valign: 'middle',
        align: 'center',
      },
    };
  });
});

slide.addTable(tableRows, {
  x: 0.3,
  y: 0.3,
  w: COL_WIDTHS.reduce((a, b) => a + b, 0),
  colW: COL_WIDTHS,
  rowH: [0.35, 0.32, 0.32, 0.32, 0.32, 0.32, 0.32],
  border: { pt: 1, color: '14181F' },
  fontFace: 'Verdana',
});

// Caption
slide.addText(
  [
    { text: 'Figure 2. ', options: { bold: true } },
    { text: 'Outcome of each strategy per conflict family across 15 scenarios. All variants converge in every case.', options: { bold: false } },
  ],
  {
    x: 0.3, y: 2.72, w: COL_WIDTHS.reduce((a, b) => a + b, 0),
    fontSize: 9, color: '3a4150', fontFace: 'Verdana', align: 'left',
  }
);

const outPath = path.resolve(__dirname, '..', 'assets', 'figure2-matrix.pptx');
pptx.writeFile({ fileName: outPath }).then(() => {
  console.log(`Saved: ${outPath}`);
});
