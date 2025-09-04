// import { Observable } from 'kr-observable';
//
// type Params = Record<string, string | number>;
//
// class RouterRoute {
//   base: string
//   pattern: string;
//   regex: RegExp;
//   variables: string[];
//   wildcard: boolean;
//   fallback: boolean;
//   weight: number;
//
//   constructor(
//     pattern: string,
//     regex: RegExp,
//     variables: string[],
//     base: string,
//     weight: number
//   ) {
//     this.pattern = pattern;
//     this.regex = regex;
//     this.variables = variables;
//     this.wildcard = pattern.endsWith('/**');
//     this.fallback = pattern.endsWith('/***');
//     this.weight = variables.length + weight;
//     this.base = base;
//   }
// }
//
// class MatchResult {
//   readonly route: RouterRoute;
//
//   /** Path variables */
//   variables: Params;
//
//   constructor(route: RouterRoute, vars: Params) {
//     this.route = route;
//     this.variables = vars;
//   }
//
//   get hash() {
//     return location.hash
//   }
//
//   get searchParams() {
//     return new URL(location.href).searchParams
//   }
// }
//
// class Router extends Observable {
//   static #cache: Map<string, MatchResult> = new Map;
//   #patterns: Map<string, RouterRoute> = new Map;
//   #fallbacks: Map<string, RouterRoute> = new Map;
//   #pending = false;
//   #isUpdating = false;
//   #winner: MatchResult | null = null;
//   #wildcards: MatchResult[] = [];
//
//   private registry: Record<string, MatchResult | null> = Object.create(null);
//
//   // Add a pattern with optional handler
//   #registerPatternRoute(pattern: string) {
//     if (!this.#patterns.has(pattern)) {
//       this.registry[pattern] = null;
//       const route = Router.#compileRoute(pattern);
//       if (route.fallback) this.#fallbacks.set(route.base, route);
//       this.#patterns.set(pattern, route);
//       if (route.wildcard || route.fallback) {
//         Router.#cache.set(route.pattern, new MatchResult(route, {}))
//       }
//       return true;
//     }
//     return false;
//   }
//
//   // Match URL against all registered patterns
//   match(pattern: string): MatchResult | null {
//     if (this.#registerPatternRoute(pattern)) {
//       if (!this.#pending) {
//         this.#pending = true;
//         queueMicrotask(() => {
//           this.#deferMatch();
//           this.#pending = false;
//         });
//       }
//     }
//     return this.registry[pattern];
//   }
//
//   static #sortBySpecificity(a: MatchResult, b: MatchResult) {
//     return a.route.weight - b.route.weight;
//   }
//
//   #selectWinner(result: MatchResult, i: number) {
//     const pattern = result.route.pattern;
//     if (i > 0) return this.registry[pattern] = null;
//     this.registry[pattern] = result;
//     this.#winner = result;
//   }
//
//   #deferMatch() {
//     if (this.#isUpdating) return;
//     this.#isUpdating = true;
//     this.#wildcards = [];
//
//     let results: MatchResult[] = [];
//     // First collect all matches
//     this.#patterns.forEach((route, pattern) => {
//       const match = Router.#matchPattern(route);
//       if (match) {
//         if (route.wildcard) {
//           this.#wildcards.push(match)
//         } else {
//           results.push(match);
//         }
//       } else {
//         this.registry[pattern] = null;
//       }
//     })
//
//     if (results.length === 0) this.#winner = null;
//
//     results
//       .sort(Router.#sortBySpecificity)
//       .forEach(this.#selectWinner, this);
//
//     this.#wildcards.forEach((result, i) => {
//       this.registry[result.route.pattern] = result;
//       if (i === this.#wildcards.length - 1) {
//         const fallback = this.#fallbacks.get(result.route.base);
//         if (fallback) {
//           if (!this.#winner) {
//             this.registry[fallback.pattern] = Router.#cache.get(fallback.pattern) as MatchResult;
//           } else {
//             this.registry[fallback.pattern] = null;
//           }
//         }
//       }
//     })
//
//     this.#isUpdating = false;
//   }
//
//   // Match against a specific compiled pattern
//   static #matchPattern(route: RouterRoute) {
//     if (route.fallback) return null;
//     const path = location.pathname;
//
//     if (route.wildcard) {
//       if (path.match(route.regex)) {
//         return Router.#cache.get(route.pattern) as MatchResult;
//       }
//     }
//
//     const key = `${path}|${route.pattern}`;
//     let value = Router.#cache.get(key);
//     if (!value) {
//       if (route.variables.length === 0 && path === route.pattern) {
//         value = new MatchResult(route, {});
//         Router.#cache.set(key, value);
//       } else {
//         const match = path.match(route.regex);
//         if (!match) return null;
//         const vars = route.variables;
//         const params: Params = Object.create(null);
//         const matches = match.slice(1); // Skip full match
//         for (let i = 0; i < vars.length; i++) params[vars[i]] = matches[i];
//         value = new MatchResult(route, params);
//         Router.#cache.set(key, value);
//       }
//     }
//     return value;
//   }
//
//
//   update() {
//     if (!this.#pending) {
//       this.#pending = true;
//       queueMicrotask(() => {
//         this.#deferMatch();
//         this.#pending = false;
//       });
//     }
//   }
//
//   navigate(to: string, options: any = {}) {
//     try {
//       const url = new URL(to, location.href);
//       const targetPath = url.pathname.replace(/\/+/g, '/');
//
//       // Only navigate if path actually changes
//       if (targetPath !== location.pathname) {
//         history[options.replace ? 'replaceState' : 'pushState'](
//           options.state || {},
//           '',
//           targetPath
//         );
//         this.update();
//       }
//     } catch (e) {
//       console.error('Invalid navigation:', to, e);
//     }
//   }
//
//   // Escape regex special characters
//   static #escapeRegex(string: string) {
//     return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
//   }
//
//   // Compile pattern into regex and extract variable names
//   static #compileRoute(pattern: string) {
//     const variables: string[] = [];
//     let segmentsCount = 0;
//     let regexPattern = '^';
//
//     // Split pattern into segments
//     const segments = pattern.split('/').filter(segment => segment.length > 0);
//     for (const segment of segments) {
//       regexPattern += '\\/';
//
//       if (segment.startsWith('{') && segment.endsWith('}')) {
//         // This is a variable segment like {id}
//         const varName = segment.slice(1, -1);
//         variables.push(varName);
//         regexPattern += '([^\\/]+)'; // Match any non-slash characters
//       } else if (segment === '**') {
//         // Double wildcard - match any remaining path
//         // variableNames.push('**');
//         regexPattern += '(.*)';
//       } else if (segment === '*') {
//         // Single wildcard - match any single segment
//         regexPattern += '([^\\/]*)';
//       } else {
//         // Literal segment
//         regexPattern += Router.#escapeRegex(segment);
//         ++segmentsCount;
//       }
//     }
//
//     regexPattern += '(?:\\/)?$'; // Optional trailing slash
//
//     return new RouterRoute(pattern, new RegExp(regexPattern), variables, segments[0], segmentsCount);
//   }
// }
//
// export const router = new Router();
// // Save the real methods
// const originalPush = history.pushState;
// const originalReplace = history.replaceState;
//
// // Wrap them
// history.pushState = function (...args) {
//   originalPush.apply(this, args);
//   router.update();
// };
//
// history.replaceState = function (...args) {
//   originalReplace.apply(this, args);
//   router.update();
// };
//
// // Also listen to popstate
// window.addEventListener('popstate', router.update);