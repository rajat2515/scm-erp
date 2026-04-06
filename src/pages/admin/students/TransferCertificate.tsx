import React, { useState, useEffect, useRef } from 'react';
import AppShell from '@/components/layout/AppShell';
import { supabase } from '@/config/supabaseClient';
import { Search, Printer, User, FileText, ChevronRight, Save, Layout, AlertTriangle, Trash2 } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import { TransferCertificatePrint, TCData } from '@/components/forms/TransferCertificatePrint';
import { Student } from '@/types';
import Swal from 'sweetalert2';
import { CLASSES } from './StudentDirectory';

const INITIAL_TC_DATA: TCData = {
    schoolNo: '81858',
    bookNo: '02',
    srNo: '',
    udiseNo: '09030510408',
    affiliationNo: '2132374',
    renewedTo: '',
    statusOfSchool: 'Secondary',
    regNoOfCandidate: '',
    pupilName: '',
    penNumber: '',
    motherName: '',
    fatherName: '',
    nationality: 'INDIAN',
    category: 'GENERAL',
    dobFig: '',
    dobWords: '',
    isFailed: 'NO',
    subjects: 'HINDI ENGLISH MATHS SCIENCE SST COMPUTER',
    lastClass: '',
    lastExamResult: 'PASSED',
    qualifiedPromotion: 'YES',
    paidDues: 'YES',
    nccDetail: 'NO',
    dateStruckOff: '',
    reasonForLeaving: 'PARENT\'S DESIRE',
    totalMeetings: '198',
    meetingsAttended: '88',
    generalConduct: 'GOOD',
    remarks: 'N/A',
    issueDate: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-')
};

