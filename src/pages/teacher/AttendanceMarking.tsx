import React, { useEffect, useState, useCallback } from 'react';
import AppShell from '@/components/layout/AppShell';
import { supabase } from '@/config/supabaseClient';
import { useAuth } from '@/context/AuthContext';
import {
    Save, UserCheck, UserX, Loader2, CheckCircle2, AlertCircle,
    ChevronLeft, ChevronRight, CalendarDays, AlertTriangle
} from 'lucide-react';

type AttendanceStatus = 'present' | 'absent' | null;

interface Student {
    sr_no: number;
    name: string;
    roll_no: string;
}

interface AttendanceMap {
    [studentId: number]: AttendanceStatus;
}

// ── Utilities ─────────────────────────────────────────────────────────────────
const fmt = (d: Date) => d.toISOString().split('T')[0];
const today = fmt(new Date());

// ── Main Component ────────────────────────────────────────────────────────────
const AttendanceMarking: React.FC = () => {
    const { user, isLoading: authLoading } = useAuth();
    const [teacherProfile, setTeacherProfile] = useState<any>(null);
    const [students, setStudents] = useState<Student[]>([]);
    const [attendance, setAttendance] = useState<AttendanceMap>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [savedSuccess, setSavedSuccess] = useState(false);

    // Date navigation state
    const [selectedDate, setSelectedDate] = useState(today);
    const [workingDays, setWorkingDays] = useState<string[]>([]); // sorted list of working day strings
    const [loadingDates, setLoadingDates] = useState(true);
    const [isNonWorkingDay, setIsNonWorkingDay] = useState(false);

    // ── Step 1: Load teacher profile & students (once) ────────────────────────
    useEffect(() => {
        if (authLoading) return;
        if (!user?.id) { setLoading(false); return; }

        const initTeacher = async () => {
            try {
                const { data: teacher } = await supabase
                    .from('teacher_registrations')
                    .select('*')
                    .eq('user_id', user.id)
                    .single();

                if (!teacher) return;
                setTeacherProfile(teacher);

                if (!teacher.class_teacher) return;

                const { data: studentList } = await supabase
                    .from('students')
                    .select('sr_no, name, roll_no')
                    .eq('class', teacher.class_teacher)
                    .eq('status', 'active')
                    .order('name', { ascending: true });

                if (studentList) setStudents(studentList);
            } catch (err) {
                console.error('Error loading teacher data:', err);
            } finally {
                setLoading(false);
            }
        };

        initTeacher();
    }, [user?.id, authLoading]);

    // ── Step 2: Load working days for the last 3 months ───────────────────────
    useEffect(() => {
        const loadWorkingDays = async () => {
            setLoadingDates(true);
            try {
                // Load working days from 3 months ago to today
                const threeMonthsAgo = new Date();
                threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
                const fromDate = fmt(threeMonthsAgo);

                const { data } = await supabase
                    .from('student_working_days')
                    .select('date, is_working')
                    .gte('date', fromDate)
                    .lte('date', today)
                    .order('date', { ascending: true });

                // Build set of dates with explicit DB entries
                const dbMap: Record<string, boolean> = {};
                (data || []).forEach((row: any) => {
                    dbMap[row.date] = row.is_working;
                });

                // Generate all dates using a noon-UTC anchor so getDay() and
                // toISOString() are 100% timezone-stable regardless of local offset.
                const result: string[] = [];
                const [fy, fm, fd] = fromDate.split('-').map(Number);
                const cursor = new Date(Date.UTC(fy, fm - 1, fd, 12, 0, 0)); // noon UTC
                const [ty, tm, td] = today.split('-').map(Number);
                const endNoon = new Date(Date.UTC(ty, tm - 1, td, 12, 0, 0));

                while (cursor <= endNoon) {
                    const ds = cursor.toISOString().split('T')[0]; // always correct at noon UTC
                    const isSunday = cursor.getUTCDay() === 0;     // UTC day matches the date
                    const isWorking = ds in dbMap ? dbMap[ds] : !isSunday;
                    if (isWorking) result.push(ds);
                    cursor.setUTCDate(cursor.getUTCDate() + 1);
                }

                setWorkingDays(result);

                // Check if today is a working day; if not, go to last working day
                if (result.length > 0) {
                    if (result.includes(today)) {
                        setSelectedDate(today);
                        setIsNonWorkingDay(false);
                    } else {
                        // today is a holiday — show the last working day
                        setSelectedDate(result[result.length - 1]);
                        setIsNonWorkingDay(false);
                    }
                }
            } catch (e) {
                console.error('Error loading working days:', e);
            } finally {
                setLoadingDates(false);
            }
        };

        loadWorkingDays();
    }, []);

    // ── Step 3: Load attendance for selected date ─────────────────────────────
    const loadAttendanceForDate = useCallback(async (date: string) => {
        if (!teacherProfile?.class_teacher) return;
        try {
            const { data } = await supabase
                .from('student_attendance')
                .select('student_id, status')
                .eq('class_name', teacherProfile.class_teacher)
                .eq('attendance_date', date);

            const map: AttendanceMap = {};
            (data || []).forEach((r: any) => { map[r.student_id] = r.status; });
            setAttendance(map);
        } catch (e) {
            console.error('Error loading attendance:', e);
        }
    }, [teacherProfile?.class_teacher]);

    useEffect(() => {
        if (teacherProfile?.class_teacher && selectedDate) {
            loadAttendanceForDate(selectedDate);
        }
    }, [selectedDate, teacherProfile?.class_teacher, loadAttendanceForDate]);

    // ── Navigation: prev / next working day ───────────────────────────────────
    const currentIndex = workingDays.indexOf(selectedDate);

    const goPrev = () => {
        if (currentIndex > 0) {
            setSelectedDate(workingDays[currentIndex - 1]);
        }
    };

    const goNext = () => {
        if (currentIndex < workingDays.length - 1) {
            setSelectedDate(workingDays[currentIndex + 1]);
        }
    };

    // Handle manual date input — only allow working days; warn if non-working
    const handleDateInput = (value: string) => {
        if (!value || value > today) return; // block future dates
        setSelectedDate(value);
        const isWorking = workingDays.includes(value);
        setIsNonWorkingDay(!isWorking);
    };

    // ── Attendance actions ────────────────────────────────────────────────────
    const markStudent = (id: number, status: 'present' | 'absent') => {
        setAttendance(prev => ({ ...prev, [id]: status }));
    };

    const markAll = (status: 'present' | 'absent') => {
        const map: AttendanceMap = {};
        students.forEach(s => { map[s.sr_no] = status; });
        setAttendance(map);
    };

    const handleSave = async () => {
        if (!teacherProfile?.class_teacher) return;

        // Hard block: never save on a non-working day or Sunday
        const dayOfWeek = new Date(selectedDate + 'T12:00:00Z').getUTCDay();
        if (dayOfWeek === 0 || isNonWorkingDay) {
            alert('Cannot save attendance for a Sunday or holiday.');
            return;
        }
        if (selectedDate > today) {
            alert('Cannot save attendance for a future date.');
            return;
        }

        setSaving(true);
        try {
            const records = students.map(s => ({
                student_id: s.sr_no,
                class_name: teacherProfile.class_teacher,
                attendance_date: selectedDate,
                status: attendance[s.sr_no] || 'absent',
                marked_by: user?.id,
            }));

            const { error } = await supabase
                .from('student_attendance')
                .upsert(records, { onConflict: 'student_id,class_name,attendance_date' });

            if (error) throw error;
            setSavedSuccess(true);
            setTimeout(() => setSavedSuccess(false), 3000);
        } catch (err) {
            console.error('Error saving:', err);
            alert('Failed to save attendance.');
        } finally {
            setSaving(false);
        }
    };

    // ── Derived counts ────────────────────────────────────────────────────────
    const presentCount = Object.values(attendance).filter(v => v === 'present').length;
    const absentCount = Object.values(attendance).filter(v => v === 'absent').length;
    const unmarkedCount = students.length - presentCount - absentCount;

    const isToday = selectedDate === today;
    const isFuture = selectedDate > today;
    const selectedDateFormatted = new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-IN', {
        weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
    });

    return (
        <AppShell
            title="Class Attendance"
            subtitle="Mark daily presence for your assigned students"
        >
            <div className="space-y-6 animate-in fade-in duration-500">
                {/* ── Date Navigator ── */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col sm:flex-row items-center gap-4">
                    {/* Prev button */}
                    <button
                        onClick={goPrev}
                        disabled={currentIndex <= 0 || loadingDates}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                        <ChevronLeft className="w-4 h-4" />
                        Previous Day
                    </button>

                    {/* Date display + input */}
                    <div className="flex-1 flex flex-col items-center gap-1">
                        <div className="flex items-center gap-2">
                            <CalendarDays className="w-4 h-4 text-indigo-500" />
                            <span className="text-base font-bold text-slate-800">{selectedDateFormatted}</span>
                            {isToday && (
                                <span className="text-[10px] font-bold uppercase bg-indigo-600 text-white px-2.5 py-0.5 rounded-full ml-1">Today</span>
                            )}
                        </div>
                        {/* Manual date picker */}
                        <div className="flex items-center gap-2 mt-1">
                            <label className="text-xs text-slate-400 font-medium">Jump to:</label>
                            <input
                                type="date"
                                max={today}
                                value={selectedDate}
                                onChange={e => handleDateInput(e.target.value)}
                                className="text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                            />
                        </div>
                    </div>

                    {/* Next button */}
                    <button
                        onClick={goNext}
                        disabled={currentIndex >= workingDays.length - 1 || loadingDates}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                        Next Day
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>

                {/* ── Non-working day warning ── */}
                {isNonWorkingDay && (
                    <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4">
                        <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
                        <div>
                            <p className="text-sm font-bold text-amber-800">This date is not a working day</p>
                            <p className="text-xs text-amber-600 mt-0.5">
                                You can still mark attendance, but this date is marked as a holiday in the school calendar.
                            </p>
                        </div>
                    </div>
                )}

                {/* ── Class header ── */}
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold text-slate-800">
                        {teacherProfile?.class_teacher
                            ? <><span className="text-slate-500 font-normal">Class — </span><span className="text-indigo-600 uppercase">{teacherProfile.class_teacher}</span></>
                            : <span className="text-slate-400">Loading...</span>
                        }
                    </h1>
                    {loadingDates && (
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading calendar...
                        </div>
                    )}
                </div>

                {/* ── Stats row ── */}
                {!loading && students.length > 0 && (
                    <div className="grid grid-cols-3 gap-4">
                        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 text-center">
                            <p className="text-3xl font-black text-emerald-600">{presentCount}</p>
                            <p className="text-xs font-bold text-emerald-500 uppercase mt-1">Present</p>
                        </div>
                        <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 text-center">
                            <p className="text-3xl font-black text-rose-600">{absentCount}</p>
                            <p className="text-xs font-bold text-rose-500 uppercase mt-1">Absent</p>
                        </div>
                        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 text-center">
                            <p className="text-3xl font-black text-amber-600">{unmarkedCount}</p>
                            <p className="text-xs font-bold text-amber-500 uppercase mt-1">Not Marked</p>
                        </div>
                    </div>
                )}

                {/* ── Attendance table ── */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    {/* Toolbar */}
                    <div className="p-4 px-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
                        <div className="flex items-center gap-3">
                            <button onClick={() => markAll('present')}
                                className="text-xs font-bold text-emerald-600 border border-emerald-200 bg-emerald-50 px-3 py-1.5 rounded-lg hover:bg-emerald-100 transition-all">
                                ✓ Mark All Present
                            </button>
                            <button onClick={() => markAll('absent')}
                                className="text-xs font-bold text-rose-600 border border-rose-200 bg-rose-50 px-3 py-1.5 rounded-lg hover:bg-rose-100 transition-all">
                                ✗ Mark All Absent
                            </button>
                        </div>
                        <button
                            onClick={handleSave}
                            disabled={saving || students.length === 0 || isFuture || isNonWorkingDay || new Date(selectedDate + 'T12:00:00Z').getUTCDay() === 0}
                            className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2 rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all disabled:opacity-40 shadow-md shadow-indigo-200"
                        >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" />
                                : savedSuccess ? <CheckCircle2 className="w-4 h-4" />
                                    : <Save className="w-4 h-4" />}
                            {saving ? 'Saving...' : savedSuccess ? 'Saved!' : 'Save Attendance'}
                        </button>
                    </div>

                    {/* Column headers */}
                    <div className="grid grid-cols-12 gap-4 p-3 px-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/30 border-b border-slate-50">
                        <div className="col-span-1">#</div>
                        <div className="col-span-7">Student Name</div>
                        <div className="col-span-4 text-right">Status</div>
                    </div>

                    {/* Rows */}
                    {loading ? (
                        <div className="flex items-center justify-center py-16">
                            <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
                        </div>
                    ) : students.length === 0 ? (
                        <div className="p-12 text-center">
                            <AlertCircle className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                            <p className="text-slate-500 font-medium">No students found in this class.</p>
                            <p className="text-slate-400 text-sm mt-1">Make sure the class name in your profile matches student records.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-50">
                            {students.map((student, idx) => {
                                const status = attendance[student.sr_no] ?? null;
                                return (
                                    <div
                                        key={student.sr_no}
                                        className={`grid grid-cols-12 gap-4 p-4 px-6 items-center transition-colors ${
                                            status === 'present' ? 'bg-emerald-50/40' :
                                            status === 'absent' ? 'bg-rose-50/40' :
                                            'hover:bg-slate-50/50'
                                        }`}
                                    >
                                        <div className="col-span-1 text-sm font-bold text-slate-400">{idx + 1}</div>
                                        <div className="col-span-7 flex items-center gap-3">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                                                status === 'present' ? 'bg-emerald-100 text-emerald-600' :
                                                status === 'absent' ? 'bg-rose-100 text-rose-600' :
                                                'bg-slate-100 text-slate-500'
                                            }`}>
                                                {student.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-slate-800 capitalize">{student.name}</p>
                                                <p className="text-xs text-slate-400">Roll: {student.roll_no || '—'}</p>
                                            </div>
                                        </div>
                                        <div className="col-span-4 flex justify-end gap-2">
                                            <button
                                                onClick={() => markStudent(student.sr_no, 'present')}
                                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                                                    status === 'present'
                                                        ? 'bg-emerald-500 text-white border-emerald-500 shadow-sm'
                                                        : 'border-emerald-100 bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                                                }`}
                                            >
                                                <UserCheck className="w-3.5 h-3.5" /> Present
                                            </button>
                                            <button
                                                onClick={() => markStudent(student.sr_no, 'absent')}
                                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                                                    status === 'absent'
                                                        ? 'bg-rose-500 text-white border-rose-500 shadow-sm'
                                                        : 'border-slate-100 text-slate-500 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-100'
                                                }`}
                                            >
                                                <UserX className="w-3.5 h-3.5" /> Absent
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </AppShell>
    );
};

export default AttendanceMarking;
