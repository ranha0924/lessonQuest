import { PGlite } from '@electric-sql/pglite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { initializeSchema } from '../src/schema.js';
import { FirebaseIdentityRepository } from '../src/firebase-identity-repository.js';

const project = 'lessonquest-test';
const userId = '018f72a4-cc52-7c5a-a6f9-8b21aa27d101';
const otherUser = '018f72a4-cc52-7c5a-a6f9-8b21aa27d102';
const org = '018f72a4-cc52-7c5a-a6f9-8b21aa27d111';
describe('approved Firebase identity lookup', () => {
  let db: PGlite;
  let identities: FirebaseIdentityRepository;
  beforeEach(async () => {
    db = new PGlite();
    await initializeSchema(db);
    identities = new FirebaseIdentityRepository(db);
    await db.query(`INSERT INTO users(id, platform_role) VALUES ($1,'TEACHER'),($2,'STUDENT')`, [
      userId,
      otherUser,
    ]);
  });
  afterEach(async () => {
    await db.close();
  });
  async function link() {
    await db.query('INSERT INTO firebase_identities(project_id,uid,user_id) VALUES ($1,$2,$3)', [
      project,
      'synthetic-uid',
      userId,
    ]);
  }
  async function member() {
    await db.query('INSERT INTO organizations(id,name,created_by) VALUES ($1,$2,$3)', [
      org,
      '합성 기관',
      userId,
    ]);
    await db.query(
      `INSERT INTO organization_members(organization_id,user_id,role) VALUES ($1,$2,'ORG_ADMIN')`,
      [org, userId],
    );
  }
  it('returns only an exact project/uid match and never auto-provisions unknown callers', async () => {
    await link();
    expect(await identities.findActor(project, 'synthetic-uid')).toEqual({
      userId,
      platformRole: 'TEACHER',
      memberships: [],
    });
    expect(await identities.findActor('other-project', 'synthetic-uid')).toBeNull();
    expect(await identities.findActor(project, 'other-uid')).toBeNull();
    expect(await identities.findActor(project, "' OR 1=1 --")).toBeNull();
    expect((await db.query('SELECT id FROM users')).rows).toHaveLength(2);
    expect((await db.query('SELECT user_id FROM firebase_identities')).rows).toHaveLength(1);
  });
  it('loads current roles and removes disabled or incompatible memberships', async () => {
    await link();
    await member();
    expect((await identities.findActor(project, 'synthetic-uid'))?.memberships).toEqual([
      { organizationId: org, role: 'ORG_ADMIN' },
    ]);
    await db.query(`UPDATE users SET platform_role='STUDENT' WHERE id=$1`, [userId]);
    expect(await identities.findActor(project, 'synthetic-uid')).toEqual({
      userId,
      platformRole: 'STUDENT',
      memberships: [],
    });
    await db.query(`UPDATE organization_members SET role='STUDENT' WHERE user_id=$1`, [userId]);
    expect((await identities.findActor(project, 'synthetic-uid'))?.memberships).toHaveLength(1);
    await db.query(`UPDATE organization_members SET status='DISABLED' WHERE user_id=$1`, [userId]);
    expect((await identities.findActor(project, 'synthetic-uid'))?.memberships).toEqual([]);
    await db.query(`UPDATE organization_members SET status='ACTIVE' WHERE user_id=$1`, [userId]);
    await db.query(`UPDATE organizations SET status='DISABLED' WHERE id=$1`, [org]);
    expect((await identities.findActor(project, 'synthetic-uid'))?.memberships).toEqual([]);
  });
  it('rejects disabled users and disabled mappings immediately', async () => {
    await link();
    await db.query(`UPDATE users SET status='DISABLED' WHERE id=$1`, [userId]);
    expect(await identities.findActor(project, 'synthetic-uid')).toBeNull();
    await db.query(`UPDATE users SET status='ACTIVE' WHERE id=$1`, [userId]);
    await db.query(`UPDATE firebase_identities SET status='DISABLED' WHERE user_id=$1`, [userId]);
    expect(await identities.findActor(project, 'synthetic-uid')).toBeNull();
  });
  it('enforces mapping uniqueness, user FK and identity shape at storage', async () => {
    await link();
    await expect(
      db.query('INSERT INTO firebase_identities(project_id,uid,user_id) VALUES ($1,$2,$3)', [
        project,
        'synthetic-uid',
        otherUser,
      ]),
    ).rejects.toThrow();
    await expect(
      db.query('INSERT INTO firebase_identities(project_id,uid,user_id) VALUES ($1,$2,$3)', [
        project,
        'another-uid',
        userId,
      ]),
    ).rejects.toThrow();
    await expect(
      db.query('INSERT INTO firebase_identities(project_id,uid,user_id) VALUES ($1,$2,$3)', [
        project,
        'missing-user',
        org,
      ]),
    ).rejects.toThrow();
    await expect(
      db.query('INSERT INTO firebase_identities(project_id,uid,user_id) VALUES ($1,$2,$3)', [
        project,
        'bad\nuid',
        otherUser,
      ]),
    ).rejects.toThrow();
    expect((await db.query('SELECT user_id FROM firebase_identities')).rows).toHaveLength(1);
  });
  it('fails closed if the actor exceeds the bounded membership contract', async () => {
    await link();
    await db.query(
      `INSERT INTO organizations(id,name,created_by) SELECT gen_random_uuid(),'합성 기관',$1 FROM generate_series(1,101)`,
      [userId],
    );
    await db.query(
      `INSERT INTO organization_members(organization_id,user_id,role) SELECT id,$1,'TEACHER' FROM organizations`,
      [userId],
    );
    expect(await identities.findActor(project, 'synthetic-uid')).toBeNull();
  });
});
