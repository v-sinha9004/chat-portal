import type { Group } from '@/types';
import { apiClient } from '@/utils/httpClient';

const GROUPS_API_URL = import.meta.env.VITE_GROUPS_API_URL || '/api/users/groups';

export interface CreateGroupInput {
  name: string;
  description?: string;
  avatarUrl?: string;
  memberIds?: string[];
}

/**
 * Fetch all groups the current authenticated user belongs to.
 */
export async function fetchUserGroups(token: string, signal?: AbortSignal): Promise<Group[]> {
  return apiClient.get<Group[]>(GROUPS_API_URL, { token, signal });
}

/**
 * Create a new group with the current user as ADMIN and selected contacts as MEMBERs.
 */
export async function createGroup(token: string, input: CreateGroupInput): Promise<Group> {
  return apiClient.post<Group>(GROUPS_API_URL, input, { token });
}

/**
 * Fetch detailed group information including member list with hydrated user profiles.
 */
export async function fetchGroupDetails(
  token: string,
  groupId: string,
  signal?: AbortSignal,
): Promise<Group> {
  return apiClient.get<Group>(`${GROUPS_API_URL}/${encodeURIComponent(groupId)}`, {
    token,
    signal,
  });
}

/**
 * Add members to an existing group.
 */
export async function addMembersToGroup(
  token: string,
  groupId: string,
  userIds: string[],
): Promise<Group> {
  return apiClient.post<Group>(
    `${GROUPS_API_URL}/${encodeURIComponent(groupId)}/members`,
    { userIds },
    { token },
  );
}

/**
 * Leave or remove a member from a group.
 */
export async function removeMemberFromGroup(
  token: string,
  groupId: string,
  userId: string,
): Promise<void> {
  return apiClient.delete<void>(
    `${GROUPS_API_URL}/${encodeURIComponent(groupId)}/members/${encodeURIComponent(userId)}`,
    { token },
  );
}

/**
 * Delete a group completely (Admin / Creator only).
 */
export async function deleteGroup(token: string, groupId: string): Promise<void> {
  return apiClient.delete<void>(`${GROUPS_API_URL}/${encodeURIComponent(groupId)}`, { token });
}
