import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  UserCog, Plus, Eye, EyeOff, RefreshCw, ShieldOff, Shield, AlertTriangle, Trash2,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { supabaseAdmin, isAdminAvailable, hasServiceKey } from '../../lib/supabaseAdmin';
import { useAuth } from '../../hooks/useAuth';
import Modal from '../../components/Modal';
import Spinner from '../../components/Spinner';

// ── Coordinator Management ────────────────────────────────────────────────────
// Uses Supabase Auth admin API (service role) to create coordinator accounts.
// Coordinators are stored in a `user_profiles` table: { id, email, full_name, role, is_active }
// RLS: main admin can read/update all profiles; coordinators see only their own.
//
// Required Supabase setup:
//   CREATE TABLE user_profiles (
//     id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
//     email text NOT NULL,
//     full_name text DEFAULT '',
//     role text NOT NULL DEFAULT 'coordinator',
//     is_active boolean NOT NULL DEFAULT true,
//     created_at timestamptz NOT NULL DEFAULT now()
//   );
//   ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
//   CREATE POLICY "Admin sees all" ON user_profiles FOR ALL USING (auth.uid() IN (
//     SELECT id FROM user_profiles WHERE role = 'admin'
//   ));
//   CREATE POLICY "Coordinator sees own" ON user_profiles FOR SELECT USING (auth.uid() = id);

const emptyForm = { full_name: '', email: '', password: '' };

function roleBadge(role, isActive) {
  if (!isActive) return <span className="badge-red">Disabled</span>;
  if (role === 'admin') return <span className="badge-blue">Admin</span>;
  return <span className="badge-green">Coordinator</span>;
}

