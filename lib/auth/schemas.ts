import { z } from 'zod';

/**
 * Zod schema for login form validation
 */
export const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  /**
   * Organization slug (e.g. "ropacal"). Case-insensitive server-side.
   *
   * Optional here on purpose. The backend applies a "single-org grace": while
   * exactly one organization exists it infers the org and this may be omitted.
   * The moment a SECOND organization exists that grace disappears and omitting
   * it returns 400. So this field must ship and be usable BEFORE a second
   * tenant is provisioned, but must not become required until then — making it
   * required now would break every existing login.
   *
   * Trimmed and lowercased before sending so " Ropacal " matches "ropacal".
   */
  organization: z
    .string()
    .trim()
    .toLowerCase()
    .optional()
    .transform((v) => (v === '' ? undefined : v)),
});

export type LoginInput = z.infer<typeof loginSchema>;
