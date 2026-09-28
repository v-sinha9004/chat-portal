import React from 'react';
import type { User } from '../types';

interface UserListProps {
  users: User[];
  selectedUserId: string | null;
  onSelectUser: (user: User) => void;
}

export const UserList: React.FC<UserListProps> = ({
  users,
  selectedUserId,
  onSelectUser,
}) => {
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getRoleBadgeClass = (role: string) => {
    switch (role.toUpperCase()) {
      case 'ADMIN':
        return 'role-badge badge-admin';
      case 'MENTOR':
        return 'role-badge badge-mentor';
      case 'MENTEE':
        return 'role-badge badge-mentee';
      default:
        return 'role-badge';
    }
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-title-row">
          <h2>Chats</h2>
          <span className="user-count-badge">{users.length} users</span>
        </div>
        <p className="sidebar-subtitle">Select a user to begin messaging</p>
      </div>

      <div className="user-list">
        {users.map((user) => {
          const isSelected = user.id === selectedUserId;
          return (
            <div
              key={user.id}
              className={`user-item ${isSelected ? 'active' : ''}`}
              onClick={() => onSelectUser(user)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectUser(user);
                }
              }}
            >
              <div className="avatar-wrapper">
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt={user.name} className="avatar-img" />
                ) : (
                  <div className={`avatar-placeholder avatar-${user.role.toLowerCase()}`}>
                    {getInitials(user.name)}
                  </div>
                )}
                {user.isActive && <span className="status-indicator online" title="Active" />}
              </div>

              <div className="user-info">
                <div className="user-info-top">
                  <span className="user-name">{user.name}</span>
                  <span className={getRoleBadgeClass(user.role)}>{user.role}</span>
                </div>
                <div className="user-username">@{user.username}</div>
                {user.bio ? (
                  <p className="user-bio">{user.bio}</p>
                ) : (
                  <p className="user-email">{user.email}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
};
