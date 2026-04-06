/*
 * ╔══════════════════════════════════════════════════════════════╗
 * ║         S.C.M. CHILDREN ACADEMY — TRANSPORT FEE MODULE       ║
 * ║                 SQL MIGRATION (run once in Supabase)         ║
 * ╠══════════════════════════════════════════════════════════════╣
 *
 * -- 1. Transport villages with monthly rates
 * CREATE TABLE IF NOT EXISTS transport_villages (
 *   id            BIGSERIAL PRIMARY KEY,
 *   village_name  TEXT NOT NULL UNIQUE,
 *   monthly_rate  NUMERIC(10, 2) NOT NULL DEFAULT 0
 * );
 *
 * -- 2. Transport fee payments
 * CREATE TABLE IF NOT EXISTS transport_fees (
 *   id              BIGSERIAL PRIMARY KEY,
 *   sr_no           INTEGER NOT NULL REFERENCES students(sr_no),
 *   village         TEXT,
 *   months_selected TEXT[]  DEFAULT '{}',
 *   days            INTEGER DEFAULT 0,
 *   rate            NUMERIC(10,2) DEFAULT 0,
 *   subtotal        NUMERIC(10,2) DEFAULT 0,
 *   last_due        NUMERIC(10,2) DEFAULT 0,
 *   grand_total     NUMERIC(10,2) DEFAULT 0,
 *   payment_date    DATE NOT NULL DEFAULT CURRENT_DATE,
 *   receipt_no      TEXT UNIQUE,
 *   payment_mode    TEXT DEFAULT 'cash',
 *   created_at      TIMESTAMPTZ DEFAULT NOW()
 * );
 *
 * -- 3. Seed some default villages (adjust rates as needed)
 * INSERT INTO transport_villages (village_name, monthly_rate) VALUES
 *   ('Haldaur',                    550),
 *   ('Kumarpura',                  600),
 *   ('Garhi',                      600),
 *   ('Takipura',                   650),
 *   ('Bilai',                      650),
 *   ('Nagal',                      650),
 *   ('Bisat',                      650),
 *   ('Nabada',                     650),
 *   ('Mukranpur',                  650),
 *   ('Sumalkhedi',                 650),
 *   ('Baldhiya',                   650),
 *   ('Kukra',                      600),
 *   ('Inampura',                   600),
 *   ('Sultanpur',                  650),
 *   ('Safipur Bhogan',             650),
 *   ('Salmtabad',                  650),
 *   ('Shanager',                   650),
 *   ('Khairabad',                  650),
 *   ('Ladanpur',                   650)
 * ON CONFLICT (village_name) DO NOTHING;
 *
 * ╚══════════════════════════════════════════════════════════════╝
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/config/supabaseClient';
import {
    Search, Loader2, X, Printer, MapPin, Calendar, CreditCard, ChevronDown, CheckCircle,
    Clock, CheckCircle2, AlertCircle, Bus, Trash2, ClipboardList
} from 'lucide-react';
import Swal from 'sweetalert2';
import { CLASSES } from '../students/StudentDirectory';

/* ─── Constants ───────────────────────────────────────────── */
const MONTHS = [
    'April 2026', 'May 2026', 'June 2026', 'July 2026',
    'August 2026', 'September 2026', 'October 2026', 'November 2026',
    'December 2026', 'January 2027', 'February 2027', 'March 2027',
];

const MONTH_LABELS: Record<string, string> = {
    'April 2026': 'Apr', 'May 2026': 'May', 'June 2026': 'Jun',
    'July 2026': 'Jul', 'August 2026': 'Aug', 'September 2026': 'Sep',
    'October 2026': 'Oct', 'November 2026': 'Nov', 'December 2026': 'Dec',
    'January 2027': 'Jan', 'February 2027': 'Feb', 'March 2027': 'Mar',
};

const fmtINR = (n: number) => '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 0 });

/* ─── Types ───────────────────────────────────────────────── */
interface Student {
    sr_no: number; name: string; class: string;
    father_name?: string; address?: string; phone?: string; status?: string;
    transport_discount?: number;
}

interface Village {
    id: number; village_name: string; monthly_rate: number;
}

type PayMode = 'by_month' | 'by_days';

/* ─── Receipt number generator ────────────────────────────── */
const genReceiptNo = () =>
    'TF-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2, 5).toUpperCase();

/* ─── Auto-match village from address ─────────────────────── */
function matchVillage(address: string, villages: Village[]): Village | null {
    if (!address) return null;
    const addr = address.toLowerCase();

    // Sort villages by name length descending so that 'Safipur Bhogan' matches before 'Safipur'
    // and exact matches are prioritized over partials
    const sorted = [...villages].sort((a, b) => b.village_name.length - a.village_name.length);

    for (const v of sorted) {
        if (addr.includes(v.village_name.toLowerCase())) {
            return v;
        }
    }
    return null;
}

/* ═══════════════════════════════════════════════════════════ */
/*  PRINT RECEIPT (hidden, revealed on print)                 */
/* ═══════════════════════════════════════════════════════════ */
interface ReceiptData {
    student: Student;
    village: string;
    rate: number;
    selectedMonths: string[];
    monthDays: Record<string, number>; // month -> days (absent or 0 = full month)
    subtotal: number;
    discount: number;
    grandTotal: number;
    receiptNo: string;
    paymentDate: string;
    paymentMode: string;
}

