type ParseParam<ParamPart extends string> = ParamPart extends `${infer ParamName}?` ? {
    [K in ParamName]?: string;
} : ParamPart extends `${infer ParamName}*` ? {
    [K in ParamName]: string[];
} : ParamPart extends `${infer ParamName}+` ? {
    [K in ParamName]: string[];
} : ParamPart extends `${infer ParamName}(${string})` ? {
    [K in ParamName]: string;
} : {
    [K in ParamPart]: string;
};
type ExtractRouteParams<T extends string> = T extends `${string}:${infer Param}/${infer Rest}` ? ParseParam<Param> & ExtractRouteParams<Rest> : T extends `${string}:${infer Param}` ? ParseParam<Param> : {};
type ExtractWildcards<T extends string> = T extends `${infer Start}/*${infer Rest}` ? Rest extends '' ? {
    wildcard: string[];
} : {
    wildcard: string[];
} & ExtractWildcards<Rest> : {};
type RouteParams<T extends string> = ExtractRouteParams<T> & ExtractWildcards<T>;
type LoaderComponent<T extends RouteConfig> = Awaited<ReturnType<T['loader']>> extends {
    default: infer C;
} ? C : never;
interface RouteConfig<C = any> {
    path: string;
    loader(): Promise<{
        default: C;
    }>;
}
export interface RouterConfig {
    routes: Record<string, RouteConfig>;
    interceptLinks?: boolean;
}
export interface RoutePatternResult<T extends Record<string, string | undefined>> extends URLPatternResult {
    pathname: {
        input: string;
        groups: T;
    };
}
export type RouteState<T extends RouteConfig> = {
    pattern: URLPattern;
    matches: true;
    component: LoaderComponent<T> | null;
    error: Error | null;
    result: RoutePatternResult<RouteParams<T['path']>>;
} | {
    pattern: URLPattern;
    matches: false;
    component: LoaderComponent<T> | null;
    error: Error | null;
    result: null;
};
export type RouterRoutes<T extends RouterConfig> = {
    [K in keyof T['routes']]: RouteState<T['routes'][K]> & RouteConfig;
};
export {};
//# sourceMappingURL=types.helpers.d.ts.map