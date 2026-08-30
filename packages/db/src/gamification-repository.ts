import { randomUUID } from 'node:crypto';

import type { PGliteInterface, Transaction } from '@electric-sql/pglite';
import {
  actorSchema,
  bossCampaignPolicySchema,
  createBossCampaignInputSchema,
  endBossCampaignInputSchema,
  studentBossProgressSchema,
  teacherBossDetailSchema,
  uuidSchema,
  type Actor,
  type CreateBossCampaignInput,
  type EndBossCampaignInput,
  type StudentBossProgress,
  type TeacherBossDetail,
} from '@lessonquest/contracts';
import { buildSpecialBossKey, buildWeeklyBossKey, projectBossContributions, type VerifiedBossOutcome } from '@lessonquest/gamification';

import { ConflictError, ResourceNotFoundError } from './tenant-repository.js';

type Queryable = Pick<PGliteInterface, 'query'> | Pick<Transaction, 'query'>;
const json = <T>(value: unknown): T => (typeof value === 'string' ? JSON.parse(value) : value) as T;

export class GamificationRepository {
  private readonly createId: () => string;
  private readonly now: () => Date;
  constructor(private readonly database: PGliteInterface, options: { createId?: () => string; now?: () => Date } = {}) {
    this.createId = options.createId ?? randomUUID;
    this.now = options.now ?? (() => new Date());
  }

  async createCampaign(actorInput: Actor, organizationIdInput: string, classIdInput: string, inputValue: CreateBossCampaignInput, traceIdInput: string): Promise<TeacherBossDetail> {
    const actor = actorSchema.parse(actorInput); const organizationId = uuidSchema.parse(organizationIdInput); const classId = uuidSchema.parse(classIdInput); const input = createBossCampaignInputSchema.parse(inputValue); const traceId = uuidSchema.parse(traceIdInput);
    return this.database.transaction(async (tx) => {
      await this.requireTeacher(tx, actor, organizationId, classId);
      const active = await tx.query('SELECT id FROM class_boss_campaigns WHERE organization_id=$1 AND class_id=$2 AND status=\'ACTIVE\' FOR UPDATE', [organizationId, classId]);
      if (active.rows[0] !== undefined) throw new ConflictError();
      const id = uuidSchema.parse(this.createId());
      const key = input.period.kind === 'WEEKLY' ? buildWeeklyBossKey(input.period.weekStart, classId) : buildSpecialBossKey(input.period.version, classId);
      await tx.query(`INSERT INTO class_boss_campaigns(id,organization_id,class_id,campaign_key,title,target_hp,policy,status,created_by,created_at) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,'ACTIVE',$8,$9)`, [id, organizationId, classId, key, input.title, input.targetHp, JSON.stringify(input.policy), actor.userId, this.now().toISOString()]);
      await this.audit(tx, traceId, actor.userId, organizationId, 'BOSS_CAMPAIGN_CREATED', id, 'SUCCEEDED');
      return this.readDetail(tx, organizationId, classId, id);
    });
  }

  async endCampaign(actorInput: Actor, organizationIdInput: string, classIdInput: string, campaignIdInput: string, inputValue: EndBossCampaignInput, traceIdInput: string): Promise<TeacherBossDetail> {
    const actor=actorSchema.parse(actorInput); const organizationId=uuidSchema.parse(organizationIdInput); const classId=uuidSchema.parse(classIdInput); const campaignId=uuidSchema.parse(campaignIdInput); const input=endBossCampaignInputSchema.parse(inputValue); const traceId=uuidSchema.parse(traceIdInput);
    return this.database.transaction(async (tx) => {
      await this.requireTeacher(tx,actor,organizationId,classId);
      const row=await tx.query<{status:string;end_request_id:string|null}>('SELECT status,end_request_id FROM class_boss_campaigns WHERE organization_id=$1 AND class_id=$2 AND id=$3 FOR UPDATE',[organizationId,classId,campaignId]);
      const campaign=row.rows[0]; if(campaign===undefined) throw new ResourceNotFoundError();
      if(campaign.status==='ENDED'){ if(campaign.end_request_id!==input.requestId) throw new ConflictError(); return this.readDetail(tx,organizationId,classId,campaignId); }
      await tx.query("UPDATE class_boss_campaigns SET status='ENDED',ended_at=$1,end_request_id=$2 WHERE id=$3",[this.now().toISOString(),input.requestId,campaignId]);
      await this.audit(tx,traceId,actor.userId,organizationId,'BOSS_CAMPAIGN_ENDED',campaignId,'SUCCEEDED');
      return this.readDetail(tx,organizationId,classId,campaignId);
    });
  }

