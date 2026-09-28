import type { UsersResponse, User } from '../types';

const USERS_API_URL = import.meta.env.VITE_USERS_API_URL || 'http://localhost:3000/api/users';

/**
 * Fetches users directly from the API endpoint.
 * Default URL: http://localhost:3000/api/users
 */
export async function fetchUsers(signal?: AbortSignal): Promise<User[]> {
  const response = await fetch(USERS_API_URL, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
    signal,
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch users: HTTP ${response.status} (${response.statusText || 'Error'})`);
  }

  const result: UsersResponse = await response.json();
  return result.data ?? [];
}
