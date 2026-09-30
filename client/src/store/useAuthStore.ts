import { create } from 'zustand';
import type { AuthUser, LoginCredentials, RegisterCredentials } from '../types';
import { authService } from '../services/authService';
import { useChatStore } from './useChatStore';

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  hydrateSession: () => Promise<void>;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (data: RegisterCredentials) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<string | null>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,

  hydrateSession: async () => {
    try {
      const response = await authService.refresh();
      set({
        accessToken: response.accessToken,
        user: response.user,
        isAuthenticated: true,
        error: null,
        isLoading: false,
      });
    } catch {
      set({
        accessToken: null,
        user: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  },

  login: async (credentials) => {
    set({ isLoading: true, error: null });
    try {
      const response = await authService.login(credentials);
      set({
        accessToken: response.accessToken,
        user: response.user,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Login failed';
      set({ error: message, isLoading: false });
      throw err;
    }
  },

  register: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const response = await authService.register(data);
      set({
        accessToken: response.accessToken,
        user: response.user,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Registration failed';
      set({ error: message, isLoading: false });
      throw err;
    }
  },

  logout: async () => {
    set({ isLoading: true });
    try {
      await authService.logout();
    } finally {
      set({
        accessToken: null,
        user: null,
        isAuthenticated: false,
        error: null,
        isLoading: false,
      });
      // Atomically reset chat store & disconnect socket
      useChatStore.getState().reset();
    }
  },

  refreshSession: async () => {
    try {
      const response = await authService.refresh();
      set({
        accessToken: response.accessToken,
        user: response.user,
        isAuthenticated: true,
      });
      return response.accessToken;
    } catch {
      set({
        accessToken: null,
        user: null,
        isAuthenticated: false,
      });
      useChatStore.getState().reset();
      return null;
    }
  },

  clearError: () => set({ error: null }),
}));
