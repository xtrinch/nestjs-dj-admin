import { adminSchemaFromClassValidator } from '#src/index.js';
import { AdminField } from '#src/admin/decorators/admin-field.decorator.js';
import type { AdminResourceOptions } from '#src/admin/types/admin.types.js';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString } from 'class-validator';

export class CategoryAdminDto {
  @IsInt()
  id!: number;

  @IsString()
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @AdminField({
    label: 'Created by',
    readOnly: true,
    relation: { kind: 'many-to-one', option: { resource: 'users', labelField: 'email', valueField: 'id' } },
  })
  @Type(() => Number)
  @IsInt()
  createdById!: number;
}

export class CreateCategoryDto {
  @IsString()
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;
}

export class UpdateCategoryDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @AdminField({
    label: 'Created by',
    readOnly: true,
    relation: { kind: 'many-to-one', option: { resource: 'users', labelField: 'email', valueField: 'id' } },
  })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  createdById?: number;
}

export const categoryAdminOptions = {
  category: 'Catalog',
  objectLabel: 'name',
  list: ['id', 'name', 'description', 'createdById', 'createdAt', 'updatedAt'],
  defaultSort: {
    field: 'updatedAt',
    order: 'desc',
  },
  sortable: ['updatedAt', 'name'],
  search: ['name', 'description'],
  filters: ['name', 'createdById'],
  readonly: ['createdAt', 'updatedAt'],
  schema: adminSchemaFromClassValidator({
    displayDto: CategoryAdminDto,
    createDto: CreateCategoryDto,
    updateDto: UpdateCategoryDto,
  }),
  transformCreate: async (payload, context) => ({
    ...payload,
    createdById: Number(context.user.id),
  }),
} satisfies Omit<AdminResourceOptions, 'model'>;
