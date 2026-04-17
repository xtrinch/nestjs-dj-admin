import { Injectable } from '@nestjs/common';
import { AdminResource } from '#src/admin/decorators/admin-resource.decorator.js';
import { adminSchemaFromZod } from '#src/index.js';
import { categoryAdminOptions } from '#examples-shared/modules/category/shared.js';
import { Category } from './category.entity.js';
import { z } from 'zod';

const categorySchema = adminSchemaFromZod({
  create: z.object({
    name: z.string().min(1),
    description: z.string().optional(),
  }),
  update: z.object({
    name: z.string().min(1).optional(),
    description: z.string().optional(),
  }),
});

@Injectable()
@AdminResource({
  model: Category,
  ...categoryAdminOptions,
  schema: categorySchema,
})
export class CategoryAdmin {}
