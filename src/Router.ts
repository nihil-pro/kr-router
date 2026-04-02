import type { RoutePatternResult, RouterConfig, RouterRoutes } from './types.helpers.js';

export class RouteStateChangeEvent<T> extends CustomEvent<T> {
  state: T;
  constructor(type: string, detail: T) {
    super(type, { detail });
    this.state = detail;
  }
}

export class NotFoundStateChangeEvent extends CustomEvent<boolean> {
  state: boolean
  constructor(detail: boolean) {
    super('notfound', { detail });
    this.state = detail;
  }
}

/**
 * Client-side router built on {@link URLPattern} and the History API.
 *
 * Extends {@link EventTarget} — listen for route changes by route name,
 * or for the special `'notfound'` event when no route matches.
 *
 * @example
 * ```ts
 * const router = new AppRouter({
 *   routes: {
 *     home: {
 *       path: '/',
 *       loader: () => import('./pages/Home'),
 *     },
 *     user: {
 *       path: '/users/:id',
 *       query: {} as { tab?: string },
 *       loader: () => import('./pages/User'),
 *     },
 *   },
 * });
 *
 * router.addEventListener('user', (event) => {
 *   if (event.state.matches) {
 *     const { id } = event.state.result.pathname.groups; // string
 *     const { tab } = event.state.result.search.groups;  // string | undefined
 *   }
 * });
 *
 * router.addEventListener('notfound', () => {
 *   console.log('No route matched');
 * });
 *
 * // Navigate programmatically
 * router.navigate('/users/42?tab=settings');
 * router.navigate(-1); // go back
 * ```
 */
export class AppRouter<T extends RouterConfig> extends EventTarget {
  declare readonly routes: RouterRoutes<T>;
  readonly #routes: RouterRoutes<T>[keyof RouterRoutes<T>][];
  notFound = false;

