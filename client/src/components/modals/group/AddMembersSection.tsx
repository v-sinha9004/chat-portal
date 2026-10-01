import React, { useState, useMemo } from 'react';
import type { User } from '@/types';
import { getInitials } from '@/utils/formatters';
import { UserPlusIcon } from '@/components/icons';

interface AddMembersSectionProps {
  availableContacts: User[];
  onAddMembers: (userIds: string[]) => Promise<void>;
  isAdding: boolean;
}

export const AddMembersSection: React.FC<AddMembersSectionProps> = ({
  availableContacts,
  onAddMembers,
  isAdding,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());

  const filteredContacts = useMemo(() => {
    if (!searchQuery.trim()) return availableContacts;
    const q = searchQuery.toLowerCase();
    return availableContacts.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.username.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q),
    );
  }, [availableContacts, searchQuery]);

  const toggleSelect = (userId: string) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const handleAddSubmit = async () => {
    if (selectedUserIds.size === 0) return;
    await onAddMembers(Array.from(selectedUserIds));
    setSelectedUserIds(new Set());
    setSearchQuery('');
    setIsOpen(false);
  };

  if (!isOpen) {
    return (
      <div className="add-members-trigger-container">
        <button
          type="button"
          className="btn btn-secondary add-members-toggle-btn"
          onClick={() => setIsOpen(true)}
        >
          <UserPlusIcon size={15} />
          <span>Add New Members</span>
        </button>
      </div>
    );
  }

  return (
    <div className="add-members-section">
      <div className="add-members-header">
        <span className="add-members-title">
          Select Members ({selectedUserIds.size} selected)
        </span>
        <button
          type="button"
          className="add-members-cancel-btn"
          onClick={() => {
            setIsOpen(false);
            setSelectedUserIds(new Set());
            setSearchQuery('');
          }}
        >
          Cancel
        </button>
      </div>

      <input
        type="text"
        className="form-input search-contacts-input"
        placeholder="Search contacts..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        autoFocus
      />

      <div className="member-selection-list">
        {filteredContacts.length === 0 ? (
          <div className="no-contacts-found">
            <p>
              {availableContacts.length === 0
                ? 'All contacts are already in this group'
                : `No contacts found matching "${searchQuery}"`}
            </p>
          </div>
        ) : (
          filteredContacts.map((contact) => {
            const isChecked = selectedUserIds.has(contact.id);
            return (
              <div
                key={contact.id}
                className={`member-select-item ${isChecked ? 'selected' : ''}`}
                onClick={() => toggleSelect(contact.id)}
                role="checkbox"
                aria-checked={isChecked}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === ' ' || e.key === 'Enter') {
                    e.preventDefault();
                    toggleSelect(contact.id);
                  }
                }}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => {}}
                  tabIndex={-1}
                />
                <div className="avatar-wrapper small">
                  {contact.avatarUrl ? (
                    <img src={contact.avatarUrl} alt={contact.name} className="avatar-img" />
                  ) : (
                    <div
                      className={`avatar-placeholder avatar-${(contact.role || 'mentee').toLowerCase()}`}
                    >
                      {getInitials(contact.name)}
                    </div>
                  )}
                </div>
                <div className="member-select-info">
                  <span className="member-select-name">{contact.name}</span>
                  <span className="member-select-sub">@{contact.username}</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="add-members-actions">
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleAddSubmit}
          disabled={isAdding || selectedUserIds.size === 0}
        >
          {isAdding
            ? 'Adding...'
            : `Add ${selectedUserIds.size > 0 ? `(${selectedUserIds.size})` : ''} to Group`}
        </button>
      </div>
    </div>
  );
};
