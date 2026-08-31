import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ResourceNotFoundError } from '@lessonquest/db';
import { createClassroomFixture } from './classroom-fixture.js';

type Fixture = Awaited<ReturnType<typeof createClassroomFixture>>;
let f: Fixture;
beforeEach(async () => {
  f = await createClassroomFixture();
});
afterEach(async () => {
  await f?.database.close();
});
const issue = (maxUses = 1) =>
  f.classrooms.issueInvitation(
    f.teacher,
    f.organization.id,
    f.lessonClass.id,
    { maxUses },
    f.trace(),
  );
const join = (code: string, student = f.student, org = f.organization.id) =>
  f.classrooms.redeemInvitation(student, org, { code }, f.trace());
const dashboard = () =>
  f.classrooms.getDashboard(f.teacher, f.organization.id, f.lessonClass.id, f.trace());

describe('ClassroomRepository', () => {
  it('lists only owned classes; admin may see colleagues; denied dashboard is audited', async () => {
    expect(await f.classrooms.listClasses(f.teacher, f.organization.id, f.trace())).toEqual([
      { id: f.lessonClass.id, organizationId: f.organization.id, name: '탐험 1반' },
    ]);
    expect(await f.classrooms.listClasses(f.colleague, f.organization.id, f.trace())).toEqual([]);
    await expect(
      f.classrooms.getDashboard(f.colleague, f.organization.id, f.lessonClass.id, f.trace()),
    ).rejects.toThrow(ResourceNotFoundError);
    await f.database.query(
      "UPDATE organization_members SET role='ORG_ADMIN' WHERE organization_id=$1 AND user_id=$2",
      [f.organization.id, f.colleague.userId],
    );
    expect(
      (await f.classrooms.getDashboard(f.colleague, f.organization.id, f.lessonClass.id, f.trace()))
        .memberCount,
    ).toBe(0);
    expect(
      (
        await f.database.query(
          "SELECT outcome FROM audit_logs WHERE action='CLASS_DASHBOARD_READ' ORDER BY occurred_at",
        )
      ).rows,
    ).toEqual([{ outcome: 'DENIED' }, { outcome: 'SUCCEEDED' }]);
  });

  it('stores only a hash, adds only the authenticated student, and replays without consuming capacity', async () => {
    const issued = await issue();
    expect(issued.code).toMatch(/^lqi_[a-f0-9]{64}$/);
    expect(issued.invitation.expiresAt).toBe('2026-09-01T00:00:00.000Z');
    const stored = (await f.database.query('SELECT * FROM class_invitations')).rows;
    expect(JSON.stringify(stored)).not.toContain(issued.code);
    expect(stored[0]).toMatchObject({
      code_hash: createHash('sha256').update(issued.code).digest('hex'),
    });
    expect(await join(issued.code)).toEqual({
      classId: f.lessonClass.id,
      className: '탐험 1반',
      outcome: 'JOINED',
    });
    expect(await join(issued.code)).toMatchObject({ outcome: 'DUPLICATE' });
    expect(await dashboard()).toMatchObject({
      memberCount: 1,
      invitation: { uses: 1 },
      assignments: [],
    });
    await expect(join(issued.code, f.secondStudent)).rejects.toThrow(ResourceNotFoundError);
    const audits = JSON.stringify(
      (await f.database.query("SELECT * FROM audit_logs WHERE action='CLASS_INVITATION_REDEEMED'"))
        .rows,
    );
    expect(audits).toContain('DUPLICATE');
    expect(audits).toContain('DENIED');
    expect(audits).not.toContain(issued.code);
    expect(audits).not.toContain(createHash('sha256').update(issued.code).digest('hex'));
  });

  it('serializes the last available seat and never duplicates memberships', async () => {
    const { code } = await issue();
    const results = await Promise.allSettled([join(code), join(code, f.secondStudent)]);
    expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
    expect(await dashboard()).toMatchObject({ memberCount: 1, invitation: { uses: 1 } });
    expect(
      (await f.database.query('SELECT count(*)::int AS n FROM class_invitation_redemptions')).rows,
    ).toEqual([{ n: 1 }]);
  });

  it('rotates and specifically revokes codes, including lost-response retries', async () => {
    const first = await issue();
    const second = await issue();
    await expect(join(first.code)).rejects.toThrow(ResourceNotFoundError);
    await f.classrooms.revokeInvitation(
      f.teacher,
      f.organization.id,
      f.lessonClass.id,
      first.invitation.id,
      f.trace(),
    );
    expect(await join(second.code)).toMatchObject({ outcome: 'JOINED' });
    for (let count = 0; count < 2; count++)
      expect(
        await f.classrooms.revokeInvitation(
          f.teacher,
          f.organization.id,
          f.lessonClass.id,
          second.invitation.id,
          f.trace(),
        ),
      ).toEqual({ revoked: true });
    await expect(join(second.code)).rejects.toThrow(ResourceNotFoundError);
  });

  it('rejects the exact expiry boundary, wrong tenant, invalid issuer and student role changes', async () => {
    const { code } = await issue(10);
    await expect(join(code, f.student, f.foreignOrganization.id)).rejects.toThrow(
      ResourceNotFoundError,
    );
    await expect(join(code, f.teacher)).rejects.toThrow(ResourceNotFoundError);
    f.setNow('2026-09-01T00:00:00Z');
    await expect(join(code)).rejects.toThrow(ResourceNotFoundError);
    f.setNow('2026-08-31T00:00:00Z');
    await f.database.query("UPDATE users SET platform_role='STUDENT' WHERE id=$1", [
      f.teacher.userId,
    ]);
    await expect(join(code)).rejects.toThrow(ResourceNotFoundError);
    await expect(dashboard()).rejects.toThrow(ResourceNotFoundError);
    expect((await f.database.query('SELECT count(*)::int AS n FROM class_members')).rows).toEqual([
      { n: 0 },
    ]);
  });

  it.each(['organizations', 'classes', 'users', 'organization_members', 'class_members'] as const)(
    'fails closed after %s lifecycle revocation, including replay',
    async (table) => {
      const { code } = await issue();
      await join(code);
      if (table === 'organizations')
        await f.database.query("UPDATE organizations SET status='DISABLED' WHERE id=$1", [
          f.organization.id,
        ]);
      if (table === 'classes')
        await f.database.query("UPDATE classes SET status='DISABLED' WHERE id=$1", [
          f.lessonClass.id,
        ]);
      if (table === 'users')
        await f.database.query("UPDATE users SET status='DISABLED' WHERE id=$1", [
          f.student.userId,
        ]);
      if (table === 'organization_members')
        await f.database.query(
          "UPDATE organization_members SET status='DISABLED' WHERE organization_id=$1 AND user_id=$2",
          [f.organization.id, f.student.userId],
        );
      if (table === 'class_members')
        await f.database.query(
          "UPDATE class_members SET status='DISABLED' WHERE organization_id=$1 AND user_id=$2",
          [f.organization.id, f.student.userId],
        );
      await expect(join(code)).rejects.toThrow(ResourceNotFoundError);
      if (!['organizations', 'classes'].includes(table))
        expect((await dashboard()).memberCount).toBe(0);
    },
  );

  it('rolls back membership and capacity when success auditing fails', async () => {
    const { code } = await issue();
    await f.database
      .exec(`CREATE FUNCTION fail_join_audit() RETURNS TRIGGER AS $$ BEGIN IF NEW.action='CLASS_INVITATION_REDEEMED' THEN RAISE EXCEPTION 'synthetic write failure'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql;
      CREATE TRIGGER fail_join_audit BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION fail_join_audit();`);
    await expect(join(code)).rejects.toThrow();
    expect(await dashboard()).toMatchObject({ memberCount: 0, invitation: { uses: 0 } });
    expect(
      (await f.database.query('SELECT count(*)::int AS n FROM class_invitation_redemptions')).rows,
    ).toEqual([{ n: 0 }]);
  });
});
