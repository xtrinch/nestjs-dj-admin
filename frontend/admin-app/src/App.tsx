import { useEffect, useState } from 'react';
import { Breadcrumbs } from './components/Breadcrumbs.js';
import { ListPage } from './pages/ListPage.js';
import { EditPage } from './pages/EditPage.js';
import { PasswordPage } from './pages/PasswordPage.js';
import { DeleteConfirmPage } from './pages/DeleteConfirmPage.js';
import { LoginPage } from './pages/LoginPage.js';
import { getCurrentAdminUser, logoutAdmin } from './services/auth.service.js';
import { getAdminMeta } from './services/resources.service.js';
import { consumeToast, onToast } from './services/toast.service.js';
import type { AdminToast } from './services/toast.service.js';
import type { AdminMetaResponse, AdminUser, ResourceSchema } from './types.js';

export function App() {
  const [meta, setMeta] = useState<AdminMetaResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<AdminUser | null>(null);
  const [authState, setAuthState] = useState<'loading' | 'authenticated' | 'unauthenticated'>(
    'loading',
  );
  const [hash, setHash] = useState(() => window.location.hash);
  const [pageLabel, setPageLabel] = useState<string | null>(null);
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

  useEffect(() => {
    if (!route) {
      setPageLabel(null);
      return;
    }

    if (route.mode === 'edit') {
      setPageLabel(route.id ? route.id : 'New');
    } else if (route.mode === 'password') {
      setPageLabel('Password');
    } else if (route.mode === 'delete') {
      setPageLabel('Delete');
    } else {
      setPageLabel(null);
    }
  }, [route]);

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
          {categories.map(([category, resources]) => (
            <section key={category} className="nav__group">
              <span className="nav__group-label">{category}</span>
              {resources.map((resource) => (
                <a
                  key={resource.resourceName}
                  className={activeRoute.resourceName === resource.resourceName ? 'nav__link active' : 'nav__link'}
                  href={`#/${resource.resourceName}`}
                >
                  {resource.label}
                </a>
              ))}
            </section>
          ))}
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
          <Breadcrumbs
            category={activeRoute.resource.category}
            resourceName={activeRoute.resourceName}
            resourceLabel={activeRoute.resource.label}
            pageLabel={pageLabel}
          />
          {activeRoute.mode === 'list' ? (
            <ListPage
              key={`list:${activeRoute.resourceName}`}
              resourceName={activeRoute.resourceName}
              onTitleChange={setPageLabel}
            />
          ) : activeRoute.mode === 'delete' ? (
            <DeleteConfirmPage
              key={`delete:${activeRoute.resourceName}:${activeRoute.deleteIds.join(',')}`}
              resourceName={activeRoute.resourceName}
              ids={activeRoute.deleteIds}
              onTitleChange={setPageLabel}
            />
          ) : activeRoute.mode === 'password' ? (
            <PasswordPage
              key={`password:${activeRoute.resourceName}:${activeRoute.id}`}
              resource={activeRoute.resource}
              id={activeRoute.id}
              onTitleChange={setPageLabel}
            />
          ) : (
            <EditPage
              key={`edit:${activeRoute.resourceName}:${activeRoute.id ?? 'new'}`}
              resource={activeRoute.resource}
              id={activeRoute.id}
              onTitleChange={setPageLabel}
            />
          )}
        </div>
      </main>
    </div>
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

function parseRoute(hash: string, resources: ResourceSchema[]) {
  const [resourceName, mode, id, extra] = hash.replace(/^#\//, '').split('/');
  const fallback = resources[0];
  const resource = resources.find((item) => item.resourceName === resourceName) ?? fallback;

  if (mode === 'delete' && id) {
    return {
      resource,
      resourceName: resource.resourceName,
      mode: 'delete' as const,
      id: undefined,
      deleteIds: id.split(','),
    };
  }

  if (mode === 'edit' && id && extra === 'password') {
    return {
      resource,
      resourceName: resource.resourceName,
      mode: 'password' as const,
      id,
      deleteIds: [] as string[],
    };
  }

  return {
    resource,
    resourceName: resource.resourceName,
    mode: mode === 'new' || mode === 'edit' ? ('edit' as const) : ('list' as const),
    id: mode === 'edit' ? id : undefined,
    deleteIds: [] as string[],
  };
}
