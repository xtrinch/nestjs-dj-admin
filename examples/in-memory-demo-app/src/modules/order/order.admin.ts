import { Injectable } from '@nestjs/common';
import { AdminResource } from '#src/admin/decorators/admin-resource.decorator.js';
import { orderAdminOptions } from '../../../../shared/src/modules/order/shared.js';
import { Order } from './order.entity.js';

@Injectable()
@AdminResource({
  model: Order,
  ...orderAdminOptions,
})
export class OrderAdmin {}
