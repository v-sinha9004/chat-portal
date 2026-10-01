import { create } from 'zustand';

export type ToastType = 'info' | 'loading' | 'success' | 'error';

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastStore {
  toasts: ToastItem[];
  showToast: (toast: Omit<ToastItem, 'id'> & { id?: string }) => string;
  dismissToast: (id: string) => void;
}

let toastIdCounter = 0;

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],

  showToast: ({ id, message, type, duration = 3000 }) => {
    const toastId = id || `toast-${++toastIdCounter}`;

    set((state) => {
      const existingIndex = state.toasts.findIndex((t) => t.id === toastId);
      const newToast: ToastItem = { id: toastId, message, type, duration };

      if (existingIndex !== -1) {
        const next = [...state.toasts];
        next[existingIndex] = newToast;
        return { toasts: next };
      }

      return { toasts: [...state.toasts, newToast] };
    });

    if (type !== 'loading' && duration > 0) {
      setTimeout(() => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== toastId),
        }));
      }, duration);
    }

    return toastId;
  },

  dismissToast: (id: string) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },
}));
