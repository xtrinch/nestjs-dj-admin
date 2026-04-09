import { Type } from 'class-transformer';
import { IsEmail, IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { OrderStatus } from './order.entity.js';

export class CreateOrderDto {
  @IsString()
  number!: string;

  @IsEmail()
  userEmail!: string;

  @IsEnum(OrderStatus)
  status!: OrderStatus;

  @Type(() => Number)
  @IsNumber()
  total!: number;
}

export class UpdateOrderDto {
  @IsString()
  @IsOptional()
  number?: string;

  @IsEmail()
  @IsOptional()
  userEmail?: string;

  @IsEnum(OrderStatus)
  @IsOptional()
  status?: OrderStatus;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  total?: number;
}
