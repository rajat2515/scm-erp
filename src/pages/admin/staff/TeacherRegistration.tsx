/*
 * ╔══════════════════════════════════════════════════════════════╗
 * ║         S.C.M. CHILDREN ACADEMY — TEACHER REGISTRATION FORM  ║
 * ║                 SQL MIGRATION (run once in Supabase)         ║
 * ╠══════════════════════════════════════════════════════════════╣
 *
 * CREATE TABLE IF NOT EXISTS teacher_registrations (
 *   id BIGSERIAL PRIMARY KEY,
 *   teacher_code TEXT,
 *   teacher_name TEXT NOT NULL,
 *   mobile_number TEXT,
 *   email_id TEXT,
 *   dob DATE,
 *   gender TEXT,
 *   pan_no TEXT,
 *   social_category TEXT,
 *   designation TEXT,
 *   type_of_teacher TEXT,
 *   teacher_qualification TEXT,
 *   nature_of_appointment TEXT,
 *   date_of_joining DATE,
 *   highest_qualification TEXT,
 * 
 *   brc_training_days INTEGER DEFAULT 0,
 *   crc_training_days INTEGER DEFAULT 0,
 *   diet_training_days INTEGER DEFAULT 0,
 *   appointed_subject TEXT,
 *   main_subject_taught TEXT,
 *   additional_subject_taught TEXT,
 *   non_teaching_assignment_days INTEGER DEFAULT 0,
 *   maths_science_studied_upto TEXT,
 *   trained_in_computer TEXT,
 *   english_studied_upto TEXT,
 *   social_studies_studied_upto TEXT,
 * 
 *   disability TEXT,
 *   bank_name TEXT,
 *   working_in_present_school_since TEXT,
 *   account_number TEXT,
 *   trained_to_teach_cwsn TEXT,
 *   evaluation_medium TEXT,
 * 
 *   classes_taught TEXT[] DEFAULT '{}',
 * 
 *   secondary_subject_1 TEXT,
 *   secondary_subject_2 TEXT,
 *   secondary_exp_1 TEXT,
 *   secondary_exp_2 TEXT,
 *   ward_appearing_class_10 TEXT,
 * 
 *   senior_secondary_subject_1 TEXT,
 *   senior_secondary_subject_2 TEXT,
 *   senior_secondary_exp_1 TEXT,
 *   senior_secondary_exp_2 TEXT,
 *   ward_appearing_class_12 TEXT,
 * 
 *   trained_or_untrained TEXT,
 *   confirmation_date DATE,
 *   training_courses_attended TEXT,
 *   scale_of_pay TEXT,
 *   duration_in_days INTEGER DEFAULT 0,
 *   basic_pay NUMERIC(10,2) DEFAULT 0,
 *   training_programme_organized_by TEXT,
 *   da_other_allowance NUMERIC(10,2) DEFAULT 0,
 * 
 *   created_at TIMESTAMPTZ DEFAULT NOW(),
 *   updated_at TIMESTAMPTZ DEFAULT NOW()
 * );
 * ╚══════════════════════════════════════════════════════════════╝
 */

import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import AppShell from '@/components/layout/AppShell';
import { supabase } from '@/config/supabaseClient';
import { Save, Printer, Loader2, RefreshCw, FileText, CheckCircle2, ArrowLeft } from 'lucide-react';

const CLASSES_LIST = [
    'KG-NURSERY', 'CLASS I', 'CLASS II', 'CLASS III', 'CLASS IV', 'CLASS V', 
    'CLASS VI', 'CLASS VII', 'CLASS VIII', 'CLASS IX', 'CLASS X', 'CLASS XI', 'CLASS XII'
];

const QUALIFICATIONS = [
    'B.A/B.ed', 'B.Sc/B.ed', 'M.A/B.ed', 'M.Sc/B.ed', 'B.Com/B.ed', 'M.Com/B.ed',
    'High School', 'Intermediate', 'B.A.', 'M.A.', 'B.Sc.', 'M.Sc.', 'B.Com.', 
    'M.Com.', 'B.Ed.', 'M.Ed.', 'D.El.Ed/BTC', 'NTT', 'B.C.A.', 'M.C.A.', 'B.Tech', 
    'M.Tech', 'B.P.Ed.', 'C.TET/U.P.TET', 'Ph.D.', 'Other'
];

