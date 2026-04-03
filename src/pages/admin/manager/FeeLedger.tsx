import React, { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/config/supabaseClient';
import AppShell from '@/components/layout/AppShell';
import {
    Search, CheckCircle2, AlertCircle, Trash2,
    BookOpen, Users, TrendingDown, ChevronDown, X, Loader2, Bus, Settings2, History,
} from 'lucide-react';
import TransportFeeTab from './TransportFeeTab';
import FeeStructureTab from './FeeStructureTab';
import PrevYearDueTab from './PrevYearDueTab';
import { CLASSES } from '../students/StudentDirectory';

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
    { key: 'Annual Fee 2026-27', label: 'Annual Fee', type: 'annual', fixedDue: ANNUAL_FEE },
    { key: 'April 2026', label: 'Apr', type: 'tuition', fixedDue: null },
    { key: 'May 2026', label: 'May', type: 'tuition', fixedDue: null },
    { key: 'June 2026', label: 'Jun', type: 'tuition', fixedDue: null },
    { key: 'July 2026', label: 'Jul', type: 'tuition', fixedDue: null },
    { key: 'August 2026', label: 'Aug', type: 'tuition', fixedDue: null },
    { key: 'September 2026', label: 'Sep', type: 'tuition', fixedDue: null },
    { key: 'Exam Fee Term 1', label: 'Exam Fee – Term 1', type: 'exam', fixedDue: EXAM_FEE, divider: true },
    { key: 'October 2026', label: 'Oct', type: 'tuition', fixedDue: null },
    { key: 'November 2026', label: 'Nov', type: 'tuition', fixedDue: null },
    { key: 'December 2026', label: 'Dec', type: 'tuition', fixedDue: null },
    { key: 'January 2027', label: 'Jan', type: 'tuition', fixedDue: null },
    { key: 'February 2027', label: 'Feb', type: 'tuition', fixedDue: null },
    { key: 'March 2027', label: 'Mar', type: 'tuition', fixedDue: null },
    { key: 'Exam Fee Term 2', label: 'Exam Fee – Term 2', type: 'exam', fixedDue: EXAM_FEE, divider: true },
];

/* ─── Types ──────────────────────────────────────────────── */
interface Student {
    sr_no: number; name: string; class: string;
    father_name?: string; mother_name?: string;
    address?: string; phone?: string; roll_no?: string;
    rte?: string; status?: string;
    tuition_discount?: number;
}
interface PayRec { id?: number; created_at?: string; sr_no: number; month: string; due_amount: number; paid_amount: number; paid_on?: string; mode: string; discount?: number; }
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


