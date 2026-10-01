import React from 'react';
import type { Group } from '@/types';

interface GroupModalHeaderProps {
  group: Group;
  isAdmin: boolean;
  onClose: () => void;
}

export const GroupModalHeader: React.FC<GroupModalHeaderProps> = ({
  group,
  isAdmin,
  onClose,
}) => {
  return (
    <div className="modal-header">
      <div className="group-modal-header-info">
        <div className="avatar-wrapper group-avatar-medium">
          {group.avatarUrl ? (
            <img src={group.avatarUrl} alt={group.name} className="avatar-img" />
          ) : (
            <div className="avatar-placeholder avatar-group-bg">
              <span className="avatar-group-icon">👥</span>
            </div>
          )}
        </div>
        <div className="group-modal-title-col">
          <div className="modal-title-row">
            <h3 id="group-modal-title">{group.name}</h3>
            {isAdmin && <span className="role-badge badge-admin">Admin</span>}
          </div>
          <span className="group-modal-subtitle">
            {group.memberCount ?? 1} {group.memberCount === 1 ? 'member' : 'members'}
            {group.description && (
              <>
                <span className="dot-separator">•</span>
                <span className="group-modal-desc-text">{group.description}</span>
              </>
            )}
          </span>
        </div>
      </div>
      <button
        type="button"
        className="modal-close-btn"
        onClick={onClose}
        aria-label="Close modal"
      >
        ✕
      </button>
    </div>
  );
};
