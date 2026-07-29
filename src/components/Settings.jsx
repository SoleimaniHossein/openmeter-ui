import React, { useState } from 'react';
import { Save, Key, RefreshCw, CheckCircle, XCircle } from 'lucide-react';
import { setApiToken, getApiToken, getMeters } from '../api/openmeter';

const Settings = () => {
  const [apiToken, setApiTokenState] = useState(getApiToken() || '');
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const handleSaveToken = () => {
    if (apiToken && apiToken.trim()) {
      setApiToken(apiToken.trim());
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      // Save token first if changed
      if (apiToken && apiToken.trim() !== getApiToken()) {
        setApiToken(apiToken.trim());
      }
      // Try to fetch meters
      const result = await getMeters();
      if (result && result.data !== undefined) {
        setTestResult({ 
          success: true, 
          message: `✅ Connection successful! Found ${result.data.length} meters.` 
        });
      } else {
        setTestResult({ 
          success: false, 
          message: '❌ Connection failed: Invalid response' 
        });
      }
    } catch (error) {
      setTestResult({ 
        success: false, 
        message: `❌ Connection failed: ${error.message || 'Unknown error'}` 
      });
    } finally { 
      setTesting(false); 
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <Key className="w-5 h-5 mr-2 text-blue-600" />
          API Settings
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              API Token
            </label>
            <input 
              type="password" 
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono" 
              value={apiToken} 
              onChange={e => setApiTokenState(e.target.value)} 
            />
            <p className="text-xs text-gray-400 mt-1">
              Token is stored locally in your browser
            </p>
          </div>
          <div className="flex space-x-3">
            <button 
              onClick={handleSaveToken} 
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
            >
              <Save className="w-4 h-4 mr-2" /> Save Token
            </button>
            <button 
              onClick={handleTestConnection} 
              disabled={testing} 
              className="flex items-center px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition disabled:opacity-50"
            >
              {testing && <RefreshCw className="w-4 h-4 mr-2 animate-spin" />}
              Test Connection
            </button>
          </div>
          {saved && (
            <div className="flex items-center text-green-600 bg-green-50 p-2 rounded">
              <CheckCircle className="w-4 h-4 mr-2" />
              Token saved successfully!
            </div>
          )}
          {testResult && (
            <div className={`flex items-center ${testResult.success ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'} p-2 rounded`}>
              {testResult.success ? <CheckCircle className="w-4 h-4 mr-2" /> : <XCircle className="w-4 h-4 mr-2" />}
              {testResult.message}
            </div>
          )}
        </div>
      </div>
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">About</h3>
        <p className="text-gray-600 text-sm">OpenMeter Admin UI v1.0</p>
        <p className="text-gray-500 text-xs mt-1">Connects to OpenMeter API v3</p>
        <p className="text-gray-500 text-xs">All API requests go through Vite proxy to avoid CORS issues</p>
      </div>
    </div>
  );
};

export default Settings;
