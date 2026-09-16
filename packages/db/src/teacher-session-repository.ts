import {
  actorSchema,
  teacherSessionSchema,
  type Actor,
  type TeacherSession,
} from '@lessonquest/contracts';
import type { SqlQueryable } from './sql.js';
import { AuthorizationError } from './tenant-repository.js';
export class TeacherSessionRepository {
  constructor(private readonly database: SqlQueryable) {}
  async get(actor: Actor): Promise<TeacherSession> {
    const parsed = actorSchema.safeParse(actor);
    if (!parsed.success || parsed.data.platformRole !== 'TEACHER') throw new AuthorizationError();
    const result = await this.database.query<{ userId: string; organizations: unknown }>(
      `
      SELECT u.id AS "userId", COALESCE(jsonb_agg(jsonb_build_object('id',o.id,'name',o.name) ORDER BY o.id)
        FILTER(WHERE o.id IS NOT NULL),'[]'::jsonb) AS organizations
      FROM users u LEFT JOIN organization_members m ON m.user_id=u.id AND m.status='ACTIVE' AND m.role IN ('TEACHER','ORG_ADMIN')
      LEFT JOIN organizations o ON o.id=m.organization_id AND o.status='ACTIVE'
      WHERE u.id=$1 AND u.status='ACTIVE' AND u.platform_role='TEACHER' GROUP BY u.id`,
      [parsed.data.userId],
    );
    const session = teacherSessionSchema.safeParse({
      ...result.rows[0],
      aiGeneration: 'AI_BILLING_NOT_CONFIGURED',
    });
    if (!session.success) throw new AuthorizationError();
    return session.data;
  }
}
