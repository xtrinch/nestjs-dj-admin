import { BadRequestException } from '@nestjs/common';
import type {
  AdminDtoFieldConfig,
  AdminFieldSchema,
  AdminSchemaBuildContext,
  AdminSchemaProvider,
} from '../types/admin.types.js';

type ZodParseSuccess = { success: true; data: unknown };
type ZodParseFailure = {
  success: false;
  error?: {
    issues?: Array<{
      path?: PropertyKey[];
      message?: string;
      code?: string;
    }>;
  };
};

type ZodSchemaLike = {
  safeParse?: (value: unknown) => ZodParseSuccess | ZodParseFailure;
  safeParseAsync?: (value: unknown) => Promise<ZodParseSuccess | ZodParseFailure>;
  description?: string;
  shape?: Record<string, unknown> | (() => Record<string, unknown>);
  element?: ZodSchemaLike;
  options?: string[];
  enum?: Record<string, string>;
  values?: Set<string>;
  unwrap?: () => ZodSchemaLike;
  isOptional?: () => boolean;
  _def?: object;
};

type ZodObjectLike = ZodSchemaLike & {
  shape?: Record<string, unknown> | (() => Record<string, unknown>);
};

type DisplayOnlySchemaProvider = Required<Pick<AdminSchemaProvider, 'buildDisplayFields'>>;

export function adminSchemaFromZod(config: {
  display: ZodObjectLike;
  fields?: Record<string, AdminDtoFieldConfig>;
}): DisplayOnlySchemaProvider;
export function adminSchemaFromZod(config: {
  display?: ZodObjectLike;
  create: ZodObjectLike;
  update: ZodObjectLike;
  fields?: Record<string, AdminDtoFieldConfig>;
}): AdminSchemaProvider;
export function adminSchemaFromZod(config: {
  display?: ZodObjectLike;
  create?: ZodObjectLike;
  update?: ZodObjectLike;
  fields?: Record<string, AdminDtoFieldConfig>;
}): AdminSchemaProvider | DisplayOnlySchemaProvider {
  if (config.display && !config.create && !config.update) {
    return {
      buildDisplayFields(context: AdminSchemaBuildContext) {
        return buildFieldsFromZodShape(config.display!, config.fields ?? {}, context.readonlyFields);
      },
    };
  }

  return {
    buildDisplayFields(context: AdminSchemaBuildContext) {
      if (config.display) {
        return buildFieldsFromZodShape(config.display, config.fields ?? {}, context.readonlyFields);
      }

      return mergeFields(
        buildFieldsFromZodShape(config.create!, config.fields ?? {}, context.readonlyFields),
        buildFieldsFromZodShape(config.update!, config.fields ?? {}, context.readonlyFields),
      );
    },
    buildCreateFields(context: AdminSchemaBuildContext) {
      return buildFieldsFromZodShape(
        config.create!,
        config.fields ?? {},
        context.readonlyFields,
        config.display ? buildFieldsFromZodShape(config.display, config.fields ?? {}, context.readonlyFields) : undefined,
      );
    },
    buildUpdateFields(context: AdminSchemaBuildContext) {
      return buildFieldsFromZodShape(
        config.update!,
        config.fields ?? {},
        context.readonlyFields,
        config.display ? buildFieldsFromZodShape(config.display, config.fields ?? {}, context.readonlyFields) : undefined,
      );
    },
    async validateCreate(payload: Record<string, unknown>) {
      return parseZodPayload(config.create!, payload);
    },
    async validateUpdate(payload: Record<string, unknown>) {
      return parseZodPayload(config.update!, payload);
    },
  };
}

function buildFieldsFromZodShape(
  schema: ZodObjectLike,
  fieldConfig: Record<string, AdminDtoFieldConfig>,
  readonlyFields: string[],
  baseFields?: AdminFieldSchema[],
): AdminFieldSchema[] {
  const shape = getObjectShape(schema);
  const fields = new Map<string, AdminFieldSchema>();
  const baseFieldMap = new Map((baseFields ?? []).map((field) => [field.name, field] as const));

  for (const [propertyName, rawSchema] of Object.entries(shape)) {
    const extra = fieldConfig[propertyName] ?? {};
    const unwrapped = unwrapZodSchema(rawSchema);
    const baseField = baseFieldMap.get(propertyName);

    fields.set(propertyName, {
      name: propertyName,
      label: extra.label ?? baseField?.label ?? startCase(propertyName),
      input:
        extra.input ??
        baseField?.input ??
        resolveZodInput(propertyName, unwrapped, extra.relation?.kind),
      required: !isOptionalSchema(rawSchema),
      readOnly: extra.readOnly ?? baseField?.readOnly ?? readonlyFields.includes(propertyName),
      modes: extra.modes,
      helpText: extra.helpText ?? baseField?.helpText,
      enumValues: resolveZodEnumValues(unwrapped) ?? baseField?.enumValues,
      relation: extra.relation ?? baseField?.relation,
    });
  }

  for (const propertyName of readonlyFields) {
    if (fields.has(propertyName)) {
      continue;
    }

    fields.set(propertyName, {
      name: propertyName,
      label: startCase(propertyName),
      input: 'text',
      required: false,
      readOnly: true,
    });
  }

  return [...fields.values()];
}

