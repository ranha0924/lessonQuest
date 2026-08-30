import { describe, expect, it } from 'vitest';

import { projectBossContributions } from '../src/index.js';
import type {
  BossContributionPolicy,
  BossProjectionInput,
  VerifiedBossOutcome,
} from '../src/index.js';

const ORGANIZATION = '018f72a4-cc52-7c5a-a6f9-8b21aa27c301';
const OTHER_ORGANIZATION = '018f72a4-cc52-7c5a-a6f9-8b21aa27c302';
const CLASS = '018f72a4-cc52-7c5a-a6f9-8b21aa27c311';
const OTHER_CLASS = '018f72a4-cc52-7c5a-a6f9-8b21aa27c312';
const STUDENT = '018f72a4-cc52-7c5a-a6f9-8b21aa27c321';
const EVENT_A = '018f72a4-cc52-7c5a-a6f9-8b21aa27c331';
const EVENT_B = '018f72a4-cc52-7c5a-a6f9-8b21aa27c332';
const EVENT_C = '018f72a4-cc52-7c5a-a6f9-8b21aa27c333';
const CAMPAIGN = `w:2026-07-27:${CLASS}`;

const policy: BossContributionPolicy = {
  enabled: true,
  amounts: {
    ANSWER_CORRECT: 4,
    ANSWER_RETRIED: 3,
    EXPERIENCE_COMPLETED: 7,
  },
};

const correctOutcome: VerifiedBossOutcome = {
  organizationId: ORGANIZATION,
  classId: CLASS,
  studentId: STUDENT,
  sourceEventId: EVENT_A,
  kind: 'ANSWER_CORRECT',
  serverAccepted: true,
  firstForRule: true,
  capped: false,
};

const baseInput: BossProjectionInput = {
  organizationId: ORGANIZATION,
  classId: CLASS,
  campaignKey: CAMPAIGN,
  policy,
  existingSourceEventIds: [],
  outcomes: [correctOutcome],
};

describe('projectBossContributions', () => {
  it('stays disabled unless the server-owned policy enables contributions', () => {
    expect(
      projectBossContributions({
        ...baseInput,
        policy: { ...policy, enabled: false },
      }),
    ).toEqual([]);
  });

  it('derives damage from policy rather than accepting an outcome amount', () => {
    expect(projectBossContributions(baseInput)).toEqual([
      {
        organizationId: ORGANIZATION,
        classId: CLASS,
        campaignKey: CAMPAIGN,
        studentId: STUDENT,
        sourceEventId: EVENT_A,
        amount: 4,
        reason: 'answer_correct',
      },
    ]);
  });

  it('uses one lowercase canonical campaign key', () => {
    const result = projectBossContributions({ ...baseInput, campaignKey: CAMPAIGN.toUpperCase() });
    expect(result[0]?.campaignKey).toBe(CAMPAIGN);
  });

  it('maps every verified outcome kind to its configured amount and reason', () => {
    const outcomes: VerifiedBossOutcome[] = [
      correctOutcome,
      { ...correctOutcome, sourceEventId: EVENT_B, kind: 'ANSWER_RETRIED' },
      { ...correctOutcome, sourceEventId: EVENT_C, kind: 'EXPERIENCE_COMPLETED' },
    ];

    expect(projectBossContributions({ ...baseInput, outcomes })).toEqual([
      {
        organizationId: ORGANIZATION,
        classId: CLASS,
        campaignKey: CAMPAIGN,
        studentId: STUDENT,
        sourceEventId: EVENT_A,
        amount: 4,
        reason: 'answer_correct',
      },
      {
        organizationId: ORGANIZATION,
        classId: CLASS,
        campaignKey: CAMPAIGN,
        studentId: STUDENT,
        sourceEventId: EVENT_B,
        amount: 3,
        reason: 'answer_retried',
      },
      {
        organizationId: ORGANIZATION,
        classId: CLASS,
        campaignKey: CAMPAIGN,
        studentId: STUDENT,
        sourceEventId: EVENT_C,
        amount: 7,
        reason: 'experience_completed',
      },
    ]);
  });

  it('deduplicates existing and repeated source events', () => {
    expect(
      projectBossContributions({
        ...baseInput,
        existingSourceEventIds: [EVENT_A],
        outcomes: [correctOutcome, correctOutcome],
      }),
    ).toEqual([]);

    expect(
      projectBossContributions({
        ...baseInput,
        outcomes: [correctOutcome, correctOutcome],
      }),
    ).toHaveLength(1);
  });

  it('does not let a later duplicate turn a rejected outcome into damage', () => {
    expect(
      projectBossContributions({
        ...baseInput,
        outcomes: [
          { ...correctOutcome, capped: true },
          { ...correctOutcome, capped: false },
        ],
      }),
    ).toEqual([]);
  });

  it.each([
    { firstForRule: false },
    { capped: true },
    { organizationId: OTHER_ORGANIZATION },
    { classId: OTHER_CLASS },
  ])('skips an outcome outside the accepted rule boundary: %#', (change) => {
    expect(
      projectBossContributions({
        ...baseInput,
        outcomes: [{ ...correctOutcome, ...change }],
      }),
    ).toEqual([]);
  });

  it('does not emit a contribution when the configured amount is zero', () => {
    expect(
      projectBossContributions({
        ...baseInput,
        policy: {
          ...policy,
          amounts: { ...policy.amounts, ANSWER_CORRECT: 0 },
        },
      }),
    ).toEqual([]);
  });

  it.each([
    { ...baseInput, organizationId: 'org-1' },
    { ...baseInput, campaignKey: `w:2026-07-28:${CLASS}` },
    { ...baseInput, campaignKey: `w:2026-07-27:${OTHER_CLASS}` },
    {
      ...baseInput,
      policy: { ...policy, amounts: { ...policy.amounts, ANSWER_CORRECT: 10_001 } },
    },
    {
      ...baseInput,
      outcomes: [{ ...correctOutcome, serverAccepted: false }],
    },
    {
      ...baseInput,
      outcomes: [{ ...correctOutcome, amount: 9_999 }],
    },
  ])('rejects malformed or client-shaped projection input %#', (input) => {
    expect(() => projectBossContributions(input as BossProjectionInput)).toThrow();
  });
});
