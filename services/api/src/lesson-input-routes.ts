import {
  createLessonInputInputSchema,
  lessonInputListSchema,
  lessonInputMutationResultSchema,
  lessonInputSchema,
  updateLessonInputInputSchema,
} from '@lessonquest/contracts';
import type { LessonInputRepository } from '@lessonquest/db';
import type { Context, Hono } from 'hono';

import type { AppEnvironment } from './app.js';

type AppContext = Context<AppEnvironment>;

interface LessonInputRouteBoundary {
  readJson(context: AppContext): Promise<unknown>;
  parseRouteUuid(value: string): string;
}

export function registerLessonInputRoutes(
  app: Hono<AppEnvironment>,
  repository: LessonInputRepository,
  boundary: LessonInputRouteBoundary,
): void {
  const organizationId = (context: AppContext) =>
    boundary.parseRouteUuid(context.req.param('organizationId') ?? '');
  const lessonInputId = (context: AppContext) =>
    boundary.parseRouteUuid(context.req.param('lessonInputId') ?? '');

  app.get('/organizations/:organizationId/lesson-inputs', async (context) => {
    const result = await repository.list(
      context.get('actor'),
      organizationId(context),
      context.get('traceId'),
    );
    return context.json(lessonInputListSchema.parse(result));
  });

  app.post('/organizations/:organizationId/lesson-inputs', async (context) => {
    const parsedOrganizationId = organizationId(context);
    const input = createLessonInputInputSchema.parse(await boundary.readJson(context));
    const result = lessonInputMutationResultSchema.parse(
      await repository.create(
        context.get('actor'),
        parsedOrganizationId,
        input,
        context.get('traceId'),
      ),
    );
    return context.json(result, result.duplicate ? 200 : 201);
  });

  app.get('/organizations/:organizationId/lesson-inputs/:lessonInputId', async (context) => {
    const result = await repository.get(
      context.get('actor'),
      organizationId(context),
      lessonInputId(context),
      context.get('traceId'),
    );
    return context.json(lessonInputSchema.parse(result));
  });

  app.put('/organizations/:organizationId/lesson-inputs/:lessonInputId', async (context) => {
    const parsedOrganizationId = organizationId(context);
    const parsedLessonInputId = lessonInputId(context);
    const input = updateLessonInputInputSchema.parse(await boundary.readJson(context));
    const result = await repository.update(
      context.get('actor'),
      parsedOrganizationId,
      parsedLessonInputId,
      input,
      context.get('traceId'),
    );
    return context.json(lessonInputMutationResultSchema.parse(result));
  });
}
