import { type Dispatch, type FormEvent, type SetStateAction, useEffect, useRef, useState } from 'react';
import { AdminApiError } from '../api.js';
import { formatAdminValue } from '../formatters.js';
import {
  createResourceEntity,
  getResourceEntity,
  getResourceMeta,
  lookupResource,
  updateResourceEntity,
} from '../services/resources.service.js';
import type { AdminDisplayConfig, AdminLookupItem, ResourceField, ResourceSchema } from '../types.js';

const RELATION_LOOKUP_PAGE_SIZE = 20;

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
        <div className="panel__actions">
          {id ? (
            <a className="button button--danger" href={`#/${resource.resourceName}/delete/${id}`}>
              Delete
            </a>
          ) : null}
          <a className="button" href={`#/${resource.resourceName}`}>
            Back to list
          </a>
        </div>
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
    fields
      .filter((field) => !field.readOnly)
      .map((field) => [field.name, normalizeValue(field, values[field.name])]),
  );
}

function normalizeValue(field: ResourceField, value: unknown): unknown {
  if (field.input === 'multiselect') {
    const arr = Array.isArray(value) ? value : [];
    return arr
      .map((item) => getRelationValue(field, item))
      .filter((item): item is string => item !== null);
  }

  if (field.relation) {
    return getRelationValue(field, value) ?? undefined;
  }

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
  if (field.readOnly) {
    return (
      <input
        className="input"
        disabled
        readOnly
        type="text"
        value={formatAdminValue(values[field.name], field.name, display ?? undefined)}
      />
    );
  }

  if (field.relation) {
    return (
      <RelationFieldInput
        field={field}
        values={values}
        setValues={setValues}
      />
    );
  }

  if (field.input === 'select') {
    return (
      <select
        className="input"
        value={String(values[field.name] ?? '')}
        onChange={(event) =>
          setValues((current) => ({
            ...current,
            [field.name]: event.target.value,
          }))
        }
      >
        <option value="">---------</option>
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

function RelationFieldInput({
  field,
  values,
  setValues,
}: {
  field: ResourceField;
  values: Record<string, unknown>;
  setValues: Dispatch<SetStateAction<Record<string, unknown>>>;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<AdminLookupItem[]>([]);
  const [selectedCache, setSelectedCache] = useState<Record<string, AdminLookupItem>>({});
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const selectedValues = getSelectedRelationValues(field, values[field.name]);
  const selectedOptions = selectedValues
    .map((value) => selectedCache[value] ?? options.find((option) => option.value === value) ?? { value, label: value });

  useEffect(() => {
    if (!open) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void search();
    }, 180);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [field.name, field.relation?.option.resource, query, open]);

  useEffect(() => {
    if (selectedValues.length === 0) {
      return;
    }

    const missing = selectedValues.filter(
      (value) => !selectedCache[value],
    );

    if (missing.length === 0) {
      return;
    }

    void hydrateSelected(missing);
  }, [field.name, field.relation?.option.resource, selectedValues.join(','), options]);

  useEffect(() => {
    if (!open) {
      setQuery('');
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', onPointerDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, [open]);

  async function search() {
    if (!field.relation) {
      return;
    }

    setLoading(true);
    try {
      const response = await lookupResource(field.relation.option.resource, {
        page: 1,
        pageSize: RELATION_LOOKUP_PAGE_SIZE,
        q: query.trim() || undefined,
      });
      setOptions(response.items);
      setLoaded(true);
    } finally {
      setLoading(false);
    }
  }

  async function hydrateSelected(ids: string[]) {
    if (!field.relation) {
      return;
    }

    const response = await lookupResource(field.relation.option.resource, {
      ids,
      page: 1,
      pageSize: ids.length,
    });
    setSelectedCache((current) => ({
      ...current,
      ...Object.fromEntries(response.items.map((item) => [item.value, item])),
    }));
  }

  if (field.input === 'multiselect') {
    return (
      <div className="relation-picker" ref={rootRef}>
        {selectedOptions.length > 0 ? (
          <div className="relation-picker__selected">
            {selectedOptions.map((option) => (
              <button
                key={option.value}
                className="relation-pill"
                type="button"
                onClick={() =>
                  setValues((current) => ({
                    ...current,
                    [field.name]: selectedValues.filter((value) => value !== option.value),
                  }))
                }
              >
                {option.label} ×
              </button>
            ))}
          </div>
        ) : null}
        <button
          className="input relation-picker__trigger"
          type="button"
          onClick={() => setOpen((current) => !current)}
        >
          <span>{selectedOptions.length > 0 ? `${selectedOptions.length} selected` : `Select ${field.label.toLowerCase()}`}</span>
          <span>{open ? '▲' : '▼'}</span>
        </button>
        {open ? (
          <div className="relation-picker__dropdown">
            <input
              autoFocus
              className="input"
              placeholder={`Search ${field.label.toLowerCase()}`}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <div className={`relation-picker__results${loading ? ' relation-picker__results--loading' : ''}`}>
              {options.map((option) => (
                <label className="relation-option" key={option.value}>
                  <input
                    checked={selectedValues.includes(option.value)}
                    className="checkbox"
                    type="checkbox"
                    onChange={(event) =>
                      setValues((current) => ({
                        ...current,
                        [field.name]: event.target.checked
                          ? [...selectedValues, option.value]
                          : selectedValues.filter((value) => value !== option.value),
                      }))
                    }
                  />
                  <span>{option.label}</span>
                </label>
              ))}
              {!loading && loaded && options.length === 0 ? (
                <div className="relation-picker__empty">No matches found.</div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="relation-picker" ref={rootRef}>
      <button
        className="input relation-picker__trigger"
        type="button"
        onClick={() => setOpen((current) => !current)}
      >
        <span>{selectedOptions[0]?.label ?? `Select ${field.label.toLowerCase()}`}</span>
        <span>{open ? '▲' : '▼'}</span>
      </button>
      {open ? (
        <div className="relation-picker__dropdown">
          <input
            autoFocus
            className="input"
            placeholder={`Search ${field.label.toLowerCase()}`}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className={`relation-picker__results${loading ? ' relation-picker__results--loading' : ''}`}>
            <button
              className="relation-option relation-option--button"
              type="button"
              onClick={() => {
                setValues((current) => ({
                  ...current,
                  [field.name]: '',
                }));
                setOpen(false);
              }}
            >
              ---------
            </button>
            {options.map((option) => (
              <button
                key={option.value}
                className="relation-option relation-option--button"
                type="button"
                onClick={() => {
                  setValues((current) => ({
                    ...current,
                    [field.name]: option.value,
                  }));
                  setOpen(false);
                }}
              >
                {option.label}
              </button>
            ))}
            {!loading && loaded && options.length === 0 ? (
              <div className="relation-picker__empty">No matches found.</div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function getSelectedRelationValues(field: ResourceField, rawValue: unknown): string[] {
  if (field.input === 'multiselect') {
    return Array.isArray(rawValue)
      ? rawValue
          .map((value) => getRelationValue(field, value))
          .filter((value): value is string => value !== null)
      : [];
  }

  const selectedValue = getRelationValue(field, rawValue);
  if (selectedValue === null) {
    return [];
  }

  return [selectedValue];
}

function getRelationValue(field: ResourceField, rawValue: unknown): string | null {
  if (rawValue === null || rawValue === undefined || rawValue === '') {
    return null;
  }

  if (typeof rawValue === 'object') {
    const valueField = field.relation?.option.valueField ?? 'id';
    const candidate = (rawValue as Record<string, unknown>)[valueField];
    if (candidate === null || candidate === undefined || candidate === '') {
      return null;
    }

    return String(candidate);
  }

  return String(rawValue);
}

function mergeLookupOptions(current: AdminLookupItem[], incoming: AdminLookupItem[]): AdminLookupItem[] {
  const merged = new Map(current.map((item) => [item.value, item]));

  for (const item of incoming) {
    merged.set(item.value, item);
  }

  return [...merged.values()];
}
