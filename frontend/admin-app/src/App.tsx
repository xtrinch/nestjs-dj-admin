import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Breadcrumbs } from './components/Breadcrumbs.js';
import { ListPage } from './pages/ListPage.js';
import { EditPage } from './pages/EditPage.js';
import { PasswordPage } from './pages/PasswordPage.js';
import { DeleteConfirmPage } from './pages/DeleteConfirmPage.js';
import { AuditLogPage } from './pages/AuditLogPage.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { CustomPage } from './pages/CustomPage.js';
import { LoginPage } from './pages/LoginPage.js';
import { ExternalAuthPage } from './pages/ExternalAuthPage.js';
import { canWriteResource } from './permissions.js';
import { getAdminAuthConfig, getCurrentAdminUser, logoutAdmin } from './services/auth.service.js';
import { getAdminMeta } from './services/resources.service.js';
import { consumeToast, onToast } from './services/toast.service.js';
import type { AdminToast } from './services/toast.service.js';
import type {
  AdminAuthConfig,
  AdminMetaResponse,
  AdminUser,
  CustomPageSchema,
  NavItemSchema,
  ResourceSchema,
  WidgetSchema,
} from './types.js';

type NavigationGroup = {
  category: string;
  resources: ResourceSchema[];
  navItems: NavItemSchema[];
};

type AppRoute =
  | {
      kind: 'home';
      category: 'Home';
      resourceName: 'dashboard';
      resourceLabel: 'Dashboard';
      pageLabel: null;
    }
  | {
      kind: 'audit';
      category: 'System';
      resourceName: 'audit-log';
      resourceLabel: 'Audit Log';
      pageLabel: null;
    }
  | {
      kind: 'page';
      page: CustomPageSchema;
      category: string;
      resourceName: string;
      resourceLabel: string;
      pageLabel: null;
    }
  | {
      kind: 'resource';
      resource: ResourceSchema;
      resourceName: string;
      mode: 'list' | 'edit' | 'view' | 'password' | 'delete';
      id?: string;
      deleteIds: string[];
    };

