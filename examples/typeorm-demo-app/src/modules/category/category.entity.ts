import { Product } from '../product/product.entity.js';
import { Column, CreateDateColumn, Entity, ManyToMany, PrimaryGeneratedColumn } from 'typeorm';

@Entity('categories')
export class Category {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  name!: string;

  @Column({ default: '' })
  description!: string;

  @ManyToMany(() => Product, (product) => product.categories)
  products!: Product[];

  @CreateDateColumn()
  createdAt!: Date;
}
