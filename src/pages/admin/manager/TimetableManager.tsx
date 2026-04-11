/*
 * ╔══════════════════════════════════════════════════════════════╗
 * ║       S.C.M. CHILDREN ACADEMY — TIMETABLE MANAGER           ║
 * ║    Admin-side timetable builder, substitute manager & print  ║
 * ╠══════════════════════════════════════════════════════════════╣
 *
 * SQL MIGRATIONS (run in Supabase SQL Editor):
 *
 * CREATE TABLE IF NOT EXISTS timetable_slots (
 *   id BIGSERIAL PRIMARY KEY,
 *   class TEXT NOT NULL,
 *   section TEXT DEFAULT 'A',
 *   day_of_week SMALLINT NOT NULL,
 *   period_number SMALLINT NOT NULL,
 *   subject TEXT NOT NULL,
 *   teacher_id BIGINT REFERENCES teacher_registrations(id),
 *   room TEXT,
 *   created_at TIMESTAMPTZ DEFAULT NOW(),
 *   updated_at TIMESTAMPTZ DEFAULT NOW(),
 *   UNIQUE(class, section, day_of_week, period_number)
 * );
 *
 * CREATE TABLE IF NOT EXISTS period_timings (
 *   id BIGSERIAL PRIMARY KEY,
 *   period_number SMALLINT NOT NULL UNIQUE,
 *   label TEXT NOT NULL,
 *   start_time TIME NOT NULL,
 *   end_time TIME NOT NULL,
 *   type TEXT DEFAULT 'class',
 *   created_at TIMESTAMPTZ DEFAULT NOW()
 * );
 *
 * CREATE TABLE IF NOT EXISTS substitute_assignments (
 *   id BIGSERIAL PRIMARY KEY,
 *   date DATE NOT NULL,
 *   original_teacher_id BIGINT REFERENCES teacher_registrations(id),
 *   substitute_teacher_id BIGINT REFERENCES teacher_registrations(id),
 *   timetable_slot_id BIGINT REFERENCES timetable_slots(id),
 *   reason TEXT,
 *   created_at TIMESTAMPTZ DEFAULT NOW(),
 *   UNIQUE(date, timetable_slot_id)
 * );
 *
 * INSERT INTO period_timings (period_number, label, start_time, end_time, type) VALUES
 *   (1, '1st Period', '08:00', '08:35', 'class'),
 *   (2, '2nd Period', '08:35', '09:10', 'class'),
 *   (3, '3rd Period', '09:10', '09:45', 'class'),
 *   (4, '4th Period', '09:45', '10:20', 'class'),
 *   (0, 'Recess',     '10:20', '10:50', 'recess'),
 *   (5, '5th Period', '10:50', '11:25', 'class'),
 *   (6, '6th Period', '11:25', '12:00', 'class'),
 *   (7, '7th Period', '12:00', '12:35', 'class'),
 *   (8, '8th Period', '12:35', '13:10', 'class');
 *
 * ╚══════════════════════════════════════════════════════════════╝
 */

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import AppShell from '@/components/layout/AppShell';
import { supabase } from '@/config/supabaseClient';
import {
    CalendarDays, Clock, UserCheck, Printer, Loader2, Save, X,
    AlertTriangle, ChevronDown, Search, UserX, ArrowRightLeft, Plus, Trash2, Check
} from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────

const TIMETABLE_CLASSES = [
    'NUR A', 'NUR B', 'LKG A', 'LKG B', 'UKG A', 'UKG B',
    'ONE A', 'ONE B', 'TWO A', 'TWO B', 'THREE A', 'THREE B',
    'FOUR A', 'FOUR B', 'FIVE A', 'FIVE B', 'SIX A', 'SIX B',
    'SEVEN A', 'SEVEN B', 'EIGHT A', 'EIGHT B', 'NINE', 'TEN'
];

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Color palette for subjects
const SUBJECT_COLORS: Record<string, string> = {};
const COLOR_PALETTE = [
    'bg-blue-50 border-blue-200 text-blue-800',
    'bg-emerald-50 border-emerald-200 text-emerald-800',
    'bg-violet-50 border-violet-200 text-violet-800',
    'bg-amber-50 border-amber-200 text-amber-800',
    'bg-rose-50 border-rose-200 text-rose-800',
    'bg-cyan-50 border-cyan-200 text-cyan-800',
    'bg-orange-50 border-orange-200 text-orange-800',
    'bg-indigo-50 border-indigo-200 text-indigo-800',
    'bg-pink-50 border-pink-200 text-pink-800',
    'bg-teal-50 border-teal-200 text-teal-800',
    'bg-lime-50 border-lime-200 text-lime-800',
    'bg-fuchsia-50 border-fuchsia-200 text-fuchsia-800',
];

