import type { PGliteInterface } from '@electric-sql/pglite';

const schemaSql = `
  CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY,
    platform_role TEXT NOT NULL CHECK (platform_role IN ('STUDENT', 'TEACHER', 'SUPER_ADMIN')),
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'DISABLED'))
  );

  CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
    created_by UUID NOT NULL REFERENCES users(id),
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'DISABLED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS organization_members (
    organization_id UUID NOT NULL REFERENCES organizations(id),
    user_id UUID NOT NULL REFERENCES users(id),
    role TEXT NOT NULL CHECK (role IN ('STUDENT', 'TEACHER', 'ORG_ADMIN')),
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'DISABLED')),
    PRIMARY KEY (organization_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS classes (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    owner_teacher_id UUID NOT NULL,
    name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'DISABLED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (organization_id, id),
    FOREIGN KEY (organization_id, owner_teacher_id)
      REFERENCES organization_members(organization_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS class_members (
    organization_id UUID NOT NULL,
    class_id UUID NOT NULL,
    user_id UUID NOT NULL,
    role TEXT NOT NULL CHECK (role = 'STUDENT'),
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'DISABLED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (organization_id, class_id, user_id),
    FOREIGN KEY (organization_id, class_id)
      REFERENCES classes(organization_id, id),
    FOREIGN KEY (organization_id, user_id)
      REFERENCES organization_members(organization_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS experiences (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    owner_id UUID NOT NULL,
    public_id TEXT NOT NULL CHECK (public_id ~ '^[a-z0-9]+(?:_[a-z0-9]+)*$'),
    title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
    subject TEXT NOT NULL CHECK (subject = 'science'),
    status TEXT NOT NULL CHECK (status IN ('DRAFT', 'ACTIVE', 'RETIRED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (organization_id, id),
    UNIQUE (organization_id, public_id),
    FOREIGN KEY (organization_id, owner_id)
      REFERENCES organization_members(organization_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS experience_versions (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL,
    experience_id UUID NOT NULL,
    version INTEGER NOT NULL CHECK (version > 0),
    specification JSONB NOT NULL,
    artifact JSONB NOT NULL,
    manifest JSONB,
    content_hash TEXT NOT NULL CHECK (content_hash ~ '^sha256:[0-9a-f]{64}$'),
    status TEXT NOT NULL CHECK (
      status IN ('GENERATED', 'VALIDATED', 'REJECTED', 'APPROVED', 'PUBLISHED', 'RETIRED')
    ),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (organization_id, id),
    UNIQUE (organization_id, experience_id, version),
    FOREIGN KEY (organization_id, experience_id)
      REFERENCES experiences(organization_id, id)
  );

  CREATE TABLE IF NOT EXISTS experience_validations (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL,
    version_id UUID NOT NULL,
    validator_policy_version TEXT NOT NULL,
    verdict TEXT NOT NULL CHECK (verdict IN ('PASS', 'FAIL')),
    content_hash TEXT NOT NULL CHECK (content_hash ~ '^sha256:[0-9a-f]{64}$'),
    findings JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (organization_id, id),
    FOREIGN KEY (organization_id, version_id)
      REFERENCES experience_versions(organization_id, id)
  );

  CREATE TABLE IF NOT EXISTS experience_approvals (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL,
    version_id UUID NOT NULL,
    teacher_id UUID NOT NULL,
    decision TEXT NOT NULL CHECK (decision IN ('APPROVE', 'REJECT')),
    content_hash TEXT NOT NULL CHECK (content_hash ~ '^sha256:[0-9a-f]{64}$'),
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (organization_id, id),
    FOREIGN KEY (organization_id, version_id)
      REFERENCES experience_versions(organization_id, id),
    FOREIGN KEY (organization_id, teacher_id)
      REFERENCES organization_members(organization_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS assignments (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL,
    class_id UUID NOT NULL,
    experience_version_id UUID NOT NULL,
    starts_at TIMESTAMPTZ NOT NULL,
    due_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'DISABLED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (organization_id, id),
    FOREIGN KEY (organization_id, class_id)
      REFERENCES classes(organization_id, id),
    FOREIGN KEY (organization_id, experience_version_id)
      REFERENCES experience_versions(organization_id, id),
    CHECK (due_at IS NULL OR due_at > starts_at)
  );

  CREATE TABLE IF NOT EXISTS attempts (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL,
    assignment_id UUID NOT NULL,
    class_id UUID NOT NULL,
    student_id UUID NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('READY', 'IN_PROGRESS', 'COMPLETED')),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (organization_id, id),
    UNIQUE (organization_id, assignment_id, student_id),
    FOREIGN KEY (organization_id, assignment_id)
      REFERENCES assignments(organization_id, id),
    FOREIGN KEY (organization_id, class_id, student_id)
      REFERENCES class_members(organization_id, class_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS assignment_rasa_policies (
    organization_id UUID NOT NULL,
    assignment_id UUID NOT NULL,
    enabled BOOLEAN NOT NULL,
    max_hint_level INTEGER NOT NULL CHECK (max_hint_level BETWEEN 1 AND 3),
    policy_version INTEGER NOT NULL DEFAULT 1 CHECK (policy_version > 0),
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (organization_id, assignment_id),
    FOREIGN KEY (organization_id, assignment_id) REFERENCES assignments(organization_id, id),
    FOREIGN KEY (organization_id, created_by) REFERENCES organization_members(organization_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS rasa_sessions (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL,
    assignment_id UUID NOT NULL,
    attempt_id UUID NOT NULL,
    student_id UUID NOT NULL,
    policy_version INTEGER NOT NULL CHECK (policy_version > 0),
    status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'CLOSED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (organization_id, id),
    UNIQUE (organization_id, attempt_id),
    FOREIGN KEY (organization_id, assignment_id) REFERENCES assignments(organization_id, id),
    FOREIGN KEY (organization_id, attempt_id) REFERENCES attempts(organization_id, id),
    FOREIGN KEY (organization_id, student_id) REFERENCES organization_members(organization_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS rasa_requests (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL,
    session_id UUID NOT NULL,
    step_id TEXT NOT NULL CHECK (char_length(step_id) BETWEEN 1 AND 120),
    hint_level INTEGER NOT NULL CHECK (hint_level BETWEEN 1 AND 3),
    context_hash TEXT NOT NULL CHECK (context_hash ~ '^sha256:[0-9a-f]{64}$'),
    status TEXT NOT NULL CHECK (status IN ('QUEUED', 'RUNNING', 'SUCCEEDED', 'REJECTED', 'FAILED', 'TIMED_OUT')),
    provider TEXT,
    model TEXT,
    trace_id UUID NOT NULL,
    error_code TEXT CHECK (error_code IS NULL OR error_code ~ '^[A-Z][A-Z0-9_]*$'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    finished_at TIMESTAMPTZ,
    UNIQUE (organization_id, id),
    FOREIGN KEY (organization_id, session_id) REFERENCES rasa_sessions(organization_id, id)
  );

  CREATE TABLE IF NOT EXISTS rasa_actions (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL,
    request_id UUID NOT NULL,
    action JSONB NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('ACCEPTED', 'REJECTED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (organization_id, id),
    UNIQUE (organization_id, request_id),
    FOREIGN KEY (organization_id, request_id) REFERENCES rasa_requests(organization_id, id)
  );

  CREATE TABLE IF NOT EXISTS ai_usage (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL,
    rasa_request_id UUID NOT NULL,
    provider TEXT NOT NULL CHECK (char_length(provider) BETWEEN 1 AND 80),
    model TEXT NOT NULL CHECK (char_length(model) BETWEEN 1 AND 120),
    input_tokens INTEGER NOT NULL CHECK (input_tokens BETWEEN 0 AND 1000000),
    output_tokens INTEGER NOT NULL CHECK (output_tokens BETWEEN 0 AND 1000000),
    cost_micros BIGINT NOT NULL CHECK (cost_micros BETWEEN 0 AND 1000000000),
    latency_ms INTEGER NOT NULL CHECK (latency_ms BETWEEN 0 AND 120000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (organization_id, rasa_request_id),
    FOREIGN KEY (organization_id, rasa_request_id) REFERENCES rasa_requests(organization_id, id)
  );

  CREATE TABLE IF NOT EXISTS class_boss_campaigns (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL,
    class_id UUID NOT NULL,
    campaign_key TEXT NOT NULL CHECK (char_length(campaign_key) BETWEEN 1 AND 240 AND campaign_key = lower(campaign_key)),
    title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
    target_hp INTEGER NOT NULL CHECK (target_hp BETWEEN 60 AND 60000),
    policy JSONB NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'ENDED')),
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMPTZ,
    end_request_id UUID,
    UNIQUE (organization_id, id),
    UNIQUE (organization_id, campaign_key),
    FOREIGN KEY (organization_id, class_id) REFERENCES classes(organization_id, id),
    FOREIGN KEY (organization_id, created_by) REFERENCES organization_members(organization_id, user_id),
    CHECK ((status = 'ACTIVE' AND ended_at IS NULL AND end_request_id IS NULL) OR (status = 'ENDED' AND ended_at IS NOT NULL AND end_request_id IS NOT NULL))
  );
  CREATE UNIQUE INDEX IF NOT EXISTS one_active_boss_campaign_per_class
    ON class_boss_campaigns(organization_id, class_id) WHERE status = 'ACTIVE';

  CREATE TABLE IF NOT EXISTS learning_events (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL,
    actor_id UUID NOT NULL,
    assignment_id UUID NOT NULL,
    attempt_id UUID NOT NULL,
    type TEXT NOT NULL,
    step_id TEXT NOT NULL,
    sequence INTEGER NOT NULL CHECK (sequence >= 0),
    occurred_at TIMESTAMPTZ NOT NULL,
    received_at TIMESTAMPTZ NOT NULL,
    payload JSONB NOT NULL,
    event_json JSONB NOT NULL,
    UNIQUE (organization_id, id),
    UNIQUE (attempt_id, sequence),
    FOREIGN KEY (organization_id, assignment_id)
      REFERENCES assignments(organization_id, id),
    FOREIGN KEY (organization_id, attempt_id)
      REFERENCES attempts(organization_id, id)
  );

  CREATE TABLE IF NOT EXISTS student_progress (
    organization_id UUID NOT NULL,
    assignment_id UUID NOT NULL,
    student_id UUID NOT NULL,
    started BOOLEAN NOT NULL,
    wrong_answers INTEGER NOT NULL CHECK (wrong_answers >= 0),
    retries INTEGER NOT NULL CHECK (retries >= 0),
    completed BOOLEAN NOT NULL,
    last_sequence INTEGER,
    last_step_id TEXT,
    projection_version INTEGER NOT NULL CHECK (projection_version >= 0),
    hints_used INTEGER NOT NULL DEFAULT 0 CHECK (hints_used >= 0),
    updated_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (organization_id, assignment_id, student_id),
    FOREIGN KEY (organization_id, assignment_id)
      REFERENCES assignments(organization_id, id)
  );

  CREATE TABLE IF NOT EXISTS boss_projection_jobs (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL,
    learning_event_id UUID NOT NULL,
    campaign_id UUID NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED')),
    attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 10),
    last_error_code TEXT CHECK (last_error_code IS NULL OR last_error_code ~ '^[A-Z][A-Z0-9_]*$'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (organization_id, learning_event_id),
    FOREIGN KEY (organization_id, learning_event_id) REFERENCES learning_events(organization_id, id),
    FOREIGN KEY (organization_id, campaign_id) REFERENCES class_boss_campaigns(organization_id, id)
  );

  CREATE TABLE IF NOT EXISTS boss_contributions (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL,
    campaign_id UUID NOT NULL,
    student_id UUID NOT NULL,
    source_event_id UUID NOT NULL,
    amount INTEGER NOT NULL CHECK (amount BETWEEN 1 AND 10000),
    reason TEXT NOT NULL CHECK (reason IN ('answer_correct', 'answer_retried', 'experience_completed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (organization_id, source_event_id),
    FOREIGN KEY (organization_id, campaign_id) REFERENCES class_boss_campaigns(organization_id, id),
    FOREIGN KEY (organization_id, source_event_id) REFERENCES learning_events(organization_id, id),
    FOREIGN KEY (organization_id, student_id) REFERENCES organization_members(organization_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY,
    trace_id UUID NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actor_user_id UUID NOT NULL,
    organization_id UUID,
    action TEXT NOT NULL CHECK (
      action IN (
        'ORGANIZATION_CREATE',
        'ORGANIZATION_CREATED',
        'CLASS_CREATE',
        'CLASS_CREATED',
        'STUDENT_ENROLL',
        'STUDENT_ENROLLED',
        'CLASS_READ',
        'EXPERIENCE_CREATED',
        'EXPERIENCE_VALIDATED',
        'EXPERIENCE_REVIEWED',
        'ASSIGNMENT_CREATED',
        'ATTEMPT_STARTED',
        'LEARNING_EVENT_INGESTED',
        'PROGRESS_READ'
        ,'RASA_HINT_REQUESTED','RASA_HINT_DELIVERED','RASA_HINT_REJECTED'
        ,'BOSS_CAMPAIGN_CREATED','BOSS_CAMPAIGN_ENDED','BOSS_PROJECTION_PROCESSED'
        ,'BOSS_PROGRESS_READ','BOSS_DETAIL_READ'
      )
    ),
    resource_type TEXT NOT NULL CHECK (
      resource_type IN ('ORGANIZATION', 'CLASS', 'EXPERIENCE', 'VERSION', 'ASSIGNMENT', 'ATTEMPT', 'RASA_REQUEST', 'BOSS_CAMPAIGN', 'BOSS_JOB')
    ),
    resource_id UUID,
    outcome TEXT NOT NULL CHECK (outcome IN ('SUCCEEDED', 'DUPLICATE', 'DENIED', 'CONFLICT'))
  );

  CREATE INDEX IF NOT EXISTS classes_organization_idx
    ON classes(organization_id);
  CREATE INDEX IF NOT EXISTS audit_logs_organization_time_idx
    ON audit_logs(organization_id, occurred_at);
  CREATE INDEX IF NOT EXISTS experience_versions_experience_idx
    ON experience_versions(organization_id, experience_id, version);
  CREATE INDEX IF NOT EXISTS assignments_class_idx
    ON assignments(organization_id, class_id, starts_at);
  CREATE INDEX IF NOT EXISTS attempts_student_idx
    ON attempts(organization_id, student_id, assignment_id);
  CREATE INDEX IF NOT EXISTS learning_events_attempt_sequence_idx
    ON learning_events(attempt_id, sequence);

  CREATE OR REPLACE FUNCTION enforce_experience_version_invariants()
  RETURNS TRIGGER AS $$
  BEGIN
    IF OLD.status IN ('VALIDATED', 'APPROVED', 'PUBLISHED', 'RETIRED') AND (
      NEW.specification IS DISTINCT FROM OLD.specification OR
      NEW.artifact IS DISTINCT FROM OLD.artifact OR
      NEW.content_hash IS DISTINCT FROM OLD.content_hash
    ) THEN
      RAISE EXCEPTION 'validated experience version content is immutable';
    END IF;

    IF OLD.status IN ('APPROVED', 'PUBLISHED', 'RETIRED') AND
       NEW.manifest IS DISTINCT FROM OLD.manifest THEN
      RAISE EXCEPTION 'approved experience version manifest is immutable';
    END IF;

    IF NEW.status IS DISTINCT FROM OLD.status THEN
      IF NOT (
        (OLD.status = 'GENERATED' AND NEW.status IN ('VALIDATED', 'REJECTED')) OR
        (OLD.status = 'VALIDATED' AND NEW.status IN ('APPROVED', 'REJECTED')) OR
        (OLD.status = 'APPROVED' AND NEW.status = 'PUBLISHED') OR
        (OLD.status = 'PUBLISHED' AND NEW.status = 'RETIRED')
      ) THEN
        RAISE EXCEPTION 'invalid experience version status transition';
      END IF;

      IF NEW.status = 'VALIDATED' AND NOT EXISTS (
        SELECT 1 FROM experience_validations ev
        WHERE ev.organization_id = NEW.organization_id
          AND ev.version_id = NEW.id
          AND ev.verdict = 'PASS'
          AND ev.content_hash = NEW.content_hash
      ) THEN
        RAISE EXCEPTION 'validated status requires matching PASS evidence';
      END IF;

      IF OLD.status = 'GENERATED' AND NEW.status = 'REJECTED' AND NOT EXISTS (
        SELECT 1 FROM experience_validations ev
        WHERE ev.organization_id = NEW.organization_id
          AND ev.version_id = NEW.id
          AND ev.verdict = 'FAIL'
          AND ev.content_hash = NEW.content_hash
      ) THEN
        RAISE EXCEPTION 'validation rejection requires matching FAIL evidence';
      END IF;

      IF NEW.status = 'APPROVED' AND NOT EXISTS (
        SELECT 1 FROM experience_approvals ea
        WHERE ea.organization_id = NEW.organization_id
          AND ea.version_id = NEW.id
          AND ea.decision = 'APPROVE'
          AND ea.content_hash = NEW.content_hash
      ) THEN
        RAISE EXCEPTION 'approved status requires matching approval evidence';
      END IF;

      IF OLD.status = 'VALIDATED' AND NEW.status = 'REJECTED' AND NOT EXISTS (
        SELECT 1 FROM experience_approvals ea
        WHERE ea.organization_id = NEW.organization_id
          AND ea.version_id = NEW.id
          AND ea.decision = 'REJECT'
          AND ea.content_hash = NEW.content_hash
      ) THEN
        RAISE EXCEPTION 'teacher rejection requires matching rejection evidence';
      END IF;
    END IF;
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;

  DROP TRIGGER IF EXISTS protect_approved_version ON experience_versions;
  CREATE TRIGGER protect_approved_version
    BEFORE UPDATE ON experience_versions
    FOR EACH ROW EXECUTE FUNCTION enforce_experience_version_invariants();

  CREATE OR REPLACE FUNCTION reject_append_only_mutation()
  RETURNS TRIGGER AS $$
  BEGIN
    RAISE EXCEPTION 'append-only learning record cannot be changed';
    RETURN NULL;
  END;
  $$ LANGUAGE plpgsql;

  DROP TRIGGER IF EXISTS protect_experience_validations ON experience_validations;
  CREATE TRIGGER protect_experience_validations
    BEFORE UPDATE OR DELETE ON experience_validations
    FOR EACH ROW EXECUTE FUNCTION reject_append_only_mutation();

  DROP TRIGGER IF EXISTS protect_experience_approvals ON experience_approvals;
  CREATE TRIGGER protect_experience_approvals
    BEFORE UPDATE OR DELETE ON experience_approvals
    FOR EACH ROW EXECUTE FUNCTION reject_append_only_mutation();

  DROP TRIGGER IF EXISTS protect_learning_events ON learning_events;
  CREATE TRIGGER protect_learning_events
    BEFORE UPDATE OR DELETE ON learning_events
    FOR EACH ROW EXECUTE FUNCTION reject_append_only_mutation();

  DROP TRIGGER IF EXISTS protect_audit_logs ON audit_logs;
  CREATE TRIGGER protect_audit_logs BEFORE UPDATE OR DELETE ON audit_logs
    FOR EACH ROW EXECUTE FUNCTION reject_append_only_mutation();
  DROP TRIGGER IF EXISTS protect_rasa_actions ON rasa_actions;
  CREATE TRIGGER protect_rasa_actions BEFORE UPDATE OR DELETE ON rasa_actions
    FOR EACH ROW EXECUTE FUNCTION reject_append_only_mutation();
  DROP TRIGGER IF EXISTS protect_ai_usage ON ai_usage;
  CREATE TRIGGER protect_ai_usage BEFORE UPDATE OR DELETE ON ai_usage
    FOR EACH ROW EXECUTE FUNCTION reject_append_only_mutation();
  DROP TRIGGER IF EXISTS protect_boss_contributions ON boss_contributions;
  CREATE TRIGGER protect_boss_contributions BEFORE UPDATE OR DELETE ON boss_contributions
    FOR EACH ROW EXECUTE FUNCTION reject_append_only_mutation();

  CREATE OR REPLACE FUNCTION enforce_rasa_request_transition()
  RETURNS TRIGGER AS $$
  BEGIN
    IF NEW.organization_id IS DISTINCT FROM OLD.organization_id OR
       NEW.session_id IS DISTINCT FROM OLD.session_id OR NEW.step_id IS DISTINCT FROM OLD.step_id OR
       NEW.hint_level IS DISTINCT FROM OLD.hint_level OR NEW.context_hash IS DISTINCT FROM OLD.context_hash OR
       NEW.trace_id IS DISTINCT FROM OLD.trace_id OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'rasa request identity and context are immutable';
    END IF;
    IF OLD.status IN ('SUCCEEDED','REJECTED','FAILED','TIMED_OUT') OR NOT (
      (OLD.status='QUEUED' AND NEW.status='RUNNING') OR
      (OLD.status='RUNNING' AND NEW.status IN ('SUCCEEDED','REJECTED','FAILED','TIMED_OUT'))
    ) THEN RAISE EXCEPTION 'invalid rasa request transition'; END IF;
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;
  DROP TRIGGER IF EXISTS protect_rasa_request_transition ON rasa_requests;
  CREATE TRIGGER protect_rasa_request_transition BEFORE UPDATE ON rasa_requests
    FOR EACH ROW EXECUTE FUNCTION enforce_rasa_request_transition();

  CREATE OR REPLACE FUNCTION enforce_boss_campaign_transition()
  RETURNS TRIGGER AS $$
  BEGIN
    IF NEW.organization_id IS DISTINCT FROM OLD.organization_id OR NEW.class_id IS DISTINCT FROM OLD.class_id OR
       NEW.campaign_key IS DISTINCT FROM OLD.campaign_key OR NEW.title IS DISTINCT FROM OLD.title OR
       NEW.target_hp IS DISTINCT FROM OLD.target_hp OR NEW.policy IS DISTINCT FROM OLD.policy OR
       NEW.created_by IS DISTINCT FROM OLD.created_by OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'boss campaign definition is immutable';
    END IF;
    IF NOT (OLD.status='ACTIVE' AND NEW.status='ENDED' AND OLD.ended_at IS NULL AND
            NEW.ended_at IS NOT NULL AND OLD.end_request_id IS NULL AND NEW.end_request_id IS NOT NULL) THEN
      RAISE EXCEPTION 'invalid boss campaign transition';
    END IF;
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;
  DROP TRIGGER IF EXISTS protect_boss_campaign_transition ON class_boss_campaigns;
  CREATE TRIGGER protect_boss_campaign_transition BEFORE UPDATE ON class_boss_campaigns
    FOR EACH ROW EXECUTE FUNCTION enforce_boss_campaign_transition();

  CREATE OR REPLACE FUNCTION enforce_boss_job_transition()
  RETURNS TRIGGER AS $$
  BEGIN
    IF NEW.organization_id IS DISTINCT FROM OLD.organization_id OR
       NEW.learning_event_id IS DISTINCT FROM OLD.learning_event_id OR
       NEW.campaign_id IS DISTINCT FROM OLD.campaign_id OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'boss projection job source is immutable';
    END IF;
    IF NOT (
      (OLD.status IN ('PENDING','FAILED') AND NEW.status='PROCESSING' AND NEW.attempts=OLD.attempts+1) OR
      (OLD.status='PROCESSING' AND NEW.status IN ('SUCCEEDED','FAILED') AND NEW.attempts=OLD.attempts)
    ) THEN RAISE EXCEPTION 'invalid boss projection job transition'; END IF;
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;
  DROP TRIGGER IF EXISTS protect_boss_job_transition ON boss_projection_jobs;
  CREATE TRIGGER protect_boss_job_transition BEFORE UPDATE ON boss_projection_jobs
    FOR EACH ROW EXECUTE FUNCTION enforce_boss_job_transition();
`;

export async function initializeSchema(database: PGliteInterface): Promise<void> {
  await database.transaction(async (transaction) => {
    await transaction.exec(schemaSql);
  });
}
