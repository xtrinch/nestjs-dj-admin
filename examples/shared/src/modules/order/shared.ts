import { AdminField } from '#src/admin/decorators/admin-field.decorator.js';
import type { AdminResourceOptions } from '#src/admin/types/admin.types.js';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsNumber, IsOptional, IsString } from 'class-validator';

export enum OrderStatus {
  PENDING = 'pending',
  PAID = 'paid',
  CANCELLED = 'cancelled',
}

export class CreateOrderDto {
  @IsString()
  number!: string;

  @AdminField({
    label: 'User',
    relation: { kind: 'many-to-one', option: { resource: 'users', labelField: 'email', valueField: 'id' } },
  })
  @Type(() => Number)
  @IsInt()
  userId!: number;

  @IsEnum(OrderStatus)
  status!: OrderStatus;

  @Type(() => Number)
  @IsNumber()
  total!: number;
}

export class UpdateOrderDto {
  @IsString()
  @IsOptional()
  number?: string;

  @AdminField({
    label: 'User',
    relation: { kind: 'many-to-one', option: { resource: 'users', labelField: 'email', valueField: 'id' } },
  })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  userId?: number;

  @IsEnum(OrderStatus)
  @IsOptional()
  status?: OrderStatus;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  total?: number;
}

export const orderAdminOptions = {
  category: 'Sales',
  objectLabel: 'number',
  list: ['id', 'number', 'userId', 'status', 'total', 'createdAt', 'updatedAt'],
  defaultSort: {
    field: 'updatedAt',
    order: 'desc',
  },
  sortable: ['updatedAt', 'number'],
  search: ['number'],
  filters: ['status'],
  readonly: ['createdAt', 'updatedAt'],
  permissions: {
    read: ['admin'],
    write: ['admin'],
  },
  createDto: CreateOrderDto,
  updateDto: UpdateOrderDto,
  actions: [
    {
      name: 'Mark as paid',
      handler: async (entity, context) => {
        const current = entity as { id?: string | number };

        if (!current.id) {
          return;
        }

        return context.adapter.update(context.resource, String(current.id), {
          status: OrderStatus.PAID,
        });
      },
    },
  ],
} satisfies Omit<AdminResourceOptions, 'model'>;
