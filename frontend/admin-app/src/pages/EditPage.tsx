import { type Dispatch, type FormEvent, type SetStateAction, useEffect, useRef, useState } from 'react';
import { AdminApiError } from '../api.js';
import { formatAdminValue } from '../formatters.js';
import {
  createResourceEntity,
  getResourceEntity,
  getResourceMeta,
  lookupResource,
  runResourceAction,
  updateResourceEntity,
} from '../services/resources.service.js';
import { queueToast, showToast } from '../services/toast.service.js';
import type { AdminDisplayConfig, AdminLookupItem, ResourceField, ResourceSchema } from '../types.js';

const RELATION_LOOKUP_PAGE_SIZE = 20;
type SaveIntent = 'list' | 'continue' | 'add-another';

export function EditPage({
  resource,
  id,
  readOnly = false,
  onTitleChange,
}: {
  resource: ResourceSchema;
  id?: string;
  readOnly?: boolean;
  onTitleChange?: (label: string | null) => void;
}) {
  const [fields, setFields] = useState<ResourceField[]>(id ? resource.updateFields : resource.createFields);
  const [display, setDisplay] = useState<AdminDisplayConfig | null>(null);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [entityLabel, setEntityLabel] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState<string | null>(null);
  const [runningActionSlug, setRunningActionSlug] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, [resource.resourceName, id]);

  async function load() {
    const metaJson = await getResourceMeta(resource.resourceName);
    setFields(id ? metaJson.resource.updateFields : metaJson.resource.createFields);
    setDisplay(metaJson.display ?? null);
    setActionError(null);

    if (id) {
      const entityJson = await getResourceEntity(resource.resourceName, id);
      setValues(entityJson);
      const label = resolveEntityLabel(entityJson, id);
      setEntityLabel(label);
      onTitleChange?.(label);
    } else {
      setValues({});
      setEntityLabel(null);
      onTitleChange?.(null);
    }
  }

  async function runAction(action: { name: string; slug: string }) {
    if (!id || readOnly) {
      return;
    }

    setRunningActionSlug(action.slug);
    setActionError(null);

    try {
      await runResourceAction(resource.resourceName, id, action.slug);
      showToast({ message: `${resource.label} ${action.name.toLowerCase()}.` });
      await load();
    } catch (reason) {
      const message = (reason as Error).message;
      setActionError(message);
      showToast({ message, variant: 'error' });
    } finally {
      setRunningActionSlug(null);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (readOnly) {
      return;
    }
    const submitter = event.nativeEvent instanceof SubmitEvent ? event.nativeEvent.submitter : null;
    const intent = getSaveIntent(submitter);
    const payload = normalizeValues(fields, values);
    try {
      let result: Record<string, unknown>;
      let successMessage: string;
      if (id) {
        result = await updateResourceEntity(resource.resourceName, id, payload);
        successMessage = `${resource.label} saved.`;
      } else {
        result = await createResourceEntity(resource.resourceName, payload);
        successMessage = `${resource.label} created.`;
      }

      const nextId = String(result.id ?? id ?? '');

      if (intent === 'continue' && nextId) {
        showToast({ message: successMessage });
        setErrors({});

        if (id && nextId === id) {
          await load();
          return;
        }

        window.location.hash = `#/${resource.resourceName}/edit/${nextId}`;
        return;
      }

      if (intent === 'add-another') {
        showToast({ message: successMessage });
        setErrors({});
        setValues({});
        setEntityLabel(null);
        setActionError(null);
        onTitleChange?.(null);
        window.location.hash = `#/${resource.resourceName}/new`;
        return;
      }

      queueToast({ message: successMessage });
      window.location.hash = `#/${resource.resourceName}`;
    } catch (reason) {
      const json = reason instanceof AdminApiError ? reason : new AdminApiError('Invalid value', 400);
      const nextErrors = Object.fromEntries(
        (json.errors ?? []).map((error) => [error.field, Object.values(error.constraints ?? {})[0] ?? 'Invalid value']),
      );
      setErrors(nextErrors);
      if (Object.keys(nextErrors).length === 0) {
        setActionError(json.message);
        showToast({ message: json.message, variant: 'error' });
      }
    }
  }

  return (
    <section className="panel">
      <header className="panel__header">
        <div>
          <span className="panel__eyebrow">
            {readOnly ? `${resource.label} details` : id ? `Edit ${resource.label}` : `Add ${resource.label}`}
          </span>
          <div className="panel__title-row">
            <h2>
              {readOnly ? (entityLabel ?? resource.label) : id ? (entityLabel ?? resource.label) : `Add ${resource.label}`}
            </h2>
            {resource.softDelete?.enabled ? (
              <span className="resource-pill">Soft delete</span>
            ) : null}
            {readOnly ? <span className="resource-pill">Read only</span> : null}
          </div>
        </div>
        <div className="panel__actions">
          {id && !readOnly
            ? resource.actions.map((action) => (
                <button
                  key={action.slug}
                  className="button"
                  disabled={runningActionSlug !== null}
                  type="button"
                  onClick={() => void runAction(action)}
                >
                  {runningActionSlug === action.slug ? `${action.name}…` : action.name}
                </button>
              ))
            : null}
          {id && !readOnly ? (
            <a className="button button--danger" href={`#/${resource.resourceName}/delete/${id}`}>
              {resource.softDelete?.enabled ? `Archive this ${resource.label}` : `Delete this ${resource.label}`}
            </a>
          ) : null}
          <a className="button" href={`#/${resource.resourceName}`}>
            Back to list
          </a>
        </div>
      </header>

      {readOnly ? <p className="field__hint">You can view this record, but your role does not have write access.</p> : null}
      {actionError ? <p className="field__error">{actionError}</p> : null}

      <form className="form" onSubmit={submit}>
        {id && resource.password?.enabled && !readOnly ? (
          <div className="field">
            <span className="field__label">Password</span>
            <div className="readonly-field">
              <span className="readonly-field__value">Not settable from this form</span>
            </div>
            {resource.password.helpText ? <small className="field__hint">{resource.password.helpText}</small> : null}
            <div className="field__actions">
              <a className="button" href={`#/${resource.resourceName}/edit/${id}/password`}>
                Change password
              </a>
            </div>
          </div>
        ) : null}
        {fields.map((field) => (
          <label className={`field${field.input === 'checkbox' ? ' field--checkbox' : ''}`} key={field.name}>
            <span className="field__label">{field.label}</span>
            <FieldInput field={field} values={values} setValues={setValues} display={display} readOnly={readOnly} />
            {field.helpText ? <small className="field__hint">{field.helpText}</small> : null}
            {errors[field.name] ? <small className="field__error">{errors[field.name]}</small> : null}
          </label>
        ))}
        {!readOnly ? (
          <div className="form__actions">
            <button className="button button--primary" name="intent" type="submit" value="list">
              Save
            </button>
            <button className="button" name="intent" type="submit" value="continue">
              Save and continue editing
            </button>
            <button className="button" name="intent" type="submit" value="add-another">
              Save and add another
            </button>
          </div>
        ) : null}
      </form>
    </section>
  );
}

