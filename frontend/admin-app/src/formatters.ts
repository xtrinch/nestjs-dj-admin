import type { AdminDisplayConfig } from './types.js';

const DEFAULT_DISPLAY: AdminDisplayConfig = {
  locale: 'en-US',
  dateFormat: {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  },
  dateTimeFormat: {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  },
};

export function formatAdminValue(
  value: unknown,
  fieldName: string,
  display?: AdminDisplayConfig,
): string {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }

  if (typeof value === 'string' && isIsoDateString(value)) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    const resolvedDisplay = display ?? DEFAULT_DISPLAY;

    const formatter = looksLikeDateOnlyField(fieldName)
      ? new Intl.DateTimeFormat(resolvedDisplay.locale, resolvedDisplay.dateFormat)
      : new Intl.DateTimeFormat(resolvedDisplay.locale, resolvedDisplay.dateTimeFormat);

    return formatter.format(date);
  }

  return String(value);
}

function isIsoDateString(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}(T|\b)/.test(value);
}

function looksLikeDateOnlyField(fieldName: string): boolean {
  return /date$/i.test(fieldName) && !/at$/i.test(fieldName);
}
