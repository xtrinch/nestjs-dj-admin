import 'reflect-metadata';
import { Injectable } from '@nestjs/common';
import { getMetadataStorage } from 'class-validator';
import { ADMIN_DTO_FIELD_METADATA } from '../decorators/admin-field.decorator.js';
import type { AdminFieldMode, AdminFieldSchema } from '../types/admin.types.js';

type ValidationMetadata = {
  propertyName: string;
  type: string;
  name?: string;
  constraints?: unknown[];
};

@Injectable()
export class DtoIntrospectorService {
  buildFields(
    dtoClass: Function | undefined,
    readonlyFields: string[],
    modelClass?: Function,
    mode?: AdminFieldMode,
  ): AdminFieldSchema[] {
    const fields = new Map<string, AdminFieldSchema>();

    if (dtoClass) {
      const storage = getMetadataStorage() as {
        getTargetValidationMetadatas: (
          target: Function,
          targetSchema: string,
          always: boolean,
          strictGroups: boolean,
        ) => ValidationMetadata[];
      };

      const metadata = storage.getTargetValidationMetadatas(dtoClass, '', false, false);
      const byProperty = new Map<string, ValidationMetadata[]>();

      for (const item of metadata) {
        const group = byProperty.get(item.propertyName) ?? [];
        group.push(item);
        byProperty.set(item.propertyName, group);
      }

      for (const [propertyName, validators] of byProperty.entries()) {
        const type = Reflect.getMetadata('design:type', dtoClass.prototype, propertyName) as
          | Function
          | undefined;
        const extra =
          Reflect.getMetadata(ADMIN_DTO_FIELD_METADATA, dtoClass.prototype, propertyName) ?? {};

        const modes = Array.isArray(extra.modes) && extra.modes.length > 0 ? extra.modes : undefined;
        if (mode && modes && !modes.includes(mode)) {
          continue;
        }

        fields.set(propertyName, {
          name: propertyName,
          label: extra.label ?? startCase(propertyName),
          input: extra.input ?? this.resolveInput(propertyName, validators, type, extra.relation?.kind),
          required: !validators.some((validator) => matchesValidator(validator, 'conditionalValidation', 'isOptional')),
          readOnly: readonlyFields.includes(propertyName),
          modes,
          helpText: extra.helpText,
          enumValues: this.resolveEnumValues(validators),
          relation: extra.relation,
        });
      }
    }

    for (const propertyName of readonlyFields) {
      if (fields.has(propertyName)) {
        continue;
      }

      const type = modelClass
        ? (Reflect.getMetadata('design:type', modelClass.prototype, propertyName) as
            | Function
            | undefined)
        : undefined;

      fields.set(propertyName, {
        name: propertyName,
        label: startCase(propertyName),
        input: this.resolveInput(propertyName, [], type),
        required: false,
        readOnly: true,
        modes: undefined,
        helpText: undefined,
      });
    }

    return [...fields.values()];
  }

  private resolveInput(
    propertyName: string,
    validators: ValidationMetadata[],
    runtimeType: Function | undefined,
    relationKind?: 'many-to-one' | 'many-to-many',
  ): AdminFieldSchema['input'] {
    if (relationKind === 'many-to-many') {
      return 'multiselect';
    }

    if (relationKind === 'many-to-one') {
      return 'select';
    }

    if (validators.some((validator) => matchesValidator(validator, 'isEmail'))) {
      return 'email';
    }

    if (validators.some((validator) => matchesValidator(validator, 'isBoolean'))) {
      return 'checkbox';
    }

    if (validators.some((validator) => matchesValidator(validator, 'isDate'))) {
      return /at$/i.test(propertyName) ? 'datetime-local' : 'date';
    }

    if (runtimeType === Date) {
      return /at$/i.test(propertyName) ? 'datetime-local' : 'date';
    }

    if (validators.some((validator) => matchesValidator(validator, 'isEnum'))) {
      return 'select';
    }

    if (runtimeType === Number) {
      return 'number';
    }

    return 'text';
  }

  private resolveEnumValues(validators: ValidationMetadata[]): string[] | undefined {
    const enumValidator = validators.find((validator) => matchesValidator(validator, 'isEnum'));
    const candidate = enumValidator?.constraints?.[0];

    if (!candidate || typeof candidate !== 'object') {
      return undefined;
    }

    return Object.values(candidate as Record<string, string>).filter(
      (value) => typeof value === 'string',
    );
  }
}

function matchesValidator(
  validator: ValidationMetadata,
  ...names: string[]
): boolean {
  return names.includes(validator.type) || names.includes(validator.name ?? '');
}

function startCase(value: string): string {
  const spaced = value.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
  return `${spaced.charAt(0).toUpperCase()}${spaced.slice(1)}`;
}
