import { Category } from '../category/category.entity.js';

export class Product {
  id!: number;
  sku!: string;
  name!: string;
  unitPrice!: number;
  unitsInStock!: number;
  discontinued!: boolean;
  categories!: Category[];
  createdAt!: Date;
}
