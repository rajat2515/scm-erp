/*
 * ╔══════════════════════════════════════════════════════════════╗
 * ║              FEE ANALYSIS TAB — SQL MIGRATIONS               ║
 * ╠══════════════════════════════════════════════════════════════╣
 *
 * No new tables are required. All queries use existing tables:
 *   - students          (sr_no, name, class, rte, tuition_discount, status)
 *   - fee_payments      (sr_no, month, due_amount, paid_amount, discount, paid_on, mode)
 *   - fee_structure     (class, monthly_fee)
 *
 * The component fetches data client-side and computes all
 * aggregates in-memory so no new views or procedures are needed.
 *
 * ── QUERY 1: Student list with fee records ──────────────────────
 * SELECT
 *   s.sr_no, s.name, s.class, s.rte, s.tuition_discount,
 *   fp.month, fp.due_amount, fp.paid_amount, fp.discount
 * FROM students s
 * LEFT JOIN fee_payments fp ON fp.sr_no = s.sr_no
 * WHERE s.status = 'active'
 *   AND (s.class = :class OR :class IS NULL)         -- class filter
 *   AND fp.month LIKE :sessionPattern                -- session filter
 * ORDER BY s.sr_no;
 *
 * ── QUERY 2: Expected fee with RTE & discount logic ─────────────
 * SELECT
 *   s.sr_no, s.name, s.class, s.rte, s.tuition_discount,
 *   fs.monthly_fee,
 *   CASE WHEN LOWER(s.rte) IN ('yes','rte') THEN 0
 *        ELSE GREATEST(0, fs.monthly_fee - COALESCE(s.tuition_discount,0))
 *   END AS effective_monthly_fee
 * FROM students s
 * LEFT JOIN fee_structure fs ON UPPER(fs.class) = UPPER(s.class)
 * WHERE s.status = 'active';
 *
 * ── QUERY 3: 12-month grid per student ──────────────────────────
 * SELECT sr_no, month, due_amount, paid_amount, discount
 * FROM fee_payments
 * WHERE month LIKE '% 2026' OR month LIKE '% 2027'  -- current session
 * ORDER BY sr_no, month;
 *
 * ── QUERY 4: Aggregate summary by class ─────────────────────────
 * SELECT
 *   s.class,
 *   SUM(CASE WHEN LOWER(s.rte) NOT IN ('yes','rte') THEN
 *         GREATEST(0, fs.monthly_fee - COALESCE(s.tuition_discount,0))
 *       ELSE 0 END) AS expected_per_student,
 *   COUNT(*) AS student_count,
 *   SUM(COALESCE(fp.paid_amount,0)) AS collected
 * FROM students s
 * LEFT JOIN fee_structure fs ON UPPER(fs.class) = UPPER(s.class)
 * LEFT JOIN fee_payments fp ON fp.sr_no = s.sr_no
 * WHERE s.status = 'active'
 * GROUP BY s.class;
 *
 * ── QUERY 5: Defaulters only ────────────────────────────────────
 * SELECT s.sr_no, s.name, s.class, fp.month,
 *        fp.due_amount, fp.paid_amount,
 *        (fp.due_amount - fp.paid_amount - COALESCE(fp.discount,0)) AS balance
 * FROM students s
 * JOIN fee_payments fp ON fp.sr_no = s.sr_no
 * WHERE s.status = 'active'
 *   AND (fp.due_amount - fp.paid_amount - COALESCE(fp.discount,0)) > 0
 * ORDER BY balance DESC;
 *
 * ╚══════════════════════════════════════════════════════════════╝
 */

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/config/supabaseClient';
import {
    Search, Download, Printer, Copy, ChevronDown, Loader2,
    TrendingUp, TrendingDown, Users, DollarSign, AlertTriangle,
    CheckCircle, Clock, X, BarChart3
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { CLASSES } from '../students/StudentDirectory';

/* ─── Constants ─────────────────────────────────────────────── */
const ANNUAL_FEE = 1200;
const EXAM_FEE = 200;

const MONTHS_2026_27 = [
    { key: 'April 2026',     label: 'Apr', session: '2026-27' },
    { key: 'May 2026',       label: 'May', session: '2026-27' },
    { key: 'June 2026',      label: 'Jun', session: '2026-27' },
    { key: 'July 2026',      label: 'Jul', session: '2026-27' },
    { key: 'August 2026',    label: 'Aug', session: '2026-27' },
    { key: 'September 2026', label: 'Sep', session: '2026-27' },
    { key: 'October 2026',   label: 'Oct', session: '2026-27' },
    { key: 'November 2026',  label: 'Nov', session: '2026-27' },
    { key: 'December 2026',  label: 'Dec', session: '2026-27' },
    { key: 'January 2027',   label: 'Jan', session: '2026-27' },
    { key: 'February 2027',  label: 'Feb', session: '2026-27' },
    { key: 'March 2027',     label: 'Mar', session: '2026-27' },
];

const MONTHS_2025_26 = [
    { key: 'April 2025',     label: 'Apr', session: '2025-26' },
    { key: 'May 2025',       label: 'May', session: '2025-26' },
    { key: 'June 2025',      label: 'Jun', session: '2025-26' },
    { key: 'July 2025',      label: 'Jul', session: '2025-26' },
    { key: 'August 2025',    label: 'Aug', session: '2025-26' },
    { key: 'September 2025', label: 'Sep', session: '2025-26' },
    { key: 'October 2025',   label: 'Oct', session: '2025-26' },
    { key: 'November 2025',  label: 'Nov', session: '2025-26' },
    { key: 'December 2025',  label: 'Dec', session: '2025-26' },
    { key: 'January 2026',   label: 'Jan', session: '2025-26' },
    { key: 'February 2026',  label: 'Feb', session: '2025-26' },
    { key: 'March 2026',     label: 'Mar', session: '2025-26' },
];

const ALL_FILTER_MONTHS = [
    { value: 'All', label: 'All Months' },
    { value: 'April',     label: 'April' },
    { value: 'May',       label: 'May' },
    { value: 'June',      label: 'June' },
    { value: 'July',      label: 'July' },
    { value: 'August',    label: 'August' },
    { value: 'September', label: 'September' },
    { value: 'October',   label: 'October' },
    { value: 'November',  label: 'November' },
    { value: 'December',  label: 'December' },
    { value: 'January',   label: 'January' },
    { value: 'February',  label: 'February' },
    { value: 'March',     label: 'March' },
];

/* ─── Types ──────────────────────────────────────────────────── */
interface StudentRec {
    sr_no: number;
    name: string;
    class: string;
    rte?: string;
    tuition_discount?: number;
    status?: string;
}

interface PaymentRec {
    sr_no: number;
    month: string;
    due_amount: number;
    paid_amount: number;
    discount?: number;
}

interface FeeStructure {
    class: string;
    monthly_fee: number;
}

interface AnalysisRow {
    sr_no: number;
    name: string;
    class: string;
    isRTE: boolean;
    expectedAmount: number;
    paidAmount: number;
    balance: number;
    status: 'Submitted' | 'Partial' | 'Pending';
}

interface ClassSummary {
    cls: string;
    expected: number;
    collected: number;
    pct: number;
}

interface MonthCellData {
    monthKey: string;
    expected: number;
    paid: number;
    balance: number;
    status: 'paid' | 'partial' | 'pending' | 'future';
}

/* ─── Helpers ────────────────────────────────────────────────── */
const fmtINR = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');

function isRTEStudent(rte?: string): boolean {
    return ['yes', 'rte'].includes((rte || '').toLowerCase());
}

function getEffectiveTuition(student: StudentRec, feeStr: FeeStructure[]): number {
    if (isRTEStudent(student.rte)) return 0;
    const key = student.class.trim().toUpperCase();
    const base = feeStr.find(f => f.class.trim().toUpperCase() === key)?.monthly_fee || 0;
    return Math.max(0, base - (student.tuition_discount || 0));
}

/* ─── Cell Popup ─────────────────────────────────────────────── */
const CellPopup: React.FC<{
    month: string; expected: number; paid: number; balance: number;
    onClose: () => void;
}> = ({ month, expected, paid, balance, onClose }) => (
    <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
        onClick={onClose}
    >
        <div
            className="bg-card border border-border rounded-2xl shadow-xl p-6 w-72 animate-fade-in"
            onClick={e => e.stopPropagation()}
        >
            <div className="flex items-center justify-between mb-4">
                <h4 className="font-bold text-base">{month}</h4>
                <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted transition-colors">
                    <X className="w-4 h-4 text-muted-foreground" />
                </button>
            </div>
            <div className="space-y-3">
                {[
                    { label: 'Expected', value: fmtINR(expected), cls: 'text-foreground' },
                    { label: 'Paid', value: fmtINR(paid), cls: 'text-emerald-600 font-bold' },
                    { label: 'Balance', value: fmtINR(balance), cls: balance > 0 ? 'text-red-600 font-bold' : 'text-emerald-600 font-bold' },
                ].map(r => (
                    <div key={r.label} className="flex justify-between items-center text-sm border-b border-border/60 pb-2 last:border-0">
                        <span className="text-muted-foreground">{r.label}</span>
                        <span className={r.cls}>{r.value}</span>
                    </div>
                ))}
            </div>
        </div>
    </div>
);

/* ─── Simple Bar Chart ───────────────────────────────────────── */
const ClassBarChart: React.FC<{ data: ClassSummary[] }> = ({ data }) => {
    if (data.length === 0) return (
        <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
            No data available
        </div>
    );

    const maxExpected = Math.max(...data.map(d => d.expected), 1);

    return (
        <div className="w-full overflow-x-auto">
            <div className="min-w-[400px]">
                <div className="flex items-end gap-2 h-44 mb-2 px-2">
                    {data.map(d => {
                        const heightPct = d.expected > 0 ? (d.expected / maxExpected) * 100 : 5;
                        const collectedHeight = d.expected > 0 ? (d.collected / d.expected) * heightPct : 0;
                        const color = d.pct >= 80
                            ? 'bg-emerald-500'
                            : d.pct >= 50
                                ? 'bg-amber-500'
                                : 'bg-red-500';
                        return (
                            <div
                                key={d.cls}
                                className="flex-1 flex flex-col items-center gap-1 group relative"
                            >
                                {/* Percentage tooltip */}
                                <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-7 left-1/2 -translate-x-1/2 bg-foreground text-background text-[10px] font-bold px-2 py-0.5 rounded whitespace-nowrap z-10">
                                    {d.pct.toFixed(0)}%
                                </div>
                                <div
                                    className="w-full rounded-t-lg bg-muted/40 relative overflow-hidden"
                                    style={{ height: `${heightPct}%` }}
                                >
                                    <div
                                        className={`absolute bottom-0 w-full rounded-t-lg transition-all duration-700 ${color}`}
                                        style={{ height: `${Math.min(100, d.pct)}%` }}
                                    />
                                </div>
                                <span className="text-[9px] text-muted-foreground font-medium truncate max-w-full text-center">
                                    {d.cls.replace('CLASS ', '').replace('Class ', '').replace('ONE', '1').replace('TWO', '2').replace('THREE', '3').replace('FOUR', '4').replace('FIVE', '5').replace('SIX', '6').replace('SEVEN', '7').replace('EIGHT', '8').replace('NINE', '9').replace('TEN', '10')}
                                </span>
                            </div>
                        );
                    })}
                </div>
                {/* Legend */}
                <div className="flex items-center justify-center gap-4 text-[10px] text-muted-foreground mt-1">
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block" /> 80%+</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-amber-500 inline-block" /> 50–80%</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-red-500 inline-block" /> &lt;50%</span>
                </div>
            </div>
        </div>
    );
};

/* ─── Summary Cards ──────────────────────────────────────────── */
const SummaryCards: React.FC<{
    rows: AnalysisRow[];
    rteCount: number;
}> = ({ rows, rteCount }) => {
    const totalExpected = rows.reduce((s, r) => s + r.expectedAmount, 0);
    const totalCollected = rows.reduce((s, r) => s + r.paidAmount, 0);
    const totalBalance = rows.reduce((s, r) => s + r.balance, 0);
    const totalPartial = rows
        .filter(r => r.status === 'Partial')
        .reduce((s, r) => s + r.paidAmount, 0);

    const cards = [
        {
            label: 'Total Expected',
            value: fmtINR(totalExpected),
            icon: <DollarSign className="w-5 h-5" />,
            bg: 'bg-gradient-to-br from-blue-500 to-indigo-600',
            sub: 'Excl. RTE students',
        },
        {
            label: 'Total Collected',
            value: fmtINR(totalCollected),
            icon: <CheckCircle className="w-5 h-5" />,
            bg: 'bg-gradient-to-br from-emerald-500 to-green-600',
            sub: `${totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 100) : 0}% of expected`,
        },
        {
            label: 'Remaining Balance',
            value: fmtINR(totalBalance),
            icon: <TrendingDown className="w-5 h-5" />,
            bg: 'bg-gradient-to-br from-red-500 to-rose-600',
            sub: 'Pending + Partial',
        },
        {
            label: 'Partial Payments',
            value: fmtINR(totalPartial),
            icon: <Clock className="w-5 h-5" />,
            bg: 'bg-gradient-to-br from-amber-500 to-orange-600',
            sub: `${rows.filter(r => r.status === 'Partial').length} students`,
        },
        {
            label: 'RTE Students',
            value: String(rteCount),
            icon: <Users className="w-5 h-5" />,
            bg: 'bg-gradient-to-br from-purple-500 to-violet-600',
            sub: 'Govt. sponsored',
        },
    ];

    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {cards.map(c => (
                <div
                    key={c.label}
                    className={`${c.bg} text-white rounded-2xl p-4 shadow-md flex flex-col gap-2`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold uppercase tracking-wider opacity-80">
                            {c.label}
                        </span>
                        <div className="opacity-70">{c.icon}</div>
                    </div>
                    <p className="text-xl font-black leading-tight">{c.value}</p>
                    <p className="text-[10px] opacity-70 font-medium">{c.sub}</p>
                </div>
            ))}
        </div>
    );
};

/* ─── Status Badge ───────────────────────────────────────────── */
const StatusBadge: React.FC<{ status: 'Submitted' | 'Partial' | 'Pending' }> = ({ status }) => {
    const map = {
        Submitted: 'bg-emerald-100 text-emerald-700 border-emerald-200',
        Partial:   'bg-amber-100 text-amber-700 border-amber-200',
        Pending:   'bg-red-100 text-red-700 border-red-200',
    };
    const icon = {
        Submitted: '✅',
        Partial:   '🟡',
        Pending:   '❌',
    };
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${map[status]}`}>
            {icon[status]} {status}
        </span>
    );
};

/* ─── Main FeeAnalysisTab ────────────────────────────────────── */
const FeeAnalysisTab: React.FC<{ feeStr: FeeStructure[] }> = ({ feeStr }) => {
    // Filters
    const [search, setSearch] = useState('');
    const [classFilter, setClassFilter] = useState('');
    const [session, setSession] = useState<'2026-27' | '2025-26'>('2026-27');
    const [monthFilter, setMonthFilter] = useState('All');

    // Data
    const [students, setStudents] = useState<StudentRec[]>([]);
    const [payments, setPayments] = useState<PaymentRec[]>([]);
    const [loading, setLoading] = useState(false);

    // Sub-tab
    const [subTab, setSubTab] = useState<'overview' | 'defaulters' | 'grid'>('overview');

    // Cell popup for grid view
    const [popup, setPopup] = useState<{
        monthKey: string; expected: number; paid: number; balance: number;
    } | null>(null);

    const sessionMonths = session === '2026-27' ? MONTHS_2026_27 : MONTHS_2025_26;

    /* ── Load Data ─────────────────────────────────────────── */
    const loadData = useCallback(async () => {
        setLoading(true);
        // 1. Students
        let sq = supabase
            .from('students')
            .select('sr_no,name,class,rte,tuition_discount,status')
            .eq('status', 'active');
        if (classFilter) sq = sq.eq('class', classFilter);

        const { data: stuData } = await sq.order('sr_no');
        const stuList: StudentRec[] = (stuData || []);

        if (stuList.length === 0) {
            setStudents([]);
            setPayments([]);
            setLoading(false);
            return;
        }

        const srNos = stuList.map(s => s.sr_no);

        // 2. Payments — fetch all months for this session
        const monthKeys = sessionMonths.map(m => m.key);
        const { data: payData } = await supabase
            .from('fee_payments')
            .select('sr_no,month,due_amount,paid_amount,discount')
            .in('sr_no', srNos)
            .in('month', monthKeys);

        setStudents(stuList);
        setPayments(payData || []);
        setLoading(false);
    }, [classFilter, session, sessionMonths]);

    useEffect(() => { loadData(); }, [loadData]);

    /* ── Build Analysis Rows ──────────────────────────────── */
    const payMap = useMemo(() => {
        const m = new Map<string, PaymentRec>();
        payments.forEach(p => m.set(`${p.sr_no}::${p.month}`, p));
        return m;
    }, [payments]);

    // Figure out which months to include in analysis (for the selected month filter)
    const filteredMonths = useMemo(() => {
        if (monthFilter === 'All') return sessionMonths;
        return sessionMonths.filter(m => m.label.toLowerCase() === monthFilter.toLowerCase() ||
            m.key.toLowerCase().startsWith(monthFilter.toLowerCase()));
    }, [sessionMonths, monthFilter]);

    const analysisRows = useMemo((): AnalysisRow[] => {
        const term = search.toLowerCase().trim();
        return students
            .filter(s => {
                if (!term) return true;
                return s.name.toLowerCase().includes(term) || String(s.sr_no).includes(term);
            })
            .map(s => {
                const tuition = getEffectiveTuition(s, feeStr);
                let expectedTotal = 0;
                let paidTotal = 0;

                filteredMonths.forEach(m => {
                    const rec = payMap.get(`${s.sr_no}::${m.key}`);
                    const expected = tuition; // monthly tuition
                    expectedTotal += expected;

                    const paid = rec ? rec.paid_amount : 0;
                    const disc = rec ? (rec.discount || 0) : 0;
                    paidTotal += Math.min(paid + disc, expected);
                });

                const balance = Math.max(0, expectedTotal - paidTotal);
                let status: 'Submitted' | 'Partial' | 'Pending';
                if (paidTotal >= expectedTotal && expectedTotal > 0) status = 'Submitted';
                else if (paidTotal > 0) status = 'Partial';
                else status = 'Pending';

                return {
                    sr_no: s.sr_no,
                    name: s.name,
                    class: s.class,
                    isRTE: isRTEStudent(s.rte),
                    expectedAmount: expectedTotal,
                    paidAmount: paidTotal,
                    balance,
                    status,
                };
            });
    }, [students, search, filteredMonths, payMap, feeStr]);

    const rteCount = useMemo(() => students.filter(s => isRTEStudent(s.rte)).length, [students]);

    /* ── Class Summary for Chart ──────────────────────────── */
    const classSummaries = useMemo((): ClassSummary[] => {
        const map = new Map<string, { expected: number; collected: number }>();
        analysisRows.forEach(r => {
            const prev = map.get(r.class) || { expected: 0, collected: 0 };
            map.set(r.class, {
                expected: prev.expected + r.expectedAmount,
                collected: prev.collected + r.paidAmount,
            });
        });
        return Array.from(map.entries())
            .map(([cls, v]) => ({
                cls,
                expected: v.expected,
                collected: v.collected,
                pct: v.expected > 0 ? (v.collected / v.expected) * 100 : 0,
            }))
            .sort((a, b) => a.cls.localeCompare(b.cls));
    }, [analysisRows]);

    /* ── Defaulters ───────────────────────────────────────── */
    const defaulters = useMemo(() =>
        analysisRows.filter(r => r.status === 'Partial' || r.status === 'Pending'),
        [analysisRows]);

    /* ── 12-Month Grid Data ───────────────────────────────── */
    const gridData = useMemo(() => {
        const today = new Date();
        return students.map(s => {
            const tuition = getEffectiveTuition(s, feeStr);
            const cells: MonthCellData[] = sessionMonths.map(m => {
                // Determine if month is in the future
                const [mName, mYear] = m.key.split(' ');
                const mIdx = ['January','February','March','April','May','June','July','August','September','October','November','December'].indexOf(mName);
                const mDate = new Date(parseInt(mYear), mIdx, 1);
                const isFuture = mDate > today;

                const rec = payMap.get(`${s.sr_no}::${m.key}`);
                const expected = tuition;
                const paid = rec ? rec.paid_amount : 0;
                const disc = rec ? (rec.discount || 0) : 0;
                const balance = Math.max(0, expected - paid - disc);

                let status: MonthCellData['status'];
                if (isFuture && !rec) status = 'future';
                else if ((paid + disc) >= expected && expected > 0) status = 'paid';
                else if (paid > 0 || disc > 0) status = 'partial';
                else status = 'pending';

                return { monthKey: m.key, expected, paid: paid + disc, balance, status };
            });
            return { student: s, cells };
        });
    }, [students, sessionMonths, payMap, feeStr]);

    /* ── Excel Export ─────────────────────────────────────── */
    const handleExport = () => {
        const wb = XLSX.utils.book_new();

        // Sheet 1: Student Status
        const sheet1 = XLSX.utils.json_to_sheet(
            analysisRows.map(r => ({
                'SR Number': r.sr_no,
                'Student Name': r.name,
                'Class': r.class,
                'RTE': r.isRTE ? 'Yes' : 'No',
                'Expected Amount': r.expectedAmount,
                'Paid Amount': r.paidAmount,
                'Balance': r.balance,
                'Status': r.status,
            }))
        );
        XLSX.utils.book_append_sheet(wb, sheet1, 'Payment Status');

        // Sheet 2: Summary
        const totalExpected = analysisRows.reduce((s, r) => s + r.expectedAmount, 0);
        const totalCollected = analysisRows.reduce((s, r) => s + r.paidAmount, 0);
        const sheet2 = XLSX.utils.json_to_sheet([
            { 'Metric': 'Total Expected Revenue', 'Value': totalExpected },
            { 'Metric': 'Total Collected', 'Value': totalCollected },
            { 'Metric': 'Remaining Balance', 'Value': totalExpected - totalCollected },
            { 'Metric': 'Partial Payments Count', 'Value': analysisRows.filter(r => r.status === 'Partial').length },
            { 'Metric': 'Pending Count', 'Value': analysisRows.filter(r => r.status === 'Pending').length },
            { 'Metric': 'RTE Students Count', 'Value': rteCount },
        ]);
        XLSX.utils.book_append_sheet(wb, sheet2, 'Summary');

        // Sheet 3: Defaulters
        const sheet3 = XLSX.utils.json_to_sheet(
            defaulters.map(r => ({
                'SR Number': r.sr_no,
                'Student Name': r.name,
                'Class': r.class,
                'Expected': r.expectedAmount,
                'Paid': r.paidAmount,
                'Balance': r.balance,
                'Status': r.status,
            }))
        );
        XLSX.utils.book_append_sheet(wb, sheet3, 'Defaulters');

        const filename = `FeeAnalysis_${classFilter || 'AllClasses'}_${monthFilter}_${session}.xlsx`;
        XLSX.writeFile(wb, filename);
    };

    /* ── Print Defaulters ─────────────────────────────────── */
    const handlePrintDefaulters = () => {
        const win = window.open('', '_blank', 'width=800,height=600');
        if (!win) return;
        const rows = defaulters.map(r =>
            `<tr><td>${r.sr_no}</td><td>${r.name}</td><td>${r.class}</td><td>₹${r.expectedAmount.toLocaleString('en-IN')}</td><td>₹${r.paidAmount.toLocaleString('en-IN')}</td><td>₹${r.balance.toLocaleString('en-IN')}</td><td>${r.status}</td></tr>`
        ).join('');
        win.document.write(`<!DOCTYPE html><html><head>
            <title>Defaulter List</title>
            <style>
                @page { size: A4; margin: 15mm; }
                body { font-family: Arial, sans-serif; font-size: 12px; }
                h2 { text-align: center; margin-bottom: 4px; }
                p { text-align: center; color: #555; margin-bottom: 12px; font-size: 11px; }
                table { width: 100%; border-collapse: collapse; }
                th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
                th { background: #f0f0f0; font-weight: bold; }
                tr:nth-child(even) { background: #f9f9f9; }
            </style></head><body>
            <h2>S.C.M. Children Academy — Defaulter List</h2>
            <p>Session: ${session} | Class: ${classFilter || 'All'} | Month: ${monthFilter} | Generated: ${new Date().toLocaleDateString('en-IN')}</p>
            <table>
                <thead><tr><th>SR No.</th><th>Name</th><th>Class</th><th>Expected</th><th>Paid</th><th>Balance</th><th>Status</th></tr></thead>
                <tbody>${rows}</tbody>
            </table>
        </body></html>`);
        win.document.close();
        setTimeout(() => { win.print(); }, 400);
    };

    /* ── Copy Defaulters ──────────────────────────────────── */
    const handleCopyDefaulters = () => {
        const text = defaulters
            .map(r => `${r.name} (SR ${r.sr_no}, ${r.class}) — Balance: ₹${r.balance.toLocaleString('en-IN')}`)
            .join('\n');
        navigator.clipboard.writeText(text).then(() => {
            alert(`Copied ${defaulters.length} defaulters to clipboard!`);
        });
    };

    /* ── Render ──────────────────────────────────────────────── */
    return (
        <div className="space-y-5 animate-fade-in">
            {/* ── Top Filter Bar ──────────────────────────────────── */}
            <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
                <div className="flex flex-wrap gap-3 items-center">
                    {/* Search */}
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search by name or SR number…"
                            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                    </div>

                    {/* Class Filter */}
                    <div className="relative">
                        <select
                            value={classFilter}
                            onChange={e => setClassFilter(e.target.value)}
                            className="pl-3 pr-8 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none appearance-none min-w-[130px]"
                        >
                            <option value="">All Classes</option>
                            {CLASSES.slice(1).map(c => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                    </div>

                    {/* Session Filter */}
                    <div className="relative">
                        <select
                            value={session}
                            onChange={e => setSession(e.target.value as '2026-27' | '2025-26')}
                            className="pl-3 pr-8 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none appearance-none"
                        >
                            <option value="2026-27">Session 2026–27</option>
                            <option value="2025-26">Session 2025–26</option>
                        </select>
                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                    </div>

                    {/* Month Filter */}
                    <div className="relative">
                        <select
                            value={monthFilter}
                            onChange={e => setMonthFilter(e.target.value)}
                            className="pl-3 pr-8 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none appearance-none"
                        >
                            {ALL_FILTER_MONTHS.map(m => (
                                <option key={m.value} value={m.value}>{m.label}</option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                    </div>

                    {/* Export Button */}
                    <button
                        onClick={handleExport}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-all shadow-sm"
                    >
                        <Download className="w-4 h-4" />
                        Export Excel
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-20 gap-3 text-muted-foreground">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    <span className="text-sm">Loading fee data…</span>
                </div>
            ) : (
                <>
                    {/* ── Summary Cards ───────────────────────────────── */}
                    <SummaryCards rows={analysisRows} rteCount={rteCount} />

                    {/* ── Sub-tab switcher ─────────────────────────────── */}
                    <div className="flex bg-muted/50 p-1.5 rounded-2xl w-fit gap-1">
                        {[
                            { id: 'overview' as const, label: 'Payment Status', icon: <TrendingUp className="w-3.5 h-3.5" /> },
                            { id: 'defaulters' as const, label: 'Defaulter List', icon: <AlertTriangle className="w-3.5 h-3.5" /> },
                            { id: 'grid' as const, label: '12-Month Grid', icon: <BarChart3 className="w-3.5 h-3.5" /> },
                        ].map(t => (
                            <button
                                key={t.id}
                                onClick={() => setSubTab(t.id)}
                                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${subTab === t.id
                                    ? 'bg-card text-foreground shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                                }`}
                            >
                                {t.icon} {t.label}
                            </button>
                        ))}
                    </div>

                    {/* ── OVERVIEW TAB ─────────────────────────────────── */}
                    {subTab === 'overview' && (
                        <div className="space-y-5">
                            {/* Class-wise Chart */}
                            <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
                                <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
                                    <BarChart3 className="w-4 h-4 text-primary" />
                                    Class-wise Fee Collection
                                    <span className="text-xs font-normal text-muted-foreground ml-1">
                                        (hover over bars for %)
                                    </span>
                                </h3>
                                <ClassBarChart data={classSummaries} />
                            </div>

                            {/* Payment Status Table */}
                            <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
                                <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                                    <h3 className="font-semibold text-sm">
                                        Monthly Payment Status
                                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                                            {analysisRows.length} students
                                        </span>
                                    </h3>
                                </div>
                                {analysisRows.length === 0 ? (
                                    <div className="text-center py-16 text-muted-foreground text-sm">
                                        No students found. Try changing filters.
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="border-b border-border bg-muted/30">
                                                    {['SR No.', 'Student Name', 'Class', 'Expected', 'Paid', 'Balance', 'Status'].map(h => (
                                                        <th
                                                            key={h}
                                                            className={`px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide ${
                                                                ['Expected', 'Paid', 'Balance'].includes(h) ? 'text-right' : 'text-left'
                                                            }`}
                                                        >
                                                            {h}
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-border">
                                                {analysisRows.map(r => (
                                                    <tr key={r.sr_no} className="hover:bg-muted/20 transition-colors">
                                                        <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{r.sr_no}</td>
                                                        <td className="px-4 py-2.5 font-medium">
                                                            {r.name}
                                                            {r.isRTE && (
                                                                <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700">RTE</span>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-2.5 text-muted-foreground text-xs">{r.class}</td>
                                                        <td className="px-4 py-2.5 text-right">{fmtINR(r.expectedAmount)}</td>
                                                        <td className="px-4 py-2.5 text-right font-semibold text-emerald-600">{fmtINR(r.paidAmount)}</td>
                                                        <td className={`px-4 py-2.5 text-right font-bold ${r.balance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                                            {fmtINR(r.balance)}
                                                        </td>
                                                        <td className="px-4 py-2.5"><StatusBadge status={r.status} /></td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ── DEFAULTERS TAB ───────────────────────────────── */}
                    {subTab === 'defaulters' && (
                        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
                            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                                <div>
                                    <h3 className="font-semibold text-sm flex items-center gap-2">
                                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                                        Defaulter List
                                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 border border-red-200">
                                            {defaulters.length} students
                                        </span>
                                    </h3>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        Students with Partial or Pending fee status
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={handleCopyDefaulters}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                                    >
                                        <Copy className="w-3.5 h-3.5" /> Copy
                                    </button>
                                    <button
                                        onClick={handlePrintDefaulters}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-all"
                                    >
                                        <Printer className="w-3.5 h-3.5" /> Print
                                    </button>
                                </div>
                            </div>
                            {defaulters.length === 0 ? (
                                <div className="text-center py-16 space-y-2">
                                    <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto" />
                                    <p className="font-medium text-emerald-700">All Clear!</p>
                                    <p className="text-xs text-muted-foreground">No defaulters in the current selection.</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-border bg-muted/30">
                                                {['SR No.', 'Student Name', 'Class', 'Expected', 'Paid', 'Balance', 'Status'].map(h => (
                                                    <th
                                                        key={h}
                                                        className={`px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide ${
                                                            ['Expected', 'Paid', 'Balance'].includes(h) ? 'text-right' : 'text-left'
                                                        }`}
                                                    >
                                                        {h}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border">
                                            {defaulters.map(r => (
                                                <tr key={r.sr_no} className="hover:bg-muted/20 transition-colors">
                                                    <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{r.sr_no}</td>
                                                    <td className="px-4 py-2.5 font-medium">{r.name}</td>
                                                    <td className="px-4 py-2.5 text-muted-foreground text-xs">{r.class}</td>
                                                    <td className="px-4 py-2.5 text-right">{fmtINR(r.expectedAmount)}</td>
                                                    <td className="px-4 py-2.5 text-right font-semibold text-emerald-600">{fmtINR(r.paidAmount)}</td>
                                                    <td className="px-4 py-2.5 text-right font-bold text-red-600">{fmtINR(r.balance)}</td>
                                                    <td className="px-4 py-2.5"><StatusBadge status={r.status} /></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── 12-MONTH GRID TAB ────────────────────────────── */}
                    {subTab === 'grid' && (
                        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
                            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                                <div>
                                    <h3 className="font-semibold text-sm">12-Month Fee Grid</h3>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        Click any cell to see details
                                    </p>
                                </div>
                                <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block" /> Paid</span>
                                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-amber-400 inline-block" /> Partial</span>
                                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-red-400 inline-block" /> Pending</span>
                                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-muted inline-block border" /> Future</span>
                                </div>
                            </div>
                            {gridData.length === 0 ? (
                                <div className="text-center py-16 text-muted-foreground text-sm">
                                    No students match the current filters.
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-[11px] min-w-[700px]">
                                        <thead>
                                            <tr className="border-b border-border bg-muted/30">
                                                <th className="px-3 py-2 text-left font-medium text-muted-foreground sticky left-0 bg-muted/30 z-10 min-w-[180px]">
                                                    Student
                                                </th>
                                                {sessionMonths.map(m => (
                                                    <th key={m.key} className="px-1.5 py-2 text-center font-medium text-muted-foreground w-12">
                                                        {m.label}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border">
                                            {gridData.map(({ student, cells }) => (
                                                <tr key={student.sr_no} className="hover:bg-muted/10 transition-colors">
                                                    <td className="px-3 py-2 sticky left-0 bg-card z-10 border-r border-border">
                                                        <p className="font-medium text-xs truncate max-w-[160px]">{student.name}</p>
                                                        <p className="text-[10px] text-muted-foreground">{student.class}</p>
                                                    </td>
                                                    {cells.map(cell => {
                                                        const colorMap: Record<string, string> = {
                                                            paid: 'bg-emerald-500',
                                                            partial: 'bg-amber-400',
                                                            pending: 'bg-red-400',
                                                            future: 'bg-muted border border-border',
                                                        };
                                                        return (
                                                            <td key={cell.monthKey} className="px-1 py-2 text-center">
                                                                <button
                                                                    onClick={() => setPopup({
                                                                        monthKey: cell.monthKey,
                                                                        expected: cell.expected,
                                                                        paid: cell.paid,
                                                                        balance: cell.balance,
                                                                    })}
                                                                    className={`w-7 h-7 rounded-md ${colorMap[cell.status]} transition-transform hover:scale-110 mx-auto block`}
                                                                    title={`${cell.monthKey}: ₹${cell.paid} / ₹${cell.expected}`}
                                                                />
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}

            {/* Cell Popup */}
            {popup && (
                <CellPopup
                    month={popup.monthKey}
                    expected={popup.expected}
                    paid={popup.paid}
                    balance={popup.balance}
                    onClose={() => setPopup(null)}
                />
            )}
        </div>
    );
};

export default FeeAnalysisTab;
