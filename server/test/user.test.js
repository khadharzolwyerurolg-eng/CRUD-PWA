import test from 'node:test';
import assert from 'node:assert/strict';
import { createUserSchema, updateUserSchema } from '../src/user.js';

test('create user schema trims names and normalizes email addresses', () => {
  const result = createUserSchema.parse({
    clientId: '4d6c4df4-c050-4de5-86c1-0711be7809f3',
    nome: '  Ana Silva  ',
    email: '  ANA@EXEMPLO.PT ',
  });

  assert.equal(result.nome, 'Ana Silva');
  assert.equal(result.email, 'ana@exemplo.pt');
});

test('create user schema rejects invalid identifiers and emails', () => {
  assert.equal(
    createUserSchema.safeParse({
      clientId: 'not-a-uuid',
      nome: 'Ana',
      email: 'not-an-email',
    }).success,
    false,
  );
});

test('update user schema rejects empty names', () => {
  assert.equal(
    updateUserSchema.safeParse({ nome: '  ', email: 'ana@exemplo.pt' }).success,
    false,
  );
});
