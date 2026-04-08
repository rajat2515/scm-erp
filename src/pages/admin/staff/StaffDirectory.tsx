import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/config/supabaseClient';
import AppShell from '@/components/layout/AppShell';
import { Search, Plus, Pencil, Trash2, X, GraduationCap, Building2, UserCircle2, Save, Loader2, Eye, IndianRupee, Download, Printer, FileText, BookOpen, Phone, MapPin, CreditCard, Mail, Award, Users } from 'lucide-react';
import Swal from 'sweetalert2';
import type { StaffProfile } from '@/types';
import * as XLSX from 'xlsx';

interface TeacherRecord {
    id: number;
    teacher_code?: string;
    teacher_name: string;
    mobile_number?: string;
    email_id?: string;
    school_email?: string;
    dob?: string;
    gender?: string;
    designation?: string;
    teacher_qualification?: string;
    highest_qualification?: string;
    nature_of_appointment?: string;
    date_of_joining?: string;
    appointed_subject?: string;
    main_subject_taught?: string;
    class_teacher?: string;
    basic_pay?: number;
    grade_pay?: number;
    aadhar_no?: string;
    trained_or_untrained?: string;
    social_category?: string;
    pan_no?: string;
    classes_taught?: string[];
    created_at?: string;
    fathers_spouse_name?: string;
    emergency_contact?: string;
    address?: string;
}

const DESIGNATIONS = [
    'Principal', 'Vice Principal', 'Clerk', 'Peon', 'Guard', 'Driver', 'Labour', 'Other'
];

