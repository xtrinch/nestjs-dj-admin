export function pascalToKebab(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/_/g, '-')
    .toLowerCase();
}

export function pluralize(value: string): string {
  if (value.endsWith('y')) {
    return `${value.slice(0, -1)}ies`;
  }

  if (value.endsWith('s')) {
    return `${value}es`;
  }

  return `${value}s`;
}

export function buildResourceName(modelName: string): string {
  return pluralize(pascalToKebab(modelName));
}

export function actionSlug(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '-');
}