  async getStudentProgress(actorInput: Actor, organizationIdInput: string, classIdInput: string, traceIdInput: string): Promise<StudentBossProgress> {
    const actor=actorSchema.parse(actorInput); const organizationId=uuidSchema.parse(organizationIdInput); const classId=uuidSchema.parse(classIdInput); uuidSchema.parse(traceIdInput);
    const allowed=await this.database.query(`SELECT 1 FROM class_members cm JOIN organization_members om ON om.organization_id=cm.organization_id AND om.user_id=cm.user_id AND om.status='ACTIVE' JOIN users u ON u.id=cm.user_id AND u.platform_role='STUDENT' AND u.status='ACTIVE' JOIN classes c ON c.organization_id=cm.organization_id AND c.id=cm.class_id AND c.status='ACTIVE' WHERE cm.organization_id=$1 AND cm.class_id=$2 AND cm.user_id=$3 AND cm.status='ACTIVE'`,[organizationId,classId,actor.userId]);
    if(allowed.rows[0]===undefined) throw new ResourceNotFoundError();
    const row=await this.database.query<{id:string;title:string;target_hp:number;damage:number}>(`SELECT c.id,c.title,c.target_hp,COALESCE(SUM(b.amount),0)::int damage FROM class_boss_campaigns c LEFT JOIN boss_contributions b ON b.organization_id=c.organization_id AND b.campaign_id=c.id WHERE c.organization_id=$1 AND c.class_id=$2 AND c.status='ACTIVE' GROUP BY c.id,c.title,c.target_hp`,[organizationId,classId]);
    const value=row.rows[0]; return studentBossProgressSchema.parse(value===undefined?null:{campaignId:value.id,title:value.title,targetHp:value.target_hp,damage:value.damage,completed:value.damage>=value.target_hp});
  }

  async getTeacherDetail(actorInput: Actor, organizationIdInput: string, classIdInput: string, traceIdInput: string): Promise<TeacherBossDetail> {
    const actor=actorSchema.parse(actorInput); const organizationId=uuidSchema.parse(organizationIdInput); const classId=uuidSchema.parse(classIdInput); uuidSchema.parse(traceIdInput);
    await this.requireTeacher(this.database,actor,organizationId,classId);
    const campaign=await this.database.query<{id:string}>('SELECT id FROM class_boss_campaigns WHERE organization_id=$1 AND class_id=$2 ORDER BY (status=\'ACTIVE\') DESC,created_at DESC LIMIT 1',[organizationId,classId]);
    if(campaign.rows[0]===undefined) throw new ResourceNotFoundError(); return this.readDetail(this.database,organizationId,classId,campaign.rows[0].id);
  }

  async drainPendingJobs(limit=100): Promise<{processed:number;failed:number}> {
    const jobs=await this.database.query<{id:string;organization_id:string;learning_event_id:string;campaign_id:string}>(`SELECT id,organization_id,learning_event_id,campaign_id FROM boss_projection_jobs WHERE status IN ('PENDING','FAILED') AND attempts<10 ORDER BY created_at LIMIT $1`,[Math.max(1,Math.min(limit,1000))]);
    let processed=0,failed=0;
    for(const job of jobs.rows){
      try{ await this.database.transaction(async(tx)=>{
        await tx.query("UPDATE boss_projection_jobs SET status='PROCESSING',attempts=attempts+1,updated_at=CURRENT_TIMESTAMP WHERE id=$1",[job.id]);
        const event=await tx.query<{organization_id:string;actor_id:string;type:string;payload:unknown}>(`SELECT organization_id,actor_id,type,payload FROM learning_events WHERE organization_id=$1 AND id=$2`,[job.organization_id,job.learning_event_id]);
        const campaign=await tx.query<{class_id:string;campaign_key:string;policy:unknown}>(`SELECT class_id,campaign_key,policy FROM class_boss_campaigns WHERE organization_id=$1 AND id=$2`,[job.organization_id,job.campaign_id]);
        const e=event.rows[0],c=campaign.rows[0]; if(e===undefined||c===undefined) throw new Error('MISSING_PROJECTION_SOURCE');
        const payload=json<{correct?:boolean;attempt?:number}>(e.payload); let kind:VerifiedBossOutcome['kind']|undefined;
        if(e.type==='QUESTION_ANSWERED'&&payload.correct===true&&payload.attempt===1)kind='ANSWER_CORRECT';
        if(e.type==='ANSWER_RETRIED'&&payload.correct===true&&typeof payload.attempt==='number'&&payload.attempt>1)kind='ANSWER_RETRIED';
        if(e.type==='EXPERIENCE_COMPLETED')kind='EXPERIENCE_COMPLETED';
        if(kind!==undefined){ const storedPolicy=bossCampaignPolicySchema.parse(json(c.policy)); const contributions=projectBossContributions({organizationId:job.organization_id,classId:c.class_id,campaignKey:c.campaign_key,policy:{enabled:true,amounts:storedPolicy.amounts},existingSourceEventIds:[],outcomes:[{organizationId:job.organization_id,classId:c.class_id,studentId:e.actor_id,sourceEventId:job.learning_event_id,kind,serverAccepted:true,firstForRule:true,capped:false}]});
          for(const item of contributions) await tx.query(`INSERT INTO boss_contributions(id,organization_id,campaign_id,student_id,source_event_id,amount,reason) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(organization_id,source_event_id) DO NOTHING`,[uuidSchema.parse(this.createId()),item.organizationId,job.campaign_id,item.studentId,item.sourceEventId,item.amount,item.reason]); }
        await tx.query("UPDATE boss_projection_jobs SET status='SUCCEEDED',last_error_code=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=$1",[job.id]);
      }); processed++; }catch{failed++;await this.database.query("UPDATE boss_projection_jobs SET status='FAILED',last_error_code='PROJECTION_FAILED',updated_at=CURRENT_TIMESTAMP WHERE id=$1",[job.id]);}
    }
    return {processed,failed};
  }

