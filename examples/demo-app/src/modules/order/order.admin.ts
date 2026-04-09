import { Injectable } from '@nestjs/common';
import { AdminResource } from '#src/admin/decorators/admin-resource.decorator.js';
import { CreateOrderDto, UpdateOrderDto } from './order.dto.js';
import { Order, OrderStatus } from './order.entity.js';

@Injectable()
@AdminResource({
  model: Order,
  category: 'Sales',
  list: ['number', 'userEmail', 'status', 'total', 'createdAt'],
  search: ['number', 'userEmail'],
  filters: ['status'],
  readonly: ['createdAt'],
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
        if (!entity.id) {
          return;
        }

        return context.adapter.update(context.resource, String(entity.id), {
          status: OrderStatus.PAID,
        });
      },
    },
  ],
})
export class OrderAdmin {}
