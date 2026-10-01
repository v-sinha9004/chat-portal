import React from 'react';
import type { GroupMember } from '@/types';
import { getInitials } from '@/utils/formatters';
import { DeleteIcon } from '@/components/icons';

interface GroupMemberListProps {
  members: GroupMember[];
  currentUserId: string;
  canManageMembers: boolean;
  onRemoveMember: (userId: string, memberName: string) => void;
  isRemovingUserId: string | null;
}

export const GroupMemberList: React.FC<GroupMemberListProps> = ({
  members,
  currentUserId,
  canManageMembers,
  onRemoveMember,
  isRemovingUserId,
}) => {
  return (
    <div className="group-members-section">
      <div className="group-section-title">
        <span>Group Members ({members.length})</span>
      </div>

      <div className="group-members-list">
        {members.map((member) => {
          const isCurrentUser = member.userId === currentUserId;
          const memberUser = member.user;
          const name = memberUser?.name || 'Unknown User';
          const username = memberUser?.username || '';
          const roleBadge = member.role === 'ADMIN' ? 'Admin' : 'Member';
          const canRemoveThisMember = canManageMembers && !isCurrentUser && member.role !== 'ADMIN';

          return (
            <div key={member.id} className="group-member-item">
              <div className="avatar-wrapper small">
                {memberUser?.avatarUrl ? (
                  <img src={memberUser.avatarUrl} alt={name} className="avatar-img" />
                ) : (
                  <div className={`avatar-placeholder avatar-${(memberUser?.role || 'mentee').toLowerCase()}`}>
                    {getInitials(name)}
                  </div>
                )}
              </div>

              <div className="group-member-info">
                <div className="group-member-name-row">
                  <span className="group-member-name">
                    {name} {isCurrentUser && <span className="current-user-tag">(You)</span>}
                  </span>
                  <span className={`member-role-badge ${member.role.toLowerCase()}`}>
                    {roleBadge}
                  </span>
                </div>
                {username && <span className="group-member-handle">@{username}</span>}
              </div>

              {canRemoveThisMember && (
                <button
                  type="button"
                  className="member-remove-btn"
                  onClick={() => onRemoveMember(member.userId, name)}
                  disabled={isRemovingUserId === member.userId}
                  title={`Remove ${name} from group`}
                  aria-label={`Remove ${name} from group`}
                >
                  {isRemovingUserId === member.userId ? (
                    <span className="spinner-mini" />
                  ) : (
                    <DeleteIcon size={14} />
                  )}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
