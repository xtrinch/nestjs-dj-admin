import { useEffect } from 'react';
import { adminUrl } from '../api.js';
import type { AdminAuthConfig } from '../types.js';

export function ExternalAuthPage({ config }: { config: AdminAuthConfig }) {
  const loginHref = config.loginUrl ? new URL(config.loginUrl, adminUrl('/')).toString() : null;

  useEffect(() => {
    if (!loginHref) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      window.location.assign(loginHref);
    }, 900);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [loginHref]);

  return (
    <div className="shell shell--auth">
      <main className="auth-card">
        <span className="panel__eyebrow">{config.branding.siteTitle}</span>
        <h1>{config.branding.siteHeader}</h1>
        <p className="auth-card__copy">
          {loginHref
            ? 'Redirecting to sign in...'
            : config.loginMessage ?? 'This admin uses the host application authentication flow.'}
        </p>
        {loginHref ? (
          <>
            {config.loginMessage ? <p className="auth-card__copy">{config.loginMessage}</p> : null}
            <p>
            <a className="button button--primary" href={loginHref}>
              Continue to sign in
            </a>
            </p>
          </>
        ) : (
          <p className="auth-card__copy">Sign in through the main application, then reload this page.</p>
        )}
      </main>
    </div>
  );
}
