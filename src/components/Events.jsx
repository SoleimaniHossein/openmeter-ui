import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Send, RefreshCw, CheckCircle, XCircle } from 'lucide-react';
import { sendEvent, getMeters, getCustomers } from '../api/openmeter';
import LoadingSpinner from './LoadingSpinner';
import SearchableSelect from './SearchableSelect';

const Events = () => {
  const [searchParams] = useSearchParams();
  const urlSubject = searchParams.get('subject') || '';

  const [meters, setMeters] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loadingMeters, setLoadingMeters] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [eventData, setEventData] = useState({
    subject: urlSubject || '',
    types: [],
    path: '/api/users',
    method: 'GET',
    count: 1,
  });

  const subjectOptions = useMemo(() => {
    const keys = new Set();
    customers.forEach((c) => {
      (c.usageAttribution?.subjectKeys || []).forEach((k) => keys.add(k));
    });
    return Array.from(keys).sort();
  }, [customers]);

  // One option per meter so every meter is visible even when several share an
  // eventType. The value is the eventType actually sent on the wire; the row
  // shows the meter name, its eventType/valueProperty, and an aggregation badge.
  const typeOptions = useMemo(
    () =>
      meters.map((m) => ({
        value: m.eventType,
        label: m.name,
        hint: `${m.eventType}${m.valueProperty ? ` · ${m.valueProperty}` : ''}`,
        badge: m.aggregation || '',
      })),
    [meters]
  );

  useEffect(() => {
    getMeters()
      .then((res) => {
        const list = res.data || [];
        setMeters(list);
        if (list.length) {
          setEventData((prev) => ({
            ...prev,
            types: prev.types.length ? prev.types : [list[0].eventType],
          }));
        }
      })
      .catch(() => {})
      .finally(() => setLoadingMeters(false));

    getCustomers({ pageSize: 200 })
      .then((res) => setCustomers(res.data || []))
      .catch(() => {});
  }, []);

  const buildEvent = (i, type) => ({
    specversion: '1.0',
    type,
    id: `event-${Date.now()}-${type}-${i}`,
    time: new Date().toISOString(),
    source: 'openmeter-ui',
    subject: eventData.subject,
    data: { path: eventData.path, method: eventData.method, count: eventData.count },
  });

  const handleSendEvent = async () => {
    setLoading(true);
    setResult(null);
    try {
      for (const t of eventData.types) {
        await sendEvent(buildEvent(0, t));
      }
      setResult({ success: true, message: `✅ Sent ${eventData.types.length} event${eventData.types.length === 1 ? '' : 's'} successfully!` });
    } catch (error) {
      setResult({ success: false, message: `❌ Failed: ${error.message}` });
    } finally { setLoading(false); }
  };

  const handleSendMultiple = async () => {
    setLoading(true);
    setResult(null);
    try {
      let success = 0;
      for (const t of eventData.types) {
        for (let i = 0; i < 5; i++) {
          await sendEvent(buildEvent(i, t));
          success++;
          await new Promise(r => setTimeout(r, 100));
        }
      }
      setResult({ success: true, message: `✅ Sent ${success} of ${eventData.types.length * 5} events successfully!` });
    } catch (error) {
      setResult({ success: false, message: `❌ Failed: ${error.message}` });
    } finally { setLoading(false); }
  };

  if (loadingMeters) return <LoadingSpinner message="Loading meters..." />;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Events</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Send usage events. The <strong>event type</strong> must match a meter's event type for the usage to be billed.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center"><Send className="w-5 h-5 mr-2 text-indigo-600" />Send Usage Event</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <SearchableSelect
              label="Customer Subject"
              value={eventData.subject}
              onChange={(v) => setEventData({ ...eventData, subject: v })}
              options={subjectOptions.map((s) => ({ value: s, label: s }))}
              placeholder="Select a customer subject"
              allowCustom
            />
            {subjectOptions.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">No customer subjects found. Add subject keys to customers first.</p>
            )}
          </div>
          <div>
            <SearchableSelect
              label="Event Type"
              multiple
              value={eventData.types}
              onChange={(v) => setEventData({ ...eventData, types: v })}
              options={typeOptions}
              placeholder="Select event type(s)"
              allowCustom
            />
            {eventData.types.length > 0 && (
              <p className="text-xs text-slate-400 mt-1">
                {eventData.types.length === 1
                  ? `Matching meters: ${meters.filter((m) => m.eventType === eventData.types[0]).map((m) => m.name).join(', ') || eventData.types[0]}`
                  : `${eventData.types.length} event type${eventData.types.length === 1 ? '' : 's'} selected — one event is sent per type.`}
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Path</label>
            <input type="text" className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-indigo-500" value={eventData.path} onChange={e => setEventData({ ...eventData, path: e.target.value })} />
          </div>
          <div>
            <SearchableSelect
              label="Method"
              value={eventData.method}
              onChange={(v) => setEventData({ ...eventData, method: v })}
              options={['GET', 'POST', 'PUT', 'DELETE'].map((m) => ({ value: m, label: m }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Count</label>
            <input type="number" min="1" className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-indigo-500" value={eventData.count} onChange={e => setEventData({ ...eventData, count: parseInt(e.target.value) || 1 })} />
          </div>
        </div>
        <div className="flex space-x-3">
          <button onClick={handleSendEvent} disabled={loading || !eventData.subject || eventData.types.length === 0} className="flex-1 bg-indigo-600 text-white py-2 rounded hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center">
            {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <><Send className="w-4 h-4 mr-2" />Send Single</>}
          </button>
          <button onClick={handleSendMultiple} disabled={loading || !eventData.subject || eventData.types.length === 0} className="flex-1 bg-emerald-600 text-white py-2 rounded hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center">
            {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <><Send className="w-4 h-4 mr-2" />Send 5 Events</>}
          </button>
        </div>
        {result && <div className={`mt-4 p-3 rounded flex items-center ${result.success ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
          {result.success ? <CheckCircle className="w-5 h-5 mr-2" /> : <XCircle className="w-5 h-5 mr-2" />}
          <span className="text-sm">{result.message}</span>
        </div>}
      </div>
    </div>
  );
};

export default Events;
