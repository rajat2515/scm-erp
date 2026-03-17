import React from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

interface AppShellProps {
    children: React.ReactNode;
    title?: string;
    subtitle?: string;
}

const AppShell: React.FC<AppShellProps> = ({ children, title, subtitle }) => (
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

export default AppShell;
