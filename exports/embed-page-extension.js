import { existsSync } from 'node:fs';

const embedModule = existsSync(new URL('../dist/extensions/embed/index.js', import.meta.url))
  ? await import('../dist/extensions/embed/index.js')
  : await import('../src/extensions/embed/index.ts');

export const embedPageExtension = embedModule.embedPageExtension;
