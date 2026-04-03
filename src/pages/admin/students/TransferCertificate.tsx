import React, { useState, useEffect, useRef } from 'react';
import AppShell from '@/components/layout/AppShell';
import { supabase } from '@/config/supabaseClient';
import { Search, Printer, User, FileText, ChevronRight, Save, Layout } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import { TransferCertificatePrint, TCData } from '@/components/forms/TransferCertificatePrint';
import { Student } from '@/types';

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

const TransferCertificate: React.FC = () => {
    const [search, setSearch] = useState('');
    const [students, setStudents] = useState<Student[]>([]);
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
    const [tcData, setTcData] = useState<TCData>(INITIAL_TC_DATA);
    const [isSearching, setIsSearching] = useState(false);
    
    const printRef = useRef<HTMLDivElement>(null);
    const handlePrint = useReactToPrint({
        content: () => printRef.current,
    });

    useEffect(() => {
        if (search.length > 2) {
            const delayDebounceFn = setTimeout(() => {
                const fetchStudents = async () => {
                    setIsSearching(true);
                    const { data, error } = await supabase
                        .from('students')
                        .select('*')
                        .or(`name.ilike.%${search}%,sr_no.eq.${parseInt(search) || 0}`)
                        .limit(5);
                    if (!error && data) setStudents(data as Student[]);
                    setIsSearching(false);
                };
                fetchStudents();
            }, 300);
            return () => clearTimeout(delayDebounceFn);
        } else {
            setStudents([]);
        }
    }, [search]);

    const handleSelectStudent = (student: Student) => {
        setSelectedStudent(student);
        setSearch('');
        setStudents([]);
        
        // Auto-fill form
        setTcData({
            ...INITIAL_TC_DATA,
            srNo: student.sr_no.toString(),
            pupilName: student.name,
            penNumber: student.pen_no || '',
            motherName: student.mother_name || '',
            fatherName: student.father_name || '',
            dobFig: student.dob || '',
            lastClass: student.class || '',
            nationality: student.nationality || 'INDIAN',
            category: (student.caste || 'GENERAL').toUpperCase(),
        });
    };

    const handleInputChange = (field: keyof TCData, value: string) => {
        setTcData(prev => ({ ...prev, [field]: value }));
    };

    return (
        <AppShell title="Transfer Certificate" subtitle="Generate and print official TC for students">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* Left Panel: Search & Student Info */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
                        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">Find Student</h3>
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
                                <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-xl shadow-xl z-20 overflow-hidden animate-in fade-in slide-in-from-top-2">
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
                                                <p className="text-[10px] text-muted-foreground uppercase">SR {s.sr_no} • Class {s.class}</p>
                                            </div>
                                            <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto" />
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        
                        {selectedStudent ? (
                            <div className="mt-6 p-4 bg-primary/5 border border-primary/20 rounded-xl animate-in zoom-in-95">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-12 h-12 rounded-full gradient-primary flex items-center justify-center text-white text-lg font-bold">
                                        {selectedStudent.name[0]}
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-foreground">{selectedStudent.name}</h4>
                                        <p className="text-xs text-muted-foreground">Class {selectedStudent.class} • Roll {selectedStudent.roll_no}</p>
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
                    
                    {/* Recent TC History would go here */}
                    <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
                        <div className="flex items-center gap-2 mb-4">
                            <FileText className="w-4 h-4 text-primary" />
                            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Quick Tips</h3>
                        </div>
                        <ul className="text-xs text-muted-foreground space-y-3">
                            <li className="flex gap-2">
                                <div className="w-1 h-1 rounded-full bg-primary mt-1.5 shrink-0" />
                                All fields are editable even after auto-filling from student record.
                            </li>
                            <li className="flex gap-2">
                                <div className="w-1 h-1 rounded-full bg-primary mt-1.5 shrink-0" />
                                Use "Print Now" to generate the final A4 certificate.
                            </li>
                        </ul>
                    </div>
                </div>

                {/* Right Panel: TC Details Form */}
                <div className="lg:col-span-2">
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
                                    onClick={handlePrint}
                                    disabled={!selectedStudent}
                                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm font-bold hover:bg-muted transition-all disabled:opacity-50"
                                >
                                    <Printer className="w-4 h-4" />
                                    Print TC
                                </button>
                                <button
                                    onClick={handlePrint}
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
