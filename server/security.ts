import { z } from 'zod';

export const reservedProjectNames = [
  'shipnow',
  'api',
  'admin',
  'assets',
  'static',
  'preview',
  'health',
  'login',
  'logout',
  'auth',
  'dashboard',
  'settings',
  'projects',
  'new',
  'system',
  'public',
  'private',
] as const;

export function isReservedProjectName(name: string): boolean {
  return reservedProjectNames.includes(name.toLowerCase() as (typeof reservedProjectNames)[number]);
}

export const projectNameSchema = z
  .string()
  .min(3)
  .max(48)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Project name must use lowercase letters, numbers, and hyphens.')
  .superRefine((value, ctx) => {
    if (isReservedProjectName(value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Project name is reserved.',
      });
    }
  });

export function validateProjectName(name: string): string {
  return projectNameSchema.parse(name);
}
