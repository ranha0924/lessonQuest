import { z } from 'zod';
import { uuidSchema } from './primitives.js';
export const teacherSessionSchema = z.strictObject({
  userId: uuidSchema,
  organizations: z
    .array(z.strictObject({ id: uuidSchema, name: z.string().min(1).max(80) }))
    .max(100)
    .refine((items) => new Set(items.map((item) => item.id)).size === items.length),
  aiGeneration: z.literal('AI_BILLING_NOT_CONFIGURED'),
});
export type TeacherSession = z.infer<typeof teacherSessionSchema>;