export function App() {
  const [meta, setMeta] = useState<AdminMetaResponse | null>(null);
  const [authConfig, setAuthConfig] = useState<AdminAuthConfig | null>(null);
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

  const route = meta ? parseRoute(hash, meta.resources, meta.pages) : null;
  const navigation = meta ? groupNavigation(meta.resources, meta.navItems) : [];
  const routeUi = route ? describeRoute(route, pageSubjectLabel) : null;
  const brandStyle = useMemo(() => buildBrandStyle(meta?.branding.accentColor), [meta?.branding.accentColor]);

  useEffect(() => {
    if (!route) {
      setPageSubjectLabel(null);
      return;
    }

    setPageSubjectLabel(getInitialRouteSubjectLabel(route));
  }, [route]);

  useEffect(() => {
    if (!routeUi) {
      document.title = meta?.branding.siteTitle ?? 'DJ Admin';
      return;
    }

    document.title = routeUi.pageLabel
      ? `${routeUi.pageLabel} | ${routeUi.resourceLabel} | ${meta?.branding.siteTitle ?? 'DJ Admin'}`
      : `${routeUi.resourceLabel} | ${meta?.branding.siteTitle ?? 'DJ Admin'}`;
  }, [meta?.branding.siteTitle, routeUi]);

  async function loadAdmin() {
    try {
      const nextAuthConfig = await getAdminAuthConfig();
      setAuthConfig(nextAuthConfig);
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
    if (authConfig?.mode === 'external') {
      return <ExternalAuthPage config={authConfig} />;
    }

    return <LoginPage onAuthenticated={loadAdmin} />;
  }

  if (!meta || !user) {
    return <div className="shell">Loading admin resources…</div>;
  }

  const activeRoute = route;
  if (!activeRoute && (meta.resources.length > 0 || meta.pages.length > 0)) {
    return <div className="shell">Loading admin resources…</div>;
  }

  return (
    <div className="shell" style={brandStyle}>
      {toast ? (
        <div className="toast-layer" aria-live="polite">
          <div className={`toast toast--${toast.variant ?? 'success'}`} role="status">
            <span className="toast__message">{toast.message}</span>
            <button
              aria-label="Dismiss notification"
              className="toast__close"
              type="button"
              onClick={() => setToast(null)}
            >
              ×
            </button>
          </div>
        </div>
      ) : null}
      <aside className="sidebar">
        <div className="brand">
          <span className="brand__eyebrow">Administration</span>
          <h1>{meta.branding.siteHeader}</h1>
        </div>
        <nav className="nav">
          <SidebarNav
            activeRoute={activeRoute}
            auditLogEnabled={meta.auditLog?.enabled === true}
            navigation={navigation}
          />
        </nav>
      </aside>
      <main className="content">
        <header className="topbar">
          <div className="topbar__spacer" />
          <div className="session-bar">
            <span className="session-bar__label">Welcome, {user.email ?? user.id}</span>
            {authConfig?.logoutEnabled !== false ? (
              <button className="session-bar__link" type="button" onClick={() => void logout()}>
                Log out
              </button>
            ) : null}
          </div>
        </header>
        <div className="content__body">
          {routeUi && activeRoute && activeRoute.kind !== 'home' ? (
            <Breadcrumbs
              category={routeUi.category}
              resourceHref={routeUi.resourceHref}
              resourceLabel={routeUi.resourceLabel}
              pageLabel={routeUi.pageLabel}
            />
          ) : null}
          {meta.resources.length === 0 && meta.pages.length === 0 ? (
            <div className="panel">No admin resources or extension pages are registered.</div>
          ) : activeRoute ? (
            <RouteContent
              auditLogEnabled={meta.auditLog?.enabled === true}
              branding={meta.branding}
              navigation={navigation}
              pages={meta.pages}
              widgets={meta.widgets}
              display={meta.display}
              route={activeRoute}
              user={user}
              onTitleChange={setPageSubjectLabel}
            />
          ) : (
            <div className="shell">Loading admin resources…</div>
          )}
        </div>
      </main>
    </div>
  );
}

function buildBrandStyle(accentColor: string | undefined) {
  const accent = normalizeHexColor(accentColor) ?? '#f59e0b';
  const accentStrong = shadeHexColor(accent, -0.12);
  const accentSoft = shadeHexColor(accent, 0.18);
  const accentMuted = shadeHexColor(accent, 0.34);
  const surfaceHi = shadeHexColor(accent, -0.78);
  const surface = shadeHexColor(accent, -0.84);
  const surfaceLow = shadeHexColor(accent, -0.9);
  const sidebarTop = shadeHexColor(accent, -0.86);
  const sidebarBottom = shadeHexColor(accent, -0.9);
  const topbarTop = shadeHexColor(accent, -0.8);
  const topbarBottom = shadeHexColor(accent, -0.86);
  const border = shadeHexColor(accent, -0.68);
  const textMuted = shadeHexColor(accent, 0.28);
  const textSubtle = shadeHexColor(accent, 0.14);
  const rgb = hexToRgb(accent);

  return {
    '--admin-accent': accent,
    '--admin-accent-strong': accentStrong,
    '--admin-accent-soft': accentSoft,
    '--admin-accent-muted': accentMuted,
    '--admin-accent-rgb': rgb ? `${rgb.r} ${rgb.g} ${rgb.b}` : '245 158 11',
    '--admin-surface-hi': surfaceHi,
    '--admin-surface': surface,
    '--admin-surface-low': surfaceLow,
    '--admin-sidebar-top': sidebarTop,
    '--admin-sidebar-bottom': sidebarBottom,
    '--admin-topbar-top': topbarTop,
    '--admin-topbar-bottom': topbarBottom,
    '--admin-border': border,
    '--admin-text-muted': textMuted,
    '--admin-text-subtle': textSubtle,
  } as CSSProperties;
}

function normalizeHexColor(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (/^#[0-9a-f]{6}$/i.test(trimmed)) {
    return trimmed;
  }

  if (/^#[0-9a-f]{3}$/i.test(trimmed)) {
    return `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`;
  }

  return null;
}

function hexToRgb(hex: string) {
  const normalized = normalizeHexColor(hex);
  if (!normalized) {
    return null;
  }

  const value = normalized.slice(1);
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16),
  };
}

