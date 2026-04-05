# kr-router
## Adds routing simplicity to your SPAs 😎

[![npm](https://img.shields.io/npm/v/kr-router)](https://www.npmjs.com/package/kr-router)
[![size-esm](https://github.com/nihil-pro/kr-router/blob/main/assets/esm.svg)](https://bundlephobia.com/package/kr-router)
[![size-cjs](https://github.com/nihil-pro/kr-router/blob/main/assets/cjs.svg)](https://bundlephobia.com/package/kr-router)

1. Framework-agnostic;
2. No `<Link />` component needed, just use regular `<a href="/">` tags;
3. Routes are matched against `location.href` using [URLPattern](https://developer.mozilla.org/en-US/docs/Web/API/URLPattern);
4. The router extends a fully typed `EventTarget`, you can subscribe to route changes by route name;
5. Multiple instances can exist independently on the same page, useful for microservices.

## Built in bindings
- React <sup>0.4 KB</sup>
- Preact <sup>0.4 KB</sup> <br/>
<small>Adapters are available as subpackage exports: `'kr-router/react'`, `'kr-router/preact'`</small>

## Installation

```bash
npm install kr-router
```

## Basic usage

Create a AppRouter instance
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
  } as const,
} as const);

```
And pass it to the appropriate adapter:
```tsx
import { ReactRouter } from 'kr-router/react';

function App() {
  return (
    // automatically renders the component returned by the loader() of the matched route
    <ReactRouter
      router={router}
      NotFoundComponent={NotFoundPage}
      ErrorComponent={({ error }) => <p>{error.message}</p>}
    />
  );
}
```

### Navigate using `<a href={path} >` tag
```tsx
function UserListItem({ user }) {
  return (
    <a href={`/users/${user.id}`}>
      View {user.name}
    </a>
  );
}
```

### Navigate programmatically

```ts
router.navigate('/users/42');

// Replace current history entry
router.navigate('/users/42?tab=settings', { replace: true });

// Navigate through history
router.navigate(-1); // back
router.navigate(1);  // forward
```

### Listening to route changes anywhere you want
```ts
router.addEventListener('user', (event) => {
  if (event.state.matches) {
    // result is typed!
    event.state.result.pathname.groups.id; // string
  }
});

router.addEventListener('notfound', () => {
  console.log(router.notFound); // boolean
});

// Clean up when done
router.removeEventListener('user', handler);
```


## Route path syntax

Path patterns follow the [`URLPattern` syntax](https://developer.mozilla.org/en-US/docs/Web/API/URLPattern/URLPattern):

| Pattern | Matches | Groups |
|---|---|---|
| `/users/:id` | `/users/42` | `{ id: "42" }` |
| `/files/:name+` | `/files/a/b/c` | `{ name: ["a", "b", "c"] }` |
| `/search/:query?` | `/search` or `/search/foo` | `{ query: undefined \| string }` |

### Built-in `RegExp` validation

With built-in validation, invalid URLs never reach your component — the regexp acts as an allowlist, rejecting malformed input at the router level.

```tsx
// Without validation — you validate everywhere 😩
function UserPage() {
  const { id } = useParams();
  
  if (!/^[0-9]+$/.test(id)) return <NotFound />;
  // ... rest of component
}
```

```ts
// With kr-router — validate once, forget it 😎
const router = new AppRouter({
  routes: {
    user: {
      path: '/users/:id([0-9]+)',  // only numeric IDs reach your component
      loader: () => import('./UserPage'),
    },
  },
})
```  

### Examples:

| Pattern | Matches | No matches | Captured groups |
|---------|---------|------------|-----------------|
| `/users/:id([0-9]+)` | `/users/42` | `/users/john` | `{ id: "42" }` |
| `/users/:id([0-9]+)/:tab?` | `/users/42/settings`, `/users/42` | `/users/john/settings` | `{ id: "42", tab: "settings" \| undefined }` |
| `/posts/:slug([a-z-]+)` | `/posts/hello-world`, `/posts/my-post` | `/posts/Hello123` | `{ slug: "hello-world" }` |
| `/files/:path(.+\.(jpg\|png\|pdf)$)` | `/files/photo.jpg`, `/files/doc.pdf` | `/files/photo.gif` | `{ path: "photo.jpg" }` |
| `/api/:version(v\d+)/:resource` | `/api/v1/users`, `/api/v2/posts` | `/api/v1.5/users` | `{ version: "v1", resource: "users" }` |
| `/products/:code([A-Z]{2}-\d{4})` | `/products/AB-1234`, `/products/XY-5678` | `/products/abc-123` | `{ code: "AB-1234" }` |
| `/date/:year(\d{4})/:month(\d{2})` | `/date/2024/03` | `/date/24/3` | `{ year: "2024", month: "03" }` |
| `/docs/:section*/:page` | `/docs/api/router/overview` | N/A (matches any depth) | `{ section: ["api", "router"], page: "overview" }` |



## Link interception

By default, the router intercepts clicks on `<a>` elements if:
- href has the same origin
- no `download` attribute
- no `target` attribute
- no modifier keys (`Ctrl`, `Shift`, `Alt`, `Cmd`) are pressed
- no middle mouse button is pressed

This prevents full page reloads. To disable interception:

```ts
const router = new AppRouter({
  interceptLinks: false,
  // rest of config
});
```

Always use absolute paths in `href`:
```html
<a href="/about">About</a>
<a href="/users/42?tab=settings">User</a>
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


> **Requirements:** `URLPattern` is supported in all modern browsers (Chrome 95+, Edge 95+, Firefox 142+, Safari 26+, Opera 81+) and Node.js. For older environments, use a polyfill like [urlpattern-polyfill](https://github.com/nicowillis/urlpattern-polyfill).

## Advanced usage

### Reactive routes
You can make routes reactive with reactive systems that support direct assignment:
```ts
import { AppRouter } from 'kr-router';
import { makeObservable } from 'kr-observable'

const router = new AppRouter({
  routes: makeObservable({
    userSettings: {
      path: '/users/:id/settings',
      query: {} as { tab?: string },
      loader: () => import('./pages/User'),
    },
  }),
});
```
The `kr-router` mutates the routes object directly. Your reactive system detects these mutations, so your components can react automatically to route changes:
```tsx
import { observer } from 'kr-observable/react'


const MenuItem = observer(function() {
  const isActive = router.routes.userSettings.matches ? 'active' : '';
  
  return <li className={isActive}>User Settings</li>
})
```
One of reactive system that support direct assignment is [kr-observable](https://observable.ru),
another one is mobx when configured with enforceActions: 'never' (allows state to be changed from anywhere).

### Multiple instances
With `kr-router` you can have multiple instances of `AppRouter`. They work independently with the same history (`window.history`).

This can be useful for apps with microservices. For example, when a host app only renders a template with header and sidebar, and the content comes from a federated app:
```ts
// host AppRouter 
import { AppRouter } from 'kr-router';

const router = new AppRouter({
  routes: {
    orders: {
      path: '/orders{/}*?',
      loader: () => import('https://host.com/orders-federated-app.js'),
    },
    dashboards: {
      path: '/dashboards{/}*?',
      loader: () => import('https://host.com/dashboards-federated-app.js'),
    },
  },
});
```

```ts
// federated orders AppRouter — handles nested routing under /orders
import { AppRouter } from 'kr-router';

const router = new AppRouter({
  routes: {
    home: {
      path: '/orders{/}?',
      loader: () => import('./OrdersPage'),
    },
    order: {
      path: '/orders/:orderId([0-9]+)',
      loader: () => import('./OrderDescription'),
    },
  },
});
```

The host router matches the top-level path '/orders{/}*?', while the federated router matches '/orders{/}?' and '/orders/:orderId([0-9]+)'.