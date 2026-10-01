import { useAuthStore } from './store';

/**
 * Whether the organization the dashboard is showing uses AirTag tracking
 * (organizations.airtag_tracking — on for ropacal only; the FindMy bridge serves
 * one company). Every AirTag surface renders only when this is true; the backend
 * 404s the AirTag endpoints for everyone else anyway.
 *
 * For an operator that is the organization being acted on, otherwise the
 * signed-in user's. Unknown counts as OFF: a stored organization from before the
 * flag existed is refreshed on load (CentrifugoProvider), and until then nothing
 * AirTag-related shows rather than showing to the wrong company.
 */
export function useAirtagTracking(): boolean {
  return useAuthStore((s) => (s.isPlatform ? s.actingOrg : s.organization)?.airtag_tracking === true);
}
