import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/config/supabaseClient';
import {
    Search, ChevronLeft, ChevronDown, Plus, Loader2,
    CheckCircle2, AlertCircle, Trash2, X, History,
    IndianRupee, Calendar, CreditCard, BookOpen,
} from 'lucide-react';
import Swal from 'sweetalert2';
import { CLASSES } from '../students/StudentDirectory';

/* ─── Constants ───────────────────────────────────────────── */
const ANNUAL_FEE = 1200;
const EXAM_FEE   = 200;

// Generate academic years from 2018-19 to 2025-26
const ACADEMIC_YEARS: string[] = [];
for (let y = 2018; y <= 2025; y++) {
    ACADEMIC_YEARS.push(`${y}-${String(y + 1).slice(2)}`);
}

function getYearMonths(academicYear: string) {
    const startYear = parseInt(academicYear.split('-')[0]);
    const months: { key: string; label: string; type: 'annual' | 'tuition' | 'exam' | 'other' }[] = [];
    months.push({ key: `Annual Fee ${academicYear}`, label: `Annual Fee`, type: 'annual' });
    const MONTH_NAMES = ['April','May','June','July','August','September','October','November','December','January','February','March'];
    MONTH_NAMES.forEach((m, i) => {
        const yr = i < 9 ? startYear : startYear + 1;
        months.push({ key: `${m} ${yr}`, label: m, type: 'tuition' });
        if (m === 'September') {
            months.push({ key: `Exam Fee Term 1 ${academicYear}`, label: 'Exam Fee – Term 1', type: 'exam' });
        }
    });
    months.push({ key: `Exam Fee Term 2 ${academicYear}`, label: 'Exam Fee – Term 2', type: 'exam' });
    return months;
}

/* ─── Types ───────────────────────────────────────────────── */
interface Student {
    sr_no: number; name: string; class: string;
    father_name?: string; phone?: string; rte?: string;
    status?: string; admission_date?: string;
}

interface DueRow {
    id?: number;
    sr_no: number;
    academic_year: string;
    month: string;
    fee_type: 'tuition' | 'annual' | 'exam' | 'other';
    due_amount: number;
    paid_amount: number;
    discount: number;
    reason?: string;
    paid_on?: string;
    mode?: string;
}

interface StudentSummary extends Student {
    totalDue: number;
    totalPaid: number;
    totalDiscount: number;
    balance: number;
}

/* ─── Helpers ─────────────────────────────────────────────── */
const fmtINR = (n: number) => '₹' + n.toLocaleString('en-IN');

