import { describe, expect, it } from 'vitest';

import {
  aggregateBossDamage,
  buildSpecialBossKey,
  buildWeeklyBossKey,
  computeBossHp,
  isBossEnabled,
  normalizeBossDifficulty,
} from '../src/index.js';

const CLASS_A = '018f72a4-cc52-7c5a-a6f9-8b21aa27c311';
const CLASS_B = '018f72a4-cc52-7c5a-a6f9-8b21aa27c312';
const STUDENT_A = '018f72a4-cc52-7c5a-a6f9-8b21aa27c321';
const STUDENT_B = '018f72a4-cc52-7c5a-a6f9-8b21aa27c322';

describe('WordQuest-compatible boss rules', () => {
  it('keeps the kill switch off unless the raw value is exactly true', () => {
    expect(isBossEnabled(undefined)).toBe(false);
    expect(isBossEnabled('false')).toBe(false);
    expect(isBossEnabled('1')).toBe(false);
    expect(isBossEnabled(true)).toBe(false);
    expect(isBossEnabled('true')).toBe(true);
  });

  it('builds class-scoped weekly and special keys', () => {
    expect(buildWeeklyBossKey('2026-07-27', CLASS_A)).toBe(`w:2026-07-27:${CLASS_A}`);
    expect(buildSpecialBossKey(1234, CLASS_A)).toBe(`s:1234:${CLASS_A}`);
    expect(buildWeeklyBossKey('2026-07-27', CLASS_B)).not.toBe(
      buildWeeklyBossKey('2026-07-27', CLASS_A),
    );
  });

  it.each([
    ['2026-02-30', CLASS_A],
    ['2026-07-28', CLASS_A],
    ['2026-07-27', 'C1'],
  ])('rejects an unsafe weekly key input: %s / %s', (weekStart, classId) => {
    expect(() => buildWeeklyBossKey(weekStart, classId)).toThrow();
  });

  it.each([
    [0, CLASS_A],
    [1.2, CLASS_A],
    [1, 'C1'],
  ])('rejects an unsafe special key input: %s / %s', (version, classId) => {
    expect(() => buildSpecialBossKey(version, classId)).toThrow();
  });

  it.each([
    [0.7, 0.7],
    [1, 1],
    [1.2, 1.2],
    [1.3, 1.2],
    ['1.3', 1.2],
    [2, 1],
    [undefined, 1],
  ])('normalizes difficulty %s to %s', (raw, expected) => {
    expect(normalizeBossDifficulty(raw)).toBe(expected);
  });

  it.each([
    [{ previousActivityTotal: 2400, memberCount: 24, difficulty: 1 }, 1080],
    [{ previousActivityTotal: 2400, memberCount: 24, difficulty: 1.2 }, 1296],
    [{ previousActivityTotal: 450, memberCount: 6, difficulty: 1 }, 203],
    [{ previousActivityTotal: 450, memberCount: 6, difficulty: 0.7 }, 142],
    [{ previousActivityTotal: 100, memberCount: 1, difficulty: 1 }, 60],
    [{ previousActivityTotal: 0, memberCount: 10, difficulty: 1 }, 150],
    [{ previousActivityTotal: 0, memberCount: 0, difficulty: 1 }, 60],
    [
      {
        previousActivityTotal: 450,
        memberCount: 6,
        difficulty: 0.7,
        tuning: { ratio: 0.5 },
      },
      158,
    ],
    [{ previousActivityTotal: 999_999, memberCount: 9, difficulty: 1.2 }, 60_000],
  ])('preserves the WordQuest HP fixture %#', (input, expected) => {
    expect(computeBossHp(input)).toBe(expected);
  });

  it('clamps tuning and swaps reversed HP limits', () => {
    expect(
      computeBossHp({
        previousActivityTotal: 100,
        memberCount: 1,
        difficulty: 1,
        tuning: { ratio: 9, minHp: 200, maxHp: 100 },
      }),
    ).toBe(200);
  });

  it.each([
    { previousActivityTotal: -1, memberCount: 1, difficulty: 1 },
    { previousActivityTotal: Number.POSITIVE_INFINITY, memberCount: 1, difficulty: 1 },
    { previousActivityTotal: 1.5, memberCount: 1, difficulty: 1 },
    { previousActivityTotal: 1, memberCount: -1, difficulty: 1 },
    { previousActivityTotal: 1, memberCount: 1.5, difficulty: 1 },
    {
      previousActivityTotal: 1,
      memberCount: 1,
      difficulty: 1,
      tuning: { perNewMember: 'invalid' },
    },
  ])('rejects malformed HP input %#', (input) => {
    expect(() => computeBossHp(input)).toThrow();
  });

  it.each([true, [], {}, '0.5', '', Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects coercible or nonfinite ratio %#',
    (ratio) =>
      expect(() =>
        computeBossHp({
          previousActivityTotal: 100,
          memberCount: 1,
          difficulty: 1,
          tuning: { ratio },
        }),
      ).toThrow(),
  );

  it.each([true, [], {}, '15', '', Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects coercible or nonfinite integer tuning %#',
    (perNewMember) =>
      expect(() =>
        computeBossHp({
          previousActivityTotal: 0,
          memberCount: 2,
          difficulty: 1,
          tuning: { perNewMember },
        }),
      ).toThrow(),
  );

  it('canonicalizes UUIDs in campaign keys to lowercase', () => {
    const upper = CLASS_A.toUpperCase();
    expect(buildWeeklyBossKey('2026-07-27', upper)).toBe(`w:2026-07-27:${CLASS_A}`);
    expect(buildSpecialBossKey(1, upper)).toBe(`s:1:${CLASS_A}`);
  });

  it('takes the maximum damage per student for the selected boss', () => {
    const bossKey = buildWeeklyBossKey('2026-07-27', CLASS_A);

    expect(
      aggregateBossDamage(
        [
          { studentId: STUDENT_A, bossKey, damage: 10 },
          { studentId: STUDENT_B, bossKey, damage: 5 },
          { studentId: STUDENT_A, bossKey, damage: 25 },
          {
            studentId: STUDENT_A,
            bossKey: buildSpecialBossKey(9, CLASS_A),
            damage: 100,
          },
          { studentId: STUDENT_B, bossKey, damage: 0 },
        ],
        bossKey,
      ),
    ).toEqual({
      total: 30,
      byStudent: [
        { studentId: STUDENT_A, damage: 25 },
        { studentId: STUDENT_B, damage: 5 },
      ],
    });
  });

  it('rejects malformed aggregation rows instead of coercing them', () => {
    const bossKey = buildWeeklyBossKey('2026-07-27', CLASS_A);

    expect(() => aggregateBossDamage([{ studentId: 'U1', bossKey, damage: 4 }], bossKey)).toThrow();
    expect(() =>
      aggregateBossDamage(
        [{ studentId: STUDENT_A, bossKey, damage: Number.MAX_SAFE_INTEGER + 1 }],
        bossKey,
      ),
    ).toThrow();
  });
});
