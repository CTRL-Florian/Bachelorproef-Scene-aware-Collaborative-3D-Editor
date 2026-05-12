#!/usr/bin/env node
/**
 * screenshot-matrix.cjs
 *
 * Renders the poster HTML and saves Figure 2 (the result matrix) as a PNG.
 * Usage: node scripts/screenshot-matrix.cjs
 */
'use strict';

const { chromium } = require('@playwright/test');
const path = require('path');

(async () => {
  const posterPath = path.resolve(__dirname, '..', 'poster (1).html');
  const outPath    = path.resolve(__dirname, '..', 'assets', 'figure2-matrix.png');

  const browser = await chromium.launch();
  const page    = await browser.newPage();

  // Load the poster at full canvas width so layout is correct
  await page.setViewportSize({ width: 1240, height: 1754 });
  await page.goto(`file:///${posterPath.replace(/\\/g, '/')}`);

  // Wait for the table to be rendered
  await page.waitForSelector('table.matrix');

  // Override background to white for the row-header cells
  await page.addStyleTag({ content: '.matrix tbody th { background: #ffffff !important; }' });

  // Screenshot just the matrix table
  const table = page.locator('table.matrix');
  await table.screenshot({ path: outPath, animations: 'disabled' });
  console.log(`Saved: ${outPath}`);

  // Screenshot the delta diagram (Figure 3)
  const outPath3 = path.resolve(__dirname, '..', 'assets', 'figure3-delta.png');
  const deltaRows = page.locator('.delta-row').first().locator('xpath=ancestor::div[1]');
  await deltaRows.screenshot({ path: outPath3, animations: 'disabled' });
  console.log(`Saved: ${outPath3}`);
  await browser.close();
})();
