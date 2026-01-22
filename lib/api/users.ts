/**
 * API functions for users
 */

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: string; // 'manager' | 'driver' | 'admin'
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

/**
 * Get auth token from localStorage (Zustand persist storage)
 */
function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;

  try {
    const authStorage = localStorage.getItem('binly-auth-storage');
    if (!authStorage) return null;

    const parsed = JSON.parse(authStorage);
    return parsed?.state?.token || null;
  } catch (error) {
    console.error('Failed to get auth token:', error);
    return null;
  }
}

/**
 * Get headers with authentication
 */
function getAuthHeaders(): HeadersInit {
  const token = getAuthToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
}

/**
 * Get all users
 */
export async function getUsers(): Promise<User[]> {
  const response = await fetch(`${API_BASE_URL}/api/users`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch users: ${response.statusText}`);
  }

  const data = await response.json();
  return data.users || [];
}

/**
 * Get a single user by ID
 */
export async function getUser(userId: string): Promise<User> {
  const response = await fetch(`${API_BASE_URL}/api/users/${userId}`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch user: ${response.statusText}`);
  }

  return response.json();
}
