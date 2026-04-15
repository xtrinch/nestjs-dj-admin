export class Product {
  id!: string;
  sku!: string;
  name!: string;
  unitPrice!: number;
  unitsInStock!: number;
  discontinued!: boolean;
  deletedAt!: Date | null;
  categories!: string[];
  createdAt!: string;
  updatedAt!: string;
}
