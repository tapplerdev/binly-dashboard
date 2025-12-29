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

        // Check if response is ok before parsing JSON
        if (!response.ok) {
          throw new Error('Invalid email or password');
        }

        const data: LoginResponse = await response.json();

        // Handle error responses
        if (!data.ok) {
          throw new Error('Invalid email or password');
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
