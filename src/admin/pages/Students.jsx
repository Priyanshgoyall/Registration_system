import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Search, Users, GraduationCap, Phone, School, Download, Save, X, User, Mail, MapPin, Trash2 } from 'lucide-react';
import { supabase } from '@db/client';
import Modal from '@shared/components/Modal';
import Spinner from '@shared/components/Spinner';
import { exportToCSV } from '@shared/utils/exportCSV';

export default function Students() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;
  const [viewing, setViewing] = useState(null);
  const [studentRegs, setStudentRegs] = useState([]);
  const [loadingRegs, setLoadingRegs] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', email: '', phone: '', school_name: '', city: '' });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchStudents = async () => {
    const { data, error } = await supabase
      .from('students')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) toast.error('Failed to load students');
    else setStudents(data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchStudents(); }, []);

  const filtered = students.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.email && s.email.toLowerCase().includes(search.toLowerCase())) ||
      (s.city && s.city.toLowerCase().includes(search.toLowerCase())) ||
      s.phone.includes(search) ||
      s.school_name.toLowerCase().includes(search.toLowerCase())
  );

  // Reset to page 1 when search changes
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const handleSearchChange = (val) => {
    setSearch(val);
    setPage(1);
  };

  const openView = async (student) => {
    setViewing(student);
    setEditing(false);
    setEditForm({
      name: student.name || '',
      email: student.email || '',
      phone: student.phone || '',
      school_name: student.school_name || '',
      city: student.city || '',
    });
    setLoadingRegs(true);
    const { data } = await supabase
      .from('registrations')
      .select('registration_id, email, city, registration_status, registered_at, sessions(name)')
      .eq('student_id', student.id)
      .order('registered_at', { ascending: false });
    setStudentRegs(data ?? []);
    setLoadingRegs(false);
  };

  const closeView = () => { setViewing(null); setEditing(false); setStudentRegs([]); };

  const handleSaveEdit = async () => {
    if (!editForm.name.trim() || !editForm.phone.trim() || !editForm.school_name.trim()) {
      toast.error('Name, Phone, and School are required'); return;
    }
    setSaving(true);
    const { error } = await supabase.from('students').update({
      name: editForm.name.trim(),
      email: editForm.email.trim(),
      phone: editForm.phone.trim(),
      school_name: editForm.school_name.trim(),
      city: editForm.city.trim(),
    }).eq('id', viewing.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Student updated');
    setEditing(false);
    const updated = { ...viewing, ...editForm };
    setViewing(updated);
    setStudents((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  };

  const handleDeleteStudent = async (studentId) => {
    if (!window.confirm('Permanently delete this student and all their associated registrations?')) return;
    setDeleting(true);
    const { error } = await supabase.from('students').delete().eq('id', studentId);
    setDeleting(false);
    if (error) {
      toast.error('Failed to delete student: ' + error.message);
      return;
    }
    toast.success('Student and associated registrations deleted');
    closeView();
    fetchStudents();
  };

  const handleExportCSV = () => {
    const rows = filtered.map((s) => ({
      name: s.name,
      email: s.email || '',
      phone: s.phone,
      school_name: s.school_name,
      city: s.city || '',
      joined: new Date(s.created_at).toLocaleDateString('en-IN'),
    }));
    exportToCSV(rows, ['name', 'email', 'phone', 'school_name', 'city', 'joined'], 'students-export');
    toast.success('Students exported as CSV');
  };

  const statusBadgeClass = (status) => {
    if (status === 'confirmed') return 'badge-green';
    if (status === 'cancelled') return 'badge-red';
    return 'badge-yellow';
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Students</h1>
          <p className="text-slate-500 text-sm mt-0.5">{students.length} total students registered.</p>
        </div>
        <button className="btn-secondary" onClick={handleExportCSV} disabled={filtered.length === 0} title="Export visible students as CSV">
          <Download size={16} /> Export CSV
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          className="input-field pl-10"
          placeholder="Search by name, email, phone, city, or school…"
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
        />
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <Users size={40} className="text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">{search ? 'No students match your search.' : 'No students registered yet.'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-header">Student</th>
                  <th className="table-header hidden sm:table-cell">Gmail ID</th>
                  <th className="table-header hidden md:table-cell">City</th>
                  <th className="table-header hidden lg:table-cell">Phone</th>
                  <th className="table-header text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((s) => (
                  <tr key={s.id} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="table-cell">
                      <div className="flex items-center gap-3">
                        {s.photo_url ? (
                          <img src={s.photo_url} alt={s.name} className="w-9 h-9 rounded-full object-cover flex-shrink-0 border border-slate-200" />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center flex-shrink-0">
                            <GraduationCap size={16} className="text-blue-600" />
                          </div>
                        )}
                        <div>
                          <p className="font-semibold text-slate-900">{s.name}</p>
                          <p className="text-xs text-slate-400">{s.school_name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="table-cell hidden sm:table-cell text-xs text-slate-600">{s.email || '—'}</td>
                    <td className="table-cell hidden md:table-cell text-xs text-slate-600">{s.city || '—'}</td>
                    <td className="table-cell hidden lg:table-cell text-xs font-mono text-slate-500">{s.phone}</td>
                    <td className="table-cell text-right">
                      <button className="text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors" onClick={() => openView(s)}>
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
                <p className="text-xs text-slate-500">
                  Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length} students
                </p>
                <div className="flex items-center gap-2">
                  <button
                    className="btn-secondary py-1 px-3 text-xs"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={safePage === 1}
                  >
                    Previous
                  </button>
                  <span className="text-xs text-slate-600 font-medium">
                    Page {safePage} / {totalPages}
                  </span>
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

      {/* View / Edit Profile Modal */}
      <Modal isOpen={!!viewing} onClose={closeView} title={editing ? 'Edit Student' : 'Student Profile'} size="md">
        {viewing && (
          <div className="space-y-5">
            {/* Photo */}
            <div className="flex flex-col items-center gap-2">
              {viewing.photo_url ? (
                <img src={viewing.photo_url} alt={viewing.name} className="w-24 h-28 object-cover rounded-xl border-2 border-slate-200 shadow-sm" />
              ) : (
                <div className="w-24 h-28 bg-blue-50 rounded-xl border-2 border-blue-200 flex items-center justify-center">
                  <GraduationCap size={32} className="text-blue-400" />
                </div>
              )}
            </div>

            {editing ? (
              <div className="space-y-3">
                <div>
                  <label className="label"><User size={12} className="inline mr-1" />Full Name</label>
                  <input className="input-field" value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
                </div>
                <div>
                  <label className="label"><Mail size={12} className="inline mr-1" />Gmail ID</label>
                  <input className="input-field" value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} type="email" />
                </div>
                <div>
                  <label className="label"><Phone size={12} className="inline mr-1" />Phone</label>
                  <input className="input-field" value={editForm.phone} onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))} type="tel" />
                </div>
                <div>
                  <label className="label"><School size={12} className="inline mr-1" />School Name</label>
                  <input className="input-field" value={editForm.school_name} onChange={(e) => setEditForm((f) => ({ ...f, school_name: e.target.value }))} />
                </div>
                <div>
                  <label className="label"><MapPin size={12} className="inline mr-1" />City</label>
                  <input className="input-field" value={editForm.city} onChange={(e) => setEditForm((f) => ({ ...f, city: e.target.value }))} />
                </div>
                <div className="flex gap-3 pt-1">
                  <button className="btn-secondary flex-1" onClick={() => setEditing(false)}><X size={14} /> Cancel</button>
                  <button className="btn-primary flex-1" onClick={handleSaveEdit} disabled={saving}>
                    {saving ? <Spinner size="sm" /> : <Save size={14} />}
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-center">
                  <p className="text-lg font-bold text-slate-900">{viewing.name}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-4 space-y-3 text-sm border border-slate-200">
                  <div className="flex items-center gap-3 text-slate-600">
                    <Mail size={14} className="text-slate-400 flex-shrink-0" />
                    <span>{viewing.email || 'No email provided'}</span>
                  </div>
                  <div className="flex items-center gap-3 text-slate-600">
                    <Phone size={14} className="text-slate-400 flex-shrink-0" />
                    <span>{viewing.phone}</span>
                  </div>
                  <div className="flex items-center gap-3 text-slate-600">
                    <School size={14} className="text-slate-400 flex-shrink-0" />
                    <span>{viewing.school_name}</span>
                  </div>
                  <div className="flex items-center gap-3 text-slate-600">
                    <MapPin size={14} className="text-slate-400 flex-shrink-0" />
                    <span>{viewing.city || 'No city provided'}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="btn-secondary flex-1" onClick={() => setEditing(true)}>Edit Details</button>
                  <button className="btn-danger flex-1 flex items-center justify-center gap-1.5" onClick={() => handleDeleteStudent(viewing.id)} disabled={deleting}>
                    {deleting ? <Spinner size="sm" /> : <Trash2 size={14} />}
                    {deleting ? 'Deleting…' : 'Delete Student'}
                  </button>
                </div>
              </div>
            )}

            {/* Registration history */}
            <div>
              <p className="text-sm font-semibold text-slate-700 mb-2">Registration History</p>
              {loadingRegs ? (
                <div className="flex justify-center py-4"><Spinner /></div>
              ) : studentRegs.length === 0 ? (
                <p className="text-slate-400 text-sm text-center py-3">No registrations found.</p>
              ) : (
                <div className="space-y-2">
                  {studentRegs.map((r) => (
                    <div key={r.registration_id} className="bg-slate-50 rounded-xl px-4 py-3 flex justify-between items-start gap-2 border border-slate-200">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{r.sessions?.name}</p>
                        <p className="text-xs text-slate-400">{r.email || r.city ? `${r.email || ''} ${r.city ? '(' + r.city + ')' : ''}` : ''}</p>
                        <p className="text-xs font-mono text-slate-400 mt-0.5">{r.registration_id}</p>
                      </div>
                      <span className={statusBadgeClass(r.registration_status)}>{r.registration_status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
