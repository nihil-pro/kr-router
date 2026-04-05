type ParseParam<ParamPart extends string> =
  // Check for regex + optional modifier :id(regex)?
  ParamPart extends `${infer ParamName}(${string})?`
    ? { [K in ParamName]?: string }
    // Check for regex + zero-or-more modifier :id(regex)*
    : ParamPart extends `${infer ParamName}(${string})*`
      ? { [K in ParamName]: string[] }
      // Check for regex + one-or-more modifier :id(regex)+
      : ParamPart extends `${infer ParamName}(${string})+`
        ? { [K in ParamName]: string[] }
        // Check for regex constraint :id(regex) or :id(regex){...} - extract just the name
        : ParamPart extends `${infer ParamName}(${string})${string}`
          ? { [K in ParamName]: string }
          // Check for optional parameter :id?
          : ParamPart extends `${infer ParamName}?`
            ? { [K in ParamName]?: string }
            // Check for wildcard with modifier :id* or :id+
            : ParamPart extends `${infer ParamName}*`
              ? { [K in ParamName]: string[] }
              : ParamPart extends `${infer ParamName}+`
                ? { [K in ParamName]: string[] }
                // Simple named parameter
                : { [K in ParamPart]: string };

type ExtractRouteParams<T extends string> =
  T extends `${string}:${infer Param}/${infer Rest}`
    ? ParseParam<Param> & ExtractRouteParams<Rest>
    : T extends `${string}:${infer Param}`
      ? ParseParam<Param>
      : {};

/** Creates a typed object based on string input
 * @example
 * input = "/foo/:bar"
 * output = { bar: string }
 *
 * input = "/:foo/:bar?/:baz*",
 * output = {
 *   foo: string
 *   bar?: string
 *   baz: string[]
 * }
 * */
type RouteParams<T extends string> = ExtractRouteParams<T>;

type LoaderComponent<T extends RouteConfig> =
  Awaited<ReturnType<T['loader']>> extends { default: infer C } ? C : never;

interface RouteConfig<C = any, Q extends Record<string, string | undefined> = Record<never, never>> {

  path: string;

  /**
   * Type-only descriptor for expected query string parameters.
   * Not used at runtime — assign with `{} as YourQueryType` to annotate the type.
   * @example
   * query: {} as { page?: string; filter?: string }
   */
  query?: Q;
  loader(): Promise<{ default: C }>;
}

type QueryOf<T> = T extends { query: infer Q extends Record<string, string | undefined> }
  ? Q
  : Record<never, never>;

export interface RouterConfig {
  routes: Record<string, RouteConfig>;

  /**
   * Whether the router should automatically intercept and handle clicks on anchor
   * (`<a>`) elements using client-side navigation.
   *
   * When `true` (default), the router calls `preventDefault()` on matching anchor
   * clicks and handles navigation internally, provided all of the following are true:
   * - The anchor's origin matches the current `location.origin`
   * - The anchor has no `target` attribute (e.g., `_blank`)
   * - The anchor has no `download` attribute
   * - The click is a standard left-click (no `ctrlKey`, `metaKey`, and `button !== 1`)
   *
   * Set to `false` to disable this behavior and handle link navigation manually,
   * either with a custom `Link` component or by calling `router.navigate()` directly.
   *
   * @default true
   */
  interceptLinks?: boolean;
}


export interface RoutePatternResult<
  P extends Record<string, string | undefined>,
  Q extends Record<string, string | undefined> = Record<never, never>
> extends URLPatternResult {
  pathname: {
    input: string;
    groups: P
  }
  search: {
    input: string;
    groups: Q
  }
}

/** Route state depend on location
 *
 * @property {boolean} matches `true` if `location.href` matches route path, `false` otherwise
 *
 * @property {URLPatternResult | null} result An `URLPatternResult` if matches is `true`, `null` otherwise
 * */
export type RouteState<T extends RouteConfig> =
  | {
    pattern: URLPattern
    matches: true;
    component: LoaderComponent<T> | null;
    error: Error | null;

    /**  @see https://developer.mozilla.org/en-US/docs/Web/API/URLPattern/exec#return_value */
    result: RoutePatternResult<RouteParams<T['path']>, QueryOf<T>>;
  } | {
    pattern: URLPattern
    matches: false;
    component: LoaderComponent<T> | null;
    error: Error | null;

    /** null, because pattern didn't match location */
    result: null;
  }


export type RouterRoutes<T extends RouterConfig> = {
  [K in keyof T['routes']]: RouteState<T['routes'][K]> & RouteConfig & { name: K };
}
