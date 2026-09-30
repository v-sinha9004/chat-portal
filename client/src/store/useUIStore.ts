import { create } from 'zustand';

interface UIState {
  isCreateGroupOpen: boolean;
  openCreateGroup: () => void;
  closeCreateGroup: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  isCreateGroupOpen: false,
  openCreateGroup: () => set({ isCreateGroupOpen: true }),
  closeCreateGroup: () => set({ isCreateGroupOpen: false }),
}));