function shadeHexColor(hex: string, amount: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) {
    return hex;
  }

  const adjust = (channel: number) =>
    Math.max(
      0,
      Math.min(
        255,
        Math.round(amount >= 0 ? channel + (255 - channel) * amount : channel * (1 + amount)),
      ),
    );

  const next = {
    r: adjust(rgb.r),
    g: adjust(rgb.g),
    b: adjust(rgb.b),
  };

  return `#${next.r.toString(16).padStart(2, '0')}${next.g.toString(16).padStart(2, '0')}${next.b.toString(16).padStart(2, '0')}`;
}

function SidebarNav({
  activeRoute,
  auditLogEnabled,
  navigation,
}: {
  activeRoute: AppRoute | null;
  auditLogEnabled: boolean;
  navigation: NavigationGroup[];
}) {
  return (
    <>
      <section className="nav__group">
        <span className="nav__group-label">Home</span>
        <a className={activeRoute?.kind === 'home' ? 'nav__link active' : 'nav__link'} href="#">
          Dashboard
        </a>
      </section>
      {navigation.map((group) => (
        <section key={group.category} className="nav__group">
          <span className="nav__group-label">{group.category}</span>
          {group.resources.map((resource) => (
            <a
              key={resource.resourceName}
              className={
                activeRoute && isActiveResourceRoute(activeRoute, resource.resourceName)
                  ? 'nav__link active'
                  : 'nav__link'
              }
              href={`#/${resource.resourceName}`}
            >
              {resource.label}
            </a>
          ))}
          {group.navItems.map((navItem) => (
            <a
              key={navItem.key}
              className={
                activeRoute && isActiveNavItemRoute(activeRoute, navItem)
                  ? 'nav__link active'
                  : 'nav__link'
              }
              href={navItem.kind === 'page' ? `#/pages/${navItem.pageSlug}` : navItem.href}
            >
              {navItem.label}
            </a>
          ))}
        </section>
      ))}
      {auditLogEnabled ? (
        <section className="nav__group">
          <span className="nav__group-label">System</span>
          <a className={activeRoute?.kind === 'audit' ? 'nav__link active' : 'nav__link'} href="#/audit-log">
            Audit Log
          </a>
        </section>
      ) : null}
    </>
  );
}

