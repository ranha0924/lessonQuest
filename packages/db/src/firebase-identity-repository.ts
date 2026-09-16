import type { SqlQueryable } from './sql.js';
import { actorSchema, type Actor } from '@lessonquest/contracts';

export class FirebaseIdentityRepository {
  constructor(private readonly database: SqlQueryable) {}
  async findActor(projectId: string, uid: string): Promise<Actor | null> {
    if (
      typeof projectId !== 'string' ||
      typeof uid !== 'string' ||
      !/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(projectId) ||
      !/^[A-Za-z0-9:_-]{1,128}$/.test(uid)
    )
      return null;
    const result = await this.database.query<{
      userId: string;
      platformRole: string;
      memberships: unknown;
    }>(
      `SELECT u.id AS "userId", u.platform_role AS "platformRole",
        COALESCE(jsonb_agg(jsonb_build_object('organizationId',m.organization_id,'role',m.role)
          ORDER BY m.organization_id) FILTER (WHERE m.organization_id IS NOT NULL),'[]'::jsonb) AS memberships
       FROM firebase_identities f
       JOIN users u ON u.id=f.user_id AND u.status='ACTIVE'
       LEFT JOIN organization_members m ON m.user_id=u.id AND m.status='ACTIVE'
         AND ((u.platform_role='STUDENT' AND m.role='STUDENT')
           OR (u.platform_role IN ('TEACHER','SUPER_ADMIN') AND m.role IN ('TEACHER','ORG_ADMIN')))
         AND EXISTS (SELECT 1 FROM organizations o WHERE o.id=m.organization_id AND o.status='ACTIVE')
       WHERE f.project_id=$1 AND f.uid=$2 AND f.status='ACTIVE'
       GROUP BY u.id, u.platform_role`,
      [projectId, uid],
    );
    const parsed = actorSchema.safeParse(result.rows[0]);
    return parsed.success ? parsed.data : null;
  }
}
