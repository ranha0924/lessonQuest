import { describe, expect, it } from 'vitest';

describe('real development preview runtime', () => {
  it('isolates synthetic identities and drains an outstanding write before reset closes the database', async () => {
    const module = await import('../src/dev-preview/runtime.js').catch(() => null);
    expect(module, 'A real browser-local runtime is required').not.toBeNull();
    if (module === null) return;
    const runtime = await module.createPreviewRuntime();
    try {
      expect(await runtime.studentApi.listStudentAssignments(runtime.organizationId)).toEqual([]);
      await expect(
        runtime.studentApi.createScienceExperience(runtime.organizationId, {
          title: '학생 작성 금지',
          generatedSpecText: runtime.sampleDraft.generatedSpecText,
        }),
      ).rejects.toMatchObject({ status: 404 });
      await expect(
        runtime.studentApi.getStudentBossProgress(crypto.randomUUID(), runtime.classId),
      ).rejects.toMatchObject({ status: 404 });
      const write = runtime.teacherApi.createScienceExperience(
        runtime.organizationId,
        runtime.sampleDraft,
      );
      const close = runtime.close();
      await expect(write).resolves.toHaveProperty('versionId');
      await close;
      await expect(
        runtime.teacherApi.getTeacherBossDetail(runtime.organizationId, runtime.classId),
      ).rejects.toThrow('Preview runtime is closed');
    } finally {
      await runtime.close();
    }
    const fresh = await module.createPreviewRuntime();
    try {
      expect(fresh.organizationId).not.toBe(runtime.organizationId);
      expect(await fresh.studentApi.listStudentAssignments(fresh.organizationId)).toEqual([]);
      expect(
        await fresh.studentApi.getStudentBossProgress(fresh.organizationId, fresh.classId),
      ).toMatchObject({ damage: 0, targetHp: 100 });
    } finally {
      await fresh.close();
    }
  });
});
