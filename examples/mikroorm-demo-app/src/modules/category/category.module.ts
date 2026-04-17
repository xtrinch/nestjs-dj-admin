import { Module } from '@nestjs/common';
import { CategoryAdmin } from './category.admin.js';
import { CategoryService } from './category.service.js';

@Module({
  providers: [CategoryService, CategoryAdmin],
  exports: [CategoryService, CategoryAdmin],
})
export class CategoryModule {}
