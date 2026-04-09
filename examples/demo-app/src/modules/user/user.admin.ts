import { Injectable } from '@nestjs/common';
import { AdminResource } from '#src/admin/decorators/admin-resource.decorator.js';
import { CreateUserDto, UpdateUserDto } from './user.dto.js';
import { Role, User } from './user.entity.js';

@Injectable()
@AdminResource({
  model: User,
  category: 'Accounts',
  list: ['email', 'role', 'active', 'createdAt'],
  search: ['email'],
  filters: ['role', 'active'],
  readonly: ['createdAt'],
  permissions: {
    read: ['admin'],
    write: ['admin'],
  },
  createDto: CreateUserDto,
  updateDto: UpdateUserDto,
  actions: [
    {
      name: 'Deactivate',
      handler: async (entity, context) => {
        if (!entity.id) {
          return;
        }

        return context.adapter.update(context.resource, String(entity.id), {
          active: false,
          role: (entity.role as Role) ?? Role.VIEWER,
        });
      },
    },
  ],
})
export class UserAdmin {}