function mergeFields(primary: AdminFieldSchema[], secondary: AdminFieldSchema[]): AdminFieldSchema[] {
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

async function parseZodPayload(
  schema: ZodSchemaLike,
  payload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const result = schema.safeParseAsync
    ? await schema.safeParseAsync(payload)
    : schema.safeParse?.(payload);

  if (!result) {
    return payload;
  }

  if (result.success) {
    return result.data as Record<string, unknown>;
  }

  throw new BadRequestException({
    message: 'Validation failed',
    errors: (result.error?.issues ?? []).map((issue) => ({
      field: issue.path?.length ? issue.path.map(String).join('.') : '_schema',
      constraints: {
        [issue.code ?? 'invalid']: issue.message ?? 'Invalid value',
      },
    })),
  });
}

function resolveZodInput(
  propertyName: string,
  schema: ZodSchemaLike,
  relationKind?: 'many-to-one' | 'many-to-many',
): AdminFieldSchema['input'] {
  if (relationKind === 'many-to-many') {
    return 'multiselect';
  }

  if (relationKind === 'many-to-one') {
    return 'select';
  }

  const typeName = getZodTypeName(schema);

  if (typeName.includes('ZodBoolean') || typeName === 'boolean') {
    return 'checkbox';
  }

  if (typeName.includes('ZodNumber') || typeName === 'number') {
    return 'number';
  }

  if (typeName.includes('ZodDate') || typeName === 'date') {
    return /at$/i.test(propertyName) ? 'datetime-local' : 'date';
  }

  if (typeName.includes('ZodEnum') || typeName.includes('ZodNativeEnum') || typeName === 'enum') {
    return 'select';
  }

  if (typeName.includes('ZodArray') || typeName === 'array') {
    return 'multiselect';
  }

  if (typeName.includes('ZodString') || typeName === 'string') {
    const format = getZodStringFormat(schema);
    if (format === 'email') {
      return 'email';
    }

    if (format === 'url') {
      return 'url';
    }

    const checks = getZodChecks(schema);
    if (checks.some((check) => check === 'email')) {
      return 'email';
    }

    if (checks.some((check) => check === 'url')) {
      return 'url';
    }

    return 'text';
  }

  return 'text';
}

function resolveZodEnumValues(schema: ZodSchemaLike): string[] | undefined {
  if (Array.isArray(schema.options)) {
    return schema.options;
  }

  if (schema.values instanceof Set) {
    return [...schema.values.values()];
  }

  if (schema.enum && typeof schema.enum === 'object') {
    return Object.values(schema.enum).filter((value) => typeof value === 'string');
  }

  const def = (schema._def ?? {}) as Record<string, unknown>;
  const values = def['values'];
  if (values instanceof Set) {
    return [...values.values()].filter((value) => typeof value === 'string');
  }

  const entries = def['entries'];
  if (entries && typeof entries === 'object') {
    return Object.values(entries as Record<string, unknown>).filter(
      (value): value is string => typeof value === 'string',
    );
  }

  return undefined;
}

function getObjectShape(schema: ZodObjectLike): Record<string, ZodSchemaLike> {
  if (typeof schema.shape === 'function') {
    return schema.shape() as Record<string, ZodSchemaLike>;
  }

  if (schema.shape && typeof schema.shape === 'object') {
    return schema.shape as Record<string, ZodSchemaLike>;
  }

  const def = (schema._def ?? {}) as Record<string, unknown>;
  const shape = def['shape'];
  if (typeof shape === 'function') {
    return shape() as Record<string, ZodSchemaLike>;
  }

  if (shape && typeof shape === 'object') {
    return shape as Record<string, ZodSchemaLike>;
  }

  return {};
}

function unwrapZodSchema(schema: ZodSchemaLike): ZodSchemaLike {
  let current = schema;
  for (let depth = 0; depth < 8; depth += 1) {
    const typeName = getZodTypeName(current);
    if (typeName.includes('ZodOptional') || typeName.includes('ZodNullable') || typeName.includes('ZodDefault')) {
      if (typeof current.unwrap === 'function') {
        current = current.unwrap();
        continue;
      }

      const currentDef = (current._def ?? {}) as Record<string, unknown>;
      const inner = (currentDef['innerType'] ?? currentDef['schema'] ?? currentDef['type']) as
        | ZodSchemaLike
        | undefined;
      if (inner) {
        current = inner;
        continue;
      }
    }

    break;
  }

  return current;
}

function isOptionalSchema(schema: ZodSchemaLike): boolean {
  if (typeof schema.isOptional === 'function') {
    return schema.isOptional();
  }

  return getZodTypeName(schema).includes('ZodOptional');
}

function getZodTypeName(schema: ZodSchemaLike): string {
  const typeName = ((schema._def ?? {}) as Record<string, unknown>)['typeName'];
  if (typeof typeName === 'string') {
    return typeName;
  }

  const type = ((schema._def ?? {}) as Record<string, unknown>)['type'];
  if (typeof type === 'string') {
    return type;
  }

  if (schema.constructor?.name) {
    return schema.constructor.name;
  }

  return '';
}

function getZodChecks(schema: ZodSchemaLike): string[] {
  const checks = ((schema._def ?? {}) as Record<string, unknown>)['checks'];
  if (!Array.isArray(checks)) {
    return [];
  }

  return checks
    .map((check) => {
      if (typeof check === 'string') {
        return check;
      }

      if (check && typeof check === 'object') {
        const kind = (check as Record<string, unknown>)['kind'];
        if (typeof kind === 'string') {
          return kind;
        }

        const format = (check as Record<string, unknown>)['format'];
        if (typeof format === 'string') {
          return format;
        }

        const checkType = (check as Record<string, unknown>)['check'];
        if (typeof checkType === 'string') {
          return checkType;
        }
      }

      return '';
    })
    .filter(Boolean);
}

function getZodStringFormat(schema: ZodSchemaLike): string | null {
  const format = ((schema._def ?? {}) as Record<string, unknown>)['format'];
  return typeof format === 'string' ? format : null;
}

function startCase(value: string): string {
  const spaced = value.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
  return `${spaced.charAt(0).toUpperCase()}${spaced.slice(1)}`;
}
