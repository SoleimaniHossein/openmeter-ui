import React, { useState, useEffect, useMemo, useRef } from 'react';
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
    type: '',
    dataJson: '',
  });

  const subjectOptions = useMemo(() => {
    const keys = new Set();
    customers.forEach((c) => {
      (c.usageAttribution?.subjectKeys || []).forEach((k) => keys.add(k));
    });
    return Array.from(keys).sort();
  }, [customers]);

  // One option per meter so every meter is visible even when several share an
  // eventType. The label shows the eventType actually sent on the wire; the
  // hint shows the meter name/valueProperty, and the badge shows the aggregation.
  const typeOptions = useMemo(
    () =>
      meters.map((m) => ({
        value: m.eventType,
        label: m.eventType,
        hint: `${m.name}${m.valueProperty ? ` · ${m.valueProperty}` : ''}`,
        badge: m.aggregation || '',
      })),
    [meters]
  );

  // Build a starter `data` object for a given event type, including the
  // valueProperty fields the meters aggregate on plus their groupBy keys.
  const dataTemplateFor = (type) => {
    const data = {};
    meters
      .filter((m) => m.eventType === type)
      .forEach((m) => {
        const leaf = (m.valueProperty || '').replace(/^\$\./, '');
        if (leaf && !(leaf in data)) data[leaf] = 1;
        Object.keys(m.groupBy || {}).forEach((key) => {
          if (!(key in data)) data[key] = '';
        });
      });
    return JSON.stringify(data, null, 2);
  };

  const generatedFor = useRef('');

  // When the event type changes, seed the JSON editor with a template for it.
  useEffect(() => {
    if (!eventData.type || meters.length === 0) return;
    if (generatedFor.current === eventData.type) return;
    generatedFor.current = eventData.type;
    setEventData((prev) => ({ ...prev, dataJson: dataTemplateFor(eventData.type) }));
  }, [eventData.type, meters]);

  useEffect(() => {
    getMeters()
      .then((res) => {
        const list = res.data || [];
        setMeters(list);
        if (list.length) {
          setEventData((prev) => ({
            ...prev,
            type: prev.type || list[0].eventType,
          }));
        }
      })
      .catch(() => {})
      .finally(() => setLoadingMeters(false));

    getCustomers({ pageSize: 200 })
      .then((res) => setCustomers(res.data || []))
      .catch(() => {});
  }, []);

  const parseData = () => {
    try {
      const obj = JSON.parse(eventData.dataJson || '{}');
      return obj && typeof obj === 'object' && !Array.isArray(obj) ? obj : null;
    } catch {
      return null;
    }
  };

  const data = parseData();

  const buildEvent = (i, type) => ({
    specversion: '1.0',
    type,
    id: `event-${Date.now()}-${type}-${i}`,
    time: new Date().toISOString(),
    source: 'openmeter-ui',
    subject: eventData.subject,
    data,
  });

  const handleSendEvent = async () => {
    setLoading(true);
    setResult(null);
    try {
      await sendEvent(buildEvent(0, eventData.type));
      setResult({ success: true, message: `✅ Sent 1 event successfully!` });
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
        await sendEvent(buildEvent(i, eventData.type));
        success++;
        await new Promise(r => setTimeout(r, 100));
      }
      setResult({ success: true, message: `✅ Sent ${success} events successfully!` });
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
              value={eventData.type}
              onChange={(v) => setEventData({ ...eventData, type: v })}
              options={typeOptions}
              placeholder="Select event type"
              allowCustom
            />
            {eventData.type && (
              <p className="text-xs text-slate-400 mt-1">
                Matching meters: {meters.filter((m) => m.eventType === eventData.type).map((m) => m.name).join(', ') || eventData.type}
              </p>
            )}
          </div>
          <div className="md:col-span-2">
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-slate-700">Event Data (JSON)</label>
              {eventData.type && (
                <button
                  type="button"
                  onClick={() => setEventData({ ...eventData, dataJson: dataTemplateFor(eventData.type) })}
                  className="text-xs text-indigo-600 font-medium hover:text-indigo-800"
                >
                  Reset to template
                </button>
              )}
            </div>
            <textarea
              spellCheck="false"
              rows="8"
              className="w-full px-3 py-2 font-mono text-sm border rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50"
              value={eventData.dataJson}
              onChange={(e) => setEventData({ ...eventData, dataJson: e.target.value })}
              placeholder='{ "method": "GET", "route": "/api", "duration_ms": 1 }'
            />
            {!data ? (
              <p className="text-xs text-red-600 mt-1">Invalid JSON — fix it before sending.</p>
            ) : (
              <p className="text-xs text-slate-400 mt-1">
                Sent as the event <code className="text-[11px]">data</code>. Include the fields your meter's{' '}
                <code className="text-[11px]">valueProperty</code> (e.g. <code className="text-[11px]">duration_ms</code>) and{' '}
                <code className="text-[11px]">groupBy</code> (e.g. <code className="text-[11px]">method</code>) expect.
              </p>
            )}
          </div>
        </div>
        <div className="flex space-x-3">
          <button onClick={handleSendEvent} disabled={loading || !eventData.subject || !eventData.type || !data} className="flex-1 bg-indigo-600 text-white py-2 rounded hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center">
            {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <><Send className="w-4 h-4 mr-2" />Send Single</>}
          </button>
          <button onClick={handleSendMultiple} disabled={loading || !eventData.subject || !eventData.type || !data} className="flex-1 bg-emerald-600 text-white py-2 rounded hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center">
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
