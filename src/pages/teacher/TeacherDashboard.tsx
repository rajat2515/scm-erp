import React, { useState, useEffect } from 'react';
import AppShell from '@/components/layout/AppShell';
import { 
    Users, Clock, UserCheck, UserX, 
    Calendar, BookOpen, AlertCircle, 
    CheckCircle2,
    ChevronRight,
    Loader2
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/config/supabaseClient';

// Mock Data (To be replaced with Supabase fetch logic later)
const MOCK_DATA = {
    classTeacherOf: "Class 10 - A",
    attendanceSummary: {
        present: 38,
        total: 42,
        get absent() { return this.total - this.present; }
    },
    absentStudents: [
        { id: 1, name: "Rahul Sharma", rollNumber: "10A-14" },
        { id: 2, name: "Anjali Verma", rollNumber: "10A-03" },
        { id: 3, name: "Vikram Singh", rollNumber: "10A-28" },
        { id: 4, name: "Priya Desai", rollNumber: "10A-31" }
    ],
    // 8 Periods + 1 Recess (35 mins each, Recess 30 mins)
    schedule: [
        { id: '1', period: '1st Period', time: '08:00 AM - 08:35 AM', subject: 'Mathematics', type: 'class', current: false },
        { id: '2', period: '2nd Period', time: '08:35 AM - 09:10 AM', subject: 'Science (Physics)', type: 'class', current: true },
        { id: '3', period: '3rd Period', time: '09:10 AM - 09:45 AM', subject: 'English', type: 'class', current: false },
        { id: '4', period: '4th Period', time: '09:45 AM - 10:20 AM', subject: 'Free / Prep', type: 'free', current: false },
        { id: 'r', period: 'Recess', time: '10:20 AM - 10:50 AM', subject: 'Break Time', type: 'recess', current: false },
        { id: '5', period: '5th Period', time: '10:50 AM - 11:25 AM', subject: 'Class 9 - C (Math)', type: 'class', current: false },
        { id: '6', period: '6th Period', time: '11:25 AM - 12:00 PM', subject: 'Class 8 - A (Science)', type: 'class', current: false },
        { id: '7', period: '7th Period', time: '12:00 PM - 12:35 PM', subject: 'Free / Prep', type: 'free', current: false },
        { id: '8', period: '8th Period', time: '12:35 PM - 01:10 PM', subject: 'Extra Curricular', type: 'class', current: false }
    ]
};

const TeacherDashboard: React.FC = () => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [teacherData, setTeacherData] = useState<any>(null);

    useEffect(() => {
        const fetchTeacherInfo = async () => {
            if (!user?.id) return;
            try {
                const { data, error } = await supabase
                    .from('teacher_registrations')
                    .select('*')
                    .eq('user_id', user.id)
                    .single();

                if (error) throw error;
                setTeacherData(data);
            } catch (error) {
                console.error("Error fetching teacher info:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchTeacherInfo();
    }, [user]);

    // Calculate attendance percentage for progress bar
    const attendancePercentage = Math.round((MOCK_DATA.attendanceSummary.present / MOCK_DATA.attendanceSummary.total) * 100);

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
                    {/* Left Column - Main Stats & Absent List */}
                    <div className="lg:col-span-2 space-y-8">
                        
                        {/* Class Teacher Overview Card */}
                        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm shadow-indigo-100/50 animate-in fade-in zoom-in-95 duration-500 delay-100 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-8 opacity-5 font-bold text-9xl tracking-tighter pointer-events-none group-hover:scale-110 transition-transform duration-700">
                                {teacherData?.class_teacher ? teacherData.class_teacher.split(' ')[0] : 'N/A'}
                            </div>
                            
                            <div className="flex items-center gap-3 mb-6 relative z-10">
                                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                                    <Users className="w-5 h-5" />
                                </div>
                                <div>
                                    <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Class Teacher Of</h2>
                                    <p className="text-2xl font-bold text-slate-800 uppercase">{teacherData?.class_teacher || 'Subject Teacher'}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-6 relative z-10">
                                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                                    <div className="text-sm text-slate-500 flex items-center gap-1.5 mb-1">
                                        <UserCheck className="w-4 h-4 text-emerald-500" /> Present 
                                    </div>
                                    <p className="text-2xl font-bold text-slate-800">{MOCK_DATA.attendanceSummary.present}</p>
                                </div>
                                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                                    <div className="text-sm text-slate-500 flex items-center gap-1.5 mb-1">
                                        <UserX className="w-4 h-4 text-rose-500" /> Absent 
                                    </div>
                                    <p className="text-2xl font-bold text-slate-800">{MOCK_DATA.attendanceSummary.absent}</p>
                                </div>
                                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                                    <div className="text-sm text-slate-500 flex items-center gap-1.5 mb-1">
                                        <Users className="w-4 h-4 text-blue-500" /> Total 
                                    </div>
                                    <p className="text-2xl font-bold text-slate-800">{MOCK_DATA.attendanceSummary.total}</p>
                                </div>
                            </div>


                            {/* Progress Bar */}
                            <div className="mt-6 relative z-10">
                                <div className="flex justify-between text-xs font-medium text-slate-500 mb-2">
                                    <span>Attendance Rate</span>
                                    <span>{attendancePercentage}%</span>
                                </div>
                                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                    <div 
                                        className={`h-full rounded-full transition-all duration-1000 ease-out ${attendancePercentage > 90 ? 'bg-emerald-500' : attendancePercentage > 75 ? 'bg-amber-500' : 'bg-rose-500'}`}
                                        style={{ width: `${attendancePercentage}%` }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Absent Students List */}
                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm shadow-rose-100/50 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200">
                            <div className="p-6 border-b border-slate-50 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="p-2 bg-rose-100 text-rose-600 rounded-lg">
                                        <AlertCircle className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-slate-800">Absent Today</h3>
                                        <p className="text-sm text-slate-500">{teacherData?.class_teacher || 'Class'} Roster</p>
                                    </div>
                                </div>
                                <span className="bg-rose-100 text-rose-700 py-1 px-3 rounded-full text-xs font-semibold">
                                    {MOCK_DATA.attendanceSummary.absent} Students
                                </span>
                            </div>
                            
                            {MOCK_DATA.absentStudents.length > 0 ? (
                                <div className="divide-y divide-slate-50">
                                    {MOCK_DATA.absentStudents.map((student, idx) => (
                                        <div key={student.id} 
                                            className="p-4 px-6 flex items-center justify-between hover:bg-slate-50 transition-colors"
                                            style={{ animationDelay: `${250 + (idx * 50)}ms` }}
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">
                                                    {student.name.charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="font-medium text-slate-800">{student.name}</p>
                                                    <p className="text-xs text-slate-400">Roll No: {student.rollNumber}</p>
                                                </div>
                                            </div>
                                            <button className="text-slate-400 hover:text-indigo-600 transition-colors p-2 rounded-full hover:bg-indigo-50">
                                                <ChevronRight className="w-5 h-5" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-12 text-center text-slate-400 flex flex-col items-center">
                                    <UserCheck className="w-12 h-12 mb-3 text-emerald-400 opacity-50" />
                                    <p>All students are present today!</p>
                                </div>
                            )}
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
                                    {MOCK_DATA.schedule.map((item, idx) => (
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
