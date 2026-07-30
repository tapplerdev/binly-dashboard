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
  /** Present on the platform whoami listing, absent on the login response. */
  status?: string;
}

export interface LoginResponse {
  ok: boolean;
  token?: string;
  user?: User;
  organization?: Organization;
  /**
   * True when this is a PLATFORM (cross-tenant Binly operator) session rather
   * than a tenant one. Such a response deliberately carries no `user` and no
   * `organization` — an operator is neither — so callers must branch on this
   * before reading either.
   */
  platform?: boolean;
  /** Operator's display name; only present on a platform session. */
  name?: string;
  /** Operator's email; only present on a platform session. */
  email?: string;
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
