import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { GraduationCap, LogIn, Eye, EyeOff } from 'lucide-react';
import { supabase } from '@db/client';
import { useAuth } from '@auth/hooks/useAuth';
import Spinner from '@shared/components/Spinner';

export default function LoginPage() {
  const navigate = useNavigate();
  const { session, loading, isAdmin } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Already logged in as Admin
  if (!loading && session && isAdmin) {
    return <Navigate to="/admin" replace />;
  }

  const handleLogin = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    const emailClean = email.trim().toLowerCase();
    const { data: authData, error } = await supabase.auth.signInWithPassword({
      email: emailClean,
      password,
    });

    if (error) {
      setSubmitting(false);
      toast.error(error.message);
      return;
    }

    // Check account status and role in user_profiles
    const userId = authData?.user?.id;
    if (userId) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (profile && profile.is_active === false) {
        await supabase.auth.signOut();
        setSubmitting(false);
        toast.error('Your account has been disabled by the admin.');
        return;
      }

      if (profile && profile.role === 'coordinator') {
        await supabase.auth.signOut();
        setSubmitting(false);
        toast.error('Access Denied: Main Admin credentials required. Coordinators cannot access the Management Portal.');
        return;
      }

      setSubmitting(false);
      toast.success('Welcome back, Admin!');
      navigate('/admin');
    } else {
      setSubmitting(false);
      toast.success('Welcome back, Admin!');
      navigate('/admin');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center mb-4 shadow-md">
            <GraduationCap size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Management Portal</h1>
          <p className="text-slate-500 text-sm mt-1">Sign in with Main Admin credentials</p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="card p-8 space-y-5">
          <div>
            <label className="label" htmlFor="email">Email Address</label>
            <input
              id="email"
              type="email"
              className="input-field"
              placeholder="coordinator@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <div className="relative">
              <input
                id="password"
                type={showPass ? 'text' : 'password'}
                className="input-field pr-11"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
              >
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <button
            type="submit"
            className="btn-primary w-full"
            disabled={submitting}
          >
            {submitting ? <Spinner size="sm" /> : <LogIn size={16} />}
            {submitting ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
