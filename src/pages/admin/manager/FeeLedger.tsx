import React, { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/config/supabaseClient';
import AppShell from '@/components/layout/AppShell';
import {
    Search, CheckCircle2, AlertCircle, Trash2,
    BookOpen, Users, TrendingDown, ChevronDown, X, Loader2, Bus, Settings2, History,
    Printer, Pencil, Ban,
} from 'lucide-react';
import Swal from 'sweetalert2';
import TransportFeeTab from './TransportFeeTab';
import FeeStructureTab from './FeeStructureTab';
import PrevYearDueTab from './PrevYearDueTab';
import FeeAnalysisTab from './FeeAnalysisTab';
import { CLASSES } from '../students/StudentDirectory';

/* ─── Constants ──────────────────────────────────────────── */
const ANNUAL_FEE = 1200;
const EXAM_FEE = 200;
const ADMISSION_FEE = 3900;

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
    type: 'annual' | 'tuition' | 'exam' | 'admission';
    fixedDue: number | null;
    divider?: boolean;
}

const BASE_FEE_ROWS: FeeRowDef[] = [
    { key: 'Annual Fee 2026-27', label: 'Annual Fee', type: 'annual', fixedDue: ANNUAL_FEE },
    { key: 'Admission Fee 2026-27', label: 'Admission Fee', type: 'admission', fixedDue: ADMISSION_FEE },
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
    is_new_admission?: boolean;
}
interface PayRec { id?: number; created_at?: string; sr_no: number; month: string; due_amount: number; paid_amount: number; paid_on?: string; mode: string; discount?: number; receipt_no?: string; }
interface ReceiptHeader { id: number; receipt_no: string; sr_no: number; payment_date: string; payment_mode: string; total_paid: number; total_discount: number; is_voided: boolean; voided_reason?: string; created_at: string; }
interface FeeStructure { class: string; monthly_fee: number; }

/* ─── Helpers ────────────────────────────────────────────── */
const fmtINR = (n: number) => '₹' + n.toLocaleString('en-IN');

function classToKey(cls: string) {
    return cls.trim().replace(/\s+/g, ' ').toUpperCase();
}

