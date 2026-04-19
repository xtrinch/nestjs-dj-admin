import 'reflect-metadata';
import { AdminField } from '../../src/admin/decorators/admin-field.decorator.js';
import { IsInt, IsOptional, IsString } from 'class-validator';

export class DisplayOrderDto {
  userId!: number;

  internalNote?: string;
}

export class CreateDisplayOrderDto {
  internalNote?: string;
}

export class UpdateDisplayOrderDto {
  internalNote?: string;
}

export class ReadOnlyFieldDto {
  createdById?: number;
}

AdminField({
  label: 'User',
  relation: {
    kind: 'many-to-one',
    option: { resource: 'users', labelField: 'email', valueField: 'id' },
  },
})(DisplayOrderDto.prototype, 'userId');
IsInt()(DisplayOrderDto.prototype, 'userId');

AdminField({
  label: 'Internal note',
  input: 'textarea',
})(DisplayOrderDto.prototype, 'internalNote');
IsString()(DisplayOrderDto.prototype, 'internalNote');
IsOptional()(DisplayOrderDto.prototype, 'internalNote');

AdminField({
  label: 'Comment',
  input: 'textarea',
})(CreateDisplayOrderDto.prototype, 'internalNote');
IsString()(CreateDisplayOrderDto.prototype, 'internalNote');
IsOptional()(CreateDisplayOrderDto.prototype, 'internalNote');

IsString()(UpdateDisplayOrderDto.prototype, 'internalNote');
IsOptional()(UpdateDisplayOrderDto.prototype, 'internalNote');

AdminField({
  label: 'Created by',
  readOnly: true,
})(ReadOnlyFieldDto.prototype, 'createdById');
IsInt()(ReadOnlyFieldDto.prototype, 'createdById');
IsOptional()(ReadOnlyFieldDto.prototype, 'createdById');
