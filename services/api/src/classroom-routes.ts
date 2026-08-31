import { z } from 'zod';
import type { Context, Hono } from 'hono';
import {
  classroomListSchema,
  classDashboardSchema,
  issueClassInvitationInputSchema,
  issuedClassInvitationSchema,
  redeemClassInvitationInputSchema,
  redeemedClassInvitationSchema,
  revokedClassInvitationSchema,
} from '@lessonquest/contracts';
import type { ClassroomRepository } from '@lessonquest/db';
import type { AppEnvironment } from './app.js';

export function registerClassroomRoutes(
  app: Hono<AppEnvironment>,
  repository: ClassroomRepository,
  boundary: {
    readJson(context: Context<AppEnvironment>): Promise<unknown>;
    parseRouteUuid(value: string): string;
  },
) {
  const scope = (context: Context<AppEnvironment>) => ({
    actor: context.get('actor'),
    org: boundary.parseRouteUuid(context.req.param('organizationId') ?? ''),
    trace: context.get('traceId'),
  });
  const classId = (context: Context<AppEnvironment>) =>
    boundary.parseRouteUuid(context.req.param('classId') ?? '');
  app.get('/organizations/:organizationId/classes', async (c) => {
    const { actor, org, trace } = scope(c);
    c.header('Cache-Control', 'no-store');
    return c.json(classroomListSchema.parse(await repository.listClasses(actor, org, trace)));
  });
  app.get('/organizations/:organizationId/classes/:classId/dashboard', async (c) => {
    const { actor, org, trace } = scope(c);
    c.header('Cache-Control', 'no-store');
    return c.json(
      classDashboardSchema.parse(await repository.getDashboard(actor, org, classId(c), trace)),
    );
  });
  app.post('/organizations/:organizationId/classes/:classId/invitations', async (c) => {
    const { actor, org, trace } = scope(c);
    c.header('Cache-Control', 'no-store');
    const input = issueClassInvitationInputSchema.parse(await boundary.readJson(c));
    return c.json(
      issuedClassInvitationSchema.parse(
        await repository.issueInvitation(actor, org, classId(c), input, trace),
      ),
      201,
    );
  });
  app.post(
    '/organizations/:organizationId/classes/:classId/invitations/:invitationId/revoke',
    async (c) => {
      const { actor, org, trace } = scope(c);
      c.header('Cache-Control', 'no-store');
      z.strictObject({}).parse(await boundary.readJson(c));
      return c.json(
        revokedClassInvitationSchema.parse(
          await repository.revokeInvitation(
            actor,
            org,
            classId(c),
            boundary.parseRouteUuid(c.req.param('invitationId')),
            trace,
          ),
        ),
      );
    },
  );
  app.post('/organizations/:organizationId/class-invitations/redeem', async (c) => {
    const { actor, org, trace } = scope(c);
    c.header('Cache-Control', 'no-store');
    const input = redeemClassInvitationInputSchema.parse(await boundary.readJson(c));
    return c.json(
      redeemedClassInvitationSchema.parse(
        await repository.redeemInvitation(actor, org, input, trace),
      ),
    );
  });
}
