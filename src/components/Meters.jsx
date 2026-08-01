import React, { useState, useEffect, useCallback } from 'react';
import { Plus, RefreshCw, Edit2, Trash2, Eye, AlertCircle, CheckCircle, Activity, X } from 'lucide-react';
import { getMeters, createMeter, updateMeter, deleteMeter, queryMeter } from '../api/openmeter';
import LoadingSpinner from './LoadingSpinner';
import SearchableSelect from './SearchableSelect';
import { useConfirm } from '../hooks/useConfirm';

const AGGREGATIONS = ['SUM', 'COUNT', 'UNIQUE_COUNT', 'AVG', 'MIN', 'MAX', 'LATEST'];

const NEEDS_VALUE = ['SUM', 'AVG', 'MIN', 'MAX', 'UNIQUE_COUNT', 'LATEST'];

const EMPTY_FORM = {
  slug: '',
  name: '',
  description: '',
  eventType: '',
  aggregation: 'SUM',
  valueProperty: '',
  groupBy: {},
};

const Meters = () => {
  const [meters, setMeters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingMeter, setEditingMeter] = useState(null);
  const [formData, setFormData] = useState({ ...EMPTY_FORM });
  const [message, setMessage] = useState(null);
  const [saving, setSaving] = useState(false);
  const [viewingUsage, setViewingUsage] = useState(null);
  const { requestConfirm, confirmDialog } = useConfirm();

  const fetchMeters = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getMeters();
      setMeters(res.data || []);
    } catch (error) {
      setMessage({ type: 'error', text: error?.response?.data?.detail || error.message || 'Failed to load meters' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMeters(); }, [fetchMeters]);

  const resetForm = () => setFormData({ ...EMPTY_FORM });

  const handleSubmit = async () => {
    setSaving(true);
    try {
      if (editingMeter) {
        // v1 only allows updating name, description and groupBy.
        await updateMeter(editingMeter.slug, {
          name: formData.name,
          ...(formData.description ? { description: formData.description } : {}),
          ...(Object.keys(formData.groupBy).length ? { groupBy: formData.groupBy } : {}),
        });
      } else {
        await createMeter({
          slug: formData.slug,
          name: formData.name,
          eventType: formData.eventType,
          aggregation: formData.aggregation,
          ...(formData.description ? { description: formData.description } : {}),
          ...(NEEDS_VALUE.includes(formData.aggregation) && formData.valueProperty
            ? { valueProperty: formData.valueProperty }
            : {}),
          ...(Object.keys(formData.groupBy).length ? { groupBy: formData.groupBy } : {}),
        });
      }
      setShowModal(false);
      setEditingMeter(null);
      resetForm();
      setMessage({ type: 'success', text: editingMeter ? 'Meter updated successfully.' : 'Meter created successfully.' });
      fetchMeters();
    } catch (error) {
      setMessage({ type: 'error', text: error?.response?.data?.detail || error.message || 'Failed to save meter' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (meter) => {
    if (!(await requestConfirm({
      title: 'Delete meter',
      message: `Delete meter "${meter.name}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      variant: 'danger',
      icon: Trash2,
    }))) return;
    try {
      await deleteMeter(meter.slug || meter.id);
      setMessage({ type: 'success', text: 'Meter deleted.' });
      fetchMeters();
    } catch (error) {
      setMessage({ type: 'error', text: error?.response?.data?.detail || error.message || 'Failed to delete meter' });
    }
  };

  const handleEdit = (meter) => {
    setEditingMeter(meter);
    setFormData({
      slug: meter.slug,
      name: meter.name,
      description: meter.description || '',
      eventType: meter.eventType || '',
      aggregation: meter.aggregation,
      valueProperty: meter.valueProperty || '',
      groupBy: { ...(meter.groupBy || {}) },
    });
    setShowModal(true);
  };

  const handleViewUsage = async (meter) => {
    setViewingUsage(meter.id);
    setMessage(null);
    try {
      const now = new Date();
      const from = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const result = await queryMeter(meter.slug || meter.id, from.toISOString(), now.toISOString(), 'PT1H');
      const total = (result?.data || []).reduce((sum, p) => sum + (p.value || 0), 0);
      const agg = meter.aggregation?.toLowerCase() || 'count';
      setMessage({
        type: 'success',
        text: `${meter.name}: total (24h) = ${total} (${agg}${meter.valueProperty ? ' of ' + meter.valueProperty : ''})`,
      });
    } catch (error) {
      setMessage({ type: 'error', text: error?.response?.data?.detail || error.message || 'Error fetching usage' });
    } finally {
      setViewingUsage(null);
    }
  };

  const setGroupByKey = (index, field, value) => {
    const keys = Object.keys(formData.groupBy);
    const currentKey = keys[index];
    const next = { ...formData.groupBy };
    if (field === 'key') {
      if (currentKey && currentKey !== value) delete next[currentKey];
      if (value) next[value] = next[value] || '';
    } else if (currentKey) {
      next[currentKey] = value;
    }
    setFormData({ ...formData, groupBy: next });
  };

  if (loading) return <LoadingSpinner message="Loading meters..." />;

  const groupByEntries = Object.entries(formData.groupBy);
  const needsValue = NEEDS_VALUE.includes(formData.aggregation);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Meters</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Meters define how events are aggregated into usage (COUNT, SUM, AVG, ...)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchMeters}
            className="inline-flex items-center px-4 py-2.5 rounded-lg bg-white border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
          >
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </button>
          <button
            onClick={() => { setEditingMeter(null); resetForm(); setShowModal(true); }}
            className="inline-flex items-center px-4 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-medium shadow-sm hover:bg-indigo-700 transition"
          >
            <Plus className="w-4 h-4 mr-2" /> Add Meter
          </button>
        </div>
      </div>

      {message && (
        <div className={`p-3.5 rounded-lg text-sm flex items-center border ${message.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
          {message.type === 'success' ? <CheckCircle className="w-4 h-4 mr-2 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />}
          {message.text}
        </div>
      )}

      <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-700 text-sm">
        <Activity className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <p>
          For <strong>SUM / AVG / MIN / MAX</strong> meters set a <strong>valueProperty</strong> (JSONPath,
          e.g. <code className="text-xs">$.tokens</code>) pointing at the number in the event's{' '}
          <code className="text-xs">data</code>. COUNT meters count each matching event and don't need it.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Name</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Event Type</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Aggregation</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide hidden lg:table-cell">Value Property</th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {meters.length === 0 ? (
              <tr><td colSpan="5" className="px-6 py-12 text-center">
                <Activity className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-slate-500 text-sm">No meters yet. Click "Add Meter".</p>
              </td></tr>
            ) : (
              meters.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50/60 transition">
                  <td className="px-6 py-4">
                    <p className="font-medium text-slate-900">{m.name}</p>
                    <p className="font-mono text-xs text-slate-400">{m.slug}</p>
                  </td>
                  <td className="px-6 py-4 font-mono text-sm text-slate-600">{m.eventType || '-'}</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-600 text-xs font-medium">{m.aggregation}</span>
                  </td>
                  <td className="px-6 py-4 hidden lg:table-cell">
                    {m.valueProperty ? (
                      <span className="font-mono text-xs text-slate-500">{m.valueProperty}</span>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => handleViewUsage(m)}
                        disabled={viewingUsage === m.id}
                        className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg" title="View usage (24h)"
                      >
                        {viewingUsage === m.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                      </button>
                      <button onClick={() => handleEdit(m)} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg" title="Edit"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(m)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg" title="Delete"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Meter modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <h3 className="text-lg font-semibold text-slate-900">{editingMeter ? 'Edit' : 'Add'} Meter</h3>
              <button onClick={() => setShowModal(false)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg" title="Close"><X className="w-4 h-4" /></button>
            </div>
            <div className="px-6 py-4 space-y-4">
              {editingMeter && (
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                  Only <strong>name</strong>, <strong>description</strong> and <strong>group by</strong> can be
                  changed after creation. Slug, event type, aggregation and value property are immutable.
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Name</label>
                  <input
                    type="text"
                    placeholder="API Requests"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Slug (key)</label>
                  <input
                    type="text"
                    placeholder="api_requests"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                    disabled={!!editingMeter}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Event Type</label>
                  <input
                    type="text"
                    placeholder="api.request"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={formData.eventType}
                    onChange={(e) => setFormData({ ...formData, eventType: e.target.value })}
                    disabled={!!editingMeter}
                  />
                  <p className="text-xs text-slate-400 mt-1">Events whose <code>type</code> matches this are counted.</p>
                </div>
                <div>
                  <SearchableSelect
                    label="Aggregation"
                    value={formData.aggregation}
                    onChange={(v) => setFormData({ ...formData, aggregation: v })}
                    options={AGGREGATIONS.map((a) => ({ value: a, label: a }))}
                    disabled={!!editingMeter}
                  />
                </div>
              </div>

              {!editingMeter && (
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                    Value Property {needsValue && <span className="text-amber-500 normal-case">(required for {formData.aggregation})</span>}
                  </label>
                  <input
                    type="text"
                    placeholder={needsValue ? '$.tokens' : 'not used for COUNT'}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={formData.valueProperty}
                    onChange={(e) => setFormData({ ...formData, valueProperty: e.target.value })}
                    disabled={!needsValue}
                  />
                  <p className="text-xs text-slate-400 mt-1">
                    JSONPath to the numeric value in the event data, e.g. <code className="text-[11px]">$.tokens</code>{' '}
                    for SUM/AVG/MIN/MAX, or <code className="text-[11px]">$.session_id</code> for UNIQUE_COUNT.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Description</label>
                <input
                  type="text"
                  placeholder="AI Token Usage"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <div className="border-t border-slate-100 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Group By (JSONPath)</label>
                  <button
                    onClick={() => {
                      const next = { ...formData.groupBy, '': '' };
                      setFormData({ ...formData, groupBy: next });
                    }}
                    className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" /> Add
                  </button>
                </div>
                {groupByEntries.length === 0 && <p className="text-xs text-slate-400 mb-2">Optional. Group usage by event data fields, e.g. <code>model: $.model</code>.</p>}
                {groupByEntries.map(([key, value], i) => (
                  <div key={i} className="flex items-center gap-2 mb-2">
                    <input
                      type="text"
                      placeholder="model"
                      className="w-1/3 px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                      value={key}
                      onChange={(e) => setGroupByKey(i, 'key', e.target.value)}
                    />
                    <span className="text-slate-400 text-sm">→</span>
                    <input
                      type="text"
                      placeholder="$.model"
                      className="flex-1 px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                      value={value}
                      onChange={(e) => setGroupByKey(i, 'value', e.target.value)}
                    />
                    <button
                      onClick={() => {
                        const next = { ...formData.groupBy };
                        delete next[key];
                        setFormData({ ...formData, groupBy: next });
                      }}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"
                      title="Remove"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 sticky bottom-0 bg-white">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900">Cancel</button>
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
      {confirmDialog}
    </div>
  );
};

export default Meters;
