import { Observable } from 'kr-observable';

type Params = Record<string, string | number>;
const FALLBACK = '/**';
const WILDCARD = '/*'

class RouterRoute {
  base: string
  pattern: string;
  regex: RegExp;
  variables: string[];
  wildcard: boolean;
  fallback: boolean;
  weight: number;
  relative = false;

  constructor(
    pattern: string,
    regex: RegExp,
    variables: string[],
    base: string,
    weight: number
  ) {
    this.pattern = pattern;
    this.regex = regex;
    this.variables = variables;
    this.wildcard = pattern.endsWith(WILDCARD);
    this.fallback = pattern.endsWith(FALLBACK);
    this.weight = variables.length + weight;
    this.base = base;
    if (variables.length == 0) this.weight += 1;
    if (this.wildcard) this.base = pattern.replace(WILDCARD, '');
    if (this.fallback) this.base = pattern.replace(FALLBACK, '');
    if (!this.wildcard || this.fallback) this.weight += 1;
  }
}

class MatchResult {
  readonly route: RouterRoute;

  /** Path variables */
  variables: Params;

  constructor(route: RouterRoute, vars: Params) {
    this.route = route;
    this.variables = vars;
  }

  get hash() {
    return location.hash
  }

  get searchParams() {
    return new URL(location.href).searchParams
  }
}

class Storage extends Observable {
  readonly routes: Record<string, MatchResult | null> = Object.create(null);

  update(changes: Map<RouterRoute, MatchResult | null>) {
    changes.forEach((result, route) => {
      this.routes[route.pattern] = result;
    })
  }
}

export class Router {
  static #cache: Map<string, MatchResult> = new Map;
  #patterns: Map<string, RouterRoute> = new Map;
  #fallbacks: Map<string, RouterRoute> = new Map;
  #pending = false;
  #isUpdating = false;
  #winner: MatchResult | null = null;
  #wildcards: MatchResult[] = [];
  #currentWildcard: string | undefined;
  #storage = new Storage();

  #calleeToPatternMap = new WeakMap<any, string>();

  #registry: Record<string, MatchResult | null> = Object.create(null);
  #changes: Map<RouterRoute, MatchResult | null> = new Map();
  #calleeToWildcardCache = new WeakMap<any, string>();

  constructor() {
    const instance = Reflect.get(window, GlobalKey);
    if (instance) return instance;
    this.match = this.match.bind(this);
    this.navigate = this.navigate.bind(this);
  }

  get routes() {
    return JSON.parse(JSON.stringify(this.#storage.routes))
  }

  #resolvePattern(path: string, wildCard: string | undefined): string {
    path = path.trim();
    // Case 1: Already absolute (starts with /)
    if (path.startsWith('/')) return this.#normalizePath(path);

    // Case 2: No current parent → treat as absolute
    if (!wildCard) return this.#normalizePath('/' + path);

    let base = wildCard;
    if (wildCard.endsWith(FALLBACK)) base = wildCard.replace(FALLBACK, '');
    if (wildCard.endsWith(WILDCARD)) base = wildCard.replace(WILDCARD, '');

    const basePath = this.#normalizePath(base); // e.g., /foo
    return this.#normalizePath(basePath + '/' + path);
  }

  // Utility: normalize path (collapse //, resolve . and .. manually)
  #normalizePath(path: string): string {
    const parts = path.split('/').filter(part => part !== '' && part !== '.');
    const result: string[] = [];

    for (const part of parts) {
      if (part === '..') {
        result.pop();
      } else {
        result.push(part);
      }
    }

    return '/' + result.join('/');
  }

