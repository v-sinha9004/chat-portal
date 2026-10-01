import React, { useState, useMemo, useEffect } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { useConversationState, useChatActions } from '@/store/selectors';
import { useUIStore } from '@/store/useUIStore';
import { useToastStore } from '@/store/useToastStore';
import {
  fetchGroupDetails,
  addMembersToGroup,
  removeMemberFromGroup,
  deleteGroup,
} from '@/services/groupService';
import type { Group } from '@/types';
import {
  GroupModalHeader,
  GroupMemberList,
  AddMembersSection,
  GroupDangerZone,
} from './group';

export const GroupModal: React.FC = () => {
  const token = useAuthStore((s) => s.accessToken);
  const currentUserId = useAuthStore((s) => s.user?.id);

  const isOpen = useUIStore((s) => s.isGroupModalOpen);
  const onClose = useUIStore((s) => s.closeGroupModal);

  const { activeConversation, users } = useConversationState();
  const { updateGroup, removeGroup } = useChatActions();
  const showToast = useToastStore((s) => s.showToast);

  const activeGroup: Group | null = useMemo(() => {
    return activeConversation?.type === 'group' ? activeConversation.group : null;
  }, [activeConversation]);

  const [isAddingMembers, setIsAddingMembers] = useState(false);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);
  const [isLeaving, setIsLeaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    if (isOpen && activeGroup?.id && token) {
      fetchGroupDetails(token, activeGroup.id)
        .then((detailed) => {
          if (!isCancelled) {
            updateGroup(detailed);
          }
        })
        .catch((err: unknown) => {
          if (!isCancelled) {
            console.warn('Failed to load group details in modal:', err);
          }
        });
    }
    return () => {
      isCancelled = true;
    };
  }, [isOpen, activeGroup?.id, token, updateGroup]);


  if (!isOpen || !token || !currentUserId || !activeGroup) {
    return null;
  }

  const currentGroup = activeGroup;

  const isCreator = currentGroup.createdById === currentUserId;
  const isAdmin =
    currentGroup.myRole === 'ADMIN' ||
    currentGroup.members?.some((m) => m.userId === currentUserId && m.role === 'ADMIN') ||
    isCreator;

  // Compute contacts not currently in this group
  const existingMemberUserIds = new Set(
    (currentGroup.members || []).map((m) => m.userId),
  );
  const availableContacts = users.filter(
    (u) => u.id !== currentUserId && !existingMemberUserIds.has(u.id),
  );

  const handleAddMembers = async (userIds: string[]) => {
    if (!token) return;
    setIsAddingMembers(true);
    setErrorBanner(null);
    try {
      const updated = await addMembersToGroup(token, currentGroup.id, userIds);
      updateGroup(updated);
      showToast({
        message: `${userIds.length} ${userIds.length === 1 ? 'member' : 'members'} added successfully`,
        type: 'success',
        duration: 3000,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to add members';
      setErrorBanner(message);
      showToast({ message, type: 'error', duration: 4000 });
    } finally {
      setIsAddingMembers(false);
    }
  };

  const handleRemoveMember = async (userId: string, memberName: string) => {
    if (!token) return;
    setRemovingUserId(userId);
    setErrorBanner(null);
    try {
      await removeMemberFromGroup(token, currentGroup.id, userId);
      // Update store with removed member
      const nextMembers = (currentGroup.members || []).filter((m) => m.userId !== userId);
      const updated: Group = {
        ...currentGroup,
        members: nextMembers,
        memberCount: Math.max(1, (currentGroup.memberCount ?? 1) - 1),
      };
      updateGroup(updated);

      showToast({
        message: `${memberName} removed from group`,
        type: 'success',
        duration: 3000,
      });

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to remove member';
      setErrorBanner(message);
      showToast({ message, type: 'error', duration: 4000 });
    } finally {
      setRemovingUserId(null);
    }
  };

  const handleLeaveGroup = async () => {
    if (!token || !window.confirm(`Are you sure you want to leave "${currentGroup.name}"?`)) {
      return;
    }

    setIsLeaving(true);
    setErrorBanner(null);
    try {
      await removeMemberFromGroup(token, currentGroup.id, currentUserId);
      removeGroup(currentGroup.id);
      onClose();
      showToast({
        message: `You left "${currentGroup.name}"`,
        type: 'info',
        duration: 3500,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to leave group';
      setErrorBanner(message);
      showToast({ message, type: 'error', duration: 4000 });
      setIsLeaving(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (
      !token ||
      !window.confirm(
        `Are you sure you want to permanently delete "${currentGroup.name}"? This action cannot be undone.`,
      )
    ) {
      return;
    }

    setIsDeleting(true);
    setErrorBanner(null);
    try {
      await deleteGroup(token, currentGroup.id);
      removeGroup(currentGroup.id);
      onClose();
      showToast({
        message: `Group "${currentGroup.name}" deleted successfully`,
        type: 'success',
        duration: 3500,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete group';
      setErrorBanner(message);
      showToast({ message, type: 'error', duration: 4000 });
      setIsDeleting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-content group-manage-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="group-modal-title"
      >
        <GroupModalHeader
          group={currentGroup}
          isAdmin={Boolean(isAdmin)}
          onClose={onClose}
        />

        <div className="group-modal-body">
          {errorBanner && <div className="modal-error-banner">{errorBanner}</div>}

          {/* Quick action to add members if user has permission */}
          {isAdmin && (
            <AddMembersSection
              availableContacts={availableContacts}
              onAddMembers={handleAddMembers}
              isAdding={isAddingMembers}
            />
          )}

          {/* Member List */}
          {!currentGroup.members || currentGroup.members.length === 0 ? (
            <div className="group-loading-members">
              <span className="spinner-mini" />
              <span>Loading group members...</span>
            </div>
          ) : (
            <GroupMemberList
              members={currentGroup.members}
              currentUserId={currentUserId}
              canManageMembers={Boolean(isAdmin)}
              onRemoveMember={handleRemoveMember}
              isRemovingUserId={removingUserId}
            />
          )}


          {/* Danger Zone: Leave / Delete */}
          <GroupDangerZone
            isAdmin={Boolean(isAdmin)}
            isCreator={Boolean(isCreator)}
            onLeaveGroup={handleLeaveGroup}
            onDeleteGroup={handleDeleteGroup}
            isLeaving={isLeaving}
            isDeleting={isDeleting}
          />
        </div>
      </div>
    </div>
  );
};
