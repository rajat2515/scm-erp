import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AcademicSession } from '@/types';

interface SessionStore {
    sessions: AcademicSession[];
    activeSession: AcademicSession | null;
    selectedSession: AcademicSession | null;
    isLoading: boolean;
    setSessions: (sessions: AcademicSession[]) => void;
    setActiveSession: (session: AcademicSession | null) => void;
    setSelectedSession: (session: AcademicSession | null) => void;
    setLoading: (isLoading: boolean) => void;
}

export const useSessionStore = create<SessionStore>()(
    persist(
        (set) => ({
            sessions: [],
            activeSession: null,
            selectedSession: null,
            isLoading: false,

            setSessions: (sessions) => set({ sessions }),
            setActiveSession: (activeSession) => set({ activeSession }),
            setSelectedSession: (selectedSession) => set({ selectedSession }),
            setLoading: (isLoading) => set({ isLoading }),
        }),
        {
            name: 'school-erp-session',
            partialize: (state) => ({
                selectedSession: state.selectedSession,
            }),
        }
    )
);
