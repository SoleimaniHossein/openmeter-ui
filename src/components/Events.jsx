import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Send, RefreshCw, CheckCircle, XCircle, ChevronLeft, ChevronRight, Inbox, AlertTriangle, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { sendEvent, getEvents, getMeters, getCustomers } from '../api/openmeter';
import LoadingSpinner from './LoadingSpinner';
import SearchableSelect from './SearchableSelect';

const formatTime = (iso) => {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
};

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

  // Ingested events list state
  const [events, setEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventsError, setEventsError] = useState(null);
  const [typeFilter, setTypeFilter] = useState('');
  const [nextCursor, setNextCursor] = useState('');
  const [prevCursors, setPrevCursors] = useState([]);
  const [pageCursor, setPageCursor] = useState('');
  const [refetching, setRefetching] = useState(false);
  const [pageSize, setPageSize] = useState(5);
  const [totalCount, setTotalCount] = useState(null);
  const [sortKey, setSortKey] = useState('time');
  const [sortDir, setSortDir] = useState('desc');

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

  const eventTypeOptions = useMemo(() => {
    const set = new Set();
    meters.forEach((m) => m.eventType && set.add(m.eventType));
    return [
      { value: '', label: 'All types' },
      ...Array.from(set).sort().map((t) => ({ value: t, label: t })),
    ];
  }, [meters]);

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

  const fetchEvents = useCallback(async ({ cursor = '', reset = false, silent = false } = {}) => {
    if (!silent) setEventsLoading(true);
    setRefetching(true);
    setEventsError(null);
    try {
      const res = await getEvents({ type: typeFilter || undefined, cursor: cursor || undefined, limit: pageSize });
      setEvents(res.data || []);
      setNextCursor(res.nextCursor || '');
      setTotalCount(typeof res.totalCount === 'number' ? res.totalCount : null);
      if (reset) {
        setPageCursor('');
        setPrevCursors([]);
      }
    } catch (error) {
      setEventsError(error?.response?.data?.detail || error.message || 'Failed to load events');
      if (!silent) setEvents([]);
    } finally {
      if (!silent) setEventsLoading(false);
      setRefetching(false);
    }
  }, [typeFilter, pageSize]);

  useEffect(() => {
    fetchEvents({ reset: true });
  }, [fetchEvents]);

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
      fetchEvents({ reset: true });
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
      fetchEvents({ reset: true });
    } catch (error) {
      setResult({ success: false, message: `❌ Failed: ${error.message}` });
    } finally { setLoading(false); }
  };