export default function Coordinators() {
  const { isAdmin, loading: authLoading } = useAuth();
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tableMissing, setTableMissing] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [showPass, setShowPass] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resetTarget, setResetTarget] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetting, setResetting] = useState(false);

  if (!authLoading && !isAdmin) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  const schemaSql = `-- Run this in Supabase Dashboard -> SQL Editor:
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  full_name   TEXT DEFAULT '',
  role        TEXT NOT NULL DEFAULT 'coordinator',
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all_user_profiles" ON public.user_profiles
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "anon_read_user_profiles" ON public.user_profiles
  FOR SELECT TO anon USING (true);`;

  const fetchProfiles = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      if (
        error.code === 'PGRST204' ||
        error.code === '42P01' ||
        error.message?.toLowerCase().includes('schema cache') ||
        error.message?.toLowerCase().includes('relation') ||
        error.message?.toLowerCase().includes('not found')
      ) {
        setTableMissing(true);
      } else {
        toast.error('Failed to load coordinators: ' + error.message);
      }
    } else {
      setProfiles(data ?? []);
      setTableMissing(false);
    }
    setLoading(false);
  };

  useEffect(() => { fetchProfiles(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.email.trim() || !form.password.trim() || !form.full_name.trim()) {
      toast.error('All fields are required');
      return;
    }
    if (form.password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    setSaving(true);
    try {
      const emailClean = form.email.trim().toLowerCase();
      // Check if profile already exists in current active list
      const existingProfile = profiles.find((p) => p.email.toLowerCase() === emailClean);
      if (existingProfile) {
        toast.error(`An account for ${emailClean} already exists in the list below.`);
        setSaving(false);
        return;
      }

      let createdUserId;
      if (hasServiceKey && supabaseAdmin?.auth?.admin) {
        // 1. Try creating auth user via service role
        const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
          email: emailClean,
          password: form.password,
          email_confirm: true,
        });

        if (authErr) {
          // If already registered in auth, look up user ID and link profile
          if (authErr.message?.toLowerCase().includes('already') || authErr.status === 422) {
            const { data: usersData } = await supabaseAdmin.auth.admin.listUsers();
            const existingUser = usersData?.users?.find((u) => u.email?.toLowerCase() === emailClean);
            if (existingUser) {
              createdUserId = existingUser.id;
              // update user password to the new password entered
              await supabaseAdmin.auth.admin.updateUserById(createdUserId, { password: form.password });
            } else {
              throw new Error(authErr.message);
            }
          } else {
            throw new Error(authErr.message);
          }
        } else {
          createdUserId = authData.user.id;
        }
      } else {
        // Fallback using normal supabase auth sign up
        const { data: authData, error: authErr } = await supabase.auth.signUp({
          email: emailClean,
          password: form.password,
        });
        if (authErr) {
          if (authErr.message?.toLowerCase().includes('already')) {
            throw new Error(`The email "${emailClean}" is already registered. Please enter a different email address or reset password.`);
          }
          throw new Error(authErr.message);
        }
        if (!authData?.user) throw new Error('Could not create account');
        createdUserId = authData.user.id;
      }

      // 2. Insert/Upsert into user_profiles
      const { error: profileErr } = await supabase.from('user_profiles').upsert({
        id: createdUserId,
        email: emailClean,
        full_name: form.full_name.trim(),
        role: 'coordinator',
        is_active: true,
      });
      if (profileErr) throw new Error(profileErr.message);

      toast.success(`Coordinator ${emailClean} created successfully!`);
      setCreateOpen(false);
      setForm(emptyForm);
      fetchProfiles();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (profile) => {
    const { error } = await supabase
      .from('user_profiles')
      .update({ is_active: !profile.is_active })
      .eq('id', profile.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Account ${profile.is_active ? 'disabled' : 'enabled'}`);
    fetchProfiles();
  };

  const handleDelete = async (profile) => {
    if (!window.confirm(`Delete coordinator account for ${profile.email}?`)) return;
    try {
      if (hasServiceKey && supabaseAdmin?.auth?.admin) {
        await supabaseAdmin.auth.admin.deleteUser(profile.id);
      }
      const { error } = await supabase.from('user_profiles').delete().eq('id', profile.id);
      if (error) throw new Error(error.message);
      toast.success(`Coordinator ${profile.email} removed`);
      fetchProfiles();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    setResetting(true);
    try {
      if (hasServiceKey && supabaseAdmin?.auth?.admin) {
        const { error } = await supabaseAdmin.auth.admin.updateUserById(resetTarget.id, {
          password: newPassword,
        });
        if (error) throw new Error(error.message);
      } else {
        toast.error('Password reset requires VITE_SUPABASE_SERVICE_KEY in .env');
        return;
      }
      toast.success('Password reset successfully');
      setResetTarget(null);
      setNewPassword('');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setResetting(false);
    }
  };

  if (!isAdminAvailable) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Coordinators</h1>
          <p className="text-slate-500 text-sm mt-0.5">Manage coordinator accounts.</p>
        </div>
        <div className="card p-8">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="w-14 h-14 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-center">
              <AlertTriangle size={24} className="text-amber-600" />
            </div>
            <div>
              <p className="text-lg font-bold text-slate-900 mb-2">Service Key Required</p>
              <p className="text-slate-500 text-sm max-w-md">
                Coordinator account creation requires the Supabase service role key.
                Add it to your <span className="font-mono bg-slate-100 px-1 rounded">.env</span> file:
              </p>
              <div className="mt-4 bg-slate-900 text-emerald-400 rounded-xl p-4 text-left text-sm font-mono">
                <p className="text-slate-500 mb-1"># .env</p>
                <p>VITE_SUPABASE_URL=your_project_url</p>
                <p>VITE_SUPABASE_ANON_KEY=your_anon_key</p>
                <p className="text-emerald-400">VITE_SUPABASE_SERVICE_KEY=your_service_role_key</p>
              </div>
              <p className="text-slate-400 text-xs mt-3">
                Get the service role key from: Supabase Dashboard → Project Settings → API → service_role
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (tableMissing) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Coordinators</h1>
          <p className="text-slate-500 text-sm mt-0.5">Manage coordinator accounts.</p>
        </div>
        <div className="card p-8">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="w-14 h-14 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-center">
              <AlertTriangle size={24} className="text-amber-600" />
            </div>
            <div className="w-full max-w-2xl">
              <p className="text-lg font-bold text-slate-900 mb-2">Database Table Required: user_profiles</p>
              <p className="text-slate-500 text-sm mb-4">
                The <span className="font-mono bg-slate-100 px-1 rounded text-slate-900 font-semibold">user_profiles</span> table does not exist in your Supabase project schema cache yet.
                Run the SQL query below in your <strong className="text-slate-800">Supabase Dashboard → SQL Editor</strong> to create it:
              </p>

              <div className="relative bg-slate-900 text-emerald-400 rounded-xl p-4 text-left text-xs font-mono overflow-x-auto mb-4 border border-slate-800 shadow-inner">
                <button
                  className="absolute right-3 top-3 px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-sans transition-all flex items-center gap-1 border border-slate-700"
                  onClick={() => {
                    navigator.clipboard.writeText(schemaSql);
                    toast.success('SQL copied to clipboard!');
                  }}
                >
                  Copy SQL
                </button>
                <pre className="text-emerald-400 whitespace-pre-wrap leading-relaxed">{schemaSql}</pre>
              </div>

              <div className="flex justify-center gap-3">
                <button className="btn-primary" onClick={fetchProfiles}>
                  <RefreshCw size={14} /> Refresh / Check Table
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Coordinators</h1>
          <p className="text-slate-500 text-sm mt-0.5">Manage coordinator accounts and permissions.</p>
        </div>
        <button className="btn-primary" onClick={() => setCreateOpen(true)}>
          <Plus size={16} /> New Coordinator
        </button>
      </div>

      {/* Info card */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl px-5 py-4 flex gap-3">
        <Shield size={18} className="text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-semibold text-blue-800 mb-0.5">Role Hierarchy</p>
          <p className="text-blue-700">
            <strong>Main Admin</strong> has full access. <strong>Coordinators</strong> can view registrations,
            mark attendance, and issue certificates — but cannot manage coordinators or delete data.
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : profiles.length === 0 ? (
          <div className="text-center py-12">
            <UserCog size={40} className="text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">No coordinator accounts yet.</p>
            <p className="text-slate-400 text-sm mt-1">Create one to delegate access.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-header">Name / Email</th>
                  <th className="table-header">Role</th>
                  <th className="table-header hidden sm:table-cell">Created</th>
                  <th className="table-header text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((p) => (
                  <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="table-cell">
                      <p className="font-semibold text-slate-900">{p.full_name || '—'}</p>
                      <p className="text-xs text-slate-400">{p.email}</p>
                    </td>
                    <td className="table-cell">{roleBadge(p.role, p.is_active)}</td>
                    <td className="table-cell hidden sm:table-cell text-xs text-slate-400">
                      {new Date(p.created_at).toLocaleDateString('en-IN')}
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center justify-end gap-1">
                        {/* Reset password */}
                        <button
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all"
                          title="Reset Password"
                          onClick={() => { setResetTarget(p); setNewPassword(''); }}
                        >
                          <RefreshCw size={14} />
                        </button>
                        {/* Toggle active */}
                        {p.role !== 'admin' && (
                          <>
                            <button
                              className={`p-1.5 rounded-lg transition-all ${
                                p.is_active
                                  ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'
                                  : 'text-emerald-500 hover:bg-emerald-50'
                              }`}
                              title={p.is_active ? 'Disable Account' : 'Enable Account'}
                              onClick={() => toggleActive(p)}
                            >
                              {p.is_active ? <ShieldOff size={14} /> : <Shield size={14} />}
                            </button>
                            <button
                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all"
                              title="Delete Coordinator Account"
                              onClick={() => handleDelete(p)}
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Coordinator Modal */}
      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Create Coordinator Account" size="sm">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="label">Full Name</label>
            <input className="input-field" placeholder="e.g. Priya Sharma" value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} required />
          </div>
          <div>
            <label className="label">Email Address</label>
            <input className="input-field" type="email" placeholder="coordinator@example.com" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required />
          </div>
          <div>
            <label className="label">Password</label>
            <div className="relative">
              <input
                className="input-field pr-11"
                type={showPass ? 'text' : 'password'}
                placeholder="Min. 8 characters"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                required
                minLength={8}
              />
              <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" onClick={() => setShowPass((v) => !v)}>
                {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
            <strong>Note:</strong> The coordinator will be able to log in at the same admin URL with these credentials. They will not have access to coordinator management.
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" className="btn-secondary flex-1" onClick={() => setCreateOpen(false)}>Cancel</button>
            <button type="submit" className="btn-primary flex-1" disabled={saving}>
              {saving ? <Spinner size="sm" /> : <Plus size={14} />}
              {saving ? 'Creating…' : 'Create Account'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Reset Password Modal */}
      <Modal isOpen={!!resetTarget} onClose={() => setResetTarget(null)} title="Reset Password" size="sm">
        <p className="text-slate-600 mb-4 text-sm">
          Reset password for <strong className="text-slate-900">{resetTarget?.email}</strong>
        </p>
        <div className="space-y-4">
          <div>
            <label className="label">New Password</label>
            <input
              className="input-field"
              type="password"
              placeholder="Min. 8 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={8}
            />
          </div>
          <div className="flex gap-3">
            <button className="btn-secondary flex-1" onClick={() => setResetTarget(null)}>Cancel</button>
            <button className="btn-primary flex-1" onClick={handleResetPassword} disabled={resetting}>
              {resetting ? <Spinner size="sm" /> : <RefreshCw size={14} />}
              {resetting ? 'Resetting…' : 'Reset Password'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
