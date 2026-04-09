import { type Dispatch, type FormEvent, type SetStateAction, useEffect, useState } from 'react';
import { adminFetch, readJson } from '../api.js';
import type { ResourceField, ResourceSchema } from '../types.js';

type MetaResponse = {
  resource: ResourceSchema;
};

export function EditPage({
  resource,
  id,
  onTitleChange,
}: {
  resource: ResourceSchema;
  id?: string;
  onTitleChange?: (label: string) => void;
}) {
  const [fields, setFields] = useState<ResourceField[]>(resource.fields);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    void load();
  }, [resource.resourceName, id]);

  async function load() {
    const metaResponse = await adminFetch(`/_meta/${resource.resourceName}`);
    const metaJson = await readJson<MetaResponse>(metaResponse);
    setFields(metaJson.resource.fields);

    if (id) {
      const entityResponse = await adminFetch(`/${resource.resourceName}/${id}`);
      const entityJson = await readJson<Record<string, unknown>>(entityResponse);
      setValues(entityJson);
      onTitleChange?.(resolveEntityLabel(entityJson, id));
    } else {
      setValues({});
      onTitleChange?.('New');
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = normalizeValues(fields, values);
    const response = await adminFetch(
      id ? `/${resource.resourceName}/${id}` : `/${resource.resourceName}`,
      {
        method: id ? 'PATCH' : 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify(payload),
      },
    );

    if (!response.ok) {
      const json = (await response.json()) as {
        message?: string;
        errors?: Array<{ field: string; constraints?: Record<string, string> }>;
      };
      const nextErrors = Object.fromEntries(
        (json.errors ?? []).map((error) => [error.field, Object.values(error.constraints ?? {})[0] ?? 'Invalid value']),
      );
      setErrors(nextErrors);
      return;
    }

    window.location.hash = `#/${resource.resourceName}`;
  }

  return (
    <section className="panel">
      <header className="panel__header">
        <div>
          <span className="panel__eyebrow">{id ? 'Edit' : 'Create'}</span>
          <h2>{resource.label}</h2>
        </div>
        <a className="button" href={`#/${resource.resourceName}`}>
          Back to list
        </a>
      </header>

      <form className="form" onSubmit={submit}>
        {fields.map((field) => (
          <label className="field" key={field.name}>
            <span>{field.label}</span>
            <FieldInput field={field} values={values} setValues={setValues} />
            {errors[field.name] ? <small className="field__error">{errors[field.name]}</small> : null}
          </label>
        ))}
        <button className="button button--primary" type="submit">
          Save
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

function normalizeValues(
  fields: ResourceField[],
  values: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    fields.map((field) => [field.name, normalizeValue(field, values[field.name])]),
  );
}

function normalizeValue(field: ResourceField, value: unknown): unknown {
  if (value === '' || value === null || value === undefined) {
    return undefined;
  }

  if (field.input === 'checkbox') {
    return value === true || value === 'true';
  }

  if (field.input === 'number') {
    return typeof value === 'number' ? value : Number(value);
  }

  return value;
}

function FieldInput({
  field,
  values,
  setValues,
}: {
  field: ResourceField;
  values: Record<string, unknown>;
  setValues: Dispatch<SetStateAction<Record<string, unknown>>>;
}) {
  if (field.input === 'select') {
    return (
      <select
        className="input"
        disabled={field.readOnly}
        value={String(values[field.name] ?? '')}
        onChange={(event) =>
          setValues((current) => ({
            ...current,
            [field.name]: event.target.value,
          }))
        }
      >
        <option value="">Select {field.label}</option>
        {(field.enumValues ?? []).map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
      </select>
    );
  }

  if (field.input === 'checkbox') {
    return (
      <input
        className="checkbox"
        checked={Boolean(values[field.name])}
        disabled={field.readOnly}
        type="checkbox"
        onChange={(event) =>
          setValues((current) => ({
            ...current,
            [field.name]: event.target.checked,
          }))
        }
      />
    );
  }

  return (
    <input
      className="input"
      disabled={field.readOnly}
      type={field.input}
      value={String(values[field.name] ?? '')}
      onChange={(event) =>
        setValues((current) => ({
          ...current,
          [field.name]: event.target.value,
        }))
      }
    />
  );
}
