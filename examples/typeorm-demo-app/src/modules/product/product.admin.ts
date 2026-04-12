import { Injectable } from '@nestjs/common';
import { AdminResource } from '#src/admin/decorators/admin-resource.decorator.js';
import { productAdminOptions } from '../../../../shared/src/modules/product/shared.js';
import { Product } from './product.entity.js';

@Injectable()
@AdminResource({
  model: Product,
  ...productAdminOptions,
})
export class ProductAdmin {}
