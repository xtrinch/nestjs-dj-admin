import { Module } from '@nestjs/common';
import { ProductAdmin } from './product.admin.js';
import { ProductService } from './product.service.js';

@Module({
  providers: [ProductService, ProductAdmin],
  exports: [ProductService, ProductAdmin],
})
export class ProductModule {}
