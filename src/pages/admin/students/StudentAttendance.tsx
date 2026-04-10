import React, { useEffect, useState, useCallback } from 'react';
import AppShell from '@/components/layout/AppShell';
import { supabase } from '@/config/supabaseClient';
import {
    Users, BarChart3, CalendarCheck, Search, Loader2,
    ChevronDown, AlertTriangle, CheckCircle2, TrendingUp,
    TrendingDown, Save, Check, ChevronLeft, ChevronRight,
    CalendarDays, ClipboardList, LineChart
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────
interface StudentAttRecord {
    sr_no: number;
    name: string;
    roll_no: string;
    present: number;
    absent: number;
    totalWorkingDays: number;
    percentage: number;
}

interface WorkingDayData {
    is_working: boolean;
    notes: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const CLASS_LIST = [
    'Nursery', 'LKG', 'UKG',
    'ONE A', 'ONE B', 'TWO A', 'TWO B', 'THREE A', 'THREE B',
    'FOUR A', 'FOUR B', 'FIVE A', 'FIVE B', 'SIX A', 'SIX B',
    'SEVEN A', 'SEVEN B', 'EIGHT A', 'EIGHT B',
];

// ── Helpers ───────────────────────────────────────────────────────────────────
const pct = (p: number, t: number) => (t === 0 ? 0 : Math.round((p / t) * 100));
// Build 'YYYY-MM-DD' directly — never use new Date(y,m,d).toISOString() in IST
// because local midnight converts to the previous UTC day.
const isoDate = (y: number, m: number, d: number): string =>
    `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const todayIso = (): string => {
    const n = new Date();
    return isoDate(n.getFullYear(), n.getMonth(), n.getDate());
};
const getMonthName = (m: number) => new Date(2000, m).toLocaleString('default', { month: 'long' });
const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
// Day-of-week for a YYYY-MM-DD string — uses noon UTC to avoid any DST edge
const dowOf = (ds: string): number => {
    const [y, m, d] = ds.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay();
};

const PctBadge: React.FC<{ value: number }> = ({ value }) => {
    const color = value >= 85 ? 'bg-emerald-100 text-emerald-700'
        : value >= 70 ? 'bg-amber-100 text-amber-700'
            : 'bg-rose-100 text-rose-700';
    return <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${color}`}>{value}%</span>;
};

const MiniBar: React.FC<{ value: number }> = ({ value }) => (
    <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1">
        <div
            className={`h-1.5 rounded-full transition-all ${value >= 85 ? 'bg-emerald-500' : value >= 70 ? 'bg-amber-500' : 'bg-rose-500'}`}
            style={{ width: `${value}%` }}
        />
    </div>
);

// ── Shared: fetch working days for a date range ────────────────────────────────
async function fetchWorkingDaysInRange(from: string, to: string): Promise<Record<string, WorkingDayData>> {
    const { data } = await supabase
        .from('student_working_days')
        .select('date, is_working, notes')
        .gte('date', from)
        .lte('date', to);

    // Build defaults by iterating date strings — timezone-safe
    const map: Record<string, WorkingDayData> = {};
    const [fy, fm, fd] = from.split('-').map(Number);
    const [ty, tm, td] = to.split('-').map(Number);
    const startUtc = new Date(Date.UTC(fy, fm - 1, fd, 12));
    const endUtc   = new Date(Date.UTC(ty, tm - 1, td, 12));
    for (const cur = new Date(startUtc); cur <= endUtc; cur.setUTCDate(cur.getUTCDate() + 1)) {
        const ds = cur.toISOString().split('T')[0];
        const isSunday = cur.getUTCDay() === 0;
        map[ds] = { is_working: !isSunday, notes: isSunday ? 'Sunday' : '' };
    }
    // Override with DB values
    (data || []).forEach((row: any) => {
        map[row.date] = { is_working: row.is_working, notes: row.notes || '' };
    });
    return map;
}

