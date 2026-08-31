import { createHash, randomUUID } from 'node:crypto';
import type { PGliteInterface, Transaction } from '@electric-sql/pglite';
import {
  actorSchema,
  uuidSchema,
  issueClassInvitationInputSchema,
  redeemClassInvitationInputSchema,
  classDashboardSchema,
  type Actor,
  type ClassroomSummary,
  type ClassInvitation,
  type IssuedClassInvitation,
  type RedeemedClassInvitation,
  type ClassDashboard,
  type IssueClassInvitationInput,
  type RedeemClassInvitationInput,
} from '@lessonquest/contracts';
import { withDecisionAudit } from './decision-audit.js';
import { ResourceNotFoundError } from './tenant-repository.js';

type Action =
  | 'CLASS_LISTED'
  | 'CLASS_DASHBOARD_READ'
  | 'CLASS_INVITATION_ISSUED'
  | 'CLASS_INVITATION_REVOKED'
  | 'CLASS_INVITATION_REDEEMED';
interface Scope {
  actor: Actor;
  organizationId: string;
  traceId: string;
}
interface ClassRow {
  id: string;
  organization_id: string;
  name: string;
}
interface InvitationRow {
  id: string;
  class_id: string;
  expires_at: string | Date;
  max_uses: number;
  uses: number;
  status: 'ACTIVE' | 'REVOKED';
  created_by: string;
}
const toClass = (row: ClassRow): ClassroomSummary => ({
  id: row.id,
  organizationId: row.organization_id,
  name: row.name,
});
const toInvitation = (row: InvitationRow): ClassInvitation => ({
  id: row.id,
  classId: row.class_id,
  expiresAt: new Date(row.expires_at).toISOString(),
  maxUses: row.max_uses,
  uses: row.uses,
  status: row.status,
});
const parseScope = (actor: Actor, organizationId: string, traceId: string): Scope => ({
  actor: actorSchema.parse(actor),
  organizationId: uuidSchema.parse(organizationId),
  traceId: uuidSchema.parse(traceId),
});

export class ClassroomRepository {
  private readonly now: () => Date;
  constructor(
    private readonly database: PGliteInterface,
    options: { now?: () => Date } = {},
  ) {
    this.now = options.now ?? (() => new Date());
  }

  private run<T>(
    scope: Scope,
    action: Action,
    resourceId: string | null,
    operation: (tx: Transaction) => Promise<T>,
  ): Promise<T> {
    return withDecisionAudit(
      this.database,
      {
        traceId: scope.traceId,
        actorUserId: scope.actor.userId,
        organizationId: scope.organizationId,
        action,
        resourceType: 'CLASS',
        resourceId,
      },
      () => this.database.transaction(operation),
    );
  }

  private async audit(
    tx: Transaction,
    scope: Scope,
    action: Action,
    resourceId: string | null,
    outcome: 'SUCCEEDED' | 'DUPLICATE' = 'SUCCEEDED',
  ) {
    await tx.query(
      `INSERT INTO audit_logs(id,trace_id,actor_user_id,organization_id,action,resource_type,resource_id,outcome) VALUES($1,$2,$3,$4,$5,'CLASS',$6,$7)`,
      [
        randomUUID(),
        scope.traceId,
        scope.actor.userId,
        scope.organizationId,
        action,
        resourceId,
        outcome,
      ],
    );
  }

  private async requireTeacher(tx: Transaction, scope: Scope, classId: string): Promise<ClassRow> {
    const result = await tx.query<ClassRow>(
      `SELECT c.id,c.organization_id,c.name FROM classes c
      JOIN organizations o ON o.id=c.organization_id AND o.status='ACTIVE'
      JOIN organization_members m ON m.organization_id=c.organization_id AND m.user_id=$1 AND m.status='ACTIVE' AND m.role IN ('TEACHER','ORG_ADMIN')
      JOIN users u ON u.id=m.user_id AND u.status='ACTIVE' AND u.platform_role IN ('TEACHER','SUPER_ADMIN')
      WHERE c.organization_id=$2 AND c.id=$3 AND c.status='ACTIVE' AND (c.owner_teacher_id=$1 OR m.role='ORG_ADMIN')
      FOR UPDATE OF c FOR SHARE OF o,m,u`,
      [scope.actor.userId, scope.organizationId, classId],
    );
    const row = result.rows[0];
    if (row === undefined) throw new ResourceNotFoundError();
    return row;
  }

  async listClasses(
    actor: Actor,
    organizationId: string,
    traceId: string,
  ): Promise<ClassroomSummary[]> {
    const scope = parseScope(actor, organizationId, traceId);
    return this.run(scope, 'CLASS_LISTED', null, async (tx) => {
      const authority = await tx.query<{ role: string }>(
        `SELECT m.role FROM organization_members m
        JOIN organizations o ON o.id=m.organization_id AND o.status='ACTIVE'
        JOIN users u ON u.id=m.user_id AND u.status='ACTIVE' AND u.platform_role IN ('TEACHER','SUPER_ADMIN')
        WHERE m.organization_id=$1 AND m.user_id=$2 AND m.status='ACTIVE' AND m.role IN ('TEACHER','ORG_ADMIN') FOR SHARE OF m,o,u`,
        [organizationId, actor.userId],
      );
      if (authority.rows[0] === undefined) throw new ResourceNotFoundError();
      const result = await tx.query<ClassRow>(
        `SELECT id,organization_id,name FROM classes WHERE organization_id=$1 AND status='ACTIVE' AND (owner_teacher_id=$2 OR $3='ORG_ADMIN') ORDER BY created_at,id`,
        [organizationId, actor.userId, authority.rows[0]['role']],
      );
      await this.audit(tx, scope, 'CLASS_LISTED', null);
      return result.rows.map(toClass);
    });
  }

