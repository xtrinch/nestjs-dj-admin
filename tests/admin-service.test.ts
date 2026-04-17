import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BadRequestException } from '@nestjs/common';
import { AdminService } from '../src/admin/services/admin.service.js';
import type {
  AdminAdapter,
  AdminRequestUser,
  AdminResourceOptions,
  AdminResourceSchema,
} from '../src/admin/types/admin.types.js';

describe('AdminService write error mapping', () => {
  it('maps Prisma unique violations to field validation errors', async () => {
    const adapter: AdminAdapter = {
      findMany: async () => ({ items: [], total: 0 }),
      findOne: async () => null,
      create: async () => {
        throw {
          code: 'P2002',
          meta: {
            target: ['email'],
          },
        };
      },
      update: async () => {
        throw new Error('not implemented');
      },
      delete: async () => undefined,
      distinct: async () => [],
    };

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
      fields: [
        {
          name: 'email',
          label: 'Email',
          input: 'email',
          required: true,
          readOnly: false,
        },
      ],
      createFields: [
        {
          name: 'email',
          label: 'Email',
          input: 'email',
          required: true,
          readOnly: false,
        },
      ],
      updateFields: [
        {
          name: 'email',
          label: 'Email',
          input: 'email',
          required: true,
          readOnly: false,
        },
      ],
    };

    const options: AdminResourceOptions = {
      model: class TestUserModel {},
      list: ['email'],
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
    );

    service.onModuleInit();

    await assert.rejects(
      () => service.create('users', { email: 'ada@example.com' }, adminUser),
      (error: unknown) => {
        assert.ok(error instanceof BadRequestException);
        assert.deepEqual(error.getResponse(), {
          message: 'Validation failed',
          errors: [
            {
              field: 'email',
              constraints: {
                unique: 'Email must be unique',
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
  roles: ['admin'],
  email: 'ada@example.com',
};
