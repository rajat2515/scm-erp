import React, { useEffect } from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { supabase } from '@/config/supabaseClient';
import { useSessionStore } from '@/store/sessionStore';
import type { AcademicSession } from '@/types';

interface AppShellProps {
    children: React.ReactNode;
    title?: string;
    subtitle?: string;
}

const AppShell: React.FC<AppShellProps> = ({ children, title, subtitle }) => {
    const { setSessions, setActiveSession, setSelectedSession, selectedSession } = useSessionStore();

    useEffect(() => {
        let mounted = true;
        const fetchSessions = async () => {
            const { data, error } = await supabase
                .from('academic_sessions')
                .select('*')
                .order('start_date', { ascending: false });

            if (!error && data && mounted) {
                const fetchedSessions = data as AcademicSession[];
                setSessions(fetchedSessions);
                
                const active = fetchedSessions.find(s => s.is_active) || fetchedSessions[0];
                setActiveSession(active || null);
                
                if (!selectedSession || !fetchedSessions.find(s => s.id === selectedSession.id)) {
                    setSelectedSession(active || null);
                }
            }
        };

        fetchSessions();
        return () => { mounted = false; };
    }, []);

    return (
        <div className="flex h-screen overflow-hidden bg-background">
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <Topbar title={title} subtitle={subtitle} />
            <main className="flex-1 overflow-y-auto p-6 scrollbar-thin">
                <div className="max-w-7xl mx-auto animate-fade-in">
                    {children}
                </div>
            </main>
            </div>
        </div>
    );
};

export default AppShell;
