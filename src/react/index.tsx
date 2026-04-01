import { RouterRoutes, AppRouter } from 'kr-router';
import React, { Fragment, ComponentType, useEffect, useState } from 'react';

function Route<T extends AppRouter<any>, K extends keyof RouterRoutes<RouterConfig<T>>>(
  { route, router, name, ErrorComponent }: RouteProps<T, K>
) {
  const [, rerender] = useState<any>(null);
  router.addEventListener(name, rerender)

  useEffect(() => () => router.removeEventListener(name, rerender), [router]);

  if (!route.matches) return null;
  if (route.error) return <ErrorComponent error={route.error} />;

  const Component = route.component as any;
  if (!Component) return null;
  return <Component />;
}


function NotFound<T extends AppRouter<any>>({ Component, router }: NotFoundProps<T>) {
  const [, rerender] = useState<any>(null);
  router.addEventListener('notfound', rerender);
  useEffect(() => () => router.removeEventListener('notfound', rerender), [router]);

  if (router.notFound) return <Component />
  return null;
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
    <Fragment>
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
    </Fragment>
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