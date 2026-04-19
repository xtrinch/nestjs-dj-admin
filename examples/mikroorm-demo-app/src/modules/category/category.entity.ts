import { Collection } from '@mikro-orm/core';
import { Entity, ManyToMany, PrimaryKey, Property } from '@mikro-orm/decorators/legacy';
import { Product } from '../product/product.entity.js';

@Entity({ tableName: 'categories' })
export class Category {
  @PrimaryKey({ autoincrement: true })
  id!: number;

  @Property({ unique: true })
  name!: string;

  @Property({ columnType: 'text', default: '' })
  description = '';

  @Property()
  createdById!: number;

  @ManyToMany({
    entity: () => Product,
    mappedBy: (product) => product.categories,
  })
  products = new Collection<Product>(this);

  @Property({ onCreate: () => new Date() })
  createdAt = new Date();

  @Property({ onCreate: () => new Date(), onUpdate: () => new Date() })
  updatedAt = new Date();
}