const getSortValue = (ev) => {
    const e = ev.event || {};
    switch (sortKey) {
      case 'time': return e.time ? new Date(e.time).getTime() : -Infinity;
      case 'type': return e.type || '';
      case 'subject': return e.subject || '';
      case 'source': return e.source || '';
      case 'id': return e.id || '';
      case 'ingested': return ev.ingestedAt ? new Date(ev.ingestedAt).getTime() : -Infinity;
      case 'status': return ev.validationError ? 1 : 0;
      default: return 0;
    }
  };

  const sortedEvents = useMemo(() => {
    const arr = [...events];
    arr.sort((a, b) => {
      const va = getSortValue(a);
      const vb = getSortValue(b);
      let cmp;
      if (typeof va === 'number' && typeof vb === 'number') cmp = va - vb;
      else cmp = String(va).localeCompare(String(vb));
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [events, sortKey, sortDir, getSortValue]);

  if (loadingMeters) return <LoadingSpinner message="Loading meters..." />;

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  };

  const Sortable = ({ label, col, className = '' }) => (
    <th className={`px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide ${className}`}>
      <button type="button" onClick={() => { toggleSort(col); }} className="inline-flex items-center gap-1 hover:text-indigo-700 dark:hover:text-indigo-300 transition uppercase">
        {label}
        {sortKey === col ? (sortDir === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" /> : <ArrowDown className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />) : <ArrowUpDown className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600" />}
      </button>
    </th>
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Events</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Send usage events. The <strong>event type</strong> must match a meter's event type for the usage to be billed.
        </p>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center"><Send className="w-5 h-5 mr-2 text-indigo-600 dark:text-indigo-400" />Send Usage Event</h3>
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
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">No customer subjects found. Add subject keys to customers first.</p>
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
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                Matching meters: {meters.filter((m) => m.eventType === eventData.type).map((m) => m.name).join(', ') || eventData.type}
              </p>
            )}
          </div>
          <div className="md:col-span-2">
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Event Data (JSON)</label>
              {eventData.type && (
                <button
                  type="button"
                  onClick={() => setEventData({ ...eventData, dataJson: dataTemplateFor(eventData.type) })}
                  className="text-xs text-indigo-600 dark:text-indigo-400 font-medium hover:text-indigo-800 dark:hover:text-indigo-300"
                >
                  Reset to template
                </button>
              )}
            </div>
            <textarea
              spellCheck="false"
              rows="8"
              className="w-full px-3 py-2 font-mono text-sm border border-slate-300 dark:border-slate-600 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
              value={eventData.dataJson}
              onChange={(e) => setEventData({ ...eventData, dataJson: e.target.value })}
              placeholder='{ "method": "GET", "route": "/api", "duration_ms": 1 }'
            />
            {!data ? (
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">Invalid JSON — fix it before sending.</p>
            ) : (
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
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
        {result && <div className={`mt-4 p-3 rounded flex items-center ${result.success ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400'}`}>
          {result.success ? <CheckCircle className="w-5 h-5 mr-2" /> : <XCircle className="w-5 h-5 mr-2" />}
          <span className="text-sm">{result.message}</span>
        </div>}
      </div>

      {/* Ingested events list */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 className="text-lg font-semibold flex items-center"><Inbox className="w-5 h-5 mr-2 text-indigo-600 dark:text-indigo-400" />Ingested Events</h3>
          <div className="flex items-center gap-3">
            <div className="w-48">
              <SearchableSelect
                label=""
                value={typeFilter}
                onChange={setTypeFilter}
                options={eventTypeOptions}
                placeholder="All types"
              />
            </div>
            <button
              onClick={() => fetchEvents({ reset: true, silent: true })}
              disabled={refetching}
              className="inline-flex items-center px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition disabled:opacity-60 disabled:cursor-wait"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${refetching ? 'animate-spin text-indigo-600 dark:text-indigo-400' : ''}`} /> {refetching ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>

        {eventsError && (
          <div className="p-3.5 rounded-lg text-sm flex items-center bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-400 mb-4">
            <AlertTriangle className="w-4 h-4 mr-2 flex-shrink-0" /> {eventsError}
          </div>
        )}

        {refetching && (
          <div className="relative h-1 mb-3 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden" aria-hidden="true">
            <div className="absolute inset-y-0 left-0 w-1/3 bg-indigo-600 rounded-full animate-pulse" />
          </div>
        )}

        {eventsLoading ? (
          <div className="py-8 flex justify-center">
            <LoadingSpinner size="md" message="Loading events..." />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto -mx-6 px-6">
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <Sortable label="Time" col="time" />
                    <Sortable label="Type" col="type" />
                    <Sortable label="Subject" col="subject" />
                    <Sortable label="Source" col="source" className="hidden md:table-cell" />
                    <Sortable label="ID" col="id" className="hidden lg:table-cell" />
                    <Sortable label="Ingested" col="ingested" />
                    <Sortable label="Status" col="status" className="text-right" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {events.length === 0 ? (
                    <tr><td colSpan="7" className="px-6 py-12 text-center">
                      <Inbox className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                      <p className="text-slate-500 dark:text-slate-400 text-sm">No events found{typeFilter ? ` for type "${typeFilter}"` : ''}. Send one above!</p>
                    </td></tr>
                  ) : (
                    sortedEvents.map((ev, i) => {
                      const e = ev.event || {};
                      return (
                        <tr key={e.id || `${ev.ingestedAt}-${i}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/60/60 dark:hover:bg-slate-800/40 transition">
                          <td className="px-6 py-3 text-sm text-slate-600 dark:text-slate-300 whitespace-nowrap">{formatTime(e.time)}</td>
                          <td className="px-6 py-3">
                            <span className="inline-flex px-2.5 py-1 rounded-md bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-medium">{e.type || '-'}</span>
                          </td>
                          <td className="px-6 py-3 font-mono text-sm text-slate-700 dark:text-slate-200">{e.subject || '-'}</td>
                          <td className="px-6 py-3 font-mono text-sm text-slate-500 dark:text-slate-400 hidden md:table-cell">{e.source || '-'}</td>
                          <td className="px-6 py-3 font-mono text-xs text-slate-400 dark:text-slate-500 hidden lg:table-cell">{e.id ? `${e.id.slice(0, 12)}…` : '-'}</td>
                          <td className="px-6 py-3 text-sm text-slate-500 dark:text-slate-400 whitespace-nowrap">{formatTime(ev.ingestedAt)}</td>
                          <td className="px-6 py-3 text-right">
                            {ev.validationError ? (
                              <span className="inline-flex px-2.5 py-1 rounded-md bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 text-xs font-medium" title={ev.validationError}>Invalid</span>
                            ) : (
                              <span className="inline-flex px-2.5 py-1 rounded-md bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs font-medium">OK</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between border-t border-slate-100 dark:border-slate-800 mt-4 pt-4 gap-3">
              <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
                <span>Rows per page:</span>
                <div className="w-24">
                  <SearchableSelect
                    label=""
                    value={pageSize}
                    onChange={(v) => setPageSize(Number(v))}
                    options={[5, 10, 20, 50, 100].map((s) => ({ value: s, label: `${s}` }))}
                    placeholder="5"
                  />
                </div>
                {totalCount != null ? (
                  <span>{totalCount} total event{totalCount === 1 ? '' : 's'}</span>
                ) : (
                  <span>{events.length} event{events.length === 1 ? '' : 's'} loaded</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const prev = prevCursors[prevCursors.length - 1];
                    if (prev === undefined) return;
                    setPrevCursors((list) => list.slice(0, -1));
                    setPageCursor(prev);
                    fetchEvents({ cursor: prev });
                  }}
                  disabled={prevCursors.length === 0 || eventsLoading}
                  className="inline-flex items-center px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" /> Prev
                </button>
                <button
                  onClick={() => {
                    if (!nextCursor) return;
                    setPrevCursors((prev) => [...prev, pageCursor]);
                    setPageCursor(nextCursor);
                    fetchEvents({ cursor: nextCursor });
                  }}
                  disabled={!nextCursor || eventsLoading}
                  className="inline-flex items-center px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next <ChevronRight className="w-4 h-4 ml-1" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Events;
