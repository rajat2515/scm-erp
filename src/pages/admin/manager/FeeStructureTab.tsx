/*
 * ╔══════════════════════════════════════════════════════════════╗
 * ║          FEE STRUCTURE EDITOR — SQL MIGRATION                ║
 * ╠══════════════════════════════════════════════════════════════╣
 *
 * -- 1. Tuition fee structure per class (likely already exists)
 * CREATE TABLE IF NOT EXISTS fee_structure (
 *   id           BIGSERIAL PRIMARY KEY,
 *   class        TEXT NOT NULL UNIQUE,
 *   monthly_fee  NUMERIC(10,2) NOT NULL DEFAULT 0,
 *   updated_at   TIMESTAMPTZ DEFAULT NOW()
 * );
 *
 * -- 2. Transport villages with monthly rates
 * CREATE TABLE IF NOT EXISTS transport_villages (
 *   id            BIGSERIAL PRIMARY KEY,
 *   village_name  TEXT NOT NULL UNIQUE,
 *   monthly_rate  NUMERIC(10, 2) NOT NULL DEFAULT 0,
 *   updated_at    TIMESTAMPTZ DEFAULT NOW()
 * );
 *
 * -- 3. Seed default transport villages (adjust as needed)
 * INSERT INTO transport_villages (village_name, monthly_rate) VALUES
 *   ('Haldaur',           550),
 *   ('Kumarpura',         600),
 *   ('Garhi',             600),
 *   ('Takipura',          650),
 *   ('Bilai',             650),
 *   ('Nagal',             650),
 *   ('Bisat',             650),
 *   ('Nabada',            650),
 *   ('Mukranpur',         650),
 *   ('Sumalkhedi',        650),
 *   ('Baldhiya',          650),
 *   ('Kukra',             600),
 *   ('Inampura',          600),
 *   ('Sultanpur',         650),
 *   ('Safipur Bhogan',    650),
 *   ('Salmtabad',         650),
 *   ('Shanager',          650),
 *   ('Khairabad',         650),
 *   ('Ladanpur',          650),
 *   ('Moh-Raisan',        550)
 * ON CONFLICT (village_name) DO NOTHING;
 *
 * ╚══════════════════════════════════════════════════════════════╝
 */

import React, { useEffect, useState } from 'react';
import { supabase } from '@/config/supabaseClient';
import {
    Loader2, Plus, Pencil, Trash2, CheckCircle2, AlertCircle, X, Save, Bus, BookOpen,
} from 'lucide-react';
import Swal from 'sweetalert2';

/* ─── Types ───────────────────────────────────────────────── */
interface FeeRow { id: number; class: string; monthly_fee: number; }
interface VillageRow { id: number; village_name: string; monthly_rate: number; }

const fmtINR = (n: number) => '₹' + Number(n).toLocaleString('en-IN');

