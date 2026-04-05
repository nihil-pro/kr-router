import React from 'react';
import type { ComponentType } from 'react';
import type { RouterRoutes, AppRouter } from 'kr-router';


class Route<T extends AppRouter<any>, K extends keyof RouterRoutes<RouterConfig<T>>> extends React.Component<RouteProps<T, K>> {
  #rerender = () => this.forceUpdate();

  state: { error: Error | null } = { error: null }

  constructor(props: RouteProps<T, K>) {
    super(props);
    props.router.addEventListener(props.name, this.#rerender);
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`[kr-router]: Route<${this.props.route.name.toString()}>`, error, errorInfo);
  }

  static getDerivedStateFromError(error: unknown) {
    if (error instanceof Error) return { error };
    return { error: new Error('An error has occurred during render') };
  }

  componentWillUnmount() {
    this.props.router.removeEventListener(this.props.name, this.#rerender);
  }

  render() {
    if (!this.props.route.matches) return null;
    const error = this.props.route.error || this.state.error;
    if (error) return <this.props.ErrorComponent error={error} />;
    const RouteComponent = this.props.route.component as any;
    if (!RouteComponent) return null;
    return <RouteComponent /> as any;
  }
}

class NotFound<T extends AppRouter<any>> extends React.Component<NotFoundProps<T>> {
  #rerender = () => this.forceUpdate();

  constructor(props: NotFoundProps<T>) {
    super(props);
    props.router.addEventListener('notfound', this.#rerender);
  }

  componentWillUnmount() {
    this.props.router.removeEventListener('notfound', this.#rerender);
  }

  render() {
    if (!this.props.router.notFound) return null;
    return <this.props.Component />;
  }
}

export function ReactRouter<T extends AppRouter<any>>(
  {
    router,
    NotFoundComponent,
    ErrorComponent
  }: {
    router: T,
    NotFoundComponent: ComponentType,
    ErrorComponent: ComponentType<{ error: Error }>
  }) {
  return (
    <React.Fragment>
      {Object.entries(router.routes).map(([name, route]) => {
        type K = keyof RouterRoutes<RouterConfig<T>>;
        return (
          <Route
            key={name}
            name={name as K}
            route={route as RouterRoutes<RouterConfig<T>>[K]}
            router={router}
            ErrorComponent={ErrorComponent}
          />
        );
      })}
      <NotFound router={router} Component={NotFoundComponent} />
    </React.Fragment>
  );
}

type RouterConfig<T extends AppRouter<any>> = T extends AppRouter<infer C> ? C : never;

interface RouteProps<T extends AppRouter<any>, K extends keyof RouterRoutes<RouterConfig<T>>> {
  router: T;
  name: K;
  route: RouterRoutes<RouterConfig<T>>[K];
  ErrorComponent: ComponentType<{ error: Error }>
}

interface NotFoundProps<T extends AppRouter<any>> {
  router: T;
  Component: ComponentType
}
