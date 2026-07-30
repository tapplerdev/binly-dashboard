import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, Organization } from './types';

interface AuthState {
  token: string | null;
  user: User | null;
  /**
   * The signed-in user's organization. Needed for the per-tenant Centrifugo
   * channel `company:{orgID}:events`, which keys on the org's UUID — not the
   * slug. Null on a pre-tenancy backend, which is why every consumer must
   * handle null rather than assume it.
   */
  organization: Organization | null;
  rememberedEmail: string | null;
  /**
   * Last organization slug used to sign in. Remembered independently of
   * "Remember Me": the slug is not a credential, and re-typing it every login
   * is the friction that makes people get it wrong. Cleared only by an explicit
   * sign-in with a different slug.
   */
  rememberedOrganization: string | null;
  isAuthenticated: boolean;

  /**
   * PLATFORM (cross-tenant operator) session. When true the token is a platform
   * token: it carries no org_id and is rejected by every tenant route, so every
   * API call must be redirected through /api/platform/act with an
   * X-Act-As-Org header. apiFetch does that automatically — see lib/api/client.ts.
   */
  isPlatform: boolean;
  platformEmail: string | null;
  /** Every organization this operator can act on. */
  platformOrgs: Organization[];
  /** The organization currently being acted on. Null until one is chosen. */
  actingOrg: Organization | null;

  setAuth: (token: string, user: User, organization?: Organization | null) => void;
  clearAuth: () => void;
  setRememberedEmail: (email: string | null) => void;
  setRememberedOrganization: (slug: string | null) => void;
  /** Backfill the organization for a session that predates it being stored. */
  setOrganization: (organization: Organization | null) => void;
  setPlatformAuth: (token: string, email: string) => void;
  setPlatformOrgs: (orgs: Organization[]) => void;
  setActingOrg: (org: Organization | null) => void;
}

/**
 * Zustand store for authentication state
 * Persists token, user, and remembered email to localStorage
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      organization: null,
      rememberedEmail: null,
      rememberedOrganization: null,
      isAuthenticated: false,
      isPlatform: false,
      platformEmail: null,
      platformOrgs: [],
      actingOrg: null,

      setAuth: (token, user, organization = null) => {
        // Set cookie for middleware to read
        document.cookie = `binly-auth-token=${token}; path=/; max-age=${60 * 60 * 24 * 7}`; // 7 days
        set({ token, user, organization, isAuthenticated: true });
      },

      clearAuth: () => {
        // Clear cookie
        document.cookie = 'binly-auth-token=; path=/; max-age=0';
        // rememberedOrganization is cleared too. Leaving it behind strands the
        // next person on this browser: they get the PREVIOUS user's slug
        // pre-filled, the backend's users lookup is
        // (organization_id, email) so it misses, and the response is the same
        // opaque 401 it returns for a wrong password. Correct credentials,
        // "invalid email or password", no way to discover why. Shared work
        // devices make that a routine occurrence, not an edge case.
        // rememberedEmail is deliberately NOT cleared — it is the existing
        // "Remember Me" behaviour and is explicitly opt-in.
        set({
          token: null,
          user: null,
          organization: null,
          isAuthenticated: false,
          rememberedOrganization: null,
          isPlatform: false,
          platformEmail: null,
          platformOrgs: [],
          actingOrg: null,
        });
      },

      setRememberedEmail: (email) =>
        set({ rememberedEmail: email }),

      setRememberedOrganization: (slug) =>
        set({ rememberedOrganization: slug }),

      setOrganization: (organization) => set({ organization }),

      setPlatformAuth: (token, email) => {
        document.cookie = `binly-auth-token=${token}; path=/; max-age=${60 * 60}`; // 1h, matches the platform token TTL
        set({
          token,
          isAuthenticated: true,
          isPlatform: true,
          platformEmail: email,
          // An operator is not a tenant user and belongs to no organization.
          // Both stay null so nothing downstream mistakes them for one.
          user: null,
          organization: null,
          actingOrg: null,
        });
      },

      setPlatformOrgs: (orgs) => set({ platformOrgs: orgs }),
      setActingOrg: (org) => set({ actingOrg: org }),
    }),
    {
      name: 'binly-auth-storage',
    }
  )
);