/* ─── Student Fee Table ────────────────────────────────────── */
const StudentFeeTable: React.FC<{
    student: Student; feeStr: FeeStructure[];
    payments: PayRec[];
    selectedKeys: Set<string>;
    onToggleKey: (key: string) => void;
    otherFeeAmount: string;
    otherFeeReason: string;
    onOtherFeeAmountChange: (v: string) => void;
    onOtherFeeReasonChange: (v: string) => void;
}> = ({ student, feeStr, payments, selectedKeys, onToggleKey, otherFeeAmount, otherFeeReason, onOtherFeeAmountChange, onOtherFeeReasonChange }) => {
    const isRTE = ['yes', 'rte'].includes((student.rte || '').toLowerCase());
    const baseTuition = monthlyFee(student, feeStr);
    const tuition = Math.max(0, baseTuition - (student.tuition_discount || 0));
    const payMap = new Map(payments.map(p => [p.month, p]));

    const rows = BASE_FEE_ROWS.map(r => {
        // RTE students have 0 due for tuition months
        const due = r.fixedDue !== null ? r.fixedDue : (isRTE && r.type === 'tuition' ? 0 : tuition);
        const pay = payMap.get(r.key);
        const paid = pay?.paid_amount || 0;
        const disc = pay?.discount || 0;
        const balance = Math.max(0, due - paid - disc);
        return { ...r, due, paid, disc, balance };
    });

    const totalDue = rows.reduce((s, r) => s + r.due, 0);
    const totalPaid = rows.reduce((s, r) => s + r.paid, 0);
    const totalDisc = rows.reduce((s, r) => s + r.disc, 0);
    const totalBal = totalDue - totalPaid - totalDisc;

    const annualRows = rows.filter(r => r.type === 'annual');
    const examRows = rows.filter(r => r.type === 'exam');
    const tuitionRows = rows.filter(r => r.type === 'tuition');

    const renderPill = (r: typeof rows[0], forceWide = false) => {
        const isPaid = (r.paid + r.disc) >= r.due && r.due > 0;
        const isRTEZero = r.due === 0 && r.paid === 0;
        const isSelected = selectedKeys.has(r.key);
        const isDisabled = isPaid || isRTEZero;

        return (
            <button
                key={r.key}
                disabled={isDisabled}
                onClick={() => onToggleKey(r.key)}
                className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl border transition-all text-center ${forceWide ? 'col-span-12 sm:col-span-6' : ''} ${
                    isPaid
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-600 opacity-60 cursor-not-allowed'
                        : isRTEZero
                            ? 'bg-muted/30 border-border text-muted-foreground opacity-50 cursor-not-allowed'
                            : isSelected
                                ? 'gradient-primary text-white border-transparent shadow-md select-none'
                                : 'bg-background hover:border-primary/40 border-border text-foreground hover:bg-muted/10 select-none'
                }`}
            >
                <span className="text-xs font-bold truncate max-w-full px-1">{r.label}</span>
                <span className={`text-[10px] mt-0.5 ${isSelected ? 'text-white/80' : 'text-muted-foreground'}`}>
                    {isPaid ? 'Paid' : isRTEZero ? '—' : `₹${r.balance}`}
                </span>
            </button>
        );
    };

    return (
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-6">
            
            {annualRows.length > 0 && (
                <div>
                    <label className="text-xs font-medium text-muted-foreground mb-2 flex items-center justify-between">
                        <span>Annual Charges</span>
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {annualRows.map(r => renderPill(r))}
                    </div>
                </div>
            )}

            {tuitionRows.length > 0 && (
                <div>
                    <label className="text-xs font-medium text-muted-foreground mb-2 flex items-center justify-between">
                        <span>Tuition Fee (Monthly)</span>
                        <div className="flex gap-3 text-[10px]">
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-200 block"></span> Paid</span>
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full border border-border block"></span> Unpaid</span>
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full gradient-primary block"></span> Selected</span>
                        </div>
                    </label>
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                        {tuitionRows.map(r => renderPill(r))}
                    </div>
                </div>
            )}

            {examRows.length > 0 && (
                <div>
                    <label className="text-xs font-medium text-muted-foreground mb-2 block">Examination Fees</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {examRows.map(r => renderPill(r))}
                    </div>
                </div>
            )}

            {/* ── Other Fee ─────────────────────────────── */}
            <div className="pt-4 border-t border-border/60">
                <label className="text-xs font-medium text-muted-foreground mb-3 block">Other Fee (Optional)</label>
                <div className="flex gap-2 items-center">
                    <div className="relative w-36 flex-shrink-0">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-bold">₹</span>
                        <input
                            type="number"
                            value={otherFeeAmount}
                            onChange={e => onOtherFeeAmountChange(e.target.value)}
                            className="w-full pl-7 pr-3 py-2 rounded-lg border border-border bg-background text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-primary/40"
                            min={0}
                            placeholder="Amount"
                        />
                    </div>
                    <input
                        type="text"
                        value={otherFeeReason}
                        onChange={e => onOtherFeeReasonChange(e.target.value)}
                        className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary/40"
                        placeholder="Reason (e.g. Late fine, Book fee…)"
                        maxLength={80}
                    />
                </div>
                {Number(otherFeeAmount) > 0 && (
                    <p className="text-[10px] text-primary mt-1.5 font-medium">
                        ₹{Number(otherFeeAmount).toLocaleString('en-IN')} will be added to this transaction{otherFeeReason ? ` — ${otherFeeReason}` : ''}.
                    </p>
                )}
            </div>

            <div className="pt-4 border-t border-border flex flex-wrap items-center justify-between gap-4 text-sm mt-2">
                <div><span className="text-muted-foreground mr-2 text-xs">Total Due:</span><span className="font-semibold">{fmtINR(totalDue)}</span></div>
                <div><span className="text-muted-foreground mr-2 text-xs">Paid:</span><span className="font-semibold text-emerald-600">{fmtINR(totalPaid)}</span></div>
                <div><span className="text-muted-foreground mr-2 text-xs">Balance:</span><span className="font-bold text-red-600">{fmtINR(totalBal)}</span></div>
                <div>
                    {totalBal === 0 && totalDue > 0
                        ? <span className="text-emerald-600 font-bold text-xs bg-emerald-50 px-2 py-1 rounded-md">✓ All Clear</span>
                        : <span className="text-red-600 text-xs bg-red-50 px-2 py-1 rounded-md">{totalDue > 0 ? Math.round((totalPaid / totalDue) * 100) : 0}% collected</span>}
                </div>
            </div>

        </div>
    );
};

/* ─── PRINT RECEIPT COMPONENTS ───────────────────────────── */

export interface FeeReceiptData {
    student: Student;
    items: { label: string; amount: number }[];
    subtotal: number;
    discount: number;
    grandTotal: number;
    receiptNo?: string;
    paymentDate: string;
    paymentMode: string;
    paymentType: 'FULL PAYMENT' | 'PARTIAL PAYMENT';
}

const PrintFeeReceipt: React.FC<{ data: FeeReceiptData | null }> = ({ data }) => {
    if (!data) return null;

    return (
        <div id="fee-receipt-print-area" style={{ display: 'none', fontFamily: 'Arial, sans-serif', padding: '8mm 12mm', color: '#000', background: '#fff' }}>
            {/* School Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, borderBottom: '2px solid #000', paddingBottom: 8, marginBottom: 10 }}>
                <img src="/school-logo.png" alt="Logo" style={{ width: 60, height: 60, objectFit: 'contain' }} />
                <div style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{ fontWeight: 900, fontSize: 18, letterSpacing: 1, textTransform: 'uppercase' }}>
                        S.C.M. CHILDREN ACADEMY
                    </div>
                    <div style={{ fontSize: 11, marginTop: 2 }}>Affiliation No: 2132374 | School Code: 81858</div>
                    <div style={{ fontSize: 11 }}>HALDAUR, BIJNOR</div>
                </div>
            </div>

            {/* Receipt Title */}
            <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: 15, textDecoration: 'underline', marginBottom: 10 }}>
                FEE RECEIPT
            </div>

            {/* Receipt meta */}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 10 }}>
                <div><strong>Receipt No:</strong> {data.receiptNo || 'N/A'}</div>
                <div><strong>Date:</strong> {data.paymentDate}</div>
                <div><strong>Mode:</strong> {data.paymentMode.toUpperCase()}</div>
            </div>

            {/* Payment Type Label */}
            <div style={{ textAlign: 'center', marginBottom: 10 }}>
                <span style={{
                    display: 'inline-block',
                    padding: '3px 14px',
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: 'bold',
                    letterSpacing: 0.5,
                    background: data.paymentType === 'FULL PAYMENT' ? '#d1fae5' : '#fef3c7',
                    color: data.paymentType === 'FULL PAYMENT' ? '#065f46' : '#92400e',
                    border: `1px solid ${data.paymentType === 'FULL PAYMENT' ? '#6ee7b7' : '#fcd34d'}`,
                }}>
                    {data.paymentType}
                </span>
            </div>

            {/* Student Details */}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginBottom: 10 }}>
                <tbody>
                    {[
                        ['Student Name', data.student.name.toUpperCase()],
                        ['SR No.', String(data.student.sr_no)],
                        ['Class', data.student.class],
                        ["Father's Name", data.student.father_name || '—'],
                    ].map(([label, val]) => (
                        <tr key={label}>
                            <td style={{ border: '1px solid #aaa', padding: '4px 8px', fontWeight: 'bold', width: '35%', background: '#f5f5f5' }}>{label}</td>
                            <td style={{ border: '1px solid #aaa', padding: '4px 8px', color: '#104d82', fontWeight: 'bold' }}>{val}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* Fee Details */}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 12 }}>
                <thead>
                    <tr style={{ background: '#daeaf7' }}>
                        <th style={{ border: '1px solid #aaa', padding: '5px 8px', textAlign: 'left' }}>Description</th>
                        <th style={{ border: '1px solid #aaa', padding: '5px 8px', textAlign: 'right' }}>Amount (₹)</th>
                    </tr>
                </thead>
                <tbody>
                    {data.items.map((it, idx) => (
                        <tr key={idx}>
                            <td style={{ border: '1px solid #aaa', padding: '5px 8px' }}>{it.label}</td>
                            <td style={{ border: '1px solid #aaa', padding: '5px 8px', textAlign: 'right', fontWeight: 'bold' }}>₹{it.amount.toFixed(2)}</td>
                        </tr>
                    ))}
                    <tr>
                        <td style={{ border: '1px solid #aaa', padding: '5px 8px' }}>Subtotal</td>
                        <td style={{ border: '1px solid #aaa', padding: '5px 8px', textAlign: 'right', fontWeight: 'bold', color: '#104d82' }}>₹{data.subtotal.toFixed(2)}</td>
                    </tr>
                    {data.discount > 0 && (
                        <tr style={{ background: '#fce7f3' }}>
                            <td style={{ border: '1px solid #aaa', padding: '5px 8px' }}>Discount</td>
                            <td style={{ border: '1px solid #aaa', padding: '5px 8px', textAlign: 'right', color: '#db2777', fontWeight: 'bold' }}>
                                -₹{data.discount.toFixed(2)}
                            </td>
                        </tr>
                    )}
                    <tr style={{ background: '#d1fae5' }}>
                        <td style={{ border: '1px solid #aaa', padding: '5px 8px', fontWeight: 900, fontSize: 14 }}>GRAND TOTAL</td>
                        <td style={{ border: '1px solid #aaa', padding: '5px 8px', textAlign: 'right', fontWeight: 900, fontSize: 14, color: '#065f46' }}>₹{data.grandTotal.toFixed(2)}</td>
                    </tr>
                </tbody>
            </table>

            {/* Signature */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24, fontSize: 11 }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ borderTop: '1px solid #000', width: 120, paddingTop: 4 }}>Parent / Guardian</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ borderTop: '1px solid #000', width: 120, paddingTop: 4 }}>Cashier</div>
                </div>
            </div>
        </div>
    );
};

/* ─── Collect Fee Tab ────────────────────────────────────── */
const CollectFeeTab: React.FC<{ feeStr: FeeStructure[] }> = ({ feeStr }) => {
    const [query, setQuery] = useState('');
    const [classFilter, setClassFilter] = useState('');
    const [results, setResults] = useState<Student[]>([]);
    const [selected, setSelected] = useState<Student | null>(null);
    const [payments, setPayments] = useState<PayRec[]>([]);
    
    const [payMode, setPayMode] = useState<'cash' | 'online' | 'cheque' | 'split'>('cash');
    const [splitCash, setSplitCash] = useState('');
    const [splitOnline, setSplitOnline] = useState('');
    const [splitCheque, setSplitCheque] = useState('');
    const [payAmount, setPayAmount] = useState('');
    const [discountInput, setDiscountInput] = useState('');
    const [saving, setSaving] = useState(false);
    const [saveMsg, setSaveMsg] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);

    const [printData, setPrintData] = useState<FeeReceiptData | null>(null);

    const [searching, setSearching] = useState(false);
    const [loadingPay, setLoadingPay] = useState(false);
    const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
    const [studentDiscount, setStudentDiscount] = useState('0');
    const [savingDiscount, setSavingDiscount] = useState(false);
    const [otherFeeAmount, setOtherFeeAmount] = useState('');
    const [otherFeeReason, setOtherFeeReason] = useState('');

    // Compute exactly what is due based on selected keys
    const baseTuition = selected ? monthlyFee(selected, feeStr) : 0;
    const tuition = Math.max(0, baseTuition - (Number(studentDiscount) || 0));
    const isRTE = selected ? ['yes', 'rte'].includes((selected.rte || '').toLowerCase()) : false;
    const payMap = new Map(payments.map(p => [p.month, p]));
    
    const itemsToCollect = Array.from(selectedKeys).map(k => {
        const r = BASE_FEE_ROWS.find(x => x.key === k)!;
        const due = r.fixedDue !== null ? r.fixedDue : (isRTE && r.type === 'tuition' ? 0 : tuition);
        const paid = payMap.get(r.key)?.paid_amount || 0;
        const disc = payMap.get(r.key)?.discount || 0;
        return { def: r, due, paid, disc };
    }).filter(x => (x.due - x.disc) > x.paid);

    const otherFee = Math.max(0, Number(otherFeeAmount) || 0);
    const totalDue = itemsToCollect.reduce((s, i) => s + (i.due - i.paid - i.disc), 0) + otherFee;
    const transactionDiscount = Number(discountInput) || 0;
    const grandTotal = Math.max(0, totalDue - transactionDiscount);

    // If totalDue changes and hasn't been modified yet, set payAmount to match grandTotal
    useEffect(() => {
        if (grandTotal > 0) {
            setPayAmount(String(grandTotal));
        } else {
            setPayAmount('');
        }
    }, [grandTotal, selectedKeys]);


    const toggleKey = (key: string) => {
        setSelectedKeys(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key); else next.add(key);
            setSaveMsg(null);
            return next;
        });
    };

    const search = useCallback(async (q: string, cls: string) => {
        if (!q.trim() && !cls) { setResults([]); return; }
        setSearching(true);
        const isNum = /^\d+$/.test(q.trim());
        let qb = supabase.from('students').select('sr_no,name,class,father_name,mother_name,address,phone,roll_no,rte,status,tuition_discount').eq('status', 'active');
        if (cls) {
            qb = qb.eq('class', cls);
        }
        if (q.trim()) {
            if (isNum) qb = qb.eq('sr_no', parseInt(q));
            else qb = qb.ilike('name', `%${q}%`);
        }
        const { data } = await qb.limit(10);
        setResults(data || []);
        setSearching(false);
    }, []);

    useEffect(() => {
        const t = setTimeout(() => search(query, classFilter), 300);
        return () => clearTimeout(t);
    }, [query, classFilter, search]);

    const loadPayments = useCallback(async (srNo: number) => {
        setLoadingPay(true);
        const { data } = await supabase.from('fee_payments')
            .select('*')
            .eq('sr_no', srNo)
            .order('created_at', { ascending: false });
        setPayments(data || []);
        setLoadingPay(false);
    }, []);

    const pickStudent = (s: Student) => {
        setSelected(s);
        setQuery(s.name);
        setResults([]);
        setSelectedKeys(new Set()); 
        setSaveMsg(null);
        setStudentDiscount(String(s.tuition_discount || 0));
        setDiscountInput('');
        setOtherFeeAmount('');
        setOtherFeeReason('');
        loadPayments(s.sr_no);
    };

    const handlePrintReceipt = (receiptNo?: string) => {
        if (!selected) return;
        
        const items = [
            ...itemsToCollect.map(i => ({
                label: i.def.label,
                amount: i.due - i.paid - i.disc
            })),
            ...(otherFee > 0 ? [{ label: otherFeeReason || 'Other Fee', amount: otherFee }] : [])
        ];

        const actualReceived = Math.min(Number(payAmount) || 0, grandTotal);
        const effectiveTotal = actualReceived > 0 ? actualReceived : grandTotal;
        const isFullPayment = (effectiveTotal + transactionDiscount) >= totalDue;
        const receipt: FeeReceiptData = {
            student: selected,
            items,
            subtotal: totalDue,
            discount: transactionDiscount,
            grandTotal: effectiveTotal,
            receiptNo: receiptNo || 'TUF-PROFORMA',
            paymentDate: new Date().toISOString().split('T')[0],
            paymentMode: payMode === 'split'
                ? 'Split (' + [
                    (parseFloat(splitCash) || 0) > 0 ? `Cash: ₹${parseFloat(splitCash)}` : '',
                    (parseFloat(splitOnline) || 0) > 0 ? `Online: ₹${parseFloat(splitOnline)}` : '',
                    (parseFloat(splitCheque) || 0) > 0 ? `Cheque: ₹${parseFloat(splitCheque)}` : '',
                ].filter(Boolean).join(', ') + ')'
                : payMode,
            paymentType: isFullPayment ? 'FULL PAYMENT' : 'PARTIAL PAYMENT',
        };

        setPrintData(receipt);

        setTimeout(() => {
            const area = document.getElementById('fee-receipt-print-area');
            if (!area) return;
            area.style.display = 'block';
            const cleanup = () => {
                area.style.display = 'none';
                window.removeEventListener('afterprint', cleanup);
            };
            window.addEventListener('afterprint', cleanup);
            window.print();
        }, 150);
    };

    const handleSave = async () => {
        if (!selected) return;
        let remaining = parseInt(payAmount) || 0;
        if (remaining < 0) remaining = 0;
        if (remaining <= 0 && transactionDiscount <= 0) { 
            setSaveMsg({ type: 'error', text: 'Enter a valid amount or discount' }); 
            return; 
        }
        if (itemsToCollect.length === 0 && otherFee <= 0) {
            setSaveMsg({ type: 'error', text: 'Select months to collect or enter an other fee amount' });
            return;
        }

        let finalPayModeStr = payMode as string;
        if (payMode === 'split') {
            const sc = parseFloat(splitCash) || 0;
            const so = parseFloat(splitOnline) || 0;
            const sq = parseFloat(splitCheque) || 0;
            const splitSum = sc + so + sq;
            const expectedTotal = remaining > 0 ? remaining : transactionDiscount;
            if (splitSum <= 0) {
                setSaveMsg({ type: 'error', text: 'Enter split amounts.' });
                return;
            }
            const parts = [];
            if (sc > 0) parts.push(`Cash: ₹${sc}`);
            if (so > 0) parts.push(`Online: ₹${so}`);
            if (sq > 0) parts.push(`Cheque: ₹${sq}`);
            finalPayModeStr = 'Split (' + parts.join(', ') + ')';
        }

        setSaving(true);
        setSaveMsg(null);

        let totalDiscountPool = transactionDiscount;

        const updates = [];
        for (const item of itemsToCollect) {
            if (remaining <= 0 && totalDiscountPool <= 0) break;
            const itemBal = Math.max(0, item.due - item.paid - item.disc);
            if (itemBal === 0) continue;
            
            // Distribute discount first, then distribute cash remaining
            const applyDisc = Math.min(itemBal, totalDiscountPool);
            totalDiscountPool -= applyDisc;
            const newBalAfterDisc = itemBal - applyDisc;

            const allocate = Math.min(newBalAfterDisc, remaining);
            remaining -= allocate;
            
            updates.push({
                sr_no: selected.sr_no,
                month: item.def.key,
                due_amount: item.due,
                paid_amount: item.paid + allocate,
                discount: item.disc + applyDisc,
                paid_on: new Date().toISOString().split('T')[0],
                mode: finalPayModeStr,
            });
        }

        // Save other fee as a separate record if present
        if (otherFee > 0) {
            const otherKey = `Other: ${otherFeeReason || 'Other Fee'} - ${new Date().toISOString().split('T')[0]}`;
            updates.push({
                sr_no: selected.sr_no,
                month: otherKey,
                due_amount: otherFee,
                paid_amount: Math.min(otherFee, remaining > 0 ? remaining : otherFee),
                discount: 0,
                paid_on: new Date().toISOString().split('T')[0],
                mode: finalPayModeStr,
            });
        }

        if (updates.length > 0) {
            const { data, error } = await supabase.from('fee_payments').upsert(updates, { onConflict: 'sr_no,month' }).select();
            if (error) { 
                setSaveMsg({ type: 'error', text: error.message.includes('discount') 
                  ? 'Error: The database table "fee_payments" is missing the "discount" column. Please run a SQL migration: ALTER TABLE fee_payments ADD COLUMN discount NUMERIC DEFAULT 0;'
                  : error.message 
                }); 
                setSaving(false); 
                return; 
            }
            
            setSaving(false);
            setSaveMsg({ type: 'ok', text: 'Payment recorded successfully' });
            
            // Auto print receipt with structured ledger count
            const { count } = await supabase.from('fee_payments').select('*', { count: 'exact', head: true });
            const baseId = String(count ?? 1).padStart(5, '0');
            const receiptId = `TUF-${baseId}`;
            handlePrintReceipt(receiptId);

            loadPayments(selected.sr_no);
            setSelectedKeys(new Set());
            setDiscountInput('');
            setPayAmount('');
            setOtherFeeAmount('');
            setOtherFeeReason('');
        } else {
            setSaving(false);
        }
    };

    const handleDeleteReceipt = async (id: number) => {
        if (!selected) return;
        if (!confirm('Are you sure you want to delete this payment record? This will revert the month to unpaid.')) return;
        setSaving(true);
        const { error } = await supabase.from('fee_payments').delete().eq('id', id);
        if (error) {
            alert('Failed to delete payment: ' + error.message);
        } else {
            loadPayments(selected.sr_no);
        }
        setSaving(false);
    };

    return (
        <div className="space-y-5 print:space-y-0">
            <style>{`
                @page { size: A5 portrait; margin: 10mm; }
                @media print {
                    body * { visibility: hidden; }
                    #fee-receipt-print-area, #fee-receipt-print-area * { visibility: visible !important; }
                    #fee-receipt-print-area { position: absolute; left: 0; top: 0; width: 100%; display: block !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                }
            `}</style>


            <div className={`grid grid-cols-1 ${selected ? 'lg:grid-cols-12' : ''} gap-6 max-w-7xl mx-auto print:hidden animate-fade-in`}>
                
                {/* ── LEFT COLUMN ────────────────────────────── */}
                <div className={`${selected ? 'lg:col-span-8' : 'w-full max-w-3xl mx-auto'} space-y-5`}>
                    
                    {/* Search & Student Info Box */}
                    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
                        <h3 className="font-semibold text-sm text-muted-foreground mb-3 flex items-center gap-2">
                            <Search className="w-4 h-4" /> Student Selector
                        </h3>
                        <div className="flex gap-3">
                            <div className="w-[140px] flex-shrink-0">
                                <select
                                    value={classFilter}
                                    onChange={e => { setClassFilter(e.target.value); if (selected) setSelected(null); }}
                                    className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 shadow-sm appearance-none"
                                >
                                    <option value="">All Classes</option>
                                    {CLASSES.slice(1).map(c => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <input value={query} onChange={e => { setQuery(e.target.value); if (selected) setSelected(null); }}
                                    placeholder="Search student by name or SR No…"
                                    className="w-full pl-9 pr-10 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 shadow-sm" />
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
                        </div>

                        {selected && (
                            <div className="mt-4 space-y-4">
                                <div className="p-4 bg-muted/40 rounded-xl grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm border border-border/50">
                                    {[
                                        ['Name', selected.name],
                                        ['SR No.', String(selected.sr_no)],
                                        ['Class', selected.class],
                                        ["Father's Name", selected.father_name || '—'],
                                        ['Phone', selected.phone || '—'],
                                        ['Address', selected.address || '—'],
                                    ].map(([label, val]) => (
                                        <div key={label}>
                                            <p className="text-xs text-muted-foreground">{label}</p>
                                            <p className="font-medium truncate">{val}</p>
                                        </div>
                                    ))}
                                </div>
                                <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-100">
                                    <div className="flex items-center justify-between gap-4">
                                        <div>
                                            <p className="text-sm font-semibold text-emerald-900">Student Monthly Dsc.</p>
                                            <p className="text-xs text-emerald-600/80">Save a permanent discount for this student.</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="relative w-32">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-bold">₹</span>
                                                <input
                                                    type="number"
                                                    value={studentDiscount}
                                                    onChange={e => setStudentDiscount(e.target.value)}
                                                    className="w-full pl-7 pr-3 py-2 rounded-lg border border-emerald-200 bg-white text-sm font-semibold text-emerald-800 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                                                    min={0}
                                                />
                                            </div>
                                            {parseFloat(studentDiscount) !== (selected.tuition_discount || 0) && (
                                                <button
                                                    onClick={async () => {
                                                        setSavingDiscount(true);
                                                        await supabase.from('students').update({ tuition_discount: parseFloat(studentDiscount) || 0 }).eq('sr_no', selected.sr_no);
                                                        setSelected(prev => prev ? { ...prev, tuition_discount: parseFloat(studentDiscount) || 0 } : null);
                                                        setSavingDiscount(false);
                                                    }}
                                                    disabled={savingDiscount}
                                                    className="p-2 rounded-lg bg-emerald-600 text-white transition-all hover:bg-emerald-700 disabled:opacity-50"
                                                    title="Save discount to student record"
                                                >
                                                    {savingDiscount ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    
                                    {baseTuition > 0 && (
                                        <div className="flex gap-2 mt-3 pt-3 border-t border-emerald-100/60 flex-wrap">
                                            <span className="text-[10px] font-medium text-emerald-700/80 self-center mr-1">Quick Calc:</span>
                                            {[25, 50, 75].map(pct => {
                                                const amount = Math.round((baseTuition * pct) / 100);
                                                const isSelected = studentDiscount === String(amount);
                                                return (
                                                    <button
                                                        key={pct}
                                                        onClick={() => setStudentDiscount(String(amount))}
                                                        className={`px-3 py-1 text-[11px] font-bold rounded border transition-colors ${
                                                            isSelected
                                                                ? 'bg-emerald-600 text-white border-emerald-600 cursor-default'
                                                                : 'bg-white border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                                                        }`}
                                                    >
                                                        {pct}% OFF (₹{amount})
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Fee Details Table */}
                    {selected && (
                        loadingPay
                            ? <div className="flex items-center gap-2 text-muted-foreground text-sm py-8 justify-center bg-card border border-border rounded-2xl shadow-sm"><Loader2 className="w-5 h-5 animate-spin" /> Loading fee details…</div>
                            : <>
                                {selected.status === 'transferred' && (
                                    <div className="flex items-center gap-3 p-5 bg-red-50 border border-red-200 rounded-2xl text-sm text-red-700 shadow-sm">
                                        <AlertCircle className="w-5 h-5 flex-shrink-0" />
                                        <div>
                                            <p className="font-semibold">Transferred / TC Student</p>
                                            <p className="text-xs text-red-500 mt-0.5">This student has a TC issued. No fee collection applies.</p>
                                        </div>
                                    </div>
                                )}
                                {selected.status !== 'transferred' && (
                                    <StudentFeeTable
                                        student={selected}
                                        feeStr={feeStr}
                                        payments={payments}
                                        selectedKeys={selectedKeys}
                                        onToggleKey={toggleKey}
                                        otherFeeAmount={otherFeeAmount}
                                        otherFeeReason={otherFeeReason}
                                        onOtherFeeAmountChange={setOtherFeeAmount}
                                        onOtherFeeReasonChange={setOtherFeeReason}
                                    />
                                )}
                            </>
                    )}

                    {!selected && (
                        <div className="text-center py-20 text-muted-foreground bg-card border border-border rounded-2xl shadow-sm">
                            <Search className="w-10 h-10 mx-auto mb-3 opacity-30" />
                            <p className="font-medium">Search a student to view their fee card</p>
                        </div>
                    )}
                </div>

                {/* ── RIGHT COLUMN: SUMMARY & HISTORY ────────────────────────────── */}
                {selected && selected.status !== 'transferred' && !loadingPay && (
                    <div className="lg:col-span-4 space-y-5">
                       
                        {/* ── SUMMARY & ACTION CARD ─────────────────────── */}
                        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm sticky top-6">
                            <h3 className="font-semibold text-sm text-foreground mb-4 flex items-center justify-between">
                                <span className="flex items-center gap-2"><span className="text-base text-primary mr-1">₹</span> Payment Summary</span>
                                {selectedKeys.size > 0 && <span className="bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-md border border-primary/20">{selectedKeys.size} Selected</span>}
                            </h3>



                            <div className="space-y-3 pb-4 border-b border-border/60">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-muted-foreground font-medium">Total Balance</span>
                                    <span className="font-bold text-red-600 text-base">{fmtINR(totalDue)}</span>
                                </div>
                                <div className="border-t border-border pt-2 flex justify-between items-center">
                                    <span className="font-bold text-base">Grand Total</span>
                                    <span className="font-black text-lg text-primary">{fmtINR(grandTotal)}</span>
                                </div>
                            </div>

                            <div className="mt-4 space-y-4">
                                <div>
                                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Amount Receiving Here</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-bold">₹</span>
                                        <input
                                            type="number"
                                            value={payAmount}
                                            onChange={e => { setPayAmount(e.target.value); setSaveMsg(null); }}
                                            className="w-full pl-7 pr-3 py-2 rounded-xl border border-border bg-background text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/30"
                                            placeholder="0.00"
                                        />
                                    </div>
                                    <p className="text-[10px] text-muted-foreground mt-1">Amount will cascade across selected rows automatically.</p>
                                </div>

                                <div>
                                    <div className="flex justify-between text-sm items-center py-1">
                                        <label className="text-xs font-medium text-muted-foreground block">Transaction Discount</label>
                                        <div className="relative w-32">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-bold">₹</span>
                                            <input
                                                type="number"
                                                value={discountInput}
                                                onChange={e => setDiscountInput(e.target.value)}
                                                className="w-full pl-7 pr-3 py-1.5 rounded-lg border border-border bg-background text-sm font-bold text-rose-600 focus:outline-none focus:ring-1 focus:ring-primary/30"
                                                min={0}
                                                placeholder="0"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Payment Mode</label>
                                    <div className="grid grid-cols-4 gap-2">
                                        {(['cash', 'online', 'cheque', 'split'] as const).map(m => (
                                            <button key={m} onClick={() => setPayMode(m)}
                                                className={`py-2 rounded-xl text-xs font-medium border transition-all capitalize ${
                                                    payMode === m
                                                        ? 'gradient-primary text-white border-transparent shadow-md'
                                                        : 'border-border text-muted-foreground hover:border-primary/40'
                                                }`}>
                                                {m}
                                            </button>
                                        ))}
                                    </div>

                                    {payMode === 'split' && (
                                        <div className="grid grid-cols-3 gap-3 mt-3 p-3 bg-muted/20 rounded-xl border border-border/80">
                                            <div>
                                                <label className="text-xs font-medium text-muted-foreground mb-1 block">Cash</label>
                                                <input type="number" min={0} value={splitCash} onChange={e => setSplitCash(e.target.value)} placeholder="0" className="w-full px-2 py-2 rounded-lg border border-border text-sm focus:ring-1 focus:ring-primary/40 focus:outline-none bg-background" />
                                            </div>
                                            <div>
                                                <label className="text-xs font-medium text-muted-foreground mb-1 block">Online</label>
                                                <input type="number" min={0} value={splitOnline} onChange={e => setSplitOnline(e.target.value)} placeholder="0" className="w-full px-2 py-2 rounded-lg border border-border text-sm focus:ring-1 focus:ring-primary/40 focus:outline-none bg-background" />
                                            </div>
                                            <div>
                                                <label className="text-xs font-medium text-muted-foreground mb-1 block">Cheque</label>
                                                <input type="number" min={0} value={splitCheque} onChange={e => setSplitCheque(e.target.value)} placeholder="0" className="w-full px-2 py-2 rounded-lg border border-border text-sm focus:ring-1 focus:ring-primary/40 focus:outline-none bg-background" />
                                            </div>
                                            <div className="col-span-3 text-right text-xs mt-1">
                                                Split Total: <span className={`font-bold ${Math.abs(((parseFloat(splitCash) || 0) + (parseFloat(splitOnline) || 0) + (parseFloat(splitCheque) || 0)) - grandTotal) <= 0.01 ? 'text-emerald-600' : 'text-foreground'}`}>
                                                    {fmtINR((parseFloat(splitCash) || 0) + (parseFloat(splitOnline) || 0) + (parseFloat(splitCheque) || 0))}
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {saveMsg && (
                                    <div className={`mt-2 flex items-center gap-2 p-3 rounded-xl text-xs ${
                                        saveMsg.type === 'ok'
                                            ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                                            : 'bg-red-50 border border-red-200 text-red-700'
                                    }`}>
                                        {saveMsg.type === 'ok'
                                            ? <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                                            : <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />}
                                        {saveMsg.text}
                                    </div>
                                )}

                                <button
                                    onClick={handleSave}
                                    disabled={saving || itemsToCollect.length === 0}
                                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl gradient-primary text-white font-semibold text-sm hover:opacity-90 disabled:opacity-50 transition-all shadow-md mt-2"
                                >
                                    {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                                    {!saving && <span>₹</span>}
                                    {saving ? 'Recording…' : 'Record Payment'}
                                </button>
                            </div>


                        </div>

                        {/* Recent Payments History */}
                        {payments.length > 0 && (
                            <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
                                <h3 className="font-semibold text-sm text-muted-foreground mb-4 flex justify-between items-center">
                                    <span>Recent Transactions</span>
                                    <span className="text-xs bg-muted px-2 py-1 rounded text-foreground">{payments.length} items</span>
                                </h3>
                                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                                    {payments.map(p => {
                                        const disc = p.discount || 0;
                                        const isDiscounted = disc > 0 && (p.paid_amount + disc) >= p.due_amount;
                                        const isPartial = !isDiscounted && p.paid_amount < p.due_amount;
                                        return (
                                        <div key={p.id} className="flex justify-between items-center p-3 rounded-xl bg-muted/40 border border-border/50 text-sm">
                                            <div>
                                                <div className="flex items-center gap-2 py-0.5">
                                                    <p className="font-medium">{p.month}</p>
                                                    {isDiscounted && <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-100 text-purple-700 border border-purple-200">Discounted</span>}
                                                    {isPartial && <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700 border border-amber-200">Partial</span>}
                                                </div>
                                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                    <span>{new Date(p.created_at || p.paid_on || '').toLocaleDateString()}</span>
                                                    <span className="w-1 h-1 rounded-full bg-border"></span>
                                                    <span className="uppercase">{p.mode}</span>
                                                    {disc > 0 && <><span className="w-1 h-1 rounded-full bg-border"></span><span className="text-purple-600 font-medium">Disc: {fmtINR(disc)}</span></>}
                                                </div>
                                            </div>
                                            <div className="text-right flex items-center justify-end gap-3">
                                                <p className="font-bold text-emerald-600">{fmtINR(p.paid_amount)}</p>
                                                {p.id && (
                                                    <button onClick={() => handleDeleteReceipt(p.id!)} className="text-red-400 hover:text-red-600 transition-colors" title="Delete payment">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Hidden component simply used by the browser to print the receipt */}
            <PrintFeeReceipt data={printData} />
        </div>
    );
};

/* ─── Ledger Tab ─────────────────────────────────────────── */
const LedgerTab: React.FC<{ refresh: number }> = ({ refresh }) => {
    const [payments, setPayments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [monthFilter, setMonthFilter] = useState('All');
    const [classFilter, setClassFilter] = useState('');
    const [search, setSearch] = useState('');

    const ALL_MONTHS = BASE_FEE_ROWS.map(r => r.key);

    const loadRecords = async () => {
        setLoading(true);
        let q = supabase.from('fee_payments').select(`*, students${classFilter ? '!inner' : ''}(name,class)`).order('created_at', { ascending: false }).range(0, 999);
        if (monthFilter !== 'All') q = q.eq('month', monthFilter);
        if (classFilter) q = q.eq('students.class', classFilter);
        const { data } = await q;
        setPayments((data || []).map((p: any) => ({ ...p, student_name: p.students?.name || '', student_class: p.students?.class || '' })));
        setLoading(false);
    };

    useEffect(() => {
        loadRecords();
    }, [monthFilter, classFilter, refresh]);

    const handleDelete = async (p: any) => {
        if (!confirm('Are you sure you want to delete this payment record?')) return;
        setLoading(true);
        let error;
        if (p.id) {
            ({ error } = await supabase.from('fee_payments').delete().eq('id', p.id));
        }
        // Fallback: delete by sr_no + month if id-based delete failed or id was missing
        if (!p.id || error) {
            ({ error } = await supabase.from('fee_payments').delete().eq('sr_no', p.sr_no).eq('month', p.month));
        }
        if (error) {
            alert('Failed to delete transaction: ' + error.message);
            setLoading(false);
        } else {
            loadRecords();
        }
    };

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
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or SR…"
                        className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div className="relative">
                    <select value={classFilter} onChange={e => setClassFilter(e.target.value)}
                        className="pl-3 pr-8 py-2.5 rounded-xl border border-border bg-card text-sm focus:outline-none appearance-none">
                        <option value="">All Classes</option>
                        {CLASSES.slice(1).map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                </div>
                <div className="relative">
                    <select value={monthFilter} onChange={e => setMonthFilter(e.target.value)}
                        className="pl-3 pr-8 py-2.5 rounded-xl border border-border bg-card text-sm focus:outline-none appearance-none max-w-[150px] truncate">
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
                                    {['Student', 'Fee Item', 'Due', 'Paid', 'Mode', 'Status', 'Actions'].map(h => (
                                        <th key={h} className={`px-4 py-3 font-medium text-muted-foreground ${['Due', 'Paid'].includes(h) ? 'text-right' : h === 'Status' || h === 'Mode' ? 'text-center' : h === 'Actions' ? 'text-right' : 'text-left'}`}>{h}</th>
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
                                            {(p.paid_amount + (p.discount || 0)) >= p.due_amount
                                                ? (p.discount || 0) > 0
                                                    ? <span className="px-2 py-0.5 rounded-full text-xs bg-purple-100 text-purple-700 border border-purple-200 font-semibold">Discounted</span>
                                                    : <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-100 text-emerald-700 border border-emerald-200 font-semibold">Paid</span>
                                                : p.paid_amount > 0
                                                    ? <span className="px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-700 border border-amber-200 font-semibold">Partial</span>
                                                    : <span className="px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700 border border-red-200 font-semibold">Unpaid</span>}
                                        </td>
                                        <td className="px-4 py-2.5 text-right">
                                            <button onClick={() => handleDelete(p)} className="p-1.5 text-red-500 hover:bg-red-50 border border-transparent hover:border-red-100 rounded-lg transition-colors" title="Delete record"><Trash2 className="w-4 h-4" /></button>
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

/* ─── Tuition Fee Tab (Merged) ─────────────────────────────── */
const TuitionFeeTab: React.FC<{ feeStr: FeeStructure[]; refresh: number }> = ({ feeStr, refresh }) => {
    const [activeTab, setActiveTab] = useState<'collect' | 'ledger'>('collect');
    
    return (
        <div className="animate-fade-in">
            <div className="flex bg-muted/50 p-1.5 rounded-2xl w-fit mb-6 mx-auto sm:mx-0 print:hidden mt-2">
                <button
                    onClick={() => setActiveTab('collect')}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                        activeTab === 'collect'
                            ? 'bg-card text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}
                >
                    <span className="font-sans font-bold text-base leading-none">₹</span> Collect Fee
                </button>
                <button
                    onClick={() => setActiveTab('ledger')}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                        activeTab === 'ledger'
                            ? 'bg-card text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}
                >
                    <BookOpen className="w-4 h-4" /> Ledger
                </button>
            </div>
            
            {activeTab === 'collect' && <CollectFeeTab feeStr={feeStr} />}
            {activeTab === 'ledger' && <LedgerTab refresh={refresh} />}
        </div>
    );
};

/* ─── Main Page ──────────────────────────────────────────── */
type Tab = 'tuition' | 'defaulters' | 'prev_year' | 'transport' | 'structure';

const FeeLedger: React.FC = () => {
    const [tab, setTab] = useState<Tab>('tuition');
    const [feeStr, setFeeStr] = useState<FeeStructure[]>([]);
    const [refresh, setRefresh] = useState(0);

    useEffect(() => {
        supabase.from('fee_structure').select('*').then(({ data }) => setFeeStr(data || []));
    }, []);

    const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
        { id: 'tuition', label: 'Tuition Fee', icon: <span className="font-bold text-base leading-none pt-0.5">₹</span> },
        { id: 'defaulters', label: 'Defaulters', icon: <TrendingDown className="w-4 h-4" /> },
        { id: 'prev_year', label: 'Previous Year Due', icon: <History className="w-4 h-4" /> },
        { id: 'transport', label: 'Transport Fee', icon: <Bus className="w-4 h-4" /> },
        { id: 'structure', label: 'Fee Structure', icon: <Settings2 className="w-4 h-4" /> },
    ];

    return (
        <AppShell title="Fee Management" subtitle="SCM Children Academy · 2026–27">
            <div className="flex gap-1 p-1 bg-muted rounded-xl mb-6 w-fit overflow-x-auto max-w-full">
                {TABS.map(t => (
                    <button key={t.id} onClick={() => setTab(t.id)}
                        className={`flex flex-shrink-0 items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                        {t.icon}{t.label}
                    </button>
                ))}
            </div>

            {tab === 'tuition' && <TuitionFeeTab feeStr={feeStr} refresh={refresh} />}
            {tab === 'defaulters' && <DefaultersTab />}
            {tab === 'prev_year' && <PrevYearDueTab />}
            {tab === 'transport' && <TransportFeeTab />}
            {tab === 'structure' && <FeeStructureTab />}
        </AppShell>
    );
};

export default FeeLedger;
