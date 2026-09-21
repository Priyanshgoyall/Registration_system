import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, CalendarDays, Clock } from 'lucide-react';
import { supabase } from '@db/client';
import Modal from '@shared/components/Modal';
import Spinner from '@shared/components/Spinner';

const STATUS_OPTIONS = ['upcoming', 'active', 'completed', 'cancelled'];

const emptyForm = { name: '', description: '', start_date: '', end_date: '', status: 'upcoming' };

function getEffectiveStatus(session) {
  const todayStr = new Date().toISOString().split('T')[0];
  if (session.status === 'active' && session.end_date && session.end_date < todayStr) {
    return 'expired';
  }
  return session.status;
}

function statusBadge(session) {
  const effStatus = getEffectiveStatus(session);
  if (effStatus === 'expired') return <span className="badge-yellow">Expired (00:00 AM)</span>;
  if (effStatus === 'active') return <span className="badge-green">Active</span>;
  if (effStatus === 'upcoming') return <span className="badge-blue">Upcoming</span>;
  if (effStatus === 'completed') return <span className="badge-yellow">Completed</span>;
  return <span className="badge-red">Cancelled</span>;
}

export default function Sessions() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchSessions = async () => {
    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .order('start_date', { ascending: false });
    if (error) toast.error('Failed to load sessions');
    else setSessions(data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchSessions(); }, []);

  const openCreate = () => { setEditTarget(null); setForm(emptyForm); setModalOpen(true); };
  const openEdit = (session) => {
    setEditTarget(session);
    setForm({ name: session.name, description: session.description ?? '', start_date: session.start_date, end_date: session.end_date, status: session.status });
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.start_date || !form.end_date) { toast.error('Please fill all required fields'); return; }
    setSaving(true);
    let error;
    if (editTarget) {
      ({ error } = await supabase.from('sessions').update({ name: form.name.trim(), description: form.description.trim(), start_date: form.start_date, end_date: form.end_date, status: form.status }).eq('id', editTarget.id));
    } else {
      ({ error } = await supabase.from('sessions').insert({ name: form.name.trim(), description: form.description.trim(), start_date: form.start_date, end_date: form.end_date, status: form.status }));
    }
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editTarget ? 'Session updated' : 'Session created');
    setModalOpen(false);
    fetchSessions();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from('sessions').delete().eq('id', deleteTarget.id);
    setDeleting(false);
    setDeleteTarget(null);
    if (error) { toast.error(error.message); return; }
    toast.success('Session deleted');
    fetchSessions();
  };

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Sessions</h1>
          <p className="text-slate-500 text-sm mt-0.5">Manage registration sessions and program schedules.</p>
        </div>
        <button className="btn-primary" onClick={openCreate}>
          <Plus size={16} /> New Session
        </button>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-center gap-3 text-xs text-blue-800">
        <Clock size={16} className="text-blue-600 flex-shrink-0" />
        <span>
          <strong>Automatic Expiration:</strong> Sessions automatically expire at 00:00 AM on the day following their End Date (e.g. End Date 12-09-2026 expires on 13-09-2026 00:00 AM). Coordinators cannot make new entries for expired sessions.
        </span>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-12">
            <CalendarDays size={40} className="text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">No sessions yet. Create one to get started.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-header">Name</th>
                  <th className="table-header hidden md:table-cell">Dates</th>
                  <th className="table-header">Status</th>
                  <th className="table-header text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.id} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="table-cell">
                      <p className="font-semibold text-slate-900">{s.name}</p>
                      {s.description && <p className="text-xs text-slate-400 mt-0.5">{s.description}</p>}
                    </td>
                    <td className="table-cell hidden md:table-cell text-slate-500 text-xs">
                      {new Date(s.start_date).toLocaleDateString('en-IN')} — {new Date(s.end_date).toLocaleDateString('en-IN')}
                    </td>
                    <td className="table-cell">{statusBadge(s)}</td>
                    <td className="table-cell">
                      <div className="flex items-center justify-end gap-1">
                        <button className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all" onClick={() => openEdit(s)} title="Edit">
                          <Pencil size={14} />
                        </button>
                        <button className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all" onClick={() => setDeleteTarget(s)} title="Delete">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editTarget ? 'Edit Session' : 'New Session'}>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="label">Name *</label>
            <input className="input-field" value={form.name} onChange={(e) => setField('name', e.target.value)} placeholder="e.g. Summer Science Camp 2026" required />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input-field resize-none h-20" value={form.description} onChange={(e) => setField('description', e.target.value)} placeholder="Optional description…" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Start Date *</label>
              <input type="date" className="input-field" value={form.start_date} onChange={(e) => setField('start_date', e.target.value)} required />
            </div>
            <div>
              <label className="label">End Date *</label>
              <input type="date" className="input-field" value={form.end_date} onChange={(e) => setField('end_date', e.target.value)} required />
            </div>
          </div>
          <div>
            <label className="label">Status</label>
            <select className="input-field" value={form.status} onChange={(e) => setField('status', e.target.value)}>
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" className="btn-secondary flex-1" onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn-primary flex-1" disabled={saving}>
              {saving ? <Spinner size="sm" /> : null}
              {saving ? 'Saving…' : editTarget ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Session" size="sm">
        <p className="text-slate-600 mb-6">
          Are you sure you want to delete <strong className="text-slate-900">{deleteTarget?.name}</strong>? This will also delete all associated registrations and attendance.
        </p>
        <div className="flex gap-3">
          <button className="btn-secondary flex-1" onClick={() => setDeleteTarget(null)}>Cancel</button>
          <button className="btn-danger flex-1" onClick={handleDelete} disabled={deleting}>
            {deleting ? <Spinner size="sm" /> : null}
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
