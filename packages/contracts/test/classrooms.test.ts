import { describe, expect, it } from 'vitest';
import {
  issueClassInvitationInputSchema,
  redeemClassInvitationInputSchema,
  classDashboardSchema,
} from '../src/classrooms.js';

describe('classroom boundaries', () => {
  it('accepts only bounded invitation capacity and an opaque code', () => {
    expect(issueClassInvitationInputSchema.parse({ maxUses: 30 })).toEqual({ maxUses: 30 });
    for (const maxUses of [0, 101, 1.1, '30', null])
      expect(issueClassInvitationInputSchema.safeParse({ maxUses }).success).toBe(false);
    for (const extra of ['userId', 'role', 'damage', 'expiresAt'])
      expect(
        issueClassInvitationInputSchema.safeParse({ maxUses: 30, [extra]: 'forged' }).success,
      ).toBe(false);
    expect(
      redeemClassInvitationInputSchema.safeParse({ code: `lqi_${'a'.repeat(64)}` }).success,
    ).toBe(true);
    for (const code of ['', '123456', `lqi_${'a'.repeat(63)}`, `lqi_${'A'.repeat(64)}`])
      expect(redeemClassInvitationInputSchema.safeParse({ code }).success).toBe(false);
    expect(
      redeemClassInvitationInputSchema.safeParse({ code: `lqi_${'a'.repeat(64)}`, role: 'TEACHER' })
        .success,
    ).toBe(false);
  });

  it('rejects leaked identities or invitation secrets in dashboard DTOs', () => {
    const dashboard = {
      lessonClass: {
        id: '018f72a4-cc52-7c5a-a6f9-8b21aa27c101',
        organizationId: '018f72a4-cc52-7c5a-a6f9-8b21aa27c102',
        name: '가상반',
      },
      memberCount: 0,
      invitation: null,
      assignments: [],
    };
    expect(classDashboardSchema.safeParse(dashboard).success).toBe(true);
    for (const field of ['code', 'codeHash', 'studentId', 'students'])
      expect(classDashboardSchema.safeParse({ ...dashboard, [field]: 'private' }).success).toBe(
        false,
      );
  });
});
