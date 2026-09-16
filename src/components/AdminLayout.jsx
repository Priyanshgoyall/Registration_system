import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  ClipboardList,
  CheckSquare,
  Award,
  LogOut,
  GraduationCap,
  Menu,
  X,
  UserCog,
  CreditCard,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

const navItems = [
  { to: '/admin',               label: 'Dashboard',      icon: LayoutDashboard, exact: true },
  { to: '/admin/sessions',      label: 'Sessions',        icon: CalendarDays },
  { to: '/admin/students',      label: 'Students',        icon: Users },
  { to: '/admin/registrations', label: 'Registrations',   icon: ClipboardList },
  { to: '/admin/id-cards',      label: 'ID Cards',        icon: CreditCard, adminOnly: true },
  { to: '/admin/attendance',    label: 'Attendance',      icon: CheckSquare },
  { to: '/admin/certificates',  label: 'Certificates',    icon: Award },
  { to: '/admin/coordinators',  label: 'Coordinators',    icon: UserCog, adminOnly: true },
];

export default function AdminLayout({ children }) {
  const { user, profile, role, signOut } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/admin/login');
  };

  const filteredNavItems = navItems.filter((item) => {
    if (item.adminOnly && role !== 'admin') {
      return false;
    }
    return true;
  });

  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-slate-100">
        <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0 shadow-sm">
          <GraduationCap size={20} className="text-white" />
        </div>
        <div>
          <p className="text-sm font-bold text-slate-900 leading-tight">Admin Portal</p>
          <p className="text-xs text-slate-400">Management Portal</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto scrollbar-thin">
        {filteredNavItems.map(({ to, label, icon: Icon, exact }) => (
          <NavLink
            key={to}
            to={to}
            end={exact}
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) => isActive ? 'sidebar-link-active' : 'sidebar-link'}
          >
            <Icon size={18} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* User + Sign out */}
      <div className="p-3 border-t border-slate-100">
        <div className="px-3 py-2 mb-1 bg-slate-50 border border-slate-100 rounded-xl">
          <p className="text-xs text-slate-900 font-semibold truncate">
            {profile?.full_name || 'User Account'}
          </p>
          <p className="text-[11px] text-slate-400 truncate mb-1">{user?.email}</p>
          <div className="flex items-center justify-between">
            <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
              role === 'coordinator' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
            }`}>
              {role}
            </span>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="sidebar-link w-full text-red-500 hover:text-red-700 hover:bg-red-50"
        >
          <LogOut size={16} />
          <span>Sign Out</span>
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col w-60 flex-shrink-0 bg-white border-r border-slate-200 shadow-sm">
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex animate-fade-in">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="relative flex flex-col w-64 bg-white border-r border-slate-200 z-50 animate-slide-up shadow-2xl">
            <button
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              onClick={() => setSidebarOpen(false)}
            >
              <X size={18} />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar (mobile) */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-slate-200 shadow-sm flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100"
          >
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2">
            <GraduationCap size={18} className="text-blue-600" />
            <span className="font-semibold text-slate-900 text-sm">Management Portal</span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto scrollbar-thin p-6 bg-slate-50">
          {children}
        </main>
      </div>
    </div>
  );
}