  constructor(config: T) {
    super();

    if (config.interceptLinks !== false) {
      window.addEventListener('click', this.#onClickLink);
    }

    window.addEventListener('popstate', this.#onLocationChanged);

    Object.entries(config.routes)
      .forEach(([name, value]) => {
        const pattern = new URLPattern({ pathname: value.path });
        Object.assign(value, {
          matches: false,
          result: null,
          error: null,
          component: null,
          pattern,
          name
        })
      })

    this.#routes = Object.values(config.routes) as RouterRoutes<T>[keyof RouterRoutes<T>][];
    Object.defineProperty(this, 'routes', { get: () => config.routes });
    void this.#onLocationChanged()
  }


  destroy() {
    window.removeEventListener('click', this.#onClickLink);
    window.removeEventListener('popstate', this.#onLocationChanged);
  }


  #onLocationChanged = async () => {
    let notFound = true;

    for (const config of this.#routes) {
      const previous = config.result;
      config.result = config.pattern.exec(location.href) as RoutePatternResult<any, any>;
      const current = config.result;

      // both are null (not matched), do nothing
      if (previous == current) continue;

      let shouldReport = false;
      let matches = false;
      notFound = false;

      if (current && previous) {
        matches = true;

        if (!config.pattern.pathname.endsWith('*?')) {
          // currently, we check only path segments and ignore query params or hash
          for (const segment in current.pathname.groups) {
            if (current.pathname.groups[segment] !== previous.pathname.groups[segment]) {
              shouldReport = true;
              break;
            }
          }
        }
      } else {
        shouldReport = true;
        matches = Boolean(current);
      }

      if (shouldReport) {
        if (matches && !config.component) {
          try {
            const module = await config.loader()
            config.component = module.default;
          } catch (error) {
            config.error = error as Error;
          }
        }
        config.matches = matches;
        this.dispatchEvent(new RouteStateChangeEvent(config.name as string, config));
      }
    }

    if (this.notFound !== notFound) {
      this.dispatchEvent(new NotFoundStateChangeEvent(notFound));
      this.notFound = notFound;
    }
  }


  /**
   * Navigate to an absolute path.
   * @param path - Absolute pathname (e.g. `/about`, `/users/123?tab=info`).
   * @param options {Object}
   * @param options.replace - Replace the current history entry instead of pushing a new one.
   * @param options.state - State object to associate with the new history entry.
   */
  navigate(path: `/${string}`, options?: { replace?: boolean, state?: any }): void;

  /** Traverse the session history by a given delta (e.g. `-1` for back, `1` for forward). */
  navigate(delta: number): void;

  navigate(path: `/${string}` | number, options?: { replace?: boolean, state?: any }) {
    if (typeof path === 'number') {
      return history.go(path);
    }

    if (location.pathname + location.search + location.hash !== path) {
      if (options?.replace) {
        history.replaceState(options.state, '', path);
      } else {
        history.pushState(options?.state, '', path);
      }
    }
    void this.#onLocationChanged()
  }

  #onClickLink = (event: PointerEvent | MouseEvent) => {

    if (event.ctrlKey || event.metaKey || event.button === 1) {
      return;
    }

    if (!event.target || !(event.target instanceof Element)) {
      return;
    }
    const path = event.composedPath();
    const anchor = path.find(el => el instanceof HTMLAnchorElement) as HTMLAnchorElement | undefined;

    if (!anchor) return;

    if (anchor.origin !== location.origin) return;
    if (anchor.target || anchor.download) return;
    event.preventDefault();
    this.navigate((anchor.pathname + anchor.search + anchor.hash) as `/${string}`)
  }

  /**
   * Listen for the `notfound` event, fired when no route matches the current URL.
   * @param type - `'notfound'`
   * @param listener - Receives a {@link NotFoundStateChangeEvent}.
   * @param options - Standard {@link AddEventListenerOptions} or a boolean `capture` flag.
   */
  addEventListener(
    type: 'notfound',
    listener: (event: NotFoundStateChangeEvent) => void,
    options?: boolean | AddEventListenerOptions
  ): void;

  /**
   * Listen for a route state change event by route name.
   * Fired whenever a route starts or stops matching, or its path params change.
   * @param type - A route name as defined in the router config.
   * @param listener - Receives a {@link RouteStateChangeEvent} typed to the matching route's config.
   * @param options - Standard {@link AddEventListenerOptions} or a boolean `capture` flag.
   */
  addEventListener<K extends keyof T['routes']>(
    type: K,
    listener: (event: RouteStateChangeEvent<RouterRoutes<T>[K]>) => void,
    options?: boolean | AddEventListenerOptions
  ): void;

  /** @ignore */
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions
  ): void;

  addEventListener(
    type: string | keyof T['routes'] | 'notfound',
    listener: EventListenerOrEventListenerObject | ((event: NotFoundStateChangeEvent) => void) | ((event: RouteStateChangeEvent<RouterRoutes<T>[keyof T['routes']]>) => void),
    options?: boolean | AddEventListenerOptions
  ): void {
    super.addEventListener(type as string, listener as EventListenerOrEventListenerObject, options);
  }

  /**
   * Remove a `notfound` event listener.
   * @param type - `'notfound'`
   * @param listener - The same listener reference passed to {@link addEventListener}.
   * @param options - Standard {@link EventListenerOptions} or a boolean `capture` flag.
   */
  removeEventListener(
    type: 'notfound',
    listener: (event: NotFoundStateChangeEvent) => void,
    options?: boolean | EventListenerOptions
  ): void;

  /**
   * Remove a route state change event listener by route name.
   * @param type - A route name as defined in the router config.
   * @param listener - The same listener reference passed to {@link addEventListener}.
   * @param options - Standard {@link EventListenerOptions} or a boolean `capture` flag.
   */
  removeEventListener<K extends keyof T['routes']>(
    type: K,
    listener: (event: RouteStateChangeEvent<RouterRoutes<T>[K]>) => void,
    options?: boolean | EventListenerOptions
  ): void;

  /** @ignore */
  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions
  ): void;

  removeEventListener(
    type: string | keyof T['routes'] | 'notfound',
    listener: EventListenerOrEventListenerObject | ((event: NotFoundStateChangeEvent) => void) | ((event: RouteStateChangeEvent<RouterRoutes<T>[keyof T['routes']]>) => void),
    options?: boolean | EventListenerOptions
  ): void {
    super.removeEventListener(type as string, listener as EventListenerOrEventListenerObject, options);
  }
}
