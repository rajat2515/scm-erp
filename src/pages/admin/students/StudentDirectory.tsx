import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '@/components/layout/AppShell';
import { supabase } from '@/config/supabaseClient';
import { Search, Filter, Users, UserPlus, Download, Printer, X, Save, Pencil, GraduationCap, Phone, Mail, MapPin, User, BookOpen, Heart, Shield } from 'lucide-react';
import type { Student } from '@/types';
import * as XLSX from 'xlsx';

export const CLASSES = ['All', 'NUR A', 'NUR B', 'LKG A', 'LKG B', 'UKG A', 'UKG B', 'ONE A', 'ONE B', 'TWO A', 'TWO B', 'THREE A', 'THREE B', 'FOUR A', 'FOUR B', 'FIVE  A', 'FIVE  B', 'SIX A', 'SIX B', 'SEVEN A', 'SEVEN B', 'EIGHT', 'NINE', 'TEN', 'TC', 'LS'];

function getInitials(name: string) {
    return name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();
}

function formatDate(d?: string) {
    if (!d) return '—';
    try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
    catch { return d; }
}

// ── RTE Badge ──────────────────────────────────────────────────────────────
function RteBadge({ rte, large = false }: { rte?: string; large?: boolean }) {
    const isRte = ['yes', 'rte', 'YES', 'RTE'].includes(rte || '');
    const base = large ? 'px-3 py-1 rounded-full text-xs font-bold tracking-wide' : 'px-2 py-0.5 rounded-full text-xs font-semibold';
    if (!rte) return <span className={`${base} bg-gray-100 text-gray-400 border border-gray-200`}>—</span>;
    return isRte
        ? <span className={`${base} bg-emerald-500 text-white shadow-sm shadow-emerald-200`}>✓ RTE</span>
        : <span className={`${base} bg-muted/60 text-muted-foreground border border-border`}>No RTE</span>;
}

