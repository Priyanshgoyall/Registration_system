import { Navigate } from 'react-router-dom';
import { useAuth } from '@auth/hooks/useAuth';
import Spinner from '@shared/components/Spinner';

export default function ProtectedRoute({ children }) {
  const { session, loading, isAdmin } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!session || !isAdmin) {
    return <Navigate to="/admin/login" replace />;
  }

  return children;
}
