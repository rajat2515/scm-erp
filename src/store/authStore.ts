import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthUser, UserRole } from '@/types';

interface AuthStore {
    user: AuthUser | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    setUser: (user: AuthUser | null) => void;
    setLoading: (loading: boolean) => void;
    clearUser: () => void;
    hasRole: (role: UserRole) => boolean;
    hasAnyRole: (roles: UserRole[]) => boolean;
}

export const useAuthStore = create<AuthStore>()(
    persist(
        (set, get) => ({
            user: null,
            isLoading: false,
            isAuthenticated: false,

            setUser: (user) =>
                set({ user, isAuthenticated: !!user, isLoading: false }),

            setLoading: (isLoading) => set({ isLoading }),

            clearUser: () =>
                set({ user: null, isAuthenticated: false, isLoading: false }),

            hasRole: (role) => get().user?.role === role,

            hasAnyRole: (roles) => {
                const userRole = get().user?.role;
                return userRole ? roles.includes(userRole) : false;
            },
        }),
        {
            name: 'school-erp-auth',
            partialize: (state) => ({
                user: state.user,
                isAuthenticated: state.isAuthenticated,
            }),
        }
    )
);
