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
  Zap
} from 'lucide-react';

const Layout = ({ children, onLogout }) => {
  const location = useLocation();
  
  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Meters', href: '/meters', icon: Activity },
    { name: 'Customers', href: '/customers', icon: Users },
    { name: 'Events', href: '/events', icon: Send },
    { name: 'Invoices', href: '/invoices', icon: FileText },
    { name: 'Settings', href: '/settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="fixed inset-y-0 left-0 w-64 bg-white shadow-lg z-50">
        <div className="flex items-center justify-center h-16 border-b">
          <Zap className="w-8 h-8 text-blue-600 mr-2" />
          <h1 className="text-xl font-bold text-gray-800">OpenMeter</h1>
        </div>
        <nav className="mt-6 px-4">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={`flex items-center px-4 py-3 rounded-lg mb-1 transition ${
                  isActive
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Icon className={`w-5 h-5 mr-3 ${isActive ? 'text-blue-600' : 'text-gray-400'}`} />
                {item.name}
              </Link>
            );
          })}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t">
          <button
            onClick={onLogout}
            className="flex items-center text-gray-600 hover:text-gray-800 w-full px-4 py-2 rounded-lg hover:bg-gray-50 transition"
          >
            <LogOut className="w-5 h-5 mr-3" />
            Disconnect
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="ml-64">
        <header className="bg-white shadow-sm">
          <div className="px-8 py-4">
            <h2 className="text-xl font-semibold text-gray-800">
              {navigation.find(n => n.href === location.pathname)?.name || 'Dashboard'}
            </h2>
          </div>
        </header>
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
