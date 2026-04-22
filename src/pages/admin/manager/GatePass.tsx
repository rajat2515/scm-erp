import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/config/supabaseClient';
import AppShell from '@/components/layout/AppShell';
import {
    Search, Printer, FileBadge, Loader2, ClipboardList,
    Calendar, X, Trash2, Bluetooth, BluetoothOff, BluetoothConnected, CheckCircle2
} from 'lucide-react';
import Swal from 'sweetalert2';
import type { Student } from '@/types';
import type { GatePassData } from '@/components/print/GatePassPrintLayout';

// ─────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────
const CLASSES = [
    'All', 'Nursery', 'NUR A', 'NUR B', 'LKG', 'LKG A', 'LKG B',
    'UKG', 'UKG A', 'UKG B', 'ONE A', 'ONE B', 'TWO A', 'TWO B',
    'THREE A', 'THREE B', 'FOUR A', 'FOUR B', 'FIVE A', 'FIVE B',
    'SIX A', 'SIX B', 'SEVEN A', 'SEVEN B', 'EIGHT A', 'EIGHT B',
    'NINE', 'TEN', 'TC', 'LS'
];

// Bluetooth service/characteristic UUIDs — covers most ESC/POS BLE printers
const BT_SERVICE = '000018f0-0000-1000-8000-00805f9b34fb';
const BT_CHARACTERISTIC = '00002af1-0000-1000-8000-00805f9b34fb';
// Alternative UUIDs (uncomment if above don't work for your Fronix model)
// const BT_SERVICE        = 'e7810a71-73ae-499d-8c15-faa9aef0c3f2';
// const BT_CHARACTERISTIC = 'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f';

const PRINTER_WIDTH = 32; // characters per line for 80mm at default font

// ─────────────────────────────────────────────
// ESC/POS HELPERS  (outside component — no re-creation on render)
// ─────────────────────────────────────────────
const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

const enc = new TextEncoder();

/** Flatten nested number arrays into a single Uint8Array */
function buildBytes(parts: (number[] | Uint8Array)[]): Uint8Array {
    const flat: number[] = [];
    for (const p of parts) flat.push(...Array.from(p));
    return new Uint8Array(flat);
}

/** Text → bytes */
const tb = (s: string): number[] => Array.from(enc.encode(s));

/** Newline */
const nl = (): number[] => [LF];

/** Dashed separator */
const sep = (w = PRINTER_WIDTH): number[] => [...tb('-'.repeat(w)), LF];

/** Center-pad a string */
const center = (s: string, w = PRINTER_WIDTH): string => {
    const pad = Math.max(0, Math.floor((w - s.length) / 2));
    return ' '.repeat(pad) + s;
};

/** Wrap long text to printer width */
function wrap(text: string, w = PRINTER_WIDTH): number[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let cur = '';
    for (const word of words) {
        const next = cur ? `${cur} ${word}` : word;
        if (next.length > w) { if (cur) lines.push(cur); cur = word; }
        else cur = next;
    }
    if (cur) lines.push(cur);
    return lines.flatMap(l => [...tb(l), LF]);
}

/** Label: Value  (right-aligns value, wraps if needed) */
function labelRow(label: string, value: string, w = PRINTER_WIDTH): number[] {
    const v = value || '-';
    const combined = `${label}: ${v}`;
    if (combined.length <= w) return [...tb(combined), LF];
    // value is too long — put on next line indented
    return [...tb(`${label}:`), LF, ...tb(`  ${v}`), LF];
}

/** Send Uint8Array to BLE characteristic in safe chunks */
async function sendToPrinter(
    characteristic: BluetoothRemoteGATTCharacteristic,
    data: Uint8Array,
    chunkSize = 100
): Promise<void> {
    for (let i = 0; i < data.length; i += chunkSize) {
        await characteristic.writeValue(data.slice(i, i + chunkSize));
        // Small delay between chunks — prevents buffer overflow on cheap BLE printers
        await new Promise(r => setTimeout(r, 20));
    }
}

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────
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

