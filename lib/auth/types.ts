/**
 * Authentication type definitions
 */

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'driver' | 'admin';
  created_at: number;
}

/** Present once multi-tenancy is live; absent on a pre-tenancy backend. */
export interface Organization {
  id: string;
  name: string;
  slug: string;
}

export interface LoginResponse {
  ok: boolean;
  token?: string;
  user?: User;
  organization?: Organization;
  /**
   * Only set on organization-selection failures (400 missing slug, 403
   * inactive org). Deliberately absent on 401 so a wrong password and an
   * unknown slug are indistinguishable — otherwise login enumerates tenants.
   */
  error?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
  organization?: string;
}
