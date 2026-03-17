import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '@/components/layout/AppShell';
import { supabase } from '@/config/supabaseClient';
import { Search, Filter, Eye, Trash2, Users, Pencil, X, UserPlus, Save, Mail, Download } from 'lucide-react';
import type { Student } from '@/types';
import * as XLSX from 'xlsx';

const CLASSES = ['All', 'Nursery', 'NUR A', 'NUR B', 'LKG', 'LKG A', 'LKG B', 'UKG', 'UKG A', 'UKG B', 'ONE A', 'ONE B', 'TWO A', 'TWO B', 'THREE A', 'THREE B', 'FOUR A', 'FOUR B', 'FIVE  A', 'FIVE  B', 'SIX A', 'SIX B', 'SEVEN A', 'SEVEN B', 'EIGHT', 'NINE', 'TEN', 'TC', 'LS'];

function getInitials(name: string) {
    return name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();
}

function formatDate(d?: string) {
    if (!d) return '—';
    try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
    catch { return d; }
}

// ── RTE Badge ──────────────────────────────────────────────────────────────
function RteBadge({ rte }: { rte?: string }) {
    if (!rte) return <span className="px-2 py-0.5 rounded-full text-xs font-medium border bg-muted/40 text-muted-foreground border-border">—</span>;
    const isRte = ['yes', 'rte', 'YES', 'RTE'].includes(rte);
    return isRte
        ? <span className="px-2 py-0.5 rounded-full text-xs font-semibold border bg-emerald-50 text-emerald-700 border-emerald-300">✓ RTE</span>
        : <span className="px-2 py-0.5 rounded-full text-xs font-medium border bg-muted/40 text-muted-foreground border-border">No RTE</span>;
}

// ── Edit Modal ──────────────────────────────────────────────────────────────
interface EditModalProps {
    student: Student;
    onClose: () => void;
    onSaved: (updated: Student) => void;
}

const EMPTY_EDIT: Partial<Student> = {};

