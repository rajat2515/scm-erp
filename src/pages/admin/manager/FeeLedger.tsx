import React, { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/config/supabaseClient';
import AppShell from '@/components/layout/AppShell';
import {
    Search, Printer, CheckCircle2, AlertCircle,
    BookOpen, Users, TrendingDown, ChevronDown, X, Loader2,
} from 'lucide-react';

/* ─── Constants ──────────────────────────────────────────── */
const ANNUAL_FEE = 1200;
const EXAM_FEE = 200;

/* ─── Transport Zone Fee Structure ──────────────────────── */
const TRANSPORT_ZONES = [
    { label: 'No Transport', keywords: [], fee: 0 },
    { label: 'Haldaur', keywords: ['haldaur'], fee: 550 },
    { label: 'Kumarpura, Garhi', keywords: ['kumarpura', 'garhi'], fee: 600 },
    { label: 'Takipura, Bilai, Nagal', keywords: ['takipura', 'bilai', 'nagal'], fee: 650 },
    { label: 'Bisat, Nabada, Mukranpur', keywords: ['bisat', 'nabada', 'mukranpur'], fee: 650 },
    { label: 'Sumalkhedi, Baldhiya', keywords: ['sumalkhedi', 'baldhiya'], fee: 650 },
    { label: 'Kukra, Inampura', keywords: ['kukra', 'inampura'], fee: 600 },
    { label: 'Sultanpur, Safipur Bhogan', keywords: ['sultanpur', 'safipur', 'bhogan'], fee: 650 },
    { label: 'Salmtabad', keywords: ['salmtabad'], fee: 650 },
    { label: 'Shanager, Khairabad, Ladanpur', keywords: ['shanager', 'khairabad', 'ladanpur'], fee: 650 },
];

/** Auto-detect transport zone from student address */
function detectZoneIndex(address?: string): number {
    if (!address) return 0;
    const addr = address.toLowerCase();
    for (let i = 1; i < TRANSPORT_ZONES.length; i++) {
        if (TRANSPORT_ZONES[i].keywords.some(kw => addr.includes(kw))) return i;
    }
    return 0;
}

interface FeeRowDef {
    key: string; label: string;
    type: 'annual' | 'tuition' | 'exam';
    fixedDue: number | null;
    divider?: boolean;
}

const BASE_FEE_ROWS: FeeRowDef[] = [
    { key: 'Annual Fee 2025-26', label: 'Annual Fee', type: 'annual', fixedDue: ANNUAL_FEE },
    { key: 'April 2025', label: 'Apr', type: 'tuition', fixedDue: null },
    { key: 'May 2025', label: 'May', type: 'tuition', fixedDue: null },
    { key: 'June 2025', label: 'Jun', type: 'tuition', fixedDue: null },
    { key: 'July 2025', label: 'Jul', type: 'tuition', fixedDue: null },
    { key: 'August 2025', label: 'Aug', type: 'tuition', fixedDue: null },
    { key: 'September 2025', label: 'Sep', type: 'tuition', fixedDue: null },
    { key: 'Exam Fee Term 1', label: 'Exam Fee – Term 1', type: 'exam', fixedDue: EXAM_FEE, divider: true },
    { key: 'October 2025', label: 'Oct', type: 'tuition', fixedDue: null },
    { key: 'November 2025', label: 'Nov', type: 'tuition', fixedDue: null },
    { key: 'December 2025', label: 'Dec', type: 'tuition', fixedDue: null },
    { key: 'January 2026', label: 'Jan', type: 'tuition', fixedDue: null },
    { key: 'February 2026', label: 'Feb', type: 'tuition', fixedDue: null },
    { key: 'March 2026', label: 'Mar', type: 'tuition', fixedDue: null },
    { key: 'Exam Fee Term 2', label: 'Exam Fee – Term 2', type: 'exam', fixedDue: EXAM_FEE, divider: true },
];

/* ─── Types ──────────────────────────────────────────────── */
interface Student {
    sr_no: number; name: string; class: string;
    father_name?: string; mother_name?: string;
    address?: string; phone?: string; roll_no?: string;
    rte?: string; status?: string;
}
interface PayRec { sr_no: number; month: string; due_amount: number; paid_amount: number; paid_on?: string; mode: string; }
interface FeeStructure { class: string; monthly_fee: number; }

/* ─── Helpers ────────────────────────────────────────────── */
const fmtINR = (n: number) => '₹' + n.toLocaleString('en-IN');

function classToKey(cls: string) {
    return cls.trim().toUpperCase();
}

function monthlyFee(student: Student | null, feeStr: FeeStructure[]): number {
    if (!student) return 0;
    const key = classToKey(student.class);
    return feeStr.find(f => classToKey(f.class) === key)?.monthly_fee || 0;
}

/* ─── Batch Collect Modal ──────────────────────────────────── */
const BatchCollectModal: React.FC<{
    items: { def: FeeRowDef; due: number; paid: number }[];
    student: Student;
    onClose: () => void;
    onSaved: () => void;
}> = ({ items, student, onClose, onSaved }) => {
    const totalDue = items.reduce((s, i) => s + i.due, 0);
    const totalPaid = items.reduce((s, i) => s + i.paid, 0);
    const balance = Math.max(0, totalDue - totalPaid);

    const [amount, setAmount] = useState(String(balance));
    const [payMode, setPayMode] = useState<'cash' | 'online' | 'cheque'>('cash');
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState('');

    const save = async () => {
        let remaining = parseInt(amount);
        if (isNaN(remaining) || remaining <= 0) { setErr('Enter a valid amount'); return; }
        setSaving(true);

        const updates = [];
        for (const item of items) {
            if (remaining <= 0) break;
            const itemBal = Math.max(0, item.due - item.paid);
            if (itemBal === 0) continue;
            
            const allocate = Math.min(itemBal, remaining);
            remaining -= allocate;
            
            updates.push({
                sr_no: student.sr_no,
                month: item.def.key,
                due_amount: item.due,
                paid_amount: item.paid + allocate,
                paid_on: new Date().toISOString().split('T')[0],
                mode: payMode,
            });
        }

        if (updates.length > 0) {
            const { error } = await supabase.from('fee_payments').upsert(updates, { onConflict: 'sr_no,month' });
            if (error) { setErr(error.message); setSaving(false); return; }
        }
        
        setSaving(false);
        onSaved(); onClose();
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-2xl w-full max-w-sm shadow-2xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="font-semibold">Collect Payment</h3>
                    <button onClick={onClose}><X className="w-4 h-4" /></button>
                </div>

                <div className="bg-muted/40 rounded-xl p-3 text-sm space-y-0.5">
                    <p className="font-medium">{student.name} · SR {student.sr_no}</p>
                    <p className="text-muted-foreground">Collecting {items.length} selected row(s)</p>
                    <div className="flex gap-4 mt-1">
                        <span>Total Due: <strong>{fmtINR(totalDue)}</strong></span>
                        <span>Balance: <strong className="text-red-600">{fmtINR(balance)}</strong></span>
                    </div>
                </div>

                {err && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">{err}</p>}

                <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Amount Receiving (₹)</label>
                    <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                        autoFocus />
                </div>

                <div className="grid grid-cols-3 gap-2">
                    {(['cash', 'online', 'cheque'] as const).map(m => (
                        <button key={m} onClick={() => setPayMode(m)}
                            className={`py-2 rounded-xl text-xs font-medium border transition-all capitalize ${payMode === m
                                ? 'gradient-primary text-white border-transparent shadow-md'
                                : 'border-border text-muted-foreground hover:border-primary/40'}`}>
                            {m}
                        </button>
                    ))}
                </div>

                <div className="grid grid-cols-2 gap-2">
                    <button onClick={onClose} className="py-2.5 rounded-xl border border-border text-sm hover:bg-muted transition-colors">Cancel</button>
                    <button onClick={save} disabled={saving}
                        className="py-2.5 rounded-xl gradient-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-1.5">
                        {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        {saving ? 'Saving…' : 'Record ✓'}
                    </button>
                </div>
            </div>
        </div>
    );
};

/* ─── Student Fee Card ───────────────────────────────────── */
const StudentFeeCard: React.FC<{
    student: Student; feeStr: FeeStructure[];
    payments: PayRec[]; onCollectSelected: () => void;
    onPrint: () => void;
    selectedKeys: Set<string>;
    onToggleKey: (key: string) => void;
}> = ({ student, feeStr, payments, onCollectSelected, onPrint, selectedKeys, onToggleKey }) => {
    const isRTE = ['yes', 'rte'].includes((student.rte || '').toLowerCase());
    const tuition = monthlyFee(student, feeStr);
    const payMap = new Map(payments.map(p => [p.month, p]));

    const rows = BASE_FEE_ROWS.map(r => {
        // RTE students have 0 due for tuition months
        const due = r.fixedDue !== null ? r.fixedDue : (isRTE && r.type === 'tuition' ? 0 : tuition);
        const pay = payMap.get(r.key);
        const paid = pay?.paid_amount || 0;
        const balance = Math.max(0, due - paid);
        return { ...r, due, paid, balance };
    });

    const totalDue = rows.reduce((s, r) => s + r.due, 0);
    const totalPaid = rows.reduce((s, r) => s + r.paid, 0);
    const totalBal = totalDue - totalPaid;

    const rowBg = (r: typeof rows[0]) => {
        if (r.type === 'annual') return 'bg-blue-50/50 dark:bg-blue-950/20';
        if (r.type === 'exam') return 'bg-amber-50/50 dark:bg-amber-950/20';
        return '';
    };

    const allKeys = rows.map(r => r.key);
    const allSelected = allKeys.every(k => selectedKeys.has(k));

    return (
        <div className="space-y-4">
            {/* Student Header Card */}
            <div className="bg-card border border-border rounded-2xl p-5">
                <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full gradient-primary flex items-center justify-center text-white font-black text-lg flex-shrink-0">
                            {student.name.charAt(0)}
                        </div>
                        <div>
                            <h2 className="font-bold text-lg text-foreground">{student.name}</h2>
                            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-0.5">
                                <span>SR <strong className="text-foreground">{student.sr_no}</strong></span>
                                {student.roll_no && <span>Roll <strong className="text-foreground">{student.roll_no}</strong></span>}
                                <span>Class <strong className="text-foreground">{student.class}</strong></span>
                                {student.father_name && <span>Father: <strong className="text-foreground">{student.father_name}</strong></span>}
                                {student.mother_name && <span>Mother: <strong className="text-foreground">{student.mother_name}</strong></span>}
                                {student.phone && <span>📞 {student.phone}</span>}
                            </div>
                            {student.address && <p className="text-xs text-muted-foreground mt-0.5">📍 {student.address}</p>}
                        </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                        {selectedKeys.size > 0 && (
                            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                                {selectedKeys.size} row{selectedKeys.size !== 1 ? 's' : ''} selected
                            </span>
                        )}
                        <div className="flex items-center gap-2">
                            {selectedKeys.size > 0 && (
                                <button
                                    onClick={onCollectSelected}
                                    className="flex items-center gap-2 px-4 py-2 rounded-xl gradient-primary text-white text-sm font-medium hover:opacity-90 transition-all flex-shrink-0"
                                >
                                    Collect Selected
                                </button>
                            )}
                            <button
                                onClick={onPrint}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors flex-shrink-0"
                            >
                                <Printer className="w-4 h-4" />
                                Print
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Fee Table */}
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-border bg-muted/30">
                            {/* Select-all checkbox */}
                            <th className="px-3 py-3">
                                <input
                                    type="checkbox"
                                    checked={allSelected}
                                    onChange={() => {
                                        if (allSelected) allKeys.forEach(k => onToggleKey(k));
                                        else allKeys.filter(k => !selectedKeys.has(k)).forEach(k => onToggleKey(k));
                                    }}
                                    className="w-4 h-4 accent-primary cursor-pointer"
                                    title={allSelected ? 'Deselect all' : 'Select all'}
                                />
                            </th>
                            <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Fee Item</th>
                            <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Due</th>
                            <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Paid</th>
                            <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Balance</th>
                            <th className="text-center px-4 py-3 font-semibold text-muted-foreground">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {rows.map(r => (
                            <tr
                                key={r.key}
                                className={`hover:bg-muted/20 transition-colors ${rowBg(r)} ${r.divider ? 'border-t-2 border-border' : ''} ${selectedKeys.has(r.key) ? 'ring-inset ring-1 ring-primary/30' : ''}`}
                            >
                                {/* Checkbox */}
                                <td className="px-3 py-2.5">
                                    <input
                                        type="checkbox"
                                        checked={selectedKeys.has(r.key)}
                                        onChange={() => onToggleKey(r.key)}
                                        className="w-4 h-4 accent-primary cursor-pointer"
                                    />
                                </td>
                                <td className="px-4 py-2.5">
                                    <span className={`font-medium ${r.type === 'exam' ? 'text-amber-700 dark:text-amber-400' : r.type === 'annual' ? 'text-blue-700 dark:text-blue-400' : 'text-foreground'}`}>
                                        {r.label}
                                    </span>
                                </td>
                                <td className="px-4 py-2.5 text-right text-muted-foreground">{fmtINR(r.due)}</td>
                                <td className="px-4 py-2.5 text-right font-medium text-emerald-600">{r.paid > 0 ? fmtINR(r.paid) : '—'}</td>
                                <td className="px-4 py-2.5 text-right font-medium">
                                    {r.balance === 0 && r.paid > 0 ? (
                                        <span className="text-emerald-600">✓ Clear</span>
                                    ) : (
                                        <span className="text-red-600">{fmtINR(r.balance)}</span>
                                    )}
                                </td>
                                <td className="px-4 py-2.5 text-center">
                                    {r.paid >= r.due && r.paid > 0
                                        ? <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-100 text-emerald-700 border border-emerald-200 font-semibold">Paid</span>
                                        : r.paid > 0
                                            ? <span className="px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-700 border border-amber-200 font-semibold">Partial</span>
                                            : <span className="px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700 border border-red-200 font-semibold">Unpaid</span>}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr className="border-t-2 border-border bg-muted/30 font-semibold">
                            <td className="px-3 py-3"></td>
                            <td className="px-4 py-3 text-foreground">Total (2025–26)</td>
                            <td className="px-4 py-3 text-right">{fmtINR(totalDue)}</td>
                            <td className="px-4 py-3 text-right text-emerald-600">{fmtINR(totalPaid)}</td>
                            <td className="px-4 py-3 text-right text-red-600">{fmtINR(totalBal)}</td>
                            <td className="px-4 py-3 text-center">
                                {totalBal === 0
                                    ? <span className="text-emerald-600 font-bold">✓ All Clear</span>
                                    : <span className="text-red-600">{Math.round((totalPaid / totalDue) * 100)}% collected</span>}
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    );
};


const PrintFeeCard: React.FC<{
    student: Student; feeStr: FeeStructure[];
    payments: PayRec[];
    discount: number;
    transportFee: number;
    selectedKeys: Set<string>;
}> = ({ student, feeStr, payments, discount, transportFee, selectedKeys }) => {
    const tuition = monthlyFee(student, feeStr);
    const payMap = new Map(payments.map(p => [p.month, p]));

    const isRTE = ['yes', 'rte'].includes((student.rte || '').toLowerCase());
    const monthDue = isRTE ? 0 : tuition;

    // Each row has a corresponding BASE_FEE_ROWS key (null for transport which is special)
    const rows = [
        { label: 'A.C.Rec.', bg: '#00FFFF', due: ANNUAL_FEE,              rowKey: 'Annual Fee 2025-26' },
        { label: 'Apr',      bg: '#f5e6e6', due: monthDue,                 rowKey: 'April 2025' },
        { label: 'May',      bg: '#f5e6e6', due: monthDue,                 rowKey: 'May 2025' },
        { label: 'Jun',      bg: '#f5e6e6', due: monthDue,                 rowKey: 'June 2025' },
        { label: 'July',     bg: '#e8e6d1', due: monthDue,                 rowKey: 'July 2025' },
        { label: 'Aug',      bg: '#e8e6d1', due: monthDue,                 rowKey: 'August 2025' },
        { label: 'Sep',      bg: '#e8e6d1', due: monthDue,                 rowKey: 'September 2025' },
        { label: 'EXAM FEE1',bg: '#fedcb3', due: EXAM_FEE,                 rowKey: 'Exam Fee Term 1' },
        { label: 'Oct',      bg: '#e6ebf5', due: monthDue,                 rowKey: 'October 2025' },
        { label: 'Nov',      bg: '#e6ebf5', due: monthDue,                 rowKey: 'November 2025' },
        { label: 'Dec',      bg: '#e6ebf5', due: monthDue,                 rowKey: 'December 2025' },
        { label: 'Jan',      bg: '#e6ebf5', due: monthDue,                 rowKey: 'January 2026' },
        { label: 'Feb',      bg: '#e6ebf5', due: monthDue,                 rowKey: 'February 2026' },
        { label: 'Mar',      bg: '#e6ebf5', due: monthDue,                 rowKey: 'March 2026' },
        { label: 'EXAM FEE2',bg: '#fedcb3', due: EXAM_FEE,                 rowKey: 'Exam Fee Term 2' },
        { label: 'Transport Fee', bg: '#e6ebf5', due: isRTE ? 0 : transportFee, rowKey: '__transport__' },
    ];

    // If nothing is selected, show all amounts (fallback). Otherwise only show selected.
    const showAmount = (key: string) => selectedKeys.size === 0 || selectedKeys.has(key);

    const totalFee = rows.reduce((s, r) => s + r.due, 0);
    const totalPaid = payments.reduce((s, p) => s + p.paid_amount, 0); // Include all payments

    const netFee = totalFee - discount;
    const balance = Math.max(0, netFee - totalPaid);

    return (
        <div id="fee-print-area" style={{ display: 'none', fontFamily: 'Arial, sans-serif', padding: '12mm 15mm', color: '#000', backgroundColor: '#fff' }}>
            {/* Header matches Excel format exactly */}
            <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: 16, marginBottom: 8, borderBottom: '2px solid #000', paddingBottom: 4 }}>
                STUDENT FEE CARD 2025-26
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, fontFamily: 'Arial, sans-serif' }}>
                <tbody>
                    <tr>
                        <td style={{ border: '1px solid #000', padding: '4px 8px', width: '30%', fontWeight: 'bold' }}>Roll. No.</td>
                        <td style={{ border: '1px solid #000', padding: '4px 8px', fontWeight: 'bold', backgroundColor: '#FFFF00', color: '#FF0000', textAlign: 'center' }}>
                            {(student.roll_no && student.roll_no !== '0') ? student.roll_no : '—'}
                        </td>
                    </tr>
                    <tr>
                        <td style={{ border: '1px solid #000', padding: '4px 8px', fontWeight: 'bold' }}>Name of Student:</td>
                        <td style={{ border: '1px solid #000', padding: '4px 8px', fontWeight: 'bold', color: '#104d82', textTransform: 'uppercase' }}>
                            {student.name}
                        </td>
                    </tr>
                    <tr>
                        <td style={{ border: '1px solid #000', padding: '4px 8px', fontWeight: 'bold' }}>Class :</td>
                        <td style={{ border: '1px solid #000', padding: '4px 8px', fontWeight: 'bold', color: '#104d82', textTransform: 'uppercase' }}>
                            {student.class}
                        </td>
                    </tr>
                    <tr>
                        <td style={{ border: '1px solid #000', padding: '4px 8px', fontWeight: 'bold' }}>Mother's Name:</td>
                        <td style={{ border: '1px solid #000', padding: '4px 8px', fontWeight: 'bold', color: '#104d82', textTransform: 'uppercase' }}>
                            {student.mother_name || '—'}
                        </td>
                    </tr>
                    <tr>
                        <td style={{ border: '1px solid #000', padding: '4px 8px', fontWeight: 'bold' }}>Father's Name:</td>
                        <td style={{ border: '1px solid #000', padding: '4px 8px', fontWeight: 'bold', color: '#104d82', textTransform: 'uppercase' }}>
                            {student.father_name || '—'}
                        </td>
                    </tr>
                    <tr>
                        <td style={{ border: '1px solid #000', padding: '4px 8px', fontWeight: 'bold' }}>Res. Address:</td>
                        <td style={{ border: '1px solid #000', padding: '4px 8px', fontWeight: 'bold', color: '#104d82', textTransform: 'uppercase' }}>
                            {student.address || '—'}
                        </td>
                    </tr>
                    
                    {/* FEE DETAIL TITLE */}
                    <tr>
                        <td colSpan={2} style={{ border: '1px solid #000', padding: '4px 8px', textAlign: 'center', fontWeight: 'bold', fontSize: 15 }}>
                            FEE DETAIL
                        </td>
                    </tr>

                    {/* FEE ROWS */}
                    {rows.map((r, i) => (
                        <tr key={i}>
                            <td style={{ border: '1px solid #000', padding: '4px 8px', textAlign: 'center', fontWeight: 'bold', backgroundColor: r.bg, color: r.label === 'A.C.Rec.' ? '#000' : '#104d82' }}>
                                {r.label}
                            </td>
                            <td style={{ border: '1px solid #000', padding: '4px 8px', textAlign: 'right', fontWeight: 'bold', color: '#104d82' }}>
                                {showAmount(r.rowKey) && r.due > 0 ? r.due.toFixed(2) : '—'}
                            </td>
                        </tr>
                    ))}

                    {/* STATIC FOOTER ROWS */}
                    <tr>
                        <td style={{ border: '1px solid #000', padding: '4px 8px', textAlign: 'center', fontWeight: 'bold', backgroundColor: '#8aaee0', color: '#104d82' }}>LAST DUE</td>
                        <td style={{ border: '1px solid #000', padding: '4px 8px', textAlign: 'right', fontWeight: 'bold', color: '#104d82' }}></td>
                    </tr>
                    <tr>
                        <td style={{ border: '1px solid #000', padding: '4px 8px', textAlign: 'center', fontWeight: 'bold', backgroundColor: '#8aaee0', color: '#104d82' }}>CLEAR LAST DUE</td>
                        <td style={{ border: '1px solid #000', padding: '4px 8px', textAlign: 'right', fontWeight: 'bold', color: '#104d82' }}></td>
                    </tr>
                    <tr>
                        <td style={{ border: '1px solid #000', padding: '4px 8px', textAlign: 'center', fontWeight: 'bold', backgroundColor: '#8aaee0', color: '#104d82' }}>LESS</td>
                        <td style={{ border: '1px solid #000', padding: '4px 8px', textAlign: 'right', fontWeight: 'bold', color: '#104d82' }}>
                            {discount > 0 ? discount.toFixed(2) : ''}
                        </td>
                    </tr>
                    <tr>
                        <td style={{ border: '1px solid #000', padding: '4px 8px', textAlign: 'center', fontWeight: 'bold', backgroundColor: '#8aaee0', color: '#104d82' }}>TOTAL FEE</td>
                        <td style={{ border: '1px solid #000', padding: '4px 8px', textAlign: 'right', fontWeight: 'bold', color: '#104d82' }}>
                            {netFee.toFixed(2)}
                        </td>
                    </tr>
                    <tr>
                        <td style={{ border: '1px solid #000', padding: '4px 8px', textAlign: 'center', fontWeight: 'bold', backgroundColor: '#8aaee0', color: '#104d82' }}>TOTAL PAID</td>
                        <td style={{ border: '1px solid #000', padding: '4px 8px', textAlign: 'right', fontWeight: 'bold', color: '#104d82' }}>
                            {totalPaid > 0 ? totalPaid.toFixed(2) : ''}
                        </td>
                    </tr>
                    <tr>
                        <td style={{ border: '1px solid #000', padding: '4px 8px', textAlign: 'center', fontWeight: 'bold', backgroundColor: '#8aaee0', color: '#104d82' }}>BALANCE</td>
                        <td style={{ border: '1px solid #000', padding: '4px 8px', textAlign: 'right', fontWeight: 'bold', color: '#104d82' }}>
                            {balance.toFixed(2)}
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
};

/* ─── Collect Fee Tab ────────────────────────────────────── */
const CollectFeeTab: React.FC<{ feeStr: FeeStructure[] }> = ({ feeStr }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<Student[]>([]);
    const [selected, setSelected] = useState<Student | null>(null);
    const [payments, setPayments] = useState<PayRec[]>([]);
    const [showCollectModal, setShowCollectModal] = useState(false);
    
    // Print Modal State
    const [showPrintModal, setShowPrintModal] = useState(false);
    const [printDiscount, setPrintDiscount] = useState<number>(0);
    const [printZoneIdx, setPrintZoneIdx] = useState<number>(0);

    const [searching, setSearching] = useState(false);
    const [loadingPay, setLoadingPay] = useState(false);
    const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
    const printRef = useRef<HTMLDivElement>(null);

    const toggleKey = (key: string) => {
        setSelectedKeys(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key); else next.add(key);
            return next;
        });
    };

    const search = useCallback(async (q: string) => {
        if (!q.trim()) { setResults([]); return; }
        setSearching(true);
        const isNum = /^\d+$/.test(q.trim());
        let qb = supabase.from('students').select('sr_no,name,class,father_name,mother_name,address,phone,roll_no,rte,status');
        if (isNum) qb = qb.eq('sr_no', parseInt(q));
        else qb = qb.ilike('name', `%${q}%`);
        const { data } = await qb.limit(10);
        setResults(data || []);
        setSearching(false);
    }, []);

    useEffect(() => {
        const t = setTimeout(() => search(query), 300);
        return () => clearTimeout(t);
    }, [query, search]);

    const loadPayments = useCallback(async (srNo: number) => {
        setLoadingPay(true);
        const { data } = await supabase.from('fee_payments').select('*').eq('sr_no', srNo);
        setPayments(data || []);
        setLoadingPay(false);
    }, []);

    const pickStudent = (s: Student) => {
        setSelected(s);
        setQuery(s.name);
        setResults([]);
        setSelectedKeys(new Set()); // clear selection on new student
        loadPayments(s.sr_no);
    };

    const handlePrintClick = () => {
        // Auto-detect zone from student address
        const detectedIdx = detectZoneIndex(selected?.address);
        setPrintZoneIdx(detectedIdx);
        setPrintDiscount(0);
        setShowPrintModal(true);
    };

    const triggerPrint = () => {
        setShowPrintModal(false);
        setTimeout(() => {
            const area = document.getElementById('fee-print-area');
            if (!area) return;
            area.style.display = 'block';
            const cleanup = () => {
                area.style.display = 'none';
                window.removeEventListener('afterprint', cleanup);
            };
            window.addEventListener('afterprint', cleanup);
            window.print();
        }, 100);
    };

    return (
        <div className="space-y-5">
            {/* FIXED print CSS: visibility:hidden instead of display:none so children can override. @page removes default margins. */}
            <style>{`
                @page { margin: 10mm; }
                @media print {
                    body * { visibility: hidden; }
                    #fee-print-area, #fee-print-area * { visibility: visible !important; }
                    #fee-print-area { position: absolute; left: 0; top: 0; width: 100%; display: block !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                }
            `}</style>

            {/* Print Options Modal */}
            {showPrintModal && selected && (
                <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-card border border-border rounded-2xl w-full max-w-sm shadow-2xl p-6 space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="font-semibold">Print Fee Card</h3>
                            <button onClick={() => setShowPrintModal(false)}><X className="w-4 h-4" /></button>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">Add temporary charges or discounts just for this print out.</p>

                        <div className="space-y-3 mt-4">
                            {/* Transport zone auto-detected, user can override */}
                            <div>
                                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                                    Transport Zone
                                    {printZoneIdx > 0 && <span className="ml-2 text-emerald-600 font-normal">• Auto-detected</span>}
                                </label>
                                <select
                                    value={printZoneIdx}
                                    onChange={e => setPrintZoneIdx(Number(e.target.value))}
                                    className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                                    {TRANSPORT_ZONES.map((z, i) => (
                                        <option key={i} value={i}>{z.label}{z.fee > 0 ? ` — ₹${z.fee}` : ''}</option>
                                    ))}
                                </select>
                                {printZoneIdx > 0 && (
                                    <p className="text-xs text-muted-foreground mt-1">Fee: <strong>₹{TRANSPORT_ZONES[printZoneIdx].fee}</strong></p>
                                )}
                            </div>
                            <div>
                                <label className="text-xs font-medium text-muted-foreground mb-1 block">LESS / Discount (₹)</label>
                                <input type="number" value={printDiscount || ''} onChange={e => setPrintDiscount(Number(e.target.value))} placeholder="0.00"
                                    className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                            </div>
                            <div className="flex gap-2">
                                {[0, 500, 1000].map(amt => (
                                    <button key={amt} onClick={() => setPrintDiscount(amt)}
                                        className={`flex-1 py-1 text-xs rounded-lg border ${printDiscount === amt ? 'bg-primary/10 border-primary text-primary font-medium' : 'border-border text-muted-foreground'}`}>
                                        {amt === 0 ? 'No Discount' : `₹${amt} off`}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 mt-6">
                            <button onClick={() => setShowPrintModal(false)} className="py-2.5 rounded-xl border border-border text-sm hover:bg-muted transition-colors">Cancel</button>
                            <button onClick={triggerPrint} className="py-2.5 rounded-xl gradient-primary text-white text-sm font-medium hover:opacity-90 flex items-center justify-center gap-2">
                                <Printer className="w-4 h-4" /> Preview & Print
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Search */}
            <div className="relative max-w-lg">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input value={query} onChange={e => { setQuery(e.target.value); setSelected(null); }}
                    placeholder="Search student by name or SR No…"
                    className="w-full pl-9 pr-10 py-2.5 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 shadow-sm" />
                {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />}
                {results.length > 0 && (
                    <div className="absolute top-full mt-1 left-0 right-0 bg-card border border-border rounded-xl shadow-xl z-20 divide-y divide-border overflow-hidden max-h-64 overflow-y-auto">
                        {results.map(s => (
                            <button key={s.sr_no} onClick={() => pickStudent(s)}
                                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted text-left transition-colors">
                                <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                                    {s.name.charAt(0)}
                                </div>
                                <div>
                                    <p className="text-sm font-medium">{s.name}</p>
                                    <p className="text-xs text-muted-foreground">SR {s.sr_no} · Class {s.class}</p>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Fee Card */}
            {selected && (
                loadingPay
                    ? <div className="flex items-center gap-2 text-muted-foreground text-sm py-8 justify-center"><Loader2 className="w-5 h-5 animate-spin" /> Loading fee details…</div>
                     : <>
                        {/* TC / Transferred student warning */}
                        {selected.status === 'transferred' && (
                            <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-2xl text-sm text-red-700">
                                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                                <div>
                                    <p className="font-semibold">Transferred / TC Student</p>
                                    <p className="text-xs text-red-500 mt-0.5">This student has a TC issued. No fee collection applies.</p>
                                </div>
                            </div>
                        )}
                        {/* Show fee card only for non-transferred students */}
                        {selected.status !== 'transferred' && (
                            <StudentFeeCard
                                student={selected}
                                feeStr={feeStr}
                                payments={payments}
                                onCollectSelected={() => setShowCollectModal(true)}
                                onPrint={handlePrintClick}
                                selectedKeys={selectedKeys}
                                onToggleKey={toggleKey}
                            />
                        )}
                        {/* Hidden print version — always rendered so print works */}
                        <PrintFeeCard 
                            student={selected} 
                            feeStr={feeStr} 
                            payments={payments} 
                            discount={printDiscount}
                            transportFee={TRANSPORT_ZONES[printZoneIdx].fee}
                            selectedKeys={selectedKeys}
                        />
                    </>
            )}

            {!selected && (
                <div className="text-center py-20 text-muted-foreground">
                    <Search className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">Search a student to view their fee card</p>
                </div>
            )}

            {showCollectModal && selected && (() => {
                const tuition = monthlyFee(selected, feeStr);
                const payMap = new Map(payments.map(p => [p.month, p]));
                const isRTE = ['yes', 'rte'].includes((selected.rte || '').toLowerCase());
                
                const itemsToCollect = Array.from(selectedKeys).map(k => {
                    const r = BASE_FEE_ROWS.find(x => x.key === k)!;
                    const due = r.fixedDue !== null ? r.fixedDue : (isRTE && r.type === 'tuition' ? 0 : tuition);
                    const paid = payMap.get(r.key)?.paid_amount || 0;
                    return { def: r, due, paid };
                }).filter(x => x.due > x.paid); // Only collect items that have a balance
                
                if (itemsToCollect.length === 0) {
                    setShowCollectModal(false);
                    return null;
                }

                return (
                    <BatchCollectModal
                        items={itemsToCollect}
                        student={selected}
                        onClose={() => setShowCollectModal(false)}
                        onSaved={() => loadPayments(selected.sr_no)}
                    />
                );
            })()}
        </div>
    );
};

/* ─── Ledger Tab ─────────────────────────────────────────── */
const LedgerTab: React.FC<{ refresh: number }> = ({ refresh }) => {
    const [payments, setPayments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [monthFilter, setMonthFilter] = useState('All');
    const [search, setSearch] = useState('');

    const ALL_MONTHS = BASE_FEE_ROWS.map(r => r.key);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            let q = supabase.from('fee_payments').select('*, students(name,class)').order('created_at', { ascending: false }).range(0, 999);
            if (monthFilter !== 'All') q = q.eq('month', monthFilter);
            const { data } = await q;
            setPayments((data || []).map((p: any) => ({ ...p, student_name: p.students?.name || '', student_class: p.students?.class || '' })));
            setLoading(false);
        };
        load();
    }, [monthFilter, refresh]);

    const filtered = payments.filter(p => {
        const q = search.toLowerCase();
        return !q || p.student_name.toLowerCase().includes(q) || String(p.sr_no).includes(q);
    });

    const col = filtered.reduce((s, p) => s + p.paid_amount, 0);
    const due = filtered.reduce((s, p) => s + p.due_amount, 0);

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
                {[
                    { label: 'Collected', value: fmtINR(col), cls: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' },
                    { label: 'Total Due', value: fmtINR(due), cls: 'text-foreground', bg: 'bg-card border-border' },
                    { label: 'Pending', value: fmtINR(due - col), cls: 'text-red-600', bg: 'bg-red-50 border-red-200' },
                ].map(c => (
                    <div key={c.label} className={`p-3 rounded-xl border ${c.bg} text-center`}>
                        <p className={`text-lg font-bold ${c.cls}`}>{c.value}</p>
                        <p className="text-xs text-muted-foreground">{c.label}</p>
                    </div>
                ))}
            </div>
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
                        className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div className="relative">
                    <select value={monthFilter} onChange={e => setMonthFilter(e.target.value)}
                        className="pl-3 pr-8 py-2.5 rounded-xl border border-border bg-card text-sm focus:outline-none appearance-none">
                        <option value="All">All Items</option>
                        {ALL_MONTHS.map(m => <option key={m}>{m}</option>)}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                </div>
            </div>
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-16 text-muted-foreground text-sm">No records found</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-border bg-muted/30">
                                    {['Student', 'Fee Item', 'Due', 'Paid', 'Mode', 'Status'].map(h => (
                                        <th key={h} className={`px-4 py-3 font-medium text-muted-foreground ${['Due', 'Paid'].includes(h) ? 'text-right' : h === 'Status' || h === 'Mode' ? 'text-center' : 'text-left'}`}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {filtered.map(p => (
                                    <tr key={p.id} className="hover:bg-muted/20 transition-colors">
                                        <td className="px-4 py-2.5">
                                            <p className="font-medium">{p.student_name}</p>
                                            <p className="text-xs text-muted-foreground">SR {p.sr_no} · {p.student_class}</p>
                                        </td>
                                        <td className="px-4 py-2.5 text-muted-foreground text-xs">{p.month}</td>
                                        <td className="px-4 py-2.5 text-right">{fmtINR(p.due_amount)}</td>
                                        <td className="px-4 py-2.5 text-right font-semibold text-emerald-600">{fmtINR(p.paid_amount)}</td>
                                        <td className="px-4 py-2.5 text-center capitalize text-xs text-muted-foreground">{p.mode}</td>
                                        <td className="px-4 py-2.5 text-center">
                                            {p.paid_amount >= p.due_amount
                                                ? <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-100 text-emerald-700 border border-emerald-200 font-semibold">Paid</span>
                                                : p.paid_amount > 0
                                                    ? <span className="px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-700 border border-amber-200 font-semibold">Partial</span>
                                                    : <span className="px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700 border border-red-200 font-semibold">Unpaid</span>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

/* ─── Defaulters Tab ─────────────────────────────────────── */
const DefaultersTab: React.FC = () => {
    const [month, setMonth] = useState(BASE_FEE_ROWS[1].key);
    const [classFilter, setClassFilter] = useState('All');
    const [defaulters, setDefaulters] = useState<any[]>([]);
    const [classes, setClasses] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            const { data: students } = await supabase.from('students').select('sr_no,name,class,phone').eq('status', 'active').range(0, 9999);
            const allStu: Student[] = students || [];
            setClasses([...new Set(allStu.map(s => s.class || '').filter(Boolean))].sort());
            const { data: payments } = await supabase.from('fee_payments').select('sr_no,due_amount,paid_amount').eq('month', month);
            const pMap = new Map<number, { due: number; paid: number }>();
            (payments || []).forEach((p: any) => pMap.set(p.sr_no, { due: p.due_amount, paid: p.paid_amount }));
            const def = allStu
                .filter(s => classFilter === 'All' || s.class === classFilter)
                .map(s => { const p = pMap.get(s.sr_no); return { ...s, balance: p ? Math.max(0, p.due - p.paid) : null, hasPaid: !!p }; })
                .filter(s => !s.hasPaid || s.balance! > 0)
                .sort((a, b) => (b.balance || 0) - (a.balance || 0));
            setDefaulters(def);
            setLoading(false);
        };
        load();
    }, [month, classFilter]);

    return (
        <div className="space-y-4">
            <div className="flex gap-2 flex-wrap items-center">
                {[
                    { val: month, set: setMonth, opts: BASE_FEE_ROWS.map(r => ({ v: r.key, l: r.label })) },
                    { val: classFilter, set: setClassFilter, opts: [{ v: 'All', l: 'All Classes' }, ...classes.map(c => ({ v: c, l: c }))] },
                ].map((sel, i) => (
                    <div key={i} className="relative">
                        <select value={sel.val} onChange={e => sel.set(e.target.value)}
                            className="pl-3 pr-8 py-2.5 rounded-xl border border-border bg-card text-sm focus:outline-none appearance-none">
                            {sel.opts.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                        </select>
                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                    </div>
                ))}
                <div className="ml-auto text-sm text-muted-foreground flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-red-500" />
                    <strong className="text-foreground">{defaulters.length}</strong> defaulters
                </div>
            </div>
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
                {loading ? <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
                    : defaulters.length === 0 ? (
                        <div className="text-center py-16 space-y-2">
                            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                            <p className="font-medium">No defaulters!</p>
                            <p className="text-sm text-muted-foreground">All students paid for selected item</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-border bg-muted/30">
                                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Student</th>
                                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Class</th>
                                        <th className="text-center px-4 py-3 font-medium text-muted-foreground">Status</th>
                                        <th className="text-right px-4 py-3 font-medium text-muted-foreground">Balance</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {defaulters.map(s => (
                                        <tr key={s.sr_no} className="hover:bg-muted/20 transition-colors">
                                            <td className="px-4 py-2.5"><p className="font-medium">{s.name}</p><p className="text-xs text-muted-foreground">SR {s.sr_no}</p></td>
                                            <td className="px-4 py-2.5 text-muted-foreground">{s.class}</td>
                                            <td className="px-4 py-2.5 text-center">
                                                <span className="px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700 border border-red-200 font-semibold">
                                                    {s.hasPaid ? 'Partial' : 'Unpaid'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-2.5 text-right font-semibold text-red-600">
                                                {s.balance !== null && s.balance > 0 ? fmtINR(s.balance) : '—'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
            </div>
        </div>
    );
};

/* ─── Main Page ──────────────────────────────────────────── */
type Tab = 'collect' | 'ledger' | 'defaulters';

const FeeLedger: React.FC = () => {
    const [tab, setTab] = useState<Tab>('collect');
    const [feeStr, setFeeStr] = useState<FeeStructure[]>([]);
    const [refresh, setRefresh] = useState(0);

    useEffect(() => {
        supabase.from('fee_structure').select('*').then(({ data }) => setFeeStr(data || []));
    }, []);

    const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
        { id: 'collect', label: 'Collect Fee', icon: <span>₹</span> },
        { id: 'ledger', label: 'Ledger', icon: <BookOpen className="w-4 h-4" /> },
        { id: 'defaulters', label: 'Defaulters', icon: <TrendingDown className="w-4 h-4" /> },
    ];

    return (
        <AppShell title="Fee Management" subtitle="SCM Children Academy · 2025–26">
            <div className="flex gap-1 p-1 bg-muted rounded-xl mb-6 w-fit">
                {TABS.map(t => (
                    <button key={t.id} onClick={() => setTab(t.id)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                        {t.icon}{t.label}
                    </button>
                ))}
            </div>

            {tab === 'collect' && <CollectFeeTab feeStr={feeStr} />}
            {tab === 'ledger' && <LedgerTab refresh={refresh} />}
            {tab === 'defaulters' && <DefaultersTab />}
        </AppShell>
    );
};

export default FeeLedger;