  // Add a pattern with optional handler
  #registerPatternRoute(pattern: string, relative: boolean) {
    if (!this.#patterns.has(pattern)) {
      const route = Router.#compileRoute(pattern);
      if (relative) {
        this.#registry[pattern] = null;
        route.relative = true;
      }
      if (route.fallback) this.#fallbacks.set(route.pattern, route);
      this.#patterns.set(pattern, route);
      if (route.wildcard || route.fallback) {
        Router.#cache.set(route.pattern, new MatchResult(route, {}))
      }
      return true;
    }
    return false;
  }

  // Match URL against all registered patterns
  match(path: string, component: Function): MatchResult | null {
    const cachedPattern = this.#calleeToPatternMap.get(component);
    if (cachedPattern) {
      const wildcard = this.#calleeToWildcardCache.get(component);
      if (wildcard) this.#currentWildcard = wildcard;
      return this.#storage.routes[cachedPattern];
    }

    let pattern = path;
    let shouldCacheKey = false;
    if (path.startsWith('/')) {
      if (this.#registerPatternRoute(path, false)) {
        shouldCacheKey = true;
      }
      if (path.endsWith(WILDCARD)) {
        this.#currentWildcard = path;
        this.#calleeToWildcardCache.set(component, path);
      }
    } else {
      pattern = this.#resolvePattern(path, this.#currentWildcard);
      if (path.endsWith(WILDCARD)) {
        shouldCacheKey = this.#registerPatternRoute(pattern, true);
      } else {
        this.#wildcards.forEach(result => {
          const bestPattern = this.#resolvePattern(path, result.route.pattern);
          if (this.#registry[bestPattern] === undefined) {
            pattern = bestPattern;
          }
        })
        shouldCacheKey = this.#registerPatternRoute(pattern, true);
      }
    }
    if (shouldCacheKey) {
      this.#calleeToPatternMap.set(component, pattern);
      if (!this.#pending) {
        this.#pending = true;
        queueMicrotask(() => {
          this.#deferMatch();
          this.#pending = false;
        });
      }
    }
    return this.#storage.routes[pattern];
  }

  static #sortBySpecificity(a: MatchResult, b: MatchResult) {
    // return a.route.weight - b.route.weight; ???
    return b.route.weight - a.route.weight;
  }

  #selectWinner(result: MatchResult, i: number) {
    if (i > 0) {
      return this.#changes.set(result.route, null);
    }
    const wildcard = this.#wildcards.at(-1);
    if (wildcard) {
      if (wildcard.route.weight > result.route.weight) {
        this.#winner = null;
        return this.#changes.set(result.route, null);
      }
    }
    this.#changes.set(result.route, result);
    this.#winner = result;
  }

  #updatePrivateRegistry(changes: Map<RouterRoute, MatchResult | null>) {
    changes.forEach((result, route) => {
      if (route.relative) this.#registry[route.pattern] = result;
    })
  }

  #deferMatch() {
    if (this.#isUpdating) return;
    this.#isUpdating = true;
    this.#wildcards = [];

    let results: MatchResult[] = [];
    // const all: MatchResult[] = [];
    // First collect all matches
    this.#patterns.forEach((route, pattern) => {
      const match = Router.#matchPattern(route);
      if (match) {
        if (route.wildcard) {
          this.#wildcards.push(match);
        } else {
          results.push(match);
        }
      } else {
        this.#changes.set(route, null);
        this.#winner = null;
      }
    })

    results
      .sort(Router.#sortBySpecificity)
      .forEach(this.#selectWinner, this);

    this.#wildcards.forEach((result, i) => {
      if (!this.#winner) this.#winner = result;
      this.#changes.set(result.route, result);

      if (i === this.#wildcards.length - 1) {
        const key = result.route.pattern.replace(WILDCARD, FALLBACK)
        const fallback = this.#fallbacks.get(key);

        if (fallback) {
          if (this.#winner) {
            let value: null | MatchResult = null//Router.#cache.get(fallback.pattern) as MatchResult;
            if (!this.#winner.route.wildcard) value = null;
            if (!this.#winner.route.wildcard && result.route.pattern.startsWith(this.#winner.route.pattern)) {
              value = Router.#cache.get(fallback.pattern) as MatchResult;
            }
            this.#changes.set(fallback, value);
          } else {
            this.#changes.set(fallback, null);

          }
        }
      }

    })
    this.#isUpdating = false;
    this.#updatePrivateRegistry(this.#changes);
    this.#storage.update(this.#changes);
    this.#changes.clear();
  }

  // Match against a specific compiled pattern
  static #matchPattern(route: RouterRoute) {
    if (route.fallback) return null;
    const path = location.pathname;

    if (route.wildcard && path.startsWith(route.base)) {
      return Router.#cache.get(route.pattern) as MatchResult;
    }

    const key = `${path}|${route.pattern}`;
    let value = Router.#cache.get(key);

    if (!value) {
      if (route.variables.length === 0 && path === route.pattern) {
        value = new MatchResult(route, {});
        Router.#cache.set(key, value);
      } else {
        const match = path.match(route.regex);
        if (!match) return null;
        const vars = route.variables;
        const params: Params = Object.create(null);
        const matches = match.slice(1); // Skip full match
        for (let i = 0; i < vars.length; i++) params[vars[i]] = matches[i];
        value = new MatchResult(route, params);
        Router.#cache.set(key, value);
      }
    }
    return value;
  }


  update() {
    if (!this.#pending) {
      this.#pending = true;
      queueMicrotask(() => {
        this.#deferMatch();
        this.#pending = false;
      });
    }
  }

  navigate(to: string, options: any = {}) {
    try {
      const url = new URL(to, location.href);
      const targetPath = url.pathname.replace(/\/+/g, '/');

      // Only navigate if path actually changes
      if (targetPath !== location.pathname) {
        history[options.replace ? 'replaceState' : 'pushState'](
          options.state || {},
          '',
          targetPath
        );
        this.update();
      }
    } catch (e) {
      console.error('Invalid navigation:', to, e);
    }
  }

  // Escape regex special characters
  static #escapeRegex(string: string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // Compile pattern into regex and extract variable names
  static #compileRoute(pattern: string) {
    const variables: string[] = [];
    let segmentsCount = 0;
    let regexPattern = '^';

    // Split pattern into segments
    const segments = pattern.split('/').filter(segment => segment.length > 0);
    for (const segment of segments) {
      regexPattern += '\\/';

      if (segment.startsWith('{') && segment.endsWith('}')) {
        // This is a variable segment like {id}
        const varName = segment.slice(1, -1);
        variables.push(varName);
        regexPattern += '([^\\/]+)'; // Match any non-slash characters
      } else if (segment === '**') {
        // Double wildcard - match any remaining path
        // variableNames.push('**');
        ++segmentsCount;
        regexPattern += '(.*)';
      } else if (segment === '*') {
        // Single wildcard - match any single segment
        regexPattern += '([^\\/]*)';
      } else {
        // Literal segment
        regexPattern += Router.#escapeRegex(segment);
        ++segmentsCount;
      }
    }

    regexPattern += '(?:\\/)?$'; // Optional trailing slash

    return new RouterRoute(pattern, new RegExp(regexPattern), variables, segments[0], segmentsCount);
  }
}


