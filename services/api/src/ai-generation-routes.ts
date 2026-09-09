import { uuidSchema } from '@lessonquest/contracts';
import type { LessonInputRepository } from '@lessonquest/db';
import type { Context, Hono } from 'hono';
import { z } from 'zod';

import type { AppEnvironment } from './app.js';

const requestSchema = z.strictObject({
  mutationId: uuidSchema,
  expectedRevision: z.int().positive().max(1_000_000),
});

interface GenerationRouteBoundary {
  readJson(context: Context<AppEnvironment>): Promise<unknown>;
  parseRouteUuid(value: string): string;
  denyGeneration(): never;
}

export function registerAiGenerationRoutes(
  app: Hono<AppEnvironment>,
  repository: LessonInputRepository,
  boundary: GenerationRouteBoundary,
): void {
  app.post(
    '/organizations/:organizationId/lesson-inputs/:lessonInputId/generations',
    async (context) => {
      const organizationId = boundary.parseRouteUuid(context.req.param('organizationId'));
      const lessonInputId = boundary.parseRouteUuid(context.req.param('lessonInputId'));
      requestSchema.parse(await boundary.readJson(context));
      await repository.get(
        context.get('actor'),
        organizationId,
        lessonInputId,
        context.get('traceId'),
      );
      // No billing verifier exists yet. There is deliberately no key lookup,
      // provider construction, administrator exception or environment enable flag.
      return boundary.denyGeneration();
    },
  );
}
