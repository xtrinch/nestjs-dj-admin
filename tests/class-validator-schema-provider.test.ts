import 'reflect-metadata';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BadRequestException } from '@nestjs/common';
import { AdminService, adminSchemaFromClassValidator } from '../src/index.js';
import type {
  AdminAdapter,
  AdminRequestUser,
  AdminResourceOptions,
  AdminResourceSchema,
} from '../src/index.js';
import { CreateOrderDto, OrderStatus, UpdateOrderDto } from '#examples-shared/modules/order/shared.js';

describe('adminSchemaFromClassValidator', () => {
  it('builds field metadata from DTOs', () => {
    const schema = adminSchemaFromClassValidator({
      createDto: CreateOrderDto,
      updateDto: UpdateOrderDto,
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
        { name: 'number', input: 'text', required: true, enumValues: undefined, relation: undefined },
        { name: 'orderDate', input: 'date', required: true, enumValues: undefined, relation: undefined },
        { name: 'fulfillmentAt', input: 'datetime-local', required: false, enumValues: undefined, relation: undefined },
        { name: 'deliveryTime', input: 'time', required: false, enumValues: undefined, relation: undefined },
        { name: 'internalNote', input: 'textarea', required: false, enumValues: undefined, relation: undefined },
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
        { name: 'status', input: 'select', required: true, enumValues: ['pending', 'paid', 'cancelled'], relation: undefined },
        { name: 'total', input: 'number', required: true, enumValues: undefined, relation: undefined },
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

    const provider = adminSchemaFromClassValidator({
      createDto: CreateOrderDto,
      updateDto: UpdateOrderDto,
    });

    const schema: AdminResourceSchema = {
      resourceName: 'orders',
      label: 'Order',
      category: 'General',
      list: ['number'],
      sortable: [],
      listDisplayLinks: ['number'],
      search: ['number'],
      filters: [],
      readonly: [],
      actions: [],
      bulkActions: [],
      fields: provider.buildCreateFields({ readonlyFields: [] }),
      createFields: provider.buildCreateFields({ readonlyFields: [] }),
      updateFields: provider.buildUpdateFields({ readonlyFields: [] }),
    };

    const options: AdminResourceOptions = {
      model: class TestOrderModel {},
      list: ['number'],
      schema: provider,
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
      'orders',
      {
        number: 'ORD-001',
        orderDate: '2026-04-15',
        userId: '42' as unknown as number,
        status: OrderStatus.PAID,
        total: '99.5' as unknown as number,
      },
      adminUser,
    );

    assert.ok(createdPayload);
    assert.equal(createdPayload.number, 'ORD-001');
    assert.deepEqual(createdPayload.orderDate, new Date('2026-04-15T00:00:00.000Z'));
    assert.equal(createdPayload.userId, 42);
    assert.equal(createdPayload.status, 'paid');
    assert.equal(createdPayload.total, 99.5);

    await assert.rejects(
      () =>
        service.create(
          'orders',
          { number: 'ORD-002', orderDate: 'nope', userId: 5, status: 'paid', total: 5 },
          adminUser,
        ),
      (error: unknown) => {
        assert.ok(error instanceof BadRequestException);
        assert.deepEqual(error.getResponse(), {
          message: 'Validation failed',
          errors: [
            {
              field: 'orderDate',
              constraints: {
                isDate: 'orderDate must be a Date instance',
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
  role: 'admin',
  roles: ['admin'],
  email: 'ada@example.com',
};
