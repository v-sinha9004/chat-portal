import type { ActiveConversation, User, GroupMember } from '@/types';

interface UserLookupContext {
  currentUserId: string | null;
  activeConversation: ActiveConversation | null;
  users: User[];
}

/**
 * Resolve display name for a given user ID considering direct chat, group members,
 * global users list, or "You" if current user.
 */
export function resolveDisplayName(
  userId: string,
  context: UserLookupContext,
): string {
  const { currentUserId, activeConversation, users } = context;

  if (userId === currentUserId) return 'You';

  if (activeConversation?.type === 'direct') {
    if (activeConversation.user.id === userId) {
      return activeConversation.user.name || `@${activeConversation.user.username}`;
    }
  }

  if (activeConversation?.type === 'group') {
    const member = activeConversation.group.members?.find((m: GroupMember) => m.userId === userId);
    if (member?.user) {
      return member.user.name || (member.user.username ? `@${member.user.username}` : 'Member');
    }
  }

  const found = users.find((u) => u.id === userId);
  return found?.name || (found?.username ? `@${found.username}` : 'Member');
}

/**
 * Resolve role (e.g. 'MENTOR', 'MENTEE') for a given user ID.
 */
export function resolveUserRole(
  userId: string,
  context: UserLookupContext & { currentUserRole: string },
): string {
  const { currentUserId, currentUserRole, activeConversation, users } = context;

  if (userId === currentUserId) return currentUserRole;

  if (activeConversation?.type === 'direct') {
    if (activeConversation.user.id === userId) {
      return activeConversation.user.role || 'MENTEE';
    }
  }

  if (activeConversation?.type === 'group') {
    const member = activeConversation.group.members?.find((m: GroupMember) => m.userId === userId);
    if (member?.user) {
      return member.user.role || 'MENTEE';
    }
  }

  const found = users.find((u) => u.id === userId);
  return found?.role || 'MENTEE';
}

/**
 * Format active typing user IDs into a human-readable typing indicator string.
 * (e.g., 'Alice is typing...', 'Alice and Bob are typing...', 'Alice, Bob and 2 others are typing...')
 */
export function formatTypingText(
  activeTypingUserIds: string[],
  context: UserLookupContext,
): string | null {
  if (activeTypingUserIds.length === 0) return null;

  const names = activeTypingUserIds.map((id) => resolveDisplayName(id, context));

  if (names.length === 1) {
    return `${names[0]} is typing...`;
  } else if (names.length === 2) {
    return `${names[0]} and ${names[1]} are typing...`;
  } else {
    const remaining = names.length - 2;
    return `${names[0]}, ${names[1]} and ${remaining} ${remaining === 1 ? 'other' : 'others'} are typing...`;
  }
}