function RouteContent({
  auditLogEnabled,
  branding,
  navigation,
  pages,
  widgets,
  display,
  route,
  user,
  onTitleChange,
}: {
  auditLogEnabled: boolean;
  branding: AdminMetaResponse['branding'];
  navigation: NavigationGroup[];
  pages: CustomPageSchema[];
  widgets: WidgetSchema[];
  display: AdminMetaResponse['display'];
  route: AppRoute;
  user: AdminUser;
  onTitleChange: (label: string | null) => void;
}) {
  if (route.kind === 'home') {
    return (
      <DashboardPage
        key="dashboard"
        auditLogEnabled={auditLogEnabled}
        branding={branding}
        navigation={navigation}
        pages={pages}
        widgets={widgets}
        display={display}
        user={user}
        onTitleChange={onTitleChange}
      />
    );
  }

  if (route.kind === 'audit') {
    return <AuditLogPage key="audit-log" display={display} onTitleChange={onTitleChange} />;
  }

  if (route.kind === 'page') {
    return <CustomPage key={`page:${route.page.slug}`} page={route.page} onTitleChange={onTitleChange} />;
  }

  if (route.mode === 'list') {
    return (
      <ListPage
        key={`list:${route.resourceName}`}
        resource={route.resource}
        user={user}
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
      readOnly={route.mode === 'view' || !canWriteResource(route.resource, user)}
      onTitleChange={onTitleChange}
    />
  );
}

function groupNavigation(resources: ResourceSchema[], navItems: NavItemSchema[]): NavigationGroup[] {
  const groups = new Map<string, NavigationGroup>();

  for (const resource of resources) {
    const category = resource.category || 'General';
    const group = groups.get(category) ?? { category, resources: [], navItems: [] };
    group.resources.push(resource);
    groups.set(category, group);
  }

  for (const navItem of navItems) {
    const category = navItem.category || 'General';
    const group = groups.get(category) ?? { category, resources: [], navItems: [] };
    group.navItems.push(navItem);
    groups.set(category, group);
  }

  return [...groups.values()];
}

function describeRoute(route: AppRoute, subjectLabel: string | null) {
  return {
    category: route.kind === 'resource' ? route.resource.category : route.category,
    resourceName: route.resourceName,
    resourceHref: route.kind === 'page' ? `#/pages/${route.page.slug}` : `#/${route.resourceName}`,
    resourceLabel: route.kind === 'resource' ? route.resource.label : route.resourceLabel,
    pageLabel: getRoutePageLabel(route, subjectLabel),
  };
}

function getInitialRouteSubjectLabel(route: AppRoute): string | null {
  if (
    route.kind === 'home' ||
    route.kind === 'audit' ||
    route.kind === 'page' ||
    route.mode === 'list' ||
    route.mode === 'view'
  ) {
    return null;
  }

  if (route.mode === 'edit' || route.mode === 'password') {
    return route.id ?? null;
  }

  return route.deleteIds.length === 1 ? route.deleteIds[0] : `${route.deleteIds.length} items`;
}

function getRoutePageLabel(route: AppRoute, subjectLabel: string | null): string | null {
  if (route.kind === 'home') {
    return null;
  }

  if (route.kind === 'audit') {
    return null;
  }

  if (route.kind === 'page') {
    return null;
  }

  if (route.mode === 'list') {
    return null;
  }

  if (route.mode === 'edit') {
    return route.id ? `Edit ${subjectLabel ?? route.resource.label}` : `Add ${route.resource.label}`;
  }

  if (route.mode === 'view') {
    return subjectLabel ?? route.resource.label;
  }

  if (route.mode === 'password') {
    return `Change password for ${subjectLabel ?? route.resource.label}`;
  }

  return `Delete ${subjectLabel ?? route.resource.label}`;
}

function isActiveResourceRoute(route: AppRoute, resourceName: string): boolean {
  return route.kind === 'resource' && route.resourceName === resourceName;
}

function isActiveNavItemRoute(route: AppRoute, navItem: NavItemSchema): boolean {
  return navItem.kind === 'page' && route.kind === 'page' && route.page.slug === navItem.pageSlug;
}

function parseRoute(hash: string, resources: ResourceSchema[], pages: CustomPageSchema[]): AppRoute {
  const normalized = hash.replace(/^#\/?/, '');

  if (normalized === '' || normalized === 'home') {
    return {
      kind: 'home',
      category: 'Home',
      resourceName: 'dashboard',
      resourceLabel: 'Dashboard',
      pageLabel: null,
    };
  }

  if (normalized === 'audit-log') {
    return {
      kind: 'audit',
      category: 'System',
      resourceName: 'audit-log',
      resourceLabel: 'Audit Log',
      pageLabel: null,
    };
  }

  const segments = normalized.split('/');
  if (segments[0] === 'pages') {
    const resourceName = segments[1];
    const fallbackPage = pages[0];
    if (fallbackPage) {
      const page = pages.find((item) => item.slug === resourceName) ?? fallbackPage;
      return {
        kind: 'page',
        page,
        category: page.category,
        resourceName: page.slug,
        resourceLabel: page.label,
        pageLabel: null,
      };
    }
  }

  const [resourceName, mode, id, extra] = segments;
  const fallback = resources[0];
  if (!fallback) {
    const fallbackPage = pages[0];
    if (!fallbackPage) {
      return {
        kind: 'home',
        category: 'Home',
        resourceName: 'dashboard',
        resourceLabel: 'Dashboard',
        pageLabel: null,
      };
    }

    return {
      kind: 'page',
      page: fallbackPage,
      category: fallbackPage.category,
      resourceName: fallbackPage.slug,
      resourceLabel: fallbackPage.label,
      pageLabel: null,
    };
  }

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
    mode:
      mode === 'new' || mode === 'edit'
        ? ('edit' as const)
        : mode === 'view'
          ? ('view' as const)
          : ('list' as const),
    id: mode === 'edit' || mode === 'view' ? id : undefined,
    deleteIds: [] as string[],
  };
}
