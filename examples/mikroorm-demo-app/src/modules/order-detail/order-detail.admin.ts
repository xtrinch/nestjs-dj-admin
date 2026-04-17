import { Injectable } from '@nestjs/common';
import { AdminResource } from '#src/admin/decorators/admin-resource.decorator.js';
import { orderDetailAdminOptions } from '#examples-shared/modules/order-detail/shared.js';
import { OrderDetail } from './order-detail.entity.js';

@Injectable()
@AdminResource({
  model: OrderDetail,
  ...orderDetailAdminOptions,
})
export class OrderDetailAdmin {}
