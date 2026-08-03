import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  RefreshCw,
  Trash2,
  AlertCircle,
  CheckCircle,
  Layers,
  X,
  Archive,
  Filter,
} from 'lucide-react';
import { getFeatures, createFeature, deleteFeature, getMeters } from '../api/openmeter';
import LoadingSpinner from './LoadingSpinner';
import SearchableSelect from './SearchableSelect';
import TextBox from './TextBox';
import { useConfirm } from '../hooks/useConfirm';

const EMPTY_FILTER = { property: '', value: '' };

const EMPTY_FORM = { key: '', name: '', meterSlug: '', meterGroupByFilters: [] };

const parseFilters = (filters) =>
  filters
    .filter((f) => f.property.trim())
    .reduce((acc, f) => {
      acc[f.property.trim()] = f.value.trim();
      return acc;
    }, {});

const Features = () => {
  const [features, setFeatures] = useState([]);
  const [meters, setMeters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ ...EMPTY_FORM });
  const [message, setMessage] = useState(null);
  const [saving, setSaving] = useState(false);
  const { requestConfirm, confirmDialog } = useConfirm();

  const fetchFeatures = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getFeatures({ includeArchived });
      setFeatures(res.data || []);
    } catch (error) {
      setMessage({ type: 'error', text: error?.response?.data?.detail || error.message || 'Failed to load features' });
    } finally {
      setLoading(false);
    }
  }, [includeArchived]);

  useEffect(() => {
    fetchFeatures();
    getMeters()
      .then((res) => setMeters(res.data || []))
      .catch(() => {});
  }, [fetchFeatures]);

  const showMessage = (type, text) => {
    setMessage({ type, text });
    window.setTimeout(() => setMessage(null), 5000);
  };

  const handleSubmit = async () => {
    if (!formData.key.trim() || !formData.name.trim()) {
      showMessage('error', 'Key and Name are required.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        key: formData.key.trim(),
        name: formData.name.trim(),
        ...(formData.meterSlug ? { meterSlug: formData.meterSlug } : {}),
        ...(formData.meterGroupByFilters.length
          ? { meterGroupByFilters: parseFilters(formData.meterGroupByFilters) }
          : {}),
      };
      await createFeature(payload);
      setShowModal(false);
      setFormData({ ...EMPTY_FORM });
      showMessage('success', `Feature "${formData.name.trim()}" created successfully.`);
      fetchFeatures();
    } catch (error) {
      showMessage('error', error?.response?.data?.detail || error.message || 'Failed to create feature');
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async (feature) => {
    try {
      await requestConfirm({
        title: 'Archive feature',
        message: `Archive "${feature.name}"? This is permanent and cannot be undone. Existing entitlements are left intact, but no new entitlements can be created for it.`,
        confirmLabel: 'Archive',
        variant: 'danger',
        icon: Archive,
        action: async () => {
          await deleteFeature(feature.id);
          showMessage('success', `Feature "${feature.name}" has been archived.`);
          fetchFeatures();
        },
      });
    } catch (error) {
      showMessage('error', error?.response?.data?.detail || error.message || 'Failed to archive feature');
    }
  };

  const setFilter = (index, patch) => {
    const next = formData.meterGroupByFilters.map((f, i) => (i === index ? { ...f, ...patch } : f));
    setFormData({ ...formData, meterGroupByFilters: next });
  };

  const addFilter = () =>
    setFormData({ ...formData, meterGroupByFilters: [...formData.meterGroupByFilters, { ...EMPTY_FILTER }] });

  const removeFilter = (index) =>
    setFormData({
      ...formData,
      meterGroupByFilters: formData.meterGroupByFilters.filter((_, i) => i !== index),
    });

  if (loading) return <LoadingSpinner message="Loading features..." />;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Features</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Features map usage meters to sellable quantities used in plan rate cards
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIncludeArchived((v) => !v)}
            className={`inline-flex items-center px-4 py-2.5 rounded-lg border text-sm font-medium transition ${
              includeArchived
                ? 'bg-indigo-600 border-indigo-600 text-white'
                : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60'
            }`}
          >
            <Archive className="w-4 h-4 mr-2" /> Archived
          </button>
          <button
            onClick={fetchFeatures}
            className="inline-flex items-center px-4 py-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition"
          >
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </button>
          <button
            onClick={() => { setFormData({ ...EMPTY_FORM }); setShowModal(true); }}
            className="inline-flex items-center px-4 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-medium shadow-sm hover:bg-indigo-700 transition"
          >
            <Plus className="w-4 h-4 mr-2" /> Add Feature
          </button>
        </div>
      </div>

      {message && (
        <div className={`p-3.5 rounded-lg text-sm flex items-center border ${message.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400' : 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-400'}`}>
          {message.type === 'success' ? <CheckCircle className="w-4 h-4 mr-2 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />}
          {message.text}
        </div>
      )}

      <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 text-indigo-700 dark:text-indigo-300 text-sm">
        <Layers className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <p>
          A <strong>feature</strong> is a sellable quantity backed by a meter. Features are immutable after
          creation — <code className="text-xs bg-indigo-100/60 dark:bg-indigo-500/20 px-1.5 py-0.5 rounded">key</code> is
          assigned once and can never change. To modify a feature, <strong>archive</strong> it and create a new one.
          Create a meter first, then a feature for it.
        </p>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Name</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Key</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide hidden md:table-cell">Meter</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide hidden lg:table-cell">Filters</th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {features.length === 0 ? (
              <tr><td colSpan="5" className="px-6 py-12 text-center">
                <Layers className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                <p className="text-slate-500 dark:text-slate-400 text-sm">No features yet. Click "Add Feature".</p>
              </td></tr>
            ) : (
              features.map((f) => (
                <tr key={f.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                  <td className="px-6 py-4">
                    <p className="font-medium text-slate-900 dark:text-white">
                      {f.name}
                      {f.archived && (
                        <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 text-[11px] font-medium uppercase tracking-wide">
                          <Archive className="w-3 h-3" /> archived
                        </span>
                      )}
                    </p>
                    {f.unitCost && (
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                        {f.unitCost.type === 'llm'
                          ? `unit cost: LLM lookup (${f.unitCost.provider || '?'}/${f.unitCost.model || '?'})`
                          : `unit cost: ${f.unitCost.amount ? `$${Number(f.unitCost.amount).toFixed(4)}` : '—'}`}
                      </p>
                    )}
                  </td>
                  <td className="px-6 py-4 font-mono text-sm text-slate-600 dark:text-slate-300">{f.key}</td>
                  <td className="px-6 py-4 hidden md:table-cell">
                    {f.meterSlug ? (
                      <span className="inline-flex px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-mono">{f.meterSlug}</span>
                    ) : (
                      <span className="text-xs text-slate-400 dark:text-slate-500">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 hidden lg:table-cell">
                    {f.meterGroupByFilters && Object.keys(f.meterGroupByFilters).length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(f.meterGroupByFilters).map(([k, v]) => (
                          <span key={k} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[11px]">
                            <Filter className="w-3 h-3" /> {k}={v}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 dark:text-slate-500">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {!f.archived && (
                      <div className="flex items-center justify-end">
                        <button onClick={() => handleArchive(f)} className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg" title="Archive"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add Feature modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 dark:bg-slate-950/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Add Feature</h3>
              <button onClick={() => setShowModal(false)} className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg" title="Close"><X className="w-4 h-4" /></button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">Name</label>
                <TextBox
                  type="text"
                  placeholder="API Requests"
                  className="w-full"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">Key</label>
                <TextBox
                  type="text"
                  placeholder="api_requests_feature"
                  className="w-full font-mono"
                  value={formData.key}
                  onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                />
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Unique, immutable. Use lowercase letters, numbers and underscores.</p>
              </div>
              <div>
                <SearchableSelect
                  label="Meter (optional)"
                  value={formData.meterSlug}
                  onChange={(v) => setFormData({ ...formData, meterSlug: v })}
                  options={meters.map((m) => ({ value: m.slug, label: `${m.name} — ${m.slug}` }))}
                  placeholder="Select a meter"
                  allowCustom
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Meter group by filters</label>
                  <span className="text-[11px] text-slate-400 dark:text-slate-500">optional</span>
                </div>
                <p className="text-xs text-slate-400 dark:text-slate-500 mb-2">
                  Filter the meter to a subset of usage, e.g. <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">model = gpt-4</code>. Must match the meter's group-by keys.
                </p>
                <div className="space-y-2">
                  {formData.meterGroupByFilters.map((filter, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <TextBox
                        type="text"
                        placeholder="property"
                        className="w-1/2 font-mono"
                        value={filter.property}
                        onChange={(e) => setFilter(i, { property: e.target.value })}
                      />
                      <TextBox
                        type="text"
                        placeholder="value"
                        className="w-1/2 font-mono"
                        value={filter.value}
                        onChange={(e) => setFilter(i, { value: e.target.value })}
                      />
                      <button onClick={() => removeFilter(i)} className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg flex-shrink-0" title="Remove filter"><X className="w-4 h-4" /></button>
                    </div>
                  ))}
                  <button
                    onClick={addFilter}
                    className="inline-flex items-center text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
                  >
                    <Plus className="w-4 h-4 mr-1" /> Add filter
                  </button>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white">Cancel</button>
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition disabled:opacity-50"
              >
                {saving ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
      {confirmDialog}
    </div>
  );
};

export default Features;