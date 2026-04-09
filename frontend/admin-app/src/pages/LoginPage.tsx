import { type FormEvent, useState } from 'react';
import { adminFetch } from '../api.js';

export function LoginPage({ onAuthenticated }: { onAuthenticated: () => Promise<void> }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await adminFetch('/_auth/login', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        throw new Error('Invalid admin credentials');
      }

      await onAuthenticated();
    } catch (reason) {
      setError((reason as Error).message);
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
        <form className="form" onSubmit={submit}>
          <label className="field">
            <span>Email</span>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
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
