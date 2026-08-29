import { uuidSchema } from '@lessonquest/contracts';
import { z } from 'zod';

export type BossDifficulty = 0.7 | 1 | 1.2;

export interface BossHpInput {
  previousActivityTotal: number;
  memberCount: number;
  difficulty: unknown;
  tuning?: {
    ratio?: unknown;
    perNewMember?: unknown;
    minHp?: unknown;
    maxHp?: unknown;
  };
}

export interface BossDamageRow {
  studentId: string;
  bossKey: string;
  damage: number;
}

export interface BossDamageAggregate {
  total: number;
  byStudent: ReadonlyArray<{ studentId: string; damage: number }>;
}

const safeIntegerSchema = z.int().min(Number.MIN_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER);
const nonNegativeSafeIntegerSchema = safeIntegerSchema.min(0);

const bossDamageRowSchema = z.strictObject({
  studentId: uuidSchema,
  bossKey: z.string(),
  damage: safeIntegerSchema,
});

function parseCalendarDate(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new RangeError('Boss week start must use YYYY-MM-DD.');
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new RangeError('Boss week start must be a real calendar date.');
  }
  return date;
}

function parseWeeklyKey(value: string): { weekStart: string; classId: string } | null {
  const match = /^w:(\d{4}-\d{2}-\d{2}):(.+)$/.exec(value);
  if (!match) return null;

  const weekStart = match[1];
  const classId = match[2];
  if (weekStart === undefined || classId === undefined) return null;

  try {
    const date = parseCalendarDate(weekStart);
    if (date.getUTCDay() !== 1) return null;
    uuidSchema.parse(classId);
    return { weekStart, classId };
  } catch {
    return null;
  }
}

function parseSpecialKey(value: string): { version: number; classId: string } | null {
  const match = /^s:([1-9]\d*):(.+)$/.exec(value);
  if (!match) return null;

  const rawVersion = match[1];
  const classId = match[2];
  if (rawVersion === undefined || classId === undefined) return null;

  const version = Number(rawVersion);
  if (!Number.isSafeInteger(version) || version <= 0) return null;
  if (!uuidSchema.safeParse(classId).success) return null;
  return { version, classId };
}

export const bossCampaignKeySchema = z
  .string()
  .min(1)
  .max(240)
  .refine(
    (value) => parseWeeklyKey(value) !== null || parseSpecialKey(value) !== null,
    'Boss campaign key must contain a valid period and class UUID.',
  );

export function bossCampaignClassId(bossKey: string): string {
  const parsed = parseWeeklyKey(bossKey) ?? parseSpecialKey(bossKey);
  if (parsed === null) {
    throw new RangeError('Boss campaign key is invalid.');
  }
  return parsed.classId;
}

export function isBossEnabled(rawValue: unknown): boolean {
  return rawValue === 'true';
}

export function normalizeBossDifficulty(rawValue: unknown): BossDifficulty {
  const value = Number(rawValue);
  if (value === 0.7) return 0.7;
  if (value === 1.2 || value === 1.3) return 1.2;
  return 1;
}

export function buildWeeklyBossKey(weekStart: string, classId: string): string {
  const parsedClassId = uuidSchema.parse(classId);
  const date = parseCalendarDate(weekStart);
  if (date.getUTCDay() !== 1) {
    throw new RangeError('Boss week start must be a Monday.');
  }
  return `w:${weekStart}:${parsedClassId}`;
}

export function buildSpecialBossKey(version: number, classId: string): string {
  if (!Number.isSafeInteger(version) || version <= 0) {
    throw new RangeError('Special boss version must be a positive safe integer.');
  }
  return `s:${version}:${uuidSchema.parse(classId)}`;
}

function parseRatio(rawValue: unknown): number {
  if (rawValue === undefined || rawValue === null || rawValue === '') return 0.45;
  const value = Number(rawValue);
  if (!Number.isFinite(value)) {
    throw new RangeError('Boss ratio must be a finite number.');
  }
  return Math.min(5, Math.max(0.05, value));
}

function parsePositiveTuningInteger(rawValue: unknown, defaultValue: number, name: string): number {
  if (rawValue === undefined || rawValue === null || rawValue === '') return defaultValue;
  const value = Number(rawValue);
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new RangeError(`${name} must be a positive safe integer.`);
  }
  return value;
}

export function computeBossHp(input: BossHpInput): number {
  const previousActivityTotal = nonNegativeSafeIntegerSchema.parse(input.previousActivityTotal);
  const memberCount = nonNegativeSafeIntegerSchema.parse(input.memberCount);
  const tuning = input.tuning ?? {};
  const ratio = parseRatio(tuning.ratio);
  const perNewMember = parsePositiveTuningInteger(tuning.perNewMember, 15, 'perNewMember');
  let minHp = parsePositiveTuningInteger(tuning.minHp, 60, 'minHp');
  let maxHp = parsePositiveTuningInteger(tuning.maxHp, 60_000, 'maxHp');

  if (minHp > maxHp) [minHp, maxHp] = [maxHp, minHp];

  const rawHp =
    previousActivityTotal > 0
      ? Math.round(ratio * previousActivityTotal * normalizeBossDifficulty(input.difficulty))
      : (memberCount > 0 ? memberCount : 3) * perNewMember;

  return Math.min(maxHp, Math.max(minHp, rawHp));
}

export function aggregateBossDamage(
  rows: readonly BossDamageRow[],
  bossKey: string,
): BossDamageAggregate {
  const parsedBossKey = bossCampaignKeySchema.parse(bossKey);
  const parsedRows = z.array(bossDamageRowSchema).parse(rows);
  const maximumByStudent = new Map<string, number>();

  for (const row of parsedRows) {
    const rowBossKey = bossCampaignKeySchema.parse(row.bossKey);
    if (rowBossKey !== parsedBossKey || row.damage <= 0) continue;

    const previous = maximumByStudent.get(row.studentId) ?? 0;
    if (row.damage > previous) maximumByStudent.set(row.studentId, row.damage);
  }

  const byStudent = [...maximumByStudent]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([studentId, damage]) => ({ studentId, damage }));
  let total = 0;
  for (const { damage } of byStudent) {
    total += damage;
    if (!Number.isSafeInteger(total)) {
      throw new RangeError('Boss damage total exceeds the safe integer range.');
    }
  }

  return { total, byStudent };
}
