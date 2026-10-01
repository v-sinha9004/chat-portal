/**
 * Format user last seen timestamp into a human readable relative label.
 * (e.g., '• Last seen just now', '• Last seen 5m ago', '• Last seen today at 14:30')
 */
export function formatLastSeen(timestamp?: string | null): string {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return '';

  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffSec < 60) {
    return '• Last seen just now';
  }
  if (diffSec < 3600) {
    const mins = Math.floor(diffSec / 60);
    return `• Last seen ${mins}m ago`;
  }
  if (diffSec < 86400 && date.getDate() === now.getDate()) {
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `• Last seen today at ${timeStr}`;
  }
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear()
  ) {
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `• Last seen yesterday at ${timeStr}`;
  }

  const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return `• Last seen ${dateStr} at ${timeStr}`;
}

/**
 * Extract up to two uppercase initials from a user's display name or email.
 */
export function getInitials(name?: string): string {
  if (!name) return 'U';
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'U';
}

/**
 * Return CSS class for a user or group role badge.
 */
export function getRoleBadgeClass(role?: string): string {
  switch (role?.toUpperCase()) {
    case 'ADMIN':
      return 'role-badge badge-admin';
    case 'MENTOR':
      return 'role-badge badge-mentor';
    case 'MENTEE':
      return 'role-badge badge-mentee';
    case 'GROUP':
      return 'role-badge badge-group';
    default:
      return 'role-badge';
  }
}

