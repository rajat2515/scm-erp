import React, { useEffect, useState } from 'react';
import { supabase } from '@/config/supabaseClient';
import { useAuth } from '@/context/AuthContext';
import AppShell from '@/components/layout/AppShell';
import { 
    User, Mail, Phone, MapPin, 
    CreditCard, GraduationCap, Briefcase, 
    Calendar, ShieldAlert, Heart, Info, Loader2
} from 'lucide-react';

const Profile: React.FC = () => {
    const { user, isLoading: authLoading } = useAuth();
    const [profile, setProfile] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Wait for auth to finish loading first
        if (authLoading) return;

        if (!user?.id) {
            setLoading(false);
            return;
        }

        const fetchProfile = async () => {
            setLoading(true);
            try {
                const { data, error } = await supabase
                    .from('teacher_registrations')
                    .select('*')
                    .eq('user_id', user.id)
                    .single();

                if (error) {
                    console.error('Supabase error fetching profile:', error.message);
                } else {
                    setProfile(data);
                }
            } catch (err) {
                console.error('Unexpected error:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchProfile();
    }, [user?.id, authLoading]);

    return (
        <AppShell 
            title="My Profile" 
            subtitle="View and manage your professional teacher record"
        >
            {loading || authLoading ? (
                <div className="flex items-center justify-center py-32">
                    <div className="flex flex-col items-center gap-4">
                        <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
                        <p className="text-sm text-slate-400 font-medium">Loading your profile...</p>
                    </div>
                </div>
            ) : !profile ? (
                <div className="py-16 text-center bg-white rounded-3xl border border-slate-100 shadow-sm">
                    <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-4 text-rose-400">
                        <User className="w-8 h-8" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-800">Profile Not Linked</h2>
                    <p className="text-slate-500 mt-2 text-sm max-w-sm mx-auto">
                        Your login account is not linked to a teacher registration record. 
                        Please contact the administrator.
                    </p>
                </div>
            ) : (
                <div className="space-y-8 animate-in fade-in duration-500">
                    {/* Header Banner */}
                    <div className="relative h-44 bg-gradient-to-r from-indigo-600 to-blue-500 rounded-3xl overflow-hidden shadow-lg">
                        <div className="absolute inset-0 bg-white/5"></div>
                        <div 
                            className="absolute bottom-0 left-0 p-8 flex items-end gap-5 text-white" 
                            style={{ transform: 'translateY(33%)' }}
                        >
                            <div className="w-24 h-24 rounded-2xl bg-white p-1 shadow-xl flex-shrink-0">
                                <div className="w-full h-full rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                                    <User className="w-12 h-12" />
                                </div>
                            </div>
                            <div className="mb-6">
                                <h1 className="text-2xl font-extrabold tracking-tight capitalize">
                                    {profile.teacher_name}
                                </h1>
                                <p className="text-indigo-200 text-sm mt-0.5">
                                    {profile.designation} · Class Teacher of{' '}
                                    <span className="font-bold text-white uppercase">
                                        {profile.class_teacher || 'N/A'}
                                    </span>
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Content grid */}
                    <div className="mt-12 grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* LEFT column */}
                        <div className="space-y-5">
                            {/* Contact card */}
                            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2 mb-4">
                                    <Info className="w-3.5 h-3.5" /> Personal Contacts
                                </h3>
                                <div className="space-y-3.5">
                                    {[
                                        { icon: Mail, label: 'School Email', value: profile.school_email || profile.email_id, color: 'bg-indigo-50 text-indigo-500' },
                                        { icon: Phone, label: 'Mobile Number', value: profile.mobile_number, color: 'bg-blue-50 text-blue-500' },
                                        { icon: Heart, label: 'Emergency Contact', value: profile.emergency_contact, color: 'bg-rose-50 text-rose-500' },
                                        { icon: MapPin, label: 'Address', value: profile.address, color: 'bg-emerald-50 text-emerald-500' },
                                    ].map(({ icon: Icon, label, value, color }) => (
                                        <div key={label} className="flex items-start gap-3">
                                            <div className={`p-2 ${color} rounded-xl flex-shrink-0 mt-0.5`}>
                                                <Icon className="w-3.5 h-3.5" />
                                            </div>
                                            <div className="overflow-hidden">
                                                <p className="text-[10px] text-slate-400 font-semibold uppercase">{label}</p>
                                                <p className="text-sm font-semibold text-slate-700 leading-snug">{value || '—'}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Aadhar card */}
                            <div className="bg-rose-50 p-5 rounded-2xl border border-rose-100 shadow-sm">
                                <h3 className="text-xs font-bold text-rose-400 uppercase tracking-wider flex items-center gap-2 mb-3">
                                    <ShieldAlert className="w-3.5 h-3.5" /> Identification
                                </h3>
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-white text-rose-500 rounded-xl shadow-sm flex-shrink-0">
                                        <CreditCard className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-rose-400 font-semibold uppercase">Aadhar Number</p>
                                        <p className="text-base font-bold text-rose-900 tracking-[0.15em]">
                                            {profile.aadhar_no
                                                ? `XXXX-XXXX-${String(profile.aadhar_no).slice(-4)}`
                                                : 'Not Provided'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* RIGHT column — 2 cols width */}
                        <div className="lg:col-span-2 space-y-5">
                            {/* Professional details */}
                            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm grid grid-cols-1 sm:grid-cols-2 gap-6">
                                {[
                                    { icon: Briefcase, label: 'Designation', val1: profile.designation, val2: profile.nature_of_appointment, color: 'bg-indigo-50 text-indigo-600' },
                                    { icon: GraduationCap, label: 'Qualification', val1: profile.teacher_qualification, val2: profile.trained_or_untrained, color: 'bg-blue-50 text-blue-600' },
                                    {
                                        icon: Calendar, label: 'Service Details',
                                        val1: profile.date_of_joining ? `Joined ${new Date(profile.date_of_joining).toLocaleDateString('en-IN')}` : '—',
                                        val2: profile.dob ? `DOB: ${new Date(profile.dob).toLocaleDateString('en-IN')}` : '—',
                                        color: 'bg-amber-50 text-amber-600'
                                    },
                                    { icon: User, label: 'Father / Spouse', val1: profile.fathers_spouse_name || '—', val2: `Gender: ${profile.gender || '—'}`, color: 'bg-slate-100 text-slate-500' },
                                ].map(({ icon: Icon, label, val1, val2, color }) => (
                                    <div key={label} className="flex gap-4">
                                        <div className={`p-3 ${color} rounded-2xl h-fit flex-shrink-0`}>
                                            <Icon className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{label}</p>
                                            <p className="text-slate-800 font-bold text-sm">{val1 || '—'}</p>
                                            <p className="text-xs text-slate-400 mt-0.5">{val2 || ''}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Teacher code badge */}
                            <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-2xl flex items-center justify-between text-white shadow-md">
                                <div>
                                    <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mb-1">Teacher Code</p>
                                    <p className="text-2xl font-black tracking-widest">#{profile.teacher_code || '001'}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mb-1">Main Subject</p>
                                    <p className="text-sm font-bold text-indigo-300">
                                        {profile.main_subject_taught || profile.appointed_subject || 'General'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </AppShell>
    );
};

export default Profile;
