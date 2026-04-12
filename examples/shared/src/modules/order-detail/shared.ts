import { AdminField } from '#src/admin/decorators/admin-field.decorator.js';
import type { AdminResourceOptions } from '#src/admin/types/admin.types.js';
import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class CreateOrderDetailDto {
  @AdminField({
    label: 'Order',
    relation: { kind: 'many-to-one', option: { resource: 'orders', labelField: 'number', valueField: 'id' } },
  })
  @Type(() => Number)
  @IsInt()
  orderId!: number;

  @AdminField({
    label: 'Product',
    relation: { kind: 'many-to-one', option: { resource: 'products', labelField: 'name', valueField: 'id' } },
  })
  @Type(() => Number)
  @IsInt()
  productId!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  @IsOptional()
  discount?: number;
}

export class UpdateOrderDetailDto {
  @AdminField({
    label: 'Order',
    relation: { kind: 'many-to-one', option: { resource: 'orders', labelField: 'number', valueField: 'id' } },
  })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  orderId?: number;

  @AdminField({
    label: 'Product',
    relation: { kind: 'many-to-one', option: { resource: 'products', labelField: 'name', valueField: 'id' } },
  })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  productId?: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  unitPrice?: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  quantity?: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  @IsOptional()
  discount?: number;
}

export const orderDetailAdminOptions = {
  category: 'Sales',
  objectLabel: 'id',
  list: ['id', 'orderId', 'productId', 'unitPrice', 'quantity', 'discount', 'createdAt', 'updatedAt'],
  defaultSort: {
    field: 'updatedAt',
    order: 'desc',
  },
  sortable: ['updatedAt', 'quantity'],
  search: [],
  readonly: ['createdAt', 'updatedAt'],
  permissions: {
    read: ['admin'],
    write: ['admin'],
  },
  createDto: CreateOrderDetailDto,
  updateDto: UpdateOrderDetailDto,
} satisfies Omit<AdminResourceOptions, 'model'>;
