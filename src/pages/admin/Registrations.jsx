import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { ClipboardList, CheckCircle, XCircle, Filter, Download, FileText, Trash2, AlertTriangle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import Spinner from '../../components/Spinner';
import Modal from '../../components/Modal';
import { exportToCSV, exportToPDF } from '../../utils/exportCSV';

function statusBadge(status) {
  if (status === 'confirmed') return <span className="badge-green">Confirmed</span>;
  if (status === 'cancelled') return <span className="badge-red">Cancelled</span>;
  return <span className="badge-yellow">Pending</span>;
}

export default function Registrations() {
  const [registrations, setRegistrations] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterSession, setFilterSession] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [actionTarget, setActionTarget] = useState(null);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
  const PAGE_SIZE = 25;

  const fetchAll = async () => {
    const [{ data: regs, error: regErr }, { data: sess }] = await Promise.all([
      supabase.from('registrations').select('*, students(*), sessions(*)').order('registered_at', { ascending: false }),
      supabase.from('sessions').select('id, name').order('name'),
    ]);
    if (regErr) toast.error('Failed to load registrations');
    setRegistrations(regs ?? []);
    setSessions(sess ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const handleDeleteAll = async () => {
    setDeletingAll(true);
    try {
      // 1. Delete all registrations (associated attendance & certificates cascade automatically)
      const { error: regError } = await supabase
        .from('registrations')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');

      if (regError) {
        toast.error('Failed to delete registrations: ' + regError.message);
        return;
      }

      // 2. Delete all students
      const { error: stuError } = await supabase
        .from('students')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');

      if (stuError) {
        console.warn('Student profile deletion warning:', stuError);
      }

      toast.success('All registrations and students deleted. Registration numbering reset to 001.');
      setRegistrations([]);
      setPage(1);
    } catch (err) {
      toast.error('An error occurred while deleting registrations.');
      console.error(err);
    } finally {
      setDeletingAll(false);
      setDeleteAllOpen(false);
    }
  };

  const filtered = registrations.filter((r) => {
    if (filterSession && r.session_id !== filterSession) return false;
    if (filterStatus && r.registration_status !== filterStatus) return false;
    return true;
  });

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const handleFilterSession = (val) => { setFilterSession(val); setPage(1); };
  const handleFilterStatus  = (val) => { setFilterStatus(val);  setPage(1); };

  const handleStatusChange = async () => {
    if (!actionTarget) return;
    setSaving(true);

    if (actionTarget.action === 'delete') {
      const regId = actionTarget.reg.id;
      const studentId = actionTarget.reg.student_id;

      // Delete registration
      const { error: regErr } = await supabase.from('registrations').delete().eq('id', regId);
      if (regErr) {
        toast.error('Failed to delete registration: ' + regErr.message);
        setSaving(false);
        setActionTarget(null);
        return;
      }

      // Delete student if exists
      if (studentId) {
        const { error: stuErr } = await supabase.from('students').delete().eq('id', studentId);
        if (stuErr) {
          console.warn('Student profile deletion warning:', stuErr);
        }
      }

      toast.success('Registration and student profile deleted successfully');
      setSaving(false);
      setActionTarget(null);
      fetchAll();
      return;
    }

    const { error } = await supabase.from('registrations').update({
      registration_status: actionTarget.action === 'confirm' ? 'confirmed' : 'cancelled',
    }).eq('id', actionTarget.reg.id);
    setSaving(false);
    setActionTarget(null);
    if (error) { toast.error(error.message); return; }
    toast.success(`Registration ${actionTarget.action === 'confirm' ? 'confirmed' : 'cancelled'}`);
    fetchAll();
  };

  const getRows = () => filtered.map((r) => ({
    name: r.students?.name ?? '',
    email: r.students?.email || r.email || r.class || '',
    phone: r.students?.phone ?? '',
    school_name: r.students?.school_name ?? '',
    city: r.students?.city || r.city || '',
    session: r.sessions?.name ?? '',
    registration_id: r.registration_id,
    status: r.registration_status,
    registered_at: new Date(r.registered_at).toLocaleDateString('en-IN'),
  }));

  const cols = ['name', 'email', 'phone', 'school_name', 'city', 'session', 'registration_id', 'status', 'registered_at'];

  const handleExportCSV = () => {
    exportToCSV(getRows(), cols, 'registrations-export');
    toast.success('Registrations exported as CSV');
  };

  const handleExportPDF = () => {
    exportToPDF(getRows(), cols, 'Registrations Report', 'registrations-export');
    toast.success('Registrations exported as PDF');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Registrations</h1>
          <p className="text-slate-500 text-sm mt-0.5">Manage and confirm student registrations.</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={handleExportCSV} disabled={filtered.length === 0} title="Export CSV">
            <Download size={16} /> CSV
          </button>
          <button className="btn-secondary" onClick={handleExportPDF} disabled={filtered.length === 0} title="Export PDF">
            <FileText size={16} /> PDF
          </button>
          <button
            className="btn-danger flex items-center gap-1.5"
            onClick={() => setDeleteAllOpen(true)}
            disabled={registrations.length === 0 || deletingAll}
            title="Delete all registration records"
          >
            <Trash2 size={16} /> Delete All Registrations
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-slate-400" />
          <select className="input-field py-2 text-sm" value={filterSession} onChange={(e) => handleFilterSession(e.target.value)}>
            <option value="">All Sessions</option>
            {sessions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <select className="input-field py-2 text-sm" value={filterStatus} onChange={(e) => handleFilterStatus(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        {(filterSession || filterStatus) && (
          <button className="btn-secondary py-2 text-sm" onClick={() => { setFilterSession(''); setFilterStatus(''); setPage(1); }}>
            Clear filters
          </button>
        )}
        {filtered.length > 0 && (
          <span className="text-sm text-slate-400 ml-auto">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
        )}
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <ClipboardList size={40} className="text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">No registrations found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-header">Student</th>
                  <th className="table-header hidden sm:table-cell">Gmail ID</th>
                  <th className="table-header hidden md:table-cell">City</th>
                  <th className="table-header hidden lg:table-cell">Session</th>
                  <th className="table-header hidden xl:table-cell">Reg ID</th>
                  <th className="table-header">Status</th>
                  <th className="table-header text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((r) => (
                  <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="table-cell">
                      <p className="font-semibold text-slate-900">{r.students?.name}</p>
                      <p className="text-xs text-slate-400">{r.students?.school_name}</p>
                    </td>
                    <td className="table-cell hidden sm:table-cell text-slate-600 text-xs">{r.students?.email || r.email || r.class}</td>
                    <td className="table-cell hidden md:table-cell text-slate-600 text-xs">{r.students?.city || r.city || '—'}</td>
                    <td className="table-cell hidden lg:table-cell text-slate-600">{r.sessions?.name}</td>
                    <td className="table-cell hidden xl:table-cell font-mono text-xs text-slate-400">{r.registration_id}</td>
                    <td className="table-cell">{statusBadge(r.registration_status)}</td>
                    <td className="table-cell">
                      <div className="flex items-center justify-end gap-1">
                        {r.registration_status !== 'confirmed' && (
                          <button className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all" title="Confirm" onClick={() => setActionTarget({ reg: r, action: 'confirm' })}>
                            <CheckCircle size={14} />
                          </button>
                        )}
                        {r.registration_status !== 'cancelled' && (
                          <button className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all" title="Cancel" onClick={() => setActionTarget({ reg: r, action: 'cancel' })}>
                            <XCircle size={14} />
                          </button>
                        )}
                        <button className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all" title="Delete Registration & Student" onClick={() => setActionTarget({ reg: r, action: 'delete' })}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
                <p className="text-xs text-slate-500">
                  Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length} registrations
                </p>
                <div className="flex items-center gap-2">
                  <button
                    className="btn-secondary py-1 px-3 text-xs"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={safePage === 1}
                  >
                    Previous
                  </button>
                  <span className="text-xs text-slate-600 font-medium">Page {safePage} / {totalPages}</span>
                  <button
                    className="btn-secondary py-1 px-3 text-xs"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={safePage === totalPages}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Confirm action modal */}
      <Modal isOpen={!!actionTarget} onClose={() => setActionTarget(null)} title={actionTarget?.action === 'confirm' ? 'Confirm Registration' : actionTarget?.action === 'delete' ? 'Delete Registration & Student' : 'Cancel Registration'} size="sm">
        <p className="text-slate-600 mb-6">
          {actionTarget?.action === 'confirm'
            ? `Confirm the registration of ${actionTarget?.reg?.students?.name}?`
            : actionTarget?.action === 'delete'
            ? `Permanently delete the registration and student profile for "${actionTarget?.reg?.students?.name}"? This action cannot be undone.`
            : `Cancel the registration of ${actionTarget?.reg?.students?.name}? This cannot be easily undone.`}
        </p>
        <div className="flex gap-3">
          <button className="btn-secondary flex-1" onClick={() => setActionTarget(null)}>Back</button>
          <button
            className={actionTarget?.action === 'confirm' ? 'btn-success flex-1' : 'btn-danger flex-1'}
            onClick={handleStatusChange}
            disabled={saving}
          >
            {saving ? <Spinner size="sm" /> : null}
            {saving ? 'Saving…' : actionTarget?.action === 'confirm' ? 'Confirm' : actionTarget?.action === 'delete' ? 'Delete' : 'Cancel Registration'}
          </button>
        </div>
      </Modal>

      {/* Delete All Confirmation Modal */}
      <Modal isOpen={deleteAllOpen} onClose={() => setDeleteAllOpen(false)} title="Delete All Registrations" size="sm">
        <div className="space-y-4">
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
            <AlertTriangle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <p className="text-sm font-semibold text-red-900">Delete all registrations and students?</p>
              <p className="text-xs text-red-700 mt-0.5">This action cannot be undone. This will permanently delete all {registrations.length} registration records AND all student profiles. Registration numbering will reset to 001.</p>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button className="btn-secondary flex-1" onClick={() => setDeleteAllOpen(false)} disabled={deletingAll}>
              Cancel
            </button>
            <button className="btn-danger flex-1 flex items-center justify-center gap-1.5" onClick={handleDeleteAll} disabled={deletingAll}>
              {deletingAll ? <Spinner size="sm" /> : <Trash2 size={16} />}
              {deletingAll ? 'Deleting…' : 'Delete All'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
