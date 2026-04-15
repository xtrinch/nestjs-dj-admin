import { useEffect, useState } from 'react';
import { Breadcrumbs } from './components/Breadcrumbs.js';
import { ListPage } from './pages/ListPage.js';
import { EditPage } from './pages/EditPage.js';
import { PasswordPage } from './pages/PasswordPage.js';
import { DeleteConfirmPage } from './pages/DeleteConfirmPage.js';
import { AuditLogPage } from './pages/AuditLogPage.js';
import { LoginPage } from './pages/LoginPage.js';
import { getCurrentAdminUser, logoutAdmin } from './services/auth.service.js';
import { getAdminMeta } from './services/resources.service.js';
import { consumeToast, onToast } from './services/toast.service.js';
import type { AdminToast } from './services/toast.service.js';
import type { AdminMetaResponse, AdminUser, ResourceSchema } from './types.js';

type AppRoute =
  | {
      kind: 'audit';
      category: 'System';
      resourceName: 'audit-log';
      resourceLabel: 'Audit Log';
      pageLabel: null;
    }
  | {
      kind: 'resource';
      resource: ResourceSchema;
      resourceName: string;
      mode: 'list' | 'edit' | 'password' | 'delete';
      id?: string;
      deleteIds: string[];
    };

export function App() {
  const [meta, setMeta] = useState<AdminMetaResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<AdminUser | null>(null);
  const [authState, setAuthState] = useState<'loading' | 'authenticated' | 'unauthenticated'>(
    'loading',
  );
  const [hash, setHash] = useState(() => window.location.hash);
  const [pageSubjectLabel, setPageSubjectLabel] = useState<string | null>(null);
  const [toast, setToast] = useState<AdminToast | null>(null);

  useEffect(() => {
    void loadAdmin();
  }, []);

  useEffect(() => {
    const onHashChange = () => {
      setHash(window.location.hash);
      const pendingToast = consumeToast();
      if (pendingToast) {
        setToast(pendingToast);
      }
    };

    window.addEventListener('hashchange', onHashChange);
    const disposeToast = onToast((nextToast) => {
      setToast(nextToast);
    });

    return () => {
      window.removeEventListener('hashchange', onHashChange);
      disposeToast();
    };
  }, []);

  useEffect(() => {
    const pendingToast = consumeToast();
    if (pendingToast) {
      setToast(pendingToast);
    }
  }, []);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setToast(null);
    }, 3200);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [toast]);

  const route = meta?.resources.length ? parseRoute(hash, meta.resources) : null;
  const categories = meta ? groupResources(meta.resources) : [];
  const routeUi = route ? describeRoute(route, pageSubjectLabel) : null;

  useEffect(() => {
    if (!route) {
      setPageSubjectLabel(null);
      return;
    }

    setPageSubjectLabel(getInitialRouteSubjectLabel(route));
  }, [route]);

  useEffect(() => {
    if (!routeUi) {
      document.title = 'DJ Admin';
      return;
    }

    document.title = routeUi.pageLabel
      ? `${routeUi.pageLabel} | ${routeUi.resourceLabel} | DJ Admin`
      : `${routeUi.resourceLabel} | DJ Admin`;
  }, [routeUi]);

  async function loadAdmin() {
    try {
      const currentUser = await getCurrentAdminUser();
      if (!currentUser) {
        setAuthState('unauthenticated');
        setMeta(null);
        setUser(null);
        setError(null);
        return;
      }

      setUser(currentUser);
      setMeta(await getAdminMeta());
      setAuthState('authenticated');
      setError(null);
    } catch (reason) {
      setError((reason as Error).message);
    }
  }

  async function logout() {
    await logoutAdmin();
    setUser(null);
    setMeta(null);
    setAuthState('unauthenticated');
  }

  if (error) {
    return <div className="shell">Failed to load admin metadata: {error}</div>;
  }

  if (authState === 'loading') {
    return <div className="shell">Loading admin resources…</div>;
  }

  if (authState === 'unauthenticated') {
    return <LoginPage onAuthenticated={loadAdmin} />;
  }

  if (!meta || !user) {
    return <div className="shell">Loading admin resources…</div>;
  }

  if (meta.resources.length === 0) {
    return <div className="shell">No admin resources are registered.</div>;
  }

  const activeRoute = route;
  if (!activeRoute) {
    return <div className="shell">Loading admin resources…</div>;
  }

  return (
    <div className="shell">
      {toast ? (
        <div className="toast-layer" aria-live="polite">
          <div className={`toast toast--${toast.variant ?? 'success'}`} role="status">
            {toast.message}
          </div>
        </div>
      ) : null}
      <aside className="sidebar">
        <div className="brand">
          <span className="brand__eyebrow">Nest-native</span>
          <h1>DJ Admin</h1>
        </div>
        <nav className="nav">
          <SidebarNav
            activeRoute={activeRoute}
            auditLogEnabled={meta.auditLog?.enabled === true}
            categories={categories}
          />
        </nav>
      </aside>
      <main className="content">
        <header className="topbar">
          <div className="topbar__spacer" />
          <div className="session-bar">
            <span className="session-bar__label">Welcome, {user.email ?? user.id}</span>
            <button className="session-bar__link" type="button" onClick={() => void logout()}>
              Log out
            </button>
          </div>
        </header>
        <div className="content__body">
          {routeUi ? (
            <Breadcrumbs
              category={routeUi.category}
              resourceName={routeUi.resourceName}
              resourceLabel={routeUi.resourceLabel}
              pageLabel={routeUi.pageLabel}
            />
          ) : null}
          <RouteContent
            display={meta.display}
            route={activeRoute}
            onTitleChange={setPageSubjectLabel}
          />
        </div>
      </main>
    </div>
  );
}

