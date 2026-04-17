import { Collection } from '@mikro-orm/core';
import { Entity, ManyToMany, PrimaryKey, Property } from '@mikro-orm/decorators/legacy';
import { Category } from '../category/category.entity.js';

@Entity({ tableName: 'products' })
export class Product {
  @PrimaryKey({ autoincrement: true })
  id!: number;

  @Property({ unique: true })
  sku!: string;

  @Property()
  name!: string;

  @Property({ columnType: 'numeric(10,2)' })
  unitPrice!: number;

  @Property({ default: 0 })
  unitsInStock = 0;

  @Property({ default: false })
  discontinued = false;

  @Property({ nullable: true })
  deletedAt: Date | null = null;

  @ManyToMany({
    entity: () => Category,
    inversedBy: (category) => category.products,
    owner: true,
    pivotTable: 'product_categories',
    joinColumn: 'product_id',
    inverseJoinColumn: 'category_id',
  })
  categories = new Collection<Category>(this);

  @Property({ onCreate: () => new Date() })
  createdAt = new Date();

  @Property({ onCreate: () => new Date(), onUpdate: () => new Date() })
  updatedAt = new Date();
}
