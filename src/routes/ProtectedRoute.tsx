import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import type { UserRole } from '@/types';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
    children: React.ReactNode;
    allowedRoles: UserRole[];
    redirectTo?: string;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
    children,
    allowedRoles,
    redirectTo = '/login',
}) => {
    const { user, isLoading, isAuthenticated } = useAuth();
    const location = useLocation();

    // ✅ Already authenticated with the right role — render immediately (optimistic)
    if (isAuthenticated && user && allowedRoles.includes(user.role)) {
        return <>{children}</>;
    }

    // ⏳ Still verifying session and no persisted user yet — show spinner
    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <p className="text-muted-foreground text-sm">Loading your workspace...</p>
                </div>
            </div>
        );
    }

    // ❌ Not authenticated — redirect to login
    if (!isAuthenticated || !user) {
        return <Navigate to={redirectTo} state={{ from: location }} replace />;
    }

    // ❌ Authenticated but wrong role — redirect to their own dashboard
    const roleRoutes: Record<UserRole, string> = {
        admin: '/admin',
        teacher: '/teacher',
        student: '/student',
    };
    return <Navigate to={roleRoutes[user.role]} replace />;
};

export default ProtectedRoute;
