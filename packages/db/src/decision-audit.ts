import { randomUUID } from 'node:crypto';

import type { PGliteInterface } from '@electric-sql/pglite';

import { ConflictError, ResourceNotFoundError } from './tenant-repository.js';

interface DecisionAudit {
  traceId: string;
  actorUserId: string;
  organizationId: string;
  action:
    | 'RASA_HINT_REQUESTED'
    | 'BOSS_CAMPAIGN_CREATED'
    | 'BOSS_CAMPAIGN_ENDED'
    | 'BOSS_PROGRESS_READ'
    | 'BOSS_DETAIL_READ';
  resourceType: 'RASA_REQUEST' | 'CLASS' | 'BOSS_CAMPAIGN';
  resourceId: string;
}

// Call only after repository input parsing, with an operation that owns its
// transaction. The catch runs after rollback, so the decision survives it.
export async function withDecisionAudit<T>(
  database: PGliteInterface,
  audit: DecisionAudit,
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    const outcome =
      error instanceof ResourceNotFoundError
        ? 'DENIED'
        : error instanceof ConflictError
          ? 'CONFLICT'
          : null;
    if (outcome !== null) {
      // Scope IDs describe the attempted access, not verified membership or
      // existence. Never look up or copy protected resource content here.
      await database.query(
        `INSERT INTO audit_logs
          (id,trace_id,actor_user_id,organization_id,action,resource_type,resource_id,outcome)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          randomUUID(),
          audit.traceId,
          audit.actorUserId,
          audit.organizationId,
          audit.action,
          audit.resourceType,
          audit.resourceId,
          outcome,
        ],
      );
    }
    throw error;
  }
}
