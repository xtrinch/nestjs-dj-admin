import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { AdminService, adminSchemaFromZod } from '../src/index.js';
import type {
  AdminAdapter,
  AdminRequestUser,
  AdminResourceOptions,
  AdminResourceSchema,
} from '../src/index.js';

describe('adminSchemaFromZod', () => {
  it('builds field metadata from zod schemas with overrides', async () => {
    const schema = adminSchemaFromZod({
      create: z.object({
        email: z.email(),
        role: z.enum(['admin', 'editor', 'viewer']),
        active: z.boolean(),
        userId: z.coerce.number(),
      }),
      update: z.object({
        email: z.email().optional(),
        role: z.enum(['admin', 'editor', 'viewer']).optional(),
        active: z.boolean().optional(),
        userId: z.coerce.number().optional(),
      }),
      fields: {
        userId: {
          label: 'User',
          relation: {
            kind: 'many-to-one',
            option: { resource: 'users', labelField: 'email', valueField: 'id' },
          },
        },
      },
    });

    const fields = schema.buildCreateFields({
      readonlyFields: [],
    });

    assert.deepEqual(
      fields.map((field) => ({
        name: field.name,
        input: field.input,
        required: field.required,
        enumValues: field.enumValues,
        relation: field.relation,
      })),
      [
        { name: 'email', input: 'email', required: true, enumValues: undefined, relation: undefined },
        { name: 'role', input: 'select', required: true, enumValues: ['admin', 'editor', 'viewer'], relation: undefined },
        { name: 'active', input: 'checkbox', required: true, enumValues: undefined, relation: undefined },
        {
          name: 'userId',
          input: 'select',
          required: true,
          enumValues: undefined,
          relation: {
            kind: 'many-to-one',
            option: { resource: 'users', labelField: 'email', valueField: 'id' },
          },
        },
      ],
    );
  });

  it('validates and coerces payloads through admin service', async () => {
    let createdPayload: Record<string, unknown> | null = null;

    const adapter: AdminAdapter = {
      findMany: async () => ({ items: [], total: 0 }),
      findOne: async () => null,
      create: async (_resource, data) => {
        createdPayload = data as Record<string, unknown>;
        return {
          id: '1',
          ...data,
        };
      },
      update: async () => {
        throw new Error('not implemented');
      },
      delete: async () => undefined,
      distinct: async () => [],
    };

    const zodSchema = adminSchemaFromZod({
      create: z.object({
        email: z.email(),
        active: z.boolean(),
        age: z.coerce.number().int(),
      }),
      update: z.object({
        email: z.email().optional(),
        active: z.boolean().optional(),
        age: z.coerce.number().int().optional(),
      }),
    });

    const schema: AdminResourceSchema = {
      resourceName: 'users',
      label: 'User',
      category: 'General',
      list: ['email'],
      sortable: [],
      listDisplayLinks: ['email'],
      search: ['email'],
      filters: [],
      readonly: [],
      actions: [],
      bulkActions: [],
      fields: zodSchema.buildCreateFields({ readonlyFields: [] }),
      createFields: zodSchema.buildCreateFields({ readonlyFields: [] }),
      updateFields: zodSchema.buildUpdateFields({ readonlyFields: [] }),
    };

    const options: AdminResourceOptions = {
      model: class TestUserModel {},
      list: ['email'],
      schema: zodSchema,
    };

    const service = new AdminService(
      {
        initialize() {},
        getAll() {
          return [schema];
        },
        get() {
          return {
            schema,
            options,
          };
        },
      } as never,
      {
        assertCanRead() {},
        assertCanWrite() {},
      } as never,
      {
        get() {
          return adapter;
        },
      } as never,
      {
        record: async () => undefined,
      } as never,
    );

    service.onModuleInit();

    await service.create(
      'users',
      { email: 'ada@example.com', active: true, age: '42' as unknown as number },
      adminUser,
    );

    assert.deepEqual(createdPayload, {
      email: 'ada@example.com',
      active: true,
      age: 42,
    });

    await assert.rejects(
      () => service.create('users', { email: 'nope', active: true, age: 5 }, adminUser),
      (error: unknown) => {
        assert.ok(error instanceof BadRequestException);
        assert.deepEqual(error.getResponse(), {
          message: 'Validation failed',
          errors: [
            {
              field: 'email',
              constraints: {
                invalid_format: 'Invalid email address',
              },
            },
          ],
        });
        return true;
      },
    );
  });
});

const adminUser: AdminRequestUser = {
  id: '1',
  permissions: [],
  email: 'ada@example.com',
  isSuperuser: true,
};