/* ─── Pay Row Modal ───────────────────────────────────────── */
interface PayModalProps {
    row: DueRow & { label: string };
    onClose: () => void;
    onSaved: () => void;
}
const PayRowModal: React.FC<PayModalProps> = ({ row, onClose, onSaved }) => {
    const balance = Math.max(0, row.due_amount - row.paid_amount - row.discount);
    const [amount, setAmount] = useState(String(balance));
    const [discount, setDiscount] = useState('0');
    const [mode, setMode] = useState<'cash' | 'online' | 'cheque'>('cash');
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState('');

    const handleSave = async () => {
        const amt = parseFloat(amount) || 0;
        const disc = parseFloat(discount) || 0;
        if (amt <= 0 && disc <= 0) { setErr('Enter amount or discount'); return; }
        setSaving(true);
        const payload: Partial<DueRow> = {
            sr_no: row.sr_no,
            academic_year: row.academic_year,
            month: row.month,
            fee_type: row.fee_type,
            due_amount: row.due_amount,
            paid_amount: row.paid_amount + amt,
            discount: row.discount + disc,
            reason: row.reason,
            paid_on: new Date().toISOString().split('T')[0],
            mode,
        };
        const { error } = await supabase.from('previous_year_dues')
            .upsert(payload, { onConflict: 'sr_no,academic_year,month' });
            
        if (!error && amt > 0) {
            // Also insert a ledger payment record to properly link the receipt
            await supabase.from('fee_payments').insert({
                sr_no: row.sr_no,
                month: `Previous Dues - ${row.label}`,
                due_amount: amt,
                paid_amount: amt,
                discount: 0,
                paid_on: payload.paid_on,
                mode,
            });
        }
        
        setSaving(false);
        if (error) { setErr(error.message); return; }
        onSaved();
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.45)' }} onClick={onClose}>
            <div className="bg-card rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4 border border-border" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-base">{row.label}</h3>
                    <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted transition-colors"><X className="w-4 h-4" /></button>
                </div>

                <div className="grid grid-cols-3 gap-2 mb-5 text-sm text-center">
                    <div className="p-2 bg-muted/40 rounded-xl">
                        <p className="text-xs text-muted-foreground mb-0.5">Due</p>
                        <p className="font-bold">{fmtINR(row.due_amount)}</p>
                    </div>
                    <div className="p-2 bg-emerald-50 rounded-xl border border-emerald-100">
                        <p className="text-xs text-muted-foreground mb-0.5">Paid</p>
                        <p className="font-bold text-emerald-600">{fmtINR(row.paid_amount)}</p>
                    </div>
                    <div className="p-2 bg-red-50 rounded-xl border border-red-100">
                        <p className="text-xs text-muted-foreground mb-0.5">Balance</p>
                        <p className="font-bold text-red-600">{fmtINR(balance)}</p>
                    </div>
                </div>

                <div className="space-y-3">
                    <div>
                        <label className="text-xs font-medium text-muted-foreground block mb-1">Pay Amount</label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-sm">₹</span>
                            <input type="number" value={amount} onChange={e => setAmount(e.target.value)} min={0}
                                className="w-full pl-7 pr-3 py-2 rounded-xl border border-border bg-background text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/30" />
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-medium text-muted-foreground block mb-1">Discount</label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-sm">₹</span>
                            <input type="number" value={discount} onChange={e => setDiscount(e.target.value)} min={0}
                                className="w-full pl-7 pr-3 py-2 rounded-xl border border-border bg-background text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/30" />
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-medium text-muted-foreground block mb-1">Payment Mode</label>
                        <div className="grid grid-cols-3 gap-2">
                            {(['cash', 'online', 'cheque'] as const).map(m => (
                                <button key={m} onClick={() => setMode(m)}
                                    className={`py-2 rounded-xl text-xs font-medium border transition-all capitalize ${mode === m ? 'gradient-primary text-white border-transparent shadow-md' : 'border-border text-muted-foreground hover:border-primary/40'}`}>
                                    {m}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {err && <p className="text-xs text-red-600 mt-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{err}</p>}

                <button onClick={handleSave} disabled={saving}
                    className="w-full mt-4 py-2.5 rounded-xl gradient-primary text-white font-semibold text-sm flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 transition-all">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <IndianRupee className="w-4 h-4" />}
                    {saving ? 'Saving…' : 'Record Payment'}
                </button>
            </div>
        </div>
    );
};

/* ─── Add Due Modal (Bulk) ────────────────────────────────── */
interface AddDueModalProps {
    srNo: number;
    academicYear: string;
    existingMonths: Set<string>;
    onClose: () => void;
    onSaved: () => void;
}

interface BulkEntry {
    key: string;
    label: string;
    type: 'annual' | 'tuition' | 'exam' | 'other';
    checked: boolean;
    amount: string;
    reason: string;
}

const AddDueModal: React.FC<AddDueModalProps> = ({ srNo, academicYear, existingMonths, onClose, onSaved }) => {
    const allMonths = getYearMonths(academicYear);

    // Build initial checklist — skip already-existing months
    const buildEntries = (): BulkEntry[] =>
        allMonths
            .filter(m => !existingMonths.has(m.key))
            .map(m => ({
                key: m.key, label: m.label, type: m.type,
                checked: false,
                amount: m.type === 'annual' ? String(ANNUAL_FEE) : m.type === 'exam' ? String(EXAM_FEE) : '',
                reason: '',
            }));

    const [entries, setEntries]     = useState<BulkEntry[]>(buildEntries);
    const [tuitionFill, setTuitionFill] = useState('');   // quick-fill for all tuition months
    const [otherRows, setOtherRows] = useState<{ label: string; amount: string; reason: string }[]>([]);
    const [saving, setSaving]       = useState(false);
    const [err, setErr]             = useState('');

    const toggle = (key: string) =>
        setEntries(prev => prev.map(e => e.key === key ? { ...e, checked: !e.checked } : e));

    const setAmount = (key: string, val: string) =>
        setEntries(prev => prev.map(e => e.key === key ? { ...e, amount: val } : e));

    const setReason = (key: string, val: string) =>
        setEntries(prev => prev.map(e => e.key === key ? { ...e, reason: val } : e));

    // Fill all tuition months at once
    const applyTuitionFill = () => {
        if (!tuitionFill) return;
        setEntries(prev => prev.map(e =>
            e.type === 'tuition' ? { ...e, checked: true, amount: tuitionFill } : e
        ));
    };

    // Select/deselect all
    const toggleAll = (checked: boolean) =>
        setEntries(prev => prev.map(e => ({ ...e, checked })));

    const addOtherRow = () =>
        setOtherRows(prev => [...prev, { label: '', amount: '', reason: '' }]);

    const updateOther = (i: number, field: 'label' | 'amount' | 'reason', val: string) =>
        setOtherRows(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: val } : r));

    const removeOther = (i: number) =>
        setOtherRows(prev => prev.filter((_, idx) => idx !== i));

    const selectedEntries = entries.filter(e => e.checked);
    const validOther      = otherRows.filter(r => r.label.trim() && parseFloat(r.amount) > 0);

    const totalAmount = [
        ...selectedEntries.map(e => parseFloat(e.amount) || 0),
        ...validOther.map(r => parseFloat(r.amount) || 0),
    ].reduce((a, b) => a + b, 0);

    const handleSave = async () => {
        if (selectedEntries.length === 0 && validOther.length === 0) {
            setErr('Select at least one fee item to add.'); return;
        }
        const invalidAmts = selectedEntries.filter(e => !(parseFloat(e.amount) > 0));
        if (invalidAmts.length > 0) {
            setErr(`Enter a valid amount for: ${invalidAmts.map(e => e.label).join(', ')}`); return;
        }
        setSaving(true);
        const rows = [
            ...selectedEntries.map(e => ({
                sr_no: srNo, academic_year: academicYear,
                month: e.key, fee_type: e.type,
                due_amount: parseFloat(e.amount) || 0,
                paid_amount: 0, discount: 0,
                reason: e.reason || null,
            })),
            ...validOther.map(r => ({
                sr_no: srNo, academic_year: academicYear,
                month: r.label.trim(),
                fee_type: 'other' as const,
                due_amount: parseFloat(r.amount) || 0,
                paid_amount: 0, discount: 0,
                reason: r.reason || null,
            })),
        ];
        const { error } = await supabase.from('previous_year_dues')
            .upsert(rows, { onConflict: 'sr_no,academic_year,month' });
        setSaving(false);
        if (error) { setErr(error.message); return; }
        onSaved();
        onClose();
    };

    const groupedEntries = {
        annual: entries.filter(e => e.type === 'annual'),
        tuition: entries.filter(e => e.type === 'tuition'),
        exam: entries.filter(e => e.type === 'exam'),
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
            <div
                className="bg-card rounded-2xl shadow-2xl w-full max-w-lg mx-4 border border-border flex flex-col"
                style={{ maxHeight: '90vh' }}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
                    <div>
                        <h3 className="font-bold text-base">Add Previous Dues — {academicYear}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">Check items, set amounts, then save all at once</p>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors"><X className="w-4 h-4" /></button>
                </div>

                {/* Scrollable body */}
                <div className="overflow-y-auto flex-1 px-6 py-4 space-y-5">

                    {/* Select all / none */}
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground">
                            {selectedEntries.length + validOther.length} item(s) selected · Total: <span className="font-bold text-foreground">{fmtINR(totalAmount)}</span>
                        </span>
                        <div className="flex gap-2">
                            <button onClick={() => toggleAll(true)}
                                className="text-xs px-3 py-1 rounded-lg border border-border hover:bg-muted transition-colors">All</button>
                            <button onClick={() => toggleAll(false)}
                                className="text-xs px-3 py-1 rounded-lg border border-border hover:bg-muted transition-colors">None</button>
                        </div>
                    </div>

                    {/* Annual Fee */}
                    {groupedEntries.annual.length > 0 && (
                        <div>
                            <p className="text-xs font-semibold text-blue-600 mb-2 uppercase tracking-wide">Annual Fee</p>
                            {groupedEntries.annual.map(e => (
                                <EntryRow key={e.key} entry={e} onToggle={() => toggle(e.key)}
                                    onAmountChange={v => setAmount(e.key, v)}
                                    onReasonChange={v => setReason(e.key, v)} />
                            ))}
                        </div>
                    )}

                    {/* Tuition months */}
                    {groupedEntries.tuition.length > 0 && (
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-xs font-semibold text-foreground/70 uppercase tracking-wide">Tuition (Monthly)</p>
                                {/* Quick-fill */}
                                <div className="flex items-center gap-1.5">
                                    <div className="relative w-24">
                                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-bold">₹</span>
                                        <input type="number" value={tuitionFill}
                                            onChange={e => setTuitionFill(e.target.value)}
                                            placeholder="amt"
                                            className="w-full pl-5 pr-2 py-1 rounded-lg border border-border bg-background text-xs font-bold focus:outline-none focus:ring-1 focus:ring-primary/30" />
                                    </div>
                                    <button onClick={applyTuitionFill}
                                        className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors whitespace-nowrap">
                                        Fill All
                                    </button>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                {groupedEntries.tuition.map(e => (
                                    <EntryRow key={e.key} entry={e} onToggle={() => toggle(e.key)}
                                        onAmountChange={v => setAmount(e.key, v)}
                                        onReasonChange={v => setReason(e.key, v)} compact />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Exam Fees */}
                    {groupedEntries.exam.length > 0 && (
                        <div>
                            <p className="text-xs font-semibold text-purple-600 mb-2 uppercase tracking-wide">Exam Fees</p>
                            {groupedEntries.exam.map(e => (
                                <EntryRow key={e.key} entry={e} onToggle={() => toggle(e.key)}
                                    onAmountChange={v => setAmount(e.key, v)}
                                    onReasonChange={v => setReason(e.key, v)} />
                            ))}
                        </div>
                    )}

                    {/* No items left */}
                    {entries.length === 0 && (
                        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                            All standard fee items for {academicYear} are already recorded. You can still add custom fees below.
                        </p>
                    )}

                    {/* Other/Custom fees */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide">Other / Custom Fees</p>
                            <button onClick={addOtherRow}
                                className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border border-border hover:bg-muted transition-colors">
                                <Plus className="w-3 h-3" /> Add Row
                            </button>
                        </div>
                        {otherRows.map((r, i) => (
                            <div key={i} className="flex gap-2 items-start mb-2">
                                <input type="text" value={r.label} onChange={e => updateOther(i, 'label', e.target.value)}
                                    placeholder="Fee name (e.g. Late Fine)"
                                    className="flex-1 px-3 py-2 rounded-xl border border-border bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary/30" />
                                <div className="relative w-24 flex-shrink-0">
                                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-bold">₹</span>
                                    <input type="number" value={r.amount} onChange={e => updateOther(i, 'amount', e.target.value)}
                                        placeholder="0" min={0}
                                        className="w-full pl-6 pr-2 py-2 rounded-xl border border-border bg-background text-xs font-bold focus:outline-none focus:ring-1 focus:ring-primary/30" />
                                </div>
                                <button onClick={() => removeOther(i)}
                                    className="p-2 text-red-400 hover:text-red-600 transition-colors flex-shrink-0">
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        ))}
                        {otherRows.length === 0 && (
                            <p className="text-xs text-muted-foreground">No custom entries. Click "+ Add Row" to add late fine, book fee, etc.</p>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-border flex-shrink-0 space-y-3">
                    {err && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{err}</p>}
                    <div className="flex items-center justify-between gap-3">
                        <div className="text-sm">
                            <span className="text-muted-foreground text-xs">Total to record: </span>
                            <span className="font-black text-base text-primary">{fmtINR(totalAmount)}</span>
                        </div>
                        <button onClick={handleSave} disabled={saving || (selectedEntries.length === 0 && validOther.length === 0)}
                            className="flex items-center gap-2 px-6 py-2.5 rounded-xl gradient-primary text-white font-semibold text-sm hover:opacity-90 disabled:opacity-50 transition-all shadow-md">
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                            {saving ? 'Saving…' : `Save ${selectedEntries.length + validOther.length} Item(s)`}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

/* ─── EntryRow sub-component ──────────────────────────────── */
const EntryRow: React.FC<{
    entry: BulkEntry;
    onToggle: () => void;
    onAmountChange: (v: string) => void;
    onReasonChange: (v: string) => void;
    compact?: boolean;
}> = ({ entry, onToggle, onAmountChange, onReasonChange, compact }) => (
    <div className={`flex items-center gap-2 p-2.5 rounded-xl border transition-all mb-1.5 ${entry.checked ? 'border-primary/40 bg-primary/5' : 'border-border bg-background hover:border-border/80'}`}>
        <button
            onClick={onToggle}
            className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${entry.checked ? 'bg-primary border-primary' : 'border-border'}`}
        >
            {entry.checked && <CheckCircle2 className="w-3 h-3 text-white" />}
        </button>
        <span className={`text-sm flex-1 font-medium min-w-0 truncate ${!entry.checked ? 'text-muted-foreground' : ''}`}>{entry.label}</span>
        {entry.checked && (
            <>
                <div className="relative w-24 flex-shrink-0">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-bold">₹</span>
                    <input
                        type="number"
                        value={entry.amount}
                        onChange={e => onAmountChange(e.target.value)}
                        min={0}
                        onClick={e => e.stopPropagation()}
                        className="w-full pl-6 pr-2 py-1.5 rounded-lg border border-border bg-card text-xs font-bold focus:outline-none focus:ring-1 focus:ring-primary/30"
                        placeholder="0"
                    />
                </div>
                {!compact && (
                    <input
                        type="text"
                        value={entry.reason}
                        onChange={e => onReasonChange(e.target.value)}
                        onClick={e => e.stopPropagation()}
                        placeholder="Note (opt.)"
                        maxLength={80}
                        className="w-32 px-2.5 py-1.5 rounded-lg border border-border bg-card text-xs focus:outline-none focus:ring-1 focus:ring-primary/30"
                    />
                )}
            </>
        )}
    </div>
);


/* ─── Student Detail View ─────────────────────────────────── */
interface StudentDetailProps {
    student: Student;
    onBack: () => void;
}
const StudentDetail: React.FC<StudentDetailProps> = ({ student, onBack }) => {
    const [yearFilter, setYearFilter] = useState<string>('All');
    const [dues, setDues] = useState<DueRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [payTarget, setPayTarget] = useState<(DueRow & { label: string }) | null>(null);
    const [showAddDue, setShowAddDue] = useState(false);
    const [addDueYear, setAddDueYear] = useState(ACADEMIC_YEARS[ACADEMIC_YEARS.length - 1]);

    // Determine years available from admission date to 2024-25
    const admissionYear = student.admission_date
        ? parseInt(student.admission_date.split('-')[0])
        : 2018;
    const availableYears = ACADEMIC_YEARS.filter(y => parseInt(y.split('-')[0]) >= admissionYear);

    const loadDues = useCallback(async () => {
        setLoading(true);
        let q = supabase.from('previous_year_dues').select('*').eq('sr_no', student.sr_no).order('academic_year').order('month');
        if (yearFilter !== 'All') q = q.eq('academic_year', yearFilter);
        const { data } = await q;
        setDues(data || []);
        setLoading(false);
    }, [student.sr_no, yearFilter]);

    useEffect(() => { loadDues(); }, [loadDues]);

    const handleDelete = async (due: DueRow) => {
        const result = await Swal.fire({
            title: 'Delete due entry?',
            text: `Are you sure you want to delete the "${due.month}" due entry? This cannot be undone.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Yes, delete it!'
        });

        if (result.isConfirmed) {
            if (due.id) {
                const { error } = await supabase.from('previous_year_dues').delete().eq('id', due.id);
                if (error) {
                    Swal.fire('Error!', 'Failed to delete: ' + error.message, 'error');
                    return;
                }

                // If the due was paid, safely remove *only* the specific receipt created by PayRowModal
                if (due.paid_amount > 0) {
                    const allMonths = getYearMonths(due.academic_year);
                    const found = allMonths.find(m => m.key === due.month);
                    const label = found ? found.label : due.month;
                    await supabase
                        .from('fee_payments')
                        .delete()
                        .eq('sr_no', due.sr_no)
                        .eq('month', `Previous Dues - ${label}`);
                }
            }
            await loadDues();
            Swal.fire('Deleted!', 'Due entry has been removed.', 'success');
        }
    };

    // Group dues by academic year
    const grouped: Record<string, DueRow[]> = {};
    dues.forEach(d => {
        if (!grouped[d.academic_year]) grouped[d.academic_year] = [];
        grouped[d.academic_year].push(d);
    });

    const totalDue = dues.reduce((s, d) => s + d.due_amount, 0);
    const totalPaid = dues.reduce((s, d) => s + d.paid_amount, 0);
    const totalDiscount = dues.reduce((s, d) => s + d.discount, 0);
    const totalBalance = Math.max(0, totalDue - totalPaid - totalDiscount);

    const feeTypeColor = (type: string) => {
        switch (type) {
            case 'annual': return 'bg-blue-50 text-blue-700 border-blue-200';
            case 'exam':   return 'bg-purple-50 text-purple-700 border-purple-200';
            case 'other':  return 'bg-amber-50 text-amber-700 border-amber-200';
            default:       return 'bg-muted/40 text-muted-foreground border-border/50';
        }
    };

    const existingMonths = new Set(dues.filter(d => d.academic_year === addDueYear).map(d => d.month));

    return (
        <div className="animate-fade-in space-y-5">
            {/* Header */}
            <div className="flex items-center gap-3 flex-wrap">
                <button onClick={onBack}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-card text-sm font-medium hover:bg-muted transition-colors">
                    <ChevronLeft className="w-4 h-4" /> Back
                </button>
                <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-base truncate">{student.name}</h3>
                    <p className="text-xs text-muted-foreground">SR {student.sr_no} · Class {student.class}{student.father_name ? ` · ${student.father_name}` : ''}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Year filter */}
                    <div className="relative">
                        <select value={yearFilter} onChange={e => setYearFilter(e.target.value)}
                            className="pl-3 pr-8 py-2 rounded-xl border border-border bg-card text-sm focus:outline-none appearance-none font-medium">
                            <option value="All">All Years</option>
                            {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                        <Calendar className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                    </div>
                    {/* Add due button */}
                    <button
                        onClick={() => {
                            setAddDueYear(yearFilter === 'All' ? ACADEMIC_YEARS[ACADEMIC_YEARS.length - 1] : yearFilter);
                            setShowAddDue(true);
                        }}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl gradient-primary text-white text-sm font-semibold hover:opacity-90 transition-all shadow-sm">
                        <Plus className="w-4 h-4" /> Add Due
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                    { label: 'Total Due', value: fmtINR(totalDue), cls: 'text-foreground', bg: 'bg-card border-border' },
                    { label: 'Total Paid', value: fmtINR(totalPaid), cls: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' },
                    { label: 'Discount', value: fmtINR(totalDiscount), cls: 'text-purple-600', bg: 'bg-purple-50 border-purple-200' },
                    { label: 'Balance', value: fmtINR(totalBalance), cls: totalBalance > 0 ? 'text-red-600' : 'text-emerald-600', bg: totalBalance > 0 ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200' },
                ].map(c => (
                    <div key={c.label} className={`p-3 rounded-2xl border ${c.bg} text-center shadow-sm`}>
                        <p className={`text-lg font-black ${c.cls}`}>{c.value}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{c.label}</p>
                    </div>
                ))}
            </div>

            {/* Loading state */}
            {loading && (
                <div className="flex items-center justify-center py-20 bg-card border border-border rounded-2xl">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    <span className="text-muted-foreground text-sm ml-2">Loading dues…</span>
                </div>
            )}

            {/* No dues */}
            {!loading && dues.length === 0 && (
                <div className="text-center py-20 bg-card border border-border rounded-2xl shadow-sm">
                    <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
                    <p className="font-semibold text-foreground">No previous dues found</p>
                    <p className="text-sm text-muted-foreground mt-1">
                        {yearFilter !== 'All' ? `No entries for ${yearFilter}. ` : ''}
                        Use "Add Due" to record outstanding amounts.
                    </p>
                </div>
            )}

            {/* Year-grouped breakdown */}
            {!loading && Object.keys(grouped).sort().map(year => {
                const yearDues = grouped[year];
                const yDue   = yearDues.reduce((s, d) => s + d.due_amount, 0);
                const yPaid  = yearDues.reduce((s, d) => s + d.paid_amount, 0);
                const yDisc  = yearDues.reduce((s, d) => s + d.discount, 0);
                const yBal   = Math.max(0, yDue - yPaid - yDisc);

                return (
                    <div key={year} className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
                        {/* Year header */}
                        <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-muted/30">
                            <div className="flex items-center gap-2">
                                <BookOpen className="w-4 h-4 text-primary" />
                                <span className="font-bold text-sm">Academic Year {year}</span>
                            </div>
                            <div className="flex items-center gap-3 text-xs">
                                <span className="text-muted-foreground">Due: <span className="font-semibold text-foreground">{fmtINR(yDue)}</span></span>
                                <span className="text-muted-foreground">Paid: <span className="font-semibold text-emerald-600">{fmtINR(yPaid)}</span></span>
                                <span className={`font-bold px-2 py-0.5 rounded-full text-xs border ${yBal > 0 ? 'bg-red-50 text-red-700 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                                    {yBal > 0 ? `₹${yBal.toLocaleString('en-IN')} left` : '✓ Clear'}
                                </span>
                            </div>
                        </div>

                        {/* Due rows */}
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-border/50">
                                        <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">Fee Item</th>
                                        <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs">Type</th>
                                        <th className="text-right px-3 py-2.5 font-medium text-muted-foreground text-xs">Due</th>
                                        <th className="text-right px-3 py-2.5 font-medium text-muted-foreground text-xs">Paid</th>
                                        <th className="text-right px-3 py-2.5 font-medium text-muted-foreground text-xs">Disc.</th>
                                        <th className="text-right px-3 py-2.5 font-medium text-muted-foreground text-xs">Balance</th>
                                        <th className="text-right px-4 py-2.5 font-medium text-muted-foreground text-xs">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/50">
                                    {yearDues.map(due => {
                                        const bal = Math.max(0, due.due_amount - due.paid_amount - due.discount);
                                        const isPaid = bal === 0 && due.due_amount > 0;
                                        // Get a friendly label for the month/item
                                        const allMonths = getYearMonths(year);
                                        const found = allMonths.find(m => m.key === due.month);
                                        const label = found ? found.label : due.month;

                                        return (
                                            <tr key={due.id ?? due.month} className={`hover:bg-muted/20 transition-colors ${isPaid ? 'opacity-60' : ''}`}>
                                                <td className="px-4 py-3">
                                                    <p className="font-medium">{label}</p>
                                                    {due.reason && <p className="text-xs text-muted-foreground">{due.reason}</p>}
                                                    {due.paid_on && <p className="text-xs text-muted-foreground">Paid on: {new Date(due.paid_on).toLocaleDateString('en-IN')}</p>}
                                                </td>
                                                <td className="px-3 py-3">
                                                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border capitalize ${feeTypeColor(due.fee_type)}`}>
                                                        {due.fee_type}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-3 text-right font-medium">{fmtINR(due.due_amount)}</td>
                                                <td className="px-3 py-3 text-right text-emerald-600 font-medium">{fmtINR(due.paid_amount)}</td>
                                                <td className="px-3 py-3 text-right text-purple-600 font-medium">{due.discount > 0 ? fmtINR(due.discount) : '—'}</td>
                                                <td className="px-3 py-3 text-right">
                                                    {isPaid
                                                        ? <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">✓ Paid</span>
                                                        : <span className="font-bold text-red-600">{fmtINR(bal)}</span>
                                                    }
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        {!isPaid && (
                                                            <button
                                                                onClick={() => setPayTarget({ ...due, label })}
                                                                className="px-3 py-1.5 rounded-lg text-xs font-semibold gradient-primary text-white hover:opacity-90 transition-all shadow-sm flex items-center gap-1">
                                                                <CreditCard className="w-3 h-3" /> Pay
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => handleDelete(due)}
                                                            className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-100 transition-colors">
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                );
            })}

            {/* Modals */}
            {payTarget && (
                <PayRowModal row={payTarget} onClose={() => setPayTarget(null)} onSaved={() => { loadDues(); }} />
            )}
            {showAddDue && (
                <AddDueModal
                    srNo={student.sr_no}
                    academicYear={addDueYear}
                    existingMonths={existingMonths}
                    onClose={() => setShowAddDue(false)}
                    onSaved={() => { loadDues(); setShowAddDue(false); }}
                />
            )}
        </div>
    );
};

/* ─── Student List View ───────────────────────────────────── */
const StudentListView: React.FC<{ onSelectStudent: (s: Student) => void }> = ({ onSelectStudent }) => {
    const [query, setQuery] = useState('');
    const [classFilter, setClassFilter] = useState('');
    const [students, setStudents] = useState<StudentSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(0);
    const PAGE_SIZE = 20;

    const load = useCallback(async () => {
        setLoading(true);
        let q = supabase.from('students')
            .select('sr_no,name,class,father_name,phone,rte,status,admission_date')
            .eq('status', 'active')
            .order('class')
            .order('name')
            .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
        if (classFilter) q = q.eq('class', classFilter);
        if (query.trim()) {
            if (/^\d+$/.test(query.trim())) q = q.eq('sr_no', parseInt(query));
            else q = q.ilike('name', `%${query}%`);
        }

        const { data: studs } = await q;
        const allStuds: Student[] = studs || [];

        // Fetch dues for these students
        const srNos = allStuds.map(s => s.sr_no);
        let summaries: StudentSummary[] = allStuds.map(s => ({ ...s, totalDue: 0, totalPaid: 0, totalDiscount: 0, balance: 0 }));

        if (srNos.length > 0) {
            const { data: dueData } = await supabase
                .from('previous_year_dues')
                .select('sr_no,due_amount,paid_amount,discount')
                .in('sr_no', srNos);

            (dueData || []).forEach((d: any) => {
                const s = summaries.find(x => x.sr_no === d.sr_no);
                if (s) {
                    s.totalDue     += d.due_amount;
                    s.totalPaid    += d.paid_amount;
                    s.totalDiscount += d.discount;
                    s.balance       = Math.max(0, s.totalDue - s.totalPaid - s.totalDiscount);
                }
            });
        }

        setStudents(summaries);
        setLoading(false);
    }, [query, classFilter, page]);

    useEffect(() => { setPage(0); }, [query, classFilter]);
    useEffect(() => { load(); }, [load]);

    const withDue = students.filter(s => s.balance > 0);
    const cleared = students.filter(s => s.balance === 0 && s.totalDue > 0);
    const noDue   = students.filter(s => s.totalDue === 0);

    const totalOutstanding = students.reduce((s, x) => s + x.balance, 0);

    const renderRow = (s: StudentSummary) => (
        <tr key={s.sr_no}
            onClick={() => onSelectStudent(s)}
            className="hover:bg-primary/5 cursor-pointer transition-colors group border-b border-border/50 last:border-0">
            <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${s.balance > 0 ? 'bg-red-500' : 'bg-emerald-500'}`}>
                        {s.name.charAt(0)}
                    </div>
                    <div>
                        <p className="font-medium group-hover:text-primary transition-colors">{s.name}</p>
                        <p className="text-xs text-muted-foreground">SR {s.sr_no}{s.father_name ? ` · ${s.father_name}` : ''}</p>
                    </div>
                </div>
            </td>
            <td className="px-3 py-3 text-sm text-muted-foreground">{s.class}</td>
            <td className="px-3 py-3 text-right">
                {s.totalDue > 0
                    ? <span className="text-sm font-semibold">{fmtINR(s.totalDue)}</span>
                    : <span className="text-xs text-muted-foreground">—</span>}
            </td>
            <td className="px-3 py-3 text-right">
                {s.totalPaid > 0
                    ? <span className="text-sm font-semibold text-emerald-600">{fmtINR(s.totalPaid)}</span>
                    : <span className="text-xs text-muted-foreground">—</span>}
            </td>
            <td className="px-4 py-3 text-right">
                {s.balance > 0
                    ? <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200">{fmtINR(s.balance)}</span>
                    : s.totalDue > 0
                        ? <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">✓ Clear</span>
                        : <span className="px-2.5 py-1 rounded-full text-xs font-medium text-muted-foreground bg-muted border border-border">No Due</span>}
            </td>
        </tr>
    );

    return (
        <div className="space-y-4 animate-fade-in">
            {/* Summary stats */}
            <div className="grid grid-cols-3 gap-3">
                {[
                    { label: 'Outstanding Balance', value: fmtINR(totalOutstanding), cls: 'text-red-600', bg: 'bg-red-50 border-red-200' },
                    { label: 'Students with Due', value: String(withDue.length), cls: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
                    { label: 'Cleared / No Due', value: String(cleared.length + noDue.length), cls: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' },
                ].map(c => (
                    <div key={c.label} className={`p-3 rounded-2xl border ${c.bg} text-center shadow-sm`}>
                        <p className={`text-xl font-black ${c.cls}`}>{c.value}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{c.label}</p>
                    </div>
                ))}
            </div>

            {/* Search + Filter */}
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input value={query} onChange={e => setQuery(e.target.value)}
                        placeholder="Search by name or SR No…"
                        className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 shadow-sm" />
                </div>
                <div className="relative">
                    <select value={classFilter} onChange={e => setClassFilter(e.target.value)}
                        className="pl-3 pr-8 py-2.5 rounded-xl border border-border bg-card text-sm focus:outline-none appearance-none">
                        <option value="">All Classes</option>
                        {CLASSES.slice(1).map(c => <option key={c}>{c}</option>)}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                </div>
            </div>

            {/* Table */}
            <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="w-6 h-6 animate-spin text-primary mr-2" />
                        <span className="text-muted-foreground text-sm">Loading students…</span>
                    </div>
                ) : students.length === 0 ? (
                    <div className="text-center py-16 text-muted-foreground text-sm">
                        <History className="w-10 h-10 mx-auto mb-3 opacity-30" />
                        No students found
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-border bg-muted/30">
                                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Student</th>
                                    <th className="text-left px-3 py-3 font-medium text-muted-foreground">Class</th>
                                    <th className="text-right px-3 py-3 font-medium text-muted-foreground">Total Due</th>
                                    <th className="text-right px-3 py-3 font-medium text-muted-foreground">Total Paid</th>
                                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Balance</th>
                                </tr>
                            </thead>
                            <tbody>
                                {students.map(renderRow)}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Pagination */}
            {!loading && (
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>{students.length} students shown</span>
                    <div className="flex gap-2">
                        <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
                            className="px-3 py-1.5 rounded-lg border border-border text-xs disabled:opacity-40 hover:bg-muted transition-colors">
                            ← Prev
                        </button>
                        <span className="px-3 py-1.5 text-xs">Page {page + 1}</span>
                        <button disabled={students.length < PAGE_SIZE} onClick={() => setPage(p => p + 1)}
                            className="px-3 py-1.5 rounded-lg border border-border text-xs disabled:opacity-40 hover:bg-muted transition-colors">
                            Next →
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

/* ─── Main Export ─────────────────────────────────────────── */
const PrevYearDueTab: React.FC = () => {
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

    return (
        <div className="animate-fade-in">
            {selectedStudent ? (
                <StudentDetail
                    student={selectedStudent}
                    onBack={() => setSelectedStudent(null)}
                />
            ) : (
                <StudentListView onSelectStudent={setSelectedStudent} />
            )}
        </div>
    );
};

export default PrevYearDueTab;
