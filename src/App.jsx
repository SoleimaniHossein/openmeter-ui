import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Zap } from 'lucide-react';
import { setApiToken, getApiToken } from './api/openmeter';
import Layout from './components/Layout';
import ThemeToggle from './components/ThemeToggle';
import Dashboard from './components/Dashboard';
import Meters from './components/Meters';
import Features from './components/Features';
import Plans from './components/Plans';
import Customers from './components/Customers';
import Events from './components/Events';
import Invoices from './components/Invoices';
import Settings from './components/Settings';

function App() {
  const [apiToken, setApiTokenState] = useState(getApiToken());
  const [isAuthenticated, setIsAuthenticated] = useState(!!apiToken);

  const handleLogin = (token) => {
    if (token && token.trim()) {
      setApiToken(token.trim());
      setApiTokenState(token.trim());
      setIsAuthenticated(true);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('openmeter_token');
    setApiTokenState('');
    setIsAuthenticated(false);
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-950 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-64 bg-gradient-to-br from-indigo-600/20 via-violet-600/10 to-transparent pointer-events-none" />
        <div className="absolute top-5 right-5 z-10">
          <ThemeToggle />
        </div>
        <div className="relative bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-xl dark:shadow-black/40 w-full max-w-md border border-slate-200 dark:border-slate-800">
          <div className="text-center mb-6">
            <div className="flex items-center justify-center w-12 h-12 mx-auto rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-sm mb-3">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white">OpenMeter Admin</h1>
            <p className="text-gray-500 dark:text-slate-400 mt-1 text-sm">Enter your API token to connect</p>
          </div>
          <input
            type="password"
            placeholder="API Token"
            className="w-full px-4 py-2.5 border rounded-lg mb-4 bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleLogin(e.target.value);
            }}
          />
          <button
            onClick={(e) => handleLogin(e.target.previousElementSibling.value)}
            className="w-full bg-indigo-600 text-white py-2.5 rounded-lg hover:bg-indigo-700 transition font-medium"
          >
            Connect
          </button>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-4 text-center">
            Token is stored locally in your browser
          </p>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Layout onLogout={handleLogout}>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/meters" element={<Meters />} />
          <Route path="/features" element={<Features />} />
          <Route path="/plans" element={<Plans />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/events" element={<Events />} />
          <Route path="/invoices" element={<Invoices />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
