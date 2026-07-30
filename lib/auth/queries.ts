import { useMutation } from '@tanstack/react-query';
import { loginSchema, type LoginInput } from './schemas';
import type { LoginResponse } from './types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

/**
 * React Query hook for login mutation
 * Validates input with Zod before sending request
 */
export function useLogin() {
  return useMutation({
    mutationFn: async (input: LoginInput): Promise<LoginResponse> => {
      // Validate input with Zod schema
      const validated = loginSchema.parse(input);

      try {
        const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(validated),
        });

        // Organization-selection failures carry a real reason and must NOT be
        // reported as bad credentials. Before this, a user who omitted their
        // org slug (400) or whose organization was suspended (403) was told
        // "Invalid email or password" and had no way to discover the actual
        // problem. 401 stays deliberately opaque: the backend returns the same
        // 401 for a wrong password and an unknown slug so login cannot be used
        // to enumerate tenant slugs, and echoing anything more here would
        // reintroduce exactly that.
        if (response.status === 400 || response.status === 403) {
          const body = await response.json().catch(() => null);
          // Only assert an organization problem when the server actually said
          // so. The backend's malformed-body 400 is text/plain ("Invalid
          // request body"), so json() rejects and body is null — blaming the
          // organization field there would send the user chasing the wrong
          // thing.
          if (body?.error) {
            throw new Error(body.error);
          }
          throw new Error(
            response.status === 403
              ? 'Your organization is not active. Contact your administrator.'
              : 'The server rejected the request. Please try again.'
          );
        }

        if (!response.ok) {
          throw new Error('Invalid email or password');
        }

        const data: LoginResponse = await response.json();

        // Handle error responses
        if (!data.ok) {
          throw new Error('Invalid email or password');
        }

        // A PLATFORM (cross-tenant operator) session carries no user and no
        // organization — an operator is neither — so it must be checked before
        // the tenant shape is demanded, or a successful operator login would be
        // rejected here as malformed.
        if (data.platform) {
          if (!data.token) throw new Error('Invalid response from server');
          return data;
        }

        if (!data.token || !data.user) {
          throw new Error('Invalid response from server');
        }

        return data;
      } catch (error) {
        // Check if it's a network error
        if (error instanceof TypeError && error.message.includes('fetch')) {
          throw new Error(
            'Cannot connect to server. Please make sure the backend is running on ' +
              API_BASE_URL
          );
        }
        // Re-throw other errors
        throw error;
      }
    },
  });
}
