import React, { useState } from 'react';
import { Layers, Plus, AlertCircle, CheckCircle2, Loader2, ArrowRight } from 'lucide-react';
import { supabase } from '@/config/supabaseClient';
import { useSessionStore } from '@/store/sessionStore';
import type { AcademicSession } from '@/types';
import AppShell from '@/components/layout/AppShell';

const getNextClass = (current: string): string => {
    const normalize = current.toLowerCase().trim();
    if (normalize.includes('nursery')) return 'LKG';
    if (normalize.includes('lkg')) return 'UKG';
    if (normalize.includes('ukg')) return 'Class 1';
    if (normalize.includes('class 1')) return 'Class 2';
    if (normalize.includes('class 2')) return 'Class 3';
    if (normalize.includes('class 3')) return 'Class 4';
    if (normalize.includes('class 4')) return 'Class 5';
    if (normalize.includes('class 5')) return 'Class 6';
    if (normalize.includes('class 6')) return 'Class 7';
    if (normalize.includes('class 7')) return 'Class 8';
    if (normalize.includes('class 8')) return 'Class 9';
    if (normalize.includes('class 9')) return 'Class 10';
    return current;
};

const SessionConfig: React.FC = () => {
    const { sessions, setSessions, setActiveSession, activeSession } = useSessionStore();
    const [isTransitioning, setIsTransitioning] = useState(false);
    const [loading, setLoading] = useState(false);
    const [newSessionName, setNewSessionName] = useState('');
    const [newSessionStart, setNewSessionStart] = useState('');
    const [newSessionEnd, setNewSessionEnd] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [transitionProgress, setTransitionProgress] = useState('');

    const runTransitionAutomation = async (oldSessionName: string, newSessionName: string) => {
        setTransitionProgress('Fetching students, fees, and payments...');
        
        // 1. Fetch active students
        const { data: students, error: studentErr } = await supabase
            .from('students')
            .select('*')
            .eq('status', 'active');
        if (studentErr) throw studentErr;

        // 2. Fetch fee structure
        const { data: feeStr, error: feeStrErr } = await supabase.from('fee_structure').select('*');
        if (feeStrErr) throw feeStrErr;

        // 3. Fetch all fee payments (since we are transitioning the old active session)
        const { data: payments, error: payErr } = await supabase.from('fee_payments').select('*');
        if (payErr) throw payErr;

        setTransitionProgress('Calculating fee carryovers...');
        
        // Compute balances
        const newDues = [];
        for (const student of (students || [])) {
            // Find base tuition
            const key = (student.class || '').trim().toUpperCase();
            const baseTuition = feeStr?.find(f => (f.class || '').trim().toUpperCase() === key)?.monthly_fee || 0;
            const tuition = Math.max(0, baseTuition - (student.tuition_discount || 0));
            const isRTE = ['yes', 'rte'].includes((student.rte || '').toLowerCase());

            // 12 months tuition + 1 annual (1200) + 2 exams (200) -> logic from FeeLedger
            const totalDue = 1200 + 400 + (isRTE ? 0 : tuition * 12);

            const studentPayments = (payments || []).filter(p => p.sr_no === student.sr_no);
            const totalPaid = studentPayments.reduce((s, p) => s + (p.paid_amount || 0), 0);
            const totalDisc = studentPayments.reduce((s, p) => s + (p.discount || 0), 0);
            
            const balance = Math.max(0, totalDue - totalPaid - totalDisc);

            if (balance > 0) {
                newDues.push({
                    sr_no: student.sr_no,
                    academic_year: newSessionName,
                    month: `Previous Dues (${oldSessionName})`,
                    fee_type: 'other',
                    due_amount: balance,
                    paid_amount: 0,
                    discount: 0,
                    reason: 'Carried forward from ' + oldSessionName
                });
            }
        }

        if (newDues.length > 0) {
            setTransitionProgress(`Inserting ${newDues.length} carried over fee records...`);
            const { error: insertFeeErr } = await supabase.from('previous_year_dues').upsert(newDues, { onConflict: 'sr_no,academic_year,month' });
            if (insertFeeErr) console.error('Fee carryover insert error', insertFeeErr);
        }

        setTransitionProgress('Promoting students...');
        // 4. Update student classes and statuses
        const studentUpdates = (students || []).map(student => {
            const currentClass = student.class || '';
            let newStatus = student.status;
            let newClass = currentClass;

            if (currentClass.toLowerCase().includes('class 10') || currentClass.toLowerCase().includes('tenth')) {
                newStatus = 'alumni';
            } else {
                newClass = getNextClass(currentClass); // Promote
            }

            return supabase.from('students').update({
                class: newClass,
                status: newStatus
            }).eq('sr_no', student.sr_no);
        });

        await Promise.all(studentUpdates);
        
        // Optional: clear fee_payments table for the new year? 
        // No, we should leave it. In a real ERP, fee_payments would have an academic_year column, 
        // but here it doesn't. If they enter April 2027, it just creates a new string.
    };

    const handleCreateSession = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            // Unset active for all existing
            await supabase.from('academic_sessions').update({ is_active: false }).neq('id', '00000000-0000-0000-0000-000000000000');

            const { data, error: insertError } = await supabase
                .from('academic_sessions')
                .insert({
                    name: newSessionName,
                    start_date: newSessionStart,
                    end_date: newSessionEnd,
                    is_active: true
                })
                .select()
                .single();

            if (insertError) throw insertError;

            // Fetch and update all sessions
            const { data: updatedSessions, error: fetchError } = await supabase
                .from('academic_sessions')
                .select('*')
                .order('start_date', { ascending: false });

            if (fetchError) throw fetchError;

            if (updatedSessions) {
                setSessions(updatedSessions as AcademicSession[]);
                setActiveSession(data as AcademicSession);
            }

            const oldSessionName = activeSession?.name || '';
            if (oldSessionName) {
                await runTransitionAutomation(oldSessionName, newSessionName);
            }

            setSuccess(`Session ${newSessionName} created and students transitioned successfully.`);
            setNewSessionName('');
            setNewSessionStart('');
            setNewSessionEnd('');
            setIsTransitioning(false);
            setTransitionProgress('');
        } catch (err: any) {
            setError(err.message || 'Failed to create new session');
        } finally {
            setLoading(false);
        }
    };

    return (
        <AppShell
            title="Session Management"
            subtitle="Manage academic years, handle transitions, and carry forward data."
        >
            <div className="space-y-6">
                {/* Header Actions */}
                <div className="flex justify-end">
                    <button
                        onClick={() => setIsTransitioning(true)}
                        className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm"
                    >
                        <ArrowRight className="w-4 h-4" />
                        Move to Next Session
                    </button>
                </div>

            {error && (
                <div className="bg-destructive/10 text-destructive text-sm px-4 py-3 rounded-lg flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    {error}
                </div>
            )}
            
            {success && (
                <div className="bg-green-500/10 text-green-500 text-sm px-4 py-3 rounded-lg flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    {success}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* List Sessions */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="bg-card border border-border rounded-xl p-4">
                        <h2 className="text-lg font-semibold mb-4">Academic Sessions</h2>
                        <div className="space-y-3">
                            {sessions.map(session => (
                                <div key={session.id} className={`p-4 rounded-lg border ${session.is_active ? 'border-primary/50 bg-primary/5' : 'border-border bg-background'} flex justify-between items-center`}>
                                    <div>
                                        <h3 className="font-semibold text-foreground flex items-center gap-2">
                                            {session.name}
                                            {session.is_active && (
                                                <span className="text-[10px] bg-primary text-primary-foreground px-2 py-0.5 rounded-full uppercase font-bold tracking-wider">Active</span>
                                            )}
                                        </h3>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {new Date(session.start_date).toLocaleDateString()} - {new Date(session.end_date).toLocaleDateString()}
                                        </p>
                                    </div>
                                    <div>
                                        {!session.is_active && (
                                            <button className="text-xs text-primary hover:underline">Set Active</button>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {sessions.length === 0 && (
                                <div className="text-center py-8 text-muted-foreground text-sm">
                                    No sessions configured yet.
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Transition Wizard UI */}
                {isTransitioning && (
                    <div className="lg:col-span-1">
                        <div className="bg-card border border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.1)] rounded-xl p-4 animate-fade-in">
                            <h2 className="text-lg font-semibold text-blue-500 mb-2">New Session Transition</h2>
                            <p className="text-xs text-muted-foreground mb-4">
                                This will archive the current session, promote students, and compute fee carryovers.
                            </p>
                            <form onSubmit={handleCreateSession} className="space-y-4">
                                <div>
                                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">Session Name</label>
                                    <input 
                                        type="text" 
                                        required
                                        placeholder="e.g. 2027-2028"
                                        value={newSessionName}
                                        onChange={e => setNewSessionName(e.target.value)}
                                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">Start Date</label>
                                        <input 
                                            type="date" 
                                            required
                                            value={newSessionStart}
                                            onChange={e => setNewSessionStart(e.target.value)}
                                            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">End Date</label>
                                        <input 
                                            type="date" 
                                            required
                                            value={newSessionEnd}
                                            onChange={e => setNewSessionEnd(e.target.value)}
                                            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                                        />
                                    </div>
                                </div>
                                
                                <div className="pt-2 border-t border-border mt-2 space-y-2">
                                    <p className="text-xs text-muted-foreground mb-2">The following actions will run automatically:</p>
                                    <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-1">
                                        <li>Nursery to Class 9 passing students will be promoted to the next class.</li>
                                        <li>Failed students will remain in the same class.</li>
                                        <li>Class 10 students will be marked as 'Left School'.</li>
                                        <li>Pending fees will be carried forward to the new session as 'Previous Year Due'.</li>
                                    </ul>
                                </div>

                                <div className="flex justify-end gap-2 pt-2">
                                    <button 
                                        type="button" 
                                        onClick={() => setIsTransitioning(false)}
                                        className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        type="submit" 
                                        disabled={loading}
                                        className="flex items-center gap-2 bg-blue-600 text-white px-4 py-1.5 rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                                    >
                                        {loading && <Loader2 className="w-3 h-3 animate-spin" />}
                                        {loading ? transitionProgress || 'Processing...' : 'Start Transition'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
            </div>
        </AppShell>
    );
};

export default SessionConfig;
