import React, { useState, useEffect } from 'react';
import { supabase } from '@/config/supabaseClient';
import AppShell from '@/components/layout/AppShell';
import { Search, Printer, FileBadge, Loader2, ClipboardList, Calendar, X } from 'lucide-react';
import type { Student } from '@/types';
import GatePassPrintLayout, { GatePassData } from '@/components/print/GatePassPrintLayout';

interface GatePassRecord {
    id: string;
    student_name: string;
    student_class: string;
    sr_no: string;
    parent_name: string;
    parent_contact: string;
    reason: string;
    pass_date: string;
    pass_time: string;
    created_at: string;
}

export default function GatePass() {
    const [activeTab, setActiveTab] = useState<'generate' | 'records'>('generate');

    // --- GENERATE TAB STATE ---
    const [students, setStudents] = useState<Student[]>([]);
    const [loadingStudents, setLoadingStudents] = useState(true);
    const [searchStudent, setSearchStudent] = useState('');
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

    const [parentName, setParentName] = useState('');
    const [parentContact, setParentContact] = useState('');
    const [reasonType, setReasonType] = useState('Doctor Appointment');
    const [customReason, setCustomReason] = useState('');
    
    const [date, setDate] = useState(new Date().toLocaleDateString('en-GB'));
    const [time, setTime] = useState(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));

    // --- RECORDS TAB STATE ---
    const [records, setRecords] = useState<GatePassRecord[]>([]);
    const [loadingRecords, setLoadingRecords] = useState(false);
    const [searchRecord, setSearchRecord] = useState('');
    const [filterDate, setFilterDate] = useState('');
    const [recordsError, setRecordsError] = useState('');

    // --- EFFECTS ---
    useEffect(() => {
        const timer = setInterval(() => {
            const now = new Date();
            setDate(now.toLocaleDateString('en-GB'));
            setTime(now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
        }, 60000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        const fetchStudents = async () => {
            setLoadingStudents(true);
            const { data, error } = await supabase
                .from('students')
                .select('*')
                .eq('status', 'active')
                .order('name');
            if (!error && data) setStudents(data);
            setLoadingStudents(false);
        };
        fetchStudents();
    }, []);

    // Fetch records only when the records tab is active
    useEffect(() => {
        if (activeTab === 'records') {
            fetchRecords();
        }
    }, [activeTab]);

    const fetchRecords = async () => {
        setLoadingRecords(true);
        setRecordsError('');
        const { data, error: dbError } = await supabase
            .from('gate_pass_records')
            .select('*')
            .order('created_at', { ascending: false });

        if (dbError) {
            setRecordsError('Could not load records. Make sure the gate_pass_records table exists in Supabase.');
        } else {
            setRecords(data || []);
        }
        setLoadingRecords(false);
    };

    // --- GENERATE LOGIC ---
    const filteredStudents = searchStudent === '' ? [] : students.filter(s => 
        s.name.toLowerCase().includes(searchStudent.toLowerCase()) || 
        s.sr_no.toString().includes(searchStudent) ||
        (s.father_name || '').toLowerCase().includes(searchStudent.toLowerCase())
    ).slice(0, 5);

    const handleSelectStudent = (student: Student) => {
        setSelectedStudent(student);
        setSearchStudent('');
        setParentName(student.father_name || student.mother_name || '');
        setParentContact(student.phone || student.whatsapp || '');
        setReasonType('Doctor Appointment');
        setCustomReason('');
    };

    const finalReason = reasonType === 'Other (Please specify)' ? customReason : reasonType;

    const handlePrint = async () => {
        if (!selectedStudent) return;

        // Save record to Supabase before printing
        const today = new Date();
        const isoDate = today.toISOString().split('T')[0]; // YYYY-MM-DD
        await supabase.from('gate_pass_records').insert({
            student_id: selectedStudent.sr_no,
            student_name: selectedStudent.name,
            student_class: selectedStudent.class || '',
            sr_no: selectedStudent.sr_no.toString(),
            parent_name: parentName,
            parent_contact: parentContact,
            reason: finalReason,
            pass_date: isoDate,
            pass_time: time,
        });

        window.print();
        
        // Refresh records in background so they are ready if user switches tabs
        if (activeTab === 'generate') {
            fetchRecords();
        }
    };

    const gatePassData: GatePassData = {
        studentName: selectedStudent?.name || '',
        studentClass: selectedStudent?.class || '',
        srNo: selectedStudent?.sr_no.toString() || '',
        placeOfLiving: selectedStudent?.address || '',
        parentName: parentName,
        parentContact: parentContact,
        reason: finalReason,
        date: date,
        time: time
    };

    // --- RECORDS LOGIC ---
    const filteredRecords = records.filter(r => {
        const matchSearch = searchRecord === '' || 
            r.student_name.toLowerCase().includes(searchRecord.toLowerCase()) ||
            r.sr_no.includes(searchRecord) ||
            r.student_class.toLowerCase().includes(searchRecord.toLowerCase());
        const matchDate = filterDate === '' || r.pass_date === filterDate;
        return matchSearch && matchDate;
    });

    const formatDate = (dateStr: string) => {
        if (!dateStr) return '-';
        const [y, m, d] = dateStr.split('-');
        return `${d}/${m}/${y}`;
    };

    return (
        <AppShell title="Gate Pass Management" subtitle="Issue passes and view departure records">
            
            {/* Tab Navigation (Hidden in print) */}
            <div className="flex bg-muted/50 p-1.5 rounded-2xl w-fit mb-8 print:hidden">
                <button
                    onClick={() => setActiveTab('generate')}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                        activeTab === 'generate' 
                        ? 'bg-card text-foreground shadow-sm' 
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}
                >
                    <FileBadge className="w-4 h-4" />
                    Generate Pass
                </button>
                <button
                    onClick={() => setActiveTab('records')}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                        activeTab === 'records' 
                        ? 'bg-card text-foreground shadow-sm' 
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}
                >
                    <ClipboardList className="w-4 h-4" />
                    Pass Records
                </button>
            </div>

            {/* TAB: GENERATE PASS */}
            {activeTab === 'generate' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 relative z-10 print:hidden animate-fade-in">
                    
                    {/* Left Column: Form Controls */}
                    <div className="space-y-6">
                        <div className="bg-card border border-border rounded-3xl p-6 shadow-sm">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shadow-lg shadow-primary/20">
                                    <Search className="w-5 h-5 text-white" />
                                </div>
                                <h2 className="text-xl font-bold">1. Select Student</h2>
                            </div>

                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="Search by Student Name, SR No, or Father's Name..."
                                    value={searchStudent}
                                    onChange={(e) => setSearchStudent(e.target.value)}
                                    className="w-full pl-4 pr-4 py-3 bg-muted/30 border border-border rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                                />
                                {loadingStudents && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />}
                            </div>

                            {/* Search Dropdown Results */}
                            {searchStudent && (
                                <div className="mt-2 border border-border rounded-xl bg-card overflow-hidden shadow-lg absolute z-50 w-full lg:w-auto left-6 right-6 lg:right-auto lg:w-[calc(50%-2rem)]">
                                    {filteredStudents.length > 0 ? (
                                        filteredStudents.map(student => (
                                            <button
                                                key={student.sr_no}
                                                onClick={() => handleSelectStudent(student)}
                                                className="w-full text-left px-4 py-3 hover:bg-muted border-b border-border last:border-0 transition-colors flex items-center justify-between"
                                            >
                                                <div>
                                                    <div className="font-semibold text-sm">{student.name}</div>
                                                    <div className="text-xs text-muted-foreground">Class: {student.class} | Guardian: {student.father_name || 'N/A'}</div>
                                                </div>
                                                <span className="text-xs font-mono bg-primary/10 text-primary px-2 py-1 rounded-md">SR: {student.sr_no}</span>
                                            </button>
                                        ))
                                    ) : (
                                        <div className="px-4 py-3 text-sm text-muted-foreground">No active students found matching "{searchStudent}"</div>
                                    )}
                                </div>
                            )}

                            {selectedStudent && (
                                <div className="mt-6 p-4 rounded-2xl bg-primary/5 border border-primary/20 flex items-center justify-between animate-fade-in">
                                    <div>
                                        <div className="text-xs font-semibold text-primary mb-1 uppercase tracking-wider">Selected Student</div>
                                        <div className="font-bold text-lg">{selectedStudent.name}</div>
                                        <div className="text-sm text-muted-foreground">Class {selectedStudent.class} • SR. {selectedStudent.sr_no}</div>
                                    </div>
                                    <button onClick={() => setSelectedStudent(null)} className="text-xs font-medium text-red-500 hover:text-red-600 bg-red-50 px-3 py-1.5 rounded-lg border border-red-100 transition-colors">
                                        Clear
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className={`bg-card border border-border rounded-3xl p-6 shadow-sm transition-opacity duration-300 ${selectedStudent ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shadow-lg shadow-primary/20">
                                    <FileBadge className="w-5 h-5 text-white" />
                                </div>
                                <h2 className="text-xl font-bold">2. Pass Details</h2>
                            </div>

                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-semibold text-muted-foreground mb-1 block">Parent / Authorized Person</label>
                                        <input 
                                            type="text" 
                                            value={parentName} 
                                            onChange={e => setParentName(e.target.value)}
                                            className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-muted-foreground mb-1 block">Contact Number</label>
                                        <input 
                                            type="text" 
                                            value={parentContact} 
                                            onChange={e => setParentContact(e.target.value)}
                                            className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                                        />
                                    </div>
                                </div>
                                
                                <div>
                                    <label className="text-xs font-semibold text-muted-foreground mb-1 block">Reason for Early Leave</label>
                                    <select
                                        value={reasonType}
                                        onChange={e => setReasonType(e.target.value)}
                                        className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%24%2024%22%20fill%3D%22none%22%20stroke%3D%22%23666%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-[length:1em_1em] bg-no-repeat bg-[position:right_1rem_center]"
                                    >
                                        <option value="Doctor Appointment">Doctor Appointment</option>
                                        <option value="Family Emergency">Family Emergency</option>
                                        <option value="To Attend Function">To Attend Function</option>
                                        <option value="Parent Choice">Parent Choice</option>
                                        <option value="Going Out of Station">Going Out of Station</option>
                                        <option value="Other (Please specify)">Other (Please specify)</option>
                                    </select>
                                </div>

                                {reasonType === 'Other (Please specify)' && (
                                    <div className="animate-fade-in">
                                        <label className="text-xs font-semibold text-muted-foreground mb-1 block">Specify Reason</label>
                                        <textarea 
                                            rows={2}
                                            value={customReason} 
                                            onChange={e => setCustomReason(e.target.value)}
                                            placeholder="Enter specific reason..."
                                            className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                                        />
                                    </div>
                                )}
                            </div>

                            <button 
                                onClick={handlePrint}
                                disabled={!selectedStudent}
                                className={`w-full mt-6 py-3 rounded-xl flex justify-center items-center gap-2 font-bold transition-all shadow-lg ${
                                    selectedStudent 
                                    ? 'gradient-primary text-white shadow-primary/25 hover:opacity-90 hover:scale-[1.01]' 
                                    : 'bg-muted text-muted-foreground shadow-none'
                                }`}
                            >
                                <Printer className="w-5 h-5" />
                                Generate & Print Gate Pass
                            </button>
                        </div>
                    </div>

                    {/* Right Column: Live Preview Box */}
                    <div className="bg-card border border-border rounded-3xl p-6 shadow-sm flex flex-col hidden lg:flex">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                                <Printer className="w-5 h-5 text-muted-foreground" />
                            </div>
                            <h2 className="text-xl font-bold">Live Preview</h2>
                        </div>

                        {/* Miniature representation of the pass */}
                        <div className="flex-1 border-2 border-dashed border-border rounded-2xl bg-muted/10 p-6 flex flex-col justify-center max-h-[600px] overflow-y-auto">
                            {!selectedStudent ? (
                                <div className="text-center text-muted-foreground">
                                    <FileBadge className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                    <p>Select a student to generate preview</p>
                                </div>
                            ) : (
                                <div className="bg-white p-6 shadow-sm border border-border/50 rounded-lg text-black animate-fade-in scale-[0.85] transform origin-top w-full">
                                    <div className="text-center border-b pb-2 mb-4">
                                        <h3 className="font-extrabold text-lg">S.C.M. CHILDREN ACADEMY</h3>
                                        <p className="text-[10px] text-gray-500 font-bold">GATE PASS - EARLY DEPARTURE</p>
                                    </div>
                                    <div className="space-y-2 text-xs">
                                        <p><strong>Student:</strong> {gatePassData.studentName}</p>
                                        <p><strong>Class:</strong> {gatePassData.studentClass} | <strong>SR:</strong> {gatePassData.srNo}</p>
                                        <p><strong>Authorized By:</strong> {gatePassData.parentName}</p>
                                        <p><strong>Reason:</strong> {gatePassData.reason || '_____________________'}</p>
                                        <div className="flex justify-between mt-4 font-semibold">
                                            <span>Date: {gatePassData.date}</span>
                                            <span>Time: {gatePassData.time}</span>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2 mt-8 text-center text-[8px] font-bold text-gray-400">
                                        <div className="border-t border-gray-400 pt-1">Parent</div>
                                        <div className="border-t border-gray-400 pt-1">Security</div>
                                        <div className="border-t border-gray-400 pt-1">Admin</div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* TAB: RECORDS */}
            {activeTab === 'records' && (
                <div className="animate-fade-in print:hidden">
                    {/* Toolbar */}
                    <div className="flex flex-col sm:flex-row gap-3 mb-6">
                        {/* Search box */}
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="Search by student name, class or SR no…"
                                value={searchRecord}
                                onChange={e => setSearchRecord(e.target.value)}
                                className="w-full pl-9 pr-4 py-2.5 bg-muted/30 border border-border rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                            />
                            {searchRecord && (
                                <button onClick={() => setSearchRecord('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>

                        {/* Date filter */}
                        <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                            <input
                                type="date"
                                value={filterDate}
                                onChange={e => setFilterDate(e.target.value)}
                                className="pl-9 pr-4 py-2.5 bg-muted/30 border border-border rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                            />
                            {filterDate && (
                                <button onClick={() => setFilterDate('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>

                        {/* Total badge */}
                        <div className="flex items-center px-4 py-2.5 bg-primary/5 border border-primary/20 rounded-xl text-sm font-semibold text-primary whitespace-nowrap">
                            {filteredRecords.length} Record{filteredRecords.length !== 1 ? 's' : ''}
                        </div>
                    </div>

                    {/* Error */}
                    {recordsError && (
                        <div className="mb-6 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                            {recordsError}
                        </div>
                    )}

                    {/* Table */}
                    <div className="bg-card border border-border rounded-3xl shadow-sm overflow-hidden">
                        {loadingRecords ? (
                            <div className="flex items-center justify-center py-20 gap-3 text-muted-foreground">
                                <Loader2 className="animate-spin w-5 h-5" />
                                <span>Loading records…</span>
                            </div>
                        ) : filteredRecords.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-center gap-3 text-muted-foreground">
                                <ClipboardList className="w-12 h-12 opacity-25" />
                                <p className="font-medium">No gate pass records found</p>
                                <p className="text-sm">
                                    {records.length === 0
                                        ? 'Generate a gate pass to create your first record.'
                                        : 'Try clearing the search or date filter.'}
                                </p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-muted/50 border-b border-border text-left">
                                            <th className="px-5 py-3.5 font-semibold text-muted-foreground whitespace-nowrap">#</th>
                                            <th className="px-5 py-3.5 font-semibold text-muted-foreground whitespace-nowrap">Student</th>
                                            <th className="px-5 py-3.5 font-semibold text-muted-foreground whitespace-nowrap">Class</th>
                                            <th className="px-5 py-3.5 font-semibold text-muted-foreground whitespace-nowrap">SR No.</th>
                                            <th className="px-5 py-3.5 font-semibold text-muted-foreground whitespace-nowrap">Authorized By</th>
                                            <th className="px-5 py-3.5 font-semibold text-muted-foreground whitespace-nowrap">Reason</th>
                                            <th className="px-5 py-3.5 font-semibold text-muted-foreground whitespace-nowrap">Date</th>
                                            <th className="px-5 py-3.5 font-semibold text-muted-foreground whitespace-nowrap">Time Out</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredRecords.map((record, idx) => (
                                            <tr
                                                key={record.id}
                                                className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors"
                                            >
                                                <td className="px-5 py-3.5 text-muted-foreground font-mono text-xs">{idx + 1}</td>
                                                <td className="px-5 py-3.5 font-semibold">{record.student_name}</td>
                                                <td className="px-5 py-3.5">
                                                    <span className="px-2 py-0.5 bg-primary/10 text-primary rounded-md text-xs font-medium">
                                                        {record.student_class || '-'}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-3.5 font-mono text-xs text-muted-foreground">{record.sr_no || '-'}</td>
                                                <td className="px-5 py-3.5">
                                                    <div className="font-medium">{record.parent_name || '-'}</div>
                                                    {record.parent_contact && (
                                                        <div className="text-xs text-muted-foreground">{record.parent_contact}</div>
                                                    )}
                                                </td>
                                                <td className="px-5 py-3.5 text-muted-foreground max-w-[200px] truncate" title={record.reason}>
                                                    {record.reason || '-'}
                                                </td>
                                                <td className="px-5 py-3.5 whitespace-nowrap font-medium">
                                                    {formatDate(record.pass_date)}
                                                </td>
                                                <td className="px-5 py-3.5 whitespace-nowrap">
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-50 text-orange-600 border border-orange-100">
                                                        {record.pass_time}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Print View Component (Only visible to the browser printer) */}
            {activeTab === 'generate' && selectedStudent && (
                <GatePassPrintLayout data={gatePassData} />
            )}

        </AppShell>
    );
}
