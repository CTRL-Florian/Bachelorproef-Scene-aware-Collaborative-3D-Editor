import * as Y from 'yjs';
import type { CollaborationStrategy, TestEnv, VariantKey } from './types';
import { createYjsTestEnv } from './types';
import { VariantA } from './variants/variant-a';
import { VariantB } from './variants/variant-b';
import { VariantC } from './variants/variant-c';
import { createOTTestEnv } from './variants/variant-d';

/**
 * Create a CollaborationStrategy backed by a Y.Doc (Variants A, B, C).
 * Used both by the production store (which provides a WS-connected doc)
 * and by unit tests (which provide an isolated in-memory doc).
 */
export function createYjsStrategy(variant: VariantKey, ydoc: Y.Doc): CollaborationStrategy {
  switch (variant) {
    case 'B': return new VariantB(ydoc);
    case 'C': return new VariantC(ydoc);
    default:  return new VariantA(ydoc);
  }
}

/**
 * Determine the active variant from the environment.
 * In Vite (browser): reads VITE_COLLAB_VARIANT.
 * In Node (Vitest / server): reads COLLAB_VARIANT.
 */
export function activeVariant(): VariantKey {
  const fromVite =
    typeof import.meta !== 'undefined'
      ? (import.meta as { env?: Record<string, string> }).env?.VITE_COLLAB_VARIANT
      : undefined;
  const fromNode =
    typeof process !== 'undefined' ? process.env.COLLAB_VARIANT : undefined;
  const v = (fromVite ?? fromNode ?? 'A').toUpperCase() as VariantKey;
  return ['A', 'B', 'C', 'D'].includes(v) ? v : 'A';
}

/**
 * Create an isolated two-peer test environment for the given variant.
 * Used by all variant test files.
 */
export function createTestEnv(variant: VariantKey): TestEnv {
  if (variant === 'D') return createOTTestEnv();
  return createYjsTestEnv(doc => createYjsStrategy(variant, doc));
}
