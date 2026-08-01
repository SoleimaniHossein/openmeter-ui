import React, { useState } from 'react';
import { Send, RefreshCw, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { sendEvent } from '../api/openmeter';
import SearchableSelect from './SearchableSelect';

const SendEvent = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [eventData, setEventData] = useState({
    subject: 'customer_123',
    path: '/api/users',
    method: 'GET',
    count: 1,
  });

  const handleSendEvent = async () => {
    setLoading(true);
    setResult(null);
    
    try {
      const event = {
        specversion: '1.0',
        type: 'api_requests',
        id: `event-${Date.now()}`,
        time: new Date().toISOString(),
        source: 'openmeter-ui',
        subject: eventData.subject,
        data: {
          path: eventData.path,
          method: eventData.method,
          count: eventData.count,
        },
      };
      
      const response = await sendEvent(event);
      setResult({ 
        success: true, 
        message: '✅ Event sent successfully!', 
        response,
        details: `Status: ${response?.status || 'Accepted'}`
      });
    } catch (error) {
      setResult({ 
        success: false, 
        message: `❌ Failed to send event: ${error.message}`,
        details: 'Check that your OpenMeter server is running and the event endpoint is available'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSendMultiple = async () => {
    setLoading(true);
    setResult(null);
    
    try {
      const events = [];
      for (let i = 0; i < 5; i++) {
        events.push({
          specversion: '1.0',
          type: 'api_requests',
          id: `event-${Date.now()}-${i}`,
          time: new Date().toISOString(),
          source: 'openmeter-ui',
          subject: eventData.subject,
          data: {
            path: eventData.path,
            method: eventData.method,
            count: eventData.count,
          },
        });
      }
      
      let successCount = 0;
      for (const event of events) {
        try {
          await sendEvent(event);
          successCount++;
        } catch (e) {
          console.warn('Failed to send event:', e);
        }
        // Small delay between events
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      setResult({ 
        success: true, 
        message: `✅ Sent ${successCount} of ${events.length} events successfully!`,
        details: `Customer: ${eventData.subject}`
      });
    } catch (error) {
      setResult({ 
        success: false, 
        message: `❌ Failed to send events: ${error.message}`,
        details: 'Check your connection to OpenMeter'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <Send className="w-5 h-5 mr-2 text-blue-600" />
          Send Usage Event
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Customer Subject *
            </label>
            <input
              type="text"
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={eventData.subject}
              onChange={(e) => setEventData({ ...eventData, subject: e.target.value })}
              placeholder="e.g., customer_123"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Path
            </label>
            <input
              type="text"
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={eventData.path}
              onChange={(e) => setEventData({ ...eventData, path: e.target.value })}
              placeholder="/api/users"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Method
            </label>
            <SearchableSelect
              label="Method"
              value={eventData.method}
              onChange={(v) => setEventData({ ...eventData, method: v })}
              options={['GET', 'POST', 'PUT', 'DELETE'].map((m) => ({ value: m, label: m }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Count
            </label>
            <input
              type="number"
              min="1"
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={eventData.count}
              onChange={(e) => setEventData({ ...eventData, count: parseInt(e.target.value) || 1 })}
            />
          </div>
        </div>

        <div className="flex space-x-3">
          <button
            onClick={handleSendEvent}
            disabled={loading || !eventData.subject}
            className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center"
          >
            {loading ? (
              <>
                <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="w-5 h-5 mr-2" />
                Send Single Event
              </>
            )}
          </button>
          <button
            onClick={handleSendMultiple}
            disabled={loading || !eventData.subject}
            className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition disabled:opacity-50 flex items-center justify-center"
          >
            {loading ? (
              <>
                <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="w-5 h-5 mr-2" />
                Send 5 Events
              </>
            )}
          </button>
        </div>

        {result && (
          <div className={`mt-4 p-4 rounded-lg ${
            result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
          }`}>
            <div className="flex items-start">
              {result.success ? (
                <CheckCircle className="w-5 h-5 text-green-600 mr-2 flex-shrink-0 mt-0.5" />
              ) : (
                <XCircle className="w-5 h-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
              )}
              <div>
                <p className={`font-semibold ${result.success ? 'text-green-700' : 'text-red-700'}`}>
                  {result.message}
                </p>
                {result.details && (
                  <p className={`text-sm mt-1 ${result.success ? 'text-green-600' : 'text-red-600'}`}>
                    {result.details}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <AlertCircle className="w-5 h-5 text-blue-600 mr-2 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-700">
            <p className="font-semibold">How it works:</p>
            <ul className="list-disc list-inside mt-1 space-y-1">
              <li>Events are sent to OpenMeter for tracking</li>
              <li>Each event counts as a usage record</li>
              <li>Use the <strong>subject</strong> field to identify the customer</li>
              <li>Check the dashboard to see usage data</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SendEvent;
