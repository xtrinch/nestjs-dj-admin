import { type FormEvent, useState } from 'react';
import { loginAdminWithOptions } from '../services/auth.service.js';
import { showToast } from '../services/toast.service.js';

const REMEMBERED_EMAIL_KEY = 'dj-admin.remembered-email';

export function LoginPage({ onAuthenticated }: { onAuthenticated: () => Promise<void> }) {
  const [email, setEmail] = useState(() => window.localStorage.getItem(REMEMBERED_EMAIL_KEY) ?? '');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(() => Boolean(window.localStorage.getItem(REMEMBERED_EMAIL_KEY)));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await loginAdminWithOptions(email, password, rememberMe);
      if (rememberMe && email.trim()) {
        window.localStorage.setItem(REMEMBERED_EMAIL_KEY, email.trim());
      } else {
        window.localStorage.removeItem(REMEMBERED_EMAIL_KEY);
      }
      await onAuthenticated();
    } catch (reason) {
      const message = (reason as Error).message;
      setError(message);
      showToast({ message, variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="shell shell--auth">
      <main className="auth-card">
        <span className="panel__eyebrow">Admin Login</span>
        <h1>DJ Admin</h1>
        <p className="auth-card__copy">Sign in with an admin user from your application.</p>
        <form autoComplete="on" className="form" onSubmit={submit}>
          <label className="field">
            <span>Email</span>
            <input
              autoComplete="username"
              className="input"
              name="username"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              autoComplete="current-password"
              className="input"
              name="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <label className="field">
            <span>
              <input
                checked={rememberMe}
                className="checkbox"
                type="checkbox"
                onChange={(event) => {
                  const checked = event.target.checked;
                  setRememberMe(checked);
                  if (!checked) {
                    window.localStorage.removeItem(REMEMBERED_EMAIL_KEY);
                  }
                }}
              />{' '}
              Remember me
            </span>
          </label>
          {error ? <small className="field__error">{error}</small> : null}
          <button className="button button--primary" disabled={submitting} type="submit">
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </main>
    </div>
  );
}
