import React from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '@/components/layout/AppShell';
import { FileText, Download, Printer, UserPlus, FileSignature, Car, GraduationCap, Users } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import { StudentRegistrationPrint } from '@/components/forms/StudentRegistrationPrint';
import { StaffRegistrationPrint } from '@/components/forms/StaffRegistrationPrint';
import { CharacterCertificatePrint } from '@/components/forms/CharacterCertificatePrint';

interface FormTemplate {
    id: string;
    title: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    category: 'Student' | 'Staff' | 'General';
    filename?: string;
    path?: string;
}

const FORMS: FormTemplate[] = [
    {
        id: 'student-registration',
        title: 'Student Registration Form',
        description: 'Standard registration and admission form for new students.',
        icon: UserPlus,
        category: 'Student',
    },
    {
        id: 'transfer-certificate',
        title: 'TC Application Form',
        description: 'Application for Transfer Certificate (TC).',
        icon: GraduationCap,
        category: 'Student',
    },
    {
        id: 'character-certificate',
        title: 'Student Verification Character Certificate',
        description: 'Official character certificate and student verification form.',
        icon: FileSignature,
        category: 'Student',
    },
    {
        id: 'staff-registration',
        title: 'Staff Registration Form',
        description: 'Registration form for new teaching and non-teaching staff.',
        icon: Users,
        category: 'Staff',
    },
    {
        id: 'leave-application',
        title: 'Leave Application Form',
        description: 'Standard leave request form for staff and students.',
        icon: FileSignature,
        category: 'General',
    }
];

const FormsCenter: React.FC = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = React.useState<'Student' | 'Staff' | 'General'>('Student');
    const categories = ['Student', 'Staff', 'General'] as const;

    const studentRegRef = React.useRef<HTMLDivElement>(null);
    const staffRegRef = React.useRef<HTMLDivElement>(null);
    const characterCertRef = React.useRef<HTMLDivElement>(null);

    const handlePrintStudentReg = useReactToPrint({ content: () => studentRegRef.current });
    const handlePrintStaffReg = useReactToPrint({ content: () => staffRegRef.current });
    const handlePrintCharacterCert = useReactToPrint({ content: () => characterCertRef.current });

    const handlePrint = (form: FormTemplate) => {
        if (form.id === 'student-registration') {
            handlePrintStudentReg();
            return;
        }
        if (form.id === 'staff-registration') {
            handlePrintStaffReg();
            return;
        }
        if (form.id === 'character-certificate') {
            handlePrintCharacterCert();
            return;
        }
        if (form.id === 'transfer-certificate') {
            navigate('/admin/students/tc');
            return;
        }

        if (form.path) {
            navigate(form.path);
            return;
        }
        alert(`Print functionality for ${form.title} will be implemented here. You can connect it to a PDF or an HTML printable area.`);
    };

    const handleDownload = (form: FormTemplate) => {
        if (form.id === 'transfer-certificate') {
            navigate('/admin/students/tc');
            return;
        }
        if (form.path) {
            navigate(form.path);
            return;
        }
        alert(`Download for ${form.title}. Place the corresponding PDF in the public folder to enable real downloads.`);
    };

    const activeForms = FORMS.filter(f => f.category === activeTab);

    return (
        <AppShell title="Forms Center" subtitle="Download and print official school forms">
            {/* Tabs */}
            <div className="flex bg-muted/50 p-1.5 rounded-2xl w-fit mb-6 animate-fade-in mx-auto sm:mx-0">
                {categories.map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-5 sm:px-6 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                            activeTab === tab
                                ? 'bg-card text-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                        }`}
                    >
                        {tab} Forms
                    </button>
                ))}
            </div>

            <div className="animate-fade-in">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {activeForms.length === 0 ? (
                        <div className="col-span-full py-10 text-center text-muted-foreground bg-card border border-border rounded-2xl">
                            No forms available for this category yet.
                        </div>
                    ) : (
                        activeForms.map(form => (
                            <div key={form.id} className="bg-card border border-border rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow group flex flex-col h-full animate-scale-in">
                                <div className="flex items-start gap-4 mb-4 flex-1">
                                    <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center text-white flex-shrink-0 shadow-sm">
                                        <form.icon className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-foreground line-clamp-1 group-hover:text-primary transition-colors">{form.title}</h3>
                                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{form.description}</p>
                                    </div>
                                </div>
                                
                                <div className="pt-4 border-t border-border/50 flex gap-2 mt-auto">
                                    {form.id === 'transfer-certificate' ? (
                                        <button 
                                            onClick={() => navigate('/admin/students/tc')}
                                            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary text-white text-sm font-bold rounded-xl hover:bg-primary/90 transition-all shadow-md shadow-primary/20"
                                        >
                                            <GraduationCap className="w-4 h-4" /> Generate TC
                                        </button>
                                    ) : (
                                        <>
                                            <button 
                                                onClick={() => handlePrint(form)}
                                                className="flex-1 flex items-center justify-center gap-2 py-2 bg-background border border-border text-foreground text-xs font-semibold rounded-lg hover:bg-muted/50 transition-colors"
                                            >
                                                <Printer className="w-3.5 h-3.5" /> Print
                                            </button>
                                            <button 
                                                onClick={() => handleDownload(form)}
                                                className="flex-1 flex items-center justify-center gap-2 py-2 bg-primary text-white text-xs font-semibold rounded-lg hover:bg-primary/90 transition-colors shadow-sm"
                                            >
                                                <Download className="w-3.5 h-3.5" /> Download
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Hidden Print Components */}
            <StudentRegistrationPrint ref={studentRegRef} />
            <StaffRegistrationPrint ref={staffRegRef} />
            <CharacterCertificatePrint ref={characterCertRef} />
        </AppShell>
    );
};

export default FormsCenter;