const PrintReceipt: React.FC<{ data: ReceiptData | null }> = ({ data }) => {
    if (!data) return null;

    const periodParts = data.selectedMonths.map(m => {
        const days = data.monthDays[m];
        const label = MONTH_LABELS[m] || m;
        return days && days > 0 && days < 30 ? `${label} (${days}d)` : label;
    });
    const periodText = periodParts.length > 0 ? periodParts.join(', ') : '—';

    return (
        <div
            id="transport-print-area"
            style={{ display: 'none', fontFamily: 'Arial, sans-serif', padding: '8mm 12mm', color: '#000', background: '#fff' }}
        >
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
                TRANSPORT FEE RECEIPT
            </div>

            {/* Receipt meta */}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 10 }}>
                <div><strong>Receipt No:</strong> {data.receiptNo}</div>
                <div><strong>Date:</strong> {data.paymentDate}</div>
                <div><strong>Mode:</strong> {data.paymentMode.toUpperCase()}</div>
            </div>

            {/* Student Details */}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginBottom: 10 }}>
                <tbody>
                    {[
                        ['Student Name', data.student.name.toUpperCase()],
                        ['SR No.', String(data.student.sr_no)],
                        ['Class', data.student.class],
                        ["Father's Name", data.student.father_name || '—'],
                        ['Phone', data.student.phone || '—'],
                        ['Address', data.student.address || '—'],
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
                    <tr>
                        <td style={{ border: '1px solid #aaa', padding: '5px 8px' }}>Village / Route</td>
                        <td style={{ border: '1px solid #aaa', padding: '5px 8px', textAlign: 'right', fontWeight: 'bold' }}>{data.village}</td>
                    </tr>
                    <tr>
                        <td style={{ border: '1px solid #aaa', padding: '5px 8px' }}>Rate per Month</td>
                        <td style={{ border: '1px solid #aaa', padding: '5px 8px', textAlign: 'right' }}>₹{data.rate}</td>
                    </tr>
                    <tr>
                        <td style={{ border: '1px solid #aaa', padding: '5px 8px' }}>Period</td>
                        <td style={{ border: '1px solid #aaa', padding: '5px 8px', textAlign: 'right' }}>{periodText}</td>
                    </tr>
                    <tr>
                        <td style={{ border: '1px solid #aaa', padding: '5px 8px' }}>Transport Amount</td>
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
                <div style={{ textAlign: 'center' }}>
                    <div style={{ borderTop: '1px solid #000', width: 120, paddingTop: 4 }}>Principal</div>
                </div>
            </div>

            <div style={{ textAlign: 'center', fontSize: 9, color: '#666', marginTop: 10 }}>
                Generated by SCM ERP System • This receipt is computer generated
            </div>
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════ */
/*  LEDGER COMPONENT                                          */
/* ═══════════════════════════════════════════════════════════ */
const TransportLedger: React.FC = () => {
    const [records, setRecords] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [classFilter, setClassFilter] = useState('');

    const fetchRecords = async (cls: string) => {
        setLoading(true);
        let qb = supabase
            .from('transport_fees')
            .select(`*, students${cls ? '!inner' : ''}(name, class)`)
            .order('created_at', { ascending: false });

        if (cls) {
            qb = qb.eq('students.class', cls);
        }

        const { data, error } = await qb;
        if (data) setRecords(data);
        setLoading(false);
    };

    useEffect(() => {
        fetchRecords(classFilter);
    }, [classFilter]);

    const handleDelete = async (id: number) => {
        const result = await Swal.fire({
            title: 'Delete transaction?',
            text: 'Are you sure you want to delete this transport fee record? This action cannot be undone.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Yes, delete it!'
        });

        if (result.isConfirmed) {
            setLoading(true);
            await supabase.from('transport_fees').delete().eq('id', id);
            fetchRecords(classFilter);
            Swal.fire('Deleted!', 'Transaction record has been removed.', 'success');
        }
    };

    return (
        <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden animate-fade-in mt-6">
            <div className="p-5 border-b border-border flex justify-between items-center bg-muted/20">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                    <ClipboardList className="w-5 h-5 text-primary" /> Transport Fee Ledger
                </h3>
                <div className="flex items-center gap-2">
                    <select
                        value={classFilter}
                        onChange={e => setClassFilter(e.target.value)}
                        className="px-3 py-1.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    >
                        <option value="">All Classes</option>
                        {CLASSES.slice(1).map(c => (
                            <option key={c} value={c}>{c}</option>
                        ))}
                    </select>
                </div>
            </div>
            {loading ? (
                <div className="flex justify-center p-12 text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin" /></div>
            ) : records.length === 0 ? (
                <div className="text-center py-20 text-muted-foreground"><ClipboardList className="w-12 h-12 mx-auto opacity-20 mb-3" /><p>No transactions found.</p></div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-muted/50 border-b border-border">
                            <tr>
                                <th className="px-5 py-3.5 font-semibold text-muted-foreground">Receipt</th>
                                <th className="px-5 py-3.5 font-semibold text-muted-foreground">Date</th>
                                <th className="px-5 py-3.5 font-semibold text-muted-foreground">Student</th>
                                <th className="px-5 py-3.5 font-semibold text-muted-foreground">Village</th>
                                <th className="px-5 py-3.5 font-semibold text-muted-foreground">Period</th>
                                <th className="px-5 py-3.5 font-semibold text-muted-foreground">Total</th>
                                <th className="px-5 py-3.5 font-semibold text-muted-foreground">Mode</th>
                                <th className="px-5 py-3.5 font-semibold text-muted-foreground text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {records.map(r => (
                                <tr key={r.id} className="hover:bg-muted/20 transition-colors">
                                    <td className="px-5 py-3 font-medium whitespace-nowrap">{r.receipt_no}</td>
                                    <td className="px-5 py-3 whitespace-nowrap">{new Date(r.payment_date).toLocaleDateString('en-GB')}</td>
                                    <td className="px-5 py-3">
                                        <div className="font-semibold">{r.students?.name || 'Unknown'}</div>
                                        <div className="text-xs text-muted-foreground whitespace-nowrap">SR: {r.sr_no} {r.students?.class ? `· Class: ${r.students.class}` : ''}</div>
                                    </td>
                                    <td className="px-5 py-3">{r.village}</td>
                                    <td className="px-5 py-3 text-xs text-muted-foreground max-w-[200px] truncate" title={r.months_selected?.join(', ')}>
                                        {r.months_selected?.length > 0 && r.months_selected.map((m: string) => {
                                            const days = r.month_days && r.month_days[m];
                                            const label = MONTH_LABELS[m] || m;
                                            return days && days > 0 && days < 30 ? `${label}(${days}d)` : label;
                                        }).join(', ')}
                                    </td>
                                    <td className="px-5 py-3 font-bold text-emerald-600 whitespace-nowrap">{fmtINR(r.grand_total)}</td>
                                    <td className="px-5 py-3 uppercase text-xs font-medium text-muted-foreground">{r.payment_mode}</td>
                                    <td className="px-5 py-3 text-right">
                                        <button onClick={() => handleDelete(r.id)} className="p-1.5 text-red-500 hover:bg-red-50 border border-transparent hover:border-red-100 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════ */
/*  MAIN COMPONENT                                            */
/* ═══════════════════════════════════════════════════════════ */
const TransportFeeTab: React.FC = () => {
    /* Main Tabs */
    const [activeTab, setActiveTab] = useState<'collect' | 'ledger'>('collect');

    /* Student search */
    const [query, setQuery] = useState('');
    const [classFilter, setClassFilter] = useState('');
    const [results, setResults] = useState<Student[]>([]);
    const [searching, setSearching] = useState(false);
    const [student, setStudent] = useState<Student | null>(null);

    /* Village data */
    const [villages, setVillages] = useState<Village[]>([]);
    const [selectedVillage, setSelectedVillage] = useState<Village | null>(null);
    const [villageFetching, setVillageFetching] = useState(false);

    /* Permanent Student Discount */
    const [studentDiscount, setStudentDiscount] = useState('0');
    const [savingDiscount, setSavingDiscount] = useState(false);

    /* Discount (editable) */
    const [discountInput, setDiscountInput] = useState('0');

    /* Period Selection */
    const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
    const [monthDays, setMonthDays] = useState<Record<string, number>>({}); // month -> days (0 or absent = full month)
    const [paidMonths, setPaidMonths] = useState<string[]>([]);
    const [paymentHistory, setPaymentHistory] = useState<any[]>([]);

    /* Payment mode (cash/online/cheque/split) */
    const [paymentMode, setPaymentMode] = useState<'cash' | 'online' | 'cheque' | 'split'>('cash');
    const [splitCash, setSplitCash] = useState('');
    const [splitOnline, setSplitOnline] = useState('');
    const [splitCheque, setSplitCheque] = useState('');

    /* Save state */
    const [saving, setSaving] = useState(false);
    const [saveMsg, setSaveMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

    /* Print */
    const [printData, setPrintData] = useState<ReceiptData | null>(null);

    /* ── Load all villages once ─────────────────────────────── */
    useEffect(() => {
        supabase.from('transport_villages').select('*').order('village_name')
            .then(({ data }) => setVillages(data || []));
    }, []);

    /* ── Student search ─────────────────────────────────────── */
    const search = useCallback(async (q: string, cls: string) => {
        if (!q.trim() && !cls) { setResults([]); return; }
        setSearching(true);
        const isNum = /^\d+$/.test(q.trim());
        let qb = supabase.from('students')
            .select('sr_no,name,class,father_name,address,phone,status,transport_discount')
            .eq('status', 'active');

        if (cls) {
            qb = qb.eq('class', cls);
        }

        if (q.trim()) {
            if (isNum) {
                qb = qb.eq('sr_no', parseInt(q));
            } else {
                qb = qb.or(`name.ilike.%${q}%,father_name.ilike.%${q}%`);
            }
        }

        const { data } = await qb.limit(20);
        setResults(data || []);
        setSearching(false);
    }, []);

    useEffect(() => {
        const t = setTimeout(() => search(query, classFilter), 300);
        return () => clearTimeout(t);
    }, [query, classFilter, search]);

    /* ── Pick student → auto-detect village + last due ──────── */
    const pickStudent = async (s: Student) => {
        setStudent(s);
        setQuery(s.name);
        setResults([]);
        setSelectedMonths([]);
        setMonthDays({});
        setPaymentMode('cash');
        setSplitCash('');
        setSplitOnline('');
        setSplitCheque('');
        setStudentDiscount(String(s.transport_discount || 0));
        setDiscountInput('0');
        setSaveMsg(null);

        setVillageFetching(true);
        // 1. Auto-match village from address
        const matched = matchVillage(s.address || '', villages);
        setSelectedVillage(matched);

        // 2. Fetch last due and history from transport_fees for this student
        const { data: allRecs } = await supabase
            .from('transport_fees')
            .select('*')
            .eq('sr_no', s.sr_no)
            .order('created_at', { ascending: false });

        if (allRecs && allRecs.length > 0) {
            setPaymentHistory(allRecs);
            const allPaid = allRecs.flatMap(r => r.months_selected || []);
            setPaidMonths(allPaid);
        } else {
            setPaymentHistory([]);
            setDiscountInput('0');
            setPaidMonths([]);
        }
        setVillageFetching(false);
    };

    /* ── Derived calculations ──────────────────────────────── */
    const rate = Math.max(0, (selectedVillage?.monthly_rate || 0) - (parseFloat(studentDiscount) || 0));

    const subtotal = (() => {
        let total = 0;
        for (const m of selectedMonths) {
            // Calculate already paid days for this month
            const alreadyPaidDays = paymentHistory.reduce((sum: number, h: any) => {
                if (h.month_days && h.month_days[m]) return sum + h.month_days[m];
                if (h.months_selected?.includes(m) && (!h.month_days || !h.month_days[m])) return sum + 30;
                return sum;
            }, 0);
            const remainingDays = Math.max(0, 30 - alreadyPaidDays);
            const hasPartialHistory = alreadyPaidDays > 0 && alreadyPaidDays < 30;

            const d = monthDays[m];
            const isByDays = hasPartialHistory || (d && d > 0 && d < 30);
            if (isByDays) {
                const effectiveDays = Math.min(d || remainingDays, remainingDays);
                total += (effectiveDays / 30) * rate;
            } else {
                total += rate;
            }
        }
        return parseFloat(total.toFixed(2));
    })();

    const transactionDiscount = Math.max(0, parseFloat(discountInput) || 0);
    const grandTotal = Math.max(0, subtotal - transactionDiscount);

    /* ── Toggle a month ────────────────────────────────────── */
    const toggleMonth = (m: string) => {
        setSelectedMonths(prev => {
            if (prev.includes(m)) {
                // Deselecting: also clear days for this month
                setMonthDays(d => { const next = { ...d }; delete next[m]; return next; });
                return prev.filter(x => x !== m);
            }
            return [...prev, m];
        });
    };

    const setDaysForMonth = (m: string, days: number) => {
        setMonthDays(prev => ({ ...prev, [m]: days }));
    };

    /* ── Save payment ──────────────────────────────────────── */
    const handleSave = async () => {
        if (!student || !selectedVillage) {
            setSaveMsg({ type: 'err', text: 'Please select a student and village first.' });
            return;
        }
        if (selectedMonths.length === 0) {
            setSaveMsg({ type: 'err', text: 'Please select at least one month.' });
            return;
        }
        if (grandTotal <= 0) {
            setSaveMsg({ type: 'err', text: 'Grand total must be greater than ₹0.' });
            return;
        }

        let finalPaymentModeStr = paymentMode as string;
        if (paymentMode === 'split') {
            const sc = parseFloat(splitCash) || 0;
            const so = parseFloat(splitOnline) || 0;
            const sq = parseFloat(splitCheque) || 0;
            const splitSum = sc + so + sq;
            if (Math.abs(splitSum - grandTotal) > 0.01) {
                setSaveMsg({ type: 'err', text: `Split amounts must exactly equal Grand Total (${fmtINR(grandTotal)}). Currently: ${fmtINR(splitSum)}` });
                return;
            }
            const parts = [];
            if (sc > 0) parts.push(`Cash: ₹${sc}`);
            if (so > 0) parts.push(`Online: ₹${so}`);
            if (sq > 0) parts.push(`Cheque: ₹${sq}`);
            finalPaymentModeStr = 'Split (' + parts.join(', ') + ')';
        }

        setSaving(true);
        setSaveMsg(null);

        const paymentDate = new Date().toISOString().split('T')[0];

        const row = {
            sr_no: student.sr_no,
            village: selectedVillage.village_name,
            months_selected: selectedMonths,
            month_days: monthDays,
            days: 0,
            rate,
            subtotal,
            last_due: 0,
            discount: transactionDiscount,
            grand_total: grandTotal,
            payment_date: paymentDate,
            receipt_no: '',
            payment_mode: finalPaymentModeStr,
        };

        const { data, error } = await supabase.from('transport_fees').insert(row).select().single();

        if (error) {
            setSaveMsg({ type: 'err', text: error.message });
            setSaving(false);
            return;
        }

        const { count } = await supabase.from('transport_fees').select('*', { count: 'exact', head: true });
        const actualReceiptNo = `TF-${String(count ?? 1).padStart(4, '0')}`;
        await supabase.from('transport_fees').update({ receipt_no: actualReceiptNo }).eq('id', data.id);
        data.receipt_no = actualReceiptNo;

        // Prepare print data
        const receipt: ReceiptData = {
            student,
            village: selectedVillage.village_name,
            rate,
            selectedMonths,
            monthDays,
            subtotal,
            discount: transactionDiscount,
            grandTotal,
            receiptNo: actualReceiptNo,
            paymentDate,
            paymentMode: finalPaymentModeStr,
        };
        setPrintData(receipt);
        setSaveMsg({ type: 'ok', text: `Saved! Receipt No: ${actualReceiptNo}` });
        setSaving(false);

        // Auto-print after save and update history/paid months
        setPaidMonths(prev => [...prev, ...selectedMonths]);
        setPaymentHistory(prev => [data, ...prev]);
        setSelectedMonths([]);
        setMonthDays({});
        setDiscountInput('0');

        setTimeout(() => {
            const area = document.getElementById('transport-print-area');
            if (!area) return;
            area.style.display = 'block';
            const cleanup = () => { area.style.display = 'none'; window.removeEventListener('afterprint', cleanup); };
            window.addEventListener('afterprint', cleanup);
            window.print();
        }, 150);
    };

    /* ── Delete Receipt ─────────────────────────────────────── */
    const handleDeleteReceipt = async (id: number) => {
        const result = await Swal.fire({
            title: 'Delete payment?',
            text: 'Are you sure you want to delete this payment? This will mark the months as unpaid again.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Yes, delete it!'
        });

        if (result.isConfirmed) {
            const { error } = await supabase.from('transport_fees').delete().eq('id', id);
            if (error) {
                Swal.fire('Error!', 'Failed to delete: ' + error.message, 'error');
            } else {
                Swal.fire('Deleted!', 'Payment record has been removed.', 'success');
                if (student) pickStudent(student); // Refresh
            }
        }
    };

    /* ── Manual reprint ─────────────────────────────────────── */
    const handleReprint = () => {
        const area = document.getElementById('transport-print-area');
        if (!area) return;
        area.style.display = 'block';
        const cleanup = () => { area.style.display = 'none'; window.removeEventListener('afterprint', cleanup); };
        window.addEventListener('afterprint', cleanup);
        window.print();
    };

    /* ─────────────────────────────────────────────────────── */
    return (
        <>
            {/* Print CSS */}
            <style>{`
                @page { size: A5; margin: 8mm; }
                @media print {
                    body * { visibility: hidden !important; }
                    #transport-print-area, #transport-print-area * { visibility: visible !important; }
                    #transport-print-area {
                        position: absolute !important; left: 0 !important; top: 0 !important;
                        width: 100% !important; display: block !important;
                        -webkit-print-color-adjust: exact; print-color-adjust: exact;
                    }
                }
            `}</style>

            {/* Hidden Print Receipt */}
            <PrintReceipt data={printData} />

            {/* Top Navigation Tabs */}
            <div className="flex bg-muted/50 p-1.5 rounded-2xl w-fit mb-6 mx-auto sm:mx-0 print:hidden mt-2">
                <button
                    onClick={() => setActiveTab('collect')}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all ${activeTab === 'collect'
                            ? 'bg-card text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                        }`}
                >
                    <Bus className="w-4 h-4" /> Collect Fee
                </button>
                <button
                    onClick={() => setActiveTab('ledger')}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all ${activeTab === 'ledger'
                            ? 'bg-card text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                        }`}
                >
                    <ClipboardList className="w-4 h-4" /> Transport Ledger
                </button>
            </div>

            {activeTab === 'collect' && (
                <div className={`grid grid-cols-1 ${student ? 'lg:grid-cols-12' : ''} gap-6 max-w-6xl mx-auto print:hidden animate-fade-in`}>

                    {/* ── LEFT COLUMN ────────────────────────────── */}
                    <div className={`${student ? 'lg:col-span-7 xl:col-span-8' : 'w-full max-w-3xl mx-auto'} space-y-5`}>


                        {/* ── STUDENT SEARCH ────────────────────────────── */}
                        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
                            <h3 className="font-semibold text-sm text-muted-foreground mb-3 flex items-center gap-2">
                                <Search className="w-4 h-4" /> Student Selector
                            </h3>
                            <div className="flex gap-3">
                                <div className="w-[140px] flex-shrink-0">
                                    <select
                                        value={classFilter}
                                        onChange={e => { setClassFilter(e.target.value); if (student) { setStudent(null); setSelectedVillage(null); } }}
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
                                    <input
                                        value={query}
                                        onChange={e => { setQuery(e.target.value); if (student) { setStudent(null); setSelectedVillage(null); } }}
                                        placeholder="Search by name or SR No..."
                                        className="w-full pl-9 pr-10 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 shadow-sm"
                                    />
                                    {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />}
                                    {results.length > 0 && (
                                        <div className="absolute top-full mt-1 left-0 right-0 bg-card border border-border rounded-xl shadow-xl z-20 divide-y divide-border overflow-hidden max-h-60 overflow-y-auto">
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

                            {/* Student Info Panel */}
                            {student && (
                                <div className="mt-4 p-4 bg-muted/40 rounded-xl grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
                                    {[
                                        ['Name', student.name],
                                        ['SR No.', String(student.sr_no)],
                                        ['Class', student.class],
                                        ["Father's Name", student.father_name || '—'],
                                        ['Phone', student.phone || '—'],
                                        ['Address', student.address || '—'],
                                    ].map(([label, val]) => (
                                        <div key={label}>
                                            <p className="text-xs text-muted-foreground">{label}</p>
                                            <p className="font-medium truncate">{val}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* ── VILLAGE & RATE ────────────────────────────── */}
                        {student && (
                            <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
                                <h3 className="font-semibold text-sm text-muted-foreground mb-3 flex items-center gap-2">
                                    <MapPin className="w-4 h-4" /> Village & Rate
                                </h3>
                                {villageFetching ? (
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground py-3">
                                        <Loader2 className="w-4 h-4 animate-spin" /> Detecting village...
                                    </div>
                                ) : (
                                    <div className="flex flex-col sm:flex-row gap-3">
                                        <div className="flex-1">
                                            <label className="text-xs font-medium text-muted-foreground mb-1 block">Village / Route</label>
                                            <select
                                                value={selectedVillage?.id || ''}
                                                onChange={e => {
                                                    const v = villages.find(v => v.id === Number(e.target.value)) || null;
                                                    setSelectedVillage(v);
                                                }}
                                                className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                                            >
                                                <option value="">— Select Village —</option>
                                                {villages.map(v => (
                                                    <option key={v.id} value={v.id}>{v.village_name}</option>
                                                ))}
                                            </select>
                                            {selectedVillage && matchVillage(student.address || '', villages)?.id === selectedVillage.id && (
                                                <p className="text-xs text-emerald-600 mt-1">✓ Auto-detected from address</p>
                                            )}
                                        </div>
                                        <div className="sm:w-40">
                                            <label className="text-xs font-medium text-muted-foreground mb-1 block">Rate / Month</label>
                                            <div className="px-3 py-2.5 rounded-xl border border-border bg-muted/30 text-sm font-bold text-primary flex items-center justify-between gap-1">
                                                <span>{selectedVillage ? fmtINR(rate) : '—'}</span>
                                            </div>
                                        </div>
                                        <div className="sm:w-48">
                                            <label className="text-xs font-medium text-muted-foreground mb-1 block">Student Monthly Dsc.</label>
                                            <div className="flex items-center gap-2">
                                                <div className="relative flex-1">
                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-bold">₹</span>
                                                    <input
                                                        type="number"
                                                        value={studentDiscount}
                                                        onChange={e => setStudentDiscount(e.target.value)}
                                                        className="w-full pl-7 pr-3 py-2 rounded-lg border border-emerald-300 bg-emerald-50 text-sm font-semibold text-emerald-800 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                                                        min={0}
                                                        step={0.01}
                                                    />
                                                </div>
                                                {parseFloat(studentDiscount) !== (student.transport_discount || 0) && (
                                                    <button
                                                        onClick={async () => {
                                                            setSavingDiscount(true);
                                                            await supabase.from('students').update({ transport_discount: parseFloat(studentDiscount) || 0 }).eq('sr_no', student.sr_no);
                                                            setStudent(prev => prev ? { ...prev, transport_discount: parseFloat(studentDiscount) || 0 } : null);
                                                            setSavingDiscount(false);
                                                        }}
                                                        disabled={savingDiscount}
                                                        className="p-2 rounded-lg bg-primary text-white transition-all hover:bg-primary/90 disabled:opacity-50"
                                                        title="Save discount to student record"
                                                    >
                                                        {savingDiscount ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ── TRANSPORT PERIOD ─────────────────────────── */}
                        {student && selectedVillage && (
                            <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
                                <h3 className="font-semibold text-sm text-muted-foreground mb-4 flex items-center gap-2">
                                    <Calendar className="w-4 h-4" /> Transport Period
                                </h3>

                                <div className="space-y-5">
                                    <div>
                                        <label className="text-xs font-medium text-muted-foreground mb-2 block">Select Months</label>
                                        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                                            {MONTHS.map(m => {
                                                const isPaid = paidMonths.includes(m);
                                                const isSelected = selectedMonths.includes(m);
                                                // Check if this month was partially paid (by days) in history
                                                const historyDays = paymentHistory.reduce((sum: number, h: any) => {
                                                    if (h.month_days && h.month_days[m]) return sum + h.month_days[m];
                                                    return sum;
                                                }, 0);
                                                const isPartiallyPaid = isPaid && historyDays > 0 && historyDays < 30;
                                                return (
                                                    <button
                                                        key={m}
                                                        disabled={isPaid && !isPartiallyPaid}
                                                        onClick={() => toggleMonth(m)}
                                                        className={`relative py-2 px-1 rounded-xl text-xs font-semibold border transition-all text-center flex flex-col items-center gap-0.5 ${isPaid && !isPartiallyPaid
                                                                ? 'bg-emerald-50 border-emerald-200 text-emerald-600 opacity-60 cursor-not-allowed'
                                                                : isPartiallyPaid && !isSelected
                                                                    ? 'bg-amber-50 border-amber-300 text-amber-700'
                                                                    : isSelected
                                                                        ? 'gradient-primary text-white border-transparent shadow-md'
                                                                        : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
                                                            }`}
                                                    >
                                                        {MONTH_LABELS[m]}
                                                        {isPartiallyPaid && !isSelected && (
                                                            <span className="text-[9px] font-normal">{historyDays}d paid</span>
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Per-month Full/By Days selection */}
                                    {selectedMonths.length > 0 && (
                                        <div className="pt-3 border-t border-border mt-2 space-y-2">
                                            <label className="text-xs font-medium text-muted-foreground mb-1 block">Payment Type per Month</label>
                                            {selectedMonths.map(m => {
                                                // Calculate already paid days for this month from history
                                                const alreadyPaidDays = paymentHistory.reduce((sum: number, h: any) => {
                                                    if (h.month_days && h.month_days[m]) return sum + h.month_days[m];
                                                    // If month is in months_selected but not in month_days, it was a full month
                                                    if (h.months_selected?.includes(m) && (!h.month_days || !h.month_days[m])) return sum + 30;
                                                    return sum;
                                                }, 0);
                                                const remainingDays = Math.max(0, 30 - alreadyPaidDays);
                                                const hasPartialHistory = alreadyPaidDays > 0 && alreadyPaidDays < 30;

                                                const d = monthDays[m] || 0;
                                                // Force "By Days" if month has partial history (can't do "Full Month" anymore)
                                                const isByDays = hasPartialHistory || (d > 0 && d < 30);
                                                const effectiveDays = isByDays ? Math.min(d || remainingDays, remainingDays) : 0;
                                                const monthAmount = isByDays ? (effectiveDays / 30) * rate : rate;

                                                return (
                                                    <div key={m} className="flex items-center gap-3 p-2.5 rounded-xl bg-muted/40 border border-border/50">
                                                        <span className="text-sm font-semibold min-w-[40px]">{MONTH_LABELS[m]}</span>
                                                        <div className="flex items-center gap-1.5">
                                                            {!hasPartialHistory && (
                                                                <button
                                                                    onClick={() => setDaysForMonth(m, 0)}
                                                                    className={`px-3 py-1 rounded-lg text-xs font-medium border transition-all ${
                                                                        !isByDays
                                                                            ? 'gradient-primary text-white border-transparent shadow-sm'
                                                                            : 'border-border text-muted-foreground hover:border-primary/40'
                                                                    }`}
                                                                >
                                                                    Full Month
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={() => setDaysForMonth(m, d > 0 ? Math.min(d, remainingDays) : Math.min(1, remainingDays))}
                                                                className={`px-3 py-1 rounded-lg text-xs font-medium border transition-all ${
                                                                    isByDays
                                                                        ? 'gradient-primary text-white border-transparent shadow-sm'
                                                                        : 'border-border text-muted-foreground hover:border-primary/40'
                                                                }`}
                                                            >
                                                                By Days
                                                            </button>
                                                        </div>
                                                        {isByDays && (
                                                            <div className="flex items-center gap-2">
                                                                <input
                                                                    type="number"
                                                                    value={effectiveDays}
                                                                    onChange={e => setDaysForMonth(m, Math.min(remainingDays, Math.max(1, parseInt(e.target.value) || 1)))}
                                                                    min={1} max={remainingDays}
                                                                    className="w-16 px-2 py-1 rounded-lg border border-border bg-background text-sm font-bold text-center focus:outline-none focus:ring-1 focus:ring-primary/40"
                                                                />
                                                                <span className="text-xs text-muted-foreground whitespace-nowrap">/ {remainingDays}d left</span>
                                                            </div>
                                                        )}
                                                        {hasPartialHistory && !isByDays && (
                                                            <span className="text-[10px] text-amber-600 font-medium">{alreadyPaidDays}d already paid</span>
                                                        )}
                                                        <span className="ml-auto text-sm font-bold text-primary">{fmtINR(monthAmount)}</span>
                                                    </div>
                                                );
                                            })}
                                            <p className="text-[10px] text-muted-foreground mt-1">Formula for days: (days ÷ 30) × ₹{rate}/month</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Empty state */}
                        {!student && (
                            <div className="text-center py-20 text-muted-foreground bg-card border border-border rounded-2xl shadow-sm">
                                <Bus className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                <p className="font-medium">Search a student to collect transport fee</p>
                                <p className="text-sm mt-1">Village, rate and calculations will auto-populate</p>
                            </div>
                        )}

                    </div> {/* End Left Column */}

                    {/* ── RIGHT COLUMN: SUMMARY & HISTORY ────────────────────────────── */}
                    {student && selectedVillage && (
                        <div className="lg:col-span-5 xl:col-span-4 space-y-5">

                            {/* ── SUMMARY & GRAND TOTAL ─────────────────────── */}
                            <div className="bg-card border border-border rounded-2xl p-5 shadow-sm sticky top-6">
                                <h3 className="font-semibold text-sm text-muted-foreground mb-4 flex items-center gap-2">
                                    <span className="text-base">₹</span> Fee Summary
                                </h3>

                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">
                                            Transport Amount
                                            {selectedMonths.length > 0 && (() => {
                                                const fullCount = selectedMonths.filter(m => !monthDays[m] || monthDays[m] === 0 || monthDays[m] >= 30).length;
                                                const dayMonths = selectedMonths.filter(m => monthDays[m] && monthDays[m] > 0 && monthDays[m] < 30);
                                                const parts = [];
                                                if (fullCount > 0) parts.push(`${fullCount} month${fullCount > 1 ? 's' : ''}`);
                                                dayMonths.forEach(m => parts.push(`${MONTH_LABELS[m]}: ${monthDays[m]}d`));
                                                return ` (${parts.join(', ')})`;
                                            })()}
                                        </span>
                                        <span className="font-bold text-foreground">{fmtINR(subtotal)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm items-center py-1">
                                        <span className="font-medium text-muted-foreground">Transaction Discount</span>
                                        <div className="relative w-28">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-bold">₹</span>
                                            <input
                                                type="number"
                                                value={discountInput}
                                                onChange={e => setDiscountInput(e.target.value)}
                                                className="w-full pl-7 pr-3 py-1.5 rounded-lg border border-border bg-background text-sm font-semibold text-right text-rose-600 focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/40"
                                                min={0}
                                                step={0.01}
                                            />
                                        </div>
                                    </div>
                                    <div className="border-t border-border pt-2 flex justify-between">
                                        <span className="font-bold text-base">Grand Total</span>
                                        <span className="font-black text-lg text-primary">{fmtINR(grandTotal)}</span>
                                    </div>
                                </div>

                                {/* Payment Mode */}
                                <div className="mt-4">
                                    <label className="text-xs font-medium text-muted-foreground mb-2 block">Payment Mode</label>
                                    <div className="grid grid-cols-4 gap-2">
                                        {(['cash', 'online', 'cheque', 'split'] as const).map(m => (
                                            <button key={m} onClick={() => setPaymentMode(m)}
                                                className={`py-2 rounded-xl text-xs font-medium border transition-all capitalize ${paymentMode === m
                                                        ? 'gradient-primary text-white border-transparent shadow-md'
                                                        : 'border-border text-muted-foreground hover:border-primary/40'
                                                    }`}>
                                                {m}
                                            </button>
                                        ))}
                                    </div>

                                    {paymentMode === 'split' && (
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
                                                Split: <span className={`font-bold ${Math.abs(((parseFloat(splitCash) || 0) + (parseFloat(splitOnline) || 0) + (parseFloat(splitCheque) || 0)) - grandTotal) <= 0.01 ? 'text-emerald-600' : 'text-red-600'}`}>
                                                    {fmtINR((parseFloat(splitCash) || 0) + (parseFloat(splitOnline) || 0) + (parseFloat(splitCheque) || 0))}
                                                </span> / {fmtINR(grandTotal)}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Save Message */}
                                {saveMsg && (
                                    <div className={`mt-3 flex items-center gap-2 p-3 rounded-xl text-sm ${saveMsg.type === 'ok'
                                            ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                                            : 'bg-red-50 border border-red-200 text-red-700'
                                        }`}>
                                        {saveMsg.type === 'ok'
                                            ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                                            : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
                                        {saveMsg.text}
                                    </div>
                                )}

                                {/* Action Buttons */}
                                <div className="flex gap-2 mt-4">
                                    <button
                                        onClick={handleSave}
                                        disabled={saving}
                                        className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl gradient-primary text-white font-semibold text-sm hover:opacity-90 disabled:opacity-60 transition-all shadow-md"
                                    >
                                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>₹</span>}
                                        {saving ? 'Saving…' : 'Save & Print Receipt'}
                                    </button>
                                    {printData && (
                                        <button
                                            onClick={handleReprint}
                                            className="flex items-center gap-2 px-4 py-3 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors"
                                            title="Reprint last receipt"
                                        >
                                            <Printer className="w-4 h-4" />
                                            Reprint
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Payment History Tracker */}
                            {paymentHistory.length > 0 && (
                                <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
                                    <h3 className="font-semibold text-sm text-muted-foreground mb-4 flex justify-between items-center">
                                        <span>Payment History</span>
                                        <span className="text-xs bg-muted px-2 py-1 rounded text-foreground">{paymentHistory.length} records</span>
                                    </h3>
                                    <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                                        {paymentHistory.map((h, i) => (
                                            <div key={i} className="flex justify-between items-center text-sm p-3 rounded-xl bg-muted/40 border border-border/50">
                                                <div>
                                                    <p className="font-medium text-foreground">{new Date(h.payment_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                                                    <p className="text-xs text-muted-foreground mt-0.5">{h.receipt_no}</p>
                                                    {h.months_selected && h.months_selected.length > 0 && (
                                                        <p className="text-[10px] text-primary font-medium mt-1 truncate max-w-[160px]" title={h.months_selected.map((m: string) => {
                                                            const days = h.month_days && h.month_days[m];
                                                            return days && days > 0 && days < 30 ? `${MONTH_LABELS[m] || m} (${days}d)` : (MONTH_LABELS[m] || m);
                                                        }).join(', ')}>
                                                            {h.months_selected.map((m: string) => {
                                                                const days = h.month_days && h.month_days[m];
                                                                return days && days > 0 && days < 30 ? `${MONTH_LABELS[m] || m}(${days}d)` : (MONTH_LABELS[m] || m);
                                                            }).join(', ')}
                                                        </p>
                                                    )}
                                                </div>
                                                <div className="text-right flex flex-col items-end gap-1.5">
                                                    <p className="font-bold text-emerald-600">{fmtINR(h.grand_total)}</p>
                                                    <div className="flex items-center gap-2">
                                                        <p className="text-[10px] text-muted-foreground uppercase">{h.payment_mode}</p>
                                                        <button onClick={() => handleDeleteReceipt(h.id)} className="text-red-400 hover:text-red-600 transition-colors" title="Delete payment">
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'ledger' && <TransportLedger />}
        </>
    );
};

export default TransportFeeTab;
