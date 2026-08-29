import { randomUUID } from 'node:crypto';

import { AuthenticationError, type LocalAuthProvider } from '@lessonquest/auth';
import {
  addClassMemberInputSchema,
  clientLearningEventSchema,
  createAssignmentInputSchema,
  createClassInputSchema,
  createOrganizationInputSchema,
  createScienceExperienceInputSchema,
  reviewExperienceVersionInputSchema,
  uuidSchema,
  type Actor,
} from '@lessonquest/contracts';
import {
  AuthorizationError,
  ConflictError,
  ContentIntegrityError,
  InvalidStateError,
  type LearningRepository,
  ResourceNotFoundError,
  type TenantRepository,
} from '@lessonquest/db';
import { ScienceGenerationError } from '@lessonquest/science-studio';
import { Hono, type Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { ZodError } from 'zod';
import { z } from 'zod';

const defaultMaxBodyBytes = 64 * 1024;

type Variables = {
  actor: Actor;
  requestStartedAt: number;
  traceId: string;
};

type AppEnvironment = { Variables: Variables };
type AppContext = Context<AppEnvironment>;

type ErrorStatus = 400 | 401 | 403 | 404 | 409 | 413 | 415 | 422 | 500;

interface ErrorDescriptor {
  status: ErrorStatus;
  code: string;
  message: string;
  retryable: boolean;
}

class ApiProblem extends Error {
  constructor(readonly descriptor: ErrorDescriptor) {
    super(descriptor.code);
    this.name = 'ApiProblem';
  }
}

export interface CreateAppOptions {
  auth: LocalAuthProvider;
  repository: TenantRepository;
  learningRepository: LearningRepository;
  trustedOrigin: string;
  diagnostics: DiagnosticSink;
  maxBodyBytes?: number;
}

export interface ApiDiagnosticEvent {
  readonly type: 'API_ERROR';
  readonly traceId: string;
  readonly code: string;
  readonly status: ErrorStatus;
  readonly retryable: boolean;
  readonly method: string;
  readonly organizationId: string | null;
  readonly resourceId: string | null;
  readonly durationMs: number;
}

export interface DiagnosticSink {
  record(event: ApiDiagnosticEvent): void;
}

function diagnosticUuid(value: string | undefined): string | null {
  const parsed = uuidSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function diagnosticResourceIds(context: AppContext): {
  organizationId: string | null;
  resourceId: string | null;
} {
  const match = /^\/organizations\/([^/]+)(?:\/classes\/([^/]+))?/.exec(
    new URL(context.req.url).pathname,
  );
  return {
    organizationId: diagnosticUuid(match?.[1]),
    resourceId: diagnosticUuid(match?.[2]),
  };
}

function errorResponse(
  context: AppContext,
  descriptor: ErrorDescriptor,
  diagnostics: DiagnosticSink,
): Response {
  const traceId = context.get('traceId');
  const { organizationId, resourceId } = diagnosticResourceIds(context);
  const diagnosticEvent: ApiDiagnosticEvent = Object.freeze({
    type: 'API_ERROR',
    traceId,
    code: descriptor.code,
    status: descriptor.status,
    retryable: descriptor.retryable,
    method: context.req.method,
    organizationId,
    resourceId,
    durationMs: Math.max(0, performance.now() - context.get('requestStartedAt')),
  });
  try {
    diagnostics.record(diagnosticEvent);
  } catch {
    // Diagnostics must never replace or expose the safe API response.
  }
  return context.json(
    {
      error: {
        code: descriptor.code,
        message: descriptor.message,
        retryable: descriptor.retryable,
        traceId,
      },
    },
    descriptor.status,
  );
}

function mapError(error: unknown): ErrorDescriptor {
  if (error instanceof ApiProblem) {
    return error.descriptor;
  }
  if (error instanceof AuthenticationError) {
    return {
      status: 401,
      code: 'AUTHENTICATION_REQUIRED',
      message: '로그인이 필요합니다.',
      retryable: false,
    };
  }
  if (error instanceof AuthorizationError) {
    return {
      status: 403,
      code: 'OPERATION_FORBIDDEN',
      message: '이 작업을 수행할 권한이 없습니다.',
      retryable: false,
    };
  }
  if (error instanceof ResourceNotFoundError) {
    return {
      status: 404,
      code: 'RESOURCE_NOT_FOUND',
      message: '요청한 정보를 찾을 수 없습니다.',
      retryable: false,
    };
  }
  if (error instanceof ConflictError) {
    return {
      status: 409,
      code: 'RESOURCE_CONFLICT',
      message: '이미 처리된 요청입니다.',
      retryable: false,
    };
  }
  if (error instanceof InvalidStateError) {
    return {
      status: 422,
      code: 'EXPERIENCE_STATE_INVALID',
      message: '먼저 검증과 교사 승인 단계를 확인해 주세요.',
      retryable: false,
    };
  }
  if (error instanceof ContentIntegrityError) {
    return {
      status: 422,
      code: 'EXPERIENCE_CONTENT_INTEGRITY_FAILED',
      message: '승인된 체험 내용을 확인할 수 없어 실행을 멈췄습니다.',
      retryable: false,
    };
  }
  if (error instanceof ScienceGenerationError) {
    return {
      status: 400,
      code: 'EXPERIENCE_GENERATION_INVALID',
      message: '생성된 과학 체험 형식을 확인해 주세요.',
      retryable: false,
    };
  }
  if (error instanceof ZodError) {
    return {
      status: 400,
      code: 'INVALID_REQUEST',
      message: '요청 형식을 확인해 주세요.',
      retryable: false,
    };
  }
  return {
    status: 500,
    code: 'INTERNAL_ERROR',
    message: '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.',
    retryable: true,
  };
}

function validateConfiguration(trustedOrigin: string, maxBodyBytes: number): void {
  let parsedOrigin: URL;
  try {
    parsedOrigin = new URL(trustedOrigin);
  } catch {
    throw new TypeError('trustedOrigin must be an absolute HTTP(S) origin');
  }
  if (
    !['http:', 'https:'].includes(parsedOrigin.protocol) ||
    parsedOrigin.origin !== trustedOrigin ||
    !Number.isSafeInteger(maxBodyBytes) ||
    maxBodyBytes <= 0 ||
    maxBodyBytes > 1024 * 1024
  ) {
    throw new TypeError('Unsafe API configuration');
  }
}

function parseRouteUuid(value: string): string {
  const parsed = uuidSchema.safeParse(value);
  if (!parsed.success) {
    throw new ResourceNotFoundError();
  }
  return parsed.data;
}

async function readJson(context: AppContext): Promise<unknown> {
  try {
    const value: unknown = await context.req.json();
    return value;
  } catch {
    throw new ApiProblem({
      status: 400,
      code: 'INVALID_REQUEST',
      message: '요청 형식을 확인해 주세요.',
      retryable: false,
    });
  }
}

export function createApp(options: CreateAppOptions): Hono<AppEnvironment> {
  const maxBodyBytes = options.maxBodyBytes ?? defaultMaxBodyBytes;
  validateConfiguration(options.trustedOrigin, maxBodyBytes);

  const app = new Hono<AppEnvironment>();

  app.use('*', async (context, next) => {
    const traceId = randomUUID();
    context.set('traceId', traceId);
    context.set('requestStartedAt', performance.now());
    await next();
    context.header('x-trace-id', traceId);
  });
  app.use('*', secureHeaders());
  app.use(
    '*',
    cors({
      origin: options.trustedOrigin,
      allowMethods: ['GET', 'POST', 'OPTIONS'],
      allowHeaders: ['Authorization', 'Content-Type'],
      maxAge: 600,
    }),
  );
  app.use('*', async (context, next) => {
    if (context.req.path === '/health' || context.req.method === 'OPTIONS') {
      await next();
      return;
    }
    context.set('actor', options.auth.resolve(context.req.header('authorization')));
    await next();
  });
  app.use('*', async (context, next) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(context.req.method)) {
      if (context.req.header('origin') !== options.trustedOrigin) {
        throw new ApiProblem({
          status: 403,
          code: 'ORIGIN_FORBIDDEN',
          message: '허용되지 않은 요청 출처입니다.',
          retryable: false,
        });
      }
    }
    await next();
  });
  app.use(
    '*',
    bodyLimit({
      maxSize: maxBodyBytes,
      onError: () => {
        throw new ApiProblem({
          status: 413,
          code: 'PAYLOAD_TOO_LARGE',
          message: '요청 내용이 너무 큽니다.',
          retryable: false,
        });
      },
    }),
  );
  app.use('*', async (context, next) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(context.req.method)) {
      const mediaType = context.req.header('content-type')?.split(';', 1)[0]?.trim().toLowerCase();
      if (mediaType !== 'application/json') {
        throw new ApiProblem({
          status: 415,
          code: 'UNSUPPORTED_MEDIA_TYPE',
          message: 'JSON 형식으로 요청해 주세요.',
          retryable: false,
        });
      }
    }
    await next();
  });

  app.get('/health', (context) => context.json({ status: 'ok' }));

  app.post('/organizations', async (context) => {
    const input = createOrganizationInputSchema.parse(await readJson(context));
    const organization = await options.repository.createOrganization(
      context.get('actor'),
      input.name,
      context.get('traceId'),
    );
    return context.json(organization, 201);
  });

  app.post('/organizations/:organizationId/classes', async (context) => {
    const organizationId = parseRouteUuid(context.req.param('organizationId'));
    const input = createClassInputSchema.parse(await readJson(context));
    const lessonClass = await options.repository.createClass(
      context.get('actor'),
      organizationId,
      input.name,
      context.get('traceId'),
    );
    return context.json(lessonClass, 201);
  });

  app.post('/organizations/:organizationId/classes/:classId/members', async (context) => {
    const organizationId = parseRouteUuid(context.req.param('organizationId'));
    const classId = parseRouteUuid(context.req.param('classId'));
    const input = addClassMemberInputSchema.parse(await readJson(context));
    await options.repository.addStudentToClass(
      context.get('actor'),
      organizationId,
      classId,
      input.userId,
      context.get('traceId'),
    );
    return context.body(null, 204);
  });

  app.get('/organizations/:organizationId/classes/:classId', async (context) => {
    const organizationId = parseRouteUuid(context.req.param('organizationId'));
    const classId = parseRouteUuid(context.req.param('classId'));
    const lessonClass = await options.repository.getClass(
      context.get('actor'),
      organizationId,
      classId,
      context.get('traceId'),
    );
    return context.json(lessonClass);
  });

  app.post('/organizations/:organizationId/experiences/science', async (context) => {
    const organizationId = parseRouteUuid(context.req.param('organizationId'));
    const input = createScienceExperienceInputSchema.parse(await readJson(context));
    const created = await options.learningRepository.createScienceExperience(
      context.get('actor'),
      organizationId,
      input.title,
      input.generatedSpecText,
    );
    return context.json(created, 201);
  });

  app.post(
    '/organizations/:organizationId/experience-versions/:versionId/validate',
    async (context) => {
      const organizationId = parseRouteUuid(context.req.param('organizationId'));
      const versionId = parseRouteUuid(context.req.param('versionId'));
      z.strictObject({}).parse(await readJson(context));
      const result = await options.learningRepository.validateExperienceVersion(
        context.get('actor'),
        organizationId,
        versionId,
      );
      return context.json(result);
    },
  );

  app.get(
    '/organizations/:organizationId/experience-versions/:versionId/preview',
    async (context) => {
      const organizationId = parseRouteUuid(context.req.param('organizationId'));
      const versionId = parseRouteUuid(context.req.param('versionId'));
      const preview = await options.learningRepository.getExperiencePreview(
        context.get('actor'),
        organizationId,
        versionId,
      );
      return context.json(preview);
    },
  );

  app.post(
    '/organizations/:organizationId/experience-versions/:versionId/review',
    async (context) => {
      const organizationId = parseRouteUuid(context.req.param('organizationId'));
      const versionId = parseRouteUuid(context.req.param('versionId'));
      const input = reviewExperienceVersionInputSchema.parse(await readJson(context));
      const reviewed = await options.learningRepository.reviewExperienceVersion(
        context.get('actor'),
        organizationId,
        versionId,
        input,
      );
      return context.json(reviewed);
    },
  );

  app.post('/organizations/:organizationId/classes/:classId/assignments', async (context) => {
    const organizationId = parseRouteUuid(context.req.param('organizationId'));
    const classId = parseRouteUuid(context.req.param('classId'));
    const input = createAssignmentInputSchema.parse(await readJson(context));
    const assignment = await options.learningRepository.createAssignment(
      context.get('actor'),
      organizationId,
      classId,
      input,
    );
    return context.json(assignment, 201);
  });

  app.get('/organizations/:organizationId/student/assignments', async (context) => {
    const organizationId = parseRouteUuid(context.req.param('organizationId'));
    const assignments = await options.learningRepository.listStudentAssignments(
      context.get('actor'),
      organizationId,
    );
    return context.json(assignments);
  });

  app.post('/organizations/:organizationId/assignments/:assignmentId/attempts', async (context) => {
    const organizationId = parseRouteUuid(context.req.param('organizationId'));
    const assignmentId = parseRouteUuid(context.req.param('assignmentId'));
    z.strictObject({}).parse(await readJson(context));
    const attempt = await options.learningRepository.startOrResumeAttempt(
      context.get('actor'),
      organizationId,
      assignmentId,
    );
    return context.json(attempt, attempt.resumed ? 200 : 201);
  });

  app.get('/organizations/:organizationId/assignments/:assignmentId/player', async (context) => {
    const organizationId = parseRouteUuid(context.req.param('organizationId'));
    const assignmentId = parseRouteUuid(context.req.param('assignmentId'));
    const player = await options.learningRepository.getPlayerSession(
      context.get('actor'),
      organizationId,
      assignmentId,
    );
    const specification = {
      ...player.specification,
      blocks: player.specification.blocks.map((block) =>
        block.kind === 'QUIZ'
          ? {
              id: block.id,
              kind: block.kind,
              question: block.question,
              options: block.options.map(({ id, label }) => ({ id, label })),
              objectiveIds: block.objectiveIds,
            }
          : block,
      ),
    };
    return context.json({ ...player, specification });
  });

  app.post('/organizations/:organizationId/learning-events', async (context) => {
    const organizationId = parseRouteUuid(context.req.param('organizationId'));
    const event = clientLearningEventSchema.parse(await readJson(context));
    if (event.organizationId !== organizationId) {
      throw new ResourceNotFoundError();
    }
    const result = await options.learningRepository.ingestLearningEvent(
      context.get('actor'),
      event,
    );
    return context.json(result, result.accepted ? 202 : 200);
  });

  app.get(
    '/organizations/:organizationId/classes/:classId/assignments/:assignmentId/progress',
    async (context) => {
      const organizationId = parseRouteUuid(context.req.param('organizationId'));
      const classId = parseRouteUuid(context.req.param('classId'));
      const assignmentId = parseRouteUuid(context.req.param('assignmentId'));
      const progress = await options.learningRepository.listTeacherProgress(
        context.get('actor'),
        organizationId,
        classId,
        assignmentId,
      );
      return context.json(progress);
    },
  );

  app.notFound((context) =>
    errorResponse(
      context,
      {
        status: 404,
        code: 'RESOURCE_NOT_FOUND',
        message: '요청한 정보를 찾을 수 없습니다.',
        retryable: false,
      },
      options.diagnostics,
    ),
  );
  app.onError((error, context) => errorResponse(context, mapError(error), options.diagnostics));

  return app;
}
