import { z } from 'zod';

export const uuidSchema = z.uuid();

export const experienceIdSchema = z
  .string()
  .min(3)
  .max(80)
  .regex(/^[a-z0-9]+(?:_[a-z0-9]+)*$/);

export const contentHashSchema = z.string().regex(/^sha256:[0-9a-f]{64}$/);

export const relativeEntrypointSchema = z
  .string()
  .min(2)
  .max(240)
  .regex(/^\/[A-Za-z0-9_-]+(?:\/[A-Za-z0-9._~-]+)*$/)
  .refine(
    (value) => value.split('/').every((segment) => segment !== '.' && segment !== '..'),
    'Entrypoint cannot contain dot path segments',
  );

export const boundedIdentifierSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/);
