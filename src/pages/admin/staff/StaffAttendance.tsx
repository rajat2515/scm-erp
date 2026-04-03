import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/config/supabaseClient';
import AppShell from '@/components/layout/AppShell';
import { Check, Calendar, Search, Loader2, Save, UserCircle2, BarChart2, X, ChevronLeft, ChevronRight, ClipboardList, CalendarDays, LineChart } from 'lucide-react';
import type { StaffProfile, StaffAttendance, WorkingDay } from '@/types';

type AttendanceStatus = 'Present' | 'Absent' | 'Half-day' | 'Leave';
type TabKey = 'record' | 'calendar' | 'analytics';

const STAFF_CATEGORIES = [
    { key: 'all', label: 'All' },
    { key: 'academic', label: 'Academic Staff' },
    { key: 'teachers', label: 'Teachers' },
    { key: 'peon_guard', label: 'Peon & Guard' },
    { key: 'drivers', label: 'Drivers' },
    { key: 'labours', label: 'Labours' },
] as const;

type StaffCategory = typeof STAFF_CATEGORIES[number]['key'];

function getStaffCategory(designation: string): StaffCategory {
    const d = (designation || '').toLowerCase();
    if (d.includes('principal') || d.includes('vice principal') || d.includes('clerk')) return 'academic';
    if (d.includes('t.g.t') || d.includes('p.r.t') || d.includes('music') || d.includes('p.t.i') || d.includes('librarian') || d.includes('teacher')) return 'teachers';
    if (d.includes('peon') || d.includes('guard') || d.includes('attendant') || d.includes('attendent')) return 'peon_guard';
    if (d.includes('driver')) return 'drivers';
    return 'labours';
}

function getMonthName(month: number) {
    return new Date(2000, month).toLocaleString('default', { month: 'long' });
}