function getSaveIntent(submitter: EventTarget | null): SaveIntent {
  if (!(submitter instanceof HTMLButtonElement)) {
    return 'list';
  }

  const value = submitter.value;
  if (value === 'continue' || value === 'add-another') {
    return value;
  }

  return 'list';
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

  if (field.input === 'date') {
    return typeof value === 'string' ? value : String(value);
  }

  if (field.input === 'time') {
    return typeof value === 'string' ? value : String(value);
  }

  if (field.input === 'datetime-local') {
    return typeof value === 'string' ? value : value instanceof Date ? value.toISOString() : String(value);
  }

  return value;
}

function FieldInput({
  field,
  values,
  setValues,
  display,
  readOnly = false,
}: {
  field: ResourceField;
  values: Record<string, unknown>;
  setValues: Dispatch<SetStateAction<Record<string, unknown>>>;
  display: AdminDisplayConfig | null;
  readOnly?: boolean;
}) {
  if (field.readOnly || readOnly) {
    return (
      <div className="readonly-field">
        <span className="readonly-field__value">
          {formatReadonlyValue(values[field.name], field.name, display ?? undefined)}
        </span>
      </div>
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

  if (field.input === 'textarea') {
    return (
      <textarea
        className="input textarea"
        rows={5}
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

  return (
    <input
      className="input"
      type={field.input}
      value={
        field.input === 'date'
          ? normalizeDateInputValue(values[field.name])
          : field.input === 'time'
            ? normalizeTimeInputValue(values[field.name])
          : field.input === 'datetime-local'
            ? normalizeDateTimeInputValue(values[field.name])
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

function formatReadonlyValue(
  value: unknown,
  fieldName: string,
  display: AdminDisplayConfig | undefined,
): string {
  const formatted = formatAdminValue(value, fieldName, display);
  return formatted === '' ? 'Not set' : formatted;
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

function normalizeDateInputValue(value: unknown): string {
  if (typeof value !== 'string') {
    return value instanceof Date ? value.toISOString().slice(0, 10) : '';
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
    return value.slice(0, 10);
  }

  return value;
}

function normalizeDateTimeInputValue(value: unknown): string {
  if (value instanceof Date) {
    return toDateTimeLocal(value.toISOString());
  }

  if (typeof value !== 'string') {
    return '';
  }

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
    return value;
  }

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
    return value.slice(0, 16);
  }

  return value;
}

function toDateTimeLocal(value: string): string {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value) ? value.slice(0, 16) : value;
}

function normalizeTimeInputValue(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }

  if (/^\d{2}:\d{2}$/.test(value)) {
    return value;
  }

  if (/^\d{2}:\d{2}:\d{2}/.test(value)) {
    return value.slice(0, 5);
  }

  return value;
}
