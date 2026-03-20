import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/config/supabaseClient';
import { useAuthStore } from '@/store/authStore';
import { Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react';

const LoginPage: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { setUser, isAuthenticated, user } = useAuthStore();

    // Automatically redirect if already logged in
    React.useEffect(() => {
        if (isAuthenticated && user) {
            navigate(user.role === 'teacher' ? '/teacher' : user.role === 'student' ? '/student' : '/admin', { replace: true });
        }
    }, [isAuthenticated, user, navigate]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
            if (authError) throw authError;

            // Fetch the user's role from the users table
            let role: 'admin' | 'teacher' | 'student' = 'admin';
            try {
                const { data: userData } = await supabase
                    .from('users')
                    .select('role, display_name')
                    .eq('id', data.user!.id)
                    .single();
                if (userData?.role) role = userData.role as typeof role;
            } catch {
                // table not ready yet — default to admin
            }

            // Set global auth store state immediately
            setUser({
                id: data.user!.id,
                email: data.user!.email ?? null,
                displayName: data.user!.email?.split('@')[0] || 'User',
                role,
            });

            // Navigate directly — don't wait for onAuthStateChange
            const roleRoute: Record<'admin' | 'teacher' | 'student', string> = { admin: '/admin', teacher: '/teacher', student: '/student' };
            navigate(roleRoute[role], { replace: true });
        } catch (err: any) {
            setError(err.message || 'Login failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div
            className="min-h-screen flex items-center justify-center p-3 sm:p-4 bg-cover bg-center relative"
            style={{ backgroundImage: "url('/scm-login-bg.jpeg')" }}
        >
            {/* Dark overlay */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />

            {/* Glassmorphism Card */}
            <div className="relative z-10 w-full max-w-[440px] bg-white/10 backdrop-blur-xl border border-white/20 shadow-2xl rounded-3xl p-5 sm:p-10 animate-fade-in text-white">

                {/*
                    COMPACT HEADER — only on very small screens (< 480 px / ~5 inch phones).
                    Logo + school name in a single horizontal row to save vertical space.
                */}
                <div className="flex xs:hidden items-center gap-3 mb-4">
                    <div className="w-16 h-16 flex-shrink-0 flex items-center justify-center">
                        <img src="/school-logo.png" alt="Logo" className="w-full h-full object-contain" />
                    </div>
                    <div>
                        <h1 className="font-bold text-sm tracking-wide uppercase leading-tight">S.C.M. CHILDREN ACADEMY</h1>
                        <p className="text-[10px] font-medium text-white/75 leading-snug">Aff. No: 2132374 | Code: 81858</p>
                        <p className="text-[10px] font-medium text-white/75">HALDAUR, BIJNOR</p>
                    </div>
                </div>

                {/*
                    FULL HEADER — larger phones (>= 480 px) and desktops.
                    Full centered logo + stacked text.
                */}
                <div className="hidden xs:flex flex-col items-center gap-4 mb-8 text-center">
                    <div className="w-24 h-24 flex items-center justify-center flex-shrink-0">
                        <img src="/school-logo.png" alt="Logo" className="w-full h-full object-contain" />
                    </div>
                    <div>
                        <h1 className="font-bold text-2xl tracking-wide uppercase leading-tight mb-1">S.C.M. CHILDREN ACADEMY</h1>
                        <p className="text-sm font-medium text-white/80">Affiliation No: 2132374 | School Code: 81858</p>
                        <p className="text-sm font-medium text-white/80">HALDAUR, BIJNOR</p>
                    </div>
                </div>

                {/* Welcome */}
                <div className="mb-4 sm:mb-6 text-center">
                    <h2 className="text-lg sm:text-xl font-bold">Welcome back</h2>
                    <p className="text-white/70 mt-0.5 text-xs sm:text-sm">Sign in to your account to continue</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-3 sm:space-y-5">
                    {/* Email */}
                    <div className="space-y-1 text-left">
                        <label htmlFor="email" className="block text-xs sm:text-sm font-medium text-white/90 ml-1">
                            Email address
                        </label>
                        <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="w-full px-4 py-2.5 sm:py-3.5 rounded-xl border border-white/20 bg-white/10 text-white text-sm sm:text-base placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-white/50 transition-all backdrop-blur-md"
                            placeholder="admin@scmacademy.edu"
                        />
                    </div>

                    {/* Password */}
                    <div className="space-y-1 text-left">
                        <label htmlFor="password" className="block text-xs sm:text-sm font-medium text-white/90 ml-1">
                            Password
                        </label>
                        <div className="relative">
                            <input
                                id="password"
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                className="w-full px-4 py-2.5 sm:py-3.5 pr-11 rounded-xl border border-white/20 bg-white/10 text-white text-sm sm:text-base placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-white/50 transition-all backdrop-blur-md"
                                placeholder="••••••••"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/60 hover:text-white transition-colors p-1"
                            >
                                {showPassword ? <EyeOff className="w-4 h-4 sm:w-5 sm:h-5" /> : <Eye className="w-4 h-4 sm:w-5 sm:h-5" />}
                            </button>
                        </div>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="rounded-xl border border-red-400/30 bg-red-500/20 px-3 py-2.5 text-xs sm:text-sm text-red-100 animate-fade-in backdrop-blur-md">
                            {error}
                        </div>
                    )}

                    {/* Submit */}
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full flex items-center justify-center gap-2 bg-white text-black font-bold py-2.5 sm:py-3.5 px-6 rounded-xl hover:bg-white/90 transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(255,255,255,0.2)] mt-2 sm:mt-4 text-sm sm:text-base"
                    >
                        {loading && <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />}
                        {loading ? 'Signing in...' : 'Sign In'}
                    </button>
                </form>

                {/* Footer — hidden on very small screens to save vertical space */}
                <div className="mt-4 sm:mt-8 hidden xs:flex items-center justify-center gap-2 text-white/50 text-xs">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Secured by Supabase Authentication</span>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;
