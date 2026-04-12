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
  list: ['id', 'name', 'description', 'createdAt'],
  search: ['name', 'description'],
  readonly: ['createdAt'],
  permissions: {
    read: ['admin'],
    write: ['admin'],
  },
  createDto: CreateCategoryDto,
  updateDto: UpdateCategoryDto,
} satisfies Omit<AdminResourceOptions, 'model'>;
