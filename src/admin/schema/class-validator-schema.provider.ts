import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import type {
  AdminFieldMode,
  AdminSchemaBuildContext,
  AdminSchemaProvider,
} from '../types/admin.types.js';
import { buildClassValidatorFields } from '../services/dto-introspector.service.js';

export function adminSchemaFromClassValidator(config: {
  createDto?: Function;
  updateDto?: Function;
}): AdminSchemaProvider {
  return {
    buildCreateFields(context: AdminSchemaBuildContext) {
      return buildFields(config.createDto, context, 'create');
    },
    buildUpdateFields(context: AdminSchemaBuildContext) {
      return buildFields(config.updateDto, context, 'update');
    },
    async validateCreate(payload: Record<string, unknown>) {
      return validateClassValidatorDto(config.createDto, payload);
    },
    async validateUpdate(payload: Record<string, unknown>) {
      return validateClassValidatorDto(config.updateDto, payload);
    },
  };
}

function buildFields(
  dtoClass: Function | undefined,
  context: AdminSchemaBuildContext,
  mode: AdminFieldMode,
) {
  return buildClassValidatorFields(dtoClass, context.readonlyFields, context.model, mode);
}

async function validateClassValidatorDto(
  dtoClass: Function | undefined,
  payload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  if (!dtoClass) {
    return payload;
  }

  const dtoInstance = plainToInstance(dtoClass as never, payload, {
    enableImplicitConversion: true,
  });
  const errors = await validate(dtoInstance as object);

  if (errors.length > 0) {
    throw new BadRequestException({
      message: 'Validation failed',
      errors: errors.map((error) => ({
        field: error.property,
        constraints: error.constraints,
      })),
    });
  }

  return dtoInstance as Record<string, unknown>;
}
