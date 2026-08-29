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
        'CLASS_READ'
      )
    ),
    resource_type TEXT NOT NULL CHECK (resource_type IN ('ORGANIZATION', 'CLASS')),
    resource_id UUID,
    outcome TEXT NOT NULL CHECK (outcome IN ('SUCCEEDED', 'DENIED', 'CONFLICT'))
  );

  CREATE INDEX IF NOT EXISTS classes_organization_idx
    ON classes(organization_id);
  CREATE INDEX IF NOT EXISTS audit_logs_organization_time_idx
    ON audit_logs(organization_id, occurred_at);
`;

export async function initializeSchema(database: PGliteInterface): Promise<void> {
  await database.transaction(async (transaction) => {
    await transaction.exec(schemaSql);
  });
}