function SidebarNav({
  activeRoute,
  auditLogEnabled,
  categories,
}: {
  activeRoute: AppRoute;
  auditLogEnabled: boolean;
  categories: Array<[string, ResourceSchema[]]>;
}) {
  return (
    <>
      {categories.map(([category, resources]) => (
        <section key={category} className="nav__group">
          <span className="nav__group-label">{category}</span>
          {resources.map((resource) => (
            <a
              key={resource.resourceName}
              className={isActiveResourceRoute(activeRoute, resource.resourceName) ? 'nav__link active' : 'nav__link'}
              href={`#/${resource.resourceName}`}
            >
              {resource.label}
            </a>
          ))}
        </section>
      ))}
      {auditLogEnabled ? (
        <section className="nav__group">
          <span className="nav__group-label">System</span>
          <a className={activeRoute.kind === 'audit' ? 'nav__link active' : 'nav__link'} href="#/audit-log">
            Audit Log
          </a>
        </section>
      ) : null}
    </>
  );
}

function RouteContent({
  display,
  route,
  onTitleChange,
}: {
  display: AdminMetaResponse['display'];
  route: AppRoute;
  onTitleChange: (label: string | null) => void;
}) {
  if (route.kind === 'audit') {
    return <AuditLogPage key="audit-log" display={display} onTitleChange={onTitleChange} />;
  }

  if (route.mode === 'list') {
    return (
      <ListPage
        key={`list:${route.resourceName}`}
        resourceName={route.resourceName}
        onTitleChange={onTitleChange}
      />
    );
  }

  if (route.mode === 'delete') {
    return (
      <DeleteConfirmPage
        key={`delete:${route.resourceName}:${route.deleteIds.join(',')}`}
        resourceName={route.resourceName}
        ids={route.deleteIds}
        onTitleChange={onTitleChange}
      />
    );
  }

  if (route.mode === 'password') {
    return (
      <PasswordPage
        key={`password:${route.resourceName}:${route.id}`}
        resource={route.resource}
        id={route.id ?? ''}
        onTitleChange={onTitleChange}
      />
    );
  }

  return (
    <EditPage
      key={`edit:${route.resourceName}:${route.id ?? 'new'}`}
      resource={route.resource}
      id={route.id}
      onTitleChange={onTitleChange}
    />
  );
}

function groupResources(resources: ResourceSchema[]) {
  const groups = new Map<string, ResourceSchema[]>();

  for (const resource of resources) {
    const category = resource.category || 'General';
    const group = groups.get(category) ?? [];
    group.push(resource);
    groups.set(category, group);
  }

  return [...groups.entries()];
}

function describeRoute(route: AppRoute, subjectLabel: string | null) {
  return {
    category: route.kind === 'audit' ? route.category : route.resource.category,
    resourceName: route.resourceName,
    resourceLabel: route.kind === 'audit' ? route.resourceLabel : route.resource.label,
    pageLabel: getRoutePageLabel(route, subjectLabel),
  };
}

function getInitialRouteSubjectLabel(route: AppRoute): string | null {
  if (route.kind === 'audit' || route.mode === 'list') {
    return null;
  }

  if (route.mode === 'edit' || route.mode === 'password') {
    return route.id ?? null;
  }

  return route.deleteIds.length === 1 ? route.deleteIds[0] : `${route.deleteIds.length} items`;
}

function getRoutePageLabel(route: AppRoute, subjectLabel: string | null): string | null {
  if (route.kind === 'audit') {
    return null;
  }

  if (route.mode === 'list') {
    return null;
  }

  if (route.mode === 'edit') {
    return route.id ? `Edit ${subjectLabel ?? route.resource.label}` : `Add ${route.resource.label}`;
  }

  if (route.mode === 'password') {
    return `Change password for ${subjectLabel ?? route.resource.label}`;
  }

  return `Delete ${subjectLabel ?? route.resource.label}`;
}

function isActiveResourceRoute(route: AppRoute, resourceName: string): boolean {
  return route.kind === 'resource' && route.resourceName === resourceName;
}

function parseRoute(hash: string, resources: ResourceSchema[]): AppRoute {
  if (hash.replace(/^#\//, '') === 'audit-log') {
    return {
      kind: 'audit',
      category: 'System',
      resourceName: 'audit-log',
      resourceLabel: 'Audit Log',
      pageLabel: null,
    };
  }

  const [resourceName, mode, id, extra] = hash.replace(/^#\//, '').split('/');
  const fallback = resources[0];
  const resource = resources.find((item) => item.resourceName === resourceName) ?? fallback;

  if (mode === 'delete' && id) {
    return {
      kind: 'resource',
      resource,
      resourceName: resource.resourceName,
      mode: 'delete' as const,
      id: undefined,
      deleteIds: id.split(','),
    };
  }

  if (mode === 'edit' && id && extra === 'password') {
    return {
      kind: 'resource',
      resource,
      resourceName: resource.resourceName,
      mode: 'password' as const,
      id,
      deleteIds: [] as string[],
    };
  }

  return {
    kind: 'resource',
    resource,
    resourceName: resource.resourceName,
    mode: mode === 'new' || mode === 'edit' ? ('edit' as const) : ('list' as const),
    id: mode === 'edit' ? id : undefined,
    deleteIds: [] as string[],
  };
}
