import type { User } from '@/types';
import { apiClient } from '@/utils/httpClient';

const USERS_API_URL = import.meta.env.VITE_USERS_API_URL || '/api/users';

/**
 * Fetches users directly from the API endpoint through the API Gateway.
 * Requires an active JWT access token to satisfy the gateway edge auth middleware.
 * Default URL: http://localhost:3000/api/users
 */
export async function fetchUsers(token?: string | null, signal?: AbortSignal): Promise<User[]> {
  const result = await apiClient.get<User[] | { data: User[] }>(USERS_API_URL, {
    token,
    signal,
  });

  return Array.isArray(result) ? result : (result?.data ?? []);
}
