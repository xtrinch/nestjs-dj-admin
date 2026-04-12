import { Injectable } from '@nestjs/common';
import { AdminResource } from '#src/admin/decorators/admin-resource.decorator.js';
import { userAdminOptions } from '../../../../shared/src/modules/user/shared.js';
import { User } from './user.entity.js';

@Injectable()
@AdminResource({
  model: User,
  ...userAdminOptions,
})
export class UserAdmin {}
