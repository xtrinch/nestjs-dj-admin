import { Module } from '@nestjs/common';
import { OrderDetailAdmin } from './order-detail.admin.js';
import { OrderDetailService } from './order-detail.service.js';

@Module({
  providers: [OrderDetailService, OrderDetailAdmin],
  exports: [OrderDetailService, OrderDetailAdmin],
})
export class OrderDetailModule {}
