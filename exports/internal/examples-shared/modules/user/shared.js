import { existsSync } from 'node:fs';

const moduleRef = existsSync(new URL('../../../../../dist/examples/shared/src/modules/user/shared.js', import.meta.url))
  ? await import('../../../../../dist/examples/shared/src/modules/user/shared.js')
  : await import('../../../../../examples/shared/src/modules/user/shared.ts');

export const Role = moduleRef.Role;
export const CreateUserDto = moduleRef.CreateUserDto;
export const UpdateUserDto = moduleRef.UpdateUserDto;
export const userAdminOptions = moduleRef.userAdminOptions;
