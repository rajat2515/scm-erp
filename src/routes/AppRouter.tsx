import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import ProtectedRoute from './ProtectedRoute';
import { Loader2 } from 'lucide-react';

// Lazy-loaded pages
const LoginPage = lazy(() => import('@/pages/auth/LoginPage'));

// Placeholder pages (built in upcoming steps)
const AdminDashboard = lazy(() => import('@/pages/admin/AdminDashboard'));
const StudentDirectory = lazy(() => import('@/pages/admin/students/StudentDirectory'));
const StudentRegistration = lazy(() => import('@/pages/admin/students/StudentRegistration'));
const TransferCertificate = lazy(() => import('@/pages/admin/students/TransferCertificate'));
const StaffDirectory = lazy(() => import('@/pages/admin/staff/StaffDirectory'));
const StaffAttendance = lazy(() => import('@/pages/admin/staff/StaffAttendance'));
const TeacherRegistration = lazy(() => import('@/pages/admin/staff/TeacherRegistration'));
const GatePass = lazy(() => import('@/pages/admin/manager/GatePass'));
const FeeLedger = lazy(() => import('@/pages/admin/manager/FeeLedger'));
const ReportCards = lazy(() => import('@/pages/admin/manager/ReportCards'));
const FormsCenter = lazy(() => import('@/pages/admin/FormsCenter'));
const TeacherDashboard = lazy(() => import('@/pages/teacher/TeacherDashboard'));
const StudentDashboard = lazy(() => import('@/pages/student/StudentDashboard'));
const SessionConfig = lazy(() => import('@/pages/admin/sessions/SessionConfig'));

const PageLoader = () => (
    <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
    </div>
);

const AppRouter: React.FC = () => (
    <BrowserRouter>
        <AuthProvider>
            <Suspense fallback={<PageLoader />}>
                <Routes>
                    {/* Public */}
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/" element={<Navigate to="/login" replace />} />

                    {/* Admin */}
                    <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin']}><AdminDashboard /></ProtectedRoute>} />
                    <Route path="/admin/students" element={<ProtectedRoute allowedRoles={['admin']}><StudentDirectory /></ProtectedRoute>} />
                    <Route path="/admin/students/register" element={<ProtectedRoute allowedRoles={['admin']}><StudentRegistration /></ProtectedRoute>} />
                    <Route path="/admin/students/tc" element={<ProtectedRoute allowedRoles={['admin']}><TransferCertificate /></ProtectedRoute>} />
                    <Route path="/admin/staff" element={<ProtectedRoute allowedRoles={['admin']}><StaffDirectory /></ProtectedRoute>} />
                    <Route path="/admin/staff/register-teacher" element={<ProtectedRoute allowedRoles={['admin']}><TeacherRegistration /></ProtectedRoute>} />
                    <Route path="/admin/staff-attendance" element={<ProtectedRoute allowedRoles={['admin']}><StaffAttendance /></ProtectedRoute>} />
                    <Route path="/admin/gate-pass" element={<ProtectedRoute allowedRoles={['admin']}><GatePass /></ProtectedRoute>} />
                    <Route path="/admin/fees" element={<ProtectedRoute allowedRoles={['admin']}><FeeLedger /></ProtectedRoute>} />
                    <Route path="/admin/reports" element={<ProtectedRoute allowedRoles={['admin', 'teacher']}><ReportCards /></ProtectedRoute>} />
                    <Route path="/admin/forms" element={<ProtectedRoute allowedRoles={['admin']}><FormsCenter /></ProtectedRoute>} />
                    <Route path="/admin/sessions" element={<ProtectedRoute allowedRoles={['admin']}><SessionConfig /></ProtectedRoute>} />

                    {/* Teacher */}
                    <Route path="/teacher" element={<ProtectedRoute allowedRoles={['teacher']}><TeacherDashboard /></ProtectedRoute>} />
                    <Route path="/teacher/marks" element={<ProtectedRoute allowedRoles={['teacher']}><ReportCards /></ProtectedRoute>} />

                    {/* Student */}
                    <Route path="/student" element={<ProtectedRoute allowedRoles={['student']}><StudentDashboard /></ProtectedRoute>} />

                    {/* Unauthorized */}
                    <Route path="/unauthorized" element={
                        <div className="min-h-screen flex items-center justify-center">
                            <div className="text-center space-y-3">
                                <p className="text-4xl font-bold">403</p>
                                <p className="text-muted-foreground">You don't have permission to view this page.</p>
                            </div>
                        </div>
                    } />

                    {/* 404 */}
                    <Route path="*" element={<Navigate to="/login" replace />} />
                </Routes>
            </Suspense>
        </AuthProvider>
    </BrowserRouter>
);

export default AppRouter;
