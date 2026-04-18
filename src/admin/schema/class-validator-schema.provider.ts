import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import type {
  AdminFieldMode,
  AdminSchemaBuildContext,
  AdminSchemaProvider,
} from '../types/admin.types.js';
import { buildClassValidatorFields } from '../services/dto-introspector.service.js';

type DisplayOnlySchemaProvider = Required<Pick<AdminSchemaProvider, 'buildDisplayFields'>>;

export function adminSchemaFromClassValidator(config: {
  displayDto: Function;
}): DisplayOnlySchemaProvider;
export function adminSchemaFromClassValidator(config: {
  displayDto?: Function;
  createDto?: Function;
  updateDto?: Function;
}): AdminSchemaProvider;
export function adminSchemaFromClassValidator(config: {
  displayDto?: Function;
  createDto?: Function;
  updateDto?: Function;
}): AdminSchemaProvider | DisplayOnlySchemaProvider {
  if (config.displayDto && !config.createDto && !config.updateDto) {
    return {
      buildDisplayFields(context: AdminSchemaBuildContext) {
        return buildFields(config.displayDto, context);
      },
    };
  }

  return {
    buildDisplayFields(context: AdminSchemaBuildContext) {
      if (config.displayDto) {
        return buildFields(config.displayDto, context);
      }

      return mergeFields(
        buildFields(config.createDto, context, 'create'),
        buildFields(config.updateDto, context, 'update'),
      );
    },
    buildCreateFields(context: AdminSchemaBuildContext) {
      return buildFields(
        config.createDto,
        context,
        'create',
        config.displayDto ? buildFields(config.displayDto, context) : undefined,
      );
    },
    buildUpdateFields(context: AdminSchemaBuildContext) {
      return buildFields(
        config.updateDto,
        context,
        'update',
        config.displayDto ? buildFields(config.displayDto, context) : undefined,
      );
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
  mode?: AdminFieldMode,
  baseFields?: ReturnType<typeof buildClassValidatorFields>,
) {
  return buildClassValidatorFields(dtoClass, context.readonlyFields, context.model, mode, baseFields);
}

function mergeFields(primary: ReturnType<typeof buildClassValidatorFields>, secondary: ReturnType<typeof buildClassValidatorFields>) {
  const merged = new Map(primary.map((field) => [field.name, field] as const));

  for (const field of secondary) {
    const existing = merged.get(field.name);
    if (!existing) {
      merged.set(field.name, field);
      continue;
    }

    merged.set(field.name, {
      ...existing,
      ...field,
      modes: (() => {
        const modes = [...new Set([...(existing.modes ?? []), ...(field.modes ?? [])])];
        return modes.length > 0 ? modes : undefined;
      })(),
    });
  }

  return [...merged.values()];
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
