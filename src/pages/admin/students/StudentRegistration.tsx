import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '@/components/layout/AppShell';
import { supabase } from '@/config/supabaseClient';
import { ArrowLeft, ArrowRight, Check, Loader2, UserPlus } from 'lucide-react';

const CLASSES = ['Nursery', 'LKG', 'UKG', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];
const SECTIONS = ['A', 'B', 'C', 'D'];
const STEPS = ['Personal Info', 'Family & Contact', 'Academic & Other'];

const emptyForm = {
    sr_no: '' as unknown as number,
    roll_no: '',
    name: '',
    class: 'One',
    dob: '',
    admission_date: new Date().toISOString().split('T')[0],
    gender: 'male' as 'male' | 'female' | 'other',
    mother_name: '',
    father_name: '',
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
    collect_reg_fee: true,
};

const StudentRegistration: React.FC = () => {
    const navigate = useNavigate();
    const [step, setStep] = useState(0);
    const [form, setForm] = useState(emptyForm);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    const update = (field: string, value: string | number) =>
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

    const handleSubmit = async () => {
        if (!validateStep()) return;
        setSaving(true); setError('');
        try {
            const { collect_reg_fee, ...studentData } = form;
            const payload = { ...studentData, sr_no: Number(form.sr_no) };
            
            const { error: insertError } = await supabase.from('students').insert([payload]);
            if (insertError) throw insertError;

            // Handle Registration Fee
            if (collect_reg_fee) {
                const feePayload = {
                    sr_no: payload.sr_no,
                    month: 'Registration Fee',
                    due_amount: 1000,
                    paid_amount: 1000,
                    paid_on: new Date().toISOString().split('T')[0],
                    mode: 'cash'
                };
                const { error: feeErr } = await supabase.from('fee_payments').insert([feePayload]);
                if (feeErr) console.error("Could not add registration fee:", feeErr);
            }

            setSuccess(true);
            setTimeout(() => navigate('/admin/students'), 1500);
        } catch (err: any) {
            setError(err.message || 'Failed to register student.');
        } finally { setSaving(false); }
    };

    if (success) {
        return (
            <AppShell title="Student Registration">
                <div className="max-w-lg mx-auto mt-20 text-center animate-fade-in">
                    <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                        <Check className="w-8 h-8 text-emerald-600" />
                    </div>
                    <h2 className="text-xl font-bold text-foreground">Student Registered!</h2>
                    <p className="text-muted-foreground mt-1 text-sm">
                        {form.name} has been added to {form.class} (SR No. {form.sr_no})
                    </p>
                </div>
            </AppShell>
        );
    }

    return (
        <AppShell title="Register New Student" subtitle="Fill in the SR Register details">
            <div className="max-w-2xl mx-auto">
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
                            <div className="md:col-span-2 pt-2 border-t border-border mt-2">
                                <label className="flex items-center gap-3 p-4 border border-emerald-500/30 bg-emerald-500/5 rounded-xl cursor-pointer hover:bg-emerald-500/10 transition-colors">
                                    <div className="flex items-center justify-center w-6 h-6 rounded-md border border-emerald-500 bg-white">
                                        <input
                                            type="checkbox"
                                            checked={form.collect_reg_fee}
                                            onChange={(e) => update('collect_reg_fee', e.target.checked as any)}
                                            className="w-4 h-4 accent-emerald-600 opacity-0 absolute"
                                        />
                                        {form.collect_reg_fee && <Check className="w-4 h-4 text-emerald-600 pointer-events-none" />}
                                    </div>
                                    <div>
                                        <span className="font-bold text-emerald-800 dark:text-emerald-400 block tracking-wider uppercase text-xs">Collect Registration Fee</span>
                                        <span className="text-sm text-muted-foreground font-medium">Record a ₹1,000 baseline registration fee automatically upon creation.</span>
                                    </div>
                                </label>
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