export default function TeacherRegistration() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const mode = searchParams.get('mode');
    const recordId = searchParams.get('id');
    const prefillName = searchParams.get('name');

    const defaultState = {
        teacher_code: '', teacher_name: prefillName || '', mobile_number: '', email_id: '', dob: '', gender: '', pan_no: '', 
        social_category: '', designation: '', type_of_teacher: '', teacher_qualification: '', 
        nature_of_appointment: '', date_of_joining: '', highest_qualification: '', 
        
        brc_training_days: 0, crc_training_days: 0, diet_training_days: 0, appointed_subject: '', 
        main_subject_taught: '', additional_subject_taught: '', non_teaching_assignment_days: 0, 
        maths_science_studied_upto: '', trained_in_computer: 'NO', english_studied_upto: '', 
        social_studies_studied_upto: '', 
        
        disability: 'NO', bank_name: '', working_in_present_school_since: '', account_number: '', 
        trained_to_teach_cwsn: 'NO', evaluation_medium: '', 
        
        classes_taught: [] as string[], 
        
        secondary_subject_1: '', secondary_subject_2: '', secondary_exp_1: '', secondary_exp_2: '', 
        ward_appearing_class_10: 'NO', 
        
        senior_secondary_subject_1: '', senior_secondary_subject_2: '', senior_secondary_exp_1: '', 
        senior_secondary_exp_2: '', ward_appearing_class_12: 'NO', 
        
        trained_or_untrained: 'Trained', confirmation_date: '', training_courses_attended: '', 
        scale_of_pay: '', duration_in_days: 0, basic_pay: 0, training_programme_organized_by: '', 
        da_other_allowance: 0
    };

    const [form, setForm] = useState(defaultState);
    const [saving, setSaving] = useState(false);
    const [loadingData, setLoadingData] = useState(mode === 'view' && !!recordId);
    const [msg, setMsg] = useState<{type: 'ok'|'err', text: string} | null>(null);

    useEffect(() => {
        if (mode === 'view' && recordId) {
            const loadRecord = async () => {
                const { data, error } = await supabase.from('teacher_registrations').select('*').eq('id', recordId).single();
                if (!error && data) {
                    setForm({ ...defaultState, ...data });
                } else {
                    setMsg({ type: 'err', text: 'Could not load existing record. ' + (error?.message || '') });
                }
                setLoadingData(false);
            };
            loadRecord();
        }
    }, [mode, recordId]);

    const set = (field: keyof typeof defaultState, val: any) => {
        setForm(prev => ({ ...prev, [field]: val }));
    };

    const toggleClass = (cls: string) => {
        setForm(prev => {
            const list = prev.classes_taught.includes(cls) 
                ? prev.classes_taught.filter(c => c !== cls)
                : [...prev.classes_taught, cls];
            return { ...prev, classes_taught: list };
        });
    };

    const handleSave = async () => {
        if (!form.teacher_name) {
            setMsg({ type: 'err', text: 'Teacher Name is required.' });
            return;
        }

        setSaving(true);
        setMsg(null);

        // Sanitize payload (empty strings to null for dates, etc)
        const payload = { ...form };
        if (!payload.dob) delete (payload as any).dob;
        if (!payload.date_of_joining) delete (payload as any).date_of_joining;
        if (!payload.confirmation_date) delete (payload as any).confirmation_date;

        const { error } = await supabase.from('teacher_registrations').insert([payload]);

        setSaving(false);
        if (error) {
            setMsg({ type: 'err', text: 'Error saving: ' + error.message });
        } else {
            setMsg({ type: 'ok', text: 'Registration saved successfully!' });
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    const handlePrintBlankForm = () => {
        window.print();
    };

    const lC = "text-xs font-semibold text-muted-foreground mb-1 block";
    const iC = "w-full px-3 py-2 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 uppercase";

    return (
        <AppShell title="Teacher Registration" subtitle="CBSE OASIS/UDISE+ Teacher Record">
            
            {/* Print Styles for Blank Form */}
            <style>{`
                @media print {
                    body * { visibility: hidden; }
                    #print-form-area, #print-form-area * { visibility: visible; }
                    #print-form-area { position: absolute; left: 0; top: 0; width: 100%; display: block !important; padding: 10px; font-family: sans-serif; }
                    .print-section { margin-bottom: 20px; border: 1px solid #ddd; padding: 10px; border-radius: 8px; break-inside: avoid; }
                    .print-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
                    .print-field { margin-bottom: 15px; }
                    .print-label { font-size: 10px; text-transform: uppercase; color: #555; }
                    .print-box { border-bottom: 1px solid #aaa; height: 25px; margin-top: 5px; }
                    .print-title { font-weight: bold; font-size: 16px; margin-bottom: 15px; text-align: center; background: #eee; padding: 8px; }
                }
            `}</style>
            
            <div className="flex justify-between items-center mb-6 print:hidden">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate(-1)} className="flex items-center gap-2 bg-background border border-border text-foreground px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-muted transition-colors">
                        <ArrowLeft className="w-4 h-4" /> Back
                    </button>
                    <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 gradient-primary text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-all shadow-lg shadow-primary/20">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Save Digital Record
                    </button>
                    <button onClick={() => setForm(defaultState)} className="flex items-center gap-2 bg-background border border-border text-foreground px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-muted transition-colors">
                        <RefreshCw className="w-4 h-4" /> Reset Form
                    </button>
                </div>
                <button onClick={handlePrintBlankForm} className="flex items-center gap-2 bg-primary/10 text-primary px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-primary/20 transition-colors">
                    <Printer className="w-4 h-4" /> Print Blank Form
                </button>
            </div>

            {msg && (
                <div className={`p-4 rounded-xl mb-6 font-medium flex items-center gap-2 ${msg.type === 'ok' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                    {msg.type === 'ok' && <CheckCircle2 className="w-5 h-5" />}
                    {msg.text}
                </div>
            )}

            <div id="print-form-area" className="space-y-6 max-w-5xl animate-fade-in print-area bg-card rounded-2xl shadow-sm border border-border p-8 print:border-none print:shadow-none print:p-0">
                <div className="text-center mb-8 border-b border-border pb-4 hidden print:block">
                    <h1 className="text-2xl font-black uppercase tracking-wider">S.C.M. Children Academy</h1>
                    <p className="text-sm mt-1">Teacher Registration Form (OASIS / UDISE Data)</p>
                </div>

                {/* SECTION 1: Personal & Basic Info */}
                <div className="print-section">
                    <h2 className="text-lg font-bold text-primary mb-4 print-title bg-muted/40 rounded-xl p-3">1. Personal & Basic Info</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 print-grid">
                        <div className="print-field">
                            <label className={lC}>Teacher Code</label>
                            <input value={form.teacher_code} onChange={e=>set('teacher_code', e.target.value)} className={iC} placeholder="e.g. 080" />
                            <div className="hidden print:block print-box"></div>
                        </div>
                        <div className="print-field md:col-span-2">
                            <label className={lC}>Teacher Name *</label>
                            <input value={form.teacher_name} onChange={e=>set('teacher_name', e.target.value)} className={iC} placeholder="Prefix + Name (MR. SANJEEV KUMAR)" />
                            <div className="hidden print:block print-box"></div>
                        </div>
                        <div className="print-field md:col-span-2">
                            <label className={lC}>Father / Spouse Name</label>
                            <input value={(form as any).fathers_spouse_name || ''} onChange={e=>set('fathers_spouse_name' as any, e.target.value)} className={iC} placeholder="Optional" />
                            <div className="hidden print:block print-box"></div>
                        </div>
                        <div className="print-field">
                            <label className={lC}>Mobile Number</label>
                            <input value={form.mobile_number} onChange={e=>set('mobile_number', e.target.value)} className={iC} />
                            <div className="hidden print:block print-box"></div>
                        </div>
                        <div className="print-field">
                            <label className={lC}>Email ID</label>
                            <input value={form.email_id} onChange={e=>set('email_id', e.target.value)} className={iC} type="email" />
                            <div className="hidden print:block print-box"></div>
                        </div>
                        <div className="print-field">
                            <label className={lC}>PAN No.</label>
                            <input value={form.pan_no} onChange={e=>set('pan_no', e.target.value)} className={iC} />
                            <div className="hidden print:block print-box"></div>
                        </div>
                        <div className="print-field">
                            <label className={lC}>Date of Birth</label>
                            <input value={form.dob} onChange={e=>set('dob', e.target.value)} type="date" className={iC} />
                            <div className="hidden print:block print-box"></div>
                        </div>
                        <div className="print-field">
                            <label className={lC}>Gender</label>
                            <input value={form.gender} onChange={e=>set('gender', e.target.value)} className={iC} placeholder="MALE / FEMALE" />
                            <div className="hidden print:block print-box"></div>
                        </div>
                        <div className="print-field">
                            <label className={lC}>Social Category</label>
                            <input value={form.social_category} onChange={e=>set('social_category', e.target.value)} className={iC} placeholder="SC / ST / OBC / GEN" />
                            <div className="hidden print:block print-box"></div>
                        </div>
                        <div className="print-field">
                            <label className={lC}>Disability (If Any)</label>
                            <input value={form.disability} onChange={e=>set('disability', e.target.value)} className={iC} />
                            <div className="hidden print:block print-box"></div>
                        </div>
                    </div>
                </div>

                {/* SECTION 2: Professional Details */}
                <div className="print-section pt-4 border-t border-border mt-6">
                    <h2 className="text-lg font-bold text-primary mb-4 print-title bg-muted/40 rounded-xl p-3">2. Professional Details</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 print-grid">
                        <div className="print-field">
                            <label className={lC}>Designation</label>
                            <input value={form.designation} onChange={e=>set('designation', e.target.value)} className={iC} placeholder="PRT / TGT" />
                            <div className="hidden print:block print-box"></div>
                        </div>
                        <div className="print-field">
                            <label className={lC}>Type of Teacher</label>
                            <input value={form.type_of_teacher} onChange={e=>set('type_of_teacher', e.target.value)} className={iC} placeholder="PRT / TGT" />
                            <div className="hidden print:block print-box"></div>
                        </div>
                        <div className="print-field">
                            <label className={lC}>Nature of Appointment</label>
                            <input value={form.nature_of_appointment} onChange={e=>set('nature_of_appointment', e.target.value)} className={iC} placeholder="REGULAR / CONTRACT" />
                            <div className="hidden print:block print-box"></div>
                        </div>
                        <div className="print-field">
                            <label className={lC}>Date of Joining in Service</label>
                            <input value={form.date_of_joining} onChange={e=>set('date_of_joining', e.target.value)} type="date" className={iC} />
                            <div className="hidden print:block print-box"></div>
                        </div>
                        <div className="print-field">
                            <label className={lC}>Working in Present School Since</label>
                            <input value={form.working_in_present_school_since} onChange={e=>set('working_in_present_school_since', e.target.value)} className={iC} placeholder="YEAR" />
                            <div className="hidden print:block print-box"></div>
                        </div>
                        <div className="print-field">
                            <label className={lC}>Trained or Untrained</label>
                            <input value={form.trained_or_untrained} onChange={e=>set('trained_or_untrained', e.target.value)} className={iC} placeholder="Trained" />
                            <div className="hidden print:block print-box"></div>
                        </div>
                        <div className="print-field">
                            <label className={lC}>Confirmation Date</label>
                            <input value={form.confirmation_date} onChange={e=>set('confirmation_date', e.target.value)} type="date" className={iC} />
                            <div className="hidden print:block print-box"></div>
                        </div>
                    </div>
                </div>

                {/* SECTION 3: Banking & Remuneration */}
                <div className="print-section pt-4 border-t border-border mt-6">
                    <h2 className="text-lg font-bold text-primary mb-4 print-title bg-muted/40 rounded-xl p-3">3. Banking & Remuneration</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 print-grid">
                        <div className="print-field md:col-span-2">
                            <label className={lC}>Bank Name</label>
                            <input value={form.bank_name} onChange={e=>set('bank_name', e.target.value)} className={iC} placeholder="e.g. PUNJAB NATIONAL BANK" />
                            <div className="hidden print:block print-box"></div>
                        </div>
                        <div className="print-field">
                            <label className={lC}>Account Number</label>
                            <input value={form.account_number} onChange={e=>set('account_number', e.target.value)} className={iC} />
                            <div className="hidden print:block print-box"></div>
                        </div>
                        <div className="print-field">
                            <label className={lC}>Scale of Pay (Rs)</label>
                            <input value={form.scale_of_pay} onChange={e=>set('scale_of_pay', e.target.value)} className={iC} />
                            <div className="hidden print:block print-box"></div>
                        </div>
                        <div className="print-field">
                            <label className={lC}>Basic Pay (Rs)</label>
                            <input type="number" value={form.basic_pay} onChange={e=>set('basic_pay', e.target.value)} className={iC} />
                            <div className="hidden print:block print-box"></div>
                        </div>
                        <div className="print-field">
                            <label className={lC}>DA/Other Allowance (Rs)</label>
                            <input type="number" value={form.da_other_allowance} onChange={e=>set('da_other_allowance', e.target.value)} className={iC} />
                            <div className="hidden print:block print-box"></div>
                        </div>
                    </div>
                </div>

                {/* SECTION 4: Education & Subjects */}
                <div className="print-section pt-4 border-t border-border mt-6">
                    <h2 className="text-lg font-bold text-primary mb-4 print-title bg-muted/40 rounded-xl p-3">4. Education & Subjects</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 print-grid">
                        <div className="print-field">
                            <label className={lC}>Teacher Qualification</label>
                            <select value={form.teacher_qualification} onChange={e=>set('teacher_qualification', e.target.value)} className={iC}>
                                <option value="">Select Qualification</option>
                                {QUALIFICATIONS.map(q => <option key={q} value={q}>{q}</option>)}
                            </select>
                            <div className="hidden print:block print-box"></div>
                        </div>
                        <div className="print-field">
                            <label className={lC}>Highest Qualification (Academic)</label>
                            <select value={form.highest_qualification} onChange={e=>set('highest_qualification', e.target.value)} className={iC}>
                                <option value="">Select Qualification</option>
                                {QUALIFICATIONS.map(q => <option key={q} value={q}>{q}</option>)}
                            </select>
                            <div className="hidden print:block print-box"></div>
                        </div>
                        <div className="print-field">
                            <label className={lC}>Maths/Science Studied Upto</label>
                            <input value={form.maths_science_studied_upto} onChange={e=>set('maths_science_studied_upto', e.target.value)} className={iC} placeholder="e.g. X / XII" />
                            <div className="hidden print:block print-box"></div>
                        </div>
                        <div className="print-field">
                            <label className={lC}>English Studied Upto</label>
                            <input value={form.english_studied_upto} onChange={e=>set('english_studied_upto', e.target.value)} className={iC} placeholder="e.g. B.A" />
                            <div className="hidden print:block print-box"></div>
                        </div>
                        <div className="print-field">
                            <label className={lC}>Social Studies Studied Upto</label>
                            <input value={form.social_studies_studied_upto} onChange={e=>set('social_studies_studied_upto', e.target.value)} className={iC} placeholder="e.g. XII" />
                            <div className="hidden print:block print-box"></div>
                        </div>
                        <div className="print-field">
                            <label className={lC}>Evaluation Medium</label>
                            <input value={form.evaluation_medium} onChange={e=>set('evaluation_medium', e.target.value)} className={iC} placeholder="e.g. Hindi / English" />
                            <div className="hidden print:block print-box"></div>
                        </div>
                    </div>
                </div>

                {/* SECTION 5: Classes & Subjects Taught */}
                <div className="print-section pt-4 border-t border-border mt-6">
                    <h2 className="text-lg font-bold text-primary mb-4 print-title bg-muted/40 rounded-xl p-3">5. Classes & Subjects Taught</h2>
                    <div className="mb-6 bg-muted/30 p-4 rounded-xl print:bg-transparent">
                        <label className={`${lC} mb-3`}>Select Classes Taught</label>
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 print:grid-cols-4">
                            {CLASSES_LIST.map(cls => (
                                <label key={cls} className="flex items-center gap-2 text-sm font-medium print:text-[10px]">
                                    <input 
                                        type="checkbox" 
                                        checked={form.classes_taught.includes(cls)} 
                                        onChange={() => toggleClass(cls)}
                                        className="rounded border-border text-primary focus:ring-primary print:border-black"
                                    />
                                    {cls}
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 print-grid">
                        <div className="print-field">
                            <label className={lC}>Appointed For Subject</label>
                            <input value={form.appointed_subject} onChange={e=>set('appointed_subject', e.target.value)} className={iC} placeholder="e.g. ENGLISH" />
                            <div className="hidden print:block print-box"></div>
                        </div>
                        <div className="print-field">
                            <label className={lC}>Main Subject Taught</label>
                            <input value={form.main_subject_taught} onChange={e=>set('main_subject_taught', e.target.value)} className={iC} placeholder="e.g. ENGLISH" />
                            <div className="hidden print:block print-box"></div>
                        </div>
                        <div className="print-field">
                            <label className={lC}>Additional Subject Taught</label>
                            <input value={form.additional_subject_taught} onChange={e=>set('additional_subject_taught', e.target.value)} className={iC} placeholder="e.g. S.ST" />
                            <div className="hidden print:block print-box"></div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 print-grid">
                        <div className="p-4 border border-border bg-card rounded-xl">
                            <h3 className="font-bold mb-4 border-b border-border text-sm pb-2 print-title">SECONDARY EDUCATION</h3>
                            <div className="space-y-4">
                                <div className="print-field">
                                    <label className={lC}>Subject - (1) (Currently Teaching)</label>
                                    <input value={form.secondary_subject_1} onChange={e=>set('secondary_subject_1', e.target.value)} className={iC} />
                                    <div className="hidden print:block print-box"></div>
                                </div>
                                <div className="print-field">
                                    <label className={lC}>Exp. Subject - (1) (In Years)</label>
                                    <input value={form.secondary_exp_1} onChange={e=>set('secondary_exp_1', e.target.value)} className={iC} />
                                    <div className="hidden print:block print-box"></div>
                                </div>
                                <div className="print-field">
                                    <label className={lC}>Subject - (2) (Currently Teaching)</label>
                                    <input value={form.secondary_subject_2} onChange={e=>set('secondary_subject_2', e.target.value)} className={iC} />
                                    <div className="hidden print:block print-box"></div>
                                </div>
                                <div className="print-field">
                                    <label className={lC}>Exp. Subject - (2) (In Years)</label>
                                    <input value={form.secondary_exp_2} onChange={e=>set('secondary_exp_2', e.target.value)} className={iC} />
                                    <div className="hidden print:block print-box"></div>
                                </div>
                                <div className="print-field">
                                    <label className={lC}>Ward Appearing in Class 10 Subject-1?</label>
                                    <input value={form.ward_appearing_class_10} onChange={e=>set('ward_appearing_class_10', e.target.value)} className={iC} />
                                    <div className="hidden print:block print-box"></div>
                                </div>
                            </div>
                        </div>
                        <div className="p-4 border border-border bg-card rounded-xl">
                            <h3 className="font-bold mb-4 border-b border-border text-sm pb-2 print-title">SENIOR SECONDARY EDUCATION</h3>
                            <div className="space-y-4">
                                <div className="print-field">
                                    <label className={lC}>Subject - (1) (Currently Teaching)</label>
                                    <input value={form.senior_secondary_subject_1} onChange={e=>set('senior_secondary_subject_1', e.target.value)} className={iC} />
                                    <div className="hidden print:block print-box"></div>
                                </div>
                                <div className="print-field">
                                    <label className={lC}>Exp. Subject - (1) (In Years)</label>
                                    <input value={form.senior_secondary_exp_1} onChange={e=>set('senior_secondary_exp_1', e.target.value)} className={iC} />
                                    <div className="hidden print:block print-box"></div>
                                </div>
                                <div className="print-field">
                                    <label className={lC}>Subject - (2) (Currently Teaching)</label>
                                    <input value={form.senior_secondary_subject_2} onChange={e=>set('senior_secondary_subject_2', e.target.value)} className={iC} />
                                    <div className="hidden print:block print-box"></div>
                                </div>
                                <div className="print-field">
                                    <label className={lC}>Exp. Subject - (2) (In Years)</label>
                                    <input value={form.senior_secondary_exp_2} onChange={e=>set('senior_secondary_exp_2', e.target.value)} className={iC} />
                                    <div className="hidden print:block print-box"></div>
                                </div>
                                <div className="print-field">
                                    <label className={lC}>Ward Appearing in Class 12 Subject-1?</label>
                                    <input value={form.ward_appearing_class_12} onChange={e=>set('ward_appearing_class_12', e.target.value)} className={iC} />
                                    <div className="hidden print:block print-box"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* SECTION 6: In-Service Training & Seminars */}
                <div className="print-section pt-4 border-t border-border mt-6 mb-8">
                    <h2 className="text-lg font-bold text-primary mb-4 print-title bg-muted/40 rounded-xl p-3">6. Training & Certification</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 print-grid">
                        <div className="print-field">
                            <label className={lC}>Training Days in Last Yr (BRC)</label>
                            <input type="number" value={form.brc_training_days} onChange={e=>set('brc_training_days', e.target.value)} className={iC} />
                            <div className="hidden print:block print-box"></div>
                        </div>
                        <div className="print-field">
                            <label className={lC}>Training Days in Last Yr (CRC)</label>
                            <input type="number" value={form.crc_training_days} onChange={e=>set('crc_training_days', e.target.value)} className={iC} />
                            <div className="hidden print:block print-box"></div>
                        </div>
                        <div className="print-field">
                            <label className={lC}>Training Days in Last Yr (DIET)</label>
                            <input type="number" value={form.diet_training_days} onChange={e=>set('diet_training_days', e.target.value)} className={iC} />
                            <div className="hidden print:block print-box"></div>
                        </div>
                        <div className="print-field">
                            <label className={lC}>Days on Non-Teaching Assgn.</label>
                            <input type="number" value={form.non_teaching_assignment_days} onChange={e=>set('non_teaching_assignment_days', e.target.value)} className={iC} />
                            <div className="hidden print:block print-box"></div>
                        </div>
                        <div className="print-field">
                            <label className={lC}>Name of Training Course(s)</label>
                            <input value={form.training_courses_attended} onChange={e=>set('training_courses_attended', e.target.value)} className={iC} placeholder="e.g. B.ED" />
                            <div className="hidden print:block print-box"></div>
                        </div>
                        <div className="print-field">
                            <label className={lC}>Training Duration in Days</label>
                            <input type="number" value={form.duration_in_days} onChange={e=>set('duration_in_days', e.target.value)} className={iC} />
                            <div className="hidden print:block print-box"></div>
                        </div>
                        <div className="print-field md:col-span-1 lg:col-span-2">
                            <label className={lC}>Training Programme Organized By</label>
                            <input value={form.training_programme_organized_by} onChange={e=>set('training_programme_organized_by', e.target.value)} className={iC} placeholder="e.g. Training Institute" />
                            <div className="hidden print:block print-box"></div>
                        </div>
                        <div className="print-field">
                            <label className={lC}>Trained in Computer Teaching</label>
                            <input value={form.trained_in_computer} onChange={e=>set('trained_in_computer', e.target.value)} className={iC} />
                            <div className="hidden print:block print-box"></div>
                        </div>
                        <div className="print-field">
                            <label className={lC}>Trained to Teach CWSN</label>
                            <input value={form.trained_to_teach_cwsn} onChange={e=>set('trained_to_teach_cwsn', e.target.value)} className={iC} />
                            <div className="hidden print:block print-box"></div>
                        </div>
                    </div>
                </div>
            </div>
        </AppShell>
    );
}
