import { useEffect, useState } from 'react';
import { formatAdminValue } from '../formatters.js';
import { canWriteResource } from '../permissions.js';
import { getAuditLog, listResource } from '../services/resources.service.js';
import { showToast } from '../services/toast.service.js';
import type {
  AdminAuditEntry,
  AdminBrandingConfig,
  AdminDisplayConfig,
  AdminUser,
  CustomPageSchema,
  NavItemSchema,
  ResourceSchema,
  WidgetSchema,
} from '../types.js';

type NavigationGroup = {
  category: string;
  resources: ResourceSchema[];
  navItems: NavItemSchema[];
};

type DashboardCounts = Record<string, number>;

export function DashboardPage({
  navigation,
  pages,
  widgets,
  display,
  auditLogEnabled,
  branding,
  user,
  onTitleChange,
}: {
  navigation: NavigationGroup[];
  pages: CustomPageSchema[];
  widgets: WidgetSchema[];
  display: AdminDisplayConfig;
  auditLogEnabled: boolean;
  branding: AdminBrandingConfig;
  user: AdminUser;
  onTitleChange?: (label: string | null) => void;
}) {
  const [counts, setCounts] = useState<DashboardCounts>({});
  const [recentActivity, setRecentActivity] = useState<AdminAuditEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onTitleChange?.(null);
  }, [onTitleChange]);

  useEffect(() => {
    void load();
  }, [auditLogEnabled, navigation.map((group) => group.category).join('|')]);

  async function load() {
    try {
      const resources = navigation.flatMap((group) => group.resources);
      const [countEntries, auditEntries] = await Promise.all([
        Promise.all(
          resources.map(async (resource) => {
            const response = await listResource(resource.resourceName, {
              page: 1,
              pageSize: 1,
            });

            return [resource.resourceName, response.total] as const;
          }),
        ),
        auditLogEnabled
          ? getAuditLog({ page: 1, pageSize: 6 }).then((response) => response.items)
          : Promise.resolve([] as AdminAuditEntry[]),
      ]);

      setCounts(Object.fromEntries(countEntries));
      setRecentActivity(auditEntries);
      setError(null);
    } catch (reason) {
      const message = (reason as Error).message;
      setError(message);
      showToast({ message, variant: 'error' });
    }
  }

  if (error) {
    return <section>Failed to load dashboard: {error}</section>;
  }

  return (
    <section className="dashboard">
      <section className="panel dashboard__hero">
        <span className="panel__eyebrow">Overview</span>
        <div className="panel__title-row">
          <h2>{branding.indexTitle}</h2>
        </div>
        <p className="dashboard__copy">
          Browse registered resources for {branding.siteHeader} and jump straight into common admin work.
        </p>
      </section>

      <div className="dashboard__grid">
        <section className="panel dashboard__resources">
          <header className="dashboard__section-header">
            <span className="panel__eyebrow">Applications</span>
            <h3>Manage data</h3>
          </header>
          <div className="dashboard__categories">
            {navigation
              .filter((group) => group.resources.length > 0)
              .map((group) => (
              <section key={group.category} className="dashboard__category">
                <h4>{group.category}</h4>
                <div className="dashboard__cards">
                  {group.resources.map((resource) => (
                    <article key={resource.resourceName} className="dashboard-card">
                      <div className="dashboard-card__meta">
                        <span className="dashboard-card__count">{counts[resource.resourceName] ?? 0}</span>
                        <span className="dashboard-card__label">
                          {counts[resource.resourceName] === 1 ? 'record' : 'records'}
                        </span>
                      </div>
                      <h5>{resource.label}</h5>
                      <p>
                        Search by {resource.search.join(', ') || 'configured fields'} and open the full changelist.
                      </p>
                      <div className="dashboard-card__actions">
                        <a className="button" href={`#/${resource.resourceName}`}>
                          View {resource.label}
                        </a>
                        {canWriteResource(resource, user) ? (
                          <a className="button button--primary" href={`#/${resource.resourceName}/new`}>
                            Add {resource.label}
                          </a>
                        ) : null}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </section>

        <section className="panel dashboard__resources">
          <header className="dashboard__section-header">
            <span className="panel__eyebrow">Extensions</span>
            <h3>Open tools</h3>
          </header>
          <div className="dashboard__categories">
            {widgets.length > 0 ? (
              <div className="dashboard__cards">
                {widgets.map((widget) => (
                  <article key={widget.key} className="dashboard-card">
                    <div className="dashboard-card__meta">
                      <span className="dashboard-card__label">Extension</span>
                    </div>
                    <h5>{widget.title}</h5>
                    <p>{widget.description ?? 'Open an extension-provided admin tool.'}</p>
                    <div className="dashboard-card__actions">
                      <a
                        className="button button--primary"
                        href={resolveWidgetHref(widget, pages)}
                      >
                        {widget.ctaLabel ?? 'Open'}
                      </a>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="dashboard__empty">No extension widgets are configured for this admin.</p>
            )}
          </div>
        </section>

        <section className="panel dashboard__activity">
          <header className="dashboard__section-header">
            <span className="panel__eyebrow">System</span>
            <h3>Recent activity</h3>
          </header>
          {auditLogEnabled ? (
            recentActivity.length > 0 ? (
              <div className="dashboard-activity">
                {recentActivity.map((entry) => (
                  <article key={entry.id} className="dashboard-activity__item">
                    <div className="dashboard-activity__time">
                      {formatAdminValue(entry.timestamp, 'createdAt', display)}
                    </div>
                    <div className="dashboard-activity__summary">{entry.summary}</div>
                    <div className="dashboard-activity__actor">{entry.actor.email ?? entry.actor.id}</div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="dashboard__empty">No admin activity recorded yet.</p>
            )
          ) : (
            <p className="dashboard__empty">Audit log is disabled for this admin.</p>
          )}
          {auditLogEnabled ? (
            <div className="dashboard__footer">
              <a className="button" href="#/audit-log">
                Open audit log
              </a>
            </div>
          ) : null}
        </section>
      </div>
    </section>
  );
}

function resolveWidgetHref(widget: WidgetSchema, pages: CustomPageSchema[]): string {
  if (widget.kind === 'href') {
    return widget.href;
  }

  if (widget.kind === 'route') {
    return `#${widget.route}`;
  }

  const page = pages.find((entry) => entry.slug === widget.pageSlug);
  return page ? `#${page.route}` : '#';
}
