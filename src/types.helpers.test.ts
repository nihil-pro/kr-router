import { test } from 'node:test';
import type { RouteState } from './types.helpers.js';

// Extract pathname groups from a matched RouteState
type PathGroups<P extends string> =
  Extract<
    RouteState<{ path: P; loader: () => Promise<{ default: unknown }> }>,
    { matches: true }
  >['result']['pathname']['groups'];

// Extract search groups from a matched RouteState
type SearchGroups<P extends string, Q extends Record<string, string | undefined> = Record<never, never>> =
  Extract<
    RouteState<{ path: P; query: Q; loader: () => Promise<{ default: unknown }> }>,
    { matches: true }
  >['result']['search']['groups'];

// ─── pathname params ──────────────────────────────────────────────────────────

test('simple param', () => {
  type G = PathGroups<'/users/:id'>;
  ({} as G) satisfies { id: string };
  ({} as { id: string }) satisfies G;
});

test('multiple params', () => {
  type G = PathGroups<'/users/:userId/posts/:postId'>;
  ({} as G) satisfies { userId: string; postId: string };
  ({} as { userId: string; postId: string }) satisfies G;
});

test('optional param', () => {
  type G = PathGroups<'/posts/:slug?'>;
  ({} as G) satisfies { slug?: string };
  ({} as { slug?: string }) satisfies G;
});

test('zero-or-more param', () => {
  type G = PathGroups<'/files/:segments*'>;
  ({} as G) satisfies { segments: string[] };
  ({} as { segments: string[] }) satisfies G;
});

test('one-or-more param', () => {
  type G = PathGroups<'/files/:segments+'>;
  ({} as G) satisfies { segments: string[] };
  ({} as { segments: string[] }) satisfies G;
});

test('regex-constrained param', () => {
  type G = PathGroups<'/items/:id(\\d+)'>;
  ({} as G) satisfies { id: string };
  ({} as { id: string }) satisfies G;
});

test('regex-constrained optional param', () => {
  type G = PathGroups<'/items/:id(\\d+)?'>;
  ({} as G) satisfies { id?: string };
  ({} as { id?: string }) satisfies G;
});

test('no params yields empty groups', () => {
  type G = PathGroups<'/about'>;
  ({} as G) satisfies {};
  ({} as {}) satisfies G;
});

// ─── query params ─────────────────────────────────────────────────────────────

test('optional query params', () => {
  type G = SearchGroups<'/search', { q?: string; page?: string }>;
  ({} as G) satisfies { q?: string; page?: string };
  ({} as { q?: string; page?: string }) satisfies G;
});

test('required query param', () => {
  type G = SearchGroups<'/results', { sort: string }>;
  ({} as G) satisfies { sort: string };
  ({} as { sort: string }) satisfies G;
});

test('no query yields empty search groups', () => {
  type G = SearchGroups<'/about'>;
  ({} as G) satisfies Record<never, never>;
  ({} as Record<never, never>) satisfies G;
});

// ─── RouteState discriminant ──────────────────────────────────────────────────

test('matches: false has null result', () => {
  type State = RouteState<{ path: '/foo'; loader: () => Promise<{ default: unknown }> }>;
  type UnmatchedResult = Extract<State, { matches: false }>['result'];
  const _: UnmatchedResult = null;
});
