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
  const response = await fetch(`${API_URL}/api/manager/users`, {
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

// Alias for backward compatibility
export const getUsers = getAllUsers;

export async function createUser(request: CreateUserRequest, token: string): Promise<CreateUserResponse> {
  const response = await fetch(`${API_URL}/api/manager/users`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create user');
  }

  return await response.json();
}
