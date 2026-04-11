import React, { useState, useEffect } from 'react';
import AppShell from '@/components/layout/AppShell';
import { supabase } from '@/config/supabaseClient';
import { IndianRupee, Plus, Calendar, TrendingUp, Search, X, Loader2, ArrowUpRight, DollarSign, Download } from 'lucide-react';
import Swal from 'sweetalert2';
import { useAuth } from '@/context/AuthContext';
import * as XLSX from 'xlsx';

interface FeeRecord {
    id: number;
    sr_no: number;
    month: string;
    paid_amount: number;
    paid_on: string;
    mode: string;
    created_at: string;
    students: { name: string; class: string } | null;
}

interface OtherIncome {
    id: number;
    date: string;
    amount: number;
    source: string;
    payment_mode: string;
    recorded_by: string | null;
    created_at: string;
}

const SchoolIncome: React.FC = () => {
    const { user } = useAuth();
    const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [feeRecords, setFeeRecords] = useState<FeeRecord[]>([]);
    const [otherIncome, setOtherIncome] = useState<OtherIncome[]>([]);
    const [loading, setLoading] = useState(true);

    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [newIncome, setNewIncome] = useState({ amount: '', source: '', mode: 'Cash' });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchIncomeRecords(selectedDate);
    }, [selectedDate]);

    const fetchIncomeRecords = async (date: string) => {
        setLoading(true);
        try {
            // Fetch Fee Payments for the day
            const { data: feesData, error: feesError } = await supabase
                .from('fee_payments')
                .select('*, students(name, class)')
                .eq('paid_on', date);

            if (feesError) console.error("Error fetching fees:", feesError);

            // Fetch Other Income for the day
            const { data: otherData, error: otherError } = await supabase
                .from('other_income_records')
                .select('*')
                .eq('date', date);

            if (otherError && !otherError.message.includes('relation "other_income_records" does not exist')) {
                 console.error("Error fetching other income:", otherError);
            }

            setFeeRecords((feesData as FeeRecord[]) || []);
            setOtherIncome((otherData as OtherIncome[]) || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleAddOtherIncome = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newIncome.amount || !newIncome.source) return;

        setSaving(true);
        const { error } = await supabase.from('other_income_records').insert({
            date: selectedDate,
            amount: parseFloat(newIncome.amount),
            source: newIncome.source,
            payment_mode: newIncome.mode,
            recorded_by: user?.email || 'Admin'
        });

        setSaving(false);
        if (error) {
            Swal.fire('Error', error.message.includes('relation "other_income_records" does not exist') ? 'Table does not exist. Please run the SQL migration.' : error.message, 'error');
        } else {
            Swal.fire({ title: 'Success', text: 'Other income recorded', icon: 'success', timer: 1500, showConfirmButton: false });
            setIsAddModalOpen(false);
            setNewIncome({ amount: '', source: '', mode: 'Cash' });
            fetchIncomeRecords(selectedDate);
        }
    };

    const handleDeleteOtherIncome = async (id: number) => {
        const confirm = await Swal.fire({
            title: 'Delete Record?',
            text: 'This will permanently delete this income record.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            confirmButtonText: 'Yes, delete'
        });

        if (confirm.isConfirmed) {
            const { error } = await supabase.from('other_income_records').delete().eq('id', id);
            if (error) {
                Swal.fire('Error', error.message, 'error');
            } else {
                fetchIncomeRecords(selectedDate);
            }
        }
    };

    const totalFeeIncome = feeRecords.reduce((sum, r) => sum + Number(r.paid_amount || 0), 0);
    const totalOtherIncome = otherIncome.reduce((sum, r) => sum + Number(r.amount || 0), 0);
    const totalIncome = totalFeeIncome + totalOtherIncome;

    const cashIncome = 
        feeRecords.filter(r => r.mode.toLowerCase().includes('cash')).reduce((sum, r) => sum + Number(r.paid_amount || 0), 0) +
        otherIncome.filter(r => r.payment_mode.toLowerCase().includes('cash')).reduce((sum, r) => sum + Number(r.amount || 0), 0);

    const onlineIncome = totalIncome - cashIncome;

    const handleExportExcel = () => {
        const data = [
            ...feeRecords.map(f => ({
                Date: f.paid_on,
                Type: 'Fee Payment',
                Description: `Student: ${f.students?.name || 'Unknown'} (SR: ${f.sr_no}, Class: ${f.students?.class || '-'}) - Month: ${f.month}`,
                Mode: f.mode,
                Amount: f.paid_amount
            })),
            ...otherIncome.map(o => ({
                Date: o.date,
                Type: 'Other Income',
                Description: o.source,
                Mode: o.payment_mode,
                Amount: o.amount
            }))
        ];

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, `Income_${selectedDate}`);
        XLSX.writeFile(wb, `School_Income_${selectedDate}.xlsx`);
    };

    return (
        <AppShell title="School Income" subtitle="Track and manage daily revenue streams">
            <div className="space-y-6 animate-fade-in">
                
                {/* Header Controls */}
                <div className="flex flex-col sm:flex-row gap-4 justify-between items-end backdrop-blur-md bg-white/40 border border-white/20 p-5 rounded-3xl shadow-sm">
                    <div>
                        <label className="text-xs font-semibold text-muted-foreground mb-1 block select-none">Select Date</label>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={e => setSelectedDate(e.target.value)}
                                className="pl-9 pr-4 py-2 bg-background border border-border rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary/20 shadow-sm transition-all"
                            />
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={handleExportExcel}
                            className="flex items-center gap-2 px-4 py-2 bg-white border border-border text-foreground hover:bg-muted text-sm font-semibold rounded-xl shadow-sm transition-all"
                        >
                            <Download className="w-4 h-4" /> Export
                        </button>
                        <button
                            onClick={() => setIsAddModalOpen(true)}
                            className="flex items-center gap-2 px-4 py-2 gradient-primary text-white text-sm font-semibold rounded-xl shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5"
                        >
                            <Plus className="w-4 h-4" /> Add Other Income
                        </button>
                    </div>
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {[
                        { label: 'Total Daily Income', value: totalIncome, icon: IndianRupee, gradient: 'bg-gradient-to-br from-emerald-400 to-green-600' },
                        { label: 'Fee Collections', value: totalFeeIncome, icon: TrendingUp, gradient: 'bg-gradient-to-br from-blue-400 to-indigo-600' },
                        { label: 'Other Income', value: totalOtherIncome, icon: DollarSign, gradient: 'bg-gradient-to-br from-amber-400 to-orange-500' },
                        { label: 'Cash Collection', value: cashIncome, icon: IndianRupee, gradient: 'bg-gradient-to-br from-purple-400 to-pink-600' },
                    ].map((kpi, i) => (
                        <div key={i} className="relative bg-card rounded-3xl p-6 border border-border/50 shadow-sm overflow-hidden group">
                            <div className={`absolute top-0 right-0 w-32 h-32 ${kpi.gradient} opacity-10 rounded-bl-full transition-transform duration-500 group-hover:scale-110`} />
                            
                            <div className="flex justify-between items-start mb-4">
                                <div className={`p-3 rounded-2xl ${kpi.gradient} shadow-inner`}>
                                    <kpi.icon className="w-6 h-6 text-white" />
                                </div>
                            </div>
                            <div>
                                <h3 className="text-3xl font-bold tracking-tight mb-1 text-foreground">
                                    ₹{kpi.value.toLocaleString('en-IN')}
                                </h3>
                                <p className="text-sm font-medium text-muted-foreground">{kpi.label}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Details Section */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Fee Payments List */}
                    <div className="bg-card border border-border/60 rounded-3xl flex flex-col overflow-hidden shadow-sm">
                        <div className="px-6 py-5 border-b border-border/60 bg-muted/20 flex justify-between items-center">
                            <h3 className="font-bold flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center shadow-inner">
                                    <TrendingUp className="w-4 h-4 text-white" />
                                </div>
                                Fee Collections
                            </h3>
                            <span className="text-xs font-semibold bg-primary/10 text-primary px-3 py-1 rounded-full">
                                {feeRecords.length} Records
                            </span>
                        </div>
                        <div className="p-2 flex-1 overflow-y-auto max-h-[500px] scrollbar-thin">
                            {loading ? (
                                <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
                            ) : feeRecords.length === 0 ? (
                                <div className="p-8 text-center text-sm text-muted-foreground">No fee collections today</div>
                            ) : (
                                <div className="space-y-2">
                                    {feeRecords.map(fee => (
                                        <div key={fee.id} className="p-4 rounded-2xl hover:bg-muted/40 transition-colors border border-transparent hover:border-border/60 flex items-center justify-between group">
                                            <div className="flex flex-col gap-1">
                                                <span className="font-bold text-sm">{fee.students?.name || 'Unknown Student'} <span className="font-normal text-muted-foreground text-xs ml-1">(SR: {fee.sr_no})</span></span>
                                                <span className="text-xs text-muted-foreground">Class {fee.students?.class} • {fee.month}</span>
                                            </div>
                                            <div className="text-right">
                                                <div className="font-bold text-emerald-600">₹{fee.paid_amount.toLocaleString('en-IN')}</div>
                                                <div className="text-[10px] font-semibold text-muted-foreground uppercase">{fee.mode}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Other Income List */}
                    <div className="bg-card border border-border/60 rounded-3xl flex flex-col overflow-hidden shadow-sm">
                        <div className="px-6 py-5 border-b border-border/60 bg-amber-50/30 flex justify-between items-center">
                            <h3 className="font-bold flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full gradient-amber flex items-center justify-center shadow-inner">
                                    <DollarSign className="w-4 h-4 text-white" />
                                </div>
                                Other Income
                            </h3>
                            <span className="text-xs font-semibold bg-amber-100 text-amber-700 px-3 py-1 rounded-full">
                                {otherIncome.length} Records
                            </span>
                        </div>
                        <div className="p-2 flex-1 overflow-y-auto max-h-[500px] scrollbar-thin">
                            {loading ? (
                                <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
                            ) : otherIncome.length === 0 ? (
                                <div className="p-8 text-center text-sm text-muted-foreground">No other income recorded today</div>
                            ) : (
                                <div className="space-y-2">
                                    {otherIncome.map(inc => (
                                        <div key={inc.id} className="p-4 rounded-2xl hover:bg-muted/40 transition-colors border border-transparent hover:border-border/60 flex items-center justify-between group">
                                            <div className="flex flex-col gap-1 max-w-[70%]">
                                                <span className="font-bold text-sm truncate">{inc.source}</span>
                                                <span className="text-xs text-muted-foreground">Recorded by {inc.recorded_by?.split('@')[0]}</span>
                                            </div>
                                            <div className="text-right flex items-center gap-4">
                                                <div>
                                                    <div className="font-bold text-emerald-600">₹{inc.amount.toLocaleString('en-IN')}</div>
                                                    <div className="text-[10px] font-semibold text-muted-foreground uppercase">{inc.payment_mode}</div>
                                                </div>
                                                <button onClick={() => handleDeleteOtherIncome(inc.id)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-50 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-100">
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Add Other Income Modal */}
            {isAddModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsAddModalOpen(false)}></div>
                    <div className="relative bg-card w-full max-w-md rounded-3xl shadow-2xl p-6 border border-white/20 animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold bg-clip-text text-transparent gradient-primary">Add Other Income</h2>
                            <button onClick={() => setIsAddModalOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleAddOtherIncome} className="space-y-4">
                            <div>
                                <label className="text-sm font-semibold mb-1 block">Amount <span className="text-red-500">*</span></label>
                                <div className="relative">
                                    <IndianRupee className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        required
                                        value={newIncome.amount}
                                        onChange={e => setNewIncome({ ...newIncome, amount: e.target.value })}
                                        className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-border bg-background shadow-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all font-medium"
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>
                            
                            <div>
                                <label className="text-sm font-semibold mb-1 block">Source / Reason <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    required
                                    value={newIncome.source}
                                    onChange={e => setNewIncome({ ...newIncome, source: e.target.value })}
                                    className="w-full px-4 py-2.5 rounded-xl border border-border bg-background shadow-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                    placeholder="e.g., Event Ticket Sales, Donation, Old Scrap..."
                                />
                            </div>

                            <div>
                                <label className="text-sm font-semibold mb-1 block">Payment Mode</label>
                                <select
                                    value={newIncome.mode}
                                    onChange={e => setNewIncome({ ...newIncome, mode: e.target.value })}
                                    className="w-full px-4 py-2.5 rounded-xl border border-border bg-background shadow-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                >
                                    <option value="Cash">Cash</option>
                                    <option value="UPI">UPI</option>
                                    <option value="Bank Transfer">Bank Transfer</option>
                                    <option value="Cheque">Cheque</option>
                                </select>
                            </div>

                            <button
                                type="submit"
                                disabled={saving}
                                className="w-full mt-2 py-3 rounded-xl gradient-primary text-white font-bold tracking-wide shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Save Record'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </AppShell>
    );
};

export default SchoolIncome;
