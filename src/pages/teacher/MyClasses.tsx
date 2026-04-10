import React, { useEffect, useState } from 'react';
import AppShell from '@/components/layout/AppShell';
import { supabase } from '@/config/supabaseClient';
import { useAuth } from '@/context/AuthContext';
import { 
    Users, Search, Loader2, Phone, 
    UserCircle, BookOpen, AlertCircle, Hash, X
} from 'lucide-react';

interface Student {
    sr_no: number;
    roll_no: string;
    name: string;
    class: string;
    dob: string;
    gender: string;
    mother_name: string;
    father_name: string;
    address: string;
    phone: string;
    whatsapp: string;
    aadhar_card: string;
    pen_no: string;
    caste: string;
    religion: string;
    blood_group: string;
    rte: string;
    status: string;
    house: string;
    email: string;
}

const DetailRow: React.FC<{ label: string; value?: string | null }> = ({ label, value }) => (
    <div className="flex flex-col">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</span>
        <span className="text-sm font-semibold text-slate-700 mt-0.5">{value || '—'}</span>
    </div>
);

const MyClasses: React.FC = () => {
    const { user, isLoading: authLoading } = useAuth();
    const [className, setClassName] = useState<string | null>(null);
    const [students, setStudents] = useState<Student[]>([]);
    const [filtered, setFiltered] = useState<Student[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [selected, setSelected] = useState<Student | null>(null);

    useEffect(() => {
        if (authLoading) return;
        if (!user?.id) { setLoading(false); return; }

        const fetchData = async () => {
            setLoading(true);
            try {
                // Step 1: get the teacher's class
                const { data: teacher } = await supabase
                    .from('teacher_registrations')
                    .select('class_teacher')
                    .eq('user_id', user.id)
                    .single();

                if (!teacher?.class_teacher) { setLoading(false); return; }
                setClassName(teacher.class_teacher);

                // Step 2: get students sorted by name ascending
                const { data: studentList } = await supabase
                    .from('students')
                    .select('*')
                    .eq('class', teacher.class_teacher)
                    .eq('status', 'active')
                    .order('name', { ascending: true });

                if (studentList) {
                    setStudents(studentList);
                    setFiltered(studentList);
                }
            } catch (err) {
                console.error('Error loading class data:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [user?.id, authLoading]);

    // Search filter
    useEffect(() => {
        if (!search.trim()) {
            setFiltered(students);
            return;
        }
        const q = search.toLowerCase();
        setFiltered(students.filter(s =>
            s.name?.toLowerCase().includes(q) ||
            s.roll_no?.toLowerCase().includes(q) ||
            s.father_name?.toLowerCase().includes(q)
        ));
    }, [search, students]);

    const genderBadge = (g?: string) => {
        if (!g) return 'bg-slate-100 text-slate-500';
        if (g.toLowerCase() === 'male') return 'bg-blue-100 text-blue-600';
        if (g.toLowerCase() === 'female') return 'bg-pink-100 text-pink-600';
        return 'bg-purple-100 text-purple-600';
    };

    return (
        <AppShell
            title={`Class ${className || '...'}`}
            subtitle="Your assigned class roster"
        >
            <div className="space-y-6 animate-in fade-in duration-500">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">
                            Student Roster — 
                            <span className="text-indigo-600 uppercase ml-2">{className || '...'}</span>
                        </h1>
                        <p className="text-slate-500 text-sm mt-0.5">
                            {loading ? 'Loading...' : `${students.length} students enrolled`}
                        </p>
                    </div>
                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search by name or roll no..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 w-64 shadow-sm"
                        />
                    </div>
                </div>

                {/* Content */}
                {loading ? (
                    <div className="flex items-center justify-center py-24">
                        <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
                    </div>
                ) : students.length === 0 ? (
                    <div className="py-16 text-center bg-white rounded-2xl border border-slate-100 shadow-sm">
                        <AlertCircle className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                        <p className="text-slate-600 font-semibold">No students found</p>
                        <p className="text-slate-400 text-sm mt-1">
                            No active students are linked to class "{className}". Check the class names match exactly.
                        </p>
                    </div>
                ) : (
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                        {/* Table header */}
                        <div className="grid grid-cols-12 gap-3 p-3 px-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 border-b border-slate-100">
                            <div className="col-span-1">#</div>
                            <div className="col-span-1">Roll</div>
                            <div className="col-span-4">Name</div>
                            <div className="col-span-2">Father's Name</div>
                            <div className="col-span-2">Contact</div>
                            <div className="col-span-1">Gender</div>
                            <div className="col-span-1 text-right">Details</div>
                        </div>

                        {/* Student rows */}
                        <div className="divide-y divide-slate-50">
                            {filtered.map((student, idx) => (
                                <div
                                    key={student.sr_no}
                                    className="grid grid-cols-12 gap-3 p-4 px-5 items-center hover:bg-slate-50/60 transition-colors"
                                >
                                    <div className="col-span-1 text-sm font-bold text-slate-400">{idx + 1}</div>
                                    <div className="col-span-1 text-sm font-mono font-bold text-indigo-500">{student.roll_no || '—'}</div>
                                    <div className="col-span-4 flex items-center gap-3">
                                        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${genderBadge(student.gender)}`}>
                                            {student.name?.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-slate-800 capitalize">{student.name}</p>
                                            {student.dob && (
                                                <p className="text-xs text-slate-400">
                                                    DOB: {new Date(student.dob).toLocaleDateString('en-IN')}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="col-span-2">
                                        <p className="text-sm text-slate-600 font-medium truncate capitalize">{student.father_name || '—'}</p>
                                    </div>
                                    <div className="col-span-2">
                                        <p className="text-sm text-slate-600 font-medium">{student.phone || student.whatsapp || '—'}</p>
                                    </div>
                                    <div className="col-span-1">
                                        <span className={`text-[10px] font-bold px-2 py-1 rounded-full capitalize ${genderBadge(student.gender)}`}>
                                            {student.gender || '—'}
                                        </span>
                                    </div>
                                    <div className="col-span-1 flex justify-end">
                                        <button
                                            onClick={() => setSelected(student)}
                                            className="text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-all"
                                        >
                                            View
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* No search results */}
                        {filtered.length === 0 && search && (
                            <div className="py-10 text-center text-slate-400">
                                No students match "<strong>{search}</strong>"
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Student Detail Slideover */}
            {selected && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
                        {/* Slideover Header */}
                        <div className="bg-gradient-to-r from-indigo-600 to-blue-500 p-6 flex items-center justify-between text-white">
                            <div className="flex items-center gap-4">
                                <div className={`w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center text-xl font-black`}>
                                    {selected.name?.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <h2 className="text-xl font-extrabold capitalize">{selected.name}</h2>
                                    <p className="text-indigo-200 text-sm">Roll No: {selected.roll_no || '—'} · Class: {selected.class}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setSelected(null)}
                                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-all"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Detail Grid */}
                        <div className="p-6 grid grid-cols-2 sm:grid-cols-3 gap-5 overflow-y-auto max-h-[60vh]">
                            <DetailRow label="Father's Name" value={selected.father_name} />
                            <DetailRow label="Mother's Name" value={selected.mother_name} />
                            <DetailRow label="Date of Birth" value={selected.dob ? new Date(selected.dob).toLocaleDateString('en-IN') : '—'} />
                            <DetailRow label="Gender" value={selected.gender} />
                            <DetailRow label="Blood Group" value={selected.blood_group} />
                            <DetailRow label="Religion" value={selected.religion} />
                            <DetailRow label="Caste" value={selected.caste} />
                            <DetailRow label="Phone" value={selected.phone} />
                            <DetailRow label="WhatsApp" value={selected.whatsapp} />
                            <DetailRow label="Email" value={selected.email} />
                            <DetailRow label="Aadhar Number" value={selected.aadhar_card} />
                            <DetailRow label="PEN Number" value={selected.pen_no} />
                            <DetailRow label="RTE Status" value={selected.rte} />
                            <DetailRow label="House" value={selected.house} />
                            <div className="col-span-2 sm:col-span-3">
                                <DetailRow label="Address" value={selected.address} />
                            </div>
                        </div>

                        <div className="px-6 pb-5">
                            <button
                                onClick={() => setSelected(null)}
                                className="w-full py-3 bg-slate-100 text-slate-700 font-bold rounded-2xl hover:bg-slate-200 transition-all"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AppShell>
    );
};

export default MyClasses;
