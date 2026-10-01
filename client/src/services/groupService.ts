import type { Group } from '@/types';

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
  const response = await fetch(GROUPS_API_URL, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
    signal,
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Unauthorized: Session expired or missing access token');
    }
    throw new Error(`Failed to fetch groups: HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Create a new group with the current user as ADMIN and selected contacts as MEMBERs.
 */
export async function createGroup(token: string, input: CreateGroupInput): Promise<Group> {
  const response = await fetch(GROUPS_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    const message = errorData?.message || `Failed to create group: HTTP ${response.status}`;
    throw new Error(Array.isArray(message) ? message.join(', ') : message);
  }

  return response.json();
}

/**
 * Fetch detailed group information including member list with hydrated user profiles.
 */
export async function fetchGroupDetails(
  token: string,
  groupId: string,
  signal?: AbortSignal,
): Promise<Group> {
  const response = await fetch(`${GROUPS_API_URL}/${encodeURIComponent(groupId)}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
    signal,
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch group details: HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Add members to an existing group.
 */
export async function addMembersToGroup(
  token: string,
  groupId: string,
  userIds: string[],
): Promise<Group> {
  const response = await fetch(`${GROUPS_API_URL}/${encodeURIComponent(groupId)}/members`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ userIds }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.message || `Failed to add members: HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Leave or remove a member from a group.
 */
export async function removeMemberFromGroup(
  token: string,
  groupId: string,
  userId: string,
): Promise<void> {
  const response = await fetch(
    `${GROUPS_API_URL}/${encodeURIComponent(groupId)}/members/${encodeURIComponent(userId)}`,
    {
      method: 'DELETE',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    },
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.message || `Failed to remove member: HTTP ${response.status}`);
  }
}
