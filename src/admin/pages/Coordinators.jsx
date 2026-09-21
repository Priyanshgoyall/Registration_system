import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  UserCog, Plus, Eye, EyeOff, RefreshCw, ShieldOff, Shield, AlertTriangle, Trash2,
  ClipboardList, Search, Calendar, Clock, User, CheckCircle2, XCircle, FileText,
} from 'lucide-react';
import { supabase } from '@db/client';
import { supabaseAdmin, isAdminAvailable, hasServiceKey } from '@db/adminClient';
import { useAuth } from '@auth/hooks/useAuth';
import Modal from '@shared/components/Modal';
import Spinner from '@shared/components/Spinner';

// ── Coordinator Management & Audit System ─────────────────────────────────────
// Displays coordinator accounts, activity statistics, real DB timestamps, and
// coordinator-specific registration history.
// Accessible exclusively by Main Admin users.

const emptyForm = { full_name: '', email: '', password: '' };

function roleBadge(role, isActive) {
  if (!isActive) return <span className="badge-red">Inactive</span>;
  if (role === 'admin') return <span className="badge-blue">Main Admin</span>;
  return <span className="badge-green">Active Coordinator</span>;
}

function statusBadge(status) {
  if (status === 'confirmed') return <span className="badge-green">Confirmed</span>;
  if (status === 'cancelled') return <span className="badge-red">Cancelled</span>;
  return <span className="badge-yellow">Pending</span>;
}