/* ═══════════════════════════════════════════════════════════ */
/*  TUITION FEE SECTION                                       */
/* ═══════════════════════════════════════════════════════════ */
const TuitionSection: React.FC = () => {
    const [rows, setRows] = useState<FeeRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [editId, setEditId] = useState<number | null>(null);
    const [editVal, setEditVal] = useState('');
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

    // Add new row state
    const [addClass, setAddClass] = useState('');
    const [addFee, setAddFee] = useState('');
    const [addMode, setAddMode] = useState(false);

    const load = async () => {
        setLoading(true);
        const { data } = await supabase.from('fee_structure').select('*').order('class');
        setRows(data || []);
        setLoading(false);
    };

    useEffect(() => { load(); }, []);

    const showMsg = (type: 'ok' | 'err', text: string) => {
        setMsg({ type, text });
        setTimeout(() => setMsg(null), 3000);
    };

    const startEdit = (r: FeeRow) => { setEditId(r.id); setEditVal(String(r.monthly_fee)); };
    const cancelEdit = () => { setEditId(null); setEditVal(''); };

    const saveEdit = async (id: number) => {
        const fee = parseFloat(editVal);
        if (isNaN(fee) || fee < 0) { showMsg('err', 'Enter a valid fee amount.'); return; }
        setSaving(true);
        const { error } = await supabase.from('fee_structure').update({ monthly_fee: fee }).eq('id', id);
        if (error) showMsg('err', error.message);
        else { showMsg('ok', 'Fee updated successfully!'); await load(); }
        setEditId(null);
        setSaving(false);
    };

    const deleteRow = async (id: number) => {
        const result = await Swal.fire({
            title: 'Delete Fee Entry?',
            text: 'Are you sure you want to delete this fee entry?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Yes, delete it!'
        });
        if (result.isConfirmed) {
            await supabase.from('fee_structure').delete().eq('id', id);
            await load();
            Swal.fire('Deleted!', 'Fee entry has been removed.', 'success');
        }
    };

    const handleAdd = async () => {
        if (!addClass.trim()) { showMsg('err', 'Enter class name.'); return; }
        const fee = parseFloat(addFee);
        if (isNaN(fee) || fee < 0) { showMsg('err', 'Enter a valid fee amount.'); return; }
        setSaving(true);
        const { error } = await supabase.from('fee_structure').insert({ class: addClass.trim().toUpperCase(), monthly_fee: fee });
        if (error) showMsg('err', error.message);
        else {
            showMsg('ok', 'Class fee added!');
            setAddClass(''); setAddFee(''); setAddMode(false);
            await load();
        }
        setSaving(false);
    };

    return (
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/20">
                <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-primary" />
                    <h3 className="font-semibold text-sm">Tuition Fee — Per Class / Month</h3>
                </div>
                <button
                    onClick={() => setAddMode(v => !v)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium gradient-primary text-white hover:opacity-90 transition-all"
                >
                    <Plus className="w-3.5 h-3.5" /> Add Class
                </button>
            </div>

            {msg && (
                <div className={`flex items-center gap-2 px-5 py-2.5 text-sm border-b ${msg.type === 'ok' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                    {msg.type === 'ok' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                    {msg.text}
                </div>
            )}

            {/* Add new row form */}
            {addMode && (
                <div className="flex items-end gap-3 px-5 py-3 bg-blue-50/50 border-b border-blue-200/50">
                    <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">Class</label>
                        <input
                            value={addClass}
                            onChange={e => setAddClass(e.target.value)}
                            placeholder="e.g. ONE A"
                            className="w-28 px-3 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">Monthly Fee (₹)</label>
                        <input
                            type="number"
                            value={addFee}
                            onChange={e => setAddFee(e.target.value)}
                            placeholder="0"
                            className="w-32 px-3 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                    </div>
                    <button onClick={handleAdd} disabled={saving}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl gradient-primary text-white text-xs font-medium hover:opacity-90 disabled:opacity-60">
                        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save
                    </button>
                    <button onClick={() => { setAddMode(false); setAddClass(''); setAddFee(''); }}
                        className="p-2 rounded-xl border border-border text-muted-foreground hover:text-foreground">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {loading ? (
                <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
            ) : rows.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm">No fee structure defined yet. Click "Add Class" to begin.</div>
            ) : (
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-border bg-muted/10">
                            <th className="text-left px-5 py-3 font-medium text-muted-foreground">Class</th>
                            <th className="text-right px-5 py-3 font-medium text-muted-foreground">Monthly Fee</th>
                            <th className="text-right px-5 py-3 font-medium text-muted-foreground">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {rows.map(r => (
                            <tr key={r.id} className="hover:bg-muted/20 transition-colors">
                                <td className="px-5 py-3 font-semibold">{r.class}</td>
                                <td className="px-5 py-3 text-right">
                                    {editId === r.id ? (
                                        <input
                                            type="number"
                                            value={editVal}
                                            onChange={e => setEditVal(e.target.value)}
                                            className="w-28 px-2 py-1 rounded-lg border border-primary text-right text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 ml-auto"
                                            autoFocus
                                        />
                                    ) : (
                                        <span className="font-bold text-primary">{fmtINR(r.monthly_fee)}</span>
                                    )}
                                </td>
                                <td className="px-5 py-3">
                                    <div className="flex items-center justify-end gap-1.5">
                                        {editId === r.id ? (
                                            <>
                                                <button onClick={() => saveEdit(r.id)} disabled={saving}
                                                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg gradient-primary text-white text-xs font-medium hover:opacity-90 disabled:opacity-60">
                                                    {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Save
                                                </button>
                                                <button onClick={cancelEdit} className="px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground">Cancel</button>
                                            </>
                                        ) : (
                                            <>
                                                <button onClick={() => startEdit(r)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Edit">
                                                    <Pencil className="w-3.5 h-3.5" />
                                                </button>
                                                <button onClick={() => deleteRow(r.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors" title="Delete">
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════ */
/*  TRANSPORT VILLAGES SECTION                                */
/* ═══════════════════════════════════════════════════════════ */
const TransportVillagesSection: React.FC = () => {
    const [rows, setRows] = useState<VillageRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [editId, setEditId] = useState<number | null>(null);
    const [editName, setEditName] = useState('');
    const [editRate, setEditRate] = useState('');
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

    // Add new row state
    const [addName, setAddName] = useState('');
    const [addRate, setAddRate] = useState('');
    const [addMode, setAddMode] = useState(false);

    const load = async () => {
        setLoading(true);
        const { data } = await supabase.from('transport_villages').select('*').order('village_name');
        setRows(data || []);
        setLoading(false);
    };

    useEffect(() => { load(); }, []);

    const showMsg = (type: 'ok' | 'err', text: string) => {
        setMsg({ type, text });
        setTimeout(() => setMsg(null), 3500);
    };

    const startEdit = (r: VillageRow) => {
        setEditId(r.id); setEditName(r.village_name); setEditRate(String(r.monthly_rate));
    };
    const cancelEdit = () => { setEditId(null); setEditName(''); setEditRate(''); };

    const saveEdit = async (id: number) => {
        if (!editName.trim()) { showMsg('err', 'Village name cannot be empty.'); return; }
        const rate = parseFloat(editRate);
        if (isNaN(rate) || rate < 0) { showMsg('err', 'Enter a valid rate.'); return; }
        setSaving(true);
        const { error } = await supabase.from('transport_villages')
            .update({ village_name: editName.trim(), monthly_rate: rate }).eq('id', id);
        if (error) showMsg('err', error.message);
        else { showMsg('ok', 'Village updated!'); await load(); }
        setEditId(null);
        setSaving(false);
    };

    const deleteRow = async (id: number) => {
        const result = await Swal.fire({
            title: 'Delete Village?',
            text: 'Are you sure you want to delete this village? This cannot be undone.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Yes, delete it!'
        });
        if (result.isConfirmed) {
            await supabase.from('transport_villages').delete().eq('id', id);
            await load();
            Swal.fire('Deleted!', 'Village has been removed.', 'success');
        }
    };

    const handleAdd = async () => {
        if (!addName.trim()) { showMsg('err', 'Enter a village name.'); return; }
        const rate = parseFloat(addRate);
        if (isNaN(rate) || rate < 0) { showMsg('err', 'Enter a valid monthly rate.'); return; }
        setSaving(true);
        const { error } = await supabase.from('transport_villages')
            .insert({ village_name: addName.trim(), monthly_rate: rate });
        if (error) showMsg('err', error.message);
        else {
            showMsg('ok', 'Village added!');
            setAddName(''); setAddRate(''); setAddMode(false);
            await load();
        }
        setSaving(false);
    };

    return (
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/20">
                <div className="flex items-center gap-2">
                    <Bus className="w-4 h-4 text-primary" />
                    <h3 className="font-semibold text-sm">Transport Villages & Monthly Rates</h3>
                </div>
                <button
                    onClick={() => setAddMode(v => !v)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium gradient-primary text-white hover:opacity-90 transition-all"
                >
                    <Plus className="w-3.5 h-3.5" /> Add Village
                </button>
            </div>

            {msg && (
                <div className={`flex items-center gap-2 px-5 py-2.5 text-sm border-b ${msg.type === 'ok' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                    {msg.type === 'ok' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                    {msg.text}
                </div>
            )}

            {/* Notice about SQL migration */}
            {!loading && rows.length === 0 && (
                <div className="flex items-start gap-3 px-5 py-4 bg-amber-50 border-b border-amber-200 text-sm text-amber-800">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="font-semibold">Table not seeded yet</p>
                        <p className="text-xs mt-0.5">Run the SQL migration from the comment at the top of <code>FeeStructureTab.tsx</code> in Supabase SQL Editor, then add villages here. Once added, village auto-detection in Transport Fee will work automatically.</p>
                    </div>
                </div>
            )}

            {/* Add new row form */}
            {addMode && (
                <div className="flex items-end gap-3 px-5 py-3 bg-blue-50/50 border-b border-blue-200/50 flex-wrap">
                    <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">Village / Route Name</label>
                        <input
                            value={addName}
                            onChange={e => setAddName(e.target.value)}
                            placeholder="e.g. Haldaur"
                            className="w-44 px-3 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">Monthly Rate (₹)</label>
                        <input
                            type="number"
                            value={addRate}
                            onChange={e => setAddRate(e.target.value)}
                            placeholder="0"
                            className="w-32 px-3 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                    </div>
                    <button onClick={handleAdd} disabled={saving}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl gradient-primary text-white text-xs font-medium hover:opacity-90 disabled:opacity-60">
                        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save
                    </button>
                    <button onClick={() => { setAddMode(false); setAddName(''); setAddRate(''); }}
                        className="p-2 rounded-xl border border-border text-muted-foreground hover:text-foreground">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {loading ? (
                <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
            ) : rows.length === 0 && !addMode ? (
                <div className="text-center py-8 text-muted-foreground text-sm">No villages added yet. Click "Add Village" to add the first one.</div>
            ) : (
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-border bg-muted/10">
                            <th className="text-left px-5 py-3 font-medium text-muted-foreground">#</th>
                            <th className="text-left px-5 py-3 font-medium text-muted-foreground">Village / Route</th>
                            <th className="text-right px-5 py-3 font-medium text-muted-foreground">Monthly Rate</th>
                            <th className="text-right px-5 py-3 font-medium text-muted-foreground">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {rows.map((r, i) => (
                            <tr key={r.id} className="hover:bg-muted/20 transition-colors">
                                <td className="px-5 py-3 text-muted-foreground text-xs">{i + 1}</td>
                                <td className="px-5 py-3">
                                    {editId === r.id ? (
                                        <input
                                            value={editName}
                                            onChange={e => setEditName(e.target.value)}
                                            className="w-44 px-2 py-1 rounded-lg border border-primary text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                                            autoFocus
                                        />
                                    ) : (
                                        <span className="font-medium">{r.village_name}</span>
                                    )}
                                </td>
                                <td className="px-5 py-3 text-right">
                                    {editId === r.id ? (
                                        <input
                                            type="number"
                                            value={editRate}
                                            onChange={e => setEditRate(e.target.value)}
                                            className="w-28 px-2 py-1 rounded-lg border border-primary text-right text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 ml-auto"
                                        />
                                    ) : (
                                        <span className="font-bold text-primary">{fmtINR(r.monthly_rate)}</span>
                                    )}
                                </td>
                                <td className="px-5 py-3">
                                    <div className="flex items-center justify-end gap-1.5">
                                        {editId === r.id ? (
                                            <>
                                                <button onClick={() => saveEdit(r.id)} disabled={saving}
                                                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg gradient-primary text-white text-xs font-medium hover:opacity-90 disabled:opacity-60">
                                                    {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Save
                                                </button>
                                                <button onClick={cancelEdit} className="px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground">Cancel</button>
                                            </>
                                        ) : (
                                            <>
                                                <button onClick={() => startEdit(r)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Edit">
                                                    <Pencil className="w-3.5 h-3.5" />
                                                </button>
                                                <button onClick={() => deleteRow(r.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors" title="Delete">
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════ */
/*  MAIN EXPORT                                               */
/* ═══════════════════════════════════════════════════════════ */
const FeeStructureTab: React.FC = () => {
    return (
        <div className="space-y-6 max-w-3xl">
            <p className="text-sm text-muted-foreground">
                Manage class-wise monthly tuition fees and transport village rates. Changes here are reflected immediately across the system.
            </p>
            <TuitionSection />
            <TransportVillagesSection />
        </div>
    );
};

export default FeeStructureTab;
