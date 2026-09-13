import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { CheckSquare, CalendarDays } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import Spinner from '../../components/Spinner';

const STATUS_OPTS = ['present', 'absent', 'late'];

function statusBadge(status) {
  if (status === 'present') return <span className="badge-green">Present</span>;
  if (status === 'late') return <span className="badge-yellow">Late</span>;
  return <span className="badge-red">Absent</span>;
}

export default function Attendance() {
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [registrations, setRegistrations] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState({});

  useEffect(() => {
    supabase.from('sessions').select('id, name').order('name').then(({ data }) => {
      setSessions(data ?? []);
    });
  }, []);

  useEffect(() => {
    if (!selectedSession || !date) return;
    setLoading(true);
    async function fetchAttendance() {
      const { data: regs } = await supabase
        .from('registrations')
        .select('id, class, registration_status, students(name, school_name)')
        .eq('session_id', selectedSession)
        .neq('registration_status', 'cancelled');

      const { data: attRows } = await supabase
        .from('attendance')
        .select('registration_id, status')
        .eq('attendance_date', date)
        .in('registration_id', (regs ?? []).map((r) => r.id));

      const attMap = {};
      (attRows ?? []).forEach((a) => { attMap[a.registration_id] = a.status; });
      setRegistrations(regs ?? []);
      setAttendance(attMap);
      setLoading(false);
    }
    fetchAttendance();
  }, [selectedSession, date]);

  const markAttendance = async (regId, status) => {
    setSaving((s) => ({ ...s, [regId]: true }));
    const { error } = await supabase.from('attendance').upsert(
      { registration_id: regId, attendance_date: date, status },
      { onConflict: 'registration_id,attendance_date' }
    );
    setSaving((s) => ({ ...s, [regId]: false }));
    if (error) { toast.error('Failed to save attendance'); return; }
    setAttendance((a) => ({ ...a, [regId]: status }));
  };

  const markAll = async (status) => {
    for (const reg of registrations) { await markAttendance(reg.id, status); }
    toast.success(`Marked all as ${status}`);
  };

  const presentCount = Object.values(attendance).filter(v => v === 'present').length;
  const markedCount = Object.keys(attendance).length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Attendance</h1>
        <p className="text-slate-500 text-sm mt-0.5">Mark attendance for a session on a given date.</p>
      </div>

      {/* Selectors */}
      <div className="flex flex-wrap gap-3">
        <select className="input-field max-w-xs" value={selectedSession} onChange={(e) => setSelectedSession(e.target.value)}>
          <option value="">Select Session…</option>
          {sessions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <input type="date" className="input-field max-w-xs" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>

      {selectedSession && date && (
        <>
          {/* Stats + Quick mark */}
          {registrations.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex gap-4 text-sm">
                <span className="text-slate-500">{registrations.length} students</span>
                <span className="text-emerald-600 font-medium">{presentCount} present</span>
                <span className="text-slate-400">{markedCount} marked</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-400 text-sm">Mark all:</span>
                {STATUS_OPTS.map((s) => (
                  <button key={s} className="btn-secondary py-1.5 px-3 text-xs capitalize" onClick={() => markAll(s)}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="card overflow-hidden">
            {loading ? (
              <div className="flex justify-center py-12"><Spinner /></div>
            ) : registrations.length === 0 ? (
              <div className="text-center py-12">
                <CheckSquare size={40} className="text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">No active registrations for this session.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="table-header">Student</th>
                      <th className="table-header hidden sm:table-cell">Class</th>
                      <th className="table-header">Status</th>
                      <th className="table-header text-right">Mark</th>
                    </tr>
                  </thead>
                  <tbody>
                    {registrations.map((r) => (
                      <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                        <td className="table-cell">
                          <p className="font-semibold text-slate-900">{r.students?.name}</p>
                          <p className="text-xs text-slate-400">{r.students?.school_name}</p>
                        </td>
                        <td className="table-cell hidden sm:table-cell text-slate-600">{r.class}</td>
                        <td className="table-cell">
                          {attendance[r.id] ? statusBadge(attendance[r.id]) : <span className="text-slate-300 text-xs">Not marked</span>}
                        </td>
                        <td className="table-cell">
                          <div className="flex items-center justify-end gap-1">
                            {saving[r.id] ? (
                              <Spinner size="sm" />
                            ) : (
                              STATUS_OPTS.map((s) => (
                                <button
                                  key={s}
                                  onClick={() => markAttendance(r.id, s)}
                                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all capitalize ${
                                    attendance[r.id] === s
                                      ? s === 'present' ? 'bg-emerald-600 text-white'
                                        : s === 'late' ? 'bg-amber-500 text-white'
                                        : 'bg-red-500 text-white'
                                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                  }`}
                                >
                                  {s}
                                </button>
                              ))
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
        </>
      )}

      {!selectedSession && (
        <div className="card p-12 text-center">
          <CalendarDays size={40} className="text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">Select a session and date to mark attendance.</p>
        </div>
      )}
    </div>
  );
}
