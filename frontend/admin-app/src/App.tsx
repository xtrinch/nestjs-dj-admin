import { useEffect, useState } from 'react';
import { adminUrl } from './api.js';
import { ListPage } from './pages/ListPage.js';
import { EditPage } from './pages/EditPage.js';
import type { AdminMetaResponse, ResourceSchema } from './types.js';

export function App() {
  const [meta, setMeta] = useState<AdminMetaResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hash, setHash] = useState(() => window.location.hash);

  useEffect(() => {
    fetch(adminUrl('/_meta'), {
      headers: {
        'x-admin-role': 'admin',
      },
    })
      .then((response) => response.json())
      .then((data: AdminMetaResponse) => {
        setMeta(data);
      })
      .catch((reason: Error) => {
        setError(reason.message);
      });
  }, []);

  useEffect(() => {
    const onHashChange = () => {
      setHash(window.location.hash);
    };

    window.addEventListener('hashchange', onHashChange);
    return () => {
      window.removeEventListener('hashchange', onHashChange);
    };
  }, []);

  if (error) {
    return <div className="shell">Failed to load admin metadata: {error}</div>;
  }

  if (!meta) {
    return <div className="shell">Loading admin resources…</div>;
  }

  if (meta.resources.length === 0) {
    return <div className="shell">No admin resources are registered.</div>;
  }

  const route = parseRoute(hash, meta.resources);
  const categories = groupResources(meta.resources);

  return (
    <div className="shell">
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
                  className={route.resourceName === resource.resourceName ? 'nav__link active' : 'nav__link'}
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
        {route.mode === 'list' ? (
          <ListPage key={`list:${route.resourceName}`} resourceName={route.resourceName} />
        ) : (
          <EditPage
            key={`edit:${route.resourceName}:${route.id ?? 'new'}`}
            resource={route.resource}
            id={route.id}
          />
        )}
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
  const [resourceName, mode, id] = hash.replace(/^#\//, '').split('/');
  const fallback = resources[0];
  const resource = resources.find((item) => item.resourceName === resourceName) ?? fallback;

  return {
    resource,
    resourceName: resource.resourceName,
    mode: mode === 'new' || mode === 'edit' ? 'edit' : 'list',
    id: mode === 'edit' ? id : undefined,
  };
}
