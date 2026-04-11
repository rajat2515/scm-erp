import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '@/components/layout/AppShell';
import { supabase } from '@/config/supabaseClient';
import { ArrowLeft, ArrowRight, Check, Loader2, UserPlus, Printer } from 'lucide-react';

const CLASSES = ['Nursery', 'NUR A', 'NUR B', 'LKG', 'LKG A', 'LKG B', 'UKG', 'UKG A', 'UKG B', 'ONE A', 'ONE B', 'TWO A', 'TWO B', 'THREE A', 'THREE B', 'FOUR A', 'FOUR B', 'FIVE A', 'FIVE B', 'SIX A', 'SIX B', 'SEVEN A', 'SEVEN B', 'EIGHT A', 'EIGHT B', 'NINE', 'TEN'];
const STEPS = ['Personal Info', 'Family & Contact', 'Academic & Other'];

/* ── Admission Fee breakdown (Yearly One-Time) ── */
const ADMISSION_FEE_ITEMS = [
    { label: 'Registration Fee',    amount: 100  },
    { label: 'Admission Charges',   amount: 2000 },
    { label: 'Generator Fee',       amount: 800  },
    { label: 'I.D. Card & Diary',   amount: 200  },
    { label: 'Sports',              amount: 500  },
    { label: 'Computer Fee',        amount: 500  },
    { label: 'Culture Activity',    amount: 500  },
    { label: 'Library',             amount: 500  },
];
const ADMISSION_FEE_TOTAL = ADMISSION_FEE_ITEMS.reduce((s, i) => s + i.amount, 0); // 5100

/* ── Admission Year helper ── */
const getAdmissionYear = (dateStr: string) => {
    const d = dateStr ? new Date(dateStr) : new Date();
    const year = d.getFullYear();
    const month = d.getMonth(); // 0-indexed; April = 3
    if (month >= 3) return `${year}-${String(year + 1).slice(2)}`; // e.g. 2026-27
    return `${year - 1}-${String(year).slice(2)}`;
};

const emptyForm = {
    sr_no: '' as unknown as number,
    roll_no: '',
    name: '',
    class: 'ONE A',
    dob: '',
    admission_date: new Date().toISOString().split('T')[0],
    gender: 'male' as 'male' | 'female' | 'other',
    mother_name: '',
    father_name: '',
    father_income: null as unknown as number,
    address: '',
    phone: '',
    email: '',
    whatsapp: '',
    aadhar_card: '',
    pen_no: '',
    caste: '',
    religion: '',
    blood_group: '',
    rte: 'NO' as string,
    occupation: '',
    nationality: 'Indian',
    house: '',
    status: 'active' as 'active' | 'inactive' | 'transferred',
    collect_admission_fee: true,
    pay_status: 'now' as 'now' | 'later',
    pay_mode: 'cash' as 'cash' | 'online' | 'cheque',
};

/* ─── Print Admission Receipt ───────────────────────────────── */
interface AdmissionReceiptData {
    student: { sr_no: number; name: string; class: string; father_name: string; admission_date: string };
    items: { label: string; amount: number }[];
    total: number;
    admissionYear: string;
    paymentMode: string;
    receiptNo: string;
    printDate: string;
}