// ── Edit Modal ──────────────────────────────────────────────────────────────
interface EditModalProps {
    student: Student;
    onClose: () => void;
    onSaved: (updated: Student) => void;
}

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
                <div className="flex items-center justify-between mb-5">
                    <div>
                        <h2 className="text-lg font-semibold text-foreground">Edit Student</h2>
                        <p className="text-xs text-muted-foreground">SR No. {student.sr_no}</p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted transition-colors"><X className="w-4 h-4" /></button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {field('Full Name', 'name')}
                    {field('Roll No.', 'roll_no')}
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-muted-foreground">Class</label>
                        <select value={form.class || ''} onChange={e => set('class', e.target.value)} className="px-3 py-1.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
                            {CLASSES.filter(c => c !== 'All').map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-muted-foreground">Gender</label>
                        <select value={form.gender || ''} onChange={e => set('gender', e.target.value)} className="px-3 py-1.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
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
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-muted-foreground">House</label>
                        <select value={form.house || ''} onChange={e => set('house', e.target.value)} className="px-3 py-1.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
                            <option value="">Select House</option>
                            <option value="Jal">Jal</option>
                            <option value="Akash">Akash</option>
                            <option value="Vayu">Vayu</option>
                            <option value="Prithvi">Prithvi</option>
                        </select>
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-muted-foreground">Status</label>
                        <select value={form.status || 'active'} onChange={e => set('status', e.target.value)} className="px-3 py-1.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                            <option value="transferred">Transferred (TC)</option>
                        </select>
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-muted-foreground">RTE Student</label>
                        <div className="flex gap-2 mt-1">
                            {(['YES', 'NO'] as const).map(v => {
                                const active = (form.rte || '').toUpperCase() === v;
                                return (
                                    <button key={v} type="button" onClick={() => set('rte', v)}
                                        className={`flex-1 py-1.5 rounded-lg text-sm font-medium border transition-all ${active && v === 'YES' ? 'bg-emerald-600 text-white border-emerald-600' : active && v === 'NO' ? 'bg-muted text-foreground border-border' : 'bg-background text-muted-foreground border-border hover:border-primary/40'}`}>
                                        {v === 'YES' ? '✓ RTE' : 'Not RTE'}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                    <div className="flex flex-col gap-1 sm:col-span-2">
                        <label className="text-xs font-medium text-muted-foreground">Address</label>
                        <textarea value={form.address || ''} onChange={e => set('address', e.target.value)} rows={2} className="px-3 py-1.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none" />
                    </div>
                </div>
                {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
                <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-border">
                    <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm border border-border hover:bg-muted transition-colors">Cancel</button>
                    <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-medium gradient-primary text-white disabled:opacity-60 transition-all hover:opacity-90">
                        <Save className="w-4 h-4" />
                        {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Print helper (A5 with school header) ───────────────────────────────────
function printStudent(s: Student) {
    const win = window.open('', '_blank', 'width=600,height=850');
    if (!win) return;
    const fmt = (d?: string) => {
        if (!d) return '—';
        try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return d; }
    };
    const row = (label: string, val?: string | null) =>
        val ? `<tr><td style="padding:5px 10px;color:#555;font-size:12px;width:130px;border-bottom:1px solid #f0f0f0">${label}</td><td style="padding:5px 10px;font-size:12px;font-weight:500;border-bottom:1px solid #f0f0f0">${val}</td></tr>` : '';

    win.document.write(`<!DOCTYPE html><html><head><title>Student Info — ${s.name}</title>
<style>
  @page { size: A5 portrait; margin: 10mm; }
  body { font-family: 'Segoe UI', sans-serif; margin: 0; padding: 12px; background: #fff; color: #111; max-width: 148mm; }
  .school-header { display: flex; align-items: center; gap: 12px; padding-bottom: 10px; border-bottom: 2px solid #1e293b; margin-bottom: 14px; }
  .school-logo { width: 48px; height: 48px; flex-shrink: 0; }
  .school-logo img { width: 100%; height: 100%; object-fit: contain; }
  .school-info h1 { margin: 0; font-size: 16px; color: #1e293b; font-weight: 700; }
  .school-info p { margin: 1px 0 0; font-size: 10px; color: #64748b; }
  .student-header { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; padding: 10px; background: #f8fafc; border-radius: 8px; }
  .avatar { width: 44px; height: 44px; border-radius: 50%; background: linear-gradient(135deg, #6366f1, #8b5cf6); display: flex; align-items: center; justify-content: center; color: #fff; font-size: 16px; font-weight: 700; flex-shrink: 0; }
  .student-name { font-size: 15px; font-weight: 600; margin: 0; }
  .student-sub { color: #777; font-size: 11px; margin: 2px 0 0; }
  .badge { display: inline-block; padding: 1px 8px; border-radius: 20px; font-size: 10px; font-weight: 600; margin-right: 3px; }
  .rte { background: #10b981; color: #fff; } .norte { background: #eee; color: #666; }
  .active { background: #d1fae5; color: #065f46; } .inactive { background: #fef3c7; color: #92400e; }
  section { margin-bottom: 12px; } section h2 { font-size: 10px; text-transform: uppercase; letter-spacing: .08em; color: #94a3b8; margin: 0 0 4px; font-weight: 600; border-bottom: 1px solid #e2e8f0; padding-bottom: 3px; }
  table { width: 100%; border-collapse: collapse; }
  .footer { margin-top: 20px; padding-top: 8px; border-top: 1px solid #e2e8f0; font-size: 9px; color: #94a3b8; display: flex; justify-content: space-between; }
  @media print { body { padding: 0; } }
</style></head><body>
<!-- School Header -->
<div class="school-header">
  <div class="school-logo"><img src="/school-logo.png" alt="Logo" /></div>
  <div class="school-info">
    <h1>S.C.M. ACADEMY</h1>
    <p>Student Information Report</p>
  </div>
</div>
<!-- Student Info -->
<div class="student-header">
  <div class="avatar">${getInitials(s.name)}</div>
  <div>
    <p class="student-name">${s.name}</p>
    <p class="student-sub">SR No. ${s.sr_no}${s.roll_no && s.roll_no !== '0' ? ` · Roll ${s.roll_no}` : ''}</p>
    <div style="margin-top:4px">
      <span class="badge ${s.status === 'active' ? 'active' : 'inactive'}">${s.status}</span>
      <span class="badge" style="background:#ede9fe;color:#5b21b6">${s.gender ?? ''}</span>
      ${['yes','YES','rte','RTE'].includes(s.rte||'') ? '<span class="badge rte">✓ RTE</span>' : '<span class="badge norte">No RTE</span>'}
    </div>
  </div>
</div>
<section><h2>Academic</h2><table>
  ${row('Class', s.class)}${row('Admission Date', fmt(s.admission_date))}${row('Date of Birth', fmt(s.dob))}${row('PEN No.', s.pen_no)}${row('House', s.house)}
</table></section>
<section><h2>Family</h2><table>
  ${row("Father's Name", s.father_name)}${row("Mother's Name", s.mother_name)}${row('Caste', s.caste)}${row('Religion', s.religion)}${row('Occupation', s.occupation)}${row('Nationality', s.nationality)}${row('Blood Group', s.blood_group)}
</table></section>
<section><h2>Contact & IDs</h2><table>
  ${row('Email', s.email)}${row('Phone', s.phone)}${row('WhatsApp', s.whatsapp)}${row('Aadhar Card', s.aadhar_card)}${row('Address', s.address)}
</table></section>
<div class="footer">
  <span>S.C.M. Academy Management System</span>
  <span>Printed on ${new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}</span>
</div>
</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 400);
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
    const [sortConfig, setSortConfig] = useState<{ key: 'name' | 'sr_no', direction: 'asc' | 'desc' }>({ key: 'sr_no', direction: 'desc' });
    const panelRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const fetchAll = async () => {
            setLoading(true);
            try {
                let all: Student[] = [];
                const PAGE = 1000;
                let from = 0;
                while (true) {
                    let q = supabase.from('students').select('*').order('sr_no').range(from, from + PAGE - 1);
                    if (statusFilter !== 'All') q = q.eq('status', statusFilter);
                    const { data, error } = await q;
                    if (error) throw error;
                    if (!data || data.length === 0) break;
                    all = [...all, ...data];
                    if (data.length < PAGE) break;
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
        const matchSearch = !q
            || String(s.sr_no) === q
            || s.name.toLowerCase().includes(q)
            || (s.father_name || '').toLowerCase().includes(q)
            || (s.phone || '').includes(q);
        const matchClass = classFilter === 'All' || (s.class || '').toLowerCase() === classFilter.toLowerCase();
        const matchRte = rteFilter === 'All'
            || (rteFilter === 'YES' && ['yes', 'YES', 'rte', 'RTE'].includes(s.rte || ''))
            || (rteFilter === 'NO' && !['yes', 'YES', 'rte', 'RTE'].includes(s.rte || ''));
        return matchSearch && matchClass && matchRte;
    }).sort((a, b) => {
        if (sortConfig.key === 'name') {
            const res = (a.name || '').localeCompare(b.name || '');
            return sortConfig.direction === 'asc' ? res : -res;
        } else {
            const res = a.sr_no - b.sr_no;
            return sortConfig.direction === 'asc' ? res : -res;
        }
    });

    const handleSaved = (updated: Student) => {
        setStudents(prev => prev.map(s => s.sr_no === updated.sr_no ? updated : s));
        if (selected?.sr_no === updated.sr_no) setSelected(updated);
        setEditing(null);
    };

    // Toggle panel — click same row closes it
    const handleRowClick = (s: Student) => {
        if (selected?.sr_no === s.sr_no) {
            setSelected(null);
        } else {
            setSelected(s);
            setTimeout(() => panelRef.current?.scrollTo({ top: 0, behavior: 'smooth' }), 50);
        }
    };

    const downloadExcel = () => {
        const rows = filtered.map(s => ({
            'SR No.': s.sr_no, 'Roll No.': s.roll_no || '', 'Name': s.name, 'Class': s.class || '',
            'Gender': s.gender, 'Date of Birth': s.dob || '', 'Admission Date': s.admission_date || '',
            "Father's Name": s.father_name || '', "Mother's Name": s.mother_name || '',
            'Phone': s.phone || '', 'Email': s.email || '', 'WhatsApp': s.whatsapp || '',
            'Address': s.address || '', 'Aadhar Card': s.aadhar_card || '', 'PEN No.': s.pen_no || '',
            'Caste': s.caste || '', 'Religion': s.religion || '', 'Blood Group': s.blood_group || '',
            'RTE': s.rte || '', 'Occupation': s.occupation || '', 'Nationality': s.nationality || '',
            'House': s.house || '', 'Status': s.status,
        }));
        const worksheet = XLSX.utils.json_to_sheet(rows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Students');
        XLSX.writeFile(workbook, `students_${classFilter !== 'All' ? classFilter + '_' : ''}${statusFilter}_${new Date().toISOString().split('T')[0]}.xlsx`);
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
            <div className="flex flex-col sm:flex-row flex-wrap gap-3 mb-6 items-start sm:items-center">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search by name, SR no., father's name or phone..."
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
                    />
                </div>
                <div className="relative">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)} className="pl-10 pr-4 py-2.5 rounded-xl border border-input bg-background text-sm appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/40">
                        {CLASSES.map((c) => <option key={c}>{c}</option>)}
                    </select>
                </div>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-4 py-2.5 rounded-xl border border-input bg-background text-sm appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/40">
                    <option value="All">All Status</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="transferred">Transferred (TC)</option>
                </select>
                <select value={rteFilter} onChange={(e) => setRteFilter(e.target.value)} className="px-4 py-2.5 rounded-xl border border-input bg-background text-sm appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/40">
                    <option value="All">All RTE</option>
                    <option value="YES">✓ RTE Only</option>
                    <option value="NO">Non-RTE Only</option>
                </select>
                <select value={`${sortConfig.key}-${sortConfig.direction}`} onChange={(e) => { const [key, direction] = e.target.value.split('-'); setSortConfig({ key: key as 'name' | 'sr_no', direction: direction as 'asc' | 'desc' }); }} className="px-4 py-2.5 rounded-xl border border-input bg-background text-sm appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/40">
                    <option value="sr_no-asc">Sort: SR No. (Asc)</option>
                    <option value="sr_no-desc">Sort: SR No. (Desc)</option>
                    <option value="name-asc">Sort: Name (A-Z)</option>
                    <option value="name-desc">Sort: Name (Z-A)</option>
                </select>
                <button onClick={downloadExcel} disabled={filtered.length === 0} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-emerald-500/40 bg-emerald-50 text-emerald-700 text-sm font-medium hover:bg-emerald-100 transition-all flex-shrink-0 disabled:opacity-40" title={`Download ${filtered.length} students as Excel`}>
                    <Download className="w-4 h-4" />
                    <span className="hidden lg:inline">Excel ({filtered.length})</span>
                </button>
                <button onClick={() => navigate('/admin/students/register')} className="flex items-center gap-2 px-4 py-2.5 rounded-xl gradient-primary text-white text-sm font-medium hover:opacity-90 transition-all flex-shrink-0">
                    <UserPlus className="w-4 h-4" />
                    Register Student
                </button>
            </div>

            {/* Content area: table + detail overlay */}
            <div className={`flex relative transition-all duration-300`}>

                {/* ── Table ── */}
                <div className={`bg-card border border-border rounded-2xl overflow-hidden transition-all duration-300 w-full`}>
                    {loading ? (
                        <div className="p-12 text-center text-muted-foreground">Loading students...</div>
                    ) : filtered.length === 0 ? (
                        <div className="p-12 text-center">
                            <Users className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
                            <p className="text-muted-foreground">No students found</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm min-w-[600px]">
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
                                            className={`border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer select-none ${selected?.sr_no === s.sr_no ? 'bg-primary/5 border-l-2 border-l-primary' : ''}`}
                                            onClick={() => handleRowClick(s)}
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
                                                        onClick={(e) => { e.stopPropagation(); setEditing(s); }}
                                                        className="p-1.5 rounded-lg hover:bg-blue-50 transition-colors"
                                                        title="Edit student"
                                                    >
                                                        <Pencil className="w-4 h-4 text-blue-500" />
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

                {/* ── Detail Overlay (Beautiful Modal Layout) ── */}
                {selected && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/40 backdrop-blur-[2px] animate-fade-in" onClick={() => setSelected(null)}>
                        {/* Modal Card */}
                        <div
                            className="w-full max-w-5xl max-h-[95vh] flex-shrink-0
                                       bg-[#eff6ff] border border-white/20 rounded-[2rem] shadow-2xl
                                       flex flex-col relative overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* ── Hero header ── */}
                            <div className="relative overflow-hidden p-6 sm:px-10 sm:py-8 flex flex-col sm:flex-row items-center sm:items-start gap-6 flex-shrink-0 bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-800">
                                {/* Decorative circles */}
                                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
                                <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-400/20 rounded-full blur-2xl translate-y-1/3 -translate-x-1/4"></div>
                                
                                <div className="relative z-10 w-24 h-24 sm:w-28 sm:h-28 rounded-full border-4 border-white/20 flex items-center justify-center text-white text-3xl sm:text-4xl font-bold flex-shrink-0 shadow-xl bg-white/10 backdrop-blur-md">
                                    {getInitials(selected.name)}
                                </div>

                                <div className="relative z-10 flex flex-col flex-1 text-center sm:text-left pt-2 sm:pt-0">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
                                        <h3 className="font-extrabold text-white text-2xl sm:text-3xl tracking-tight drop-shadow-sm">{selected.name}</h3>
                                        <button
                                            onClick={() => setSelected(null)}
                                            className="hidden sm:flex absolute -top-2 right-0 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all backdrop-blur-md"
                                        >
                                            <X className="w-5 h-5" />
                                        </button>
                                    </div>
                                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-4">
                                        <span className="bg-black/25 px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wider text-blue-100 flex items-center gap-1.5 border border-white/10">
                                            SR {selected.sr_no}
                                        </span>
                                        {selected.roll_no && selected.roll_no !== '0' && (
                                            <span className="bg-black/25 px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wider text-blue-100 flex items-center gap-1.5 border border-white/10">
                                                Roll {selected.roll_no}
                                            </span>
                                        )}
                                        <span className="bg-white/20 px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wider text-white border border-white/20">
                                            Class {selected.class}
                                        </span>
                                    </div>

                                    <div className="flex flex-wrap justify-center sm:justify-start gap-2 mt-auto">
                                        <span className={`px-4 py-1.5 rounded-full text-xs font-bold tracking-widest text-white border uppercase shadow-sm ${selected.status === 'active' ? 'bg-emerald-500/90 border-emerald-400/50' : selected.status === 'transferred' ? 'bg-orange-500/90 border-orange-400/50' : 'bg-red-500/90 border-red-400/50'}`}>
                                            {selected.status === 'active' ? 'Active Student' : selected.status === 'transferred' ? 'TC Issued' : 'Inactive'}
                                        </span>
                                        {['yes','YES','rte','RTE'].includes(selected.rte || '') && (
                                            <span className="px-4 py-1.5 rounded-full text-xs font-bold tracking-widest text-white border border-purple-400/50 bg-purple-500/90 uppercase shadow-sm">
                                                ★ RTE
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* ── Card body (Grid Layout) ── */}
                            <div className="p-4 sm:p-8 overflow-y-auto flex-1 bg-slate-50/80 custom-scrollbar">
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">

                                    {/* Academic */}
                                    <div className="bg-white rounded-[1.5rem] p-6 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] border border-slate-200/60 hover:shadow-md transition-shadow">
                                        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
                                            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl shadow-inner-sm">
                                                <GraduationCap className="w-5 h-5" />
                                            </div>
                                            <h4 className="text-sm font-bold uppercase tracking-widest text-slate-800">Academic Info</h4>
                                        </div>
                                        <div className="flex flex-col gap-4">
                                            {[
                                                ['Class', selected.class],
                                                ['Roll No.', selected.roll_no && selected.roll_no !== '0' ? selected.roll_no : null],
                                                ['Admission Date', formatDate(selected.admission_date)],
                                                ['Date of Birth', formatDate(selected.dob)],
                                                ['PEN No.', selected.pen_no],
                                                ['House', selected.house],
                                            ].filter(([, v]) => v).map(([label, val]) => (
                                                <div key={label as string} className="flex flex-col gap-1 bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                                                    <span className="text-[10px] font-bold tracking-wider uppercase text-slate-500">{label}</span>
                                                    <span className="font-semibold text-slate-800 text-sm">{val}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Family */}
                                    <div className="bg-white rounded-[1.5rem] p-6 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] border border-slate-200/60 hover:shadow-md transition-shadow">
                                        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
                                            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl shadow-inner-sm">
                                                <User className="w-5 h-5" />
                                            </div>
                                            <h4 className="text-sm font-bold uppercase tracking-widest text-slate-800">Family Details</h4>
                                        </div>
                                        <div className="flex flex-col gap-4">
                                            {[
                                                ["Father's Name", selected.father_name],
                                                ["Mother's Name", selected.mother_name],
                                                ['Caste', selected.caste],
                                                ['Religion', selected.religion],
                                                ['Occupation', selected.occupation],
                                                ['Nationality', selected.nationality],
                                                ['Blood Group', selected.blood_group],
                                            ].filter(([, v]) => v).map(([label, val]) => (
                                                <div key={label as string} className="flex flex-col gap-1 bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                                                    <span className="text-[10px] font-bold tracking-wider uppercase text-slate-500">{label}</span>
                                                    <span className="font-semibold text-slate-800 text-sm capitalize">{val}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Contact & IDs */}
                                    {(selected.email || selected.phone || selected.whatsapp || selected.address || selected.aadhar_card) && (
                                        <div className="bg-white rounded-[1.5rem] p-6 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] border border-slate-200/60 hover:shadow-md transition-shadow">
                                            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
                                                <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl shadow-inner-sm">
                                                    <Phone className="w-5 h-5" />
                                                </div>
                                                <h4 className="text-sm font-bold uppercase tracking-widest text-slate-800">Contact & IDs</h4>
                                            </div>
                                            <div className="flex flex-col gap-4">
                                                {[
                                                    ['Email', selected.email],
                                                    ['Phone', selected.phone],
                                                    ['WhatsApp', selected.whatsapp],
                                                    ['Aadhar Card', selected.aadhar_card],
                                                    ['Address', selected.address],
                                                ].filter(([, v]) => v).map(([label, val]) => (
                                                    <div key={label as string} className="flex flex-col gap-1 bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                                                        <span className="text-[10px] font-bold tracking-wider uppercase text-slate-500">{label}</span>
                                                        <span className={`font-semibold text-slate-800 text-sm ${label === 'Address' ? 'break-words leading-relaxed mt-1' : ''}`}>{val}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* ── Footer Buttons ── */}
                            <div className="p-4 sm:p-6 bg-white border-t border-slate-100 flex flex-col sm:flex-row items-center gap-3 shrink-0">
                                <button
                                    onClick={() => printStudent(selected)}
                                    className="w-full sm:w-auto sm:flex-1 flex justify-center items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-3.5 px-6 rounded-xl shadow-[0_4px_14px_0_rgba(37,99,235,0.39)] transition-all hover:shadow-[0_6px_20px_rgba(37,99,235,0.23)] hover:-translate-y-0.5"
                                >
                                    <Printer className="w-5 h-5" /> Print Information Card
                                </button>
                                
                                <div className="flex flex-row gap-3 w-full sm:w-auto sm:flex-1">
                                    <button
                                        onClick={() => setEditing(selected)}
                                        className="flex-1 flex justify-center items-center gap-2 border-2 border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 font-bold py-3 px-6 rounded-xl transition-all"
                                    >
                                        <Pencil className="w-4 h-4" /> Edit Profile
                                    </button>
                                    <button
                                        onClick={() => setSelected(null)}
                                        className="flex-1 flex justify-center items-center gap-2 bg-slate-100 text-slate-600 hover:bg-slate-200 font-bold py-3 px-6 rounded-xl transition-all sm:hidden"
                                    >
                                        <X className="w-4 h-4" /> Close
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
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
