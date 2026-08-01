import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Activity,
  Send,
  FileText,
  Settings,
  LogOut,
  Zap,
  Layers,
  Package,
} from 'lucide-react';

const Layout = ({ children, onLogout }) => {
  const location = useLocation();

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Meters', href: '/meters', icon: Activity },
    { name: 'Features', href: '/features', icon: Layers },
    { name: 'Plans', href: '/plans', icon: Package },
    { name: 'Customers', href: '/customers', icon: Users },
    { name: 'Events', href: '/events', icon: Send },
    { name: 'Invoices', href: '/invoices', icon: FileText },
    { name: 'Settings', href: '/settings', icon: Settings },
  ];

  const isActive = (href) =>
    location.pathname === href ||
    (href !== '/dashboard' && location.pathname.startsWith(href));

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 w-64 bg-white border-r border-slate-200 z-50 flex flex-col">
        <div className="flex items-center gap-2.5 px-5 h-16 border-b border-slate-100">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 shadow-sm">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900 leading-tight">OpenMeter</h1>
            <p className="text-[11px] text-slate-400 leading-tight">Admin Console</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Management
          </p>
          {navigation.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.name}
                to={item.href}
                className={`group flex items-center px-3 py-2.5 rounded-lg mb-0.5 transition ${
                  active
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Icon
                  className={`w-5 h-5 mr-3 transition ${
                    active ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-500'
                  }`}
                />
                <span className="text-sm font-medium">{item.name}</span>
                {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-500" />}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-100">
          <button
            onClick={onLogout}
            className="flex items-center w-full px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-red-50 hover:text-red-600 transition"
          >
            <LogOut className="w-5 h-5 mr-3 text-slate-400" />
            Disconnect
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="ml-64 flex flex-col min-h-screen">
        <header className="bg-white/80 backdrop-blur border-b border-slate-200 sticky top-0 z-40">
          <div className="px-8 py-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-slate-900">
              {navigation.find((n) => isActive(n.href))?.name || 'Dashboard'}
            </h2>
            <span className="text-xs text-slate-400">
              OpenMeter API v1
            </span>
          </div>
        </header>
        <main className="p-6 lg:p-8 flex-1">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