// ── Tab 1: Class-wise Attendance ──────────────────────────────────────────────
const ClasswiseTab: React.FC = () => {
    const [selectedClass, setSelectedClass] = useState(CLASS_LIST[6]);
    const [students, setStudents] = useState<StudentAttRecord[]>([]);
    const [loading, setLoading] = useState(false);
    const [dateFrom, setDateFrom] = useState(() => {
        const n = new Date(); return isoDate(n.getFullYear(), n.getMonth(), 1);
    });
    const [dateTo, setDateTo] = useState(() => todayIso());
    const [search, setSearch] = useState('');

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            // Get all students
            const { data: studentList } = await supabase
                .from('students')
                .select('sr_no, name, roll_no')
                .eq('class', selectedClass)
                .eq('status', 'active')
                .order('name', { ascending: true });

            if (!studentList || studentList.length === 0) { setStudents([]); setLoading(false); return; }

            // Get working days in range
            const workingDayMap = await fetchWorkingDaysInRange(dateFrom, dateTo);
            const totalWorkingDays = Object.values(workingDayMap).filter(v => v.is_working).length;

            // Get attendance records
            const { data: attRecords } = await supabase
                .from('student_attendance')
                .select('student_id, status, attendance_date')
                .eq('class_name', selectedClass)
                .gte('attendance_date', dateFrom)
                .lte('attendance_date', dateTo);

            // Aggregate — only count attendance on working days
            const attMap: Record<number, number> = {};
            (attRecords || []).forEach((r: any) => {
                if (workingDayMap[r.attendance_date]?.is_working && r.status === 'present') {
                    attMap[r.student_id] = (attMap[r.student_id] || 0) + 1;
                }
            });

            const result: StudentAttRecord[] = studentList.map((s: any) => {
                const present = attMap[s.sr_no] || 0;
                const absent = totalWorkingDays - present;
                return {
                    sr_no: s.sr_no,
                    name: s.name,
                    roll_no: s.roll_no,
                    present,
                    absent: Math.max(0, absent),
                    totalWorkingDays,
                    percentage: pct(present, totalWorkingDays),
                };
            });

            setStudents(result);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [selectedClass, dateFrom, dateTo]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const filtered = students.filter(s =>
        !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.roll_no?.includes(search)
    );

    const avgPct = students.length ? Math.round(students.reduce((s, r) => s + r.percentage, 0) / students.length) : 0;
    const lowAtt = students.filter(s => s.percentage < 75);

    return (
        <div className="space-y-6">
            {/* Controls */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <div className="flex flex-wrap items-end gap-4">
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1.5">Class</label>
                        <div className="relative">
                            <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)}
                                className="appearance-none pl-4 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm cursor-pointer">
                                {CLASS_LIST.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1.5">From</label>
                        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                            className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm" />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1.5">To</label>
                        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                            className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm" />
                    </div>
                    <div className="relative flex-1 min-w-[180px]">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1.5">Search</label>
                        <Search className="absolute left-3 bottom-2.5 w-4 h-4 text-slate-400" />
                        <input type="text" placeholder="Name or roll no..." value={search} onChange={e => setSearch(e.target.value)}
                            className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm" />
                    </div>
                </div>
            </div>

            {/* Summary strip */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Total Students', value: students.length, icon: Users, color: 'bg-indigo-50 text-indigo-600' },
                    { label: 'Working Days', value: students[0]?.totalWorkingDays ?? 0, icon: CalendarDays, color: 'bg-blue-50 text-blue-600' },
                    { label: 'Avg Attendance', value: `${avgPct}%`, icon: BarChart3, color: avgPct >= 85 ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600' },
                    { label: 'Low Att. (<75%)', value: lowAtt.length, icon: AlertTriangle, color: 'bg-rose-50 text-rose-600' },
                ].map(({ label, value, icon: Icon, color }) => (
                    <div key={label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex items-center gap-4">
                        <div className={`w-11 h-11 rounded-2xl ${color} flex items-center justify-center flex-shrink-0`}><Icon className="w-5 h-5" /></div>
                        <div>
                            <p className="text-2xl font-black text-slate-800">{value}</p>
                            <p className="text-xs text-slate-400 font-medium mt-0.5">{label}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-50 bg-slate-50/50">
                    <h3 className="font-bold text-slate-700">
                        Attendance — <span className="text-indigo-600 uppercase">{selectedClass}</span>
                        {students[0]?.totalWorkingDays > 0 && (
                            <span className="text-slate-400 font-normal text-sm ml-2">({students[0].totalWorkingDays} working days)</span>
                        )}
                    </h3>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-indigo-400" /></div>
                ) : filtered.length === 0 ? (
                    <div className="py-14 text-center text-slate-400">
                        <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
                        <p className="font-medium">No students found in this class</p>
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-12 gap-3 px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-50">
                            <div className="col-span-1">#</div>
                            <div className="col-span-1">Roll</div>
                            <div className="col-span-4">Name</div>
                            <div className="col-span-1 text-center">Present</div>
                            <div className="col-span-1 text-center">Absent</div>
                            <div className="col-span-1 text-center">Total</div>
                            <div className="col-span-3">Attendance %</div>
                        </div>
                        <div className="divide-y divide-slate-50">
                            {filtered.map((s, idx) => (
                                <div key={s.sr_no} className={`grid grid-cols-12 gap-3 px-5 py-3.5 items-center transition-colors ${s.percentage < 75 && s.totalWorkingDays > 0 ? 'bg-rose-50/30 hover:bg-rose-50/50' : 'hover:bg-slate-50/50'}`}>
                                    <div className="col-span-1 text-sm font-bold text-slate-400">{idx + 1}</div>
                                    <div className="col-span-1 text-xs font-mono font-bold text-indigo-500">{s.roll_no || '—'}</div>
                                    <div className="col-span-4">
                                        <p className="text-sm font-bold text-slate-800 capitalize">{s.name}</p>
                                    </div>
                                    <div className="col-span-1 text-center"><span className="text-sm font-bold text-emerald-600">{s.present}</span></div>
                                    <div className="col-span-1 text-center"><span className="text-sm font-bold text-rose-500">{s.absent}</span></div>
                                    <div className="col-span-1 text-center"><span className="text-sm font-bold text-slate-500">{s.totalWorkingDays}</span></div>
                                    <div className="col-span-3">
                                        {s.totalWorkingDays === 0 ? (
                                            <span className="text-xs text-slate-400">No working days</span>
                                        ) : (
                                            <div><PctBadge value={s.percentage} /><MiniBar value={s.percentage} /></div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

// ── Tab 2: Working Days Calendar ──────────────────────────────────────────────
const WorkingDaysTab: React.FC = () => {
    const [month, setMonth] = useState(new Date().getMonth());
    const [year, setYear] = useState(new Date().getFullYear());
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [workingDays, setWorkingDays] = useState<Record<string, WorkingDayData>>({});
    const [originalDays, setOriginalDays] = useState<Record<string, WorkingDayData>>({});

    useEffect(() => { loadMonthData(); }, [month, year]);

    const loadMonthData = async () => {
        setLoading(true);
        setError('');
        try {
            // Build date strings directly — no Date→toISOString conversion (breaks in IST)
            const startDate = isoDate(year, month, 1);
            const endDate   = isoDate(year, month, daysInMonth(year, month));

            const { data, error } = await supabase
                .from('student_working_days')
                .select('*')
                .gte('date', startDate)
                .lte('date', endDate);

            if (error) throw error;

            const dim = daysInMonth(year, month);
            const daysMap: Record<string, WorkingDayData> = {};
            for (let i = 1; i <= dim; i++) {
                const ds = isoDate(year, month, i);
                const isSunday = dowOf(ds) === 0;
                daysMap[ds] = { is_working: !isSunday, notes: isSunday ? 'Sunday' : '' };
            }
            (data || []).forEach((wd: any) => {
                daysMap[wd.date] = { is_working: wd.is_working, notes: wd.notes || '' };
            });

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
        try {
            const payload = Object.entries(workingDays).map(([date, data]) => ({
                date,
                is_working: data.is_working,
                notes: data.notes,
            }));

            const { error } = await supabase
                .from('student_working_days')
                .upsert(payload, { onConflict: 'date' });

            if (error) throw error;
            setSuccessMsg('Working days saved successfully!');
            setOriginalDays(JSON.parse(JSON.stringify(workingDays)));
            setTimeout(() => setSuccessMsg(''), 3000);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const toggleDay = (ds: string) => {
        setWorkingDays(prev => ({
            ...prev,
            [ds]: { ...prev[ds], is_working: !prev[ds].is_working, notes: !prev[ds].is_working ? '' : prev[ds].notes },
        }));
    };

    const updateNotes = (ds: string, notes: string) => {
        setWorkingDays(prev => ({ ...prev, [ds]: { ...prev[ds], notes } }));
    };

    const hasChanges = JSON.stringify(workingDays) !== JSON.stringify(originalDays);
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const totalWorking = Object.values(workingDays).filter(v => v.is_working).length;

    const generateGrid = () => {
        // Use UTC-safe helpers so firstDay and ds are always April 1, not March 31
        const firstDay = dowOf(isoDate(year, month, 1));
        const dim = daysInMonth(year, month);
        const grid: React.ReactNode[] = [];

        for (let i = 0; i < firstDay; i++) {
            grid.push(<div key={`blank-${i}`} className="p-2" />);
        }

        for (let i = 1; i <= dim; i++) {
            const ds = isoDate(year, month, i);          // always '2026-04-01' etc.
            const data = workingDays[ds] || { is_working: true, notes: '' };
            const isWorking = data.is_working;

            grid.push(
                <div
                    key={ds}
                    onClick={() => toggleDay(ds)}
                    className={`p-2.5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col items-center gap-1 min-h-[90px] select-none ${
                        isWorking
                            ? 'border-indigo-200 bg-indigo-50 hover:border-indigo-400'
                            : 'border-slate-200 bg-slate-50 hover:border-rose-200 hover:bg-rose-50/50'
                    }`}
                >
                    <span className={`text-lg font-black ${isWorking ? 'text-indigo-700' : 'text-slate-400'}`}>{i}</span>
                    <span className={`text-[9px] font-bold uppercase tracking-wider ${isWorking ? 'text-indigo-500' : 'text-slate-400'}`}>
                        {isWorking ? 'Working' : 'Holiday'}
                    </span>
                    {!isWorking && (
                        <div onClick={e => e.stopPropagation()} className="w-full">
                            <input
                                type="text"
                                placeholder="Reason..."
                                value={data.notes}
                                onChange={e => updateNotes(ds, e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded text-[9px] px-1.5 py-1 focus:outline-none focus:border-rose-400 text-center"
                            />
                        </div>
                    )}
                </div>
            );
        }
        return grid;
    };

    return (
        <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm max-w-5xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                    <h3 className="text-lg font-bold text-slate-800">Student School Calendar</h3>
                    <p className="text-sm text-slate-400 mt-0.5">
                        Click any date to toggle between <strong>Working</strong> / <strong>Holiday</strong>.
                        Attendance % is calculated only from working days.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    {/* Month navigator */}
                    <div className="flex items-center bg-slate-50 rounded-xl border border-slate-200 p-1">
                        <button onClick={() => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); }}
                            className="p-2 hover:bg-white rounded-lg transition-colors"><ChevronLeft className="w-4 h-4" /></button>
                        <span className="px-4 font-bold text-sm w-36 text-center">{getMonthName(month)} {year}</span>
                        <button onClick={() => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); }}
                            className="p-2 hover:bg-white rounded-lg transition-colors"><ChevronRight className="w-4 h-4" /></button>
                    </div>

                    {/* Save */}
                    <button onClick={handleSave} disabled={saving || !hasChanges}
                        className={`flex items-center gap-2 h-10 px-5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
                            hasChanges ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-200' : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        }`}>
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        {saving ? 'Saving...' : 'Save Calendar'}
                    </button>
                </div>
            </div>

            {/* Working day count */}
            <div className="flex items-center gap-4 mb-6 p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                <div className="text-3xl font-black text-indigo-700">{totalWorking}</div>
                <div>
                    <p className="text-sm font-bold text-indigo-800">Working Days in {getMonthName(month)}</p>
                    <p className="text-xs text-indigo-500">Attendance percentages will be calculated based on this count</p>
                </div>
            </div>

            {error && <div className="mb-5 p-4 rounded-2xl bg-rose-50 text-rose-600 font-medium border border-rose-200">{error}</div>}
            {successMsg && <div className="mb-5 p-4 flex items-center gap-2 rounded-2xl bg-emerald-50 text-emerald-700 font-medium border border-emerald-200"><Check className="w-5 h-5" /> {successMsg}</div>}

            {loading ? (
                <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-indigo-400" /></div>
            ) : (
                <>
                    <div className="grid grid-cols-7 gap-2 mb-2">
                        {dayNames.map(day => (
                            <div key={day} className="text-center text-[11px] font-bold text-slate-400 uppercase py-2">{day}</div>
                        ))}
                    </div>
                    <div className="grid grid-cols-7 gap-2">{generateGrid()}</div>
                </>
            )}
        </div>
    );
};

// ── Tab 3: Analytics ──────────────────────────────────────────────────────────
const AnalyticsTab: React.FC = () => {
    const [month, setMonth] = useState(new Date().getMonth());
    const [year, setYear] = useState(new Date().getFullYear());
    const [loading, setLoading] = useState(true);
    const [classSummaries, setClassSummaries] = useState<{ class: string; avgPct: number; students: number; low: number }[]>([]);
    const [totalWorkingDays, setTotalWorkingDays] = useState(0);

    useEffect(() => {
        const fetchAnalytics = async () => {
            setLoading(true);
            try {
                const fromDate = isoDate(year, month, 1);
                const toDate   = isoDate(year, month, daysInMonth(year, month));

                const workingDayMap = await fetchWorkingDaysInRange(fromDate, toDate);
                const wdCount = Object.values(workingDayMap).filter(v => v.is_working).length;
                setTotalWorkingDays(wdCount);

                // Get all attendance records for the month
                const { data: allAtt } = await supabase
                    .from('student_attendance')
                    .select('student_id, class_name, attendance_date, status')
                    .gte('attendance_date', fromDate)
                    .lte('attendance_date', toDate);

                // Get student counts per class
                const summaries = await Promise.all(CLASS_LIST.map(async cls => {
                    const { data: students } = await supabase
                        .from('students')
                        .select('sr_no')
                        .eq('class', cls)
                        .eq('status', 'active');

                    const count = students?.length || 0;
                    if (count === 0) return null;

                    const classAtt = (allAtt || []).filter((r: any) =>
                        r.class_name === cls && workingDayMap[r.attendance_date]?.is_working && r.status === 'present'
                    );

                    // Group present days per student
                    const perStudent: Record<number, number> = {};
                    classAtt.forEach((r: any) => {
                        perStudent[r.student_id] = (perStudent[r.student_id] || 0) + 1;
                    });

                    const allPcts = (students || []).map((s: any) => pct(perStudent[s.sr_no] || 0, wdCount));
                    const avgPctVal = allPcts.length ? Math.round(allPcts.reduce((a, b) => a + b, 0) / allPcts.length) : 0;
                    const low = allPcts.filter(p => p < 75).length;

                    return { class: cls, avgPct: avgPctVal, students: count, low };
                }));

                setClassSummaries(summaries.filter(Boolean) as any);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        fetchAnalytics();
    }, [month, year]);

    const sorted = [...classSummaries].sort((a, b) => b.avgPct - a.avgPct);
    const schoolAvg = classSummaries.length
        ? Math.round(classSummaries.reduce((s, c) => s + c.avgPct, 0) / classSummaries.length)
        : 0;

    return (
        <div className="space-y-6">
            {/* Controls row */}
            <div className="flex flex-wrap items-center gap-4">
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3 flex-1">
                    <div className="flex items-center bg-slate-50 rounded-xl border border-slate-200 p-1">
                        <button onClick={() => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); }}
                            className="p-2 hover:bg-white rounded-lg transition-colors"><ChevronLeft className="w-4 h-4" /></button>
                        <span className="px-4 font-bold text-sm w-36 text-center">{getMonthName(month)} {year}</span>
                        <button onClick={() => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); }}
                            className="p-2 hover:bg-white rounded-lg transition-colors"><ChevronRight className="w-4 h-4" /></button>
                    </div>
                </div>
                <div className="bg-indigo-600 rounded-2xl shadow-md p-4 text-white flex items-center gap-3 flex-1 min-w-[220px]">
                    <BarChart3 className="w-6 h-6 text-indigo-200 flex-shrink-0" />
                    <div>
                        <p className="text-xs text-indigo-200 font-semibold uppercase">School Average</p>
                        <p className="text-2xl font-black">{schoolAvg}%</p>
                    </div>
                    <div className="ml-auto text-right">
                        <p className="text-xs text-indigo-200 font-semibold uppercase">Working Days</p>
                        <p className="text-2xl font-black">{totalWorkingDays}</p>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-indigo-400" /></div>
            ) : classSummaries.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 text-center">
                    <BarChart3 className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                    <p className="text-slate-500 font-medium">No data yet</p>
                    <p className="text-slate-400 text-sm mt-1">Start marking attendance from the teacher portal to see analytics here.</p>
                </div>
            ) : (
                <>
                    {/* Horizontal bar chart */}
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                        <div className="px-5 py-4 border-b border-slate-50 bg-slate-50/50">
                            <h3 className="font-bold text-slate-700">Class-wise Avg. Attendance — {getMonthName(month)} {year}</h3>
                            <p className="text-xs text-slate-400 mt-0.5">Based on {totalWorkingDays} working days — sorted highest to lowest</p>
                        </div>
                        <div className="p-5 space-y-3.5">
                            {sorted.map(cls => (
                                <div key={cls.class}>
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-sm font-bold text-slate-700 uppercase">{cls.class}</span>
                                        <div className="flex items-center gap-3 text-xs text-slate-500">
                                            <span className="font-medium">{cls.students} students</span>
                                            {cls.low > 0 && (
                                                <span className="text-rose-500 font-bold flex items-center gap-1">
                                                    <AlertTriangle className="w-3 h-3" />{cls.low} low
                                                </span>
                                            )}
                                            <PctBadge value={cls.avgPct} />
                                        </div>
                                    </div>
                                    <div className="w-full bg-slate-100 rounded-full h-3">
                                        <div
                                            className={`h-3 rounded-full transition-all duration-700 ${cls.avgPct >= 85 ? 'bg-emerald-500' : cls.avgPct >= 70 ? 'bg-amber-400' : 'bg-rose-500'}`}
                                            style={{ width: `${cls.avgPct}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Low / Top panels */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                            <div className="px-5 py-4 border-b border-rose-50 bg-rose-50/40">
                                <h3 className="font-bold text-rose-700 flex items-center gap-2"><TrendingDown className="w-4 h-4" /> Low Attendance Classes</h3>
                            </div>
                            <div className="divide-y divide-slate-50">
                                {sorted.filter(c => c.avgPct < 75).map(cls => (
                                    <div key={cls.class} className="px-5 py-3.5 flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-bold text-slate-700 uppercase">{cls.class}</p>
                                            <p className="text-xs text-slate-400">{cls.low} students below 75%</p>
                                        </div>
                                        <PctBadge value={cls.avgPct} />
                                    </div>
                                ))}
                                {sorted.filter(c => c.avgPct < 75).length === 0 && (
                                    <div className="p-8 text-center text-slate-400 text-sm">
                                        <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
                                        All classes above 75%!
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                            <div className="px-5 py-4 border-b border-emerald-50 bg-emerald-50/40">
                                <h3 className="font-bold text-emerald-700 flex items-center gap-2"><TrendingUp className="w-4 h-4" /> Top Performing Classes</h3>
                            </div>
                            <div className="divide-y divide-slate-50">
                                {sorted.filter(c => c.avgPct >= 85).slice(0, 6).map(cls => (
                                    <div key={cls.class} className="px-5 py-3.5 flex items-center justify-between">
                                        <p className="text-sm font-bold text-slate-700 uppercase">{cls.class}</p>
                                        <PctBadge value={cls.avgPct} />
                                    </div>
                                ))}
                                {sorted.filter(c => c.avgPct >= 85).length === 0 && (
                                    <div className="p-8 text-center text-slate-400 text-sm">No class above 85% this month.</div>
                                )}
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

// ── Main Page ─────────────────────────────────────────────────────────────────
type TabKey = 'classwise' | 'workingdays' | 'analytics';

const StudentAttendance: React.FC = () => {
    const [activeTab, setActiveTab] = useState<TabKey>('classwise');

    const TABS: { key: TabKey; label: string; icon: React.ComponentType<any> }[] = [
        { key: 'classwise', label: 'Class-wise Attendance', icon: ClipboardList },
        { key: 'workingdays', label: 'Working Days', icon: CalendarDays },
        { key: 'analytics', label: 'Attendance Analytics', icon: LineChart },
    ];

    return (
        <AppShell
            title="Student Attendance"
            subtitle="Track, manage and analyse attendance across all classes"
        >
            <div className="space-y-6">
                {/* Tab bar */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-1.5 flex gap-1">
                    {TABS.map(({ key, label, icon: Icon }) => (
                        <button
                            key={key}
                            onClick={() => setActiveTab(key)}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-bold transition-all ${
                                activeTab === key
                                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                            }`}
                        >
                            <Icon className="w-4 h-4 flex-shrink-0" />
                            <span className="hidden sm:inline">{label}</span>
                        </button>
                    ))}
                </div>

                {activeTab === 'classwise' && <ClasswiseTab />}
                {activeTab === 'workingdays' && <WorkingDaysTab />}
                {activeTab === 'analytics' && <AnalyticsTab />}
            </div>
        </AppShell>
    );
};

export default StudentAttendance;
