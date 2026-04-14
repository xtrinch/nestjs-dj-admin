import { BadRequestException, Injectable } from '@nestjs/common';
import { AdminResource } from '#src/admin/decorators/admin-resource.decorator.js';
import { userAdminOptions } from '../../../../shared/src/modules/user/shared.js';
import { hashPassword } from '../../auth/password.js';
import { User } from './user.entity.js';

@Injectable()
@AdminResource({
  model: User,
  ...userAdminOptions,
  password: {
    hash: hashPassword,
    helpText:
      'Raw passwords are not stored, so there is no way to see this user’s password. You can change the password using the dedicated form.',
  },
  transformCreate: async (payload) => {
    const password = String(payload.password ?? '');
    const passwordConfirm = String(payload.passwordConfirm ?? '');

    if (!password.trim()) {
      throw new BadRequestException({
        message: 'Validation failed',
        errors: [{ field: 'password', constraints: { isDefined: 'Password is required' } }],
      });
    }

    if (password !== passwordConfirm) {
      throw new BadRequestException({
        message: 'Validation failed',
        errors: [{ field: 'passwordConfirm', constraints: { matches: 'Passwords do not match' } }],
      });
    }

    const next = { ...payload };
    delete next.password;
    delete next.passwordConfirm;

    return {
      ...next,
      passwordHash: hashPassword(password),
    };
  },
})
export class UserAdmin {}
