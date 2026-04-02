import { Component } from 'preact';
import type { ComponentType } from 'preact';
import type { RouterRoutes, AppRouter } from 'kr-router';

class Route<T extends AppRouter<any>, K extends keyof RouterRoutes<RouterConfig<T>>> extends Component<RouteProps<T, K>> {
  #rerender = () => this.forceUpdate();

  constructor(props: RouteProps<T, K>) {
    super(props);
    props.router.addEventListener(props.name, this.#rerender);
  }

  componentWillUnmount() {
    this.props.router.removeEventListener(this.props.name, this.#rerender);
  }

  render() {
    if (!this.props.route.matches) return null;
    if (this.props.route.error) return <this.props.ErrorComponent error={this.props.route.error} />;
    const Comp = this.props.route.component as any;
    if (!Comp) return null;
    return <Comp />;
  }
}

class NotFound<T extends AppRouter<any>> extends Component<NotFoundProps<T>> {
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

export function PreactRouter<T extends AppRouter<any>>(
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
    <>
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
    </>
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
