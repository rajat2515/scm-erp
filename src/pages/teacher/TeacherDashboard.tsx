import React, { useState, useEffect } from 'react';
import AppShell from '@/components/layout/AppShell';
import { 
    Users, Clock, UserCheck, UserX, 
    Calendar, AlertCircle,
    Loader2
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/config/supabaseClient';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface ScheduleItem {
    id: string;
    period: string;
    time: string;
    subject: string;
    className?: string;
    type: 'class' | 'free' | 'recess' | 'assembly' | 'substitution';
    current: boolean;
}

const TeacherDashboard: React.FC = () => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [teacherData, setTeacherData] = useState<any>(null);
    const [attendanceStats, setAttendanceStats] = useState({ workingDays: 0, present: 0, absent: 0 });
    const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
    const [isAbsentToday, setIsAbsentToday] = useState(false);

    useEffect(() => {
        const fetchDashboardData = async () => {
            if (!user?.id) return;
            try {
                // Fetch teacher info
                const { data: tData, error: tErr } = await supabase
                    .from('teacher_registrations')
                    .select('*')
                    .eq('user_id', user.id)
                    .single();

                if (tErr) throw tErr;
                setTeacherData(tData);

                // Fetch Attendance Stats
                if (tData?.id) {
                    const d = new Date();
                    const month = d.getMonth();
                    const year = d.getFullYear();
                    const startDate = new Date(year, month, 1).toISOString().split('T')[0];
                    const endDate = new Date(year, month + 1, 0).toISOString().split('T')[0];

                    const { data: wdData } = await supabase
                        .from('staff_working_days')
                        .select('*')
                        .gte('date', startDate)
                        .lte('date', endDate);

                    const wDaysMap: Record<string, boolean> = {};
                    if (wdData && wdData.length > 0) {
                        wdData.forEach((wd: any) => {
                            wDaysMap[wd.date] = wd.is_working;
                        });
                    } else {
                        const daysInMonth = new Date(year, month + 1, 0).getDate();
                        for (let i = 1; i <= daysInMonth; i++) {
                            const dateObj = new Date(year, month, i);
                            wDaysMap[dateObj.toISOString().split('T')[0]] = dateObj.getDay() !== 0;
                        }
                    }

                    const { data: attData } = await supabase
                        .from('staff_attendance')
                        .select('*')
                        .eq('staff_id', `tr_${tData.id}`)
                        .gte('date', startDate)
                        .lte('date', endDate);

                    let working = 0;
                    let present = 0;
                    let absent = 0;
                    
                    const recordMap: Record<string, string> = Object.fromEntries(
                        (attData || []).map((r: any) => [r.date, r.status])
                    );

                    const todayStr = new Date().toISOString().split('T')[0];
                    const daysInMonth = new Date(year, month + 1, 0).getDate();

                    for (let i = 1; i <= daysInMonth; i++) {
                        const dateObj = new Date(year, month, i);
                        const dateStr = dateObj.toISOString().split('T')[0];
                        
                        if (wDaysMap[dateStr]) {
                            working++;
                            if (dateStr <= todayStr) {
                                const status = recordMap[dateStr];
                                if (status === 'Present' || status === 'Half-day') {
                                    present++;
                                } else if (status === 'Absent' || !status) {
                                    absent++;
                                }
                            }
                        }
                    }

                    setAttendanceStats({ workingDays: working, present, absent });

                    // Check if teacher is absent today
                    const todayStatus = recordMap[todayStr];
                    if (todayStatus === 'Absent' || todayStatus === 'Leave') {
                        setIsAbsentToday(true);
                    }

                    // ─── Fetch Today's Schedule from DB ───────────────────────
                    const today = new Date();
                    const jsDay = today.getDay();
                    const dayOfWeek = jsDay === 0 ? 7 : jsDay;

                    const { data: timingsData } = await supabase
                        .from('period_timings')
                        .select('*')
                        .order('period_number');

                    const { data: slotsData } = await supabase
                        .from('timetable_slots')
                        .select('*')
                        .eq('teacher_id', tData.id)
                        .eq('day_of_week', dayOfWeek);

                    const todayDateStr = today.toISOString().split('T')[0];
                    const { data: subsData } = await supabase
                        .from('substitute_assignments')
                        .select('*, timetable_slots(*)')
                        .eq('date', todayDateStr)
                        .eq('substitute_teacher_id', tData.id);

                    const timings = (timingsData || []) as any[];
                    const ownSlots = (slotsData || []) as any[];
                    const substitutions = (subsData || []) as any[];

                    const now = new Date();
                    const currentMinutes = now.getHours() * 60 + now.getMinutes();

                    const builtSchedule: ScheduleItem[] = [];

                    const sortedTimings = [...timings].sort((a, b) => {
                        return timeToMinutes(a.start_time) - timeToMinutes(b.start_time);
                    });

                    sortedTimings.forEach(timing => {
                        const startMins = timeToMinutes(timing.start_time);
                        const endMins = timeToMinutes(timing.end_time);
                        const isCurrent = currentMinutes >= startMins && currentMinutes < endMins;

                        if (timing.type === 'recess') {
                            builtSchedule.push({
                                id: `recess-${timing.id}`,
                                period: timing.label,
                                time: `${formatTimeTo12(timing.start_time)} - ${formatTimeTo12(timing.end_time)}`,
                                subject: 'Break Time',
                                type: 'recess',
                                current: isCurrent
                            });
                            return;
                        }

                        if (timing.type === 'assembly') {
                            builtSchedule.push({
                                id: `assembly-${timing.id}`,
                                period: timing.label,
                                time: `${formatTimeTo12(timing.start_time)} - ${formatTimeTo12(timing.end_time)}`,
                                subject: 'Assembly',
                                type: 'assembly',
                                current: isCurrent
                            });
                            return;
                        }

                        const ownSlot = ownSlots.find(s => s.period_number === timing.period_number);
                        const subSlot = substitutions.find(s => s.timetable_slots?.period_number === timing.period_number);

                        if (subSlot) {
                            builtSchedule.push({
                                id: `sub-${subSlot.id}`,
                                period: timing.label,
                                time: `${formatTimeTo12(timing.start_time)} - ${formatTimeTo12(timing.end_time)}`,
                                subject: `Substitution: ${subSlot.timetable_slots?.class || ''} - ${subSlot.timetable_slots?.subject || ''}`,
                                className: subSlot.timetable_slots?.class,
                                type: 'substitution',
                                current: isCurrent
                            });
                        } else if (ownSlot) {
                            builtSchedule.push({
                                id: `slot-${ownSlot.id}`,
                                period: timing.label,
                                time: `${formatTimeTo12(timing.start_time)} - ${formatTimeTo12(timing.end_time)}`,
                                subject: `${ownSlot.class} - ${ownSlot.subject}`,
                                className: ownSlot.class,
                                type: 'class',
                                current: isCurrent
                            });
                        } else {
                            builtSchedule.push({
                                id: `free-${timing.period_number}`,
                                period: timing.label,
                                time: `${formatTimeTo12(timing.start_time)} - ${formatTimeTo12(timing.end_time)}`,
                                subject: 'Free / Prep',
                                type: 'free',
                                current: isCurrent
                            });
                        }
                    });

                    setSchedule(builtSchedule);
                }

            } catch (error) {
                console.error("Error fetching dashboard data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardData();
    }, [user]);

    const recordedDays = attendanceStats.present + attendanceStats.absent;
    const attendancePercentage = recordedDays > 0 ? Math.round((attendanceStats.present / recordedDays) * 100) : 0;

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <AppShell 
            title="Teacher Dashboard" 
            subtitle={`Welcome back, ${user?.displayName || 'Teacher'} 👋`}
        >
            <div className="animate-fade-in">

                {/* Absent Today Banner */}
                {isAbsentToday && (
                    <div className="mb-6 p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-center gap-3 animate-fade-in">
                        <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                        <div>
                            <p className="text-sm font-semibold text-amber-800">You are marked absent today.</p>
                            <p className="text-xs text-amber-600">Your classes have been covered by substitute teachers.</p>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column - Main Stats */}
                    <div className="lg:col-span-2 space-y-8">
                        
                        {/* Attendance Overview Card */}
                        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm shadow-indigo-100/50 animate-in fade-in zoom-in-95 duration-500 delay-100 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-8 opacity-5 font-bold text-9xl tracking-tighter pointer-events-none group-hover:scale-110 transition-transform duration-700">
                                {teacherData?.teacher_name ? teacherData.teacher_name.split(' ')[0] : 'N/A'}
                            </div>
                            
                            <div className="flex items-center gap-3 mb-6 relative z-10">
                                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                                    <Users className="w-5 h-5" />
                                </div>
                                <div>
                                    <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">My Attendance Summary</h2>
                                    <p className="text-2xl font-bold text-slate-800 uppercase">{new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-6 relative z-10">
                                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                                    <div className="text-sm text-slate-500 flex items-center gap-1.5 mb-1">
                                        <Calendar className="w-4 h-4 text-blue-500" /> Working Days
                                    </div>
                                    <p className="text-2xl font-bold text-slate-800">{attendanceStats.workingDays}</p>
                                </div>
                                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                                    <div className="text-sm text-slate-500 flex items-center gap-1.5 mb-1">
                                        <UserCheck className="w-4 h-4 text-emerald-500" /> Present 
                                    </div>
                                    <p className="text-2xl font-bold text-slate-800">{attendanceStats.present}</p>
                                </div>
                                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                                    <div className="text-sm text-slate-500 flex items-center gap-1.5 mb-1">
                                        <UserX className="w-4 h-4 text-rose-500" /> Absent 
                                    </div>
                                    <p className="text-2xl font-bold text-slate-800">{attendanceStats.absent}</p>
                                </div>
                            </div>

                            {/* Progress Bar */}
                            <div className="mt-6 relative z-10">
                                <div className="flex justify-between text-xs font-medium text-slate-500 mb-2">
                                    <span>Attendance Rate (Up to Today)</span>
                                    <span>{attendancePercentage}%</span>
                                </div>
                                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                    <div 
                                        className={`h-full rounded-full transition-all duration-1000 ease-out ${attendancePercentage >= 90 ? 'bg-emerald-500' : attendancePercentage >= 75 ? 'bg-amber-500' : 'bg-rose-500'}`}
                                        style={{ width: `${attendancePercentage}%` }}
                                    />
                                </div>
                            </div>
                        </div>

                    </div>

                    {/* Right Column - Timetable Schedule */}
                    <div className="lg:col-span-1 animate-in fade-in slide-in-from-right-8 duration-700 delay-300">
                        <div className="bg-white border border-slate-100 rounded-2xl shadow-sm shadow-blue-100/50 sticky top-6">
                            <div className="p-6 border-b border-slate-50">
                                <div className="flex items-center gap-2">
                                    <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                                        <Clock className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-slate-800">Today's Schedule</h3>
                                        <p className="text-xs text-slate-400">{DAY_NAMES[new Date().getDay()]}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="p-2">
                                <div className="h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                                    <div className="absolute top-0 bottom-0 left-8 w-px bg-slate-100 -z-10" />
                                    {schedule.length === 0 ? (
                                        <div className="py-10 text-center">
                                            <p className="text-sm text-slate-400">No schedule configured for today.</p>
                                            <p className="text-xs text-slate-300 mt-1">Contact admin to set up timetable.</p>
                                        </div>
                                    ) : (
                                        schedule.map((item) => (
                                            <div key={item.id} className="relative py-3 px-4 mb-2 flex items-start gap-4 group">
                                                {/* Timeline Node */}
                                                <div className={`mt-1.5 w-3 h-3 rounded-full flex-shrink-0 z-10 border-2 transition-colors duration-300
                                                    ${item.current ? 'bg-indigo-600 border-indigo-200 ring-4 ring-indigo-50' : 
                                                    item.type === 'recess' ? 'bg-amber-400 border-white' : 
                                                    item.type === 'free' ? 'bg-slate-300 border-white' : 
                                                    item.type === 'substitution' ? 'bg-orange-500 border-orange-200 ring-2 ring-orange-50' :
                                                    'bg-blue-400 border-white group-hover:bg-blue-600'}
                                                `} />
                                                
                                                <div className={`flex-1 p-4 rounded-xl border transition-all duration-300 ${
                                                    item.current ? 'bg-indigo-50 border-indigo-100 shadow-sm' : 
                                                    item.type === 'recess' ? 'bg-amber-50 border-amber-100/50' :
                                                    item.type === 'free' ? 'bg-slate-50 border-transparent text-slate-500' :
                                                    item.type === 'substitution' ? 'bg-orange-50 border-orange-200 shadow-sm' :
                                                    'bg-white border-slate-100 hover:border-blue-200 hover:shadow-sm'
                                                }`}>
                                                    <div className="flex justify-between items-start mb-1">
                                                        <p className={`text-xs font-semibold uppercase tracking-wider ${
                                                            item.current ? 'text-indigo-600' : 
                                                            item.type === 'recess' ? 'text-amber-600' :
                                                            item.type === 'substitution' ? 'text-orange-600' :
                                                            'text-slate-400'
                                                        }`}>
                                                            {item.period}
                                                            {item.type === 'substitution' && (
                                                                <span className="ml-2 text-[9px] px-1.5 py-0.5 rounded bg-orange-200 text-orange-700 uppercase tracking-widest">SUB</span>
                                                            )}
                                                        </p>
                                                        {item.current && (
                                                            <span className="flex h-2 w-2 relative">
                                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                                                                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                                                            </span>
                                                        )}
                                                    </div>
                                                    <h4 className={`font-bold ${
                                                        item.current ? 'text-indigo-900' :
                                                        item.type === 'substitution' ? 'text-orange-900' :
                                                        'text-slate-800'
                                                    }`}>
                                                        {item.subject}
                                                    </h4>
                                                    <p className={`text-xs flex items-center gap-1 mt-2.5 ${item.current ? 'text-indigo-500 font-medium' : 'text-slate-400'}`}>
                                                        <Clock className="w-3.5 h-3.5" />
                                                        {item.time}
                                                    </p>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </AppShell>
    );
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeToMinutes(time: string): number {
    if (!time) return 0;
    const [h, m] = time.split(':').map(Number);
    return h * 60 + (m || 0);
}

function formatTimeTo12(time: string): string {
    if (!time) return '';
    const [h, m] = time.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour = h % 12 || 12;
    return `${hour.toString().padStart(2, '0')}:${(m || 0).toString().padStart(2, '0')} ${ampm}`;
}

export default TeacherDashboard;
