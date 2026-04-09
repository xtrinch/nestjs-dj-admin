import { IsBoolean, IsEmail, IsEnum, IsOptional } from 'class-validator';
import { Role } from './user.entity.js';

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsEnum(Role)
  role!: Role;

  @IsBoolean()
  @IsOptional()
  active?: boolean;
}

export class UpdateUserDto {
  @IsEmail()
  @IsOptional()
  email?: string;

  @IsEnum(Role)
  @IsOptional()
  role?: Role;

  @IsBoolean()
  @IsOptional()
  active?: boolean;
}
