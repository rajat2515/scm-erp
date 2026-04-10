import React, { useEffect, useState } from 'react';
import AppShell from '@/components/layout/AppShell';
import { supabase } from '@/config/supabaseClient';
import { useAuth } from '@/context/AuthContext';
import { Save, UserCheck, UserX, Clock, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

type AttendanceStatus = 'present' | 'absent' | null;

interface Student {
    sr_no: number;
    name: string;
    roll_no: string;
}

interface AttendanceMap {
    [studentId: number]: AttendanceStatus;
}

const AttendanceMarking: React.FC = () => {
    const { user, isLoading: authLoading } = useAuth();
    const [teacherProfile, setTeacherProfile] = useState<any>(null);
    const [students, setStudents] = useState<Student[]>([]);
    const [attendance, setAttendance] = useState<AttendanceMap>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [savedSuccess, setSavedSuccess] = useState(false);
    const today = new Date().toISOString().split('T')[0];

    useEffect(() => {
        if (authLoading) return;
        const init = async () => {
            if (!user?.id) return;
            try {
                // Step 1: Get teacher's class
                const { data: teacher, error: teacherErr } = await supabase
                    .from('teacher_registrations')
                    .select('*')
                    .eq('user_id', user.id)
                    .single();

                if (teacherErr || !teacher) return;
                setTeacherProfile(teacher);

                const className = teacher.class_teacher;
                if (!className) return;

                // Step 2: Fetch students — use correct column names from your schema
                // students table: sr_no (PK), class (not class_name), roll_no, name
                const { data: studentList, error: studentErr } = await supabase
                    .from('students')
                    .select('sr_no, name, roll_no')
                    .eq('class', className)          // ← your column is 'class'
                    .eq('status', 'active')
                    .order('roll_no', { ascending: true });

                if (!studentErr && studentList) {
                    setStudents(studentList);

                    // Check if today's attendance already exists
                    const { data: existingAttendance } = await supabase
                        .from('student_attendance')
                        .select('student_id, status')
                        .eq('class_name', className)
                        .eq('attendance_date', today);

                    if (existingAttendance && existingAttendance.length > 0) {
                        const map: AttendanceMap = {};
                        existingAttendance.forEach((r: any) => {
                            map[r.student_id] = r.status;
                        });
                        setAttendance(map);
                    }
                }
            } catch (err) {
                console.error('Error loading attendance data:', err);
            } finally {
                setLoading(false);
            }
        };

        init();
    }, [user?.id, authLoading]);

    const markStudent = (studentId: number, status: 'present' | 'absent') => {
        setAttendance(prev => ({ ...prev, [studentId]: status }));
    };

    const markAll = (status: 'present' | 'absent') => {
        const map: AttendanceMap = {};
        students.forEach(s => { map[s.sr_no] = status; }); // use sr_no as key
        setAttendance(map);
    };

    const handleSave = async () => {
        if (!teacherProfile?.class_teacher) return;
        setSaving(true);
        try {
            const records = students.map(s => ({
                student_id: s.sr_no,      // use sr_no as the student reference
                class_name: teacherProfile.class_teacher,
                attendance_date: today,
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
            console.error('Error saving attendance:', err);
            alert('Failed to save attendance. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const presentCount = Object.values(attendance).filter(v => v === 'present').length;
    const absentCount  = Object.values(attendance).filter(v => v === 'absent').length;
    const unmarkedCount = students.length - presentCount - absentCount;

    return (
        <AppShell 
            title="Class Attendance" 
            subtitle="Mark daily presence for your assigned students"
        >
            <div className="space-y-6 animate-in fade-in duration-500">
                {/* Header bar */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">
                            Daily Record — <span className="text-indigo-600 uppercase">{teacherProfile?.class_teacher || '...'}</span>
                        </h1>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="bg-white p-2 rounded-xl border border-slate-200 flex items-center gap-2 px-4 shadow-sm">
                            <Clock className="w-4 h-4 text-indigo-500" />
                            <span className="text-sm font-bold text-slate-700">
                                {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Stats row */}
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

                {/* Main table */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    {/* Table header bar */}
                    <div className="p-4 px-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => markAll('present')}
                                className="text-xs font-bold text-emerald-600 border border-emerald-200 bg-emerald-50 px-3 py-1.5 rounded-lg hover:bg-emerald-100 transition-all"
                            >
                                ✓ Mark All Present
                            </button>
                            <button
                                onClick={() => markAll('absent')}
                                className="text-xs font-bold text-rose-600 border border-rose-200 bg-rose-50 px-3 py-1.5 rounded-lg hover:bg-rose-100 transition-all"
                            >
                                ✗ Mark All Absent
                            </button>
                        </div>
                        <button
                            onClick={handleSave}
                            disabled={saving || students.length === 0}
                            className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2 rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all disabled:opacity-50 shadow-md shadow-indigo-200"
                        >
                            {saving ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : savedSuccess ? (
                                <CheckCircle2 className="w-4 h-4" />
                            ) : (
                                <Save className="w-4 h-4" />
                            )}
                            {saving ? 'Saving...' : savedSuccess ? 'Saved!' : 'Save Attendance'}
                        </button>
                    </div>

                    {/* Column headers */}
                    <div className="grid grid-cols-12 gap-4 p-3 px-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/30 border-b border-slate-50">
                        <div className="col-span-1">Roll</div>
                        <div className="col-span-7">Student Name</div>
                        <div className="col-span-4 text-right">Status</div>
                    </div>

                    {/* Student rows */}
                    {loading ? (
                        <div className="flex items-center justify-center py-16">
                            <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
                        </div>
                    ) : students.length === 0 ? (
                        <div className="p-12 text-center">
                            <AlertCircle className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                            <p className="text-slate-500 font-medium">No students found in this class.</p>
                            <p className="text-slate-400 text-sm mt-1">Make sure the class name in your profile matches the student records.</p>
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
                                                <p className="text-sm font-bold text-slate-800">{student.name}</p>
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
