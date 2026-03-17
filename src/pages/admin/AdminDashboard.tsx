import React, { useEffect, useState } from 'react';
import { supabase } from '@/config/supabaseClient';
import { useAuth } from '@/context/AuthContext';
import AppShell from '@/components/layout/AppShell';
import {
    Users, UserCheck, DollarSign, FileText,
    TrendingUp, TrendingDown, ArrowUpRight, Clock
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

interface Stats {
    totalStudents: number;
    totalStaff: number;
    totalCollected: number;
    totalPending: number;
}

const DEMO_ACTIVITIES = [
    { action: 'New student registered', name: 'Aryan Sharma', time: '2 min ago', icon: Users, color: 'text-blue-500', bg: 'bg-blue-50' },
    { action: 'Fee payment recorded', name: 'Priya Mehta – ₹12,000', time: '18 min ago', icon: DollarSign, color: 'text-emerald-500', bg: 'bg-emerald-50' },
    { action: 'Report card generated', name: 'Class 10-A Term 1', time: '1 hr ago', icon: FileText, color: 'text-violet-500', bg: 'bg-violet-50' },
    { action: 'Staff profile updated', name: 'Mr. Ramesh (Science)', time: '3 hrs ago', icon: UserCheck, color: 'text-amber-500', bg: 'bg-amber-50' },
];

const AdminDashboard: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [stats, setStats] = useState<Stats>({ totalStudents: 0, totalStaff: 0, totalCollected: 0, totalPending: 0 });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const [
                    { count: students },
                    { count: staff },
                    { data: fees },
                ] = await Promise.all([
                    supabase.from('students').select('*', { count: 'exact', head: true }),
                    supabase.from('staff').select('*', { count: 'exact', head: true }),
                    supabase.from('fees').select('total_amount, paid_amount'),
                ]);

                let totalCollected = 0;
                let totalPending = 0;
                (fees || []).forEach((f: any) => {
                    totalCollected += f.paid_amount || 0;
                    totalPending += (f.total_amount || 0) - (f.paid_amount || 0);
                });

                setStats({
                    totalStudents: students ?? 847,
                    totalStaff: staff ?? 64,
                    totalCollected: totalCollected || 4280000,
                    totalPending: totalPending || 780000,
                });
            } catch {
                // Demo fallback
                setStats({ totalStudents: 847, totalStaff: 64, totalCollected: 4280000, totalPending: 780000 });
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    const metricCards = [
        { label: 'Total Students', value: stats.totalStudents.toLocaleString(), icon: Users, gradient: 'gradient-primary', change: '+12 this month', positive: true, path: '/admin/students' },
        { label: 'Teaching Staff', value: stats.totalStaff.toLocaleString(), icon: UserCheck, gradient: 'gradient-emerald', change: '+2 this month', positive: true, path: '/admin/staff' },
        { label: 'Fees Collected', value: formatCurrency(stats.totalCollected), icon: TrendingUp, gradient: 'gradient-emerald', change: '84% of target', positive: true, path: '/admin/fees' },
        { label: 'Outstanding Fees', value: formatCurrency(stats.totalPending), icon: TrendingDown, gradient: 'gradient-rose', change: '16% pending', positive: false, path: '/admin/fees' },
    ];

    const collectionPct = stats.totalCollected + stats.totalPending > 0
        ? Math.round(stats.totalCollected / (stats.totalCollected + stats.totalPending) * 100)
        : 84;

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

            {/* Financial Health + Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                {/* Financial Health */}
                <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h2 className="font-semibold text-foreground">Financial Health</h2>
                            <p className="text-xs text-muted-foreground mt-0.5">Academic Year 2025–26</p>
                        </div>
                        <span className="px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-medium rounded-full border border-emerald-200">
                            On Track
                        </span>
                    </div>

                    <div className="space-y-5">
                        {[
                            { label: 'Fees Collected', value: formatCurrency(stats.totalCollected), pct: collectionPct, bar: 'gradient-emerald', textColor: 'text-emerald-600' },
                            { label: 'Outstanding', value: formatCurrency(stats.totalPending), pct: 100 - collectionPct, bar: 'gradient-rose', textColor: 'text-red-500' },
                        ].map((row) => (
                            <div key={row.label}>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm text-muted-foreground">{row.label}</span>
                                    <span className={`text-sm font-semibold ${row.textColor}`}>{row.value}</span>
                                </div>
                                <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                                    <div className={`h-full ${row.bar} rounded-full transition-all duration-1000`} style={{ width: `${row.pct}%` }} />
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t border-border">
                        {[
                            { label: 'Total Budget', value: formatCurrency(stats.totalCollected + stats.totalPending) },
                            { label: 'Collection Rate', value: `${collectionPct}%` },
                            { label: 'Defaulters', value: '43 students' },
                        ].map((item) => (
                            <div key={item.label}>
                                <p className="text-lg font-bold text-foreground">{item.value}</p>
                                <p className="text-xs text-muted-foreground">{item.label}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Recent Activity */}
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
                        { label: 'Record Payment', icon: DollarSign, path: '/admin/fees', gradient: 'gradient-emerald' },
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
