import { existsSync } from 'node:fs';

const moduleRef = existsSync(new URL('../../../../dist/examples/shared/src/auth/password.js', import.meta.url))
  ? await import('../../../../dist/examples/shared/src/auth/password.js')
  : await import('../../../../examples/shared/src/auth/password.ts');

export const hashPassword = moduleRef.hashPassword;
export const verifyPassword = moduleRef.verifyPassword;