  async issueInvitation(
    actor: Actor,
    organizationId: string,
    classIdInput: string,
    value: IssueClassInvitationInput,
    traceId: string,
  ): Promise<IssuedClassInvitation> {
    const scope = parseScope(actor, organizationId, traceId),
      classId = uuidSchema.parse(classIdInput);
    const input = issueClassInvitationInputSchema.parse(value);
    return this.run(scope, 'CLASS_INVITATION_ISSUED', classId, async (tx) => {
      await this.requireTeacher(tx, scope, classId);
      const code = `lqi_${randomUUID().replaceAll('-', '')}${randomUUID().replaceAll('-', '')}`;
      const hash = createHash('sha256').update(code).digest('hex');
      await tx.query(
        "UPDATE class_invitations SET status='REVOKED' WHERE organization_id=$1 AND class_id=$2 AND status='ACTIVE'",
        [organizationId, classId],
      );
      const result = await tx.query<InvitationRow>(
        `INSERT INTO class_invitations(id,organization_id,class_id,created_by,code_hash,max_uses,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [
          randomUUID(),
          organizationId,
          classId,
          actor.userId,
          hash,
          input.maxUses,
          new Date(this.now().getTime() + 86400000).toISOString(),
        ],
      );
      const row = result.rows[0];
      if (row === undefined) throw new Error('Invitation creation failed');
      await this.audit(tx, scope, 'CLASS_INVITATION_ISSUED', classId);
      return { invitation: toInvitation(row), code };
    });
  }

  async revokeInvitation(
    actor: Actor,
    organizationId: string,
    classIdInput: string,
    invitationIdInput: string,
    traceId: string,
  ): Promise<{ revoked: true }> {
    const scope = parseScope(actor, organizationId, traceId),
      classId = uuidSchema.parse(classIdInput),
      invitationId = uuidSchema.parse(invitationIdInput);
    return this.run(scope, 'CLASS_INVITATION_REVOKED', classId, async (tx) => {
      await this.requireTeacher(tx, scope, classId);
      const row = (
        await tx.query<{ status: string }>(
          'SELECT status FROM class_invitations WHERE organization_id=$1 AND class_id=$2 AND id=$3 FOR UPDATE',
          [organizationId, classId, invitationId],
        )
      ).rows[0];
      if (row === undefined) throw new ResourceNotFoundError();
      await tx.query("UPDATE class_invitations SET status='REVOKED' WHERE id=$1", [invitationId]);
      await this.audit(
        tx,
        scope,
        'CLASS_INVITATION_REVOKED',
        classId,
        row.status === 'REVOKED' ? 'DUPLICATE' : 'SUCCEEDED',
      );
      return { revoked: true };
    });
  }

  async redeemInvitation(
    actor: Actor,
    organizationId: string,
    value: RedeemClassInvitationInput,
    traceId: string,
  ): Promise<RedeemedClassInvitation> {
    const scope = parseScope(actor, organizationId, traceId),
      input = redeemClassInvitationInputSchema.parse(value);
    return this.run(scope, 'CLASS_INVITATION_REDEEMED', null, async (tx) => {
      const hash = createHash('sha256').update(input.code).digest('hex');
      const candidate = (
        await tx.query<InvitationRow>(
          'SELECT * FROM class_invitations WHERE organization_id=$1 AND code_hash=$2',
          [organizationId, hash],
        )
      ).rows[0];
      if (candidate === undefined) throw new ResourceNotFoundError();
      // All invitation operations lock class before invitation. Recheck after
      // obtaining the class lock so rotation and concurrent redemption serialize.
      const lessonClass = await this.requireTeacher(
        tx,
        { ...scope, actor: { ...scope.actor, userId: candidate.created_by } },
        candidate.class_id,
      );
      const invitation = (
        await tx.query<InvitationRow>('SELECT * FROM class_invitations WHERE id=$1 FOR UPDATE', [
          candidate.id,
        ])
      ).rows[0];
      if (
        invitation === undefined ||
        invitation.status !== 'ACTIVE' ||
        new Date(invitation.expires_at).getTime() <= this.now().getTime()
      )
        throw new ResourceNotFoundError();
      const student = await tx.query(
        "SELECT id FROM users WHERE id=$1 AND status='ACTIVE' AND platform_role='STUDENT' FOR SHARE",
        [actor.userId],
      );
      if (student.rows[0] === undefined) throw new ResourceNotFoundError();
      const membership = (
        await tx.query<{ role: string; status: string }>(
          'SELECT role,status FROM organization_members WHERE organization_id=$1 AND user_id=$2 FOR UPDATE',
          [organizationId, actor.userId],
        )
      ).rows[0];
      if (
        membership !== undefined &&
        (membership.role !== 'STUDENT' || membership.status !== 'ACTIVE')
      )
        throw new ResourceNotFoundError();
      const existing = (
        await tx.query<{ status: string }>(
          'SELECT status FROM class_members WHERE organization_id=$1 AND class_id=$2 AND user_id=$3 FOR UPDATE',
          [organizationId, candidate.class_id, actor.userId],
        )
      ).rows[0];
      if (existing !== undefined && existing.status !== 'ACTIVE') throw new ResourceNotFoundError();
      if (existing !== undefined) {
        await this.audit(tx, scope, 'CLASS_INVITATION_REDEEMED', candidate.class_id, 'DUPLICATE');
        return { classId: lessonClass.id, className: lessonClass.name, outcome: 'DUPLICATE' };
      }
      const reserved = await tx.query(
        'UPDATE class_invitations SET uses=uses+1 WHERE id=$1 AND uses<max_uses RETURNING id',
        [candidate.id],
      );
      if (reserved.rows[0] === undefined) throw new ResourceNotFoundError();
      if (membership === undefined)
        await tx.query(
          "INSERT INTO organization_members(organization_id,user_id,role) VALUES($1,$2,'STUDENT')",
          [organizationId, actor.userId],
        );
      await tx.query(
        "INSERT INTO class_members(organization_id,class_id,user_id,role) VALUES($1,$2,$3,'STUDENT')",
        [organizationId, candidate.class_id, actor.userId],
      );
      await tx.query(
        'INSERT INTO class_invitation_redemptions(organization_id,class_id,invitation_id,student_id) VALUES($1,$2,$3,$4)',
        [organizationId, candidate.class_id, candidate.id, actor.userId],
      );
      await this.audit(tx, scope, 'CLASS_INVITATION_REDEEMED', candidate.class_id);
      return { classId: lessonClass.id, className: lessonClass.name, outcome: 'JOINED' };
    });
  }

  async getDashboard(
    actor: Actor,
    organizationId: string,
    classIdInput: string,
    traceId: string,
  ): Promise<ClassDashboard> {
    const scope = parseScope(actor, organizationId, traceId),
      classId = uuidSchema.parse(classIdInput);
    return this.run(scope, 'CLASS_DASHBOARD_READ', classId, async (tx) => {
      const lessonClass = await this.requireTeacher(tx, scope, classId);
      const activeStudents = `SELECT cm.user_id FROM class_members cm
        JOIN organization_members m ON m.organization_id=cm.organization_id AND m.user_id=cm.user_id AND m.status='ACTIVE' AND m.role='STUDENT'
        JOIN users u ON u.id=cm.user_id AND u.status='ACTIVE' AND u.platform_role='STUDENT'
        WHERE cm.organization_id=$1 AND cm.class_id=$2 AND cm.status='ACTIVE'`;
      const members = await tx.query<{ n: number }>(
        `SELECT count(*)::int n FROM (${activeStudents}) active`,
        [organizationId, classId],
      );
      const assignments = await tx.query<{
        assignmentId: string;
        title: string;
        startedCount: number;
        completedCount: number;
        wrongAnswers: number;
        retries: number;
        hintsUsed: number;
      }>(
        `WITH active AS (${activeStudents})
        SELECT a.id AS "assignmentId",e.title,
          count(p.student_id) FILTER (WHERE p.started)::int AS "startedCount",
          count(p.student_id) FILTER (WHERE p.completed)::int AS "completedCount",
          COALESCE(sum(p.wrong_answers),0)::int AS "wrongAnswers",COALESCE(sum(p.retries),0)::int retries,COALESCE(sum(p.hints_used),0)::int AS "hintsUsed"
        FROM assignments a
        JOIN experience_versions v ON v.organization_id=a.organization_id AND v.id=a.experience_version_id AND v.status='PUBLISHED'
        JOIN experiences e ON e.organization_id=v.organization_id AND e.id=v.experience_id
        LEFT JOIN student_progress p ON p.organization_id=a.organization_id AND p.assignment_id=a.id AND p.student_id IN (SELECT user_id FROM active)
        WHERE a.organization_id=$1 AND a.class_id=$2 AND a.status='ACTIVE'
        GROUP BY a.id,e.title,a.created_at ORDER BY a.created_at,a.id`,
        [organizationId, classId],
      );
      const invite = (
        await tx.query<InvitationRow>(
          "SELECT * FROM class_invitations WHERE organization_id=$1 AND class_id=$2 AND status='ACTIVE'",
          [organizationId, classId],
        )
      ).rows[0];
      const dashboard = classDashboardSchema.parse({
        lessonClass: toClass(lessonClass),
        memberCount: members.rows[0]?.n ?? 0,
        invitation: invite === undefined ? null : toInvitation(invite),
        assignments: assignments.rows,
      });
      await this.audit(tx, scope, 'CLASS_DASHBOARD_READ', classId);
      return dashboard;
    });
  }
}
