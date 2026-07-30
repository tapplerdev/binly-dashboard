import { apiFetch } from './client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'driver' | 'admin';
  created_at: number;
}

export interface CreateUserRequest {
  email: string;
  password: string;
  name: string;
  role: 'driver' | 'admin';
}

export interface CreateUserResponse {
  success: boolean;
  user?: User;
  message?: string;
}

export async function getAllUsers(token: string): Promise<User[]> {
  const response = await apiFetch(`${API_URL}/api/manager/users`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch users');
  }

  const data = await response.json();
  return data.users || [];
}

export async function createUser(request: CreateUserRequest, token: string): Promise<CreateUserResponse> {
  const response = await apiFetch(`${API_URL}/api/manager/users`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    // The API's error shape is {success:false, error:"..."} — read `error`,
    // not `message` (this was the one call site of 14 reading the wrong
    // field, so every failure here collapsed to the generic fallback).
    // Tolerate a non-JSON body too: a proxy or middleware that answers in
    // plain text must surface its text, not a JSON.parse SyntaxError.
    let message = 'Failed to create user';
    const body = await response.text();
    try {
      const parsed = JSON.parse(body);
      message = parsed.error || parsed.message || message;
    } catch {
      if (body.trim()) message = body.trim().slice(0, 200);
    }
    throw new Error(message);
  }

  return await response.json();
}
