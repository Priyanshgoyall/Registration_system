import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, CalendarDays, ClipboardList, Award,
  TrendingUp, ArrowRight, UserCheck, Clock,
} from 'lucide-react';
import { supabase } from '@db/client';
import Spinner from '@shared/components/Spinner';

function StatCard({ icon: Icon, label, value, color, loading, trend }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
      <div className="flex items-start justify-between mb-4">
        <div className={`w-11 h-11 rounded-xl ${color} flex items-center justify-center shadow-sm`}>
          <Icon size={22} className="text-white" />
        </div>
        {trend !== undefined && (
          <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
            Active
          </span>
        )}
      </div>
      {loading ? (
        <div className="mt-1"><Spinner size="sm" /></div>
      ) : (
        <p className="text-3xl font-bold text-slate-900 mt-0.5">{value ?? 0}</p>
      )}
      <p className="text-slate-500 text-sm mt-1">{label}</p>
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [recentRegs, setRecentRegs] = useState([]);

  useEffect(() => {
    async function fetchStats() {
      const [
        { count: students },
        { count: activeSessions },
        { count: registrations },
        { count: certificates },
      ] = await Promise.all([
        supabase.from('students').select('*', { count: 'exact', head: true }),
        supabase.from('sessions').select('*', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('registrations').select('*', { count: 'exact', head: true }),
        supabase.from('certificates').select('*', { count: 'exact', head: true }),
      ]);

      setStats({ students, activeSessions, registrations, certificates });

      const { data: recent } = await supabase
        .from('registrations')
        .select('registration_id, registered_at, class, registration_status, students(name, school_name), sessions(name)')
        .order('registered_at', { ascending: false })
        .limit(8);

      setRecentRegs(recent ?? []);
      setLoading(false);
    }
    fetchStats();
  }, []);

  const statusBadge = (status) => {
    if (status === 'confirmed') return <span className="badge-green">Confirmed</span>;
    if (status === 'cancelled') return <span className="badge-red">Cancelled</span>;
    return <span className="badge-yellow">Pending</span>;
  };

  const quickLinks = [
    { to: '/admin/sessions',    label: 'Manage Sessions',   desc: 'Create or edit sessions',    icon: CalendarDays, color: 'text-blue-600 bg-blue-50' },
    { to: '/admin/attendance',  label: 'Mark Attendance',   desc: 'Record attendance today',    icon: UserCheck,    color: 'text-emerald-600 bg-emerald-50' },
    { to: '/admin/certificates',label: 'Issue Certificates', desc: 'Generate new certificates', icon: Award,        color: 'text-amber-600 bg-amber-50' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-500 text-sm mt-0.5">Welcome back — here's what's happening today.</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400 bg-white border border-slate-200 rounded-xl px-3 py-2">
          <Clock size={13} />
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users}         label="Total Students"    value={stats.students}       color="bg-blue-600"    loading={loading} />
        <StatCard icon={CalendarDays}  label="Active Sessions"   value={stats.activeSessions} color="bg-emerald-600" loading={loading} trend={stats.activeSessions} />
        <StatCard icon={ClipboardList} label="Registrations"     value={stats.registrations}  color="bg-violet-600"  loading={loading} />
        <StatCard icon={Award}         label="Certificates"      value={stats.certificates}   color="bg-amber-600"   loading={loading} />
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {quickLinks.map(({ to, label, desc, icon: Icon, color }) => (
          <Link
            key={to}
            to={to}
            className="bg-white border border-slate-200 rounded-2xl p-5 hover:border-blue-300 hover:shadow-md transition-all group flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center`}>
                <Icon size={20} />
              </div>
              <div>
                <p className="font-semibold text-slate-900 text-sm">{label}</p>
                <p className="text-xs text-slate-500">{desc}</p>
              </div>
            </div>
            <ArrowRight size={16} className="text-slate-300 group-hover:text-blue-500 transition-colors" />
          </Link>
        ))}
      </div>

      {/* Recent Registrations */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp size={16} className="text-blue-600" />
            <h2 className="font-semibold text-slate-900">Recent Registrations</h2>
          </div>
          <Link to="/admin/registrations" className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 font-medium">
            View all <ArrowRight size={12} />
          </Link>
        </div>
        {loading ? (
          <div className="flex justify-center py-10"><Spinner /></div>
        ) : recentRegs.length === 0 ? (
          <div className="text-center py-10 text-slate-400">No registrations yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-header">Student</th>
                  <th className="table-header hidden md:table-cell">Session</th>
                  <th className="table-header hidden sm:table-cell">Reg ID</th>
                  <th className="table-header">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentRegs.map((r) => (
                  <tr key={r.registration_id} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="table-cell">
                      <p className="font-semibold text-slate-900">{r.students?.name}</p>
                      <p className="text-xs text-slate-400">{r.students?.school_name}</p>
                    </td>
                    <td className="table-cell hidden md:table-cell text-slate-600">{r.sessions?.name}</td>
                    <td className="table-cell font-mono text-xs hidden sm:table-cell text-slate-500">{r.registration_id}</td>
                    <td className="table-cell">{statusBadge(r.registration_status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
