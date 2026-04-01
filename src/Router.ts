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

export class AppRouter<T extends RouterConfig> extends EventTarget {
  declare readonly routes: RouterRoutes<T>;
  notFound = false;

  constructor(config: T) {
    super();

    if (config.interceptLinks !== false) {
      window.addEventListener('click', this.#onClickLink);
    }

    window.addEventListener('popstate', this.#onLocationChanged);

    Object.values(config.routes)
      .forEach(value => {
        const pattern = new URLPattern({ pathname: value.path });
        Object.assign(value, {
          matches: false,
          result: null,
          error: null,
          component: null,
          pattern
        })
      })

    Object.defineProperty(this, 'routes', { get: () => config.routes });
    void this.#onLocationChanged()
  }

  // async init() {
  //   return this.#onLocationChanged();
  // }

  destroy() {
    window.removeEventListener('click', this.#onClickLink);
    window.removeEventListener('popstate', this.#onLocationChanged);
  }


  #onLocationChanged = async () => {

    const entries = Object.entries(this.routes) as [string, RouterRoutes<T>[keyof RouterRoutes<T>]][]

    let notFound = true;

    for (const [route, config] of entries) {

      const previous = config.result;
      config.result = config.pattern.exec(location.href) as RoutePatternResult<any>;
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
            // @ts-ignore
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
        this.dispatchEvent(new RouteStateChangeEvent(route, config));
      }
    }

    this.dispatchEvent(new NotFoundStateChangeEvent(notFound));
    this.notFound = notFound;
  }

  navigate(path: string, options?: { replace?: boolean, state?: any }) {
    if (location.pathname !== path) {
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
    const url = new URL(anchor.href, location.href);
    this.navigate(url.pathname + url.search + url.hash)
  }

  addEventListener(
    type: 'notfound',
    listener: (event: NotFoundStateChangeEvent) => void,
    options?: boolean | AddEventListenerOptions
  ): void;

  addEventListener<K extends keyof T['routes']>(
    type: K,
    listener: (event: RouteStateChangeEvent<RouterRoutes<T>[K]>) => void,
    options?: boolean | AddEventListenerOptions
  ): void;

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

  removeEventListener(
    type: 'notfound',
    listener: (event: NotFoundStateChangeEvent) => void,
    options?: boolean | EventListenerOptions
  ): void;

  removeEventListener<K extends keyof T['routes']>(
    type: K,
    listener: (event: RouteStateChangeEvent<RouterRoutes<T>[K]>) => void,
    options?: boolean | EventListenerOptions
  ): void;

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