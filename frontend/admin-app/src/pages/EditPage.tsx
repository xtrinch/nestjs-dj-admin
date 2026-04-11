import { type Dispatch, type FormEvent, type SetStateAction, useEffect, useState } from 'react';
import { AdminApiError } from '../api.js';
import { formatAdminValue } from '../formatters.js';
import {
  createResourceEntity,
  getResourceEntity,
  getResourceMeta,
  updateResourceEntity,
} from '../services/resources.service.js';
import type { AdminDisplayConfig, ResourceField, ResourceSchema } from '../types.js';

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
  const [display, setDisplay] = useState<AdminDisplayConfig | null>(null);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    void load();
  }, [resource.resourceName, id]);

  async function load() {
    const metaJson = await getResourceMeta(resource.resourceName);
    setFields(metaJson.resource.fields);
    setDisplay(metaJson.display ?? null);

    if (id) {
      const entityJson = await getResourceEntity(resource.resourceName, id);
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
    try {
      if (id) {
        await updateResourceEntity(resource.resourceName, id, payload);
      } else {
        await createResourceEntity(resource.resourceName, payload);
      }

      window.location.hash = `#/${resource.resourceName}`;
    } catch (reason) {
      const json = reason instanceof AdminApiError ? reason : new AdminApiError('Invalid value', 400);
      const nextErrors = Object.fromEntries(
        (json.errors ?? []).map((error) => [error.field, Object.values(error.constraints ?? {})[0] ?? 'Invalid value']),
      );
      setErrors(nextErrors);
    }
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
            <FieldInput field={field} values={values} setValues={setValues} display={display} />
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
  display,
}: {
  field: ResourceField;
  values: Record<string, unknown>;
  setValues: Dispatch<SetStateAction<Record<string, unknown>>>;
  display: AdminDisplayConfig | null;
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
      value={
        field.readOnly && display
          ? formatAdminValue(values[field.name], field.name, display)
          : String(values[field.name] ?? '')
      }
      onChange={(event) =>
        setValues((current) => ({
          ...current,
          [field.name]: event.target.value,
        }))
      }
    />
  );
}
