import { z } from 'zod';
import { uuidSchema } from './primitives.js';

export const classroomSummarySchema = z.strictObject({
  id: uuidSchema,
  organizationId: uuidSchema,
  name: z.string().min(1).max(80),
});
export const classroomListSchema = z.array(classroomSummarySchema);
export const createdClassSchema = classroomSummarySchema.extend({
  ownerTeacherId: uuidSchema,
  status: z.literal('ACTIVE'),
});
export const issueClassInvitationInputSchema = z.strictObject({
  maxUses: z.number().int().min(1).max(100),
});
export const redeemClassInvitationInputSchema = z.strictObject({
  code: z.string().regex(/^lqi_[a-f0-9]{64}$/),
});
export const classInvitationSchema = z
  .strictObject({
    id: uuidSchema,
    classId: uuidSchema,
    expiresAt: z.iso.datetime(),
    maxUses: z.number().int().min(1).max(100),
    uses: z.number().int().min(0).max(100),
    status: z.enum(['ACTIVE', 'REVOKED']),
  })
  .refine((value) => value.uses <= value.maxUses);
export const issuedClassInvitationSchema = z.strictObject({
  invitation: classInvitationSchema,
  code: redeemClassInvitationInputSchema.shape.code,
});
export const revokedClassInvitationSchema = z.strictObject({ revoked: z.literal(true) });
export const redeemedClassInvitationSchema = z.strictObject({
  classId: uuidSchema,
  className: z.string().min(1).max(80),
  outcome: z.enum(['JOINED', 'DUPLICATE']),
});
const count = z.number().int().nonnegative();
export const classDashboardSchema = z.strictObject({
  lessonClass: classroomSummarySchema,
  memberCount: count,
  invitation: classInvitationSchema.nullable(),
  assignments: z.array(
    z.strictObject({
      assignmentId: uuidSchema,
      title: z.string().min(1).max(120),
      startedCount: count,
      completedCount: count,
      wrongAnswers: count,
      retries: count,
      hintsUsed: count,
    }),
  ),
});
export type ClassroomSummary = z.infer<typeof classroomSummarySchema>;
export type ClassInvitation = z.infer<typeof classInvitationSchema>;
export type IssuedClassInvitation = z.infer<typeof issuedClassInvitationSchema>;
export type RedeemedClassInvitation = z.infer<typeof redeemedClassInvitationSchema>;
export type ClassDashboard = z.infer<typeof classDashboardSchema>;
export type IssueClassInvitationInput = z.infer<typeof issueClassInvitationInputSchema>;
export type RedeemClassInvitationInput = z.infer<typeof redeemClassInvitationInputSchema>;