let colorIndex = 0;
function getSubjectColor(subject: string): string {
    const key = subject.toUpperCase().trim();
    if (!SUBJECT_COLORS[key]) {
        SUBJECT_COLORS[key] = COLOR_PALETTE[colorIndex % COLOR_PALETTE.length];
        colorIndex++;
    }
    return SUBJECT_COLORS[key];
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Teacher {
    id: number;
    teacher_name: string;
    designation: string;
    main_subject_taught: string;
}

interface SlotData {
    id?: number;
    subject: string;
    teacher_id: number | null;
    teacher_name?: string;
    room?: string;
}

interface PeriodTimingRow {
    id?: number;
    period_number: number;
    label: string;
    start_time: string;
    end_time: string;
    type: string;
}

interface SubstituteRow {
    id?: number;
    date: string;
    original_teacher_id: number;
    substitute_teacher_id: number;
    timetable_slot_id: number;
    reason: string;
    original_teacher_name?: string;
    substitute_teacher_name?: string;
    slot_class?: string;
    slot_subject?: string;
    slot_period?: number;
    slot_day?: number;
}

type TabKey = 'class' | 'teacher' | 'substitute' | 'timings';

// ─── Main Component ──────────────────────────────────────────────────────────

export default function TimetableManager() {
    const [activeTab, setActiveTab] = useState<TabKey>('class');
    const [teachers, setTeachers] = useState<Teacher[]>([]);
    const [periodTimings, setPeriodTimings] = useState<PeriodTimingRow[]>([]);
    const [loadingInit, setLoadingInit] = useState(true);

    useEffect(() => {
        const init = async () => {
            const [{ data: tData }, { data: pData }] = await Promise.all([
                supabase.from('teacher_registrations').select('id, teacher_name, designation, main_subject_taught').order('teacher_name'),
                supabase.from('period_timings').select('*').order('period_number')
            ]);
            setTeachers((tData || []) as Teacher[]);
            setPeriodTimings((pData || []) as PeriodTimingRow[]);
            setLoadingInit(false);
        };
        init();
    }, []);

    const tabs = [
        { id: 'class' as TabKey, label: 'Class Timetable', icon: CalendarDays },
        { id: 'teacher' as TabKey, label: 'Teacher View', icon: UserCheck },
        { id: 'substitute' as TabKey, label: 'Substitutes', icon: ArrowRightLeft },
        { id: 'timings' as TabKey, label: 'Period Timings', icon: Clock },
    ];

    return (
        <AppShell title="Timetable Manager" subtitle="Build class timetables, manage substitutes & bell timings">
            {/* Tab Header */}
            <div className="flex bg-muted/50 p-1.5 rounded-2xl w-fit mb-6 overflow-x-auto">
                {tabs.map(t => (
                    <button
                        key={t.id}
                        onClick={() => setActiveTab(t.id)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
                            activeTab === t.id
                                ? 'bg-card text-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                        }`}
                    >
                        <t.icon className="w-4 h-4" />
                        {t.label}
                    </button>
                ))}
            </div>

            {loadingInit ? (
                <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 text-primary/40 animate-spin" /></div>
            ) : (
                <>
                    {activeTab === 'class' && <ClassTimetableTab teachers={teachers} periodTimings={periodTimings} />}
                    {activeTab === 'teacher' && <TeacherViewTab teachers={teachers} periodTimings={periodTimings} />}
                    {activeTab === 'substitute' && <SubstituteTab teachers={teachers} periodTimings={periodTimings} />}
                    {activeTab === 'timings' && <PeriodTimingsTab timings={periodTimings} onUpdate={setPeriodTimings} />}
                </>
            )}
        </AppShell>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 1: CLASS TIMETABLE BUILDER
// ═══════════════════════════════════════════════════════════════════════════════

function ClassTimetableTab({ teachers, periodTimings }: { teachers: Teacher[]; periodTimings: PeriodTimingRow[] }) {
    const [selectedClass, setSelectedClass] = useState(TIMETABLE_CLASSES[0]);
    const [slots, setSlots] = useState<Record<string, SlotData>>({});
    const [allSlots, setAllSlots] = useState<any[]>([]); // all slots for clash detection
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

    // Modal state
    const [editingCell, setEditingCell] = useState<{ day: number; period: number } | null>(null);
    const [editSubject, setEditSubject] = useState('');
    const [editTeacherId, setEditTeacherId] = useState<number | null>(null);
    const [editRoom, setEditRoom] = useState('');

    const printRef = useRef<HTMLDivElement>(null);

    const classPeriods = periodTimings.filter(p => p.type === 'class').sort((a, b) => a.period_number - b.period_number);
    const recessPeriod = periodTimings.find(p => p.type === 'recess');

    // Load slots for selected class
    useEffect(() => {
        loadSlots();
    }, [selectedClass]);

    // Load ALL slots once for clash detection
    useEffect(() => {
        const loadAll = async () => {
            const { data } = await supabase.from('timetable_slots').select('*, teacher_registrations(teacher_name)');
            setAllSlots(data || []);
        };
        loadAll();
    }, []);

    const loadSlots = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('timetable_slots')
            .select('*, teacher_registrations(teacher_name)')
            .eq('class', selectedClass);

        if (!error && data) {
            const map: Record<string, SlotData> = {};
            data.forEach((s: any) => {
                const key = `${s.day_of_week}-${s.period_number}`;
                map[key] = {
                    id: s.id,
                    subject: s.subject,
                    teacher_id: s.teacher_id,
                    teacher_name: s.teacher_registrations?.teacher_name || '',
                    room: s.room || ''
                };
            });
            setSlots(map);
        }
        setLoading(false);
    };

    const openModal = (day: number, period: number) => {
        const key = `${day}-${period}`;
        const existing = slots[key];
        setEditingCell({ day, period });
        setEditSubject(existing?.subject || '');
        setEditTeacherId(existing?.teacher_id || null);
        setEditRoom(existing?.room || '');
    };

    const closeModal = () => {
        setEditingCell(null);
        setEditSubject('');
        setEditTeacherId(null);
        setEditRoom('');
    };

    // Check for teacher clashes
    const getClashWarning = useCallback((teacherId: number | null, day: number, period: number): string | null => {
        if (!teacherId) return null;
        const clash = allSlots.find(s =>
            s.teacher_id === teacherId &&
            s.day_of_week === day &&
            s.period_number === period &&
            s.class !== selectedClass
        );
        if (clash) {
            return `⚠️ This teacher is already assigned to ${clash.class} in this period.`;
        }
        return null;
    }, [allSlots, selectedClass]);

    const handleSaveSlot = async () => {
        if (!editingCell || !editSubject.trim()) return;
        const { day, period } = editingCell;
        const key = `${day}-${period}`;
        const existing = slots[key];

        setSaving(true);
        setMsg(null);

        const payload = {
            class: selectedClass,
            section: selectedClass.includes(' ') ? selectedClass.split(' ').pop() || '' : '',
            day_of_week: day,
            period_number: period,
            subject: editSubject.trim().toUpperCase(),
            teacher_id: editTeacherId,
            room: editRoom.trim() || null,
            updated_at: new Date().toISOString()
        };

        let error;
        if (existing?.id) {
            ({ error } = await supabase.from('timetable_slots').update(payload).eq('id', existing.id));
        } else {
            ({ error } = await supabase.from('timetable_slots').insert([payload]));
        }

        if (error) {
            setMsg({ type: 'err', text: 'Error: ' + error.message });
        } else {
            setMsg({ type: 'ok', text: 'Slot saved!' });
            setTimeout(() => setMsg(null), 2000);
            await loadSlots();
            // Refresh all slots for clash detection
            const { data } = await supabase.from('timetable_slots').select('*, teacher_registrations(teacher_name)');
            setAllSlots(data || []);
        }
        setSaving(false);
        closeModal();
    };

    const handleDeleteSlot = async () => {
        if (!editingCell) return;
        const key = `${editingCell.day}-${editingCell.period}`;
        const existing = slots[key];
        if (!existing?.id) { closeModal(); return; }

        setSaving(true);
        const { error } = await supabase.from('timetable_slots').delete().eq('id', existing.id);
        if (!error) {
            await loadSlots();
            const { data } = await supabase.from('timetable_slots').select('*, teacher_registrations(teacher_name)');
            setAllSlots(data || []);
        }
        setSaving(false);
        closeModal();
    };

    const handlePrint = () => {
        const printContent = printRef.current;
        if (!printContent) return;
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;
        printWindow.document.write(`
            <html><head><title>Timetable - ${selectedClass}</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Segoe UI', Arial, sans-serif; }
                body { padding: 20px; }
                .print-header { text-align: center; margin-bottom: 20px; }
                .print-header h1 { font-size: 18px; font-weight: bold; text-transform: uppercase; }
                .print-header p { font-size: 12px; color: #666; margin-top: 4px; }
                table { width: 100%; border-collapse: collapse; font-size: 11px; }
                th, td { border: 1.5px solid #333; padding: 6px 4px; text-align: center; vertical-align: top; }
                th { background: #f0f0f0; font-weight: bold; font-size: 10px; text-transform: uppercase; }
                .subject { font-weight: bold; font-size: 11px; }
                .teacher { font-size: 9px; color: #555; }
                .recess { background: #fff9e6; font-style: italic; font-weight: bold; }
                .day-col { font-weight: bold; background: #f5f5f5; width: 70px; }
            </style></head><body>
            <div class="print-header">
                <h1>S.C.M. Children Academy</h1>
                <p>Class Timetable — ${selectedClass} | Academic Session 2025-2026</p>
            </div>
            ${printContent.innerHTML}
            <script>window.onload = function() { window.print(); window.close(); }</script>
            </body></html>
        `);
        printWindow.document.close();
    };

    // Get teacher workload: total periods per week
    const teacherWorkload = useMemo(() => {
        const counts: Record<number, number> = {};
        allSlots.forEach(s => {
            if (s.teacher_id) {
                counts[s.teacher_id] = (counts[s.teacher_id] || 0) + 1;
            }
        });
        return counts;
    }, [allSlots]);

    const clashWarning = editingCell ? getClashWarning(editTeacherId, editingCell.day, editingCell.period) : null;

    return (
        <div className="animate-fade-in space-y-6">
            {/* Controls */}
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                <div className="flex items-center gap-3">
                    <label className="text-sm font-semibold text-muted-foreground">Class:</label>
                    <div className="relative">
                        <select
                            value={selectedClass}
                            onChange={e => setSelectedClass(e.target.value)}
                            className="appearance-none bg-card border border-border rounded-xl px-4 py-2.5 pr-10 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer"
                        >
                            {TIMETABLE_CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    </div>
                </div>
                <button
                    onClick={handlePrint}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                >
                    <Printer className="w-4 h-4" /> Print Timetable
                </button>
            </div>

            {msg && (
                <div className={`p-3 rounded-xl text-sm font-medium flex items-center gap-2 ${msg.type === 'ok' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                    {msg.type === 'ok' && <Check className="w-4 h-4" />}
                    {msg.text}
                </div>
            )}

            {/* Timetable Grid */}
            {loading ? (
                <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 text-primary/40 animate-spin" /></div>
            ) : (
                <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                        <div ref={printRef}>
                            <table className="w-full border-collapse min-w-[900px]">
                                <thead>
                                    <tr className="bg-muted/30">
                                        <th className="px-4 py-3 text-xs font-bold text-muted-foreground tracking-wider uppercase border-b border-r border-border w-20">Day</th>
                                        {classPeriods.map(p => (
                                            <th key={p.period_number} className="px-2 py-3 text-xs font-bold text-muted-foreground tracking-wider uppercase border-b border-r border-border text-center">
                                                <div>{p.label}</div>
                                                <div className="text-[10px] font-normal mt-0.5 opacity-60">
                                                    {formatTime(p.start_time)} - {formatTime(p.end_time)}
                                                </div>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {[1, 2, 3, 4, 5, 6].map(day => {
                                        // Find where recess fits
                                        const recessAfterPeriod = recessPeriod ? classPeriods.findIndex(p => {
                                            const nextRecess = periodTimings.find(pt => pt.type === 'recess');
                                            if (!nextRecess) return false;
                                            return p.end_time === nextRecess.start_time;
                                        }) : -1;

                                        return (
                                            <tr key={day} className="hover:bg-muted/5 transition-colors">
                                                <td className="px-4 py-3 border-b border-r border-border">
                                                    <span className="text-sm font-bold text-foreground">{DAY_SHORT[day - 1]}</span>
                                                </td>
                                                {classPeriods.map((p, idx) => {
                                                    const key = `${day}-${p.period_number}`;
                                                    const slot = slots[key];
                                                    const colorClass = slot?.subject ? getSubjectColor(slot.subject) : '';

                                                    return (
                                                        <React.Fragment key={p.period_number}>
                                                            <td
                                                                onClick={() => openModal(day, p.period_number)}
                                                                className={`px-2 py-2 border-b border-r border-border text-center cursor-pointer transition-all hover:ring-2 hover:ring-primary/20 hover:ring-inset min-w-[110px] ${slot?.subject ? '' : 'bg-muted/10'}`}
                                                            >
                                                                {slot?.subject ? (
                                                                    <div className={`rounded-lg border px-2 py-1.5 ${colorClass}`}>
                                                                        <div className="font-bold text-xs uppercase truncate">{slot.subject}</div>
                                                                        {slot.teacher_name && (
                                                                            <div className="text-[10px] mt-0.5 opacity-70 truncate">{slot.teacher_name}</div>
                                                                        )}
                                                                    </div>
                                                                ) : (
                                                                    <div className="text-muted-foreground/30 text-xs py-2">
                                                                        <Plus className="w-3.5 h-3.5 mx-auto" />
                                                                    </div>
                                                                )}
                                                            </td>
                                                            {/* Insert recess column after the correct period */}
                                                            {recessAfterPeriod === idx && recessPeriod && day === 1 && (
                                                                <td
                                                                    rowSpan={6}
                                                                    className="px-1 py-2 border-b border-r border-border text-center bg-amber-50/50 w-8 align-middle"
                                                                    style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
                                                                >
                                                                    <span className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">
                                                                        Recess ({formatTime(recessPeriod.start_time)}-{formatTime(recessPeriod.end_time)})
                                                                    </span>
                                                                </td>
                                                            )}
                                                        </React.Fragment>
                                                    );
                                                })}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit/Assign Modal */}
            {editingCell && (
                <>
                    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={closeModal} />
                    <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card border border-border rounded-3xl shadow-2xl z-50 w-full max-w-md p-6 animate-fade-in">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h3 className="text-lg font-bold text-foreground">
                                    {slots[`${editingCell.day}-${editingCell.period}`]?.subject ? 'Edit Slot' : 'Assign Slot'}
                                </h3>
                                <p className="text-sm text-muted-foreground mt-0.5">
                                    {DAY_NAMES[editingCell.day - 1]} · Period {editingCell.period} · {selectedClass}
                                </p>
                            </div>
                            <button onClick={closeModal} className="p-2 rounded-xl hover:bg-muted transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Subject *</label>
                                <input
                                    type="text"
                                    value={editSubject}
                                    onChange={e => setEditSubject(e.target.value)}
                                    placeholder="e.g. ENGLISH, MATHS, SCIENCE"
                                    className="w-full px-4 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 uppercase"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Teacher</label>
                                <select
                                    value={editTeacherId ?? ''}
                                    onChange={e => setEditTeacherId(e.target.value ? Number(e.target.value) : null)}
                                    className="w-full px-4 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                                >
                                    <option value="">— No teacher assigned —</option>
                                    {teachers.map(t => (
                                        <option key={t.id} value={t.id}>
                                            {t.teacher_name} ({t.designation || 'Teacher'})
                                            {teacherWorkload[t.id] ? ` [${teacherWorkload[t.id]} periods/wk]` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {clashWarning && (
                                <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium">
                                    <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                    <span>{clashWarning}</span>
                                </div>
                            )}

                            <div>
                                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Room / Lab (optional)</label>
                                <input
                                    type="text"
                                    value={editRoom}
                                    onChange={e => setEditRoom(e.target.value)}
                                    placeholder="e.g. Room 12, Computer Lab"
                                    className="w-full px-4 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
                            {slots[`${editingCell.day}-${editingCell.period}`]?.id ? (
                                <button
                                    onClick={handleDeleteSlot}
                                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                                >
                                    <Trash2 className="w-4 h-4" /> Remove
                                </button>
                            ) : <div />}
                            <div className="flex gap-2">
                                <button onClick={closeModal} className="px-4 py-2.5 rounded-xl text-sm font-medium bg-muted hover:bg-muted/80 transition-colors">
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveSlot}
                                    disabled={saving || !editSubject.trim()}
                                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold gradient-primary text-white shadow-lg shadow-primary/20 hover:opacity-90 transition-all disabled:opacity-50"
                                >
                                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    Save
                                </button>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 2: TEACHER VIEW
// ═══════════════════════════════════════════════════════════════════════════════

function TeacherViewTab({ teachers, periodTimings }: { teachers: Teacher[]; periodTimings: PeriodTimingRow[] }) {
    const [selectedTeacher, setSelectedTeacher] = useState<number | null>(teachers[0]?.id || null);
    const [slots, setSlots] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const printRef = useRef<HTMLDivElement>(null);

    const classPeriods = periodTimings.filter(p => p.type === 'class').sort((a, b) => a.period_number - b.period_number);
    const recessPeriod = periodTimings.find(p => p.type === 'recess');

    useEffect(() => {
        if (selectedTeacher) loadTeacherSlots();
    }, [selectedTeacher]);

    const loadTeacherSlots = async () => {
        setLoading(true);
        const { data } = await supabase
            .from('timetable_slots')
            .select('*')
            .eq('teacher_id', selectedTeacher);
        setSlots(data || []);
        setLoading(false);
    };

    const selectedTeacherData = teachers.find(t => t.id === selectedTeacher);

    const filteredTeachers = teachers.filter(t =>
        t.teacher_name.toLowerCase().includes(search.toLowerCase())
    );

    const getSlot = (day: number, period: number) => {
        return slots.find(s => s.day_of_week === day && s.period_number === period);
    };

    const totalPeriods = slots.length;
    const freePeriodsPerDay = (day: number) => {
        const assigned = slots.filter(s => s.day_of_week === day).length;
        return classPeriods.length - assigned;
    };

    const handlePrint = () => {
        const printContent = printRef.current;
        if (!printContent || !selectedTeacherData) return;
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;
        printWindow.document.write(`
            <html><head><title>Timetable - ${selectedTeacherData.teacher_name}</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Segoe UI', Arial, sans-serif; }
                body { padding: 20px; }
                .print-header { text-align: center; margin-bottom: 20px; }
                .print-header h1 { font-size: 18px; font-weight: bold; text-transform: uppercase; }
                .print-header p { font-size: 12px; color: #666; margin-top: 4px; }
                table { width: 100%; border-collapse: collapse; font-size: 11px; }
                th, td { border: 1.5px solid #333; padding: 6px 4px; text-align: center; vertical-align: middle; }
                th { background: #f0f0f0; font-weight: bold; font-size: 10px; text-transform: uppercase; }
                .subject { font-weight: bold; }
                .class-name { font-size: 9px; color: #555; }
                .free { color: #999; font-style: italic; }
            </style></head><body>
            <div class="print-header">
                <h1>S.C.M. Children Academy</h1>
                <p>Teacher Timetable — ${selectedTeacherData.teacher_name} (${selectedTeacherData.designation}) | ${totalPeriods} Periods/Week</p>
            </div>
            ${printContent.innerHTML}
            <script>window.onload = function() { window.print(); window.close(); }</script>
            </body></html>
        `);
        printWindow.document.close();
    };

    return (
        <div className="animate-fade-in space-y-6">
            <div className="flex flex-col lg:flex-row gap-4">
                {/* Teacher selector */}
                <div className="w-full lg:w-72 bg-card border border-border rounded-2xl p-4 shadow-sm">
                    <div className="relative mb-3">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Search teacher..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                    </div>
                    <div className="max-h-[500px] overflow-y-auto space-y-1 pr-1">
                        {filteredTeachers.map(t => (
                            <button
                                key={t.id}
                                onClick={() => setSelectedTeacher(t.id)}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${
                                    selectedTeacher === t.id
                                        ? 'bg-primary/10 text-primary border border-primary/20'
                                        : 'hover:bg-muted text-foreground'
                                }`}
                            >
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                                    selectedTeacher === t.id ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'
                                }`}>
                                    {t.teacher_name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold truncate">{t.teacher_name}</p>
                                    <p className="text-[10px] text-muted-foreground">{t.designation || 'Teacher'}</p>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Teacher timetable grid */}
                <div className="flex-1">
                    {selectedTeacherData && (
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="text-lg font-bold">{selectedTeacherData.teacher_name}</h3>
                                <p className="text-sm text-muted-foreground">
                                    {selectedTeacherData.designation} · {totalPeriods} periods/week · {selectedTeacherData.main_subject_taught || 'N/A'}
                                </p>
                            </div>
                            <button
                                onClick={handlePrint}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                            >
                                <Printer className="w-4 h-4" /> Print
                            </button>
                        </div>
                    )}

                    {loading ? (
                        <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 text-primary/40 animate-spin" /></div>
                    ) : (
                        <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-sm">
                            <div className="overflow-x-auto">
                                <div ref={printRef}>
                                    <table className="w-full border-collapse min-w-[800px]">
                                        <thead>
                                            <tr className="bg-muted/30">
                                                <th className="px-4 py-3 text-xs font-bold text-muted-foreground tracking-wider uppercase border-b border-r border-border w-20">Day</th>
                                                {classPeriods.map(p => (
                                                    <th key={p.period_number} className="px-2 py-3 text-xs font-bold text-muted-foreground tracking-wider uppercase border-b border-r border-border text-center">
                                                        {p.label}
                                                    </th>
                                                ))}
                                                <th className="px-3 py-3 text-xs font-bold text-muted-foreground tracking-wider uppercase border-b border-border text-center w-16">Free</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {[1, 2, 3, 4, 5, 6].map(day => (
                                                <tr key={day} className="hover:bg-muted/5 transition-colors">
                                                    <td className="px-4 py-3 border-b border-r border-border">
                                                        <span className="text-sm font-bold">{DAY_SHORT[day - 1]}</span>
                                                    </td>
                                                    {classPeriods.map(p => {
                                                        const slot = getSlot(day, p.period_number);
                                                        const colorClass = slot ? getSubjectColor(slot.subject) : '';
                                                        return (
                                                            <td key={p.period_number} className={`px-2 py-2 border-b border-r border-border text-center min-w-[100px] ${!slot ? 'bg-emerald-50/30' : ''}`}>
                                                                {slot ? (
                                                                    <div className={`rounded-lg border px-2 py-1.5 ${colorClass}`}>
                                                                        <div className="font-bold text-xs uppercase truncate">{slot.subject}</div>
                                                                        <div className="text-[10px] mt-0.5 opacity-70 truncate">{slot.class}</div>
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-xs text-emerald-500 font-medium">FREE</span>
                                                                )}
                                                            </td>
                                                        );
                                                    })}
                                                    <td className="px-3 py-3 border-b border-border text-center">
                                                        <span className={`text-sm font-bold ${freePeriodsPerDay(day) > 0 ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                                                            {freePeriodsPerDay(day)}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 3: SUBSTITUTE MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

function SubstituteTab({ teachers, periodTimings }: { teachers: Teacher[]; periodTimings: PeriodTimingRow[] }) {
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [absentTeachers, setAbsentTeachers] = useState<{ id: number; name: string }[]>([]);
    const [affectedSlots, setAffectedSlots] = useState<any[]>([]);
    const [substitutes, setSubstitutes] = useState<Record<number, { teacher_id: number; reason: string }>>({});
    const [existingSubs, setExistingSubs] = useState<any[]>([]);
    const [allSlots, setAllSlots] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

    const classPeriods = periodTimings.filter(p => p.type === 'class');

    useEffect(() => {
        loadData();
    }, [date]);

    const loadData = async () => {
        setLoading(true);
        setMsg(null);

        // Get current day of week (1=Mon ... 6=Sat)
        const d = new Date(date + 'T00:00:00');
        const jsDay = d.getDay(); // 0=Sun, 1=Mon...6=Sat
        const dayOfWeek = jsDay === 0 ? 7 : jsDay; // Convert to 1-7

        // Fetch absent teachers from staff_attendance for this date
        const { data: attData } = await supabase
            .from('staff_attendance')
            .select('staff_id, status')
            .eq('date', date)
            .in('status', ['Absent', 'Leave']);

        const absentIds: number[] = [];
        const absentList: { id: number; name: string }[] = [];
        (attData || []).forEach((a: any) => {
            // staff_id format is 'tr_<id>' for teachers
            if (a.staff_id?.startsWith('tr_')) {
                const id = parseInt(a.staff_id.replace('tr_', ''));
                const teacher = teachers.find(t => t.id === id);
                if (teacher) {
                    absentIds.push(id);
                    absentList.push({ id, name: teacher.teacher_name });
                }
            }
        });
        setAbsentTeachers(absentList);

        // Fetch timetable slots for affected teachers on this day
        if (absentIds.length > 0 && dayOfWeek <= 6) {
            const { data: slotsData } = await supabase
                .from('timetable_slots')
                .select('*')
                .in('teacher_id', absentIds)
                .eq('day_of_week', dayOfWeek);
            setAffectedSlots(slotsData || []);
        } else {
            setAffectedSlots([]);
        }

        // Fetch all slots for this day (to determine who is free)
        if (dayOfWeek <= 6) {
            const { data: allSlotsData } = await supabase
                .from('timetable_slots')
                .select('*')
                .eq('day_of_week', dayOfWeek);
            setAllSlots(allSlotsData || []);
        }

        // Fetch existing substitute assignments for this date
        const { data: existingData } = await supabase
            .from('substitute_assignments')
            .select('*')
            .eq('date', date);
        setExistingSubs(existingData || []);

        // Pre-fill substitutes from existing records
        const preFilledSubs: Record<number, { teacher_id: number; reason: string }> = {};
        (existingData || []).forEach((sub: any) => {
            preFilledSubs[sub.timetable_slot_id] = {
                teacher_id: sub.substitute_teacher_id,
                reason: sub.reason || ''
            };
        });
        setSubstitutes(preFilledSubs);

        setLoading(false);
    };

    // Find available (free) teachers for a specific period
    const getAvailableTeachers = (periodNumber: number, excludeTeacherId: number): Teacher[] => {
        const busyTeacherIds = allSlots
            .filter(s => s.period_number === periodNumber)
            .map(s => s.teacher_id)
            .filter(Boolean);

        // Also exclude absent teachers
        const absentIds = absentTeachers.map(a => a.id);

        return teachers.filter(t =>
            t.id !== excludeTeacherId &&
            !busyTeacherIds.includes(t.id) &&
            !absentIds.includes(t.id)
        );
    };

    const handleSave = async () => {
        setSaving(true);
        setMsg(null);

        try {
            // Delete existing subs for this date then insert new
            await supabase.from('substitute_assignments').delete().eq('date', date);

            const payload = Object.entries(substitutes)
                .filter(([_, val]) => val.teacher_id)
                .map(([slotId, val]) => {
                    const slot = affectedSlots.find(s => s.id === parseInt(slotId));
                    return {
                        date,
                        original_teacher_id: slot?.teacher_id,
                        substitute_teacher_id: val.teacher_id,
                        timetable_slot_id: parseInt(slotId),
                        reason: val.reason || ''
                    };
                });

            if (payload.length > 0) {
                const { error } = await supabase.from('substitute_assignments').insert(payload);
                if (error) throw error;
            }

            setMsg({ type: 'ok', text: `${payload.length} substitute(s) saved!` });
            setTimeout(() => setMsg(null), 3000);
        } catch (err: any) {
            setMsg({ type: 'err', text: 'Error: ' + err.message });
        } finally {
            setSaving(false);
        }
    };

    const getPeriodLabel = (periodNum: number) => {
        const p = periodTimings.find(pt => pt.period_number === periodNum);
        return p ? p.label : `Period ${periodNum}`;
    };

    return (
        <div className="animate-fade-in space-y-6 max-w-4xl">
            {/* Date Selector */}
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-3 bg-card p-3 rounded-2xl border border-border shadow-sm">
                    <CalendarDays className="w-5 h-5 text-primary" />
                    <input
                        type="date"
                        value={date}
                        onChange={e => setDate(e.target.value)}
                        className="bg-transparent border-none text-sm font-semibold focus:outline-none"
                    />
                </div>
                <div className="text-sm text-muted-foreground">
                    {DAY_NAMES[new Date(date + 'T00:00:00').getDay() === 0 ? 6 : new Date(date + 'T00:00:00').getDay() - 1] || 'Sunday'}
                </div>
            </div>

            {msg && (
                <div className={`p-3 rounded-xl text-sm font-medium flex items-center gap-2 ${msg.type === 'ok' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                    {msg.type === 'ok' && <Check className="w-4 h-4" />}
                    {msg.text}
                </div>
            )}

            {loading ? (
                <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 text-primary/40 animate-spin" /></div>
            ) : (
                <>
                    {/* Absent Teachers Summary */}
                    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
                        <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                            <UserX className="w-4 h-4 text-red-500" />
                            Absent Teachers ({absentTeachers.length})
                        </h3>
                        {absentTeachers.length === 0 ? (
                            <p className="text-sm text-muted-foreground py-2">No teachers marked absent/leave for this date. Mark attendance in Staff Attendance first.</p>
                        ) : (
                            <div className="flex flex-wrap gap-2">
                                {absentTeachers.map(t => (
                                    <div key={t.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm font-medium">
                                        <UserX className="w-3.5 h-3.5" />
                                        {t.name}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Affected Slots & Substitute Assignment */}
                    {affectedSlots.length > 0 && (
                        <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
                            <div className="p-4 border-b border-border bg-amber-50/50 flex items-center justify-between">
                                <h3 className="text-sm font-bold text-amber-800 flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4" />
                                    Affected Periods ({affectedSlots.length})
                                </h3>
                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold gradient-primary text-white shadow-lg shadow-primary/20 hover:opacity-90 transition-all disabled:opacity-50"
                                >
                                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    Save Substitutes
                                </button>
                            </div>

                            <div className="divide-y divide-border">
                                {affectedSlots.map(slot => {
                                    const absentTeacher = absentTeachers.find(t => t.id === slot.teacher_id);
                                    const available = getAvailableTeachers(slot.period_number, slot.teacher_id);
                                    const sub = substitutes[slot.id];

                                    return (
                                        <div key={slot.id} className="p-4 flex flex-col md:flex-row md:items-center gap-4">
                                            {/* Slot info */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-muted text-muted-foreground uppercase">
                                                        {getPeriodLabel(slot.period_number)}
                                                    </span>
                                                    <span className={`text-xs font-bold px-2 py-0.5 rounded border ${getSubjectColor(slot.subject)}`}>
                                                        {slot.subject}
                                                    </span>
                                                    <span className="text-xs text-muted-foreground">{slot.class}</span>
                                                </div>
                                                <p className="text-xs text-red-500 font-medium">
                                                    Absent: {absentTeacher?.name}
                                                </p>
                                            </div>

                                            {/* Substitute selector */}
                                            <div className="flex items-center gap-3 flex-1">
                                                <ArrowRightLeft className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                                <select
                                                    value={sub?.teacher_id ?? ''}
                                                    onChange={e => setSubstitutes(prev => ({
                                                        ...prev,
                                                        [slot.id]: { ...prev[slot.id], teacher_id: Number(e.target.value), reason: prev[slot.id]?.reason || '' }
                                                    }))}
                                                    className="flex-1 px-3 py-2 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                                                >
                                                    <option value="">— Select Substitute —</option>
                                                    {available.map(t => (
                                                        <option key={t.id} value={t.id}>{t.teacher_name}</option>
                                                    ))}
                                                </select>
                                                <input
                                                    type="text"
                                                    placeholder="Reason..."
                                                    value={sub?.reason || ''}
                                                    onChange={e => setSubstitutes(prev => ({
                                                        ...prev,
                                                        [slot.id]: { ...prev[slot.id], teacher_id: prev[slot.id]?.teacher_id || 0, reason: e.target.value }
                                                    }))}
                                                    className="w-32 px-3 py-2 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 4: PERIOD TIMINGS EDITOR
// ═══════════════════════════════════════════════════════════════════════════════

function PeriodTimingsTab({ timings, onUpdate }: { timings: PeriodTimingRow[]; onUpdate: (t: PeriodTimingRow[]) => void }) {
    const [rows, setRows] = useState<PeriodTimingRow[]>(timings.map(t => ({ ...t })));
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

    const hasChanges = JSON.stringify(rows) !== JSON.stringify(timings);

    const updateRow = (idx: number, field: keyof PeriodTimingRow, value: any) => {
        setRows(prev => {
            const copy = [...prev];
            copy[idx] = { ...copy[idx], [field]: value };
            return copy;
        });
    };

    const addRow = () => {
        const maxPeriod = Math.max(...rows.map(r => r.period_number), 0);
        setRows(prev => [...prev, {
            period_number: maxPeriod + 1,
            label: `${maxPeriod + 1}${getOrdinalSuffix(maxPeriod + 1)} Period`,
            start_time: '08:00',
            end_time: '08:35',
            type: 'class'
        }]);
    };

    const removeRow = (idx: number) => {
        setRows(prev => prev.filter((_, i) => i !== idx));
    };

    const handleSave = async () => {
        setSaving(true);
        setMsg(null);

        try {
            // Delete all existing timings and re-insert
            await supabase.from('period_timings').delete().neq('id', 0); // delete all

            const payload = rows.map(r => ({
                period_number: r.period_number,
                label: r.label,
                start_time: r.start_time,
                end_time: r.end_time,
                type: r.type
            }));

            const { data, error } = await supabase.from('period_timings').insert(payload).select();
            if (error) throw error;

            setMsg({ type: 'ok', text: 'Period timings saved!' });
            onUpdate(data as PeriodTimingRow[]);
            setRows((data as PeriodTimingRow[]).map(t => ({ ...t })));
            setTimeout(() => setMsg(null), 3000);
        } catch (err: any) {
            setMsg({ type: 'err', text: 'Error: ' + err.message });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="animate-fade-in max-w-3xl">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-lg font-bold">Bell Schedule</h3>
                    <p className="text-sm text-muted-foreground">Configure period timings for the entire school.</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={addRow}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-muted hover:bg-muted/80 transition-colors"
                    >
                        <Plus className="w-4 h-4" /> Add Period
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving || !hasChanges}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-lg whitespace-nowrap ${
                            hasChanges
                                ? 'gradient-primary text-white shadow-primary/25 hover:opacity-90'
                                : 'bg-muted text-muted-foreground shadow-none cursor-not-allowed border border-border'
                        }`}
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        {saving ? 'Saving...' : 'Save Timings'}
                    </button>
                </div>
            </div>

            {msg && (
                <div className={`p-3 rounded-xl text-sm font-medium flex items-center gap-2 mb-6 ${msg.type === 'ok' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                    {msg.type === 'ok' && <Check className="w-4 h-4" />}
                    {msg.text}
                </div>
            )}

            <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-muted/30 border-b border-border">
                                <th className="px-4 py-3 text-xs font-bold text-muted-foreground tracking-wider uppercase text-left w-16">#</th>
                                <th className="px-4 py-3 text-xs font-bold text-muted-foreground tracking-wider uppercase text-left">Label</th>
                                <th className="px-4 py-3 text-xs font-bold text-muted-foreground tracking-wider uppercase text-center w-28">Start</th>
                                <th className="px-4 py-3 text-xs font-bold text-muted-foreground tracking-wider uppercase text-center w-28">End</th>
                                <th className="px-4 py-3 text-xs font-bold text-muted-foreground tracking-wider uppercase text-center w-32">Type</th>
                                <th className="px-4 py-3 text-xs font-bold text-muted-foreground tracking-wider uppercase text-center w-16"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {rows.sort((a, b) => {
                                // Sort: recess/assembly by start_time among class periods
                                if (a.type !== 'class' && b.type !== 'class') return a.start_time.localeCompare(b.start_time);
                                if (a.type !== 'class') return a.start_time < b.start_time ? -1 : 1;
                                if (b.type !== 'class') return b.start_time < a.start_time ? 1 : -1;
                                return a.period_number - b.period_number;
                            }).map((row, idx) => {
                                const isBreak = row.type !== 'class';
                                return (
                                    <tr key={idx} className={`transition-colors ${isBreak ? 'bg-amber-50/30' : 'hover:bg-muted/5'}`}>
                                        <td className="px-4 py-3">
                                            <input
                                                type="number"
                                                value={row.period_number}
                                                onChange={e => updateRow(idx, 'period_number', parseInt(e.target.value) || 0)}
                                                className="w-12 px-2 py-1.5 bg-background border border-border rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary/30"
                                            />
                                        </td>
                                        <td className="px-4 py-3">
                                            <input
                                                type="text"
                                                value={row.label}
                                                onChange={e => updateRow(idx, 'label', e.target.value)}
                                                className="w-full px-3 py-1.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                                            />
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <input
                                                type="time"
                                                value={row.start_time}
                                                onChange={e => updateRow(idx, 'start_time', e.target.value)}
                                                className="px-2 py-1.5 bg-background border border-border rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary/30"
                                            />
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <input
                                                type="time"
                                                value={row.end_time}
                                                onChange={e => updateRow(idx, 'end_time', e.target.value)}
                                                className="px-2 py-1.5 bg-background border border-border rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary/30"
                                            />
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <select
                                                value={row.type}
                                                onChange={e => updateRow(idx, 'type', e.target.value)}
                                                className="px-2 py-1.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                                            >
                                                <option value="class">Class</option>
                                                <option value="recess">Recess</option>
                                                <option value="assembly">Assembly</option>
                                            </select>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <button
                                                onClick={() => removeRow(idx)}
                                                className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(time: string): string {
    if (!time) return '';
    const [h, m] = time.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour = h % 12 || 12;
    return `${hour}:${m.toString().padStart(2, '0')} ${ampm}`;
}

function getOrdinalSuffix(n: number): string {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return s[(v - 20) % 10] || s[v] || s[0];
}
