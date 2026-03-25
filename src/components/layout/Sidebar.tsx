import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
    LayoutDashboard, Users, UserCheck, DollarSign, FileText,
    GraduationCap, LogOut, ChevronLeft, ChevronRight,
    BookOpen, BarChart3, CalendarCheck, FileBadge, ClipboardList
} from 'lucide-react';
import { supabase } from '@/config/supabaseClient';
import { useAuth } from '@/context/AuthContext';
import { cn, getInitials } from '@/lib/utils';

interface NavItem {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    path: string;
    roles: string[];
}

const NAV_ITEMS: NavItem[] = [
    // Admin
    { label: 'Dashboard', icon: LayoutDashboard, path: '/admin', roles: ['admin'] },
    { label: 'Students', icon: Users, path: '/admin/students', roles: ['admin'] },
    { label: 'Staff Directory', icon: UserCheck, path: '/admin/staff', roles: ['admin'] },
    { label: 'Staff Attendance', icon: CalendarCheck, path: '/admin/staff-attendance', roles: ['admin'] },
    { label: 'Gate Pass', icon: FileBadge, path: '/admin/gate-pass', roles: ['admin'] },
    { label: 'Fee Management', icon: DollarSign, path: '/admin/fees', roles: ['admin'] },
    { label: 'Report Cards', icon: FileText, path: '/admin/reports', roles: ['admin'] },
    // Teacher
    { label: 'My Dashboard', icon: LayoutDashboard, path: '/teacher', roles: ['teacher'] },
    { label: 'Enter Marks', icon: FileText, path: '/teacher/marks', roles: ['teacher'] },
    // Student
    { label: 'My Dashboard', icon: LayoutDashboard, path: '/student', roles: ['student'] },
];

const Sidebar: React.FC = () => {
    const [collapsed, setCollapsed] = useState(false);
    const { user } = useAuth();
    const navigate = useNavigate();

    const visibleItems = NAV_ITEMS.filter((item) =>
        user ? item.roles.includes(user.role) : false
    );

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/login');
    };

    return (
        <aside
            className={cn(
                'relative flex flex-col h-screen transition-all duration-300 ease-in-out z-40 flex-shrink-0',
                collapsed ? 'w-16' : 'w-64'
            )}
            style={{ background: 'hsl(var(--sidebar-bg))' }}
        >
            {/* Logo */}
            <div className={`flex items-center border-b border-white/10 transition-all duration-300 ${collapsed ? 'justify-center py-4 px-2' : 'gap-3 px-4 py-4'}`}>
                <div className={`flex items-center justify-center flex-shrink-0 transition-all duration-300 ${collapsed ? 'w-10 h-10' : 'w-12 h-12'}`}>
                    <img src="/school-logo.png" alt="Logo" className="w-full h-full object-contain" />
                </div>
                {!collapsed && (
                    <div className="animate-fade-in overflow-hidden">
                        <p className="text-white font-bold text-xs leading-tight">S.C.M. ACADEMY</p>
                        <p className="text-xs" style={{ color: 'hsl(var(--sidebar-muted))' }}>
                            Management System
                        </p>
                    </div>
                )}
            </div>

            {/* Nav */}
            <nav className="flex-1 py-4 overflow-y-auto scrollbar-thin">
                <div className="space-y-0.5 px-2">
                    {visibleItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            end={item.path.split('/').length <= 2}
                            className={({ isActive }) =>
                                cn(
                                    'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200',
                                    isActive
                                        ? 'text-white font-medium'
                                        : 'text-white/60 hover:text-white hover:bg-white/10',
                                    collapsed && 'justify-center'
                                )
                            }
                            style={({ isActive }) =>
                                isActive ? { background: 'hsl(var(--sidebar-accent))' } : {}
                            }
                            title={collapsed ? item.label : undefined}
                        >
                            <item.icon className="w-5 h-5 flex-shrink-0" />
                            {!collapsed && (
                                <span className="text-sm truncate animate-fade-in">{item.label}</span>
                            )}
                        </NavLink>
                    ))}
                </div>
            </nav>

            {/* Bottom: user info + collapse + logout */}
            <div className="border-t border-white/10 p-3 space-y-1">
                {!collapsed && user && (
                    <div className="flex items-center gap-2 px-2 py-2 mb-1">
                        <div className="w-7 h-7 rounded-full gradient-primary flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                            {getInitials(user.displayName || user.email || 'U')}
                        </div>
                        <div className="overflow-hidden">
                            <p className="text-white text-xs font-medium truncate">
                                {user.displayName || user.email}
                            </p>
                            <p className="text-xs capitalize" style={{ color: 'hsl(var(--sidebar-muted))' }}>
                                {user.role}
                            </p>
                        </div>
                    </div>
                )}

                {/* Collapse toggle */}
                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-all text-sm"
                    title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                >
                    {collapsed ? (
                        <ChevronRight className="w-4 h-4 flex-shrink-0" />
                    ) : (
                        <>
                            <ChevronLeft className="w-4 h-4" />
                            <span>Collapse</span>
                        </>
                    )}
                </button>

                {/* Logout */}
                <button
                    onClick={handleLogout}
                    className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-white/60 hover:text-red-400 hover:bg-red-400/10 transition-all text-sm"
                >
                    <LogOut className="w-4 h-4 flex-shrink-0" />
                    {!collapsed && <span>Logout</span>}
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;
