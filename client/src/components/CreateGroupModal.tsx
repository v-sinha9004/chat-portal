import React, { useState, useMemo } from 'react';
import type { User, Group } from '../types';
import { createGroup } from '../services/groupService';

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  contacts: User[];
  currentUserId: string;
  token: string;
  onGroupCreated: (newGroup: Group) => void;
}

export const CreateGroupModal: React.FC<CreateGroupModalProps> = ({
  isOpen,
  onClose,
  contacts,
  token,
  onGroupCreated,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredContacts = useMemo(() => {
    if (!searchQuery.trim()) return contacts;
    const q = searchQuery.toLowerCase();
    return contacts.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.username.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q),
    );
  }, [contacts, searchQuery]);

  if (!isOpen) return null;

  const toggleUserSelection = (userId: string) => {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Please provide a group name');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const newGroup = await createGroup(token, {
        name: trimmedName,
        description: description.trim() || undefined,
        memberIds: Array.from(selectedUserIds),
      });

      onGroupCreated(newGroup);
      handleClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to create group');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setName('');
    setDescription('');
    setSearchQuery('');
    setSelectedUserIds(new Set());
    setError(null);
    onClose();
  };

  const getInitials = (name?: string) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="modal-backdrop" onClick={handleClose}>
      <div
        className="modal-content create-group-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="modal-header">
          <div className="modal-title-row">
            <span className="modal-icon">👥</span>
            <h3 id="modal-title">Create New Group</h3>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={handleClose}
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          {error && <div className="modal-error-banner">{error}</div>}

          <div className="form-group">
            <label htmlFor="group-name-input">
              Group Name <span className="required-star">*</span>
            </label>
            <input
              id="group-name-input"
              type="text"
              className="form-input"
              placeholder="e.g. Engineering Team, Design Sync"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              autoFocus
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="group-desc-input">Description (Optional)</label>
            <input
              id="group-desc-input"
              type="text"
              className="form-input"
              placeholder="What is this group about?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={250}
            />
          </div>

          <div className="form-group">
            <div className="members-header-row">
              <label>Add Members ({selectedUserIds.size} selected)</label>
            </div>

            <input
              type="text"
              className="form-input search-contacts-input"
              placeholder="Search contacts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />

            <div className="member-selection-list">
              {filteredContacts.length === 0 ? (
                <div className="no-contacts-found">
                  <p>No contacts found matching "{searchQuery}"</p>
                </div>
              ) : (
                filteredContacts.map((contact) => {
                  const isChecked = selectedUserIds.has(contact.id);
                  return (
                    <div
                      key={contact.id}
                      className={`member-select-item ${isChecked ? 'selected' : ''}`}
                      onClick={() => toggleUserSelection(contact.id)}
                      role="checkbox"
                      aria-checked={isChecked}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === ' ' || e.key === 'Enter') {
                          e.preventDefault();
                          toggleUserSelection(contact.id);
                        }
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}} // handled by div click
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
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting || !name.trim()}
            >
              {isSubmitting ? 'Creating...' : 'Create Group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