function NumberToWords(dateStr: string) {
    if (!dateStr) return '';
    const months = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
    const ones = ['', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN', 'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN', 'SEVENTEEN', 'EIGHTEEN', 'NINETEEN'];
    const tens = ['', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY'];
    
    const numToWords = (num: number): string => {
        if (num < 20) return ones[num];
        if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 !== 0 ? ' ' + ones[num % 10] : '');
        if (num < 1000) return ones[Math.floor(num / 100)] + ' HUNDRED' + (num % 100 !== 0 ? ' AND ' + numToWords(num % 100) : '');
        if (num < 10000) return numToWords(Math.floor(num / 1000)) + ' THOUSAND' + (num % 1000 !== 0 ? ' ' + numToWords(num % 1000) : '');
        return num.toString();
    };

    const parts = dateStr.split('-');
    if (parts.length !== 3) return '';
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const day = parseInt(parts[2], 10);
    
    if (isNaN(day) || isNaN(month) || isNaN(year)) return '';
    
    return `${numToWords(day)} ${months[month - 1]} ${numToWords(year)}`;
}

export interface TCLog {
    id: string;
    student_sr_no: number;
    pupil_name: string;
    class: string;
    action: string;
    created_at: string;
}

const TransferCertificate: React.FC = () => {
    const [search, setSearch] = useState('');
    const [filterClass, setFilterClass] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [students, setStudents] = useState<Student[]>([]);
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
    const [tcData, setTcData] = useState<TCData>(INITIAL_TC_DATA);
    const [isSearching, setIsSearching] = useState(false);
    const [recentLogs, setRecentLogs] = useState<TCLog[]>([]);
    
    const printRef = useRef<HTMLDivElement>(null);
    const handlePrintExec = useReactToPrint({
        content: () => printRef.current,
    });

    const fetchLogs = async () => {
        const { data } = await supabase.from('tc_logs').select('*').order('created_at', { ascending: false }).limit(10);
        if (data) setRecentLogs(data as TCLog[]);
    };

    useEffect(() => {
        fetchLogs();
    }, []);

    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            const fetchStudents = async () => {
                if (!search && !filterClass && !filterStatus) {
                    setStudents([]);
                    return;
                }
                setIsSearching(true);
                let query = supabase.from('students').select('*').limit(10);
                
                if (search) {
                    query = query.or(`name.ilike.%${search}%,sr_no.eq.${parseInt(search) || 0}`);
                }
                if (filterClass) {
                    query = query.eq('class', filterClass);
                }
                if (filterStatus) {
                    query = query.eq('status', filterStatus);
                }
                
                const { data, error } = await query;
                if (!error && data) setStudents(data as Student[]);
                setIsSearching(false);
            };
            fetchStudents();
        }, 300);
        return () => clearTimeout(delayDebounceFn);
    }, [search, filterClass, filterStatus]);

    const handleSelectStudent = (student: Student) => {
        setSelectedStudent(student);
        setSearch('');
        setStudents([]);
        
        const dobWords = student.dob ? NumberToWords(student.dob) : '';

        // Auto-fill form
        setTcData({
            ...INITIAL_TC_DATA,
            srNo: student.sr_no.toString(),
            pupilName: student.name,
            penNumber: student.pen_no || '',
            motherName: student.mother_name || '',
            fatherName: student.father_name || '',
            dobFig: student.dob || '',
            dobWords: dobWords,
            lastClass: student.class || '',
            nationality: student.nationality || 'INDIAN',
            category: (student.caste || 'GENERAL').toUpperCase(),
        });
    };

    const handleInputChange = (field: keyof TCData, value: string) => {
        if (field === 'dobFig') {
            setTcData(prev => ({ ...prev, [field]: value, dobWords: NumberToWords(value) }));
        } else {
            setTcData(prev => ({ ...prev, [field]: value }));
        }
    };

    const handlePrintAndLog = async () => {
        if (!selectedStudent) return;
        
        await supabase.from('tc_logs').insert([{
            student_sr_no: selectedStudent.sr_no,
            pupil_name: selectedStudent.name,
            class: selectedStudent.class,
            action: 'generated'
        }]);
        
        fetchLogs();
        handlePrintExec();
    };

    const transferToTC = async (log: TCLog) => {
        const result = await Swal.fire({
            title: 'Are you sure?',
            text: `You are about to transfer ${log.pupil_name} out of class. This action cannot be easily undone!`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            confirmButtonText: 'Yes, transfer to TC!'
        });

        if (result.isConfirmed) {
            const { error } = await supabase
                .from('students')
                .update({ status: 'transferred' })
                .eq('sr_no', log.student_sr_no);

            if (error) {
                Swal.fire({
                    title: 'Error!',
                    text: 'Failed to transfer student.',
                    icon: 'error',
                });
            } else {
                Swal.fire({
                    title: 'Transferred!',
                    text: `${log.pupil_name} has been marked as transferred.`,
                    icon: 'success',
                });
                // optionally we could update the log to show action complete, but status change is enough
            }
        }
    };

    const handleDeleteLog = async (logId: string) => {
        const result = await Swal.fire({
            title: 'Delete log?',
            text: "Are you sure you want to delete this TC log? This cannot be undone.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Yes, delete it!'
        });

        if (result.isConfirmed) {
            const { error } = await supabase.from('tc_logs').delete().eq('id', logId);
            if (error) {
                Swal.fire('Error!', 'Failed to delete log.', 'error');
            } else {
                fetchLogs();
                Swal.fire('Deleted!', 'The log has been deleted.', 'success');
            }
        }
    };

    return (
        <AppShell title="Transfer Certificate" subtitle="Generate and print official TC for students">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* Left Panel: Search & Student Info */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
                        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">Find Student</h3>
                        
                        <div className="space-y-3 relative z-30">
                            {/* Filters Row */}
                            <div className="grid grid-cols-2 gap-3">
                                <select 
                                    className="w-full px-3 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                                    value={filterClass}
                                    onChange={e => setFilterClass(e.target.value)}
                                >
                                    <option value="">All Classes</option>
                                    {CLASSES.filter(c => c !== 'All').map(c => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                </select>
                                <select 
                                    className="w-full px-3 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                                    value={filterStatus}
                                    onChange={e => setFilterStatus(e.target.value)}
                                >
                                    <option value="">All Statuses</option>
                                    <option value="active">Active</option>
                                    <option value="inactive">Inactive</option>
                                    <option value="transferred">Transferred (TC)</option>
                                </select>
                            </div>

                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <input
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Search by name or SR no..."
                                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                                />
                                
                                {/* Search Results */}
                                {students.length > 0 && (
                                    <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2">
                                        {students.map((s) => (
                                            <button
                                                key={s.sr_no}
                                                onClick={() => handleSelectStudent(s)}
                                                className="w-full text-left px-4 py-3 hover:bg-muted transition-colors flex items-center gap-3 border-b border-border last:border-0"
                                            >
                                                <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center text-white text-xs font-bold">
                                                    {s.name[0]}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-semibold">{s.name}</p>
                                                    <p className="text-[10px] text-muted-foreground uppercase">SR {s.sr_no} • Class {s.class} • {s.status}</p>
                                                </div>
                                                <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto" />
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                        
                        {selectedStudent ? (
                            <div className="mt-6 p-4 bg-primary/5 border border-primary/20 rounded-xl animate-in zoom-in-95 relative z-10">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-12 h-12 rounded-full gradient-primary flex items-center justify-center text-white text-lg font-bold">
                                        {selectedStudent.name[0]}
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-foreground">{selectedStudent.name}</h4>
                                        <p className="text-xs text-muted-foreground">Class {selectedStudent.class} • Status: {selectedStudent.status}</p>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs">
                                        <span className="text-muted-foreground">SR Number:</span>
                                        <span className="font-semibold">{selectedStudent.sr_no}</span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-muted-foreground">Father's Name:</span>
                                        <span className="font-semibold">{selectedStudent.father_name}</span>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="mt-6 py-10 text-center border-2 border-dashed border-border rounded-xl">
                                <User className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                                <p className="text-xs text-muted-foreground">Select a student to generate TC</p>
                            </div>
                        )}
                    </div>
                    
                    {/* Recent TC History */}
                    <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
                        <div className="flex items-center gap-2 mb-4">
                            <FileText className="w-4 h-4 text-primary" />
                            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Recent TC Logs</h3>
                        </div>
                        {recentLogs.length === 0 ? (
                            <p className="text-xs text-muted-foreground text-center py-4">No TC generated yet.</p>
                        ) : (
                            <div className="space-y-3">
                                {recentLogs.map(log => (
                                    <div key={log.id} className="p-3 bg-muted/50 rounded-xl border border-border flex flex-col gap-2">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="text-sm font-bold">{log.pupil_name}</p>
                                                <p className="text-[10px] text-muted-foreground uppercase">SR: {log.student_sr_no} • Class: {log.class}</p>
                                            </div>
                                            <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full">{new Date(log.created_at).toLocaleDateString()}</span>
                                        </div>
                                        <div className="flex gap-2 w-full mt-1">
                                            <button 
                                                onClick={() => transferToTC(log)}
                                                className="text-xs flex-1 flex items-center justify-center gap-1 bg-red-500/10 hover:bg-red-500/20 text-red-600 py-1.5 rounded-lg transition-colors border border-red-500/20"
                                            >
                                                <AlertTriangle className="w-3 h-3" />
                                                Transfer student to TC
                                            </button>
                                            <button 
                                                onClick={() => handleDeleteLog(log.id)}
                                                className="text-xs px-2.5 flex items-center justify-center bg-background hover:bg-red-500/10 text-muted-foreground hover:text-red-500 py-1.5 rounded-lg transition-colors border border-border"
                                                title="Delete Log"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Panel: TC Details Form */}
                <div className="lg:col-span-2 relative z-0">
                    <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden flex flex-col h-full">
                        <div className="p-6 border-b border-border flex items-center justify-between bg-muted/30">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-primary/10 text-primary rounded-lg">
                                    <Layout className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-foreground">Certificate Details</h3>
                                    <p className="text-xs text-muted-foreground">Verify and update fields for the document</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handlePrintAndLog}
                                    disabled={!selectedStudent}
                                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm font-bold hover:bg-muted transition-all disabled:opacity-50"
                                >
                                    <Printer className="w-4 h-4" />
                                    Print TC
                                </button>
                                <button
                                    onClick={handlePrintAndLog}
                                    disabled={!selectedStudent}
                                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl gradient-primary text-white text-sm font-bold shadow-lg shadow-primary/20 hover:opacity-90 transition-all disabled:opacity-50 disabled:shadow-none"
                                >
                                    <FileText className="w-4 h-4" />
                                    Download TC (PDF)
                                </button>
                            </div>
                        </div>
                        
                        <div className="p-6 overflow-y-auto max-h-[70vh] custom-scrollbar">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                                
                                <div className="col-span-full mb-4">
                                    <h4 className="text-xs font-bold text-primary uppercase tracking-widest border-b border-primary/20 pb-2 mb-4">Administrative Details</h4>
                                    <div className="grid grid-cols-3 gap-4">
                                        <FormField label="School No." value={tcData.schoolNo} onChange={v => handleInputChange('schoolNo', v)} />
                                        <FormField label="Book No." value={tcData.bookNo} onChange={v => handleInputChange('bookNo', v)} />
                                        <FormField label="S.R. No." value={tcData.srNo} onChange={v => handleInputChange('srNo', v)} />
                                        <FormField label="Udise No." value={tcData.udiseNo} onChange={v => handleInputChange('udiseNo', v)} />
                                        <FormField label="Affiliation No." value={tcData.affiliationNo} onChange={v => handleInputChange('affiliationNo', v)} />
                                        <FormField label="Issue Date" value={tcData.issueDate} onChange={v => handleInputChange('issueDate', v)} />
                                    </div>
                                </div>

                                <div className="col-span-full mb-4">
                                    <h4 className="text-xs font-bold text-primary uppercase tracking-widest border-b border-primary/20 pb-2 mb-4">Student Information</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <FormField label="1. Name of the Pupil" value={tcData.pupilName} onChange={v => handleInputChange('pupilName', v)} />
                                        <FormField label="2. PEN NUMBER" value={tcData.penNumber} onChange={v => handleInputChange('penNumber', v)} />
                                        <FormField label="3. Mother's Name" value={tcData.motherName} onChange={v => handleInputChange('motherName', v)} />
                                        <FormField label="4. Father's Name" value={tcData.fatherName} onChange={v => handleInputChange('fatherName', v)} />
                                        <FormField label="5. Nationality" value={tcData.nationality} onChange={v => handleInputChange('nationality', v)} />
                                        <FormField label="6. Category (SC/ST/OBC)" value={tcData.category} onChange={v => handleInputChange('category', v)} />
                                        <FormField label="7. DOB (Figures)" value={tcData.dobFig} type="date" onChange={v => handleInputChange('dobFig', v)} />
                                        <FormField label="8. DOB (Words)" value={tcData.dobWords} onChange={v => handleInputChange('dobWords', v)} />
                                    </div>
                                </div>

                                <div className="col-span-full">
                                    <h4 className="text-xs font-bold text-primary uppercase tracking-widest border-b border-primary/20 pb-2 mb-4">Academic Record</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <FormField label="9. Whether failed?" value={tcData.isFailed} onChange={v => handleInputChange('isFailed', v)} />
                                        <FormField label="10. Subject offered" value={tcData.subjects} onChange={v => handleInputChange('subjects', v)} />
                                        <FormField label="11. Class last studied" value={tcData.lastClass} onChange={v => handleInputChange('lastClass', v)} />
                                        <FormField label="12. Last Exam Result" value={tcData.lastExamResult} onChange={v => handleInputChange('lastExamResult', v)} />
                                        <FormField label="13. Qualified for promotion?" value={tcData.qualifiedPromotion} onChange={v => handleInputChange('qualifiedPromotion', v)} />
                                        <FormField label="14. Paid all dues?" value={tcData.paidDues} onChange={v => handleInputChange('paidDues', v)} />
                                        <FormField label="17. Reason for leaving" value={tcData.reasonForLeaving} onChange={v => handleInputChange('reasonForLeaving', v)} />
                                        <FormField label="20. General conduct" value={tcData.generalConduct} onChange={v => handleInputChange('generalConduct', v)} />
                                        <div className="md:col-span-2">
                                            <FormField label="21. Any other Remark" value={tcData.remarks} onChange={v => handleInputChange('remarks', v)} />
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="col-span-full">
                                    <h4 className="text-xs font-bold text-primary uppercase tracking-widest border-b border-primary/20 pb-2 mb-4">Attendance & Extracurricular</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <FormField label="15. NCC/Scout/Guide Detail" value={tcData.nccDetail} onChange={v => handleInputChange('nccDetail', v)} />
                                        <FormField label="16. Date Struck off roles" value={tcData.dateStruckOff} type="date" onChange={v => handleInputChange('dateStruckOff', v)} />
                                        <FormField label="18. No. of meetings to date" value={tcData.totalMeetings} onChange={v => handleInputChange('totalMeetings', v)} />
                                        <FormField label="19. School days attended" value={tcData.meetingsAttended} onChange={v => handleInputChange('meetingsAttended', v)} />
                                    </div>
                                </div>

                                <div className="col-span-full mb-4">
                                    <h4 className="text-xs font-bold text-primary uppercase tracking-widest border-b border-primary/20 pb-2 mb-4">Additional Headings</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <FormField label="Renewed To" value={tcData.renewedTo} onChange={v => handleInputChange('renewedTo', v)} />
                                        <FormField label="Status of School" value={tcData.statusOfSchool} onChange={v => handleInputChange('statusOfSchool', v)} />
                                        <div className="col-span-2">
                                            <FormField label="Registration No. (IX to XII)" value={tcData.regNoOfCandidate} onChange={v => handleInputChange('regNoOfCandidate', v)} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Hidden Print Component */}
            <div className="hidden">
                <TransferCertificatePrint ref={printRef} data={tcData} />
            </div>
        </AppShell>
    );
};

const FormField = ({ label, value, onChange, type = "text" }: { label: string, value: string, onChange: (v: string) => void, type?: string }) => (
    <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{label}</label>
        <input
            type={type}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="px-4 py-2 rounded-xl border border-input bg-background/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:bg-background transition-all"
        />
    </div>
);

export default TransferCertificate;
