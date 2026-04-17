import { adminSchemaFromClassValidator } from '#src/index.js';
import { AdminField } from '#src/admin/decorators/admin-field.decorator.js';
import type { AdminResourceOptions } from '#src/admin/types/admin.types.js';
import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsInt, IsNumber, IsOptional, IsString } from 'class-validator';
import { DEMO_PERMISSIONS } from '../../admin-permissions.js';

export enum OrderStatus {
  PENDING = 'pending',
  PAID = 'paid',
  CANCELLED = 'cancelled',
}

export class CreateOrderDto {
  @IsString()
  number!: string;

  @Type(() => Date)
  @IsDate()
  orderDate!: Date;

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  fulfillmentAt?: Date;

  @AdminField({
    label: 'Delivery time',
    input: 'time',
  })
  @IsString()
  @IsOptional()
  deliveryTime?: string;

  @AdminField({
    label: 'Internal note',
    input: 'textarea',
  })
  @IsString()
  @IsOptional()
  internalNote?: string;

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

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  orderDate?: Date;

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  fulfillmentAt?: Date;

  @AdminField({
    label: 'Delivery time',
    input: 'time',
  })
  @IsString()
  @IsOptional()
  deliveryTime?: string;

  @AdminField({
    label: 'Internal note',
    input: 'textarea',
  })
  @IsString()
  @IsOptional()
  internalNote?: string;

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
  list: ['id', 'number', 'orderDate', 'deliveryTime', 'fulfillmentAt', 'userId', 'status', 'total', 'internalNote', 'createdAt', 'updatedAt'],
  defaultSort: {
    field: 'orderDate',
    order: 'desc',
  },
  sortable: ['orderDate', 'updatedAt', 'number'],
  search: ['number', { path: 'userId.email', label: 'User email' }],
  filters: ['status', 'userId'],
  readonly: ['createdAt', 'updatedAt'],
  permissions: {
    read: [DEMO_PERMISSIONS.orders.manage],
    write: [DEMO_PERMISSIONS.orders.manage],
  },
  schema: adminSchemaFromClassValidator({
    createDto: CreateOrderDto,
    updateDto: UpdateOrderDto,
  }),
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
