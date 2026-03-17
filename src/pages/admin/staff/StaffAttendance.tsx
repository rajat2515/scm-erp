import React, { useEffect, useState } from 'react';
import { supabase } from '@/config/supabaseClient';
import AppShell from '@/components/layout/AppShell';
import { Check, Calendar, Search, Loader2, Save, UserCircle2, BarChart2, X, ChevronLeft, ChevronRight } from 'lucide-react';
import type { StaffProfile, StaffAttendance } from '@/types';

type AttendanceStatus = 'Present' | 'Absent' | 'Half-day' | 'Leave';

export default function StaffAttendancePage() {
    const [staff, setStaff] = useState<StaffProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    
    // Default to today
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    
    // Map of staff_id -> status
    const [attendance, setAttendance] = useState<Record<string, AttendanceStatus>>({});
    const [originalAttendance, setOriginalAttendance] = useState<Record<string, AttendanceStatus>>({});
    
    const [search, setSearch] = useState('');
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    // --- Analysis State ---
    const [analysisStaff, setAnalysisStaff] = useState<StaffProfile | null>(null);
    const [analysisMonth, setAnalysisMonth] = useState(new Date().getMonth());
    const [analysisYear, setAnalysisYear] = useState(new Date().getFullYear());
    const [analysisData, setAnalysisData] = useState<StaffAttendance[]>([]);
    const [analysisLoading, setAnalysisLoading] = useState(false);

    useEffect(() => {
        loadData();
    }, [date]);

    const loadData = async () => {
        setLoading(true);
        setError('');
        
        try {
            // Load active staff
            const { data: staffData, error: staffErr } = await supabase
                .from('staff_profiles')
                .select('*')
                .eq('status', 'active')
                .order('name');
                
            if (staffErr) throw staffErr;
            
            // Load attendance for selected date
            const { data: attData, error: attErr } = await supabase
                .from('staff_attendance')
                .select('*')
                .eq('date', date);
                
            if (attErr) throw attErr;

            const staffList = staffData as unknown as StaffProfile[];
            setStaff(staffList);

            // Merge data types
            const attMap: Record<string, AttendanceStatus> = {};
            (attData as unknown as StaffAttendance[]).forEach(a => {
                attMap[a.staff_id] = a.status;
            });
            
            // For staff without records today, default to 'Absent'
            staffList.forEach(s => {
                if (!attMap[s.id]) {
                    attMap[s.id] = 'Absent'; // Auto-absent assumption
                }
            });

            setAttendance({...attMap});
            setOriginalAttendance({...attMap});
        } catch (err: any) {
            setError(err.message || 'Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    // --- Analysis Logic ---
    useEffect(() => {
        if (analysisStaff) {
            fetchAnalysisData();
        }
    }, [analysisStaff, analysisMonth, analysisYear]);

    const fetchAnalysisData = async () => {
        if (!analysisStaff) return;
        setAnalysisLoading(true);

        const startDate = new Date(analysisYear, analysisMonth, 1).toISOString().split('T')[0];
        const endDate = new Date(analysisYear, analysisMonth + 1, 0).toISOString().split('T')[0];

        try {
            const { data, error } = await supabase
                .from('staff_attendance')
                .select('*')
                .eq('staff_id', analysisStaff.id)
                .gte('date', startDate)
                .lte('date', endDate)
                .order('date', { ascending: false });

            if (error) throw error;
            setAnalysisData((data || []) as StaffAttendance[]);
        } catch (err) {
            console.error('Failed to load analysis:', err);
        } finally {
            setAnalysisLoading(false);
        }
    };

    const getAnalysisStats = () => {
        const stats = { Present: 0, Absent: 0, 'Half-day': 0, Leave: 0 };
        analysisData.forEach(d => {
            if (stats[d.status as keyof typeof stats] !== undefined) {
                stats[d.status as keyof typeof stats]++;
            }
        });
        return stats;
    };

    const handlePrevMonth = () => {
        if (analysisMonth === 0) {
            setAnalysisMonth(11);
            setAnalysisYear(y => y - 1);
        } else {
            setAnalysisMonth(m => m - 1);
        }
    };

    const handleNextMonth = () => {
        if (analysisMonth === 11) {
            setAnalysisMonth(0);
            setAnalysisYear(y => y + 1);
        } else {
            setAnalysisMonth(m => m + 1);
        }
    };

    const getMonthName = (month: number) => {
        return new Date(2000, month).toLocaleString('default', { month: 'long' });
    };

    const handleSave = async () => {
        setSaving(true);
        setError('');
        setSuccessMsg('');
        
        try {
            // Prepare upsert payload
            const payload = staff.map(s => ({
                staff_id: s.id,
                date: date,
                status: attendance[s.id]
            }));

            const { error: upsertErr } = await supabase
                .from('staff_attendance')
                .upsert(payload, { onConflict: 'staff_id,date' });
                
            if (upsertErr) throw upsertErr;
            
            setSuccessMsg('Attendance saved successfully!');
            setOriginalAttendance({...attendance});
            
            setTimeout(() => setSuccessMsg(''), 3000);
        } catch (err: any) {
            setError(err.message || 'Failed to save attendance');
        } finally {
            setSaving(false);
        }
    };

    const markAll = (status: AttendanceStatus) => {
        const newAtt = { ...attendance };
        staff.forEach(s => newAtt[s.id] = status);
        setAttendance(newAtt);
    };

    const filteredStaff = staff.filter(s => s.name.toLowerCase().includes(search.toLowerCase()) || (s.designation||'').toLowerCase().includes(search.toLowerCase()));
    
    const hasChanges = JSON.stringify(attendance) !== JSON.stringify(originalAttendance);

    return (
        <AppShell title="Staff Attendance" subtitle="Mark daily attendance for all active employees">
            <div className="flex flex-col lg:flex-row gap-4 mb-6">
                
                {/* Controls */}
                <div className="flex items-center gap-3 bg-card p-2 rounded-2xl border border-border shadow-sm flex-1 lg:max-w-xs h-14">
                    <div className="flex bg-muted/50 rounded-xl px-4 items-center h-full border border-border/50">
                        <Calendar className="w-4 h-4 text-primary mr-2" />
                        <input 
                            type="date" 
                            value={date} 
                            onChange={e => setDate(e.target.value)}
                            max={new Date().toISOString().split('T')[0]}
                            className="bg-transparent border-none text-sm font-semibold focus:outline-none w-full appearance-none"
                        />
                    </div>
                </div>

                {/* Search */}
                <div className="relative flex-1 h-14">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Search staff..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full h-full pl-11 pr-4 bg-card border border-border rounded-2xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm transition-all"
                    />
                </div>

                {/* Save */}
                <div className="flex gap-2">
                    <button 
                        onClick={handleSave} 
                        disabled={saving || !hasChanges}
                        className={`flex items-center gap-2 h-14 px-6 rounded-2xl text-sm font-semibold transition-all shadow-lg ${
                            hasChanges 
                            ? 'gradient-primary text-white shadow-primary/25 hover:opacity-90 hover:scale-[1.02]' 
                            : 'bg-muted text-muted-foreground shadow-none cursor-not-allowed border border-border'
                        }`}
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        {saving ? 'Saving...' : 'Save Attendance'}
                    </button>
                </div>
            </div>

            {error && <div className="mb-6 p-4 rounded-2xl bg-red-50 text-red-600 font-medium border border-red-200 animate-fade-in">{error}</div>}
            {successMsg && <div className="mb-6 p-4 flex items-center gap-2 rounded-2xl bg-emerald-50 text-emerald-700 font-medium border border-emerald-200 animate-fade-in"><Check className="w-5 h-5" /> {successMsg}</div>}

            <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-sm">
                
                {/* Bulk Actions Header */}
                <div className="p-4 border-b border-border bg-muted/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="text-sm font-medium text-muted-foreground pl-2">
                        Mark all as:
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button onClick={() => markAll('Present')} className="px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200">Present All</button>
                        <button onClick={() => markAll('Absent')} className="px-4 py-1.5 rounded-lg text-sm font-medium transition-colors bg-red-50 text-red-700 hover:bg-red-100 border border-red-200">Absent All</button>
                        <button onClick={() => markAll('Half-day')} className="px-4 py-1.5 rounded-lg text-sm font-medium transition-colors bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200">Half-day All</button>
                        <button onClick={() => markAll('Leave')} className="px-4 py-1.5 rounded-lg text-sm font-medium transition-colors bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200">Leave All</button>
                    </div>
                </div>

                {loading ? (
                    <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 text-primary/40 animate-spin" /></div>
                ) : staff.length === 0 ? (
                    <div className="py-20 text-center flex flex-col items-center">
                        <UserCircle2 className="w-12 h-12 text-muted-foreground/30 mb-3" />
                        <p className="text-muted-foreground font-medium">No active staff members found.</p>
                        <p className="text-sm text-muted-foreground/70 mt-1">Add staff in the directory first.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse min-w-[600px]">
                            <thead>
                                <tr className="border-b border-border bg-muted/30">
                                    <th className="px-6 py-4 text-xs font-bold text-muted-foreground tracking-wider uppercase w-1/3">Staff Member</th>
                                    <th className="px-6 py-4 text-xs font-bold text-muted-foreground tracking-wider uppercase text-right">Attendance Status</th>
                                    <th className="px-6 py-4 text-xs font-bold text-muted-foreground tracking-wider uppercase text-center w-16">Analysis</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {filteredStaff.map(member => (
                                    <tr key={member.id} className="hover:bg-muted/10 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                                                    {member.name.split(' ').map(n=>n[0]).slice(0,2).join('').toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-foreground text-sm">{member.name}</p>
                                                    <p className="text-xs text-muted-foreground">{member.designation}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="inline-flex bg-muted/40 p-1 rounded-xl border border-border/50">
                                                {(['Present', 'Absent', 'Half-day', 'Leave'] as AttendanceStatus[]).map(status => {
                                                    const isSelected = attendance[member.id] === status;
                                                    
                                                    let colors = 'text-muted-foreground hover:bg-muted';
                                                    if (isSelected) {
                                                        if (status === 'Present') colors = 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20';
                                                        if (status === 'Absent') colors = 'bg-red-500 text-white shadow-md shadow-red-500/20';
                                                        if (status === 'Half-day') colors = 'bg-amber-500 text-white shadow-md shadow-amber-500/20';
                                                        if (status === 'Leave') colors = 'bg-blue-500 text-white shadow-md shadow-blue-500/20';
                                                    }

                                                    return (
                                                        <button
                                                            key={status}
                                                            onClick={() => setAttendance(p => ({...p, [member.id]: status}))}
                                                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${colors}`}
                                                        >
                                                            {status === 'Half-day' ? 'Half' : status}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <button 
                                                onClick={() => setAnalysisStaff(member)}
                                                className="p-2 rounded-xl text-primary hover:bg-primary/10 transition-colors"
                                                title="View Attendance Analysis"
                                            >
                                                <BarChart2 className="w-5 h-5 mx-auto" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        
                        {filteredStaff.length === 0 && (
                            <div className="py-10 text-center text-muted-foreground">No staff match your search.</div>
                        )}
                    </div>
                )}
            </div>

            {/* Analysis Slide-over */}
            {analysisStaff && (
                <>
                    <div 
                        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity"
                        onClick={() => setAnalysisStaff(null)}
                    />
                    <div className="fixed right-0 top-0 h-full w-full max-w-md bg-card shadow-2xl z-50 animate-fade-in flex flex-col border-l border-border">
                        {/* Header */}
                        <div className="p-6 border-b border-border bg-muted/30 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-full gradient-primary flex items-center justify-center text-white font-bold text-lg">
                                    {analysisStaff.name.split(' ').map(n=>n[0]).slice(0,2).join('').toUpperCase()}
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold">{analysisStaff.name}</h2>
                                    <p className="text-sm text-muted-foreground">{analysisStaff.designation}</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setAnalysisStaff(null)}
                                className="p-2 rounded-full hover:bg-muted transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Month Selector */}
                        <div className="p-4 border-b border-border flex items-center justify-between bg-card text-foreground">
                            <button onClick={handlePrevMonth} className="p-2 hover:bg-muted rounded-xl transition-colors">
                                <ChevronLeft className="w-5 h-5" />
                            </button>
                            <span className="font-bold">{getMonthName(analysisMonth)} {analysisYear}</span>
                            <button 
                                onClick={handleNextMonth} 
                                className="p-2 hover:bg-muted rounded-xl transition-colors disabled:opacity-50"
                                disabled={analysisMonth === new Date().getMonth() && analysisYear === new Date().getFullYear()}
                            >
                                <ChevronRight className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Stats Summary */}
                        <div className="p-6 pb-2">
                            {analysisLoading ? (
                                <div className="h-24 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
                            ) : (
                                <div className="grid grid-cols-2 gap-4">
                                    {[
                                        { label: 'Present', val: getAnalysisStats().Present, c: 'text-emerald-600 bg-emerald-50 border-emerald-100' },
                                        { label: 'Absent', val: getAnalysisStats().Absent, c: 'text-red-600 bg-red-50 border-red-100' },
                                        { label: 'Leave', val: getAnalysisStats().Leave, c: 'text-blue-600 bg-blue-50 border-blue-100' },
                                        { label: 'Half-day', val: getAnalysisStats()['Half-day'], c: 'text-amber-600 bg-amber-50 border-amber-100' },
                                    ].map(s => (
                                        <div key={s.label} className={`p-4 rounded-2xl border flex flex-col items-center justify-center ${s.c}`}>
                                            <span className="text-2xl font-black">{s.val}</span>
                                            <span className="text-xs font-bold uppercase tracking-wider opacity-80">{s.label}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Detailed List */}
                        <div className="flex-1 overflow-y-auto p-6 pt-4">
                            <h3 className="text-sm font-bold text-muted-foreground tracking-wider uppercase mb-4 pl-1">Daily Log</h3>
                            {analysisLoading ? (
                                <div className="flex justify-center p-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
                            ) : analysisData.length === 0 ? (
                                <div className="text-center p-8 text-muted-foreground border border-dashed rounded-2xl bg-muted/10">
                                    No attendance recorded for this month.
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {analysisData.map(record => {
                                        const d = new Date(record.date);
                                        const dateStr = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', weekday: 'short' });
                                        
                                        let bg = 'bg-muted/50 text-muted-foreground';
                                        if (record.status === 'Present') bg = 'bg-emerald-100 text-emerald-800 border border-emerald-200';
                                        if (record.status === 'Absent') bg = 'bg-red-100 text-red-800 border border-red-200';
                                        if (record.status === 'Half-day') bg = 'bg-amber-100 text-amber-800 border border-amber-200';
                                        if (record.status === 'Leave') bg = 'bg-blue-100 text-blue-800 border border-blue-200';

                                        return (
                                            <div key={record.id} className="flex items-center justify-between p-3 border border-border rounded-xl bg-card">
                                                <span className="font-medium text-sm">{dateStr}</span>
                                                <span className={`px-3 py-1 text-xs font-bold rounded-full ${bg}`}>
                                                    {record.status}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}

        </AppShell>
    );
}
