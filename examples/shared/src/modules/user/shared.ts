import type { AdminResourceOptions } from '#src/admin/types/admin.types.js';
import { IsBoolean, IsEmail, IsEnum, IsOptional } from 'class-validator';

export enum Role {
  ADMIN = 'admin',
  EDITOR = 'editor',
  VIEWER = 'viewer',
}

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsEnum(Role)
  role!: Role;

  @IsBoolean()
  @IsOptional()
  active?: boolean;
}

export class UpdateUserDto {
  @IsEmail()
  @IsOptional()
  email?: string;

  @IsEnum(Role)
  @IsOptional()
  role?: Role;

  @IsBoolean()
  @IsOptional()
  active?: boolean;
}

export const userAdminOptions = {
  category: 'Accounts',
  list: ['id', 'email', 'role', 'active', 'createdAt', 'updatedAt'],
  defaultSort: {
    field: 'updatedAt',
    order: 'desc',
  },
  sortable: ['updatedAt', 'email'],
  search: ['email'],
  filters: ['role', 'active'],
  readonly: ['createdAt', 'updatedAt'],
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
        const current = entity as { id?: string | number; role?: Role };

        if (!current.id) {
          return;
        }

        return context.adapter.update(context.resource, String(current.id), {
          active: false,
          role: current.role ?? Role.VIEWER,
        });
      },
    },
  ],
} satisfies Omit<AdminResourceOptions, 'model'>;
