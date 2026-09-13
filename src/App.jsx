import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

import ProtectedRoute from './components/ProtectedRoute';
import AdminLayout from './components/AdminLayout';

import KioskPage from './pages/KioskPage';
import SuccessPage from './pages/SuccessPage';
import VerifyPage from './pages/VerifyPage';
import LoginPage from './pages/LoginPage';

import Dashboard from './pages/admin/Dashboard';
import Sessions from './pages/admin/Sessions';
import Students from './pages/admin/Students';
import Registrations from './pages/admin/Registrations';
import Attendance from './pages/admin/Attendance';
import Certificates from './pages/admin/Certificates';
import Coordinators from './pages/admin/Coordinators';

function AdminPages({ element }) {
  return (
    <ProtectedRoute>
      <AdminLayout>{element}</AdminLayout>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#ffffff',
            color: '#0f172a',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            fontSize: '14px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
          },
        }}
      />
      <Routes>
        {/* Public */}
        <Route path="/" element={<KioskPage />} />
        <Route path="/success/:registrationId" element={<SuccessPage />} />
        <Route path="/verify" element={<VerifyPage />} />

        {/* Admin auth */}
        <Route path="/admin/login" element={<LoginPage />} />

        {/* Admin (protected) */}
        <Route path="/admin" element={<AdminPages element={<Dashboard />} />} />
        <Route path="/admin/sessions" element={<AdminPages element={<Sessions />} />} />
        <Route path="/admin/students" element={<AdminPages element={<Students />} />} />
        <Route path="/admin/registrations" element={<AdminPages element={<Registrations />} />} />
        <Route path="/admin/attendance" element={<AdminPages element={<Attendance />} />} />
        <Route path="/admin/certificates" element={<AdminPages element={<Certificates />} />} />
        <Route path="/admin/coordinators" element={<AdminPages element={<Coordinators />} />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
