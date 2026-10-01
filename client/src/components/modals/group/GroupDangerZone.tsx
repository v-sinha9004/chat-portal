import React from 'react';
import { DeleteIcon, LogOutIcon } from '@/components/icons';

interface GroupDangerZoneProps {
  isAdmin: boolean;
  isCreator: boolean;
  onLeaveGroup: () => void;
  onDeleteGroup: () => void;
  isLeaving: boolean;
  isDeleting: boolean;
}

export const GroupDangerZone: React.FC<GroupDangerZoneProps> = ({
  isAdmin,
  isCreator,
  onLeaveGroup,
  onDeleteGroup,
  isLeaving,
  isDeleting,
}) => {
  return (
    <div className="group-danger-zone">
      <div className="group-danger-title">Danger Zone</div>

      <div className="group-danger-actions">
        {/* Leave Group Action */}
        <div className="group-danger-item">
          <div className="group-danger-info">
            <span className="danger-action-name">Leave Group</span>
            <span className="danger-action-desc">
              You will no longer receive messages or updates from this group.
            </span>
          </div>
          <button
            type="button"
            className="btn btn-outline-danger"
            onClick={onLeaveGroup}
            disabled={isLeaving || isDeleting}
          >
            <LogOutIcon size={14} />
            <span>{isLeaving ? 'Leaving...' : 'Leave Group'}</span>
          </button>
        </div>

        {/* Delete Group Action (Only for Admin or Creator) */}
        {(isAdmin || isCreator) && (
          <div className="group-danger-item">
            <div className="group-danger-info">
              <span className="danger-action-name">Delete Group</span>
              <span className="danger-action-desc">
                Permanently delete this group and its member associations.
              </span>
            </div>
            <button
              type="button"
              className="btn btn-danger"
              onClick={onDeleteGroup}
              disabled={isDeleting || isLeaving}
            >
              <DeleteIcon size={14} />
              <span>{isDeleting ? 'Deleting...' : 'Delete Group'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
