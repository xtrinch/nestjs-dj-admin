import { Injectable } from '@nestjs/common';
import { AdminResource } from '#src/admin/decorators/admin-resource.decorator.js';
import { categoryAdminOptions } from '#examples-shared/modules/category/shared.js';
import { Category } from './category.entity.js';

@Injectable()
@AdminResource({
  model: Category,
  ...categoryAdminOptions,
})
export class CategoryAdmin {}
