import {
  assignmentSchema,
  attemptSessionSchema,
  createdScienceExperienceSchema,
  eventIngestionResultSchema,
  experiencePreviewSchema,
  experienceReviewResultSchema,
  experienceValidationResultSchema,
  playerSessionSchema,
  studentAssignmentListSchema,
  studentProgressListSchema,
  type Assignment,
  type AttemptSession,
  type ClientLearningEvent,
  type CreatedScienceExperience,
  type EventIngestionResult,
  type ExperiencePreview,
  type ExperienceReviewResult,
  type ExperienceValidationResult,
  type PlayerSession,
  type ScienceValidationReportContract,
  type StudentAssignmentSummary as ContractStudentAssignmentSummary,
  type StudentProgress,
  type StudentScienceBlockSpec,
} from '@lessonquest/contracts';

export type ValidationReport = ScienceValidationReportContract;
export type StudentScienceSpecification = StudentScienceBlockSpec;
export type AssignmentSummary = Assignment;
export type StudentAssignmentSummary = ContractStudentAssignmentSummary;

interface RuntimeSchema<T> {
  parse(value: unknown): T;
}

export interface LessonQuestApi {
  createScienceExperience(
    organizationId: string,
    input: { title: string; generatedSpecText: string },
  ): Promise<CreatedScienceExperience>;
  validateExperienceVersion(
    organizationId: string,
    versionId: string,
  ): Promise<ExperienceValidationResult>;
  getExperiencePreview(organizationId: string, versionId: string): Promise<ExperiencePreview>;
  reviewExperienceVersion(
    organizationId: string,
    versionId: string,
    input: { decision: 'APPROVE' | 'REJECT'; note?: string },
  ): Promise<ExperienceReviewResult>;
  createAssignment(
    organizationId: string,
    classId: string,
    input: { experienceVersionId: string },
  ): Promise<AssignmentSummary>;
  listStudentAssignments(organizationId: string): Promise<StudentAssignmentSummary[]>;
  startAttempt(organizationId: string, assignmentId: string): Promise<AttemptSession>;
  getPlayer(organizationId: string, assignmentId: string): Promise<PlayerSession>;
  ingestEvent(event: ClientLearningEvent): Promise<EventIngestionResult>;
  listTeacherProgress(
    organizationId: string,
    classId: string,
    assignmentId: string,
  ): Promise<StudentProgress[]>;
}

export class LessonQuestApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'LessonQuestApiError';
  }
}

function readErrorEnvelope(value: unknown): { code: string; message: string } {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { code: 'UNKNOWN_ERROR', message: '요청을 처리하지 못했습니다.' };
  }
  const error = (value as Record<string, unknown>)['error'];
  if (typeof error !== 'object' || error === null || Array.isArray(error)) {
    return { code: 'UNKNOWN_ERROR', message: '요청을 처리하지 못했습니다.' };
  }
  const record = error as Record<string, unknown>;
  return {
    code: typeof record['code'] === 'string' ? record['code'] : 'UNKNOWN_ERROR',
    message:
      typeof record['message'] === 'string' ? record['message'] : '요청을 처리하지 못했습니다.',
  };
}

export function createHttpLessonQuestApi(options: {
  readonly baseUrl: string;
  readonly getAuthorization: () => string | null;
}): LessonQuestApi {
  const request = async <T>(
    path: string,
    schema: RuntimeSchema<T>,
    init: RequestInit = {},
  ): Promise<T> => {
    const headers = new Headers(init.headers);
    const authorization = options.getAuthorization();
    if (authorization !== null) {
      headers.set('authorization', authorization);
    }
    if (init.body !== undefined) {
      headers.set('content-type', 'application/json');
    }
    const response = await fetch(new URL(path, options.baseUrl), { ...init, headers });
    const value: unknown = await response.json();
    if (!response.ok) {
      const envelope = readErrorEnvelope(value);
      throw new LessonQuestApiError(response.status, envelope.code, envelope.message);
    }
    return schema.parse(value);
  };

  return {
    createScienceExperience: (organizationId, input) =>
      request(
        `/organizations/${organizationId}/experiences/science`,
        createdScienceExperienceSchema,
        {
          method: 'POST',
          body: JSON.stringify(input),
        },
      ),
    validateExperienceVersion: (organizationId, versionId) =>
      request(
        `/organizations/${organizationId}/experience-versions/${versionId}/validate`,
        experienceValidationResultSchema,
        { method: 'POST', body: '{}' },
      ),
    getExperiencePreview: (organizationId, versionId) =>
      request(
        `/organizations/${organizationId}/experience-versions/${versionId}/preview`,
        experiencePreviewSchema,
      ),
    reviewExperienceVersion: (organizationId, versionId, input) =>
      request(
        `/organizations/${organizationId}/experience-versions/${versionId}/review`,
        experienceReviewResultSchema,
        { method: 'POST', body: JSON.stringify(input) },
      ),
    createAssignment: (organizationId, classId, input) =>
      request(`/organizations/${organizationId}/classes/${classId}/assignments`, assignmentSchema, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    listStudentAssignments: (organizationId) =>
      request(`/organizations/${organizationId}/student/assignments`, studentAssignmentListSchema),
    startAttempt: (organizationId, assignmentId) =>
      request(
        `/organizations/${organizationId}/assignments/${assignmentId}/attempts`,
        attemptSessionSchema,
        { method: 'POST', body: '{}' },
      ),
    getPlayer: (organizationId, assignmentId) =>
      request(
        `/organizations/${organizationId}/assignments/${assignmentId}/player`,
        playerSessionSchema,
      ),
    ingestEvent: (event) =>
      request(
        `/organizations/${event.organizationId}/learning-events`,
        eventIngestionResultSchema,
        { method: 'POST', body: JSON.stringify(event) },
      ),
    listTeacherProgress: (organizationId, classId, assignmentId) =>
      request(
        `/organizations/${organizationId}/classes/${classId}/assignments/${assignmentId}/progress`,
        studentProgressListSchema,
      ),
  };
}
