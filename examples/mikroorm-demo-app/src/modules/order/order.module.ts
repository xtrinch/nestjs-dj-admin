import { Module } from '@nestjs/common';
import { OrderAdmin } from './order.admin.js';
import { OrderService } from './order.service.js';

@Module({
  providers: [OrderService, OrderAdmin],
  exports: [OrderService, OrderAdmin],
})
export class OrderModule {}
