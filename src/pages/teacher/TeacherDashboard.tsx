import React, { useState, useEffect } from 'react';
import AppShell from '@/components/layout/AppShell';
import { 
    Users, Clock, UserCheck, UserX, 
    Calendar,
    Loader2
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/config/supabaseClient';

// Mock Schedule (To be replaced with Supabase fetch logic later)
const MOCK_SCHEDULE = [
    { id: '1', period: '1st Period', time: '08:00 AM - 08:35 AM', subject: 'Mathematics', type: 'class', current: false },
    { id: '2', period: '2nd Period', time: '08:35 AM - 09:10 AM', subject: 'Science (Physics)', type: 'class', current: true },
    { id: '3', period: '3rd Period', time: '09:10 AM - 09:45 AM', subject: 'English', type: 'class', current: false },
    { id: '4', period: '4th Period', time: '09:45 AM - 10:20 AM', subject: 'Free / Prep', type: 'free', current: false },
    { id: 'r', period: 'Recess', time: '10:20 AM - 10:50 AM', subject: 'Break Time', type: 'recess', current: false },
    { id: '5', period: '5th Period', time: '10:50 AM - 11:25 AM', subject: 'Class 9 - C (Math)', type: 'class', current: false },
    { id: '6', period: '6th Period', time: '11:25 AM - 12:00 PM', subject: 'Class 8 - A (Science)', type: 'class', current: false },
    { id: '7', period: '7th Period', time: '12:00 PM - 12:35 PM', subject: 'Free / Prep', type: 'free', current: false },
    { id: '8', period: '8th Period', time: '12:35 PM - 01:10 PM', subject: 'Extra Curricular', type: 'class', current: false }
];

const TeacherDashboard: React.FC = () => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [teacherData, setTeacherData] = useState<any>(null);
    const [attendanceStats, setAttendanceStats] = useState({ workingDays: 0, present: 0, absent: 0 });

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
                            wDaysMap[dateObj.toISOString().split('T')[0]] = dateObj.getDay() !== 0; // Default to all except Sunday
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
                            
                            // Only calculate present/absent stats up to today
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
                }

            } catch (error) {
                console.error("Error fetching dashboard data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardData();
    }, [user]);

    // Calculate attendance percentage for progress bar
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
                                    <h3 className="font-bold text-slate-800">Today's Schedule</h3>
                                </div>
                            </div>

                            <div className="p-2">
                                <div className="h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                                    <div className="absolute top-0 bottom-0 left-8 w-px bg-slate-100 -z-10" />
                                    {MOCK_SCHEDULE.map((item, idx) => (
                                        <div key={item.id} className="relative py-3 px-4 mb-2 flex items-start gap-4 group">
                                            {/* Timeline Node */}
                                            <div className={`mt-1.5 w-3 h-3 rounded-full flex-shrink-0 z-10 border-2 transition-colors duration-300
                                                ${item.current ? 'bg-indigo-600 border-indigo-200 ring-4 ring-indigo-50' : 
                                                item.type === 'recess' ? 'bg-amber-400 border-white' : 
                                                item.type === 'free' ? 'bg-slate-300 border-white' : 'bg-blue-400 border-white group-hover:bg-blue-600'}
                                            `} />
                                            
                                            <div className={`flex-1 p-4 rounded-xl border transition-all duration-300 ${
                                                item.current ? 'bg-indigo-50 border-indigo-100 shadow-sm' : 
                                                item.type === 'recess' ? 'bg-amber-50 border-amber-100/50' :
                                                item.type === 'free' ? 'bg-slate-50 border-transparent text-slate-500' :
                                                'bg-white border-slate-100 hover:border-blue-200 hover:shadow-sm'
                                            }`}>
                                                <div className="flex justify-between items-start mb-1">
                                                    <p className={`text-xs font-semibold uppercase tracking-wider ${item.current ? 'text-indigo-600' : item.type === 'recess' ? 'text-amber-600' : 'text-slate-400'}`}>
                                                        {item.period}
                                                    </p>
                                                    {item.current && (
                                                        <span className="flex h-2 w-2 relative">
                                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                                                        </span>
                                                    )}
                                                </div>
                                                <h4 className={`font-bold ${item.current ? 'text-indigo-900' : 'text-slate-800'}`}>
                                                    {item.subject}
                                                </h4>
                                                <p className={`text-xs flex items-center gap-1 mt-2.5 ${item.current ? 'text-indigo-500 font-medium' : 'text-slate-400'}`}>
                                                    <Clock className="w-3.5 h-3.5" />
                                                    {item.time} {item.type === 'class' ? '· 35 mins' : item.type === 'recess' ? '· 30 mins' : ''}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </AppShell>
    );
};

export default TeacherDashboard;