const STAFF_CATEGORIES = [
    { key: 'all', label: 'All Staff' },
    { key: 'teachers', label: 'Teachers' },
    { key: 'academic', label: 'Admin / Academic' },
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

function getInitials(name: string) {
    return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
}

function fmtINR(n: number) {
    return '₹' + n.toLocaleString('en-IN');
}

function formatDate(d?: string) {
    if (!d) return '—';
    try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
    catch { return d; }
}

export default function StaffDirectory() {
    const [staff, setStaff] = useState<StaffProfile[]>([]);
    const [teachers, setTeachers] = useState<TeacherRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [selectedStaff, setSelectedStaff] = useState<StaffProfile | null>(null);
    const [selectedTeacher, setSelectedTeacher] = useState<TeacherRecord | null>(null);
    const [staffCategory, setStaffCategory] = useState<StaffCategory>('all');
    
    // Modal state
    const [modalOpen, setModalOpen] = useState(false);
    const [editingStaff, setEditingStaff] = useState<StaffProfile | null>(null);
    const [teacherModalOpen, setTeacherModalOpen] = useState(false);
    const [editingTeacher, setEditingTeacher] = useState<TeacherRecord | null>(null);

    useEffect(() => {
        loadStaff();
        loadTeachers();
    }, []);

    const loadStaff = async () => {
        setLoading(true);
        const { data, error } = await supabase.from('staff_profiles').select('*').order('name');
        if (!error && data) setStaff(data as unknown as StaffProfile[]);
        setLoading(false);
    };

    const loadTeachers = async () => {
        const { data } = await supabase.from('teacher_registrations').select('*').order('teacher_name');
        if (data) setTeachers(data as TeacherRecord[]);
    };

    const handleDeleteTeacher = async (id: number, name: string) => {
        const result = await Swal.fire({
            title: 'Delete Teacher?',
            text: `Are you sure you want to remove ${name} from teacher records?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Yes, delete it!'
        });

        if (result.isConfirmed) {
            const { error } = await supabase.from('teacher_registrations').delete().eq('id', id);
            if (!error) {
                setTeachers(prev => prev.filter(t => t.id !== id));
                if (selectedTeacher?.id === id) setSelectedTeacher(null);
                Swal.fire('Deleted!', 'Teacher has been removed.', 'success');
            } else {
                Swal.fire('Error!', 'Failed to delete: ' + error.message, 'error');
            }
        }
    };

    const handleDelete = async (id: string, name: string) => {
        const result = await Swal.fire({
            title: 'Remove Staff?',
            text: `Are you sure you want to remove ${name} from the staff directory?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Yes, delete it!'
        });

        if (result.isConfirmed) {
            const { error } = await supabase.from('staff_profiles').delete().eq('id', id);
            if (!error) {
                setStaff(prev => prev.filter(s => s.id !== id));
                Swal.fire('Deleted!', 'Staff member has been removed.', 'success');
            } else {
                Swal.fire('Error!', 'Failed to delete: ' + error.message, 'error');
            }
        }
    };

    const openCreateModal = () => {
        setEditingStaff(null);
        setModalOpen(true);
    };

    const openEditModal = (s: StaffProfile) => {
        setEditingStaff(s);
        setModalOpen(true);
    };

    const isTeachersTab = staffCategory === 'teachers';

    const filteredStaff = staff.filter(s => {
        const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase()) || (s.designation || '').toLowerCase().includes(search.toLowerCase());
        const matchesCategory = staffCategory === 'all' || (staffCategory !== 'teachers' && getStaffCategory(s.designation) === staffCategory);
        // Never show teacher-designated staff in staff cards (they are in teacher_registrations)
        if (getStaffCategory(s.designation) === 'teachers') return false;
        return matchesSearch && matchesCategory;
    });

    const filteredTeachers = teachers.filter(t =>
        (t.teacher_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (t.designation || '').toLowerCase().includes(search.toLowerCase()) ||
        (t.main_subject_taught || '').toLowerCase().includes(search.toLowerCase())
    );

    /* ── Excel Export ──────────────────────────────────── */
    const handleExportExcel = () => {
        const catLabel = STAFF_CATEGORIES.find(c => c.key === staffCategory)?.label || 'All';
        const rows = filteredStaff.map((s, i) => ({
            '#': i + 1,
            'Name': s.name,
            'Designation': s.designation,
            'Father / Spouse': s.fathers_spouse_name || '',
            'DOB': s.dob || '',
            'Qualification': s.qualification || '',
            'Teaching Subject': s.teaching_subject || '',
            'Training': s.trained_status || '',
            'Appointment Date': s.appointment_date || '',
            'Basic Pay': s.basic_pay || 0,
            'Grade Pay': s.grade_pay || 0,
            'Gross Pay': (s.basic_pay || 0) + (s.grade_pay || 0),
            'Status': s.status || '',
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, catLabel);
        XLSX.writeFile(wb, `Staff_${catLabel.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    /* ── Print Individual Teacher ──────────────────────────── */
    const handlePrintTeacher = (t: TeacherRecord) => {
        const printArea = document.getElementById('staff-print-area');
        if (!printArea) return;
        const rows: [string, string][] = [
            ['Full Name', t.teacher_name],
            ['Teacher Code', t.teacher_code || '—'],
            ['Designation', t.designation || '—'],
            ['Father / Spouse Name', t.fathers_spouse_name || '—'],
            ['Date of Birth', t.dob ? formatDate(t.dob) : '—'],
            ['Gender', t.gender || '—'],
            ['Qualification', t.teacher_qualification || t.highest_qualification || '—'],
            ['Teaching Subject', t.main_subject_taught || t.appointed_subject || '—'],
            ['Class Teacher Of', t.class_teacher || '—'],
            ['Appointment Date', t.date_of_joining ? formatDate(t.date_of_joining) : '—'],
            ['Nature of Appointment', t.nature_of_appointment || '—'],
            ['Training Status', t.trained_or_untrained || '—'],
            ['Social Category', t.social_category || '—'],
            ['Mobile Number', t.mobile_number || '—'],
            ['Email', t.school_email || t.email_id || '—'],
            ['Aadhar No.', t.aadhar_no || '—'],
            ['PAN No.', t.pan_no || '—'],
            ['Emergency Contact', t.emergency_contact || '—'],
            ['Address', t.address || '—'],
            ['Basic Pay', fmtINR(t.basic_pay || 0)],
            ['Grade Pay', fmtINR(t.grade_pay || 0)],
            ['Gross Pay', fmtINR((t.basic_pay || 0) + (t.grade_pay || 0))],
        ];
        printArea.innerHTML = `
            <div style="font-family: Arial, sans-serif; padding: 10mm; color: #000; max-width: 640px; margin: 0 auto;">
                <div style="display: flex; align-items: center; gap: 12px; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 16px;">
                    <img src="/school-logo.png" alt="Logo" style="width: 60px; height: 60px; object-fit: contain;" />
                    <div style="flex: 1; text-align: center;">
                        <div style="font-weight: 900; font-size: 18px; letter-spacing: 1px; text-transform: uppercase;">S.C.M. CHILDREN ACADEMY</div>
                        <div style="font-size: 11px; margin-top: 2px;">Affiliation No: 2132374 | School Code: 81858</div>
                        <div style="font-size: 11px;">HALDAUR, BIJNOR</div>
                    </div>
                </div>
                <div style="text-align: center; font-weight: bold; font-size: 15px; text-decoration: underline; margin-bottom: 16px;">TEACHER PROFILE</div>
                <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                    <tbody>
                        ${rows.map(([label, val]) => `
                            <tr>
                                <td style="border: 1px solid #aaa; padding: 6px 10px; font-weight: bold; width: 40%; background: #f0f0f8;">${label}</td>
                                <td style="border: 1px solid #aaa; padding: 6px 10px;">${val}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                <div style="display: flex; justify-content: space-between; margin-top: 40px; font-size: 11px;">
                    <div style="text-align: center;"><div style="border-top: 1px solid #000; width: 120px; padding-top: 4px;">Employee</div></div>
                    <div style="text-align: center;"><div style="border-top: 1px solid #000; width: 120px; padding-top: 4px;">Principal</div></div>
                </div>
                <div style="text-align: center; font-size: 9px; color: #666; margin-top: 16px;">Generated by SCM ERP System — ${new Date().toLocaleDateString('en-IN')}</div>
            </div>
        `;
        printArea.style.display = 'block';
        const cleanup = () => { printArea.style.display = 'none'; window.removeEventListener('afterprint', cleanup); };
        window.addEventListener('afterprint', cleanup);
        window.print();
    };

    /* ── Print Individual Staff ────────────────────────── */
    const handlePrintStaff = (s: StaffProfile) => {
        const printArea = document.getElementById('staff-print-area');
        if (!printArea) return;
        printArea.innerHTML = `
            <div style="font-family: Arial, sans-serif; padding: 10mm; color: #000; max-width: 600px; margin: 0 auto;">
                <div style="display: flex; align-items: center; gap: 12px; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 16px;">
                    <img src="/school-logo.png" alt="Logo" style="width: 60px; height: 60px; object-fit: contain;" />
                    <div style="flex: 1; text-align: center;">
                        <div style="font-weight: 900; font-size: 18px; letter-spacing: 1px; text-transform: uppercase;">S.C.M. CHILDREN ACADEMY</div>
                        <div style="font-size: 11px; margin-top: 2px;">Affiliation No: 2132374 | School Code: 81858</div>
                        <div style="font-size: 11px;">HALDAUR, BIJNOR</div>
                    </div>
                </div>
                <div style="text-align: center; font-weight: bold; font-size: 15px; text-decoration: underline; margin-bottom: 16px;">STAFF PROFILE</div>
                <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                    <tbody>
                        ${[
                            ['Full Name', s.name],
                            ['Designation', s.designation],
                            ['Father / Spouse Name', s.fathers_spouse_name || '—'],
                            ['Date of Birth', s.dob ? formatDate(s.dob) : '—'],
                            ['Qualification', s.qualification || '—'],
                            ['Teaching Subject', s.teaching_subject || '—'],
                            ['Training Status', s.trained_status || '—'],
                            ['Appointment Date', s.appointment_date ? formatDate(s.appointment_date) : '—'],
                            ['Basic Pay', fmtINR(s.basic_pay || 0)],
                            ['Grade Pay', fmtINR(s.grade_pay || 0)],
                            ['Gross Pay', fmtINR((s.basic_pay || 0) + (s.grade_pay || 0))],
                            ['Status', (s.status || 'active').toUpperCase()],
                        ].map(([label, val]) => `
                            <tr>
                                <td style="border: 1px solid #aaa; padding: 6px 10px; font-weight: bold; width: 40%; background: #f5f5f5;">${label}</td>
                                <td style="border: 1px solid #aaa; padding: 6px 10px;">${val}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                <div style="display: flex; justify-content: space-between; margin-top: 40px; font-size: 11px;">
                    <div style="text-align: center;"><div style="border-top: 1px solid #000; width: 120px; padding-top: 4px;">Employee</div></div>
                    <div style="text-align: center;"><div style="border-top: 1px solid #000; width: 120px; padding-top: 4px;">Principal</div></div>
                </div>
                <div style="text-align: center; font-size: 9px; color: #666; margin-top: 16px;">Generated by SCM ERP System</div>
            </div>
        `;
        printArea.style.display = 'block';
        const cleanup = () => { printArea.style.display = 'none'; window.removeEventListener('afterprint', cleanup); };
        window.addEventListener('afterprint', cleanup);
        window.print();
    };

    return (
        <AppShell title="Staff Directory" subtitle="Manage school staff profiles and access levels">
            <div className={`transition-all duration-300 ${selectedStaff ? 'mr-[22rem] lg:mr-[24rem]' : ''}`}>
                {/* Category Tabs */}
                <div className="flex bg-muted/50 p-1.5 rounded-2xl w-fit mb-5 overflow-x-auto">
                    {STAFF_CATEGORIES.map(cat => {
                        const count = cat.key === 'teachers'
                            ? teachers.length
                            : cat.key === 'all'
                            ? staff.filter(s => getStaffCategory(s.designation) !== 'teachers').length + teachers.length
                            : staff.filter(s => getStaffCategory(s.designation) === cat.key).length;
                        return (
                            <button
                                key={cat.key}
                                onClick={() => { setStaffCategory(cat.key); setSelectedStaff(null); setSelectedTeacher(null); }}
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

                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div className="relative w-full sm:w-96">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder={isTeachersTab ? 'Search teachers...' : 'Search staff by name or designation...'}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-card border border-border rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                    />
                </div>

                <div className="flex items-center gap-2 flex-shrink-0 w-full sm:w-auto">
                    <button
                        onClick={handleExportExcel}
                        disabled={filteredStaff.length === 0}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border border-border hover:bg-muted transition-colors disabled:opacity-50"
                    >
                        <Download className="w-4 h-4" />
                        Excel
                    </button>
                    {isTeachersTab ? (
                        <button
                            onClick={() => { setEditingTeacher(null); setTeacherModalOpen(true); }}
                            className="flex items-center gap-2 gradient-primary text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:opacity-90 transition-all shadow-lg shadow-primary/20"
                        >
                            <Plus className="w-4 h-4" /> Add Teacher
                        </button>
                    ) : (
                        <button
                            onClick={openCreateModal}
                            className="flex items-center gap-2 gradient-primary text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:opacity-90 transition-all shadow-lg shadow-primary/20"
                        >
                            <Plus className="w-4 h-4" /> Add Staff
                        </button>
                    )}
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-primary/50" />
                </div>
            ) : isTeachersTab ? (
                /* ── Teachers-only tab ── */
                filteredTeachers.length === 0 ? (
                    <div className="text-center py-20 bg-card border border-border rounded-3xl">
                        <BookOpen className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                        <p className="text-muted-foreground">No teachers found.</p>
                        <button onClick={() => { setEditingTeacher(null); setTeacherModalOpen(true); }} className="mt-4 px-5 py-2 gradient-primary text-white rounded-xl text-sm font-medium">
                            Add First Teacher
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {filteredTeachers.map((t) => (
                            <div key={t.id} className="bg-card border border-border rounded-2xl p-5 hover:border-indigo-300 hover:shadow-lg transition-all group flex flex-col">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-black text-lg shadow-md flex-shrink-0">
                                            {getInitials(t.teacher_name)}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-foreground leading-tight">{t.teacher_name}</h3>
                                            <p className="text-xs text-indigo-600 font-medium mt-0.5">{t.designation || 'Teacher'}</p>
                                        </div>
                                    </div>
                                    <div className="flex opacity-0 group-hover:opacity-100 transition-opacity gap-1">
                                        <button onClick={() => setSelectedTeacher(t)} className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-500 transition-colors" title="View"><Eye className="w-4 h-4" /></button>
                                        <button onClick={() => { setEditingTeacher(t); setTeacherModalOpen(true); }} className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-500 transition-colors" title="Edit"><Pencil className="w-4 h-4" /></button>
                                        <button onClick={() => handleDeleteTeacher(t.id, t.teacher_name)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors" title="Delete"><Trash2 className="w-4 h-4" /></button>
                                    </div>
                                </div>
                                <div className="space-y-1.5 mt-auto">
                                    {t.main_subject_taught && (
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground"><BookOpen className="w-3.5 h-3.5" /><span className="truncate">{t.main_subject_taught}</span></div>
                                    )}
                                    {t.class_teacher && (
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Users className="w-3.5 h-3.5" /><span className="truncate">Class Teacher: {t.class_teacher}</span></div>
                                    )}
                                </div>
                                <div className="mt-4 pt-4 border-t border-border flex justify-between items-center">
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100 font-semibold">{t.trained_or_untrained || 'Trained'}</span>
                                    <div className="text-right">
                                        <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block">Pay</span>
                                        <span className="text-sm font-bold text-foreground">{fmtINR((t.basic_pay || 0) + (t.grade_pay || 0))}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )
            ) : staffCategory === 'all' ? (
                /* ── All Staff tab: non-teachers + teachers combined ── */
                filteredStaff.length === 0 && filteredTeachers.length === 0 ? (
                    <div className="text-center py-20 bg-card border border-border rounded-3xl">
                        <UserCircle2 className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                        <p className="text-muted-foreground">No staff members found.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {/* Non-teacher staff cards */}
                        {filteredStaff.map((member) => (
                            <div key={`sp-${member.id}`} className="bg-card border border-border rounded-2xl p-5 hover:border-primary/30 hover:shadow-lg transition-all group flex flex-col">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-full gradient-primary flex items-center justify-center text-white font-black text-lg shadow-md flex-shrink-0">
                                            {getInitials(member.name)}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-foreground leading-tight">{member.name}</h3>
                                            <p className="text-xs text-primary font-medium mt-0.5">{member.designation}</p>
                                        </div>
                                    </div>
                                    <div className="flex opacity-0 group-hover:opacity-100 transition-opacity gap-1">
                                        <button onClick={() => setSelectedStaff(member)} className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-500 transition-colors" title="View Details"><Eye className="w-4 h-4" /></button>
                                        <button onClick={() => openEditModal(member)} className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-500 transition-colors" title="Edit"><Pencil className="w-4 h-4" /></button>
                                        <button onClick={() => handleDelete(member.id, member.name)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors" title="Delete"><Trash2 className="w-4 h-4" /></button>
                                    </div>
                                </div>
                                <div className="space-y-2 mt-auto">
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <GraduationCap className="w-4 h-4" />
                                        <span className="truncate">{member.qualification || 'No qual. listed'}</span>
                                        {member.trained_status && (
                                            <span className={`text-[10px] items-center flex rounded-full px-2 py-0.5 border ${member.trained_status === 'Trained' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>{member.trained_status}</span>
                                        )}
                                    </div>
                                </div>
                                <div className="mt-4 pt-4 border-t border-border flex justify-end items-center">
                                    <div className="text-right">
                                        <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block">Pay</span>
                                        <span className="text-sm font-bold text-foreground">{fmtINR((member.basic_pay || 0) + (member.grade_pay || 0))}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {/* Teacher cards in All tab */}
                        {filteredTeachers.map((t) => (
                            <div key={`tr-${t.id}`} className="bg-card border border-border rounded-2xl p-5 hover:border-indigo-300 hover:shadow-lg transition-all group flex flex-col">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-black text-lg shadow-md flex-shrink-0">
                                            {getInitials(t.teacher_name)}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-foreground leading-tight">{t.teacher_name}</h3>
                                            <p className="text-xs text-indigo-600 font-medium mt-0.5">{t.designation || 'Teacher'}</p>
                                        </div>
                                    </div>
                                    <div className="flex opacity-0 group-hover:opacity-100 transition-opacity gap-1">
                                        <button onClick={() => setSelectedTeacher(t)} className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-500 transition-colors" title="View"><Eye className="w-4 h-4" /></button>
                                        <button onClick={() => { setEditingTeacher(t); setTeacherModalOpen(true); }} className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-500 transition-colors" title="Edit"><Pencil className="w-4 h-4" /></button>
                                        <button onClick={() => handleDeleteTeacher(t.id, t.teacher_name)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors" title="Delete"><Trash2 className="w-4 h-4" /></button>
                                    </div>
                                </div>
                                <div className="space-y-1.5 mt-auto">
                                    {t.main_subject_taught && (
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground"><BookOpen className="w-3.5 h-3.5" /><span className="truncate">{t.main_subject_taught}</span></div>
                                    )}
                                    {t.class_teacher && (
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Users className="w-3.5 h-3.5" /><span className="truncate">Class Teacher: {t.class_teacher}</span></div>
                                    )}
                                </div>
                                <div className="mt-4 pt-4 border-t border-border flex justify-between items-center">
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100 font-semibold">{t.trained_or_untrained || 'Trained'}</span>
                                    <div className="text-right">
                                        <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block">Pay</span>
                                        <span className="text-sm font-bold text-foreground">{fmtINR((t.basic_pay || 0) + (t.grade_pay || 0))}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )
            ) : filteredStaff.length === 0 ? (
                /* ── Other category tabs (academic, peon_guard, etc.) ── */
                <div className="text-center py-20 bg-card border border-border rounded-3xl">
                    <UserCircle2 className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-muted-foreground">No staff members found.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredStaff.map((member) => (
                        <div key={member.id} className="bg-card border border-border rounded-2xl p-5 hover:border-primary/30 hover:shadow-lg transition-all group flex flex-col">
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-full gradient-primary flex items-center justify-center text-white font-black text-lg shadow-md flex-shrink-0">
                                        {getInitials(member.name)}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-foreground leading-tight">{member.name}</h3>
                                        <p className="text-xs text-primary font-medium mt-0.5">{member.designation}</p>
                                    </div>
                                </div>
                                <div className="flex opacity-0 group-hover:opacity-100 transition-opacity gap-1">
                                    <button onClick={() => setSelectedStaff(member)} className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-500 transition-colors" title="View Details"><Eye className="w-4 h-4" /></button>
                                    <button onClick={() => openEditModal(member)} className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-500 transition-colors" title="Edit"><Pencil className="w-4 h-4" /></button>
                                    <button onClick={() => handleDelete(member.id, member.name)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors" title="Delete"><Trash2 className="w-4 h-4" /></button>
                                </div>
                            </div>
                            <div className="space-y-2 mt-auto">
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <GraduationCap className="w-4 h-4" />
                                    <span className="truncate">{member.qualification || 'No qual. listed'}</span>
                                    {member.trained_status && (
                                        <span className={`text-[10px] items-center flex rounded-full px-2 py-0.5 border ${member.trained_status === 'Trained' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>{member.trained_status}</span>
                                    )}
                                </div>
                            </div>
                            <div className="mt-4 pt-4 border-t border-border flex justify-end items-center">
                                <div className="text-right">
                                    <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block">Pay</span>
                                    <span className="text-sm font-bold text-foreground">{fmtINR((member.basic_pay || 0) + (member.grade_pay || 0))}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            </div>

            {/* ── Teacher Detail Slideover ─────────────────── */}
            {selectedTeacher && (
                <>
                    <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden" onClick={() => setSelectedTeacher(null)} />
                    <div className="fixed right-0 top-0 h-full z-50 w-[22rem] lg:w-[26rem] bg-card border-l border-border animate-fade-in flex flex-col shadow-2xl overflow-hidden">
                        <div className="relative bg-indigo-600 p-6 pb-8">
                            <button onClick={() => setSelectedTeacher(null)} className="absolute top-4 right-4 p-1.5 rounded-lg bg-white/20 hover:bg-white/30 transition-colors">
                                <X className="w-4 h-4 text-white" />
                            </button>
                            <div className="flex flex-col items-center gap-3 mt-4">
                                <div className="w-20 h-20 rounded-full bg-white/20 border-4 border-white/40 flex items-center justify-center text-white text-3xl font-black shadow-lg">
                                    {getInitials(selectedTeacher.teacher_name)}
                                </div>
                                <div className="text-center">
                                    <h2 className="font-bold text-white text-xl leading-tight">{selectedTeacher.teacher_name}</h2>
                                    <p className="text-white/80 font-medium text-sm mt-1">{selectedTeacher.designation || 'Teacher'}</p>
                                </div>
                                {selectedTeacher.teacher_code && (
                                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-white/20 text-white border border-white/30">
                                        Code: {selectedTeacher.teacher_code}
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-5 space-y-4">
                            {/* Professional Info */}
                            <div className="bg-muted/40 rounded-2xl p-4">
                                <div className="flex items-center gap-2 mb-3">
                                    <GraduationCap className="w-4 h-4 text-indigo-600" />
                                    <h3 className="font-bold text-xs uppercase tracking-widest text-muted-foreground">Professional Info</h3>
                                </div>
                                <div className="space-y-2">
                                    {[
                                        ['Qualification', selectedTeacher.teacher_qualification || selectedTeacher.highest_qualification],
                                        ['Teaching Subject', selectedTeacher.main_subject_taught || selectedTeacher.appointed_subject],
                                        ['Class Teacher Of', selectedTeacher.class_teacher],
                                        ['Appointment Date', formatDate(selectedTeacher.date_of_joining)],
                                        ['Training Status', selectedTeacher.trained_or_untrained],
                                    ].filter(([, v]) => v).map(([label, val]) => (
                                        <div key={label as string} className="flex justify-between items-center text-sm border-b border-border/50 pb-2 last:border-0 last:pb-0">
                                            <span className="text-muted-foreground">{label}</span>
                                            <span className="font-semibold text-foreground text-right max-w-[55%]">{val}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            {/* Personal Info */}
                            <div className="bg-muted/40 rounded-2xl p-4">
                                <div className="flex items-center gap-2 mb-3">
                                    <UserCircle2 className="w-4 h-4 text-indigo-600" />
                                    <h3 className="font-bold text-xs uppercase tracking-widest text-muted-foreground">Personal Info</h3>
                                </div>
                                <div className="space-y-2">
                                    {[
                                        ['Date of Birth', formatDate(selectedTeacher.dob)],
                                        ['Gender', selectedTeacher.gender],
                                        ['Father / Spouse Name', selectedTeacher.fathers_spouse_name],
                                        ['Mobile', selectedTeacher.mobile_number],
                                        ['Emergency Contact', selectedTeacher.emergency_contact],
                                        ['School Email', selectedTeacher.school_email || selectedTeacher.email_id],
                                        ['Aadhar No.', selectedTeacher.aadhar_no],
                                        ['Address', selectedTeacher.address],
                                    ].filter(([, v]) => v).map(([label, val]) => (
                                        <div key={label as string} className="flex justify-between items-start text-sm border-b border-border/50 pb-2 last:border-0 last:pb-0">
                                            <span className="text-muted-foreground flex-shrink-0">{label}</span>
                                            <span className="font-semibold text-foreground text-right ml-4 max-w-[55%] break-words">{val}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            {/* Payroll */}
                            <div className="bg-primary/5 border border-primary/10 rounded-2xl p-4">
                                <div className="flex items-center gap-2 mb-3">
                                    <IndianRupee className="w-4 h-4 text-primary" />
                                    <h3 className="font-bold text-xs uppercase tracking-widest text-primary">Payroll Summary</h3>
                                </div>
                                <div className="grid grid-cols-2 gap-3 mb-2">
                                    <div className="bg-background rounded-xl p-3 border border-primary/10">
                                        <span className="text-xs text-muted-foreground block mb-1">Basic Pay</span>
                                        <span className="font-bold">{fmtINR(selectedTeacher.basic_pay || 0)}</span>
                                    </div>
                                    <div className="bg-background rounded-xl p-3 border border-primary/10">
                                        <span className="text-xs text-muted-foreground block mb-1">Grade Pay</span>
                                        <span className="font-bold">{fmtINR(selectedTeacher.grade_pay || 0)}</span>
                                    </div>
                                </div>
                                <div className="bg-primary text-white rounded-xl p-3 flex justify-between items-center shadow-md shadow-primary/20">
                                    <span className="text-sm font-medium opacity-90">Gross Pay</span>
                                    <span className="font-black text-lg">{fmtINR((selectedTeacher.basic_pay || 0) + (selectedTeacher.grade_pay || 0))}</span>
                                </div>
                            </div>
                            {/* OASIS Link */}
                            <Link
                                to={`/admin/staff/register-teacher?mode=view&id=${selectedTeacher.id}`}
                                className="flex items-center justify-center gap-2 w-full py-2.5 bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 text-sm font-bold rounded-xl transition-colors"
                            >
                                <FileText className="w-4 h-4" /> View Full OASIS Record
                            </Link>
                        </div>
                        <div className="p-4 border-t border-border grid grid-cols-3 gap-3 bg-card">
                            <button onClick={() => { setSelectedTeacher(null); setEditingTeacher(selectedTeacher); setTeacherModalOpen(true); }} className="flex items-center justify-center gap-2 bg-primary/10 hover:bg-primary/20 text-primary transition-colors rounded-xl py-2.5 text-sm font-semibold">
                                <Pencil className="w-4 h-4" /> Edit
                            </button>
                            <button onClick={() => handlePrintTeacher(selectedTeacher)} className="flex items-center justify-center gap-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition-colors rounded-xl py-2.5 text-sm font-semibold">
                                <Printer className="w-4 h-4" /> Print
                            </button>
                            <button onClick={() => handleDeleteTeacher(selectedTeacher.id, selectedTeacher.teacher_name)} className="flex items-center justify-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 transition-colors rounded-xl py-2.5 text-sm font-semibold">
                                <Trash2 className="w-4 h-4" /> Delete
                            </button>
                        </div>
                    </div>
                </>
            )}

            {/* ── Staff Detail Slideover ─────────────────── */}
            {selectedStaff && (
                <>
                    <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden" onClick={() => setSelectedStaff(null)} />
                    <div className="fixed right-0 top-0 h-full z-50 w-[22rem] lg:w-[24rem] bg-card border-l border-border animate-fade-in flex flex-col shadow-2xl overflow-hidden">
                        <div className="relative gradient-primary p-6 pb-8">
                            <button onClick={() => setSelectedStaff(null)} className="absolute top-4 right-4 p-1.5 rounded-lg bg-white/20 hover:bg-white/30 transition-colors">
                                <X className="w-4 h-4 text-white" />
                            </button>
                            <div className="flex flex-col items-center gap-3 mt-4">
                                <div className="w-20 h-20 rounded-full bg-white/20 border-4 border-white/40 flex items-center justify-center text-white text-3xl font-black shadow-lg">
                                    {getInitials(selectedStaff.name)}
                                </div>
                                <div className="text-center">
                                    <h2 className="font-bold text-white text-xl leading-tight">{selectedStaff.name}</h2>
                                    <p className="text-white/80 font-medium text-sm mt-1">{selectedStaff.designation}</p>
                                </div>
                                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mt-2 ${selectedStaff.status === 'active' ? 'bg-emerald-400/30 text-emerald-50 border border-emerald-300/40' : 'bg-red-400/30 text-red-50 border border-red-300/40'}`}>
                                    {selectedStaff.status === 'active' ? 'Active Employee' : 'Inactive / Former'}
                                </span>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-5 space-y-4">
                            <div className="bg-muted/40 rounded-2xl p-4 space-y-3">
                                <div className="flex items-center gap-2 mb-2">
                                    <GraduationCap className="w-4 h-4 text-primary" />
                                    <h3 className="font-bold text-xs uppercase tracking-widest text-muted-foreground">Professional Info</h3>
                                </div>
                                {[
                                    ['Qualification', selectedStaff.qualification],
                                    ['Training Status', selectedStaff.trained_status],
                                    ['Date of Birth', formatDate(selectedStaff.dob)],
                                    ['Appointment Date', formatDate(selectedStaff.appointment_date)],
                                ].filter(([, val]) => val && val !== '—').map(([label, val]) => (
                                    <div key={label} className="flex justify-between items-center text-sm border-b border-border/50 pb-2 last:border-0 last:pb-0">
                                        <span className="text-muted-foreground">{label}</span>
                                        <span className="font-medium text-foreground text-right">{val}</span>
                                    </div>
                                ))}
                            </div>
                            {(selectedStaff.fathers_spouse_name || selectedStaff.phone || selectedStaff.address || selectedStaff.aadhar_no || selectedStaff.emergency_contact) && (
                                <div className="bg-muted/40 rounded-2xl p-4 space-y-2">
                                    <div className="flex items-center gap-2 mb-2">
                                        <UserCircle2 className="w-4 h-4 text-primary" />
                                        <h3 className="font-bold text-xs uppercase tracking-widest text-muted-foreground">Personal & Contact Info</h3>
                                    </div>
                                    {[
                                        ['Father / Spouse Name', selectedStaff.fathers_spouse_name],
                                        ['Phone', selectedStaff.phone],
                                        ['Emergency Contact', selectedStaff.emergency_contact],
                                        ['Aadhar No.', selectedStaff.aadhar_no],
                                        ['Address', selectedStaff.address],
                                    ].filter(([, v]) => v).map(([label, val]) => (
                                        <div key={label as string} className="flex justify-between items-start text-sm border-b border-border/50 pb-2 last:border-0 last:pb-0">
                                            <span className="text-muted-foreground flex-shrink-0">{label}</span>
                                            <span className="font-medium text-foreground text-right ml-4 break-words max-w-[55%]">{val}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <div className="bg-primary/5 border border-primary/10 rounded-2xl p-4 space-y-3">
                                <div className="flex items-center gap-2 mb-2">
                                    <IndianRupee className="w-4 h-4 text-primary" />
                                    <h3 className="font-bold text-xs uppercase tracking-widest text-primary">Payroll Summary</h3>
                                </div>
                                <div className="grid grid-cols-2 gap-3 mb-2">
                                    <div className="bg-background rounded-xl p-3 border border-primary/10">
                                        <span className="text-xs text-muted-foreground block mb-1">Basic Pay</span>
                                        <span className="font-bold">{fmtINR(selectedStaff.basic_pay || 0)}</span>
                                    </div>
                                    <div className="bg-background rounded-xl p-3 border border-primary/10">
                                        <span className="text-xs text-muted-foreground block mb-1">Grade Pay</span>
                                        <span className="font-bold">{fmtINR(selectedStaff.grade_pay || 0)}</span>
                                    </div>
                                </div>
                                <div className="bg-primary text-white rounded-xl p-3 flex justify-between items-center shadow-md shadow-primary/20">
                                    <span className="text-sm font-medium opacity-90">Gross Pay</span>
                                    <span className="font-black text-lg">{fmtINR((selectedStaff.basic_pay || 0) + (selectedStaff.grade_pay || 0))}</span>
                                </div>
                            </div>
                        </div>
                        <div className="p-4 border-t border-border grid grid-cols-3 gap-3 bg-card">
                            <button onClick={() => { const s = selectedStaff; setSelectedStaff(null); openEditModal(s); }} className="flex items-center justify-center gap-2 bg-primary/10 hover:bg-primary/20 text-primary transition-colors rounded-xl py-2.5 text-sm font-semibold">
                                <Pencil className="w-4 h-4" /> Edit
                            </button>
                            <button onClick={() => handlePrintStaff(selectedStaff)} className="flex items-center justify-center gap-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition-colors rounded-xl py-2.5 text-sm font-semibold">
                                <Printer className="w-4 h-4" /> Print
                            </button>
                            <button onClick={() => setSelectedStaff(null)} className="flex items-center justify-center gap-2 border border-border hover:bg-muted text-foreground transition-colors rounded-xl py-2.5 text-sm font-semibold">
                                <X className="w-4 h-4" /> Close
                            </button>
                        </div>
                    </div>
                </>
            )}

            {/* Staff Modal */}
            {modalOpen && (
                <StaffModal 
                    editing={editingStaff} 
                    onClose={() => setModalOpen(false)} 
                    onSaved={() => { setModalOpen(false); loadStaff(); }} 
                />
            )}

            {/* Teacher Modal */}
            {teacherModalOpen && (
                <TeacherModal
                    editing={editingTeacher}
                    onClose={() => setTeacherModalOpen(false)}
                    onSaved={() => { setTeacherModalOpen(false); loadTeachers(); }}
                />
            )}

            {/* Hidden Print Area */}
            <div id="staff-print-area" style={{ display: 'none' }} />
            <style>{`
                @media print {
                    body * { visibility: hidden !important; }
                    #staff-print-area, #staff-print-area * { visibility: visible !important; }
                    #staff-print-area {
                        position: absolute !important; left: 0 !important; top: 0 !important;
                        width: 100% !important; display: block !important;
                        -webkit-print-color-adjust: exact; print-color-adjust: exact;
                    }
                }
            `}</style>
        </AppShell>
    );
}

// ─── Modal Form Component ────────────────────────────────────────────────────────

function StaffModal({ editing, onClose, onSaved }: { editing: StaffProfile | null, onClose: () => void, onSaved: () => void }) {
    const defaultForm = React.useMemo(() => ({
        name: '', fathers_spouse_name: '', dob: '', qualification: '', designation: 'Clerk', appointment_date: new Date().toISOString().split('T')[0], teaching_subject: '', trained_status: 'Trained' as 'Trained'|'Untrained', basic_pay: 9300, grade_pay: 4200, status: 'active' as 'active'|'inactive',
        phone: '', address: '', aadhar_no: '', emergency_contact: ''
    }), []);

    const [form, setForm] = useState(editing || defaultForm);
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState('');

    const set = (f: keyof typeof form, v: any) => {
        setForm(prev => {
            const next = { ...prev, [f]: v };
            return next;
        });
    };

    const save = async () => {
        if (!form.name || !form.designation) {
            setErr('Name and Designation are required.');
            return;
        }

        setSaving(true);
        setErr('');

        const payload = {
            name: form.name, fathers_spouse_name: form.fathers_spouse_name || null, dob: form.dob || null, qualification: form.qualification || null, designation: form.designation, appointment_date: form.appointment_date || null, teaching_subject: form.teaching_subject || null, trained_status: form.trained_status || null, basic_pay: Number(form.basic_pay) || 0, grade_pay: Number(form.grade_pay) || 0, status: form.status,
            phone: form.phone || null, address: form.address || null, aadhar_no: form.aadhar_no || null, emergency_contact: form.emergency_contact || null
        };

        let dbErr;
        if (editing) {
            const { error } = await supabase.from('staff_profiles').update(payload).eq('id', editing.id);
            dbErr = error;
        } else {
            const { error } = await supabase.from('staff_profiles').insert([payload]);
            dbErr = error;
        }

        setSaving(false);
        if (dbErr) setErr(dbErr.message);
        else onSaved();
    };

    const iC = "w-full px-3 py-2 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30";
    const lC = "text-xs font-semibold text-muted-foreground mb-1 block";

    return (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 lg:p-0 animate-fade-in" onClick={onClose}>
            <div className="bg-card w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                
                <div className="flex items-center justify-between p-5 border-b border-border bg-muted/20">
                    <h2 className="text-lg font-bold text-foreground">{editing ? 'Edit Staff Profile' : 'Add New Staff'}</h2>
                    <button onClick={onClose} className="p-2 rounded-xl border border-border bg-background hover:bg-muted transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto space-y-6">
                    {err && <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600 font-medium">{err}</div>}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                            <label className={lC}>Full Name *</label>
                            <input value={form.name} onChange={e => set('name', e.target.value)} className={iC} placeholder="e.g. Miss Swati Chouhan" />
                        </div>
                        <div>
                            <label className={lC}>Father / Spouse Name</label>
                            <input value={form.fathers_spouse_name} onChange={e => set('fathers_spouse_name', e.target.value)} className={iC} placeholder="Optional" />
                        </div>
                        <div>
                            <label className={lC}>Date of Birth</label>
                            <input type="date" value={form.dob || ''} onChange={e => set('dob', e.target.value)} className={iC} />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-border">
                        <div>
                            <label className={lC}>Designation *</label>
                            <select value={(form as any)._custom_designation ? 'Other' : (DESIGNATIONS.includes(form.designation) ? form.designation : 'Other')} 
                                onChange={e => {
                                    if(e.target.value === 'Other') {
                                        setForm(p => ({...p, _custom_designation: true}));
                                    } else {
                                        setForm(p => ({...p, _custom_designation: false, designation: e.target.value}));
                                    }
                                }} className={iC}>
                                {DESIGNATIONS.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                            {(form as any)._custom_designation || (!DESIGNATIONS.includes(form.designation) && form.designation !== defaultForm.designation) ? (
                                <input value={form.designation} onChange={e => set('designation', e.target.value)} className={`${iC} mt-2`} placeholder="Type custom designation..." autoFocus />
                            ) : null}
                        </div>
                        <div>
                            <label className={lC}>Qualification</label>
                            <input value={form.qualification} onChange={e => set('qualification', e.target.value)} className={iC} placeholder="e.g. B.Sc. M.A., B.Ed" />
                        </div>
                        <div className="flex flex-col gap-2">
                            <label className={lC}>Training Status</label>
                            <div className="flex gap-2">
                                <button type="button" onClick={() => set('trained_status', 'Trained')} className={`flex-1 py-1.5 rounded-lg text-sm font-medium border ${form.trained_status === 'Trained' ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground'}`}>Trained</button>
                                <button type="button" onClick={() => set('trained_status', 'Untrained')} className={`flex-1 py-1.5 rounded-lg text-sm font-medium border ${form.trained_status === 'Untrained' ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground'}`}>Untrained</button>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-4 border-t border-border">
                         <div>
                            <label className={lC}>Appointment Date</label>
                            <input type="date" value={form.appointment_date || ''} onChange={e => set('appointment_date', e.target.value)} className={iC} />
                        </div>
                        <div>
                            <label className={lC}>Basic Pay (₹)</label>
                            <input type="number" value={form.basic_pay} onChange={e => set('basic_pay', e.target.value)} className={iC} />
                        </div>
                        <div>
                            <label className={lC}>Grade Pay (₹)</label>
                            <input type="number" value={form.grade_pay} onChange={e => set('grade_pay', e.target.value)} className={iC} />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-border">
                        <div>
                            <label className={lC}>Phone Number</label>
                            <input type="tel" value={(form as any).phone || ''} onChange={e => set('phone', e.target.value)} className={iC} placeholder="10-digit mobile" />
                        </div>
                        <div>
                            <label className={lC}>Emergency Contact</label>
                            <input type="tel" value={(form as any).emergency_contact || ''} onChange={e => set('emergency_contact', e.target.value)} className={iC} placeholder="Emergency contact number" />
                        </div>
                        <div>
                            <label className={lC}>Aadhar No.</label>
                            <input value={(form as any).aadhar_no || ''} onChange={e => set('aadhar_no', e.target.value)} className={iC} placeholder="XXXX-XXXX-XXXX" />
                        </div>
                        <div>
                            <label className={lC}>Address</label>
                            <input value={(form as any).address || ''} onChange={e => set('address', e.target.value)} className={iC} placeholder="Full residential address" />
                        </div>
                    </div>

                    <div className="bg-primary/5 rounded-xl border border-primary/20 p-4 flex gap-4 items-center">
                        <div className="flex-1">
                            <label className={lC}>Employment Status</label>
                             <select value={form.status} onChange={e => set('status', e.target.value)} className={iC}>
                                <option value="active">Active Employee</option>
                                <option value="inactive">Former / Inactive</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="p-5 border-t border-border bg-muted/20 flex justify-end gap-3">
                    <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-sm font-medium border border-border bg-background hover:bg-muted transition-colors">Cancel</button>
                    <button onClick={save} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium gradient-primary text-white shadow-lg hover:opacity-90 disabled:opacity-60 transition-all">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        {saving ? 'Saving...' : 'Save Profile'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Teacher Quick-Add Modal ──────────────────────────────────────────────────

function TeacherModal({ editing, onClose, onSaved }: { editing: TeacherRecord | null, onClose: () => void, onSaved: () => void }) {
    const defaultForm = {
        teacher_code: '', teacher_name: '', mobile_number: '', email_id: '', school_email: '',
        dob: '', gender: '', designation: 'P.R.T.', teacher_qualification: '', highest_qualification: '',
        nature_of_appointment: 'REGULAR', date_of_joining: '', appointed_subject: '',
        main_subject_taught: '', class_teacher: '', basic_pay: 9300, grade_pay: 4200,
        aadhar_no: '', trained_or_untrained: 'Trained', fathers_spouse_name: '',
        emergency_contact: '', address: '',
    };

    const [form, setForm] = useState<any>(editing ? {
        ...defaultForm, ...editing,
        dob: editing.dob ? editing.dob.split('T')[0] : '',
        date_of_joining: editing.date_of_joining ? editing.date_of_joining.split('T')[0] : '',
    } : defaultForm);
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState('');

    const set = (f: string, v: any) => setForm((p: any) => ({ ...p, [f]: v }));

    const save = async () => {
        if (!form.teacher_name) { setErr('Teacher Name is required.'); return; }
        setSaving(true); setErr('');
        const payload = { ...form };
        if (!payload.dob) delete payload.dob;
        if (!payload.date_of_joining) delete payload.date_of_joining;

        let dbErr;
        if (editing) {
            const { error } = await supabase.from('teacher_registrations').update(payload).eq('id', editing.id);
            dbErr = error;
        } else {
            const { error } = await supabase.from('teacher_registrations').insert([payload]);
            dbErr = error;
        }
        setSaving(false);
        if (dbErr) setErr(dbErr.message); else onSaved();
    };

    const iC = "w-full px-3 py-2 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30";
    const lC = "text-xs font-semibold text-muted-foreground mb-1 block";

    return (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-card w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between p-5 border-b border-border bg-indigo-50/50">
                    <div>
                        <h2 className="text-lg font-bold text-foreground">{editing ? 'Edit Teacher Profile' : 'Add New Teacher'}</h2>
                        <p className="text-xs text-muted-foreground mt-0.5">Saved to Teacher Registration (OASIS)</p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-xl border border-border bg-background hover:bg-muted transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto space-y-5">
                    {err && <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600 font-medium">{err}</div>}

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className={lC}>Teacher Code</label>
                            <input value={form.teacher_code} onChange={e => set('teacher_code', e.target.value)} className={iC} placeholder="e.g. 080" />
                        </div>
                        <div className="md:col-span-2">
                            <label className={lC}>Full Name *</label>
                            <input value={form.teacher_name} onChange={e => set('teacher_name', e.target.value)} className={iC} placeholder="e.g. MR. SANJEEV KUMAR" />
                        </div>
                        <div className="md:col-span-2">
                            <label className={lC}>Father / Spouse Name</label>
                            <input value={form.fathers_spouse_name} onChange={e => set('fathers_spouse_name', e.target.value)} className={iC} placeholder="Optional" />
                        </div>
                        <div>
                            <label className={lC}>Date of Birth</label>
                            <input type="date" value={form.dob} onChange={e => set('dob', e.target.value)} className={iC} />
                        </div>
                        <div>
                            <label className={lC}>Gender</label>
                            <select value={form.gender} onChange={e => set('gender', e.target.value)} className={iC}>
                                <option value="">Select</option>
                                <option value="MALE">Male</option>
                                <option value="FEMALE">Female</option>
                            </select>
                        </div>
                        <div>
                            <label className={lC}>Designation</label>
                            <select value={form.designation} onChange={e => set('designation', e.target.value)} className={iC}>
                                {['P.R.T.', 'T.G.T.', 'P.G.T.', 'Principal', 'Vice Principal', 'Librarian', 'P.T.I.', 'Music Teacher'].map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className={lC}>Qualification</label>
                            <input value={form.teacher_qualification} onChange={e => set('teacher_qualification', e.target.value)} className={iC} placeholder="e.g. B.A./B.Ed." />
                        </div>
                        <div>
                            <label className={lC}>Teaching Subject</label>
                            <input value={form.main_subject_taught} onChange={e => set('main_subject_taught', e.target.value)} className={iC} placeholder="e.g. Mathematics" />
                        </div>
                        <div>
                            <label className={lC}>Class Teacher Of</label>
                            <input value={form.class_teacher} onChange={e => set('class_teacher', e.target.value)} className={iC} placeholder="e.g. Class V-A" />
                        </div>
                        <div>
                            <label className={lC}>Appointment Date</label>
                            <input type="date" value={form.date_of_joining} onChange={e => set('date_of_joining', e.target.value)} className={iC} />
                        </div>
                        <div>
                            <label className={lC}>Basic Pay (₹)</label>
                            <input type="number" value={form.basic_pay} onChange={e => set('basic_pay', e.target.value)} className={iC} />
                        </div>
                        <div>
                            <label className={lC}>Grade Pay (₹)</label>
                            <input type="number" value={form.grade_pay} onChange={e => set('grade_pay', e.target.value)} className={iC} />
                        </div>
                        <div>
                            <label className={lC}>Aadhar Number</label>
                            <input value={form.aadhar_no} onChange={e => set('aadhar_no', e.target.value)} className={iC} placeholder="XXXX-XXXX-XXXX" />
                        </div>
                        <div>
                            <label className={lC}>School Email</label>
                            <input type="email" value={form.school_email} onChange={e => set('school_email', e.target.value)} className={iC} placeholder="name@school.edu.in" />
                        </div>
                        <div>
                            <label className={lC}>Mobile Number</label>
                            <input value={form.mobile_number} onChange={e => set('mobile_number', e.target.value)} className={iC} placeholder="10-digit mobile" />
                        </div>
                        <div>
                            <label className={lC}>Emergency Contact</label>
                            <input type="tel" value={form.emergency_contact} onChange={e => set('emergency_contact', e.target.value)} className={iC} placeholder="Emergency contact number" />
                        </div>
                        <div className="md:col-span-3">
                            <label className={lC}>Address</label>
                            <input value={form.address} onChange={e => set('address', e.target.value)} className={iC} placeholder="Residential address" />
                        </div>
                    </div>

                    <div className="bg-primary/5 rounded-xl border border-primary/20 p-4">
                        <label className={lC}>Training Status</label>
                        <div className="flex gap-2 mt-1">
                            {['Trained', 'Untrained'].map(s => (
                                <button key={s} type="button" onClick={() => set('trained_or_untrained', s)}
                                    className={`flex-1 py-1.5 rounded-lg text-sm font-medium border ${
                                        form.trained_or_untrained === s ? 'bg-primary text-white border-primary' : 'bg-background text-muted-foreground border-border'
                                    }`}>{s}</button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="p-5 border-t border-border bg-muted/20 flex justify-end gap-3">
                    <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-sm font-medium border border-border bg-background hover:bg-muted transition-colors">Cancel</button>
                    <button onClick={save} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium gradient-primary text-white shadow-lg hover:opacity-90 disabled:opacity-60 transition-all">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        {saving ? 'Saving...' : (editing ? 'Update Teacher' : 'Save Teacher')}
                    </button>
                </div>
            </div>
        </div>
    );
}
