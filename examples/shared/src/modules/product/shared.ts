import type { AdminResourceOptions } from '#src/admin/types/admin.types.js';
import { AdminField } from '#src/admin/decorators/admin-field.decorator.js';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateProductDto {
  @IsString()
  sku!: string;

  @IsString()
  name!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  unitsInStock!: number;

  @IsBoolean()
  @IsOptional()
  discontinued?: boolean;

  @AdminField({
    label: 'Categories',
    relation: {
      kind: 'many-to-many',
      option: { resource: 'categories', labelField: 'name', valueField: 'id' },
    },
  })
  @Type(() => Number)
  @IsInt({ each: true })
  @IsArray()
  @IsOptional()
  categories?: number[];
}

export class UpdateProductDto {
  @IsString()
  @IsOptional()
  sku?: string;

  @IsString()
  @IsOptional()
  name?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  unitPrice?: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  unitsInStock?: number;

  @IsBoolean()
  @IsOptional()
  discontinued?: boolean;

  @AdminField({
    label: 'Categories',
    relation: {
      kind: 'many-to-many',
      option: { resource: 'categories', labelField: 'name', valueField: 'id' },
    },
  })
  @Type(() => Number)
  @IsInt({ each: true })
  @IsArray()
  @IsOptional()
  categories?: number[];
}

export const productAdminOptions = {
  category: 'Catalog',
  objectLabel: 'name',
  list: ['id', 'sku', 'name', 'unitPrice', 'unitsInStock', 'discontinued', 'createdAt', 'updatedAt'],
  defaultSort: {
    field: 'updatedAt',
    order: 'desc',
  },
  sortable: ['updatedAt', 'name'],
  search: ['sku', 'name'],
  filters: ['discontinued'],
  readonly: ['createdAt', 'updatedAt'],
  permissions: {
    read: ['admin'],
    write: ['admin'],
  },
  createDto: CreateProductDto,
  updateDto: UpdateProductDto,
} satisfies Omit<AdminResourceOptions, 'model'>;
