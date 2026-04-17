import { adminUrl } from '../api.js';
import type { AdminAuthConfig } from '../types.js';

export function ExternalAuthPage({ config }: { config: AdminAuthConfig }) {
  const loginHref = config.loginUrl ? new URL(config.loginUrl, adminUrl('/')).toString() : null;

  return (
    <div className="shell shell--auth">
      <main className="auth-card">
        <span className="panel__eyebrow">Admin Login</span>
        <h1>DJ Admin</h1>
        <p className="auth-card__copy">
          {config.loginMessage ?? 'This admin uses the host application authentication flow.'}
        </p>
        {loginHref ? (
          <p>
            <a className="button button--primary" href={loginHref}>
              Continue to sign in
            </a>
          </p>
        ) : (
          <p className="auth-card__copy">Sign in through the main application, then reload this page.</p>
        )}
      </main>
    </div>
  );
}
