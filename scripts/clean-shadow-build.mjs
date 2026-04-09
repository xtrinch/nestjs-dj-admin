import { readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';

const root = new URL('../src', import.meta.url);
const removableExtensions = new Set(['.js', '.js.map']);

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      await walk(fullPath);
      continue;
    }

    if ([...removableExtensions].some((extension) => entry.name.endsWith(extension))) {
      await rm(fullPath, { force: true });
    }
  }
}

const sourceDir = path.resolve(root.pathname);

try {
  const sourceStats = await stat(sourceDir);
  if (sourceStats.isDirectory()) {
    await walk(sourceDir);
  }
} catch (error) {
  if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
    process.exit(0);
  }

  throw error;
}
