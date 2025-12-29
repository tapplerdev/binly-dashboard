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

export interface LoginResponse {
  ok: boolean;
  token?: string;
  user?: User;
}

export interface LoginRequest {
  email: string;
  password: string;
}
