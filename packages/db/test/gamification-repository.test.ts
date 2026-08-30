import { PGlite } from '@electric-sql/pglite';
import type { Actor } from '@lessonquest/contracts';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { GamificationRepository, initializeSchema, TenantRepository } from '../src/index.js';

const teacher: Actor = {
  userId: '018f72a4-cc52-7c5a-a6f9-8b21aa27b101',
  platformRole: 'TEACHER',
  memberships: [],
};
const student: Actor = {
  userId: '018f72a4-cc52-7c5a-a6f9-8b21aa27b102',
  platformRole: 'STUDENT',
  memberships: [],
};

describe('GamificationRepository', () => {
  let database: PGlite;
  beforeEach(async () => {
    database = new PGlite();
    await initializeSchema(database);
  });
  afterEach(async () => {
    await database.close();
  });

  it('keeps one teacher-owned campaign and exposes aggregate-only student progress', async () => {
    const tenants = new TenantRepository(database);
    await tenants.upsertUser(teacher);
    await tenants.upsertUser(student);
    const org = await tenants.createOrganization(teacher, '별빛중');
    const lessonClass = await tenants.createClass(teacher, org.id, '1반');
    await tenants.addStudentToClass(teacher, org.id, lessonClass.id, student.userId);
    const repository = new GamificationRepository(database, {
      createId: (() => {
        let i = 200;
        return () => `018f72a4-cc52-7c5a-a6f9-8b21aa27b${i++}`;
      })(),
      now: () => new Date('2026-08-30T12:00:00Z'),
    });
    const input = {
      title: '관성 보스',
      period: { kind: 'WEEKLY' as const, weekStart: '2026-08-24' },
      targetHp: 100,
      policy: { amounts: { ANSWER_CORRECT: 2, ANSWER_RETRIED: 3, EXPERIENCE_COMPLETED: 5 } },
    };
    const detail = await repository.createCampaign(
      teacher,
      org.id,
      lessonClass.id,
      input,
      '018f72a4-cc52-7c5a-a6f9-8b21aa27b301',
    );
    expect(detail.campaign).toMatchObject({ title: '관성 보스', targetHp: 100, damage: 0 });
    await expect(
      repository.createCampaign(
        teacher,
        org.id,
        lessonClass.id,
        input,
        '018f72a4-cc52-7c5a-a6f9-8b21aa27b302',
      ),
    ).rejects.toThrow();
    const studentView = await repository.getStudentProgress(
      student,
      org.id,
      lessonClass.id,
      '018f72a4-cc52-7c5a-a6f9-8b21aa27b303',
    );
    expect(studentView).toEqual({
      campaignId: detail.campaign.campaignId,
      title: '관성 보스',
      targetHp: 100,
      damage: 0,
      completed: false,
    });
    expect(JSON.stringify(studentView)).not.toContain(student.userId);
    await expect(
      repository.createCampaign(
        student,
        org.id,
        lessonClass.id,
        input,
        '018f72a4-cc52-7c5a-a6f9-8b21aa27b304',
      ),
    ).rejects.toThrow();
  });
});