function EditModal({ student, onClose, onSaved }: EditModalProps) {
    const [form, setForm] = useState<Partial<Student>>({ ...student });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const set = (field: keyof Student, value: string) => setForm(f => ({ ...f, [field]: value }));

    const handleSave = async () => {
        setSaving(true);
        setError('');
        try {
            const { data, error: err } = await supabase
                .from('students')
                .update({
                    name: form.name,
                    class: form.class,
                    roll_no: form.roll_no,
                    dob: form.dob || null,
                    admission_date: form.admission_date || null,
                    gender: form.gender,
                    mother_name: form.mother_name,
                    father_name: form.father_name,
                    address: form.address,
                    phone: form.phone,
                    email: form.email,
                    whatsapp: form.whatsapp,
                    aadhar_card: form.aadhar_card,
                    pen_no: form.pen_no,
                    caste: form.caste,
                    religion: form.religion,
                    blood_group: form.blood_group,
                    rte: form.rte,
                    occupation: form.occupation,
                    nationality: form.nationality,
                    house: form.house,
                    status: form.status,
                })
                .eq('sr_no', student.sr_no)
                .select()
                .single();
            if (err) throw err;
            onSaved(data as Student);
        } catch (e: any) {
            setError(e.message || 'Save failed');
        } finally {
            setSaving(false);
        }
    };

    const field = (label: string, key: keyof Student, type = 'text') => (
        <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">{label}</label>
            <input
                type={type}
                value={(form[key] as string) || ''}
                onChange={e => set(key, e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
        </div>
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
            <div
                className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 animate-fade-in"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between mb-5">
                    <div>
                        <h2 className="text-lg font-semibold text-foreground">Edit Student</h2>
                        <p className="text-xs text-muted-foreground">SR No. {student.sr_no}</p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted transition-colors"><X className="w-4 h-4" /></button>
                </div>

                {/* Form Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {field('Full Name', 'name')}
                    {field('Roll No.', 'roll_no')}

                    {/* Class select */}
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-muted-foreground">Class</label>
                        <select
                            value={form.class || ''}
                            onChange={e => set('class', e.target.value)}
                            className="px-3 py-1.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                        >
                            {CLASSES.filter(c => c !== 'All').map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>

                    {/* Gender select */}
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-muted-foreground">Gender</label>
                        <select
                            value={form.gender || ''}
                            onChange={e => set('gender', e.target.value)}
                            className="px-3 py-1.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                        >
                            <option value="male">Male</option>
                            <option value="female">Female</option>
                            <option value="other">Other</option>
                        </select>
                    </div>

                    {field('Date of Birth', 'dob', 'date')}
                    {field('Admission Date', 'admission_date', 'date')}
                    {field("Father's Name", 'father_name')}
                    {field("Mother's Name", 'mother_name')}
                    {field('Phone', 'phone', 'tel')}
                    {field('Email Address', 'email', 'email')}
                    {field('WhatsApp', 'whatsapp', 'tel')}
                    {field('Aadhar Card', 'aadhar_card')}
                    {field('PEN No.', 'pen_no')}
                    {field('Caste', 'caste')}
                    {field('Religion', 'religion')}
                    {field('Blood Group', 'blood_group')}
                    {field('Occupation', 'occupation')}
                    {field('Nationality', 'nationality')}

                    {/* House */}
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-muted-foreground">House</label>
                        <select
                            value={form.house || ''}
                            onChange={e => set('house', e.target.value)}
                            className="px-3 py-1.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                        >
                            <option value="">Select House</option>
                            <option value="Jal">Jal</option>
                            <option value="Akash">Akash</option>
                            <option value="Vayu">Vayu</option>
                            <option value="Prithvi">Prithvi</option>
                        </select>
                    </div>

                    {/* Status */}
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-muted-foreground">Status</label>
                        <select
                            value={form.status || 'active'}
                            onChange={e => set('status', e.target.value)}
                            className="px-3 py-1.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                        >
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                            <option value="transferred">Transferred (TC)</option>
                        </select>
                    </div>

                    {/* RTE toggle */}
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-muted-foreground">RTE Student</label>
                        <div className="flex gap-2 mt-1">
                            {(['YES', 'NO'] as const).map(v => {
                                const active = (form.rte || '').toUpperCase() === v;
                                return (
                                    <button
                                        key={v}
                                        type="button"
                                        onClick={() => set('rte', v)}
                                        className={`flex-1 py-1.5 rounded-lg text-sm font-medium border transition-all ${active && v === 'YES'
                                            ? 'bg-emerald-600 text-white border-emerald-600'
                                            : active && v === 'NO'
                                                ? 'bg-muted text-foreground border-border'
                                                : 'bg-background text-muted-foreground border-border hover:border-primary/40'}`}
                                    >
                                        {v === 'YES' ? '✓ RTE' : 'Not RTE'}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Address — full width */}
                    <div className="flex flex-col gap-1 sm:col-span-2">
                        <label className="text-xs font-medium text-muted-foreground">Address</label>
                        <textarea
                            value={form.address || ''}
                            onChange={e => set('address', e.target.value)}
                            rows={2}
                            className="px-3 py-1.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                        />
                    </div>
                </div>

                {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

                {/* Footer */}
                <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-border">
                    <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm border border-border hover:bg-muted transition-colors">Cancel</button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-medium gradient-primary text-white disabled:opacity-60 transition-all hover:opacity-90"
                    >
                        <Save className="w-4 h-4" />
                        {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Main Component ──────────────────────────────────────────────────────────
const StudentDirectory: React.FC = () => {
    const navigate = useNavigate();
    const [students, setStudents] = useState<Student[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [classFilter, setClassFilter] = useState('All');
    const [statusFilter, setStatusFilter] = useState('active');
    const [rteFilter, setRteFilter] = useState('All');
    const [selected, setSelected] = useState<Student | null>(null);
    const [editing, setEditing] = useState<Student | null>(null);

    useEffect(() => {
        const fetchAll = async () => {
            setLoading(true);
            try {
                let all: Student[] = [];
                const PAGE = 1000;
                let from = 0;
                while (true) {
                    let q = supabase
                        .from('students')
                        .select('*')
                        .order('sr_no')
                        .range(from, from + PAGE - 1);
                    if (statusFilter !== 'All') q = q.eq('status', statusFilter);
                    const { data, error } = await q;
                    if (error) throw error;
                    if (!data || data.length === 0) break;
                    all = [...all, ...data];
                    if (data.length < PAGE) break;   // last page
                    from += PAGE;
                }
                setStudents(all);
            } catch (err: any) {
                console.error('Fetch error:', err);
                setStudents([]);
            } finally {
                setLoading(false);
            }
        };
        fetchAll();
    }, [statusFilter]);

    const filtered = students.filter((s) => {
        const q = search.trim().toLowerCase();
        const matchSearch = !q ||
            String(s.sr_no) === q ||                        // exact SR No. match
            s.name.toLowerCase().includes(q);               // name partial match
        const matchClass = classFilter === 'All' || (s.class || '').toLowerCase() === classFilter.toLowerCase();
        const matchRte = rteFilter === 'All'
            || (rteFilter === 'YES' && ['yes', 'YES', 'rte', 'RTE'].includes(s.rte || ''))
            || (rteFilter === 'NO' && !['yes', 'YES', 'rte', 'RTE'].includes(s.rte || ''));
        return matchSearch && matchClass && matchRte;
    });

    const handleDelete = async (sr_no: number) => {
        if (!window.confirm('Remove this student?')) return;
        try {
            const { error } = await supabase.from('students').delete().eq('sr_no', sr_no);
            if (error) throw error;
            setStudents(prev => prev.filter(s => s.sr_no !== sr_no));
            if (selected?.sr_no === sr_no) setSelected(null);
        } catch (err: any) {
            alert(err.message || 'Delete failed.');
        }
    };

    const handleSaved = (updated: Student) => {
        setStudents(prev => prev.map(s => s.sr_no === updated.sr_no ? updated : s));
        if (selected?.sr_no === updated.sr_no) setSelected(updated);
        setEditing(null);
    };

    const downloadExcel = () => {
        const rows = filtered.map(s => ({
            'SR No.': s.sr_no,
            'Roll No.': s.roll_no || '',
            'Name': s.name,
            'Class': s.class || '',
            'Gender': s.gender,
            'Date of Birth': s.dob || '',
            'Admission Date': s.admission_date || '',
            "Father's Name": s.father_name || '',
            "Mother's Name": s.mother_name || '',
            'Phone': s.phone || '',
            'Email': s.email || '',
            'WhatsApp': s.whatsapp || '',
            'Address': s.address || '',
            'Aadhar Card': s.aadhar_card || '',
            'PEN No.': s.pen_no || '',
            'Caste': s.caste || '',
            'Religion': s.religion || '',
            'Blood Group': s.blood_group || '',
            'RTE': s.rte || '',
            'Occupation': s.occupation || '',
            'Nationality': s.nationality || '',
            'House': s.house || '',
            'Status': s.status,
        }));
        const worksheet = XLSX.utils.json_to_sheet(rows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Students');
        const fileName = `students_${classFilter !== 'All' ? classFilter + '_' : ''}${statusFilter}_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(workbook, fileName);
    };

    const statusBadge = (status: string) => {
        const map: Record<string, string> = {
            active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
            inactive: 'bg-yellow-50  text-yellow-700  border-yellow-200',
            transferred: 'bg-red-50     text-red-700     border-red-200',
        };
        return `px-2 py-0.5 rounded-full text-xs font-medium border ${map[status] || 'bg-muted text-muted-foreground'}`;
    };

    return (
        <AppShell title="Student Directory" subtitle={`${filtered.length} students`}>

            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row gap-3 mb-6 items-start sm:items-center">
                {/* Search */}
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search by name, SR no., father's name or phone..."
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
                    />
                </div>
                {/* Class filter */}
                <div className="relative">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <select
                        value={classFilter}
                        onChange={(e) => setClassFilter(e.target.value)}
                        className="pl-10 pr-4 py-2.5 rounded-xl border border-input bg-background text-sm appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/40"
                    >
                        {CLASSES.map((c) => <option key={c}>{c}</option>)}
                    </select>
                </div>
                {/* Status filter */}
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-4 py-2.5 rounded-xl border border-input bg-background text-sm appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                    <option value="All">All Status</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="transferred">Transferred (TC)</option>
                </select>
                {/* RTE filter */}
                <select
                    value={rteFilter}
                    onChange={(e) => setRteFilter(e.target.value)}
                    className="px-4 py-2.5 rounded-xl border border-input bg-background text-sm appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                    <option value="All">All RTE</option>
                    <option value="YES">✓ RTE Only</option>
                    <option value="NO">Non-RTE Only</option>
                </select>
                {/* Email All Button */}
                <button
                    onClick={() => {
                        const emails = filtered.map(s => s.email).filter(Boolean);
                        if (emails.length === 0) return alert('No students found with an email address in the current filter.');
                        window.location.href = `mailto:?bcc=${emails.join(',')}`;
                    }}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-card text-foreground text-sm font-medium hover:bg-muted transition-all flex-shrink-0"
                    title="Send an email (BCC) to all visible students"
                >
                    <Mail className="w-4 h-4" />
                    <span className="hidden lg:inline">Email All</span>
                </button>
                {/* Download Excel Button */}
                <button
                    onClick={downloadExcel}
                    disabled={filtered.length === 0}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-emerald-500/40 bg-emerald-50 text-emerald-700 text-sm font-medium hover:bg-emerald-100 transition-all flex-shrink-0 disabled:opacity-40"
                    title={`Download ${filtered.length} students as Excel`}
                >
                    <Download className="w-4 h-4" />
                    <span className="hidden lg:inline">Excel ({filtered.length})</span>
                </button>
                {/* Register New Student */}
                <button
                    onClick={() => navigate('/admin/students/register')}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl gradient-primary text-white text-sm font-medium hover:opacity-90 transition-all flex-shrink-0"
                >
                    <UserPlus className="w-4 h-4" />
                    Register Student
                </button>
            </div>

            <div className="flex gap-6 relative">
                {/* Table */}
                <div className="flex-1 bg-card border border-border rounded-2xl overflow-hidden">
                    {loading ? (
                        <div className="p-12 text-center text-muted-foreground">Loading students...</div>
                    ) : filtered.length === 0 ? (
                        <div className="p-12 text-center">
                            <Users className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
                            <p className="text-muted-foreground">No students found</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-border bg-muted/40">
                                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">SR No.</th>
                                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Student</th>
                                        <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Father's Name</th>
                                        <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Class</th>
                                        <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Phone</th>
                                        <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">RTE</th>
                                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                                        <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map((s) => (
                                        <tr
                                            key={s.sr_no}
                                            className={`border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer ${selected?.sr_no === s.sr_no ? 'bg-primary/5' : ''}`}
                                            onClick={() => setSelected(s)}
                                        >
                                            <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{s.sr_no}</td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                                                        {getInitials(s.name)}
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-foreground">{s.name}</p>
                                                        {s.roll_no && s.roll_no !== '0' && <p className="text-xs text-muted-foreground">Roll: {s.roll_no}</p>}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{s.father_name || '—'}</td>
                                            <td className="px-4 py-3 text-muted-foreground hidden md:table-cell capitalize">{s.class || '—'}</td>
                                            <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">{s.phone || '—'}</td>
                                            <td className="px-4 py-3 hidden lg:table-cell"><RteBadge rte={s.rte} /></td>
                                            <td className="px-4 py-3">
                                                <span className={statusBadge(s.status)}>{s.status}</span>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setSelected(s); }}
                                                        className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                                                        title="View details"
                                                    >
                                                        <Eye className="w-4 h-4 text-muted-foreground" />
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setEditing(s); }}
                                                        className="p-1.5 rounded-lg hover:bg-blue-50 transition-colors"
                                                        title="Edit student"
                                                    >
                                                        <Pencil className="w-4 h-4 text-blue-500" />
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleDelete(s.sr_no); }}
                                                        className="p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                                                        title="Delete"
                                                    >
                                                        <Trash2 className="w-4 h-4 text-red-400" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Detail Panel — slide-over on all screens */}
                {selected && (
                    <>
                        {/* Backdrop for mobile */}
                        <div
                            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
                            onClick={() => setSelected(null)}
                        />
                        <div className="fixed right-0 top-0 h-full z-50 w-[22rem] lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:z-auto bg-card border-l lg:border border-border lg:rounded-3xl animate-fade-in overflow-y-auto shadow-2xl lg:shadow-md flex flex-col overflow-hidden">

                            {/* ── Hero Header ── */}
                            <div className="relative gradient-primary p-5 pb-10">
                                <button
                                    onClick={() => setSelected(null)}
                                    className="absolute top-4 right-4 p-1.5 rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
                                >
                                    <X className="w-4 h-4 text-white" />
                                </button>
                                <div className="flex flex-col items-center gap-2">
                                    <div className="w-16 h-16 rounded-full bg-white/20 border-2 border-white/40 flex items-center justify-center text-white text-2xl font-black shadow-lg">
                                        {getInitials(selected.name)}
                                    </div>
                                    <div className="text-center">
                                        <h3 className="font-bold text-white text-base leading-tight">{selected.name}</h3>
                                        <p className="text-white/70 text-xs mt-0.5">SR No. {selected.sr_no}</p>
                                    </div>
                                    <div className="flex gap-2 mt-1 flex-wrap justify-center">
                                        {/* Status chip */}
                                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${selected.status === 'active' ? 'bg-emerald-400/30 text-emerald-100 border border-emerald-300/40'
                                            : selected.status === 'transferred' ? 'bg-red-400/30 text-red-100 border border-red-300/40'
                                                : 'bg-yellow-400/30 text-yellow-100 border border-yellow-300/40'
                                            }`}>
                                            {selected.status === 'transferred' ? 'TC Issued' : selected.status.charAt(0).toUpperCase() + selected.status.slice(1)}
                                        </span>
                                        {/* Gender chip */}
                                        <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-white/20 text-white/90 border border-white/30 capitalize">
                                            {selected.gender}
                                        </span>
                                        {/* RTE chip */}
                                        <RteBadge rte={selected.rte} />
                                    </div>
                                </div>
                            </div>

                            {/* ── Body ── */}
                            <div className="flex-1 p-4 space-y-4 -mt-5">

                                {/* Academic */}
                                <div className="bg-muted/40 rounded-xl p-3.5 space-y-2.5">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">Academic</p>
                                    {[
                                        ['Class', selected.class],
                                        ['Roll No.', selected.roll_no && selected.roll_no !== '0' ? selected.roll_no : null],
                                        ['Admission Date', formatDate(selected.admission_date)],
                                        ['Date of Birth', formatDate(selected.dob)],
                                        ['PEN No.', selected.pen_no],
                                        ['House', selected.house],
                                    ].filter(([, v]) => v).map(([label, val]) => (
                                        <div key={label as string} className="flex justify-between items-start gap-2">
                                            <span className="text-xs text-muted-foreground flex-shrink-0">{label}</span>
                                            <span className="text-xs font-medium text-foreground text-right">{val}</span>
                                        </div>
                                    ))}
                                </div>

                                {/* Family */}
                                <div className="bg-muted/40 rounded-xl p-3.5 space-y-2.5">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">Family</p>
                                    {[
                                        ["Father's Name", selected.father_name],
                                        ["Mother's Name", selected.mother_name],
                                        ['Caste', selected.caste],
                                        ['Religion', selected.religion],
                                        ['Occupation', selected.occupation],
                                        ['Nationality', selected.nationality],
                                        ['Blood Group', selected.blood_group],
                                    ].filter(([, v]) => v).map(([label, val]) => (
                                        <div key={label as string} className="flex justify-between items-start gap-2">
                                            <span className="text-xs text-muted-foreground flex-shrink-0">{label}</span>
                                            <span className="text-xs font-medium text-foreground text-right capitalize">{val}</span>
                                        </div>
                                    ))}
                                </div>

                                {/* Contact */}
                                {(selected.phone || selected.whatsapp || selected.address || selected.aadhar_card) && (
                                    <div className="bg-muted/40 rounded-xl p-3.5 space-y-2.5">
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">Contact & IDs</p>
                                        {[
                                            ['Email', selected.email],
                                            ['Phone', selected.phone],
                                            ['WhatsApp', selected.whatsapp],
                                            ['Aadhar Card', selected.aadhar_card],
                                            ['Address', selected.address],
                                        ].filter(([, v]) => v).map(([label, val]) => (
                                            <div key={label as string} className="flex justify-between items-start gap-2">
                                                <span className="text-xs text-muted-foreground flex-shrink-0 w-20">{label}</span>
                                                <span className="text-xs font-medium text-foreground text-right break-all">{val}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* ── Footer Buttons ── */}
                            <div className="p-4 pt-0 grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => setEditing(selected)}
                                    className="flex items-center justify-center gap-2 py-2.5 rounded-xl gradient-primary text-white text-sm font-medium hover:opacity-90 transition-all shadow-md"
                                >
                                    <Pencil className="w-3.5 h-3.5" />
                                    Edit Student
                                </button>
                                <button
                                    onClick={() => setSelected(null)}
                                    className="flex items-center justify-center gap-2 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors"
                                >
                                    <X className="w-3.5 h-3.5" />
                                    Close
                                </button>
                            </div>
                        </div>
                    </>
                )}

            </div>

            {/* Edit Modal */}
            {editing && (
                <EditModal
                    student={editing}
                    onClose={() => setEditing(null)}
                    onSaved={handleSaved}
                />
            )}
        </AppShell>
    );
};

export default StudentDirectory;

