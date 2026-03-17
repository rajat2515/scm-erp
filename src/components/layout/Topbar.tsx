import React from 'react';
import { Bell } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { getInitials } from '@/lib/utils';

interface TopbarProps {
    title?: string;
    subtitle?: string;
}

const Topbar: React.FC<TopbarProps> = ({ title, subtitle }) => {
    const { user } = useAuth();

    return (
        <header className="h-16 border-b border-border bg-card/80 backdrop-blur-sm flex items-center justify-between px-6 flex-shrink-0">
            {/* Title */}
            <div>
                {title && (
                    <h1 className="text-base font-semibold text-foreground leading-tight">{title}</h1>
                )}
                {subtitle && (
                    <p className="text-xs text-muted-foreground">{subtitle}</p>
                )}
            </div>

            {/* Right side */}
            <div className="flex items-center gap-3">
                {/* Notifications bell */}
                <button className="relative w-9 h-9 flex items-center justify-center rounded-xl hover:bg-muted transition-colors">
                    <Bell className="w-4 h-4 text-muted-foreground" />
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary rounded-full" />
                </button>

                {/* User avatar */}
                {user && (
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center text-white text-xs font-bold">
                            {getInitials(user.displayName || user.email || 'U')}
                        </div>
                        <div className="hidden sm:block">
                            <p className="text-xs font-medium text-foreground leading-tight">
                                {user.displayName || user.email}
                            </p>
                            <p className="text-[10px] text-muted-foreground capitalize">{user.role}</p>
                        </div>
                    </div>
                )}
            </div>
        </header>
    );
};

export default Topbar;
