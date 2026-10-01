import { create } from 'zustand';

interface UIState {
  isCreateGroupOpen: boolean;
  openCreateGroup: () => void;
  closeCreateGroup: () => void;
  isGroupModalOpen: boolean;
  openGroupModal: () => void;
  closeGroupModal: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  isCreateGroupOpen: false,
  openCreateGroup: () => set({ isCreateGroupOpen: true }),
  closeCreateGroup: () => set({ isCreateGroupOpen: false }),
  isGroupModalOpen: false,
  openGroupModal: () => set({ isGroupModalOpen: true }),
  closeGroupModal: () => set({ isGroupModalOpen: false }),
}));

