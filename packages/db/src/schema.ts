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
    updated_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (organization_id, assignment_id, student_id),
    FOREIGN KEY (organization_id, assignment_id)
      REFERENCES assignments(organization_id, id)
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
      )
    ),
    resource_type TEXT NOT NULL CHECK (
      resource_type IN ('ORGANIZATION', 'CLASS', 'EXPERIENCE', 'VERSION', 'ASSIGNMENT', 'ATTEMPT')
    ),
    resource_id UUID,
    outcome TEXT NOT NULL CHECK (outcome IN ('SUCCEEDED', 'DENIED', 'CONFLICT'))
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

  CREATE OR REPLACE FUNCTION reject_approved_version_mutation()
  RETURNS TRIGGER AS $$
  BEGIN
    IF OLD.status IN ('APPROVED', 'PUBLISHED', 'RETIRED') AND (
      NEW.specification IS DISTINCT FROM OLD.specification OR
      NEW.artifact IS DISTINCT FROM OLD.artifact OR
      NEW.manifest IS DISTINCT FROM OLD.manifest OR
      NEW.content_hash IS DISTINCT FROM OLD.content_hash
    ) THEN
      RAISE EXCEPTION 'approved experience version content is immutable';
    END IF;
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;

  DROP TRIGGER IF EXISTS protect_approved_version ON experience_versions;
  CREATE TRIGGER protect_approved_version
    BEFORE UPDATE OF specification, artifact, manifest, content_hash ON experience_versions
    FOR EACH ROW EXECUTE FUNCTION reject_approved_version_mutation();

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
`;

export async function initializeSchema(database: PGliteInterface): Promise<void> {
  await database.transaction(async (transaction) => {
    await transaction.exec(schemaSql);
  });
}
