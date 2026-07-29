import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { setApiToken, getApiToken } from './api/openmeter';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import Meters from './components/Meters';
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
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-md">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-gray-800">OpenMeter Admin</h1>
            <p className="text-gray-600 mt-1">Enter your API token to connect</p>
          </div>
          <input
            type="password"
            placeholder="API Token"
            className="w-full px-4 py-2 border rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleLogin(e.target.value);
            }}
          />
          <button
            onClick={(e) => handleLogin(e.target.previousElementSibling.value)}
            className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition"
          >
            Connect
          </button>
          <p className="text-xs text-gray-400 mt-4 text-center">
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
