import React, { useState } from 'react';
import { Send, RefreshCw, CheckCircle, XCircle } from 'lucide-react';
import { sendEvent } from '../api/openmeter';
import LoadingSpinner from './LoadingSpinner';

const Events = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [eventData, setEventData] = useState({
    subject: 'customer_123',
    type: 'api_requests',
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
        type: eventData.type,
        id: `event-${Date.now()}`,
        time: new Date().toISOString(),
        source: 'openmeter-ui',
        subject: eventData.subject,
        data: { path: eventData.path, method: eventData.method, count: eventData.count },
      };
      await sendEvent(event);
      setResult({ success: true, message: '✅ Event sent successfully!' });
    } catch (error) {
      setResult({ success: false, message: `❌ Failed: ${error.message}` });
    } finally { setLoading(false); }
  };

  const handleSendMultiple = async () => {
    setLoading(true);
    setResult(null);
    try {
      let success = 0;
      for (let i = 0; i < 5; i++) {
        const event = {
          specversion: '1.0',
          type: eventData.type,
          id: `event-${Date.now()}-${i}`,
          time: new Date().toISOString(),
          source: 'openmeter-ui',
          subject: eventData.subject,
          data: { path: eventData.path, method: eventData.method, count: eventData.count },
        };
        await sendEvent(event);
        success++;
        await new Promise(r => setTimeout(r, 100));
      }
      setResult({ success: true, message: `✅ Sent ${success} of 5 events successfully!` });
    } catch (error) {
      setResult({ success: false, message: `❌ Failed: ${error.message}` });
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center"><Send className="w-5 h-5 mr-2 text-blue-600" />Send Usage Event</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Customer Subject</label>
            <input type="text" className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500" value={eventData.subject} onChange={e => setEventData({ ...eventData, subject: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Event Type</label>
            <input type="text" className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500" value={eventData.type} onChange={e => setEventData({ ...eventData, type: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Path</label>
            <input type="text" className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500" value={eventData.path} onChange={e => setEventData({ ...eventData, path: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Method</label>
            <select className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500" value={eventData.method} onChange={e => setEventData({ ...eventData, method: e.target.value })}>
              <option value="GET">GET</option><option value="POST">POST</option><option value="PUT">PUT</option><option value="DELETE">DELETE</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Count</label>
            <input type="number" min="1" className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500" value={eventData.count} onChange={e => setEventData({ ...eventData, count: parseInt(e.target.value) || 1 })} />
          </div>
        </div>
        <div className="flex space-x-3">
          <button onClick={handleSendEvent} disabled={loading} className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center">
            {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <><Send className="w-4 h-4 mr-2" />Send Single</>}
          </button>
          <button onClick={handleSendMultiple} disabled={loading} className="flex-1 bg-green-600 text-white py-2 rounded hover:bg-green-700 transition disabled:opacity-50 flex items-center justify-center">
            {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <><Send className="w-4 h-4 mr-2" />Send 5 Events</>}
          </button>
        </div>
        {result && <div className={`mt-4 p-3 rounded flex items-center ${result.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {result.success ? <CheckCircle className="w-5 h-5 mr-2" /> : <XCircle className="w-5 h-5 mr-2" />}
          <span className="text-sm">{result.message}</span>
        </div>}
      </div>
    </div>
  );
};

export default Events;
