import { AdminField } from '#src/admin/decorators/admin-field.decorator.js';
import type { AdminResourceOptions } from '#src/admin/types/admin.types.js';
import { IsBoolean, IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, IsUrl } from 'class-validator';

export enum Role {
  ADMIN = 'admin',
  EDITOR = 'editor',
  VIEWER = 'viewer',
}

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @AdminField({
    label: 'Password',
    input: 'password',
    helpText: 'Set an initial password for this user.',
    modes: ['create'],
  })
  @IsString()
  @IsNotEmpty()
  password!: string;

  @AdminField({
    label: 'Password confirmation',
    input: 'password',
    helpText: 'Enter the same password again for verification.',
    modes: ['create'],
  })
  @IsString()
  @IsNotEmpty()
  passwordConfirm!: string;

  @AdminField({
    label: 'Phone',
    input: 'tel',
  })
  @IsString()
  @IsOptional()
  phone?: string;

  @AdminField({
    label: 'Profile URL',
    input: 'url',
  })
  @IsUrl()
  @IsOptional()
  profileUrl?: string;

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

  @AdminField({
    label: 'Phone',
    input: 'tel',
  })
  @IsString()
  @IsOptional()
  phone?: string;

  @AdminField({
    label: 'Profile URL',
    input: 'url',
  })
  @IsUrl()
  @IsOptional()
  profileUrl?: string;

  @IsEnum(Role)
  @IsOptional()
  role?: Role;

  @IsBoolean()
  @IsOptional()
  active?: boolean;
}

export const userAdminOptions = {
  category: 'Accounts',
  objectLabel: 'email',
  list: ['id', 'email', 'phone', 'profileUrl', 'role', 'active', 'createdAt', 'updatedAt'],
  defaultSort: {
    field: 'updatedAt',
    order: 'desc',
  },
  sortable: ['updatedAt', 'email'],
  search: ['email', 'phone', 'profileUrl'],
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
  bulkActions: [
    {
      name: 'Deactivate selected',
      handler: async (ids, context) => {
        await Promise.all(
          ids.map(async (id) => {
            const current = await context.adapter.findOne(context.resource, id);
            if (!current) {
              return;
            }

            const record = current as { role?: Role };
            await context.adapter.update(context.resource, id, {
              active: false,
              role: record.role ?? Role.VIEWER,
            });
          }),
        );
      },
    },
  ],
} satisfies Omit<AdminResourceOptions, 'model'>;
