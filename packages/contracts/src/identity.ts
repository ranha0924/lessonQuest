import { z } from 'zod';

import { uuidSchema } from './primitives.js';

export const platformRoleSchema = z.enum(['STUDENT', 'TEACHER', 'SUPER_ADMIN']);
export const organizationRoleSchema = z.enum(['STUDENT', 'TEACHER', 'ORG_ADMIN']);

const organizationMembershipSchema = z.strictObject({
  organizationId: uuidSchema,
  role: organizationRoleSchema,
});

export const actorSchema = z.strictObject({
  userId: uuidSchema,
  platformRole: platformRoleSchema,
  memberships: z
    .array(organizationMembershipSchema)
    .max(100)
    .superRefine((memberships, context) => {
      const organizationIds = memberships.map(({ organizationId }) => organizationId);
      if (new Set(organizationIds).size !== organizationIds.length) {
        context.addIssue({ code: 'custom', message: 'Organization memberships must be unique' });
      }
    }),
});

const namedResourceInputSchema = z.strictObject({
  name: z.string().trim().min(1).max(80),
});

export const createOrganizationInputSchema = namedResourceInputSchema;
export const createClassInputSchema = namedResourceInputSchema;
export const addClassMemberInputSchema = z.strictObject({
  userId: uuidSchema,
});

export type PlatformRole = z.infer<typeof platformRoleSchema>;
export type OrganizationRole = z.infer<typeof organizationRoleSchema>;
export type Actor = z.infer<typeof actorSchema>;
export type CreateOrganizationInput = z.infer<typeof createOrganizationInputSchema>;
export type CreateClassInput = z.infer<typeof createClassInputSchema>;
export type AddClassMemberInput = z.infer<typeof addClassMemberInputSchema>;
