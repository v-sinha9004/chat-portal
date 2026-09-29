import type { UsersResponse, User } from '../types';

const USERS_API_URL = import.meta.env.VITE_USERS_API_URL || '/api/users';

/**
 * Fetches users directly from the API endpoint through the API Gateway.
 * Requires an active JWT access token to satisfy the gateway edge auth middleware.
 * Default URL: http://localhost:3000/api/users
 */
export async function fetchUsers(token?: string | null, signal?: AbortSignal): Promise<User[]> {
  const headers: HeadersInit = {
    'Accept': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(USERS_API_URL, {
    method: 'GET',
    headers,
    signal,
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Unauthorized: Session expired or missing access token');
    }
    throw new Error(`Failed to fetch users: HTTP ${response.status} (${response.statusText || 'Error'})`);
  }

  const result: UsersResponse = await response.json();
  return result.data ?? [];
}