function getGlobal(): WindowOrWorkerGlobalScope {
  if (typeof self !== 'undefined') return self;
  if (typeof global !== 'undefined') return global as unknown as WindowOrWorkerGlobalScope;
  return {} as WindowOrWorkerGlobalScope;
}

const GlobalKey = Symbol.for('kr-router');

if (!getGlobal()[GlobalKey]) {
  const router = new Router();

  Reflect.set(window, GlobalKey, router)

  // Save the real methods
  const originalPush = history.pushState;
  const originalReplace = history.replaceState;

  // Wrap them
  history.pushState = function (...args) {
    originalPush.apply(this, args);
    router.update();
  };

  history.replaceState = function (...args) {
    originalReplace.apply(this, args);
    router.update();
  };

  // Also listen to popstate
  window.addEventListener('popstate', router.update);

  window.addEventListener('click', (ev) => {
    if (!ev.target || !(ev.target instanceof HTMLElement)) return;
    const a = ev.target.closest('a');
    if (!a) return;
    if (a.origin !== location.origin) return;
    if (ev.ctrlKey || ev.metaKey || ev.button === 1) return;
    if (a.target || a.download) return;
    if (a.hasAttribute('data-no-spa')) return;
    ev.preventDefault();
    router.navigate(a.href);
  });
}



