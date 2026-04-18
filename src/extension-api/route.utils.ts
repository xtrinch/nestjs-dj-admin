export interface MatchRouteResult {
  params: Record<string, string>;
}

export function normalizeExtensionRoute(route: string): string {
  if (!route.trim()) {
    return '/';
  }

  const normalized = route.startsWith('/') ? route : `/${route}`;
  if (normalized.length > 1 && normalized.endsWith('/')) {
    return normalized.slice(0, -1);
  }

  return normalized;
}

export function matchExtensionRoute(pattern: string, path: string): MatchRouteResult | null {
  const normalizedPattern = normalizeExtensionRoute(pattern);
  const normalizedPath = normalizeExtensionRoute(path);
  const patternSegments = normalizedPattern.split('/').filter(Boolean);
  const pathSegments = normalizedPath.split('/').filter(Boolean);

  if (patternSegments.length !== pathSegments.length) {
    return null;
  }

  const params: Record<string, string> = {};
  for (const [index, segment] of patternSegments.entries()) {
    const value = pathSegments[index] ?? '';
    if (segment.startsWith(':')) {
      params[segment.slice(1)] = decodeURIComponent(value);
      continue;
    }

    if (segment !== value) {
      return null;
    }
  }

  return { params };
}
