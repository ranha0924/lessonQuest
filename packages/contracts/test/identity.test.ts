import { describe, expect, it } from 'vitest';

import {
  addClassMemberInputSchema,
  actorSchema,
  createClassInputSchema,
  createOrganizationInputSchema,
} from '../src/identity.js';

const teacher = {
  userId: '018f72a4-cc52-7c5a-a6f9-8b21aa27c601',
  platformRole: 'TEACHER',
  memberships: [],
} as const;

describe('actorSchema', () => {
  it('accepts a server-owned teacher actor', () => {
    expect(actorSchema.parse(teacher)).toEqual(teacher);
  });

  it('rejects privilege fields outside the actor contract', () => {
    expect(() => actorSchema.parse({ ...teacher, admin: true })).toThrow();
  });

  it('rejects malformed identifiers and unknown roles', () => {
    expect(() => actorSchema.parse({ ...teacher, userId: 'user_1' })).toThrow();
    expect(() => actorSchema.parse({ ...teacher, platformRole: 'ORG_ADMIN' })).toThrow();
    expect(() =>
      actorSchema.parse({
        ...teacher,
        memberships: [
          {
            organizationId: '018f72a4-cc52-7c5a-a6f9-8b21aa27c602',
            role: 'SUPER_ADMIN',
          },
        ],
      }),
    ).toThrow();
  });

  it('rejects duplicate organization memberships', () => {
    const membership = {
      organizationId: '018f72a4-cc52-7c5a-a6f9-8b21aa27c602',
      role: 'TEACHER',
    } as const;

    expect(() =>
      actorSchema.parse({ ...teacher, memberships: [membership, membership] }),
    ).toThrow();
  });
});

describe.each([
  ['organization', createOrganizationInputSchema],
  ['class', createClassInputSchema],
] as const)('%s creation input', (_label, schema) => {
  it('trims a bounded display name', () => {
    expect(schema.parse({ name: '  별빛중학교  ' })).toEqual({ name: '별빛중학교' });
  });

  it('rejects empty and oversized names', () => {
    expect(() => schema.parse({ name: '   ' })).toThrow();
    expect(() => schema.parse({ name: '가'.repeat(81) })).toThrow();
  });

  it.each(['organizationId', 'ownerId', 'role'])('rejects injected %s', (field) => {
    expect(() => schema.parse({ name: '별빛중학교', [field]: 'attacker-controlled' })).toThrow();
  });
});

describe('class member input', () => {
  const studentUserId = '018f72a4-cc52-7c5a-a6f9-8b21aa27c603';

  it('accepts only a valid student user identifier', () => {
    expect(addClassMemberInputSchema.parse({ userId: studentUserId })).toEqual({
      userId: studentUserId,
    });
    expect(() => addClassMemberInputSchema.parse({ userId: 'student_1' })).toThrow();
  });

  it.each(['role', 'organizationId', 'classId'])('rejects injected %s', (field) => {
    expect(() =>
      addClassMemberInputSchema.parse({ userId: studentUserId, [field]: 'attacker-controlled' }),
    ).toThrow();
  });
});
