import type { ClientLearningEvent, StudentProgress } from '@lessonquest/contracts';

export interface ValidationFinding {
  readonly code: string;
  readonly severity: 'ERROR';
  readonly blockId: string | null;
}

export interface ValidationReport {
  readonly policyVersion: string;
  readonly verdict: 'PASS' | 'FAIL';
  readonly findings: readonly ValidationFinding[];
}

export interface StudentScienceSpecification {
  readonly schemaVersion: 1;
  readonly title: string;
  readonly gradeBand: string;
  readonly unit: string;
  readonly learningObjectives: readonly { readonly id: string; readonly text: string }[];
  readonly blocks: readonly (
    | {
        readonly id: string;
        readonly kind: 'CONCEPT_CARD';
        readonly title: string;
        readonly body: string;
        readonly objectiveIds: readonly string[];
      }
    | {
        readonly id: string;
        readonly kind: 'PREDICTION';
        readonly prompt: string;
        readonly choices: readonly { readonly id: string; readonly label: string }[];
        readonly objectiveIds: readonly string[];
      }
    | {
        readonly id: string;
        readonly kind: 'SIMULATION';
        readonly model: 'FORCE_MOTION';
        readonly prompt: string;
        readonly parameters: {
          readonly massKg: number;
          readonly forceN: number;
          readonly durationSec: number;
        };
        readonly objectiveIds: readonly string[];
      }
    | {
        readonly id: string;
        readonly kind: 'QUIZ';
        readonly question: string;
        readonly options: readonly { readonly id: string; readonly label: string }[];
        readonly objectiveIds: readonly string[];
      }
    | {
        readonly id: string;
        readonly kind: 'REFLECTION';
        readonly prompt: string;
        readonly objectiveIds: readonly string[];
      }
  )[];
}

export interface LessonQuestApi {
  createScienceExperience(
    organizationId: string,
    input: { title: string; generatedSpecText: string },
  ): Promise<{
    experienceId: string;
    publicId: string;
    versionId: string;
    version: number;
    status: 'GENERATED';
    contentHash: string;
  }>;
  validateExperienceVersion(
    organizationId: string,
    versionId: string,
  ): Promise<{ versionId: string; status: 'VALIDATED' | 'REJECTED'; report: ValidationReport }>;
  getExperiencePreview(
    organizationId: string,
    versionId: string,
  ): Promise<{
    versionId: string;
    status: string;
    contentHash: string;
    specification: StudentScienceSpecification;
    sandboxDocument: string;
    validationReport: ValidationReport | null;
  }>;
  reviewExperienceVersion(
    organizationId: string,
    versionId: string,
    input: { decision: 'APPROVE' | 'REJECT'; note?: string },
  ): Promise<{ versionId: string; status: 'APPROVED' | 'REJECTED' }>;
  createAssignment(
    organizationId: string,
    classId: string,
    input: { experienceVersionId: string },
  ): Promise<AssignmentSummary>;
  listStudentAssignments(organizationId: string): Promise<StudentAssignmentSummary[]>;
  startAttempt(
    organizationId: string,
    assignmentId: string,
  ): Promise<{
    id: string;
    assignmentId: string;
    status: 'READY' | 'IN_PROGRESS' | 'COMPLETED';
    resumed: boolean;
  }>;
  getPlayer(
    organizationId: string,
    assignmentId: string,
  ): Promise<{
    assignmentId: string;
    attemptId: string;
    experienceId: string;
    experienceVersion: number;
    contentHash: string;
    specification: StudentScienceSpecification;
    sandboxDocument: string;
  }>;
  ingestEvent(event: ClientLearningEvent): Promise<{ accepted: boolean; duplicate: boolean }>;
  listTeacherProgress(
    organizationId: string,
    classId: string,
    assignmentId: string,
  ): Promise<StudentProgress[]>;
}

export interface AssignmentSummary {
  readonly id: string;
  readonly organizationId: string;
  readonly classId: string;
  readonly experienceVersionId: string;
  readonly startsAt: string;
  readonly dueAt: string | null;
  readonly status: 'ACTIVE';
}

export interface StudentAssignmentSummary extends AssignmentSummary {
  readonly title: string;
  readonly attemptStatus: 'READY' | 'IN_PROGRESS' | 'COMPLETED' | null;
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

export function createHttpLessonQuestApi(options: {
  readonly baseUrl: string;
  readonly getAuthorization: () => string | null;
}): LessonQuestApi {
  const request = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
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
      const envelope = value as { error?: { code?: string; message?: string } };
      throw new LessonQuestApiError(
        response.status,
        envelope.error?.code ?? 'UNKNOWN_ERROR',
        envelope.error?.message ?? '요청을 처리하지 못했습니다.',
      );
    }
    return value as T;
  };

  return {
    createScienceExperience: (organizationId, input) =>
      request(`/organizations/${organizationId}/experiences/science`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    validateExperienceVersion: (organizationId, versionId) =>
      request(`/organizations/${organizationId}/experience-versions/${versionId}/validate`, {
        method: 'POST',
        body: '{}',
      }),
    getExperiencePreview: (organizationId, versionId) =>
      request(`/organizations/${organizationId}/experience-versions/${versionId}/preview`),
    reviewExperienceVersion: (organizationId, versionId, input) =>
      request(`/organizations/${organizationId}/experience-versions/${versionId}/review`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    createAssignment: (organizationId, classId, input) =>
      request(`/organizations/${organizationId}/classes/${classId}/assignments`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    listStudentAssignments: (organizationId) =>
      request(`/organizations/${organizationId}/student/assignments`),
    startAttempt: (organizationId, assignmentId) =>
      request(`/organizations/${organizationId}/assignments/${assignmentId}/attempts`, {
        method: 'POST',
        body: '{}',
      }),
    getPlayer: (organizationId, assignmentId) =>
      request(`/organizations/${organizationId}/assignments/${assignmentId}/player`),
    ingestEvent: (event) =>
      request(`/organizations/${event.organizationId}/learning-events`, {
        method: 'POST',
        body: JSON.stringify(event),
      }),
    listTeacherProgress: (organizationId, classId, assignmentId) =>
      request(
        `/organizations/${organizationId}/classes/${classId}/assignments/${assignmentId}/progress`,
      ),
  };
}