function monthlyFee(student: Student | null, feeStr: FeeStructure[]): number {
    if (!student) return 0;
    const exactKey = classToKey(student.class);
    let fMatch = feeStr.find(f => classToKey(f.class) === exactKey);
    if (!fMatch) {
        const baseKey = exactKey.replace(/\s+[A-Z]$/i, '').trim();
        fMatch = feeStr.find(f => classToKey(f.class) === baseKey);
    }
    return fMatch?.monthly_fee || 0;
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

    // Filter out admission fee row for non-new-admission students
    const applicableFeeRows = BASE_FEE_ROWS.filter(r =>
        r.type !== 'admission' || student.is_new_admission === true
    );

    const rows = applicableFeeRows.map(r => {
        // RTE students have 0 due for tuition months
        const baseDue = r.fixedDue !== null ? r.fixedDue : (isRTE && r.type === 'tuition' ? 0 : tuition);
        const pay = payMap.get(r.key);
        const due = pay?.due_amount !== undefined ? pay.due_amount : baseDue;
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
    const admissionRows = rows.filter(r => r.type === 'admission');
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
                        {admissionRows.map(r => renderPill(r))}
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
        <>
            <style>{`
                @page { size: A5 portrait; margin: 10mm; }
                @media print {
                    body * { visibility: hidden !important; }
                    #fee-receipt-print-area, #fee-receipt-print-area * { visibility: visible !important; }
                    #fee-receipt-print-area { 
                        position: absolute !important; 
                        left: 0 !important; 
                        top: 0 !important; 
                        width: 148mm !important; 
                        display: block !important; 
                        background: #fff !important;
                        -webkit-print-color-adjust: exact !important; 
                        print-color-adjust: exact !important; 
                    }
                }
            `}</style>
            <div id="fee-receipt-print-area" style={{ display: 'none', fontFamily: 'Arial, sans-serif', padding: '8mm 12mm', color: '#000', background: '#fff', width: '148mm', margin: '0 auto' }}>
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
        </>
    );
};

/* ─── Previous Due Row type (local) ──────────────────────── */
interface PrevDueRow {
    id?: number;
    sr_no: number;
    academic_year: string;
    month: string;
    fee_type: string;
    due_amount: number;
    paid_amount: number;
    discount: number;
    paid_on?: string;
    mode?: string;
}

/* ─── Collect Fee Tab ────────────────────────────────────── */
const CollectFeeTab: React.FC<{ feeStr: FeeStructure[], editReceipt?: ReceiptHeader | null, onCancelEdit?: () => void }> = ({ feeStr, editReceipt, onCancelEdit }) => {
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
    const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split('T')[0]);

    // Previous year dues
    const [prevDues, setPrevDues] = useState<PrevDueRow[]>([]);
    const [prevDueCollect, setPrevDueCollect] = useState('');

    // Compute exactly what is due based on selected keys
    const baseTuition = selected ? monthlyFee(selected, feeStr) : 0;
    const tuition = Math.max(0, baseTuition - (Number(studentDiscount) || 0));
    const isRTE = selected ? ['yes', 'rte'].includes((selected.rte || '').toLowerCase()) : false;
    
    // Ignore payments belonging to the receipt currently being edited
    const activePayments = editReceipt 
        ? payments.filter(p => p.receipt_no !== editReceipt.receipt_no) 
        : payments;
        
    const payMap = new Map(activePayments.map(p => [p.month, p]));
    
    // Filter fee rows applicable to this student (exclude admission for non-new-admission)
    const applicableFeeRows = BASE_FEE_ROWS.filter(r =>
        r.type !== 'admission' || selected?.is_new_admission === true
    );
    const itemsToCollect = Array.from(selectedKeys).map(k => {
        const r = applicableFeeRows.find(x => x.key === k)!;
        if (!r) return null;
        const pay = payMap.get(r.key);
        const baseDue = r.fixedDue !== null ? r.fixedDue : (isRTE && r.type === 'tuition' ? 0 : tuition);
        const due = pay?.due_amount !== undefined ? pay.due_amount : baseDue;
        const paid = pay?.paid_amount || 0;
        const disc = pay?.discount || 0;
        return { def: r, due, paid, disc };
    }).filter((x): x is NonNullable<typeof x> => x !== null && (x.due - x.disc) > x.paid);

    const otherFee = Math.max(0, Number(otherFeeAmount) || 0);
    const prevDueCollectAmt = Math.max(0, Number(prevDueCollect) || 0);

    // Total outstanding previous dues
    const totalPrevDueBalance = prevDues.reduce((s, d) => s + Math.max(0, d.due_amount - d.paid_amount - d.discount), 0);

    const currentFeeTotal = itemsToCollect.reduce((s, i) => s + (i.due - i.paid - i.disc), 0) + otherFee;
    const totalDue = currentFeeTotal + prevDueCollectAmt;
    const transactionDiscount = Number(discountInput) || 0;
    const grandTotal = Math.max(0, totalDue - transactionDiscount);

    // If totalDue changes and hasn't been modified yet, set payAmount to match grandTotal
    useEffect(() => {
        if (grandTotal > 0) {
            setPayAmount(String(grandTotal));
        } else {
            setPayAmount('');
        }
    }, [grandTotal, selectedKeys, prevDueCollect]);


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
        let qb = supabase.from('students').select('sr_no,name,class,father_name,mother_name,address,phone,roll_no,rte,status,tuition_discount,is_new_admission').eq('status', 'active');
        if (cls) {
            // Use ilike and replace spaces with % to handle arbitrary spacing in the db
            qb = qb.ilike('class', cls.replace(/\s+/g, '%'));
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

    const loadPrevDues = useCallback(async (srNo: number) => {
        const { data } = await supabase
            .from('previous_year_dues')
            .select('*')
            .eq('sr_no', srNo)
            .order('academic_year', { ascending: true })
            .order('month', { ascending: true });
        setPrevDues((data as PrevDueRow[]) || []);
    }, []);

    // HYDRATION LOGIC FOR EDIT MODE
    useEffect(() => {
        if (!editReceipt) return;
        
        const hydrate = async () => {
            setSaving(true);
            const { data: sData } = await supabase.from('students').select('*').eq('sr_no', editReceipt.sr_no).single();
            if (!sData) {
                setSaving(false); return;
            }
            
            const { data: pData } = await supabase.from('fee_payments').select('*').eq('receipt_no', editReceipt.receipt_no);
            const rLines = pData || [];
            
            setSelected(sData);
            setQuery(sData.name);
            setResults([]);
            setSaveMsg(null);
            setStudentDiscount(String(sData.tuition_discount || 0));
            setDiscountInput(String(editReceipt.total_discount || 0));
            setPayAmount(String(editReceipt.total_paid || 0));
            setPaymentDate(editReceipt.payment_date || new Date().toISOString().split('T')[0]);
            
            if (editReceipt.payment_mode.startsWith('Split')) {
                setPayMode('split');
                const cashMatch = editReceipt.payment_mode.match(/Cash: ₹([\\d.]+)/);
                const onlineMatch = editReceipt.payment_mode.match(/Online: ₹([\\d.]+)/);
                const chequeMatch = editReceipt.payment_mode.match(/Cheque: ₹([\\d.]+)/);
                if (cashMatch) setSplitCash(cashMatch[1]);
                if (onlineMatch) setSplitOnline(onlineMatch[1]);
                if (chequeMatch) setSplitCheque(chequeMatch[1]);
            } else {
                setPayMode(editReceipt.payment_mode as any);
            }

            const keys = new Set<string>();
            let oFee = '';
            let oReason = '';
            let pDue = '';

            for (const l of rLines) {
                if (l.month.startsWith('Other: ')) {
                    oFee = String(l.paid_amount);
                    oReason = l.month.replace('Other: ', '').split(' - ')[0];
                } else if (l.month.startsWith('Previous Dues - ')) {
                    pDue = String(l.paid_amount);
                } else {
                    keys.add(l.month);
                }
            }

            setOtherFeeAmount(oFee);
            setOtherFeeReason(oReason);
            setPrevDueCollect(pDue);
            setSelectedKeys(keys);

            await loadPayments(sData.sr_no);
            await loadPrevDues(sData.sr_no);
            
            setSaving(false);
        };
        hydrate();
    }, [editReceipt, loadPayments, loadPrevDues]);

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
        setPrevDueCollect('');
        setPrevDues([]);
        loadPayments(s.sr_no);
        loadPrevDues(s.sr_no);
    };

    const handlePrintReceipt = (receiptNo?: string) => {
        if (!selected) return;
        
        const items = [
            ...itemsToCollect.map(i => ({
                label: i.def.label,
                amount: i.due - i.paid - i.disc
            })),
            ...(otherFee > 0 ? [{ label: otherFeeReason || 'Other Fee', amount: otherFee }] : []),
            ...(prevDueCollectAmt > 0 ? [{ label: 'Previous Year Dues', amount: prevDueCollectAmt }] : []),
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
            paymentDate: paymentDate,
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
        if (itemsToCollect.length === 0 && otherFee <= 0 && prevDueCollectAmt <= 0) {
            setSaveMsg({ type: 'error', text: 'Select months to collect, enter an other fee amount, or a previous due amount' });
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

        // If editing, reverse old previous dues and delete old payments first
        if (editReceipt) {
            const { data: recData } = await supabase.from('fee_payments').select('*').eq('receipt_no', editReceipt.receipt_no).ilike('month', 'Previous Dues%').single();
            if (recData && recData.paid_amount > 0) {
                const amountToReverse = recData.paid_amount as number;
                const { data: pDues } = await supabase.from('previous_year_dues').select('*').eq('sr_no', selected.sr_no).order('academic_year', { ascending: false }).order('month', { ascending: false });
                if (pDues && pDues.length > 0) {
                    let toReverse = amountToReverse;
                    const reversals: Partial<PrevDueRow>[] = [];
                    for (const due of pDues as PrevDueRow[]) {
                        if (toReverse <= 0) break;
                        if (due.paid_amount <= 0) continue;
                        const deduct = Math.min(due.paid_amount, toReverse);
                        toReverse -= deduct;
                        reversals.push({
                            id: due.id, sr_no: due.sr_no, academic_year: due.academic_year, month: due.month, fee_type: due.fee_type,
                            due_amount: due.due_amount, paid_amount: Math.max(0, due.paid_amount - deduct), discount: due.discount
                        });
                    }
                    if (reversals.length > 0) await supabase.from('previous_year_dues').upsert(reversals, { onConflict: 'sr_no,academic_year,month' });
                }
            }
            await supabase.from('fee_payments').delete().eq('receipt_no', editReceipt.receipt_no);
        }

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
                paid_on: paymentDate,
                mode: finalPayModeStr,
            });
        }

        // Save other fee as a separate record if present
        if (otherFee > 0) {
            const otherKey = `Other: ${otherFeeReason || 'Other Fee'} - ${paymentDate}`;
            updates.push({
                sr_no: selected.sr_no,
                month: otherKey,
                due_amount: otherFee,
                paid_amount: Math.min(otherFee, remaining > 0 ? remaining : otherFee),
                discount: 0,
                paid_on: paymentDate,
                mode: finalPayModeStr,
            });
        }

        // ── Previous Dues: distribute collected amount across oldest-first unpaid rows ──
        if (prevDueCollectAmt > 0) {
            let prevToClear = prevDueCollectAmt;
            let prevDiscountAppliedTotal = 0;
            let prevCashAppliedTotal = 0;
            const prevUpdates: Partial<PrevDueRow>[] = [];

            for (const due of prevDues) {
                if (prevToClear <= 0) break;
                const bal = Math.max(0, due.due_amount - due.paid_amount - due.discount);
                if (bal <= 0) continue;
                
                const clearAmount = Math.min(bal, prevToClear);
                prevToClear -= clearAmount;

                const applyDisc = Math.min(clearAmount, totalDiscountPool);
                totalDiscountPool -= applyDisc;
                prevDiscountAppliedTotal += applyDisc;

                const applyCash = clearAmount - applyDisc;
                remaining -= applyCash;
                prevCashAppliedTotal += applyCash;

                prevUpdates.push({
                    id: due.id,
                    sr_no: due.sr_no,
                    academic_year: due.academic_year,
                    month: due.month,
                    fee_type: due.fee_type as PrevDueRow['fee_type'],
                    due_amount: due.due_amount,
                    paid_amount: due.paid_amount + applyCash,
                    discount: (due.discount || 0) + applyDisc,
                    paid_on: paymentDate,
                    mode: finalPayModeStr,
                });
            }

            if (prevUpdates.length > 0) {
                const { error: prevErr } = await supabase
                    .from('previous_year_dues')
                    .upsert(prevUpdates, { onConflict: 'sr_no,academic_year,month' });
                if (prevErr) {
                    setSaveMsg({ type: 'error', text: 'Error saving previous dues: ' + prevErr.message });
                    setSaving(false);
                    return;
                }
            }

            // Also add a summary row to fee_payments so it shows in the ledger/receipt
            updates.push({
                sr_no: selected.sr_no,
                month: `Previous Dues - ${paymentDate}`,
                due_amount: prevDueCollectAmt,
                paid_amount: prevCashAppliedTotal,
                discount: prevDiscountAppliedTotal,
                paid_on: paymentDate,
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
            
            // ── Generate receipt via immutable header table ──
            let headerData: { id: number } | null = null;
            let headerErr = null;
            
            if (editReceipt) {
                // Edit mode: just update the existing header
                const { data, error } = await supabase
                    .from('fee_receipt_headers')
                    .update({
                        payment_date: paymentDate,
                        payment_mode: finalPayModeStr,
                        total_paid: grandTotal,
                        total_discount: transactionDiscount,
                    })
                    .eq('id', editReceipt.id)
                    .select('id')
                    .single();
                headerData = data;
                headerErr = error;
            } else {
                // 1. Insert a stub header to claim the next auto-increment id
                const tempReceiptNo = `PENDING-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
                const { data, error } = await supabase
                    .from('fee_receipt_headers')
                    .insert({
                        receipt_no: tempReceiptNo,
                        sr_no: selected.sr_no,
                        payment_date: paymentDate,
                        payment_mode: finalPayModeStr,
                        total_paid: grandTotal,
                        total_discount: transactionDiscount,
                    })
                    .select('id')
                    .single();
                headerData = data;
                headerErr = error;
            }

            if (headerErr) {
                console.error("Header creation error:", headerErr);
                Swal.fire('Warning', 'Payment saved, but failed to generate receipt number: ' + headerErr.message, 'warning');
            }

            let receiptId = 'TUF-PROFORMA';
            if (headerData && !headerErr) {
                receiptId = editReceipt ? editReceipt.receipt_no : `TUF-${String(headerData.id).padStart(5, '0')}`;
                
                if (!editReceipt) {
                    // 2. Update the header with the real receipt_no
                    await supabase.from('fee_receipt_headers')
                        .update({ receipt_no: receiptId })
                        .eq('id', headerData.id);
                }
                // 3. Tag all fee_payments rows with this receipt_no
                const months = updates.map(u => u.month);
                await supabase.from('fee_payments')
                    .update({ receipt_no: receiptId })
                    .eq('sr_no', selected.sr_no)
                    .in('month', months);
            }
            handlePrintReceipt(receiptId);

            // Auto-clear is_new_admission if admission fee is fully paid
            if (selected.is_new_admission) {
                const admKey = 'Admission Fee 2026-27';
                const admUpdate = updates.find(u => u.month === admKey);
                if (admUpdate && (admUpdate.paid_amount + (admUpdate.discount || 0)) >= admUpdate.due_amount) {
                    await supabase.from('students').update({ is_new_admission: false }).eq('sr_no', selected.sr_no);
                    setSelected(prev => prev ? { ...prev, is_new_admission: false } : null);
                } else {
                    // Also check existing payment record
                    const { data: admRec } = await supabase.from('fee_payments').select('*').eq('sr_no', selected.sr_no).eq('month', admKey).single();
                    if (admRec && (admRec.paid_amount + (admRec.discount || 0)) >= admRec.due_amount) {
                        await supabase.from('students').update({ is_new_admission: false }).eq('sr_no', selected.sr_no);
                        setSelected(prev => prev ? { ...prev, is_new_admission: false } : null);
                    }
                }
            }

            loadPayments(selected.sr_no);
            loadPrevDues(selected.sr_no);
            setSelectedKeys(new Set());
            setDiscountInput('');
            setPayAmount('');
            setOtherFeeAmount('');
            setOtherFeeReason('');
            setPrevDueCollect('');
            if (editReceipt && onCancelEdit) onCancelEdit();
        } else {
            setSaving(false);
        }
    };

    const handleDeleteReceipt = async (id: number) => {
        if (!selected) return;
        const result = await Swal.fire({
            title: 'Delete payment record?',
            text: 'Are you sure you want to delete this payment record? This will revert the month to unpaid.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Yes, delete it!'
        });

        if (result.isConfirmed) {
            setSaving(true);

            // Fetch the record before deleting so we can reverse previous dues if needed
            const { data: recData } = await supabase.from('fee_payments').select('*').eq('id', id).single();

            const { error } = await supabase.from('fee_payments').delete().eq('id', id);
            if (error) {
                Swal.fire('Error!', 'Failed to delete payment: ' + error.message, 'error');
            } else {
                // If this was a Previous Dues summary row, reverse the paid_amount in previous_year_dues
                if (recData && String(recData.month).startsWith('Previous Dues')) {
                    const amountToReverse = recData.paid_amount as number;
                    const { data: pDues } = await supabase
                        .from('previous_year_dues')
                        .select('*')
                        .eq('sr_no', selected.sr_no)
                        .order('academic_year', { ascending: false })
                        .order('month', { ascending: false });

                    if (pDues && pDues.length > 0) {
                        let toReverse = amountToReverse;
                        const reversals: Partial<PrevDueRow>[] = [];
                        for (const due of pDues as PrevDueRow[]) {
                            if (toReverse <= 0) break;
                            if (due.paid_amount <= 0) continue;
                            const deduct = Math.min(due.paid_amount, toReverse);
                            toReverse -= deduct;
                            reversals.push({
                                id: due.id,
                                sr_no: due.sr_no,
                                academic_year: due.academic_year,
                                month: due.month,
                                fee_type: due.fee_type,
                                due_amount: due.due_amount,
                                paid_amount: Math.max(0, due.paid_amount - deduct),
                                discount: due.discount,
                            });
                        }
                        if (reversals.length > 0) {
                            await supabase.from('previous_year_dues').upsert(reversals, { onConflict: 'sr_no,academic_year,month' });
                        }
                        loadPrevDues(selected.sr_no);
                    }
                }
                Swal.fire('Deleted!', 'Payment record has been removed.', 'success');
                loadPayments(selected.sr_no);
            }
            setSaving(false);
        }
    };

    return (
        <div className="space-y-5 print:space-y-0">


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

                            {editReceipt && (
                                <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between">
                                    <div>
                                        <p className="text-xs font-bold text-amber-900">Editing {editReceipt.receipt_no}</p>
                                        <p className="text-[10px] text-amber-700">Changes will overwrite this receipt.</p>
                                    </div>
                                    <button onClick={onCancelEdit} className="px-2 py-1 bg-amber-200 hover:bg-amber-300 rounded text-[10px] font-bold text-amber-900 transition-colors">
                                        Cancel
                                    </button>
                                </div>
                            )}



                            {/* Previous Dues Alert Banner */}
                            {totalPrevDueBalance > 0 && (
                                <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                                    <div className="flex items-start justify-between gap-2">
                                        <div>
                                            <p className="text-xs font-semibold text-amber-800 flex items-center gap-1">
                                                <History className="w-3.5 h-3.5" /> Previous Year Dues Outstanding
                                            </p>
                                            <p className="text-sm font-black text-amber-900 mt-0.5">{fmtINR(totalPrevDueBalance)}</p>
                                        </div>
                                    </div>
                                    <div className="mt-2">
                                        <label className="text-[10px] font-medium text-amber-700 block mb-1">Collect Now (partial or full)</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-700 text-sm font-bold">₹</span>
                                            <input
                                                type="number"
                                                min={0}
                                                max={totalPrevDueBalance}
                                                value={prevDueCollect}
                                                onChange={e => setPrevDueCollect(e.target.value)}
                                                placeholder="0"
                                                className="w-full pl-7 pr-3 py-1.5 rounded-lg border border-amber-300 bg-white text-sm font-bold text-amber-900 focus:outline-none focus:ring-2 focus:ring-amber-400/40"
                                            />
                                        </div>
                                        <div className="flex gap-1 mt-1.5 flex-wrap">
                                            <button onClick={() => setPrevDueCollect(String(totalPrevDueBalance))}
                                                className="px-2 py-0.5 text-[10px] font-semibold rounded border border-amber-200 bg-amber-100 text-amber-800 hover:bg-amber-200 transition-colors">
                                                Full ({fmtINR(totalPrevDueBalance)})
                                            </button>
                                            {[25, 50].map(pct => {
                                                const amt = Math.round(totalPrevDueBalance * pct / 100);
                                                return (
                                                    <button key={pct} onClick={() => setPrevDueCollect(String(amt))}
                                                        className="px-2 py-0.5 text-[10px] font-semibold rounded border border-amber-200 bg-amber-100 text-amber-800 hover:bg-amber-200 transition-colors">
                                                        {pct}% ({fmtINR(amt)})
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-3 pb-4 border-b border-border/60">
                                {currentFeeTotal > 0 && (
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-muted-foreground font-medium">Current Fees</span>
                                        <span className="font-semibold text-foreground">{fmtINR(currentFeeTotal)}</span>
                                    </div>
                                )}
                                {prevDueCollectAmt > 0 && (
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-amber-700 font-medium">Previous Dues</span>
                                        <span className="font-semibold text-amber-700">{fmtINR(prevDueCollectAmt)}</span>
                                    </div>
                                )}
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-muted-foreground font-medium">Total to Collect</span>
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
                                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Payment Date</label>
                                    <input 
                                        type="date" 
                                        value={paymentDate} 
                                        onChange={e => setPaymentDate(e.target.value)} 
                                        className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/30 mb-4"
                                    />
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
                                    disabled={saving || (itemsToCollect.length === 0 && otherFee <= 0 && prevDueCollectAmt <= 0)}
                                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl gradient-primary text-white font-semibold text-sm hover:opacity-90 disabled:opacity-50 transition-all shadow-md mt-2"
                                >
                                    {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                                    {!saving && <span>₹</span>}
                                    {saving ? (editReceipt ? 'Updating…' : 'Recording…') : (editReceipt ? 'Update Payment' : 'Record Payment')}
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
                                        <div key={p.id} className="p-3 rounded-xl bg-muted/40 border border-border/50 text-sm space-y-1.5">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <p className="font-medium">{p.month}</p>
                                                        {isDiscounted && <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-100 text-purple-700 border border-purple-200">Discounted</span>}
                                                        {isPartial && <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700 border border-amber-200">Partial</span>}
                                                    </div>
                                                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                                        <span>{new Date(p.paid_on || p.created_at || '').toLocaleDateString()}</span>
                                                        <span className="w-1 h-1 rounded-full bg-border"></span>
                                                        <span className="uppercase">{p.mode}</span>
                                                        {disc > 0 && <><span className="w-1 h-1 rounded-full bg-border"></span><span className="text-purple-600 font-medium">Disc: {fmtINR(disc)}</span></>}
                                                    </div>
                                                </div>
                                                <div className="text-right flex items-center gap-2">
                                                    <p className="font-bold text-emerald-600">{fmtINR(p.paid_amount)}</p>
                                                    {p.receipt_no && (
                                                        <button
                                                            onClick={() => handlePrintReceipt(p.receipt_no)}
                                                            className="p-1.5 text-primary/60 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                                                            title={`Reprint ${p.receipt_no}`}
                                                        >
                                                            <Printer className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                            {p.receipt_no && (
                                                <p className="text-[10px] font-mono text-muted-foreground/70">🧾 {p.receipt_no}</p>
                                            )}
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
const LedgerTab: React.FC<{ refresh: number; onPrint: (data: FeeReceiptData) => void; onEditReceipt: (h: ReceiptHeader) => void }> = ({ refresh, onPrint, onEditReceipt }) => {
    const [headers, setHeaders] = useState<(ReceiptHeader & { student_name: string; student_class: string })[]>([]);
    const [loading, setLoading] = useState(true);
    const [classFilter, setClassFilter] = useState('');
    const [search, setSearch] = useState('');

    const loadRecords = async () => {
        setLoading(true);
        let q = supabase
            .from('fee_receipt_headers')
            .select(`*, students${classFilter ? '!inner' : ''}(name,class)`)
            .order('id', { ascending: false })
            .range(0, 499);
        if (classFilter) q = (q as any).eq('students.class', classFilter);
        const { data } = await q;
        setHeaders((data || []).map((h: any) => ({
            ...h,
            student_name: h.students?.name || '',
            student_class: h.students?.class || '',
        })));
        setLoading(false);
    };

    useEffect(() => { loadRecords(); }, [classFilter, refresh]);

    const handleReprint = async (header: ReceiptHeader & { student_name: string; student_class: string }) => {
        // Load linked fee_payments lines for this receipt
        const { data: lines } = await supabase.from('fee_payments').select('*').eq('receipt_no', header.receipt_no);
        if (!lines || lines.length === 0) { Swal.fire('Info', 'No line items linked to this receipt.', 'info'); return; }
        const student: Student = { sr_no: header.sr_no, name: header.student_name, class: header.student_class };
        const items = lines.map((l: any) => ({ label: l.month, amount: l.paid_amount }));
        const receipt: FeeReceiptData = {
            student,
            items,
            subtotal: header.total_paid + header.total_discount,
            discount: header.total_discount,
            grandTotal: header.total_paid,
            receiptNo: header.receipt_no,
            paymentDate: header.payment_date,
            paymentMode: header.payment_mode,
            paymentType: 'FULL PAYMENT',
        };
        onPrint(receipt);
    };

    const handleVoid = async (header: ReceiptHeader) => {
        const result = await Swal.fire({
            title: 'Void this receipt?',
            html: `Receipt <b>${header.receipt_no}</b> will be voided and all linked payments zeroed. This cannot be undone.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Yes, void it',
        });
        if (!result.isConfirmed) return;
        // Zero out all linked fee_payments rows
        const { data: lines } = await supabase.from('fee_payments').select('id').eq('receipt_no', header.receipt_no);
        for (const line of (lines || [])) {
            await supabase.from('fee_payments').update({ paid_amount: 0, discount: 0, receipt_no: null }).eq('id', (line as any).id);
        }
        await supabase.from('fee_receipt_headers')
            .update({ is_voided: true, voided_reason: 'Manually voided', total_paid: 0, total_discount: 0 })
            .eq('id', header.id);
        Swal.fire('Voided', `Receipt ${header.receipt_no} has been voided.`, 'success');
        loadRecords();
    };

    const filtered = headers.filter(h => {
        const q = search.toLowerCase();
        return !q || h.student_name.toLowerCase().includes(q) || String(h.sr_no).includes(q) || h.receipt_no.toLowerCase().includes(q);
    });

    const totalCollected = filtered.filter(h => !h.is_voided).reduce((s, h) => s + (h.total_paid || 0), 0);

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5 text-center">
                    <p className="text-lg font-bold text-emerald-600">{fmtINR(totalCollected)}</p>
                    <p className="text-xs text-muted-foreground">Total Collected (shown)</p>
                </div>
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, SR, or receipt no…"
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
                </div>
            </div>

            <div className="bg-card border border-border rounded-2xl overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-16 text-muted-foreground text-sm">No receipts found</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-border bg-muted/30">
                                    {['Receipt No', 'Date', 'Student', 'Total Paid', 'Discount', 'Mode', 'Status', 'Actions'].map(h => (
                                        <th key={h} className={`px-4 py-3 font-medium text-muted-foreground ${['Total Paid', 'Discount'].includes(h) ? 'text-right' : h === 'Status' ? 'text-center' : h === 'Actions' ? 'text-right' : 'text-left'}`}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {filtered.map(h => (
                                    <tr key={h.id} className={`transition-colors ${h.is_voided ? 'bg-red-50/50 opacity-60' : 'hover:bg-muted/20'}`}>
                                        <td className="px-4 py-2.5 font-mono font-semibold text-primary text-xs">{h.receipt_no}</td>
                                        <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                                            {new Date(h.payment_date).toLocaleDateString('en-GB')}
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <p className="font-medium">{h.student_name}</p>
                                            <p className="text-xs text-muted-foreground">SR {h.sr_no} · {h.student_class}</p>
                                        </td>
                                        <td className="px-4 py-2.5 text-right font-semibold text-emerald-600">{fmtINR(h.total_paid)}</td>
                                        <td className="px-4 py-2.5 text-right text-purple-600 text-xs">{h.total_discount > 0 ? fmtINR(h.total_discount) : '—'}</td>
                                        <td className="px-4 py-2.5 capitalize text-xs text-muted-foreground">{h.payment_mode}</td>
                                        <td className="px-4 py-2.5 text-center">
                                            {h.is_voided
                                                ? <span className="px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700 border border-red-200 font-semibold">Voided</span>
                                                : <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-100 text-emerald-700 border border-emerald-200 font-semibold">Active</span>}
                                        </td>
                                        <td className="px-4 py-2.5 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                {!h.is_voided && (
                                                    <>
                                                        <button onClick={() => onEditReceipt(h as unknown as ReceiptHeader)} className="p-1.5 text-blue-500 hover:bg-blue-50 border border-transparent hover:border-blue-100 rounded-lg transition-colors" title="Edit transaction"><Pencil className="w-3.5 h-3.5" /></button>
                                                        <button onClick={() => handleReprint(h)} className="p-1.5 text-primary/70 hover:bg-primary/10 border border-transparent hover:border-primary/20 rounded-lg transition-colors" title="Reprint receipt"><Printer className="w-3.5 h-3.5" /></button>
                                                        <button onClick={() => handleVoid(h)} className="p-1.5 text-red-400 hover:bg-red-50 border border-transparent hover:border-red-100 rounded-lg transition-colors" title="Void receipt"><Ban className="w-3.5 h-3.5" /></button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Edit Modal Removed (now redirects to Collect Tab) */}
        </div>
    );
};


/* ─── Tuition Fee Tab (Merged) ─────────────────────────────── */
const TuitionFeeTab: React.FC<{ feeStr: FeeStructure[]; refresh: number }> = ({ feeStr, refresh }) => {
    const [activeTab, setActiveTab] = useState<'collect' | 'ledger'>('collect');
    const [printData, setPrintData] = useState<FeeReceiptData | null>(null);
    const [editReceipt, setEditReceipt] = useState<ReceiptHeader | null>(null);

    const handlePrintReceipt = (data: FeeReceiptData) => {
        setPrintData(data);
        setTimeout(() => {
            const area = document.getElementById('fee-receipt-print-area');
            if (!area) return;
            area.style.display = 'block';
            const cleanup = () => { 
                area.style.display = 'none'; 
                window.removeEventListener('afterprint', cleanup);
                setPrintData(null); // Unmount so styles don't affect other pages
            };
            window.addEventListener('afterprint', cleanup);
            window.print();
        }, 150);
    };

    return (
        <div className="animate-fade-in">
            {/* Single global print area — always mounted regardless of active sub-tab */}
            <PrintFeeReceipt data={printData} />

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
            
            {activeTab === 'collect' && <CollectFeeTab 
                feeStr={feeStr} 
                editReceipt={editReceipt} 
                onCancelEdit={() => setEditReceipt(null)} 
            />}
            {activeTab === 'ledger' && <LedgerTab 
                refresh={refresh} 
                onPrint={handlePrintReceipt} 
                onEditReceipt={(h) => {
                    setEditReceipt(h);
                    setActiveTab('collect');
                }}
            />}
        </div>
    );
};

/* ─── Main Page ──────────────────────────────────────────── */
type Tab = 'tuition' | 'defaulters' | 'prev_year' | 'transport' | 'structure' | 'analysis';

const FeeLedger: React.FC = () => {
    const [tab, setTab] = useState<Tab>('tuition');
    const [feeStr, setFeeStr] = useState<FeeStructure[]>([]);
    const [refresh, setRefresh] = useState(0);

    useEffect(() => {
        supabase.from('fee_structure').select('*').then(({ data }) => setFeeStr(data || []));
    }, []);

    const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
        { id: 'tuition', label: 'Tuition Fee', icon: <span className="font-bold text-base leading-none pt-0.5">₹</span> },
        { id: 'prev_year', label: 'Previous Year Due', icon: <History className="w-4 h-4" /> },
        { id: 'transport', label: 'Transport Fee', icon: <Bus className="w-4 h-4" /> },
        { id: 'structure', label: 'Fee Structure', icon: <Settings2 className="w-4 h-4" /> },
        { id: 'analysis', label: 'Fee Analysis', icon: <TrendingDown className="w-4 h-4" /> },
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
            {tab === 'prev_year' && <PrevYearDueTab />}
            {tab === 'transport' && <TransportFeeTab />}
            {tab === 'structure' && <FeeStructureTab />}
            {tab === 'analysis' && <FeeAnalysisTab feeStr={feeStr} />}
        </AppShell>
    );
};

export default FeeLedger;
