import React, { useState } from 'react';
import { Save, Key, RefreshCw, CheckCircle, XCircle, Server } from 'lucide-react';
import { setApiToken, getApiToken, getMeters, getApiProxyTarget, setApiProxyTarget, getEffectiveProxyTarget } from '../api/openmeter';
import { describeApiError } from '../utils/errors';
import TextBox from './TextBox';

const DEFAULT_PROXY_TARGET = import.meta.env.VITE_API_PROXY_TARGET || '';

const Settings = () => {
  const [apiToken, setApiTokenState] = useState(getApiToken() || '');
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [proxyTarget, setProxyTargetState] = useState(getApiProxyTarget() || DEFAULT_PROXY_TARGET);
  const [proxySaved, setProxySaved] = useState(false);

  const handleSaveToken = () => {
    if (apiToken && apiToken.trim()) {
      setApiToken(apiToken.trim());
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
  };

  const handleSaveProxyTarget = () => {
    setApiProxyTarget(proxyTarget);
    setProxySaved(true);
    setTimeout(() => setProxySaved(false), 3000);
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
          message: `✅ Connection successful! Found ${result.data.length} meters. (via ${getEffectiveProxyTarget()})` 
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
        message: `❌ Connection failed: ${describeApiError(error, 'Unknown error')}` 
      });
    } finally { 
      setTesting(false); 
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <Key className="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" />
          API Settings
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">
              API Token
            </label>
            <TextBox 
              type="password" 
              className="w-full font-mono" 
              value={apiToken} 
              onChange={e => setApiTokenState(e.target.value)} 
            />
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
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
              className="flex items-center px-4 py-2 bg-gray-600 dark:bg-slate-600 text-white rounded hover:bg-gray-700 dark:hover:bg-slate-500 transition disabled:opacity-50"
            >
              {testing && <RefreshCw className="w-4 h-4 mr-2 animate-spin" />}
              Test Connection
            </button>
          </div>
          {saved && (
            <div className="flex items-center text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-500/10 p-2 rounded">
              <CheckCircle className="w-4 h-4 mr-2" />
              Token saved successfully!
            </div>
          )}
          {testResult && (
            <div className={`flex items-center ${testResult.success ? 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-500/10' : 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10'} p-2 rounded`}>
              {testResult.success ? <CheckCircle className="w-4 h-4 mr-2" /> : <XCircle className="w-4 h-4 mr-2" />}
              {testResult.message}
            </div>
          )}
        </div>
      </div>
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <Server className="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" />
          API Proxy Target
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">
              API Proxy Target
            </label>
            <TextBox 
              type="text" 
              className="w-full font-mono" 
              value={proxyTarget} 
              onChange={e => setProxyTargetState(e.target.value)} 
              placeholder={DEFAULT_PROXY_TARGET}
            />
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
              Defaults to the value from .env ({DEFAULT_PROXY_TARGET || '/api'}). Sets which OpenMeter backend the app connects to.
              Requests go through the Vite proxy, which forwards them to this target — no CORS headers needed. Leave empty to use the default.
              Stored locally in your browser.
            </p>
          </div>
          <div className="flex space-x-3">
            <button 
              onClick={handleSaveProxyTarget} 
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
            >
              <Save className="w-4 h-4 mr-2" /> Save Proxy Target
            </button>
          </div>
          {proxySaved && (
            <div className="flex items-center text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-500/10 p-2 rounded">
              <CheckCircle className="w-4 h-4 mr-2" />
              Proxy target saved successfully!
            </div>
          )}
        </div>
      </div>
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">About</h3>
        <p className="text-gray-600 dark:text-slate-300 text-sm">OpenMeter Admin UI v1.0</p>
        <p className="text-gray-500 dark:text-slate-400 text-xs mt-1">Connects to OpenMeter API v3</p>
        <p className="text-gray-500 dark:text-slate-400 text-xs">All API requests go through Vite proxy to avoid CORS issues</p>      </div>
    </div>
  );
};

export default Settings;