export default function Coordinators() {
  const { isAdmin, loading: authLoading } = useAuth();
  const [profiles, setProfiles] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tableMissing, setTableMissing] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [showPass, setShowPass] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resetTarget, setResetTarget] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetting, setResetting] = useState(false);

  // ── History Modal State ──
  const [historyTarget, setHistoryTarget] = useState(null);
  const [historySearch, setHistorySearch] = useState('');

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

ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS coordinator_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all_user_profiles" ON public.user_profiles
  FOR ALL TO authenticated USING (true) WITH CHECK (true);`;

  const fetchData = async () => {
    setLoading(true);
    const [{ data: profs, error: profErr }, { data: regs, error: regErr }] = await Promise.all([
      supabase.from('user_profiles').select('*').order('created_at', { ascending: false }),
      supabase
        .from('registrations')
        .select('id, registration_id, registered_at, registration_status, class, coordinator_id, student_id, students(name, email, phone, school_name, city), sessions(name)')
        .order('registered_at', { ascending: false }),
    ]);

    if (profErr) {
      if (
        profErr.code === 'PGRST204' ||
        profErr.code === '42P01' ||
        profErr.message?.toLowerCase().includes('schema cache') ||
        profErr.message?.toLowerCase().includes('relation') ||
        profErr.message?.toLowerCase().includes('not found')
      ) {
        setTableMissing(true);
      } else {
        toast.error('Failed to load coordinators: ' + profErr.message);
      }
    } else {
      setProfiles(profs ?? []);
      setTableMissing(false);
    }

    if (!regErr) {
      setRegistrations(regs ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

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
      const existingProfile = profiles.find((p) => p.email.toLowerCase() === emailClean);
      if (existingProfile) {
        toast.error(`An account for ${emailClean} already exists.`);
        setSaving(false);
        return;
      }

      let createdUserId;
      if (hasServiceKey && supabaseAdmin?.auth?.admin) {
        const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
          email: emailClean,
          password: form.password,
          email_confirm: true,
        });

        if (authErr) {
          if (authErr.message?.toLowerCase().includes('already') || authErr.status === 422) {
            const { data: usersData } = await supabaseAdmin.auth.admin.listUsers();
            const existingUser = usersData?.users?.find((u) => u.email?.toLowerCase() === emailClean);
            if (existingUser) {
              createdUserId = existingUser.id;
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
        const { data: authData, error: authErr } = await supabase.auth.signUp({
          email: emailClean,
          password: form.password,
        });
        if (authErr) {
          if (authErr.message?.toLowerCase().includes('already')) {
            throw new Error(`The email "${emailClean}" is already registered.`);
          }
          throw new Error(authErr.message);
        }
        if (!authData?.user) throw new Error('Could not create account');
        createdUserId = authData.user.id;
      }

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
      fetchData();
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
    fetchData();
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
      fetchData();
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

  // Helper to compute stats for each coordinator
  const getCoordinatorStats = (coordId) => {
    const coordRegs = registrations.filter((r) => r.coordinator_id === coordId);
    const count = coordRegs.length;
    const latestReg = coordRegs.length > 0 ? coordRegs[0] : null;
    return {
      total: count,
      latestTimestamp: latestReg ? latestReg.registered_at : null,
      regs: coordRegs,
    };
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
                Coordinator account creation requires the Supabase service role key in <span className="font-mono bg-slate-100 px-1 rounded">.env</span>.
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
                <button className="btn-primary" onClick={fetchData}>
                  <RefreshCw size={14} /> Refresh / Check Table
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // History filtering for active target
  const targetRegs = historyTarget
    ? registrations.filter((r) => r.coordinator_id === historyTarget.id)
    : [];
  const filteredHistory = targetRegs.filter((r) => {
    if (!historySearch.trim()) return true;
    const q = historySearch.toLowerCase();
    return (
      r.registration_id?.toLowerCase().includes(q) ||
      r.students?.name?.toLowerCase().includes(q) ||
      r.students?.school_name?.toLowerCase().includes(q) ||
      r.students?.phone?.includes(q)
    );
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Coordinator Management</h1>
          <p className="text-slate-500 text-sm mt-0.5">Track coordinator activity, registration ownership, and metrics.</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-secondary" onClick={fetchData} title="Refresh data">
            <RefreshCw size={15} />
          </button>
          <button className="btn-primary" onClick={() => setCreateOpen(true)}>
            <Plus size={16} /> New Coordinator
          </button>
        </div>
      </div>

      {/* Role Hierarchy Note */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl px-5 py-4 flex gap-3">
        <Shield size={18} className="text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-semibold text-blue-800 mb-0.5">Registration Ownership & Hierarchy</p>
          <p className="text-blue-700">
            Registrations created by authenticated coordinators are automatically tagged with their unique Supabase user ID.
            Click on any coordinator row or registration count to inspect their complete registration history.
          </p>
        </div>
      </div>

      {/* Coordinators Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : profiles.length === 0 ? (
          <div className="text-center py-12">
            <UserCog size={40} className="text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">No coordinator accounts found.</p>
            <p className="text-slate-400 text-sm mt-1">Create coordinator accounts to assign desk registrations.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-header">Coordinator Name & Email</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Registrations Handled</th>
                  <th className="table-header hidden md:table-cell">Account Created</th>
                  <th className="table-header hidden lg:table-cell">Last Activity</th>
                  <th className="table-header text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((p) => {
                  const stats = getCoordinatorStats(p.id);
                  return (
                    <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="table-cell">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-sm flex-shrink-0">
                            {(p.full_name || p.email || 'C')[0].toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-slate-900">{p.full_name || '—'}</p>
                              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold font-mono bg-blue-100 text-blue-800 border border-blue-200">
                                Desk #{(() => {
                                  const str = `${p.email || ''} ${p.full_name || ''}`;
                                  const match = str.match(/(?:coord(?:inator)?|desk|counter|operator|user)\s*[-_#]?\s*(\d+)/i) || str.match(/\b(\d{1,2})\b/);
                                  if (match) return String(parseInt(match[1], 10)).padStart(2, '0');
                                  const idx = [...profiles].sort((a, b) => new Date(a.created_at) - new Date(b.created_at)).findIndex((x) => x.id === p.id);
                                  return idx !== -1 ? String(idx + 1).padStart(2, '0') : '01';
                                })()}
                              </span>
                            </div>
                            <p className="text-xs text-slate-400 font-mono">{p.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="table-cell">{roleBadge(p.role, p.is_active)}</td>
                      <td className="table-cell">
                        <button
                          onClick={() => { setHistoryTarget(p); setHistorySearch(''); }}
                          className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold text-xs rounded-full transition-all border border-blue-200/60"
                          title="Click to view coordinator registration history"
                        >
                          <ClipboardList size={13} />
                          {stats.total} {stats.total === 1 ? 'registration' : 'registrations'}
                        </button>
                      </td>
                      <td className="table-cell hidden md:table-cell text-xs text-slate-500">
                        {new Date(p.created_at).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="table-cell hidden lg:table-cell text-xs text-slate-500">
                        {stats.latestTimestamp ? (
                          <span className="flex items-center gap-1 text-slate-700">
                            <Clock size={12} className="text-slate-400" />
                            {new Date(stats.latestTimestamp).toLocaleString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">No activity recorded</span>
                        )}
                      </td>
                      <td className="table-cell">
                        <div className="flex items-center justify-end gap-1">
                          {/* View History button */}
                          <button
                            className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition-all flex items-center gap-1 text-xs font-semibold px-2 border border-blue-200"
                            title="View Registration History"
                            onClick={() => { setHistoryTarget(p); setHistorySearch(''); }}
                          >
                            <ClipboardList size={14} />
                            <span>History</span>
                          </button>
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
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Registration History Modal */}
      <Modal
        isOpen={!!historyTarget}
        onClose={() => setHistoryTarget(null)}
        title={`Coordinator Registrations: ${historyTarget?.full_name || historyTarget?.email || ''}`}
        size="lg"
      >
        <div className="space-y-4">
          {/* Header Summary */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 text-sm">
            <div>
              <p className="font-bold text-slate-900 text-base">{historyTarget?.full_name || 'Coordinator'}</p>
              <p className="text-xs text-slate-500 font-mono mt-0.5">{historyTarget?.email}</p>
              <p className="text-xs text-slate-400 mt-1 font-mono">ID: {historyTarget?.id}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full font-semibold text-xs flex items-center gap-1 border border-blue-200">
                <ClipboardList size={13} />
                {targetRegs.length} Total Handled
              </span>
              <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full font-semibold text-xs flex items-center gap-1 border border-emerald-200">
                <CheckCircle2 size={13} />
                {targetRegs.filter((r) => r.registration_status === 'confirmed').length} Confirmed
              </span>
            </div>
          </div>

          {/* Search inside History */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              className="input-field pl-10 text-sm"
              placeholder="Filter by student name, school, phone, or ID..."
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
            />
          </div>

          {/* Registrations List */}
          <div className="border border-slate-200 rounded-xl overflow-hidden max-h-[420px] overflow-y-auto">
            {filteredHistory.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <FileText size={36} className="mx-auto mb-2 text-slate-300" />
                <p className="font-medium text-slate-600">No registrations found</p>
                <p className="text-xs mt-1">
                  {targetRegs.length === 0
                    ? 'This coordinator has not created any student registrations yet.'
                    : 'No registrations match your search criteria.'}
                </p>
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200 sticky top-0">
                  <tr>
                    <th className="px-4 py-3">Registration ID</th>
                    <th className="px-4 py-3">Student Name</th>
                    <th className="px-4 py-3">School / Phone</th>
                    <th className="px-4 py-3">Session</th>
                    <th className="px-4 py-3">Date & Time</th>
                    <th className="px-4 py-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredHistory.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-mono font-semibold text-blue-600">{r.registration_id}</td>
                      <td className="px-4 py-3 font-medium text-slate-900">{r.students?.name || '—'}</td>
                      <td className="px-4 py-3 text-slate-500">
                        <p className="font-medium text-slate-700">{r.students?.school_name || '—'}</p>
                        <p className="text-[11px] text-slate-400 font-mono">{r.students?.phone}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{r.sessions?.name || 'Default Session'}</td>
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                        {new Date(r.registered_at).toLocaleString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="px-4 py-3 text-right">{statusBadge(r.registration_status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <button className="btn-secondary" onClick={() => setHistoryTarget(null)}>
              Close History
            </button>
          </div>
        </div>
      </Modal>

      {/* Create Coordinator Modal */}
      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Create Coordinator Account" size="sm">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="label">Full Name</label>
            <input
              className="input-field"
              placeholder="e.g. Priya Sharma"
              value={form.full_name}
              onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="label">Email Address</label>
            <input
              className="input-field"
              type="email"
              placeholder="coordinator@example.com"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              required
            />
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
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                onClick={() => setShowPass((v) => !v)}
              >
                {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
            <strong>Note:</strong> The coordinator can log in to desk/admin. Registrations created by this account will automatically be attributed to them.
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" className="btn-secondary flex-1" onClick={() => setCreateOpen(false)}>
              Cancel
            </button>
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
            <button className="btn-secondary flex-1" onClick={() => setResetTarget(null)}>
              Cancel
            </button>
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
