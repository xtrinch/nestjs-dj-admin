import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DtoIntrospectorService } from '../src/admin/services/dto-introspector.service.js';
import { CreateUserDto } from '../examples/shared/src/modules/user/shared.js';

describe('DtoIntrospectorService', () => {
  it('maps enum DTO fields to select inputs with enum values', () => {
    const service = new DtoIntrospectorService();

    const fields = service.buildFields(CreateUserDto, []);
    const roleField = fields.find((field) => field.name === 'role');

    assert.ok(roleField);
    assert.equal(roleField.input, 'select');
    assert.deepEqual(roleField.enumValues, ['admin', 'editor', 'viewer']);
  });
});