export default function StaffAttendancePage() {
    const [activeTab, setActiveTab] = useState<TabKey>('record');
    const [staff, setStaff] = useState<StaffProfile[]>([]);
    const [loadingStaff, setLoadingStaff] = useState(true);

    useEffect(() => {
        const fetchStaff = async () => {
            const { data, error } = await supabase
                .from('staff_profiles')
                .select('*')
                .eq('status', 'active')
                .order('name');
            if (data) setStaff(data as StaffProfile[]);
            setLoadingStaff(false);
        };
        fetchStaff();
    }, []);

    return (
        <AppShell title="Staff Attendance" subtitle="Manage attendance, working days, and detailed analytics">
            {/* Tabs Header */}
            <div className="flex bg-muted/50 p-1.5 rounded-2xl w-fit mb-6 overflow-x-auto">
                {[
                    { id: 'record', label: 'Daily Record', icon: ClipboardList },
                    { id: 'calendar', label: 'Working Days', icon: CalendarDays },
                    { id: 'analytics', label: 'Analytics', icon: LineChart },
                ].map(t => (
                    <button
                        key={t.id}
                        onClick={() => setActiveTab(t.id as TabKey)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
                            activeTab === t.id
                                ? 'bg-card text-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                        }`}
                    >
                        <t.icon className="w-4 h-4" />
                        {t.label}
                    </button>
                ))}
            </div>

            {loadingStaff ? (
                <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 text-primary/40 animate-spin" /></div>
            ) : (
                <>
                    {activeTab === 'record' && <AttendanceRecordTab staff={staff} />}
                    {activeTab === 'calendar' && <WorkingDaysCalendarTab />}
                    {activeTab === 'analytics' && <AnalyticsTab staff={staff} />}
                </>
            )}
        </AppShell>
    );
}

// ─── Daily Record Tab ────────────────────────────────────────────────────────
function AttendanceRecordTab({ staff }: { staff: StaffProfile[] }) {
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [attendance, setAttendance] = useState<Record<string, AttendanceStatus>>({});
    const [originalAttendance, setOriginalAttendance] = useState<Record<string, AttendanceStatus>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [search, setSearch] = useState('');
    const [staffCategory, setStaffCategory] = useState<StaffCategory>('all');
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    useEffect(() => {
        loadData();
    }, [date, staff]);

    const loadData = async () => {
        if (!staff.length) {
            setLoading(false);
            return;
        }
        setLoading(true);
        setError('');
        
        try {
            const { data: attData, error: attErr } = await supabase
                .from('staff_attendance')
                .select('*')
                .eq('date', date);
                
            if (attErr) throw attErr;

            const attMap: Record<string, AttendanceStatus> = {};
            (attData as unknown as StaffAttendance[]).forEach(a => {
                attMap[a.staff_id] = a.status;
            });
            
            // For staff without records today, default to 'Absent'
            staff.forEach(s => {
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

    const handleSave = async () => {
        setSaving(true);
        setError('');
        setSuccessMsg('');
        
        try {
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
        const targetStaff = staffCategory === 'all' ? staff : staff.filter(s => getStaffCategory(s.designation) === staffCategory);
        targetStaff.forEach(s => newAtt[s.id] = status);
        setAttendance(newAtt);
    };

    const filteredStaff = staff.filter(s => {
        const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase()) || (s.designation||'').toLowerCase().includes(search.toLowerCase());
        const matchesCategory = staffCategory === 'all' || getStaffCategory(s.designation) === staffCategory;
        return matchesSearch && matchesCategory;
    });
    
    const hasChanges = JSON.stringify(attendance) !== JSON.stringify(originalAttendance);

    return (
        <div className="animate-fade-in">
            {/* Category Tabs */}
            <div className="flex bg-muted/50 p-1.5 rounded-2xl w-fit mb-5 overflow-x-auto">
                {STAFF_CATEGORIES.map(cat => {
                    const count = cat.key === 'all' ? staff.length : staff.filter(s => getStaffCategory(s.designation) === cat.key).length;
                    return (
                        <button
                            key={cat.key}
                            onClick={() => setStaffCategory(cat.key)}
                            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
                                staffCategory === cat.key
                                    ? 'bg-card text-foreground shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                            }`}
                        >
                            {cat.label}
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                                staffCategory === cat.key ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                            }`}>{count}</span>
                        </button>
                    );
                })}
            </div>

            <div className="flex flex-col lg:flex-row gap-4 mb-6">
                {/* Controls */}
                <div className="flex items-center gap-3 bg-card p-2 rounded-2xl border border-border shadow-sm flex-1 lg:max-w-xs h-14">
                    <div className="flex bg-muted/50 rounded-xl px-4 items-center h-full border border-border/50 w-full">
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
                        className={`flex items-center gap-2 h-14 px-6 rounded-2xl text-sm font-semibold transition-all shadow-lg whitespace-nowrap ${
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
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse min-w-[600px]">
                            <thead>
                                <tr className="border-b border-border bg-muted/30">
                                    <th className="px-6 py-4 text-xs font-bold text-muted-foreground tracking-wider uppercase w-1/3">Staff Member</th>
                                    <th className="px-6 py-4 text-xs font-bold text-muted-foreground tracking-wider uppercase text-right">Attendance Status</th>
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
        </div>
    );
}

// ─── Working Days Calendar Tab ───────────────────────────────────────────────
function WorkingDaysCalendarTab() {
    const [month, setMonth] = useState(new Date().getMonth());
    const [year, setYear] = useState(new Date().getFullYear());
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    const [workingDays, setWorkingDays] = useState<Record<string, { is_working: boolean, notes: string }>>({});
    const [originalDays, setOriginalDays] = useState<Record<string, { is_working: boolean, notes: string }>>({});

    useEffect(() => {
        loadMonthData();
    }, [month, year]);

    const loadMonthData = async () => {
        setLoading(true);
        setError('');
        try {
            const startDate = new Date(year, month, 1).toISOString().split('T')[0];
            const endDate = new Date(year, month + 1, 0).toISOString().split('T')[0];

            const { data, error } = await supabase
                .from('staff_working_days')
                .select('*')
                .gte('date', startDate)
                .lte('date', endDate);

            if (error) throw error;

            const daysMap: Record<string, { is_working: boolean, notes: string }> = {};
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            
            // Initialize with default (Sundays = false, others = true)
            for (let i = 1; i <= daysInMonth; i++) {
                const d = new Date(year, month, i);
                const dateStr = d.toISOString().split('T')[0];
                const isSunday = d.getDay() === 0;
                daysMap[dateStr] = { is_working: !isSunday, notes: isSunday ? 'Sunday' : '' };
            }

            // Override with DB values
            if (data) {
                (data as WorkingDay[]).forEach(wd => {
                    daysMap[wd.date] = { is_working: wd.is_working, notes: wd.notes || '' };
                });
            }

            setWorkingDays(daysMap);
            setOriginalDays(JSON.parse(JSON.stringify(daysMap)));

        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        setError('');
        setSuccessMsg('');
        try {
            const payload = Object.entries(workingDays).map(([date, data]) => ({
                date,
                is_working: data.is_working,
                notes: data.notes
            }));

            const { error } = await supabase
                .from('staff_working_days')
                .upsert(payload, { onConflict: 'date' });
            
            if (error) throw error;
            
            setSuccessMsg('Calendar saved successfully!');
            setOriginalDays(JSON.parse(JSON.stringify(workingDays)));
            
            setTimeout(() => setSuccessMsg(''), 3000);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const toggleDay = (dateStr: string) => {
        setWorkingDays(prev => ({
            ...prev,
            [dateStr]: {
                ...prev[dateStr],
                is_working: !prev[dateStr].is_working,
                notes: !prev[dateStr].is_working ? '' : prev[dateStr].notes
            }
        }));
    };

    const updateNotes = (dateStr: string, notes: string) => {
        setWorkingDays(prev => ({
            ...prev,
            [dateStr]: {
                ...prev[dateStr],
                notes
            }
        }));
    };

    const hasChanges = JSON.stringify(workingDays) !== JSON.stringify(originalDays);
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    const generateGrid = () => {
        const firstDayOfMonth = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        const grid: React.ReactNode[] = [];
        
        // Blank cells before 1st day
        for (let i = 0; i < firstDayOfMonth; i++) {
            grid.push(<div key={`blank-${i}`} className="p-3"></div>);
        }

        for (let i = 1; i <= daysInMonth; i++) {
            const d = new Date(year, month, i);
            const dateStr = d.toISOString().split('T')[0];
            const data = workingDays[dateStr] || { is_working: true, notes: '' };
            const isWorking = data.is_working;

            grid.push(
                <div 
                    key={dateStr}
                    onClick={() => toggleDay(dateStr)}
                    className={`p-3 rounded-2xl border-2 transition-all cursor-pointer flex flex-col items-center justify-start gap-1 min-h-[100px] sm:min-h-[110px] ${
                        isWorking 
                        ? 'border-primary/20 bg-primary/10 hover:border-primary/50' 
                        : 'border-muted bg-muted/30 text-muted-foreground hover:border-red-200 hover:bg-red-50/50 hover:text-red-600'
                    }`}
                >
                    <span className={`text-xl font-bold mt-1 ${isWorking ? 'text-primary' : 'text-muted-foreground opacity-50'}`}>
                        {i}
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-center">
                        {isWorking ? 'Working' : 'Non-Working'}
                    </span>
                    {!isWorking && (
                        <div onClick={e => e.stopPropagation()} className="w-full mt-1 px-1">
                            <input
                                type="text"
                                placeholder="Reason..."
                                value={data.notes}
                                onChange={e => updateNotes(dateStr, e.target.value)}
                                className="w-full bg-background border border-border rounded text-[10px] px-1.5 py-1 focus:outline-none focus:border-red-400 focus:ring-1 focus:ring-red-400 text-center"
                            />
                        </div>
                    )}
                </div>
            );
        }
        return grid;
    };

    return (
        <div className="animate-fade-in bg-card border border-border rounded-3xl p-6 shadow-sm max-w-4xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <div>
                    <h3 className="text-lg font-bold">Working Days Calendar</h3>
                    <p className="text-sm text-muted-foreground">Select dates that count as official working days.</p>
                </div>
                
                <div className="flex items-center gap-4">
                    <div className="flex items-center bg-muted/50 rounded-xl p-1 border border-border/50">
                        <button onClick={() => {
                            if (month === 0) { setMonth(11); setYear(y => y-1); } else setMonth(m => m-1);
                        }} className="p-2 hover:bg-card rounded-lg transition-colors"><ChevronLeft className="w-4 h-4" /></button>
                        <span className="px-4 font-bold text-sm w-36 text-center">{getMonthName(month)} {year}</span>
                        <button onClick={() => {
                            if (month === 11) { setMonth(0); setYear(y => y+1); } else setMonth(m => m+1);
                        }} className="p-2 hover:bg-card rounded-lg transition-colors"><ChevronRight className="w-4 h-4" /></button>
                    </div>

                    <button 
                        onClick={handleSave} 
                        disabled={saving || !hasChanges}
                        className={`flex items-center gap-2 h-10 px-5 rounded-xl text-sm font-semibold transition-all shadow-lg whitespace-nowrap ${
                            hasChanges 
                            ? 'gradient-primary text-white shadow-primary/25 hover:opacity-90' 
                            : 'bg-muted text-muted-foreground shadow-none cursor-not-allowed border border-border'
                        }`}
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        {saving ? 'Saving...' : 'Save Calendar'}
                    </button>
                </div>
            </div>

            {error && <div className="mb-6 p-4 rounded-2xl bg-red-50 text-red-600 font-medium border border-red-200">{error}</div>}
            {successMsg && <div className="mb-6 p-4 flex items-center gap-2 rounded-2xl bg-emerald-50 text-emerald-700 font-medium border border-emerald-200"><Check className="w-5 h-5" /> {successMsg}</div>}

            {loading ? (
                <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 text-primary/40 animate-spin" /></div>
            ) : (
                <>
                    <div className="grid grid-cols-7 gap-2 mb-2">
                        {dayNames.map(day => (
                            <div key={day} className="text-center text-xs font-bold text-muted-foreground uppercase py-2">
                                {day}
                            </div>
                        ))}
                    </div>
                    <div className="grid grid-cols-7 gap-2">
                        {generateGrid()}
                    </div>
                </>
            )}
        </div>
    );
}

// ─── Analytics Tab ───────────────────────────────────────────────────────────
function AnalyticsTab({ staff }: { staff: StaffProfile[] }) {
    const [month, setMonth] = useState(new Date().getMonth());
    const [year, setYear] = useState(new Date().getFullYear());
    const [loading, setLoading] = useState(true);
    
    const [workingDays, setWorkingDays] = useState<Record<string, { is_working: boolean, notes: string }>>({});
    const [attendanceData, setAttendanceData] = useState<StaffAttendance[]>([]);
    const [search, setSearch] = useState('');
    
    const [selectedStaff, setSelectedStaff] = useState<StaffProfile | null>(null);

    useEffect(() => {
        loadAnalyticsData();
    }, [month, year]);

    const loadAnalyticsData = async () => {
        setLoading(true);
        const startDate = new Date(year, month, 1).toISOString().split('T')[0];
        const endDate = new Date(year, month + 1, 0).toISOString().split('T')[0];

        try {
            const { data: wdData } = await supabase
                .from('staff_working_days')
                .select('*')
                .gte('date', startDate)
                .lte('date', endDate);

            const wDaysMap: Record<string, { is_working: boolean, notes: string }> = {};
            if (wdData && wdData.length > 0) {
                (wdData as WorkingDay[]).forEach(wd => {
                    wDaysMap[wd.date] = { is_working: wd.is_working, notes: wd.notes || '' };
                });
            } else {
                const daysInMonth = new Date(year, month + 1, 0).getDate();
                for (let i = 1; i <= daysInMonth; i++) {
                    const d = new Date(year, month, i);
                    wDaysMap[d.toISOString().split('T')[0]] = { is_working: d.getDay() !== 0, notes: d.getDay() === 0 ? 'Sunday' : '' };
                }
            }
            setWorkingDays(wDaysMap);

            const { data: attData } = await supabase
                .from('staff_attendance')
                .select('*')
                .gte('date', startDate)
                .lte('date', endDate);

            setAttendanceData((attData || []) as StaffAttendance[]);
        } catch (err) {
            console.error('Failed to load analytics', err);
        } finally {
            setLoading(false);
        }
    };

    const totalWorkingDaysInMonth = Object.values(workingDays).filter(v => v.is_working).length;

    const filteredStaff = staff.filter(s => 
        s.name.toLowerCase().includes(search.toLowerCase()) || 
        (s.designation||'').toLowerCase().includes(search.toLowerCase())
    );

    const getStats = (staffId: string) => {
        const stats = { Present: 0, Absent: 0, 'Half-day': 0, Leave: 0 };
        const records = attendanceData.filter(a => a.staff_id === staffId);
        const recordMap = Object.fromEntries(records.map(r => [r.date, r.status]));

        const daysInMonth = new Date(year, month + 1, 0).getDate();
        for (let i = 1; i <= daysInMonth; i++) {
            const d = new Date(year, month, i);
            const dateStr = d.toISOString().split('T')[0];
            
            // Only count if marked as a working day
            if (workingDays[dateStr]?.is_working) {
                const status = recordMap[dateStr];
                if (status) {
                    if (status === 'Present') stats.Present++;
                    else if (status === 'Half-day') stats['Half-day']++;
                    else if (status === 'Leave') stats.Leave++;
                    else if (status === 'Absent') stats.Absent++;
                } else {
                    // Check if date is strictly in the past or today, to penalize for absence
                    // We shouldn't count future working days in the month as 'Absent' yet.
                    if (d <= new Date()) {
                        stats.Absent++;
                    }
                }
            }
        }
        return stats;
    };

    return (
        <div className="animate-fade-in relative">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div className="relative w-full max-w-sm h-14">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Search staff analytics..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full h-full pl-11 pr-4 bg-card border border-border rounded-2xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm transition-all"
                    />
                </div>

                <div className="flex items-center bg-card p-1 rounded-2xl border border-border h-14 shadow-sm px-2 gap-1 w-fit">
                    <button onClick={() => {
                        if (month === 0) { setMonth(11); setYear(y => y-1); } else setMonth(m => m-1);
                    }} className="p-2.5 hover:bg-muted rounded-xl transition-colors"><ChevronLeft className="w-4 h-4" /></button>
                    <span className="px-4 font-bold text-sm w-36 text-center">{getMonthName(month)} {year}</span>
                    <button onClick={() => {
                        if (month === 11) { setMonth(0); setYear(y => y+1); } else setMonth(m => m+1);
                    }} 
                    disabled={month === new Date().getMonth() && year === new Date().getFullYear()}
                    className="p-2.5 hover:bg-muted rounded-xl transition-colors disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
                </div>
            </div>

            <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-sm">
                <div className="p-4 border-b border-border bg-emerald-50/50 flex items-center justify-between">
                    <div>
                        <h4 className="font-bold text-emerald-800">Monthly Overview</h4>
                        <p className="text-xs text-emerald-600/80">Calculations based exclusively on marked Working Days.</p>
                    </div>
                    <div className="text-right">
                        <div className="text-2xl font-black text-emerald-700">{totalWorkingDaysInMonth}</div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Total Working Days</div>
                    </div>
                </div>

                {loading ? (
                    <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 text-primary/40 animate-spin" /></div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse min-w-[800px]">
                            <thead>
                                <tr className="border-b border-border bg-muted/30">
                                    <th className="px-6 py-4 text-xs font-bold text-muted-foreground tracking-wider uppercase">Staff Member</th>
                                    <th className="px-6 py-4 text-xs font-bold text-emerald-600 tracking-wider uppercase text-center w-24">Present</th>
                                    <th className="px-6 py-4 text-xs font-bold text-red-600 tracking-wider uppercase text-center w-24">Absent</th>
                                    <th className="px-6 py-4 text-xs font-bold text-amber-600 tracking-wider uppercase text-center w-24">Half-day</th>
                                    <th className="px-6 py-4 text-xs font-bold text-blue-600 tracking-wider uppercase text-center w-24">Leave</th>
                                    <th className="px-6 py-4 text-xs font-bold text-muted-foreground tracking-wider uppercase text-center w-24">Log</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {filteredStaff.map(member => {
                                    const stats = getStats(member.id);
                                    return (
                                        <tr key={member.id} className="hover:bg-muted/10 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                                                        {member.name.split(' ').map(n=>n[0]).slice(0,2).join('').toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-foreground text-sm">{member.name}</p>
                                                        <p className="text-xs text-muted-foreground">{member.designation}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center font-bold text-emerald-600 bg-emerald-50/30">{stats.Present}</td>
                                            <td className="px-6 py-4 text-center font-bold text-red-600 bg-red-50/30">{stats.Absent}</td>
                                            <td className="px-6 py-4 text-center font-bold text-amber-600 bg-amber-50/30">{stats['Half-day']}</td>
                                            <td className="px-6 py-4 text-center font-bold text-blue-600 bg-blue-50/30">{stats.Leave}</td>
                                            <td className="px-6 py-4 text-center">
                                                <button 
                                                    onClick={() => setSelectedStaff(member)}
                                                    className="p-2 rounded-xl text-primary hover:bg-primary/10 transition-colors"
                                                >
                                                    <Calendar className="w-4 h-4 mx-auto" />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        
                        {filteredStaff.length === 0 && (
                            <div className="py-10 text-center text-muted-foreground">No staff match your search.</div>
                        )}
                    </div>
                )}
            </div>

            {selectedStaff && (
                <>
                    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={() => setSelectedStaff(null)} />
                    <div className="fixed right-0 top-0 h-full w-full max-w-md bg-card shadow-2xl z-50 animate-fade-in flex flex-col border-l border-border">
                        <div className="p-6 border-b border-border bg-muted/30 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-full gradient-primary flex items-center justify-center text-white font-bold text-lg">
                                    {selectedStaff.name.split(' ').map(n=>n[0]).slice(0,2).join('').toUpperCase()}
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold">{selectedStaff.name}</h2>
                                    <p className="text-sm text-muted-foreground">{selectedStaff.designation}</p>
                                </div>
                            </div>
                            <button onClick={() => setSelectedStaff(null)} className="p-2 rounded-full hover:bg-muted transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-4 border-b border-border bg-emerald-50 text-emerald-800 text-sm font-semibold flex items-center justify-between">
                            <span>{getMonthName(month)} {year} Daily Log</span>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6">
                            <div className="space-y-3">
                                {Array.from({length: new Date(year, month + 1, 0).getDate()}).map((_, i) => {
                                    const d = new Date(year, month, i + 1);
                                    const dateStr = d.toISOString().split('T')[0];
                                    
                                    const wdData = workingDays[dateStr];
                                    const isWD = wdData?.is_working;
                                    const record = attendanceData.find(a => a.staff_id === selectedStaff.id && a.date === dateStr);
                                    
                                    const displayDate = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', weekday: 'short' });
                                    
                                    if (!isWD) {
                                        return (
                                            <div key={dateStr} className="flex items-center justify-between p-3 border border-border/50 rounded-xl bg-muted/20 opacity-70">
                                                <span className="font-medium text-sm text-muted-foreground">{displayDate}</span>
                                                <span className="px-3 py-1 text-[10px] font-bold rounded-full bg-muted text-muted-foreground uppercase tracking-wider">
                                                    Non-Working Day {wdData?.notes ? `• ${wdData.notes}` : ''}
                                                </span>
                                            </div>
                                        );
                                    }

                                    let status = record ? record.status : 'None';
                                    if (!record && d <= new Date()) status = 'Absent';
                                    
                                    let bg = 'bg-muted text-muted-foreground';
                                    if (status === 'Present') bg = 'bg-emerald-100 text-emerald-800 border border-emerald-200';
                                    if (status === 'Absent') bg = 'bg-red-100 text-red-800 border border-red-200';
                                    if (status === 'Half-day') bg = 'bg-amber-100 text-amber-800 border border-amber-200';
                                    if (status === 'Leave') bg = 'bg-blue-100 text-blue-800 border border-blue-200';

                                    return (
                                        <div key={dateStr} className="flex items-center justify-between p-3 border border-border rounded-xl bg-card shadow-sm">
                                            <span className="font-bold text-sm">{displayDate}</span>
                                            <span className={`px-3 py-1 text-xs font-bold rounded-full ${bg}`}>
                                                {status}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
