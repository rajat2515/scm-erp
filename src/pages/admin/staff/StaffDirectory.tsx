import React, { useEffect, useState } from 'react';
import { supabase } from '@/config/supabaseClient';
import AppShell from '@/components/layout/AppShell';
import { Search, Plus, Pencil, Trash2, X, GraduationCap, Building2, UserCircle2, Save, Loader2, Eye, IndianRupee, Download, Printer } from 'lucide-react';
import type { StaffProfile } from '@/types';
import * as XLSX from 'xlsx';

const DESIGNATIONS = [
    'Principal', 'Vice Principal', 'T.G.T.', 'P.R.T.', 'Music Teacher', 'P.T.I.', 'Librarian', 'Clerk', 'Peon', 'Guard', 'Driver', 'Labour', 'Other'
];

const STAFF_CATEGORIES = [
    { key: 'all', label: 'All' },
    { key: 'academic', label: 'Academic Staff' },
    { key: 'teachers', label: 'Teachers' },
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
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [selectedStaff, setSelectedStaff] = useState<StaffProfile | null>(null);
    const [staffCategory, setStaffCategory] = useState<StaffCategory>('all');
    
    // Modal state
    const [modalOpen, setModalOpen] = useState(false);
    const [editingStaff, setEditingStaff] = useState<StaffProfile | null>(null);

    useEffect(() => {
        loadStaff();
    }, []);

    const loadStaff = async () => {
        setLoading(true);
        const { data, error } = await supabase.from('staff_profiles').select('*').order('name');
        if (!error && data) setStaff(data as unknown as StaffProfile[]);
        setLoading(false);
    };

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`Are you sure you want to remove ${name} from the staff directory?`)) return;
        
        // Ensure cascading works in attendance, or attendance is kept? The SQL uses ON DELETE CASCADE.
        const { error } = await supabase.from('staff_profiles').delete().eq('id', id);
        if (!error) {
            setStaff(prev => prev.filter(s => s.id !== id));
        } else {
            alert('Failed to delete: ' + error.message);
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

    const filteredStaff = staff.filter(s => {
        const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase()) || (s.designation || '').toLowerCase().includes(search.toLowerCase());
        const matchesCategory = staffCategory === 'all' || getStaffCategory(s.designation) === staffCategory;
        return matchesSearch && matchesCategory;
    });

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
                        const count = cat.key === 'all' ? staff.length : staff.filter(s => getStaffCategory(s.designation) === cat.key).length;
                        return (
                            <button
                                key={cat.key}
                                onClick={() => setStaffCategory(cat.key)}
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
                {/* Search */}
                <div className="relative w-full sm:w-96">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Search staff by name or designation..."
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
                    <button
                        onClick={openCreateModal}
                        className="flex items-center gap-2 gradient-primary text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:opacity-90 transition-all shadow-lg shadow-primary/20"
                    >
                        <Plus className="w-4 h-4" />
                        Add Staff
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-primary/50" />
                </div>
            ) : filteredStaff.length === 0 ? (
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
                                    <button onClick={() => setSelectedStaff(member)} className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-500 transition-colors" title="View Details">
                                        <Eye className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => openEditModal(member)} className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-500 transition-colors" title="Edit">
                                        <Pencil className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => handleDelete(member.id, member.name)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors" title="Delete">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-2 mt-auto">
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <GraduationCap className="w-4 h-4" />
                                    <span className="truncate">{member.qualification || 'No qual. listed'}</span>
                                    {member.trained_status && (
                                        <span className={`text-[10px] items-center flex rounded-full px-2 py-0.5 border ${member.trained_status === 'Trained' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                                            {member.trained_status}
                                        </span>
                                    )}
                                </div>
                                {member.teaching_subject && (
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <Building2 className="w-4 h-4" />
                                        <span className="truncate">{member.teaching_subject}</span>
                                    </div>
                                )}
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

            {/* Slide-over Detail Panel */}
            {selectedStaff && (
                <>
                    {/* Backdrop for mobile */}
                    <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden" onClick={() => setSelectedStaff(null)} />
                    
                    <div className="fixed right-0 top-0 h-full z-50 w-[22rem] lg:w-[24rem] bg-card border-l border-border animate-fade-in flex flex-col shadow-2xl overflow-hidden">
                        
                        {/* Hero Header */}
                        <div className="relative gradient-primary p-6 pb-8">
                            <button
                                onClick={() => setSelectedStaff(null)}
                                className="absolute top-4 right-4 p-1.5 rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
                            >
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

                        {/* Details Body */}
                        <div className="flex-1 overflow-y-auto p-5 space-y-4">
                            
                            {/* Academic & Role Info */}
                            <div className="bg-muted/40 rounded-2xl p-4 space-y-3">
                                <div className="flex items-center gap-2 mb-2">
                                    <GraduationCap className="w-4 h-4 text-primary" />
                                    <h3 className="font-bold text-xs uppercase tracking-widest text-muted-foreground">Professional Info</h3>
                                </div>
                                
                                {[
                                    ['Qualification', selectedStaff.qualification],
                                    ['Teaching Subject', selectedStaff.teaching_subject],
                                    ['Training Status', selectedStaff.trained_status],
                                    ['Date of Birth', formatDate(selectedStaff.dob)],
                                    ['Appointment Date', formatDate(selectedStaff.appointment_date)],
                                ].filter(([, val]) => val).map(([label, val]) => (
                                    <div key={label} className="flex justify-between items-center text-sm border-b border-border/50 pb-2 last:border-0 last:pb-0">
                                        <span className="text-muted-foreground">{label}</span>
                                        <span className="font-medium text-foreground text-right">{val}</span>
                                    </div>
                                ))}
                            </div>

                            {/* Personal Info */}
                            {selectedStaff.fathers_spouse_name && (
                                <div className="bg-muted/40 rounded-2xl p-4 space-y-3">
                                    <div className="flex items-center gap-2 mb-2">
                                        <UserCircle2 className="w-4 h-4 text-primary" />
                                        <h3 className="font-bold text-xs uppercase tracking-widest text-muted-foreground">Personal Info</h3>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-muted-foreground">Father / Spouse Name</span>
                                        <span className="font-medium text-foreground text-right">{selectedStaff.fathers_spouse_name}</span>
                                    </div>
                                </div>
                            )}

                            {/* Payroll Summary */}
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
                        
                        {/* Footer Actions */}
                        <div className="p-4 border-t border-border grid grid-cols-3 gap-3 bg-card">
                            <button 
                                onClick={() => {
                                    setSelectedStaff(null);
                                    openEditModal(selectedStaff);
                                }}
                                className="flex items-center justify-center gap-2 bg-primary/10 hover:bg-primary/20 text-primary transition-colors rounded-xl py-2.5 text-sm font-semibold"
                            >
                                <Pencil className="w-4 h-4" /> Edit
                            </button>
                            <button 
                                onClick={() => handlePrintStaff(selectedStaff)}
                                className="flex items-center justify-center gap-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition-colors rounded-xl py-2.5 text-sm font-semibold"
                            >
                                <Printer className="w-4 h-4" /> Print
                            </button>
                            <button 
                                onClick={() => setSelectedStaff(null)}
                                className="flex items-center justify-center gap-2 border border-border hover:bg-muted text-foreground transition-colors rounded-xl py-2.5 text-sm font-semibold"
                            >
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
        name: '', fathers_spouse_name: '', dob: '', qualification: '', designation: 'T.G.T.', appointment_date: new Date().toISOString().split('T')[0], teaching_subject: '', trained_status: 'Trained' as 'Trained'|'Untrained', basic_pay: 9300, grade_pay: 4200, status: 'active' as 'active'|'inactive'
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
            name: form.name, fathers_spouse_name: form.fathers_spouse_name || null, dob: form.dob || null, qualification: form.qualification || null, designation: form.designation, appointment_date: form.appointment_date || null, teaching_subject: form.teaching_subject || null, trained_status: form.trained_status || null, basic_pay: Number(form.basic_pay) || 0, grade_pay: Number(form.grade_pay) || 0, status: form.status
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
                        <div>
                            <label className={lC}>Teaching Subject</label>
                            <input value={form.teaching_subject} onChange={e => set('teaching_subject', e.target.value)} className={iC} placeholder="e.g. All Subject / Maths / Science" />
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
