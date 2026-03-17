import React, { createContext, useContext, useEffect } from 'react';
import { supabase } from '@/config/supabaseClient';
import { useAuthStore } from '@/store/authStore';
import type { AuthUser, UserRole } from '@/types';

interface AuthContextValue {
    user: AuthUser | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    hasRole: (role: UserRole) => boolean;
    hasAnyRole: (roles: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { setUser, setLoading, clearUser, hasRole, hasAnyRole, user, isLoading, isAuthenticated } =
        useAuthStore();

    useEffect(() => {
        let mounted = true;

        const loadAndSetUser = async (uid: string, email: string | null) => {
            if (!mounted) return;
            setLoading(true);

            let authUser: AuthUser;
            try {
                // 5-second timeout so the app never hangs if Supabase is slow
                const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000));
                const query = supabase
                    .from('users')
                    .select('role, display_name')
                    .eq('id', uid)
                    .single()
                    .then(({ data }) => data);

                const data = await Promise.race([query, timeout]);
                authUser = {
                    id: uid,
                    email,
                    displayName: data?.display_name || email?.split('@')[0] || 'User',
                    role: (data?.role as UserRole) || 'admin',
                };
            } catch {
                authUser = {
                    id: uid,
                    email,
                    displayName: email?.split('@')[0] || 'User',
                    role: 'admin',
                };
            }

            if (mounted) setUser(authUser);
        };

        // getSession reads from localStorage — instant, no network call
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (!mounted) return;
            if (session?.user) {
                loadAndSetUser(session.user.id, session.user.email ?? null);
            } else {
                clearUser(); // No real session → go to login
            }
        }).catch(() => {
            if (mounted) clearUser();
        });

        // Listen for future auth events (login, logout, token refresh)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (!mounted) return;
            if (session?.user) {
                loadAndSetUser(session.user.id, session.user.email ?? null);
            } else {
                clearUser();
            }
        });

        return () => {
            mounted = false;
            subscription.unsubscribe();
        };
    }, []);

    return (
        <AuthContext.Provider value={{ user, isLoading, isAuthenticated, hasRole, hasAnyRole }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = (): AuthContextValue => {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within AuthProvider');
    return context;
};
