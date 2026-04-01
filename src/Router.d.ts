import type { RouterConfig, RouterRoutes } from './types.helpers.js';
export declare class RouteStateChangeEvent<T> extends CustomEvent<T> {
    state: T;
    constructor(type: string, detail: T);
}
export declare class NotFoundStateChangeEvent extends CustomEvent<boolean> {
    state: boolean;
    constructor(detail: boolean);
}
export declare class AppRouter<T extends RouterConfig> extends EventTarget {
    #private;
    readonly routes: RouterRoutes<T>;
    notFound: boolean;
    constructor(config: T);
    destroy(): void;
    navigate(path: string, options?: {
        replace?: boolean;
        state?: any;
    }): void;
    addEventListener(type: 'notfound', listener: (event: NotFoundStateChangeEvent) => void, options?: boolean | AddEventListenerOptions): void;
    addEventListener<K extends keyof T['routes']>(type: K, listener: (event: RouteStateChangeEvent<RouterRoutes<T>[K]>) => void, options?: boolean | AddEventListenerOptions): void;
    addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
    removeEventListener(type: 'notfound', listener: (event: NotFoundStateChangeEvent) => void, options?: boolean | EventListenerOptions): void;
    removeEventListener<K extends keyof T['routes']>(type: K, listener: (event: RouteStateChangeEvent<RouterRoutes<T>[K]>) => void, options?: boolean | EventListenerOptions): void;
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
}
//# sourceMappingURL=Router.d.ts.map