  private async requireTeacher(q:Queryable,actor:Actor,organizationId:string,classId:string){const row=await q.query(`SELECT 1 FROM classes c JOIN organization_members m ON m.organization_id=c.organization_id AND m.user_id=$3 AND m.status='ACTIVE' AND m.role IN('TEACHER','ORG_ADMIN') JOIN users u ON u.id=m.user_id AND u.status='ACTIVE' AND u.platform_role IN('TEACHER','SUPER_ADMIN') WHERE c.organization_id=$1 AND c.id=$2 AND c.status='ACTIVE' AND(c.owner_teacher_id=$3 OR m.role='ORG_ADMIN')`,[organizationId,classId,actor.userId]);if(row.rows[0]===undefined)throw new ResourceNotFoundError();}
  private async readDetail(q:Queryable,organizationId:string,classId:string,campaignId:string):Promise<TeacherBossDetail>{const campaign=await q.query<{id:string;title:string;target_hp:number;policy:unknown;damage:number}>(`SELECT c.id,c.title,c.target_hp,c.policy,COALESCE(SUM(b.amount),0)::int damage FROM class_boss_campaigns c LEFT JOIN boss_contributions b ON b.organization_id=c.organization_id AND b.campaign_id=c.id WHERE c.organization_id=$1 AND c.class_id=$2 AND c.id=$3 GROUP BY c.id,c.title,c.target_hp,c.policy`,[organizationId,classId,campaignId]);const c=campaign.rows[0];if(c===undefined)throw new ResourceNotFoundError();const rows=await q.query<{student_id:string;damage:number;reasons:string[]}>(`SELECT student_id,SUM(amount)::int damage,ARRAY_AGG(DISTINCT reason ORDER BY reason) reasons FROM boss_contributions WHERE organization_id=$1 AND campaign_id=$2 GROUP BY student_id ORDER BY student_id`,[organizationId,campaignId]);const health=await q.query<{pending:number;failed:number}>(`SELECT COUNT(*) FILTER(WHERE status IN('PENDING','PROCESSING'))::int pending,COUNT(*) FILTER(WHERE status='FAILED')::int failed FROM boss_projection_jobs WHERE organization_id=$1 AND campaign_id=$2`,[organizationId,campaignId]);return teacherBossDetailSchema.parse({campaign:{campaignId:c.id,title:c.title,targetHp:c.target_hp,damage:c.damage,completed:c.damage>=c.target_hp,policy:json(c.policy)},contributions:rows.rows.map(r=>({studentId:r.student_id,damage:r.damage,reasons:r.reasons})),projectionHealth:health.rows[0]??{pending:0,failed:0}});}
  private async audit(q:Queryable,traceId:string,actorId:string,organizationId:string,action:'BOSS_CAMPAIGN_CREATED'|'BOSS_CAMPAIGN_ENDED',resourceId:string,outcome:string){await q.query(`INSERT INTO audit_logs(id,trace_id,actor_user_id,organization_id,action,resource_type,resource_id,outcome)VALUES($1,$2,$3,$4,$5,'BOSS_CAMPAIGN',$6,$7)`,[randomUUID(),traceId,actorId,organizationId,action,resourceId,outcome]);}
}
