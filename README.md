# kr-router

A lightweight, framework-agnostic client-side router for SPAs, built on the native [`URLPattern`](https://developer.mozilla.org/en-US/docs/Web/API/URLPattern) API and the History API.

> **Requirements:** `URLPattern` must be available in the runtime environment. It is supported in Chrome 95+, Edge 95+ and Opera 81+, or you can use a polyfill (e.g. [`urlpattern-polyfill`](https://github.com/nicowillis/urlpattern-polyfill)).

## Installation

```bash
npm install kr-router
```

## Core concepts

- Routes are matched against `location.href` using `URLPattern`
- The router extends `EventTarget` — subscribe to route changes by route name
- Link clicks are intercepted automatically (configurable)
- React and Preact adapters are available as subpackage exports

---

## Basic usage

```ts
import { AppRouter } from 'kr-router';

const router = new AppRouter({
  routes: {
    home: {
      path: '/',
      loader: () => import('./pages/Home'),
    },
    about: {
      path: '/about',
      loader: () => import('./pages/About'),
    },
    user: {
      path: '/users/:id',
      query: {} as { tab?: string },
      loader: () => import('./pages/User'),
    },
  },
});
```

### Listening to route changes

```ts
router.addEventListener('user', (event) => {
  if (event.state.matches) {
    const { id } = event.state.result.pathname.groups; // string
    const { tab } = event.state.result.search.groups;  // string | undefined
  }
});

router.addEventListener('notfound', () => {
  console.log('No route matched the current URL');
});
```

### Programmatic navigation

```ts
// Navigate to an absolute path
router.navigate('/users/42');
router.navigate('/users/42?tab=settings');

// Replace current history entry
router.navigate('/users/42', { replace: true });

// History traversal
router.navigate(-1); // back
router.navigate(1);  // forward
```

### Cleanup

```ts
router.destroy(); // removes all event listeners from window
```

---

## React adapter

```tsx
import { AppRouter } from 'kr-router';
import { ReactRouter } from 'kr-router/react';

const router = new AppRouter({ routes: { ... } });

function App() {
  return (
    <ReactRouter
      router={router}
      NotFoundComponent={NotFoundPage}
      ErrorComponent={({ error }) => <p>{error.message}</p>}
    />
  );
}
```

---

## Preact adapter

```tsx
import { AppRouter } from 'kr-router';
import { PreactRouter } from 'kr-router/preact';

const router = new AppRouter({ routes: { ... } });

function App() {
  return (
    <PreactRouter
      router={router}
      NotFoundComponent={NotFoundPage}
      ErrorComponent={({ error }) => <p>{error.message}</p>}
    />
  );
}
```

---

## Route path syntax

Path patterns follow the [`URLPattern` syntax](https://developer.mozilla.org/en-US/docs/Web/API/URLPattern/URLPattern):

| Pattern | Matches | Groups |
|---|---|---|
| `/users/:id` | `/users/42` | `{ id: "42" }` |
| `/files/:name+` | `/files/a/b/c` | `{ name: ["a", "b", "c"] }` |
| `/search/:query?` | `/search` or `/search/foo` | `{ query: undefined \| string }` |

---

## Link interception

By default the router intercepts clicks on `<a>` elements within the same origin, preventing full page reloads. Always use absolute paths in `href`:

```html
<a href="/about">About</a>
<a href="/users/42?tab=settings">User</a>
```

To disable interception:

```ts
const router = new AppRouter({
  interceptLinks: false,
  routes: { ... },
});
```

## Query params typing

Use the `query` field as a type-only annotation for expected search params. It is not used at runtime:

```ts
user: {
  path: '/users/:id',
  query: {} as { tab?: string; sort?: string },
  loader: () => import('./pages/User'),
}
```

After the route matches, `event.state.result.search.groups` will be typed as `{ tab?: string; sort?: string }`.
