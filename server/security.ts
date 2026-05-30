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

export function isReservedProjectHandle(handle: string): boolean {
  return reservedProjectNames.includes(handle.toLowerCase() as (typeof reservedProjectNames)[number]);
}

export const publicHandleSchema = z
  .string()
  .min(3)
  .max(48)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Project name must use lowercase letters, numbers, and hyphens.')
  .superRefine((value, ctx) => {
    if (isReservedProjectHandle(value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Project name is reserved.',
      });
    }
  });

export const projectNameSchema = publicHandleSchema;

export const projectIdSchema = z
  .string()
  .regex(/^proj_[a-z0-9]{12}$/i, 'Project id must use the proj_ prefix followed by 12 alphanumeric characters.');

export function validateProjectHandle(handle: string): string {
  return publicHandleSchema.parse(handle);
}

export function validateProjectName(name: string): string {
  return validateProjectHandle(name);
}

export function normalizeProjectName(value: string): string {
  return value.trim().toLowerCase();
}

export function slugifyProjectName(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '')
    .replace(/-{2,}/g, '-');
  return normalized || 'untitled';
}

export function isValidProjectName(value: string): boolean {
  return publicHandleSchema.safeParse(value).success;
}

export function generateProjectHandleBase(seed: string): string {
  return slugifyProjectName(seed).replace(/-{2,}/g, '-');
}
