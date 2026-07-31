'use client';

import { useState, useEffect } from 'react';
import { useLogin } from '@/lib/auth/queries';
import { useAuthStore } from '@/lib/auth/store';
import { useQueryClient } from '@tanstack/react-query';
import { beginSession } from '@/lib/auth/session';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { inputStyles } from '@/lib/utils';

export function LoginForm() {
  const queryClient = useQueryClient();
  const { mutate: login, isPending, isError, error } = useLogin();
  const {
    setAuth,
    setRememberedEmail,
    rememberedEmail,
    setRememberedOrganization,
    rememberedOrganization,
    setPlatformAuth,
  } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [organization, setOrganization] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  // Load remembered email on mount
  useEffect(() => {
    if (rememberedEmail) {
      setEmail(rememberedEmail);
      setRememberMe(true);
    }
  }, [rememberedEmail]);

  // Organization: ?org= wins over the remembered value, so a tenant can be sent
  // a bookmarkable /login?org=acme link that lands on the right organization
  // even on a browser that last signed into a different one. `?org=` with an
  // EMPTY value explicitly means "no organization" and clears the remembered
  // one — that is the escape hatch for someone stuck behind a wrong stored slug
  // (which otherwise only produces an opaque 401).
  //
  // Read from window.location rather than useSearchParams deliberately.
  // useSearchParams calls bailoutToClientRendering() during SSR, which strips
  // the ENTIRE form out of the prerendered HTML — measured: the static
  // login.html lost its <form>, all four inputs and the submit button, so the
  // app's entry page painted an empty card until hydration and rendered nothing
  // at all without JS. This effect is client-only anyway, so window.location is
  // both sufficient and free of that cost, and it needs no Suspense boundary.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has('org')) {
      setOrganization(params.get('org') ?? '');
    } else if (rememberedOrganization) {
      setOrganization(rememberedOrganization);
    }
  }, [rememberedOrganization]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    login(
      { email, password, organization: organization || undefined },
      {
        onSuccess: (data) => {
          // Cross-tenant operator: no user, no organization, and the org is
          // chosen afterwards from the switcher rather than typed here.
          if (data.platform && data.token) {
            setPlatformAuth(data.token, data.email ?? email);
            if (rememberMe) setRememberedEmail(email);
            // Full load, not router.push — a warm React Query cache from an
            // earlier session would otherwise render another organization's
            // rows on this one's dashboard. See lib/auth/session.ts.
            beginSession(queryClient);
            return;
          }

          if (data.token && data.user) {
            // Save auth state, including the organization — the per-tenant
            // Centrifugo channel keys on its UUID.
            setAuth(data.token, data.user, data.organization ?? null);

            // ONLY ever persist the slug the server resolved — never the raw
            // input. A typed slug that the server did not confirm has no
            // business being remembered: on a pre-tenancy backend the field is
            // ignored entirely, so a typo would still "succeed", get stored,
            // and then start failing with an opaque 401 the day tenancy flips.
            // No fallback branch on purpose.
            if (data.organization?.slug) {
              setRememberedOrganization(data.organization.slug);
            }

            // Handle Remember Me
            if (rememberMe) {
              setRememberedEmail(email);
            } else {
              setRememberedEmail(null);
            }

            // Redirect to dashboard
            // Full load, not router.push — a warm React Query cache from an
            // earlier session would otherwise render another organization's
            // rows on this one's dashboard. See lib/auth/session.ts.
            beginSession(queryClient);
          }
        },
      }
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Organization ID — the organizations.slug value, called "Organization
          ID" everywhere a customer can see it.

          Genuinely optional, and expected to stay blank. The server infers the
          organization from the email address and only asks for this when one
          address is registered with more than one organization. Leaving it here
          matters for that case and for ?org= links; it is not a field most
          people will ever fill in. */}
      <div>
        <label
          htmlFor="organization"
          className="block text-sm text-gray-600 mb-1"
        >
          Organization ID <span className="text-gray-400">(optional)</span>
        </label>
        <input
          id="organization"
          name="organization"
          type="text"
          placeholder="e.g. acme"
          value={organization}
          onChange={(e) => setOrganization(e.target.value)}
          disabled={isPending}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          /* NOT autoComplete="organization": that token means the user's
             COMPANY NAME, so Chrome and password managers would offer
             "Ropacal Waste Management LLC" for a field that needs the slug
             "ropacal" — and autofill fires onChange, so the wrong value would
             be submitted and then remembered. */
          autoComplete="off"
          className={inputStyles()}
        />
      </div>

      {/* Email Input */}
      <div>
        <input
          type="email"
          placeholder="Email Address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={isPending}
          className={inputStyles()}
        />
      </div>

      {/* Password Input */}
      <div>
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={isPending}
          className={inputStyles()}
        />
      </div>

      {/* Remember Me & Forgot Password */}
      <div className="flex items-center justify-between text-sm">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            disabled={isPending}
            className="w-4 h-4 text-[#5E9646] border-gray-300 rounded focus:ring-[#5E9646] cursor-pointer disabled:cursor-not-allowed"
          />
          <span className="text-gray-600">Remember Me</span>
        </label>
        <button
          type="button"
          className="text-gray-500 hover:text-[#5E9646] transition-colors"
          disabled={isPending}
        >
          Forgot Password?
        </button>
      </div>

      {/* Error Message */}
      {isError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
          <p className="text-sm text-red-600">
            {error?.message || 'An error occurred. Please try again.'}
          </p>
        </div>
      )}

      {/* Sign In Button */}
      <Button
        type="submit"
        disabled={isPending}
        className="w-full py-6 bg-[#5E9646] hover:bg-[#4d7a38] text-white font-semibold text-base rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isPending ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            Signing in...
          </span>
        ) : (
          'Sign In'
        )}
      </Button>
    </form>
  );
}
