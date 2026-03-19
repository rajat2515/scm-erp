import React, { useEffect, useState } from 'react';
import { supabase } from '@/config/supabaseClient';
import { useAuth } from '@/context/AuthContext';
import AppShell from '@/components/layout/AppShell';
import {
    Users, UserCheck, FileText, BookOpen,
    ArrowUpRight, Clock, AlertCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Stats {
    totalStudents: number;
    presentStudents: number;
    totalRte: number;
    gatePassesToday: number;
}

const DEMO_ACTIVITIES = [
    { action: 'New student registered', name: 'Aryan Sharma', time: '2 min ago', icon: Users, color: 'text-blue-500', bg: 'bg-blue-50' },
    { action: 'Gate pass generated', name: 'Priya Mehta', time: '18 min ago', icon: AlertCircle, color: 'text-rose-500', bg: 'bg-rose-50' },
    { action: 'Report card generated', name: 'Class 10-A Term 1', time: '1 hr ago', icon: FileText, color: 'text-violet-500', bg: 'bg-violet-50' },
    { action: 'Staff profile updated', name: 'Mr. Ramesh (Science)', time: '3 hrs ago', icon: UserCheck, color: 'text-amber-500', bg: 'bg-amber-50' },
];

const AdminDashboard: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [stats, setStats] = useState<Stats>({ totalStudents: 0, presentStudents: 0, totalRte: 0, gatePassesToday: 0 });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const today = new Date();
                const isoDate = today.toISOString().split('T')[0];

                const [
                    { count: students },
                    { count: rte },
                    { count: gatePasses },
                ] = await Promise.all([
                    supabase.from('students').select('*', { count: 'exact', head: true }).eq('status', 'active'),
                    supabase.from('students').select('*', { count: 'exact', head: true }).eq('status', 'active').in('rte', ['YES', 'RTE', 'Yes', 'yes', 'rte']),
                    supabase.from('gate_pass_records').select('*', { count: 'exact', head: true }).eq('pass_date', isoDate),
                ]);

                const activeStudents = students ?? 0;
                // Currently simulating attendance as 92% of active students since real module is pending
                const presentStudents = activeStudents > 0 ? Math.floor(activeStudents * 0.92) : 0;

                setStats({
                    totalStudents: activeStudents,
                    presentStudents: presentStudents,
                    totalRte: rte ?? 0,
                    gatePassesToday: gatePasses ?? 0,
                });
            } catch {
                // Demo fallback
                setStats({ totalStudents: 847, presentStudents: 780, totalRte: 45, gatePassesToday: 5 });
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    const metricCards = [
        { label: 'Active Students', value: stats.totalStudents.toLocaleString(), icon: Users, gradient: 'gradient-primary', change: 'Total enrolled', positive: true, path: '/admin/students' },
        { label: 'Present Today', value: stats.presentStudents.toLocaleString(), icon: UserCheck, gradient: 'gradient-emerald', change: 'Estimated count', positive: true, path: '/admin/students' },
        { label: 'RTE Students', value: stats.totalRte.toLocaleString(), icon: BookOpen, gradient: 'gradient-amber', change: 'Under RTE act', positive: true, path: '/admin/students' },
        { label: 'Gate Passes Today', value: stats.gatePassesToday.toLocaleString(), icon: AlertCircle, gradient: 'gradient-rose', change: 'Generated today', positive: false, path: '/admin/reports' }, // Adjust path if gate pass route differs
    ];

    return (
        <AppShell
            title="Admin Dashboard"
            subtitle={`Welcome back, ${user?.displayName?.split(' ')[0] || 'Admin'} 👋`}
        >
            {/* Metric Cards */}
            <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
                {metricCards.map((card) => (
                    <div
                        key={card.label}
                        onClick={() => navigate(card.path)}
                        className="group relative bg-card border border-border rounded-2xl p-5 overflow-hidden cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
                    >
                        <div className={`absolute -top-6 -right-6 w-20 h-20 rounded-full ${card.gradient} opacity-10 blur-xl group-hover:opacity-20 transition-opacity`} />
                        <div className="flex items-start justify-between mb-4">
                            <div className={`w-10 h-10 rounded-xl ${card.gradient} flex items-center justify-center shadow-md`}>
                                <card.icon className="w-5 h-5 text-white" />
                            </div>
                            <ArrowUpRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <p className="text-2xl font-bold text-foreground mb-1">
                            {loading ? <span className="inline-block w-20 h-6 bg-muted animate-pulse rounded" /> : card.value}
                        </p>
                        <p className="text-sm text-muted-foreground">{card.label}</p>
                        <p className={`text-xs mt-2 font-medium ${card.positive ? 'text-emerald-600' : 'text-red-500'}`}>{card.change}</p>
                    </div>
                ))}
            </section>

            {/* Recent Activity */}
            <div className="mb-6">
                <div className="bg-card border border-border rounded-2xl p-6">
                    <h2 className="font-semibold text-foreground mb-4">Recent Activity</h2>
                    <div className="space-y-4">
                        {DEMO_ACTIVITIES.map((act, i) => (
                            <div key={i} className="flex items-start gap-3">
                                <div className={`w-8 h-8 rounded-lg ${act.bg} flex items-center justify-center flex-shrink-0`}>
                                    <act.icon className={`w-4 h-4 ${act.color}`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium text-foreground truncate">{act.action}</p>
                                    <p className="text-xs text-muted-foreground truncate">{act.name}</p>
                                </div>
                                <div className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
                                    <Clock className="w-3 h-3" />
                                    <span>{act.time}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Quick Actions */}
            <section>
                <h2 className="font-semibold text-foreground mb-3 text-sm">Quick Actions</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                        { label: 'Add Student', icon: Users, path: '/admin/students/register', gradient: 'gradient-primary' },
                        { label: 'Generate Gate Pass', icon: AlertCircle, path: '/admin/gate-pass', gradient: 'gradient-emerald' },
                        { label: 'Generate Reports', icon: FileText, path: '/admin/reports', gradient: 'gradient-amber' },
                        { label: 'Add Staff', icon: UserCheck, path: '/admin/staff', gradient: 'gradient-rose' },
                    ].map((action) => (
                        <button
                            key={action.label}
                            onClick={() => navigate(action.path)}
                            className="flex items-center gap-3 p-4 bg-card border border-border rounded-xl hover:shadow-md hover:-translate-y-0.5 transition-all group"
                        >
                            <div className={`w-9 h-9 rounded-lg ${action.gradient} flex items-center justify-center shadow`}>
                                <action.icon className="w-4 h-4 text-white" />
                            </div>
                            <span className="text-sm font-medium text-foreground">{action.label}</span>
                        </button>
                    ))}
                </div>
            </section>
        </AppShell>
    );
};

export default AdminDashboard;
