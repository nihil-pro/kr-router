export class RouteStateChangeEvent extends CustomEvent {
    state;
    constructor(type, detail) {
        super(type, { detail });
        this.state = detail;
    }
}
export class NotFoundStateChangeEvent extends CustomEvent {
    state;
    constructor(detail) {
        super('notfound', { detail });
        this.state = detail;
    }
}
export class AppRouter extends EventTarget {
    notFound = false;
    constructor(config) {
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
            });
        });
        Object.defineProperty(this, 'routes', { get: () => config.routes });
        void this.#onLocationChanged();
    }
    destroy() {
        window.removeEventListener('click', this.#onClickLink);
        window.removeEventListener('popstate', this.#onLocationChanged);
    }
    #onLocationChanged = async () => {
        const entries = Object.entries(this.routes);
        let notFound = true;
        for (const [route, config] of entries) {
            const previous = config.result;
            config.result = config.pattern.exec(location.href);
            const current = config.result;
            if (previous == current)
                continue;
            let shouldReport = false;
            let matches = false;
            notFound = false;
            if (current && previous) {
                matches = true;
                if (!config.pattern.pathname.endsWith('*?')) {
                    for (const segment in current.pathname.groups) {
                        if (current.pathname.groups[segment] !== previous.pathname.groups[segment]) {
                            shouldReport = true;
                            break;
                        }
                    }
                }
            }
            else {
                shouldReport = true;
                matches = Boolean(current);
            }
            if (shouldReport) {
                if (matches && !config.component) {
                    try {
                        const module = await config.loader();
                        config.component = module.default;
                    }
                    catch (error) {
                        config.error = error;
                    }
                }
                config.matches = matches;
                this.dispatchEvent(new RouteStateChangeEvent(route, config));
            }
        }
        this.dispatchEvent(new NotFoundStateChangeEvent(notFound));
        this.notFound = notFound;
    };
    navigate(path, options) {
        if (location.pathname !== path) {
            if (options?.replace) {
                history.replaceState(options.state, '', path);
            }
            else {
                history.pushState(options?.state, '', path);
            }
        }
        void this.#onLocationChanged();
    }
    #onClickLink = (event) => {
        if (event.ctrlKey || event.metaKey || event.button === 1) {
            return;
        }
        if (!event.target || !(event.target instanceof Element)) {
            return;
        }
        const path = event.composedPath();
        const anchor = path.find(el => el instanceof HTMLAnchorElement);
        if (!anchor)
            return;
        if (anchor.origin !== location.origin)
            return;
        if (anchor.target || anchor.download)
            return;
        event.preventDefault();
        const url = new URL(anchor.href, location.href);
        this.navigate(url.pathname + url.search + url.hash);
    };
    addEventListener(type, listener, options) {
        super.addEventListener(type, listener, options);
    }
    removeEventListener(type, listener, options) {
        super.removeEventListener(type, listener, options);
    }
}
