'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLogin } from '@/lib/auth/queries';
import { useAuthStore } from '@/lib/auth/store';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { inputStyles } from '@/lib/utils';

export function LoginForm() {
  const router = useRouter();
  const { mutate: login, isPending, isError, error } = useLogin();
  const { setAuth, setRememberedEmail, rememberedEmail } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  // Load remembered email on mount
  useEffect(() => {
    if (rememberedEmail) {
      setEmail(rememberedEmail);
      setRememberMe(true);
    }
  }, [rememberedEmail]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    login(
      { email, password },
      {
        onSuccess: (data) => {
          if (data.token && data.user) {
            // Save auth state
            setAuth(data.token, data.user);

            // Handle Remember Me
            if (rememberMe) {
              setRememberedEmail(email);
            } else {
              setRememberedEmail(null);
            }

            // Redirect to dashboard
            router.push('/');
          }
        },
      }
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
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
