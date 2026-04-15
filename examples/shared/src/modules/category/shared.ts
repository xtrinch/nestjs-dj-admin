import { adminSchemaFromClassValidator } from '#src/index.js';
import type { AdminResourceOptions } from '#src/admin/types/admin.types.js';
import { IsOptional, IsString } from 'class-validator';

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
}

export const categoryAdminOptions = {
  category: 'Catalog',
  objectLabel: 'name',
  list: ['id', 'name', 'description', 'createdAt', 'updatedAt'],
  defaultSort: {
    field: 'updatedAt',
    order: 'desc',
  },
  sortable: ['updatedAt', 'name'],
  search: ['name', 'description'],
  readonly: ['createdAt', 'updatedAt'],
  permissions: {
    read: ['admin'],
    write: ['admin'],
  },
  schema: adminSchemaFromClassValidator({
    createDto: CreateCategoryDto,
    updateDto: UpdateCategoryDto,
  }),
} satisfies Omit<AdminResourceOptions, 'model'>;