const PrintAdmissionReceipt: React.FC<{ data: AdmissionReceiptData | null }> = ({ data }) => {
    if (!data) return null;
    return (
        <div id="admission-receipt-print-area" style={{ display: 'none', fontFamily: 'Arial, sans-serif', padding: '8mm 14mm', color: '#000', background: '#fff' }}>
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

            {/* Title */}
            <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: 15, textDecoration: 'underline', marginBottom: 8 }}>
                ADMISSION FEE RECEIPT — {data.admissionYear}
            </div>

            {/* Receipt Meta */}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 10 }}>
                <div><strong>Receipt No:</strong> {data.receiptNo}</div>
                <div><strong>Date:</strong> {data.printDate}</div>
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
                        ['Admission Date', data.student.admission_date],
                    ].map(([label, val]) => (
                        <tr key={label}>
                            <td style={{ border: '1px solid #aaa', padding: '4px 8px', fontWeight: 'bold', width: '35%', background: '#f5f5f5' }}>{label}</td>
                            <td style={{ border: '1px solid #aaa', padding: '4px 8px', color: '#104d82', fontWeight: 'bold' }}>{val}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* Fee Breakdown */}
            <div style={{ fontWeight: 'bold', fontSize: 13, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Yearly Fee — One Time (Session {data.admissionYear})
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 12 }}>
                <thead>
                    <tr style={{ background: '#daeaf7' }}>
                        <th style={{ border: '1px solid #aaa', padding: '5px 8px', textAlign: 'left' }}>Description</th>
                        <th style={{ border: '1px solid #aaa', padding: '5px 8px', textAlign: 'right' }}>Amount (₹)</th>
                    </tr>
                </thead>
                <tbody>
                    {data.items.map((it, idx) => (
                        <tr key={idx} style={{ background: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
                            <td style={{ border: '1px solid #aaa', padding: '5px 8px' }}>{it.label}</td>
                            <td style={{ border: '1px solid #aaa', padding: '5px 8px', textAlign: 'right' }}>{it.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        </tr>
                    ))}
                    <tr style={{ background: '#d1fae5' }}>
                        <td style={{ border: '1px solid #aaa', padding: '5px 8px', fontWeight: 900, fontSize: 14 }}>TOTAL</td>
                        <td style={{ border: '1px solid #aaa', padding: '5px 8px', textAlign: 'right', fontWeight: 900, fontSize: 14, color: '#065f46' }}>
                            ₹{data.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                    </tr>
                </tbody>
            </table>

            {/* Note */}
            <div style={{ fontSize: 10, color: '#555', marginBottom: 16, fontStyle: 'italic' }}>
                * This fee covers the one-time annual charges for the admission year {data.admissionYear}.
            </div>

            {/* Signatures */}
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

/* ─── Main Component ─────────────────────────────────────── */
const StudentRegistration: React.FC = () => {
    const navigate = useNavigate();
    const [step, setStep] = useState(0);
    const [form, setForm] = useState(emptyForm);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [admissionReceiptData, setAdmissionReceiptData] = useState<AdmissionReceiptData | null>(null);

    useEffect(() => {
        const fetchLatestSrNo = async () => {
            try {
                // Paginate through all students to avoid Supabase 1000-row cap
                const allSrNos: number[] = [];
                const batchSize = 1000;
                let from = 0;

                while (true) {
                    const { data, error } = await supabase
                        .from('students')
                        .select('sr_no')
                        .order('sr_no', { ascending: true })
                        .range(from, from + batchSize - 1);

                    if (error) {
                        console.error("Error fetching SR Nos:", error);
                        return;
                    }
                    if (!data || data.length === 0) break;

                    allSrNos.push(...data.map(r => Number(r.sr_no)));

                    if (data.length < batchSize) break; // last page
                    from += batchSize;
                }

                if (allSrNos.length > 0) {
                    // Find the first missing gap in the sorted list
                    let expectedSr = allSrNos[0];
                    for (const sr of allSrNos) {
                        if (sr === expectedSr) {
                            expectedSr++;
                        } else if (sr > expectedSr) {
                            break; // Found the first gap
                        }
                    }
                    setForm(prev => ({ ...prev, sr_no: expectedSr }));
                } else {
                    setForm(prev => ({ ...prev, sr_no: 1 }));
                }
            } catch (err) {
                console.error("Failed to fetch latest SR No:", err);
            }
        };

        fetchLatestSrNo();
    }, []);

    const update = (field: string, value: string | number | boolean) =>
        setForm((prev) => ({ ...prev, [field]: value }));

    const ic = 'w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all';
    const lc = 'block text-sm font-medium text-foreground mb-1.5';

    const validateStep = (): boolean => {
        if (step === 0 && (!form.name || !form.dob || !form.gender)) {
            setError('Please fill Name, Date of Birth, and Gender.'); return false;
        }
        if (step === 1 && (!form.father_name || !form.phone)) {
            setError('Please fill Father\'s Name and Phone Number.'); return false;
        }
        if (step === 2 && !form.sr_no) {
            setError('SR No. is required.'); return false;
        }
        setError(''); return true;
    };

    const triggerAdmissionPrint = (data: AdmissionReceiptData) => {
        setAdmissionReceiptData(data);
        setTimeout(() => {
            const area = document.getElementById('admission-receipt-print-area');
            if (!area) return;
            area.style.display = 'block';
            const cleanup = () => {
                area.style.display = 'none';
                window.removeEventListener('afterprint', cleanup);
            };
            window.addEventListener('afterprint', cleanup);
            window.print();
        }, 200);
    };

    const handleSubmit = async () => {
        if (!validateStep()) return;
        setSaving(true); setError('');
        try {
            const { collect_admission_fee, pay_mode, ...studentData } = form;
            const payload = { ...studentData, sr_no: Number(form.sr_no) };
            
            const { error: insertError } = await supabase.from('students').insert([payload]);
            if (insertError) throw insertError;

            const admissionYear = getAdmissionYear(form.admission_date);

            // Handle Admission Fee (one-time, single row)
            if (collect_admission_fee) {
                const isPaidNow = form.pay_status === 'now';
                const feeKey = `Admission Fee ${admissionYear}`;
                const feePayload = {
                    sr_no: payload.sr_no,
                    month: feeKey,
                    due_amount: ADMISSION_FEE_TOTAL,
                    paid_amount: isPaidNow ? ADMISSION_FEE_TOTAL : 0,
                    paid_on: isPaidNow ? new Date().toISOString().split('T')[0] : null,
                    mode: isPaidNow ? pay_mode : 'unpaid',
                };
                const { error: feeErr } = await supabase.from('fee_payments').insert([feePayload]);
                if (feeErr) console.error("Could not add admission fee:", feeErr);

                if (isPaidNow) {
                    // Build receipt data for printing
                    const receiptData: AdmissionReceiptData = {
                        student: {
                            sr_no: payload.sr_no,
                            name: payload.name,
                            class: payload.class,
                            father_name: payload.father_name,
                            admission_date: payload.admission_date,
                        },
                        items: ADMISSION_FEE_ITEMS,
                        total: ADMISSION_FEE_TOTAL,
                        admissionYear,
                        paymentMode: pay_mode,
                        receiptNo: `ADM-${String(payload.sr_no).padStart(4, '0')}`,
                        printDate: new Date().toLocaleDateString('en-IN'),
                    };

                    triggerAdmissionPrint(receiptData);
                }
            }

            setSuccess(true);
            setTimeout(() => navigate('/admin/students'), 2500);
        } catch (err: any) {
            setError(err.message || 'Failed to register student.');
        } finally { setSaving(false); }
    };

    const handlePrintLast = () => {
        if (!admissionReceiptData) return;
        triggerAdmissionPrint(admissionReceiptData);
    };

    if (success) {
        return (
            <AppShell title="Student Registration">
                <style>{`
                    @page { size: A5 portrait; margin: 10mm; }
                    @media print {
                        body * { visibility: hidden; }
                        #admission-receipt-print-area, #admission-receipt-print-area * { visibility: visible !important; }
                        #admission-receipt-print-area { position: absolute; left: 0; top: 0; width: 100%; display: block !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    }
                `}</style>
                <div className="max-w-lg mx-auto mt-20 text-center animate-fade-in">
                    <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                        <Check className="w-8 h-8 text-emerald-600" />
                    </div>
                    <h2 className="text-xl font-bold text-foreground">Student Registered!</h2>
                    <p className="text-muted-foreground mt-1 text-sm">
                        {form.name} has been added to {form.class} (SR No. {form.sr_no})
                    </p>
                    {form.collect_admission_fee && form.pay_status === 'now' && admissionReceiptData && (
                        <button
                            onClick={handlePrintLast}
                            className="mt-5 flex items-center gap-2 mx-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-blue-500/20"
                        >
                            <Printer className="w-4 h-4" /> Print Admission Receipt
                        </button>
                    )}
                </div>
                <PrintAdmissionReceipt data={admissionReceiptData} />
            </AppShell>
        );
    }

    const admissionYear = getAdmissionYear(form.admission_date);

    return (
        <AppShell title="Register New Student" subtitle="Fill in the SR Register details">
            <style>{`
                @page { size: A5 portrait; margin: 10mm; }
                @media print {
                    body * { visibility: hidden; }
                    #admission-receipt-print-area, #admission-receipt-print-area * { visibility: visible !important; }
                    #admission-receipt-print-area { position: absolute; left: 0; top: 0; width: 100%; display: block !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                }
            `}</style>
            <PrintAdmissionReceipt data={admissionReceiptData} />

            <div className="max-w-2xl mx-auto">
                {/* Back button */}
                <button
                    onClick={() => navigate('/admin/students')}
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 px-3 py-1.5 rounded-xl hover:bg-muted transition-all"
                >
                    <ArrowLeft className="w-4 h-4" /> Back to Students
                </button>

                {/* Step indicator */}
                <div className="flex items-center mb-8">
                    {STEPS.map((label, i) => (
                        <div key={label} className="flex items-center flex-1">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all ${i < step ? 'bg-emerald-500 text-white' : i === step ? 'gradient-primary text-white shadow-md' : 'bg-muted text-muted-foreground'}`}>
                                {i < step ? <Check className="w-4 h-4" /> : i + 1}
                            </div>
                            <span className={`text-xs ml-2 hidden sm:inline ${i === step ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>{label}</span>
                            {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 mx-3 rounded ${i < step ? 'bg-emerald-500' : 'bg-border'}`} />}
                        </div>
                    ))}
                </div>

                <div className="bg-card border border-border rounded-2xl p-6 animate-fade-in">

                    {/* ── Step 0: Personal Info ── */}
                    {step === 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2">
                                <label className={lc}>Full Name *</label>
                                <input value={form.name} onChange={(e) => update('name', e.target.value)} className={ic} placeholder="Student's full name" />
                            </div>
                            <div>
                                <label className={lc}>Date of Birth *</label>
                                <input type="date" value={form.dob} onChange={(e) => update('dob', e.target.value)} className={ic} />
                            </div>
                            <div>
                                <label className={lc}>Gender *</label>
                                <select value={form.gender} onChange={(e) => update('gender', e.target.value)} className={ic}>
                                    <option value="male">Male</option>
                                    <option value="female">Female</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>
                            <div>
                                <label className={lc}>Blood Group</label>
                                <select value={form.blood_group} onChange={(e) => update('blood_group', e.target.value)} className={ic}>
                                    <option value="">— Select —</option>
                                    {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => <option key={bg}>{bg}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className={lc}>Aadhar Card No.</label>
                                <input value={form.aadhar_card} onChange={(e) => update('aadhar_card', e.target.value)} className={ic} placeholder="12-digit Aadhar number" />
                            </div>
                            <div className="md:col-span-2">
                                <label className={lc}>Address</label>
                                <input value={form.address} onChange={(e) => update('address', e.target.value)} className={ic} placeholder="Full address" />
                            </div>
                        </div>
                    )}

                    {/* ── Step 1: Family & Contact ── */}
                    {step === 1 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className={lc}>Father's Name *</label>
                                <input value={form.father_name} onChange={(e) => update('father_name', e.target.value)} className={ic} placeholder="Father's full name" />
                            </div>
                            <div>
                                <label className={lc}>Father's Income</label>
                                <input type="number" value={form.father_income || ''} onChange={(e) => update('father_income', e.target.value ? Number(e.target.value) : null!)} className={ic} placeholder="Annual income" />
                            </div>
                            <div>
                                <label className={lc}>Mother's Name</label>
                                <input value={form.mother_name} onChange={(e) => update('mother_name', e.target.value)} className={ic} placeholder="Mother's full name" />
                            </div>
                            <div>
                                <label className={lc}>Phone No. *</label>
                                <input type="tel" value={form.phone} onChange={(e) => update('phone', e.target.value)} className={ic} placeholder="10-digit mobile number" />
                            </div>
                            <div>
                                <label className={lc}>Email Address</label>
                                <input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} className={ic} placeholder="student@example.com" />
                            </div>
                            <div>
                                <label className={lc}>WhatsApp No.</label>
                                <input type="tel" value={form.whatsapp} onChange={(e) => update('whatsapp', e.target.value)} className={ic} placeholder="WhatsApp number" />
                            </div>
                            <div>
                                <label className={lc}>Caste</label>
                                <select value={form.caste} onChange={(e) => update('caste', e.target.value)} className={ic}>
                                    <option value="">— Select —</option>
                                    {['General', 'OBC', 'SC', 'ST', 'EWS'].map(c => <option key={c}>{c}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className={lc}>Religion</label>
                                <input value={form.religion} onChange={(e) => update('religion', e.target.value)} className={ic} placeholder="e.g. Hindu, Muslim, Christian" />
                            </div>
                            <div>
                                <label className={lc}>Father's Occupation</label>
                                <input value={form.occupation} onChange={(e) => update('occupation', e.target.value)} className={ic} placeholder="e.g. Farmer, Business" />
                            </div>
                            <div>
                                <label className={lc}>Nationality</label>
                                <input value={form.nationality} onChange={(e) => update('nationality', e.target.value)} className={ic} placeholder="Indian" />
                            </div>
                        </div>
                    )}

                    {/* ── Step 2: Academic & Other ── */}
                    {step === 2 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className={lc}>SR No. *</label>
                                <input type="number" value={form.sr_no || ''} onChange={(e) => update('sr_no', e.target.value)} className={ic} placeholder="Unique SR Register number" />
                            </div>
                            <div>
                                <label className={lc}>Roll No.</label>
                                <input value={form.roll_no} onChange={(e) => update('roll_no', e.target.value)} className={ic} placeholder="e.g. 101" />
                            </div>
                            <div>
                                <label className={lc}>Class</label>
                                <select value={form.class} onChange={(e) => update('class', e.target.value)} className={ic}>
                                    {CLASSES.map((c) => <option key={c}>{c}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className={lc}>Admission Date</label>
                                <input type="date" value={form.admission_date} onChange={(e) => update('admission_date', e.target.value)} className={ic} />
                            </div>
                            <div>
                                <label className={lc}>House</label>
                                <select value={form.house} onChange={(e) => update('house', e.target.value)} className={ic}>
                                    <option value="">— Select House —</option>
                                    <option value="Jal">Jal</option>
                                    <option value="Akash">Akash</option>
                                    <option value="Vayu">Vayu</option>
                                    <option value="Prithvi">Prithvi</option>
                                </select>
                            </div>
                            <div>
                                <label className={lc}>PEN No.</label>
                                <input value={form.pen_no} onChange={(e) => update('pen_no', e.target.value)} className={ic} placeholder="PEN number" />
                            </div>
                            <div>
                                <label className={lc}>RTE (Right to Education)</label>
                                <div className="flex gap-2 mt-1">
                                    <button
                                        type="button"
                                        onClick={() => update('rte', 'YES')}
                                        className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all ${form.rte === 'yes' || form.rte === 'YES'
                                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-500/20'
                                            : 'bg-background text-muted-foreground border-input hover:border-emerald-400'
                                            }`}
                                    >
                                        ✓ RTE Student
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => update('rte', 'NO')}
                                        className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all ${form.rte === 'no' || form.rte === 'NO'
                                            ? 'bg-muted text-foreground border-border'
                                            : 'bg-background text-muted-foreground border-input hover:border-border'
                                            }`}
                                    >
                                        Not RTE
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label className={lc}>Status</label>
                                <select value={form.status} onChange={(e) => update('status', e.target.value)} className={ic}>
                                    <option value="active">Active</option>
                                    <option value="inactive">Inactive</option>
                                    <option value="transferred">Transferred (TC)</option>
                                </select>
                            </div>

                            {/* ── Admission Fee Collection ── */}
                            <div className="md:col-span-2 pt-2 border-t border-border mt-2 space-y-3">
                                {/* Toggle */}
                                <label className="flex items-start gap-3 p-4 border border-blue-500/30 bg-blue-500/5 rounded-xl cursor-pointer hover:bg-blue-500/10 transition-colors">
                                    <div className="flex items-center justify-center w-6 h-6 rounded-md border border-blue-500 bg-white mt-0.5 flex-shrink-0">
                                        <input
                                            type="checkbox"
                                            checked={form.collect_admission_fee}
                                            onChange={(e) => update('collect_admission_fee', e.target.checked)}
                                            className="w-4 h-4 accent-blue-600 opacity-0 absolute"
                                        />
                                        {form.collect_admission_fee && <Check className="w-4 h-4 text-blue-600 pointer-events-none" />}
                                    </div>
                                    <div>
                                        <span className="font-bold text-blue-800 dark:text-blue-400 block tracking-wider uppercase text-xs">
                                            Collect Admission Fee — Session {admissionYear}
                                        </span>
                                        <span className="text-sm text-muted-foreground font-medium">
                                            Record ₹{ADMISSION_FEE_TOTAL.toLocaleString('en-IN')} one-time admission fee for this session and print a receipt.
                                        </span>
                                    </div>
                                </label>

                                {/* Fee Breakdown (visible when checked) */}
                                {form.collect_admission_fee && (
                                    <div className="rounded-xl border border-border bg-muted/30 overflow-hidden animate-fade-in">
                                        <div className="px-4 py-2.5 bg-muted/60 border-b border-border text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                            Yearly Fee — One Time (Session {admissionYear})
                                        </div>
                                        <table className="w-full text-sm">
                                            <tbody>
                                                {ADMISSION_FEE_ITEMS.map((item) => (
                                                    <tr key={item.label} className="border-b border-border/50 last:border-0">
                                                        <td className="px-4 py-2 text-foreground">{item.label}</td>
                                                        <td className="px-4 py-2 text-right font-semibold text-foreground">
                                                            ₹{item.amount.toLocaleString('en-IN')}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                            <tfoot>
                                                <tr className="bg-blue-50 dark:bg-blue-950/30">
                                                    <td className="px-4 py-2.5 font-bold text-blue-800 dark:text-blue-300 text-sm uppercase tracking-wide">Total</td>
                                                    <td className="px-4 py-2.5 text-right font-black text-blue-800 dark:text-blue-300 text-base">
                                                        ₹{ADMISSION_FEE_TOTAL.toLocaleString('en-IN')}
                                                    </td>
                                                </tr>
                                            </tfoot>
                                        </table>

                                        {/* Payment mode & status */}
                                        <div className="px-4 py-3 border-t border-border space-y-4">
                                            <div>
                                                <label className="text-xs font-medium text-muted-foreground mb-2 block">Payment Status</label>
                                                <div className="flex gap-2">
                                                    {(['now', 'later'] as const).map(status => (
                                                        <button
                                                            key={status}
                                                            type="button"
                                                            onClick={() => update('pay_status', status)}
                                                            className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-all capitalize ${form.pay_status === status
                                                                ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                                                : 'bg-background border-border text-muted-foreground hover:border-blue-400 hover:text-blue-600'
                                                                }`}
                                                        >
                                                            Pay {status}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                            {form.pay_status === 'now' && (
                                                <div>
                                                    <label className="text-xs font-medium text-muted-foreground mb-2 block">Payment Mode</label>
                                                    <div className="flex gap-2">
                                                        {(['cash', 'online', 'cheque'] as const).map(mode => (
                                                            <button
                                                                key={mode}
                                                                type="button"
                                                                onClick={() => update('pay_mode', mode)}
                                                                className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-all capitalize ${form.pay_mode === mode
                                                                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                                                    : 'bg-background border-border text-muted-foreground hover:border-blue-400 hover:text-blue-600'
                                                                    }`}
                                                            >
                                                                {mode}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive animate-fade-in">
                            {error}
                        </div>
                    )}

                    {/* Navigation */}
                    <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
                        <button
                            onClick={() => step === 0 ? navigate('/admin/students') : setStep(step - 1)}
                            className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground hover:text-foreground rounded-xl hover:bg-muted transition-all"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            {step === 0 ? 'Cancel' : 'Back'}
                        </button>

                        {step < 2 ? (
                            <button onClick={() => { if (validateStep()) setStep(step + 1); }} className="flex items-center gap-2 gradient-primary text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:opacity-90 transition-all shadow-lg shadow-primary/25">
                                Next <ArrowRight className="w-4 h-4" />
                            </button>
                        ) : (
                            <button onClick={handleSubmit} disabled={saving} className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium disabled:opacity-60 transition-all shadow-lg shadow-emerald-500/25">
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                                {saving ? 'Saving...' : 'Register Student'}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </AppShell>
    );
};

export default StudentRegistration;
