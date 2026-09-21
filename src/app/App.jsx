import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

import ProtectedRoute from '@auth/components/ProtectedRoute';
import AdminLayout from '@admin/components/AdminLayout';

import KioskPage from '@user/pages/KioskPage';
import SuccessPage from '@user/pages/SuccessPage';
import VerifyPage from '@user/pages/VerifyPage';
import LoginPage from '@auth/pages/LoginPage';

import Dashboard from '@admin/pages/Dashboard';
import Sessions from '@admin/pages/Sessions';
import Students from '@admin/pages/Students';
import Registrations from '@admin/pages/Registrations';
import Attendance from '@admin/pages/Attendance';
import Certificates from '@admin/pages/Certificates';
import Coordinators from '@admin/pages/Coordinators';
import IDCards from '@admin/pages/IDCards';

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
        <Route path="/admin/id-cards" element={<AdminPages element={<IDCards />} />} />
        <Route path="/admin/attendance" element={<AdminPages element={<Attendance />} />} />
        <Route path="/admin/certificates" element={<AdminPages element={<Certificates />} />} />
        <Route path="/admin/coordinators" element={<AdminPages element={<Coordinators />} />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