type BtStatus = 'disconnected' | 'connecting' | 'connected' | 'printing';

// ─────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────
export default function GatePass() {
    const [activeTab, setActiveTab] = useState<'generate' | 'records'>('generate');

    // ── Generate tab state ──
    const [students, setStudents] = useState<Student[]>([]);
    const [loadingStudents, setLoadingStudents] = useState(true);
    const [searchStudent, setSearchStudent] = useState('');
    const [searchClass, setSearchClass] = useState('All');
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

    const [parentName, setParentName] = useState('');
    const [parentContact, setParentContact] = useState('');
    const [reasonType, setReasonType] = useState('Doctor Appointment');
    const [customReason, setCustomReason] = useState('');

    const [date, setDate] = useState(new Date().toLocaleDateString('en-GB'));
    const [time, setTime] = useState(
        new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    );

    // ── Records tab state ──
    const [records, setRecords] = useState<GatePassRecord[]>([]);
    const [loadingRecords, setLoadingRecords] = useState(false);
    const [searchRecord, setSearchRecord] = useState('');
    const [filterDate, setFilterDate] = useState('');
    const [recordsError, setRecordsError] = useState('');

    // ── Bluetooth state ──
    const [btStatus, setBtStatus] = useState<BtStatus>('disconnected');
    const [btDeviceName, setBtDeviceName] = useState('');
    const btCharRef = useRef<BluetoothRemoteGATTCharacteristic | null>(null);
    const btDeviceRef = useRef<BluetoothDevice | null>(null);

    // ─────────────────────────────────────────
    // EFFECTS
    // ─────────────────────────────────────────
    // Clock ticker
    useEffect(() => {
        const timer = setInterval(() => {
            const now = new Date();
            setDate(now.toLocaleDateString('en-GB'));
            setTime(now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
        }, 60000);
        return () => clearInterval(timer);
    }, []);

    // Load students
    useEffect(() => {
        (async () => {
            setLoadingStudents(true);
            const { data, error } = await supabase
                .from('students')
                .select('*')
                .eq('status', 'active')
                .order('name');
            if (!error && data) setStudents(data);
            setLoadingStudents(false);
        })();
    }, []);

    // Fetch records when records tab opens
    useEffect(() => {
        if (activeTab === 'records') fetchRecords();
    }, [activeTab]);

    // Cleanup BT on unmount
    useEffect(() => {
        return () => {
            if (btDeviceRef.current?.gatt?.connected) {
                btDeviceRef.current.gatt.disconnect();
            }
        };
    }, []);

    // ─────────────────────────────────────────
    // DATA FUNCTIONS
    // ─────────────────────────────────────────
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

    // ─────────────────────────────────────────
    // STUDENT SELECTION
    // ─────────────────────────────────────────
    const filteredStudents = (searchStudent === '' && searchClass === 'All')
        ? []
        : students.filter(s => {
            const matchSearch =
                searchStudent === '' ||
                s.name.toLowerCase().includes(searchStudent.toLowerCase()) ||
                s.sr_no.toString().includes(searchStudent) ||
                (s.father_name || '').toLowerCase().includes(searchStudent.toLowerCase());
            const matchClass = searchClass === 'All' || s.class === searchClass;
            return matchSearch && matchClass;
        }).slice(0, 5);

    const handleSelectStudent = (student: Student) => {
        setSelectedStudent(student);
        setSearchStudent('');
        setParentName(student.father_name || student.mother_name || '');
        setParentContact(student.phone || student.whatsapp || '');
        setReasonType('Doctor Appointment');
        setCustomReason('');
    };

    const finalReason = reasonType === 'Other (Please specify)' ? customReason : reasonType;

    // ─────────────────────────────────────────
    // GATE PASS DATA (must be BEFORE handlePrint)
    // ─────────────────────────────────────────
    const gatePassData: GatePassData = {
        studentName: selectedStudent?.name || '',
        studentClass: selectedStudent?.class || '',
        srNo: selectedStudent?.sr_no?.toString() || '',
        placeOfLiving: selectedStudent?.address || '',
        parentName,
        parentContact,
        reason: finalReason,
        date,
        time,
    };

    // ─────────────────────────────────────────
    // BLUETOOTH — CONNECT
    // ─────────────────────────────────────────
    const handleBtConnect = async () => {
        if (!('bluetooth' in navigator)) {
            Swal.fire('Not Supported', 'Web Bluetooth is not supported in this browser.\nUse Chrome on Android.', 'error');
            return;
        }

        // If already connected — disconnect
        if (btStatus === 'connected' && btDeviceRef.current?.gatt?.connected) {
            btDeviceRef.current.gatt.disconnect();
            btCharRef.current = null;
            btDeviceRef.current = null;
            setBtStatus('disconnected');
            setBtDeviceName('');
            return;
        }

        setBtStatus('connecting');
        try {
            const device = await (navigator as any).bluetooth.requestDevice({
                filters: [
                    { services: [BT_SERVICE] },
                    { namePrefix: 'Fronix' },
                    { namePrefix: 'RPP' },
                    { namePrefix: 'PTP' },
                    { namePrefix: 'MTP' },
                    { namePrefix: 'Printer' },
                ],
                optionalServices: [BT_SERVICE],
            });

            btDeviceRef.current = device;

            // Handle unexpected disconnection
            device.addEventListener('gattserverdisconnected', () => {
                btCharRef.current = null;
                setBtStatus('disconnected');
                setBtDeviceName('');
            });

            const server = await device.gatt!.connect();
            const service = await server.getPrimaryService(BT_SERVICE);
            const char = await service.getCharacteristic(BT_CHARACTERISTIC);

            btCharRef.current = char;
            setBtDeviceName(device.name || 'Thermal Printer');
            setBtStatus('connected');

            Swal.fire({
                title: 'Connected!',
                text: `Paired with ${device.name || 'Thermal Printer'}`,
                icon: 'success',
                timer: 1800,
                showConfirmButton: false,
            });
        } catch (err: any) {
            setBtStatus('disconnected');
            if (err.name !== 'NotFoundError') {
                Swal.fire('Connection Failed', err.message || 'Could not connect to printer.', 'error');
            }
        }
    };

    // ─────────────────────────────────────────
    // BLUETOOTH — PRINT
    // ─────────────────────────────────────────
    const handlePrint = async () => {
        if (!selectedStudent) return;

        // ── Check BT is connected ──
        if (!btCharRef.current || !btDeviceRef.current?.gatt?.connected) {
            Swal.fire({
                title: 'Printer Not Connected',
                html: 'Tap the <b>Connect Printer</b> button at the top of the page first, then try printing again.',
                icon: 'warning',
                confirmButtonText: 'OK',
            });
            return;
        }

        setBtStatus('printing');

        try {
            const W = PRINTER_WIDTH;
            const gp = gatePassData;

            // ── Build ESC/POS receipt ──
            const receipt = buildBytes([
                // Initialize printer
                [ESC, 0x40],

                // ── HEADER: School name (double size, centered) ──
                [ESC, 0x61, 0x01],              // align center
                [ESC, 0x45, 0x01],              // bold on
                [GS, 0x21, 0x11],              // double width + height
                tb('SCM CHILDREN'), nl(),
                tb('ACADEMY'), nl(),
                [GS, 0x21, 0x00],              // normal size
                [ESC, 0x45, 0x00],              // bold off
                tb('Aff: 2132374 | Code: 81858'), nl(),
                tb('HALDAUR, BIJNOR'), nl(),

                sep(W),

                // ── TITLE ──
                [ESC, 0x45, 0x01],
                [GS, 0x21, 0x01],              // double height only
                tb(center('*** GATE PASS ***', W)), nl(),
                [GS, 0x21, 0x00],
                [ESC, 0x45, 0x00],
                tb(center('Early Departure', W)), nl(),

                sep(W),

                // ── DATE / TIME ──
                [ESC, 0x61, 0x00],              // align left
                labelRow('Date', gp.date, W),
                labelRow('Time', gp.time, W),

                sep(W),

                // ── STUDENT INFO ──
                [ESC, 0x45, 0x01],
                tb('STUDENT INFO'), nl(),
                [ESC, 0x45, 0x00],
                labelRow('Name', gp.studentName, W),
                labelRow('Class', gp.studentClass, W),
                labelRow('SR No.', gp.srNo, W),
                ...(gp.placeOfLiving ? [labelRow('Address', gp.placeOfLiving, W)] : []),

                sep(W),

                // ── GUARDIAN INFO ──
                [ESC, 0x45, 0x01],
                tb('GUARDIAN INFO'), nl(),
                [ESC, 0x45, 0x00],
                labelRow('Name', gp.parentName, W),
                labelRow('Contact', gp.parentContact, W),

                sep(W),

                // ── REASON ──
                [ESC, 0x45, 0x01],
                tb('REASON:'), nl(),
                [ESC, 0x45, 0x00],
                wrap(gp.reason || '-', W),

                sep(W),

                // ── SIGNATURES ──
                tb('Parent      Security      Admin'), nl(),
                tb('________   _________   ________'), nl(),

                sep(W),

                // ── FOOTER ──
                [ESC, 0x61, 0x01],
                tb('SCM ERP - Valid for above date/time'), nl(),

                // Feed & cut
                [LF, LF, LF, LF],
                [GS, 0x56, 0x41, 0x10],        // partial cut (ignored if unsupported)
            ]);

            await sendToPrinter(btCharRef.current, receipt);

            // ── Save to Supabase after successful print ──
            const today = new Date();
            await supabase.from('gate_pass_records').insert({
                student_id: selectedStudent.sr_no,
                student_name: selectedStudent.name,
                student_class: selectedStudent.class || '',
                sr_no: selectedStudent.sr_no.toString(),
                parent_name: parentName,
                parent_contact: parentContact,
                reason: finalReason,
                pass_date: today.toISOString().split('T')[0],
                pass_time: time,
            });

            setBtStatus('connected');
            Swal.fire({ title: 'Printed!', icon: 'success', timer: 1500, showConfirmButton: false });
            if (activeTab === 'generate') fetchRecords();

        } catch (err: any) {
            setBtStatus('connected');
            Swal.fire('Print Failed', err.message || 'Could not send data to printer.', 'error');
        }
    };

    // ─────────────────────────────────────────
    // RECORDS
    // ─────────────────────────────────────────
    const filteredRecords = records.filter(r => {
        const matchSearch =
            searchRecord === '' ||
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

    const handleDeleteRecord = async (id: string) => {
        const result = await Swal.fire({
            title: 'Delete record?',
            text: 'Are you sure you want to delete this gate pass record? This cannot be undone.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Yes, delete it!',
        });

        if (result.isConfirmed) {
            try {
                const { error } = await supabase.from('gate_pass_records').delete().eq('id', id);
                if (error) throw error;
                setRecords(prev => prev.filter(r => r.id !== id));
                Swal.fire({ title: 'Deleted!', text: 'Record deleted.', icon: 'success', timer: 1800, showConfirmButton: false });
            } catch (err: any) {
                Swal.fire('Error!', 'Failed to delete: ' + err.message, 'error');
            }
        }
    };

    // ─────────────────────────────────────────
    // BT STATUS UI HELPERS
    // ─────────────────────────────────────────
    const btButtonLabel = () => {
        if (btStatus === 'connecting') return 'Connecting…';
        if (btStatus === 'printing') return 'Printing…';
        if (btStatus === 'connected') return btDeviceName || 'Connected';
        return 'Connect Printer';
    };

    const btButtonIcon = () => {
        if (btStatus === 'connecting' || btStatus === 'printing')
            return <Loader2 className="w-4 h-4 animate-spin" />;
        if (btStatus === 'connected')
            return <BluetoothConnected className="w-4 h-4" />;
        return <Bluetooth className="w-4 h-4" />;
    };

    const btButtonClass = () => {
        const base = 'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-all';
        if (btStatus === 'connected')
            return `${base} bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100`;
        if (btStatus === 'connecting' || btStatus === 'printing')
            return `${base} bg-blue-50 text-blue-600 border-blue-200 cursor-wait`;
        return `${base} bg-muted/40 text-muted-foreground border-border hover:bg-muted hover:text-foreground`;
    };

    // ─────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────
    return (
        <AppShell title="Gate Pass Management" subtitle="Issue passes and view departure records">

            {/* ── Top bar: Tabs + BT connect button ── */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
                {/* Tabs */}
                <div className="flex bg-muted/50 p-1.5 rounded-2xl">
                    <button
                        onClick={() => setActiveTab('generate')}
                        className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all ${activeTab === 'generate'
                            ? 'bg-card text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                            }`}
                    >
                        <FileBadge className="w-4 h-4" />
                        Generate Pass
                    </button>
                    <button
                        onClick={() => setActiveTab('records')}
                        className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all ${activeTab === 'records'
                            ? 'bg-card text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                            }`}
                    >
                        <ClipboardList className="w-4 h-4" />
                        Pass Records
                    </button>
                </div>

                {/* Bluetooth Connect Button */}
                <button onClick={handleBtConnect} className={btButtonClass()} disabled={btStatus === 'printing'}>
                    {btButtonIcon()}
                    {btButtonLabel()}
                    {btStatus === 'connected' && (
                        <span className="ml-1 text-xs text-emerald-500 font-normal">(tap to disconnect)</span>
                    )}
                </button>
            </div>

            {/* ════════════════════════════════
                TAB: GENERATE PASS
            ════════════════════════════════ */}
            {activeTab === 'generate' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 relative z-10 animate-fade-in">

                    {/* Left: Form */}
                    <div className="space-y-6">

                        {/* Step 1 — Select Student */}
                        <div className="bg-card border border-border rounded-3xl p-6 shadow-sm">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shadow-lg shadow-primary/20">
                                    <Search className="w-5 h-5 text-white" />
                                </div>
                                <h2 className="text-xl font-bold">1. Select Student</h2>
                            </div>

                            <div className="flex gap-3">
                                <div className="relative flex-1">
                                    <input
                                        type="text"
                                        placeholder="Search by name, SR No. or Father's Name…"
                                        value={searchStudent}
                                        onChange={e => setSearchStudent(e.target.value)}
                                        className="w-full pl-4 pr-10 py-3 bg-muted/30 border border-border rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                                    />
                                    {loadingStudents && (
                                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
                                    )}
                                </div>
                                <select
                                    value={searchClass}
                                    onChange={e => setSearchClass(e.target.value)}
                                    className="px-4 py-3 bg-muted/30 border border-border rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all min-w-[120px]"
                                >
                                    {CLASSES.map(c => (
                                        <option key={c} value={c}>{c === 'All' ? 'All Classes' : c}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Dropdown results */}
                            {!selectedStudent && (searchStudent || searchClass !== 'All') && (
                                <div className="mt-2 border border-border rounded-xl bg-card overflow-hidden shadow-lg absolute z-50 left-6 right-6 lg:right-auto lg:w-[calc(50%-2rem)]">
                                    {filteredStudents.length > 0 ? (
                                        filteredStudents.map(student => (
                                            <button
                                                key={student.sr_no}
                                                onClick={() => handleSelectStudent(student)}
                                                className="w-full text-left px-4 py-3 hover:bg-muted border-b border-border last:border-0 transition-colors flex items-center justify-between"
                                            >
                                                <div>
                                                    <div className="font-semibold text-sm">{student.name}</div>
                                                    <div className="text-xs text-muted-foreground">
                                                        Class: {student.class} | Guardian: {student.father_name || 'N/A'}
                                                    </div>
                                                </div>
                                                <span className="text-xs font-mono bg-primary/10 text-primary px-2 py-1 rounded-md">
                                                    SR: {student.sr_no}
                                                </span>
                                            </button>
                                        ))
                                    ) : (
                                        <div className="px-4 py-3 text-sm text-muted-foreground">
                                            No active students found matching "{searchStudent}"
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Selected student chip */}
                            {selectedStudent && (
                                <div className="mt-6 p-4 rounded-2xl bg-primary/5 border border-primary/20 flex items-center justify-between animate-fade-in">
                                    <div>
                                        <div className="text-xs font-semibold text-primary mb-1 uppercase tracking-wider">Selected Student</div>
                                        <div className="font-bold text-lg">{selectedStudent.name}</div>
                                        <div className="text-sm text-muted-foreground">
                                            Class {selectedStudent.class} • SR. {selectedStudent.sr_no}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setSelectedStudent(null)}
                                        className="text-xs font-medium text-red-500 hover:text-red-600 bg-red-50 px-3 py-1.5 rounded-lg border border-red-100 transition-colors"
                                    >
                                        Clear
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Step 2 — Pass Details */}
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
                                        <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                                            Parent / Authorized Person
                                        </label>
                                        <input
                                            type="text"
                                            value={parentName}
                                            onChange={e => setParentName(e.target.value)}
                                            className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                                            Contact Number
                                        </label>
                                        <input
                                            type="text"
                                            value={parentContact}
                                            onChange={e => setParentContact(e.target.value)}
                                            className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                                        Reason for Early Leave
                                    </label>
                                    <select
                                        value={reasonType}
                                        onChange={e => setReasonType(e.target.value)}
                                        className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                                    >
                                        <option>Doctor Appointment</option>
                                        <option>Family Emergency</option>
                                        <option>To Attend Function</option>
                                        <option>Parent Choice</option>
                                        <option>Going Out of Station</option>
                                        <option>Other (Please specify)</option>
                                    </select>
                                </div>

                                {reasonType === 'Other (Please specify)' && (
                                    <div className="animate-fade-in">
                                        <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                                            Specify Reason
                                        </label>
                                        <textarea
                                            rows={2}
                                            value={customReason}
                                            onChange={e => setCustomReason(e.target.value)}
                                            placeholder="Enter specific reason…"
                                            className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                                        />
                                    </div>
                                )}
                            </div>

                            {/* BT status hint inside form */}
                            {btStatus === 'disconnected' && (
                                <div className="mt-4 flex items-center gap-2 text-xs text-amber-600 bg-amber-50 border border-amber-100 px-3 py-2 rounded-xl">
                                    <BluetoothOff className="w-3.5 h-3.5 flex-shrink-0" />
                                    Printer not connected — tap <strong className="mx-1">Connect Printer</strong> at the top before printing.
                                </div>
                            )}
                            {btStatus === 'connected' && (
                                <div className="mt-4 flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 px-3 py-2 rounded-xl">
                                    <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                                    Printer ready: <strong className="ml-1">{btDeviceName}</strong>
                                </div>
                            )}

                            {/* Print button */}
                            <button
                                onClick={handlePrint}
                                disabled={!selectedStudent || btStatus === 'printing'}
                                className={`w-full mt-6 py-3 rounded-xl flex justify-center items-center gap-2 font-bold transition-all shadow-lg ${selectedStudent && btStatus !== 'printing'
                                    ? 'gradient-primary text-white shadow-primary/25 hover:opacity-90 hover:scale-[1.01]'
                                    : 'bg-muted text-muted-foreground shadow-none cursor-not-allowed'
                                    }`}
                            >
                                {btStatus === 'printing'
                                    ? <><Loader2 className="w-5 h-5 animate-spin" /> Printing…</>
                                    : <><Printer className="w-5 h-5" /> Generate &amp; Print Gate Pass</>
                                }
                            </button>
                        </div>
                    </div>

                    {/* Right: Live Preview */}
                    <div className="bg-card border border-border rounded-3xl p-6 shadow-sm hidden lg:flex flex-col">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                                <Printer className="w-5 h-5 text-muted-foreground" />
                            </div>
                            <h2 className="text-xl font-bold">Live Preview</h2>
                            <span className="ml-auto text-xs text-muted-foreground bg-muted px-2 py-1 rounded-lg">
                                Thermal 80mm
                            </span>
                        </div>

                        {/* Thermal receipt preview */}
                        <div className="flex-1 border-2 border-dashed border-border rounded-2xl bg-muted/10 p-4 flex items-start justify-center overflow-y-auto">
                            {!selectedStudent ? (
                                <div className="text-center text-muted-foreground mt-16">
                                    <FileBadge className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                    <p>Select a student to preview</p>
                                </div>
                            ) : (
                                /* Simulated 80mm thermal receipt */
                                <div
                                    className="bg-white shadow-md text-black animate-fade-in"
                                    style={{
                                        width: '240px',
                                        fontFamily: "'Courier New', Courier, monospace",
                                        fontSize: '11px',
                                        padding: '12px 10px',
                                        lineHeight: '1.6',
                                    }}
                                >
                                    <div style={{ textAlign: 'center', fontWeight: 900, fontSize: '14px' }}>
                                        SCM CHILDREN<br />ACADEMY
                                    </div>
                                    <div style={{ textAlign: 'center', fontSize: '9px' }}>
                                        Aff: 2132374 | Code: 81858<br />HALDAUR, BIJNOR
                                    </div>
                                    <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />
                                    <div style={{ textAlign: 'center', fontWeight: 700, fontSize: '12px' }}>
                                        *** GATE PASS ***
                                    </div>
                                    <div style={{ textAlign: 'center', fontSize: '9px' }}>Early Departure</div>
                                    <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />
                                    <div>Date: {gatePassData.date}</div>
                                    <div>Time: {gatePassData.time}</div>
                                    <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />
                                    <div style={{ fontWeight: 700 }}>STUDENT INFO</div>
                                    <div>Name: {gatePassData.studentName}</div>
                                    <div>Class: {gatePassData.studentClass}</div>
                                    <div>SR No.: {gatePassData.srNo}</div>
                                    <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />
                                    <div style={{ fontWeight: 700 }}>GUARDIAN INFO</div>
                                    <div>Name: {gatePassData.parentName || '-'}</div>
                                    <div>Contact: {gatePassData.parentContact || '-'}</div>
                                    <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />
                                    <div style={{ fontWeight: 700 }}>REASON:</div>
                                    <div>{gatePassData.reason || '-'}</div>
                                    <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', fontWeight: 700 }}>
                                        <span>Parent</span>
                                        <span>Security</span>
                                        <span>Admin</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px' }}>
                                        <span>________</span>
                                        <span>________</span>
                                        <span>________</span>
                                    </div>
                                    <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />
                                    <div style={{ textAlign: 'center', fontSize: '8px', color: '#666' }}>
                                        SCM ERP - Valid for above date/time
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ════════════════════════════════
                TAB: PASS RECORDS
            ════════════════════════════════ */}
            {activeTab === 'records' && (
                <div className="animate-fade-in">

                    {/* Toolbar */}
                    <div className="flex flex-col sm:flex-row gap-3 mb-6">
                        {/* Search */}
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
                                className="pl-9 pr-9 py-2.5 bg-muted/30 border border-border rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                            />
                            {filterDate && (
                                <button onClick={() => setFilterDate('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>

                        {/* Count badge */}
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
                                            <th className="px-5 py-3.5 font-semibold text-muted-foreground whitespace-nowrap text-right">Actions</th>
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
                                                <td className="px-5 py-3.5 whitespace-nowrap text-right">
                                                    <button
                                                        onClick={() => handleDeleteRecord(record.id)}
                                                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
                                                        title="Delete Record"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
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

        </AppShell>
    );
}