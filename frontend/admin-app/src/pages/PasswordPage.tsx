import { type FormEvent, useEffect, useState } from 'react';
import { AdminApiError } from '../api.js';
import { changeResourcePassword, getResourceEntity } from '../services/resources.service.js';
import { queueToast, showToast } from '../services/toast.service.js';
import type { ResourceSchema } from '../types.js';

export function PasswordPage({
  resource,
  id,
  onTitleChange,
}: {
  resource: ResourceSchema;
  id: string;
  onTitleChange?: (label: string) => void;
}) {
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    void load();
  }, [resource.resourceName, id]);

  async function load() {
    const entityJson = await getResourceEntity(resource.resourceName, id);
    onTitleChange?.(resolveEntityLabel(entityJson, id));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors: Record<string, string> = {};

    if (!password.trim()) {
      nextErrors.password = 'Password is required';
    }

    if (!passwordConfirm.trim()) {
      nextErrors.passwordConfirm = 'Password confirmation is required';
    } else if (password !== passwordConfirm) {
      nextErrors.passwordConfirm = 'Passwords do not match';
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    try {
      await changeResourcePassword(resource.resourceName, id, {
        password,
        passwordConfirm,
      });
      queueToast({ message: `${resource.label} password updated.` });
      window.location.hash = `#/${resource.resourceName}/edit/${id}`;
    } catch (reason) {
      const json = reason instanceof AdminApiError ? reason : new AdminApiError('Invalid value', 400);
      const nextErrors = Object.fromEntries(
        (json.errors ?? []).map((error) => [
          error.field,
          Object.values(error.constraints ?? {})[0] ?? 'Invalid value',
        ]),
      );
      setErrors(nextErrors);
      if (Object.keys(nextErrors).length === 0) {
        showToast({ message: json.message, variant: 'error' });
      }
    }
  }

  return (
    <section className="panel">
      <header className="panel__header">
        <div>
          <span className="panel__eyebrow">Change password</span>
          <h2>{resource.label}</h2>
        </div>
        <div className="panel__actions">
          <a className="button" href={`#/${resource.resourceName}/edit/${id}`}>
            Back to edit
          </a>
        </div>
      </header>

      <form className="form" onSubmit={(event) => void submit(event)}>
        <label className="field">
          <span>New password</span>
          <input
            autoComplete="new-password"
            className="input"
            name="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {errors.password ? <small className="field__error">{errors.password}</small> : null}
        </label>
        <label className="field">
          <span>Confirm password</span>
          <input
            autoComplete="new-password"
            className="input"
            name="passwordConfirm"
            type="password"
            value={passwordConfirm}
            onChange={(event) => setPasswordConfirm(event.target.value)}
          />
          {errors.passwordConfirm ? <small className="field__error">{errors.passwordConfirm}</small> : null}
        </label>
        <button className="button button--primary" type="submit">
          Change password
        </button>
      </form>
    </section>
  );
}

function resolveEntityLabel(entity: Record<string, unknown>, fallback: string): string {
  const candidates = ['email', 'name', 'title', 'number', 'slug', 'id'];

  for (const key of candidates) {
    const value = entity[key];
    if (typeof value === 'string' && value.trim()) {
      return value;
    }

    if (typeof value === 'number') {
      return String(value);
    }
  }

  return fallback;
}
