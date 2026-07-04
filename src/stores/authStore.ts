import { create } from 'zustand';
import api from '../utils/api';
import type { SessionRole, Employee, LoginResponse } from '../types';

interface AuthState {
  token: string | null;
  role: SessionRole | null;
  name: string | null;
  profile: Employee | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  login: (name: string, password: string) => Promise<LoginResponse>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: api.getToken(),
  role: null,
  name: null,
  profile: null,
  isAuthenticated: !!api.getToken(),
  isLoading: false,
  error: null,

  login: async (name: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.post<LoginResponse>('/auth/login', { name, password });
      if (res.success && res.token) {
        api.setToken(res.token);
        set({
          token: res.token,
          role: res.role || null,
          name,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });
      }
      return res;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Ralat log masuk';
      set({ isLoading: false, error: message });
      return { success: false, error: message };
    }
  },

  logout: async () => {
    try {
      const token = api.getToken();
      if (token) {
        await api.post('/auth/logout', { token }).catch(() => {});
      }
    } finally {
      api.setToken(null);
      set({
        token: null,
        role: null,
        name: null,
        profile: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
    }
  },

  checkAuth: async () => {
    const token = api.getToken();
    if (!token) {
      set({ isAuthenticated: false, role: null, name: null, profile: null });
      return;
    }
    try {
      const res = await api.get<{ success: boolean; data: { name: string; role: SessionRole; profile: Employee | null } }>('/auth/me');
      if (res.success) {
        set({
          isAuthenticated: true,
          name: res.data.name,
          role: res.data.role,
          profile: res.data.profile,
        });
      } else {
        api.setToken(null);
        set({ isAuthenticated: false, role: null, name: null, profile: null });
      }
    } catch {
      api.setToken(null);
      set({ isAuthenticated: false, role: null, name: null, profile: null });
    }
  },

  clearError: () => set({ error: null }),
}));