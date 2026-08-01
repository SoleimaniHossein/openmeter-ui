import React, { useState, useEffect, useCallback } from 'react';
import { Plus, RefreshCw, Trash2, AlertCircle, CheckCircle, Layers } from 'lucide-react';
import { getFeatures, createFeature, deleteFeature, getMeters } from '../api/openmeter';
import LoadingSpinner from './LoadingSpinner';
import SearchableSelect from './SearchableSelect';
import { useConfirm } from '../hooks/useConfirm';

const EMPTY_FORM = { key: '', name: '', meterSlug: '' };

const Features = () => {
  const [features, setFeatures] = useState([]);
  const [meters, setMeters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ ...EMPTY_FORM });
  const [message, setMessage] = useState(null);
  const [saving, setSaving] = useState(false);
  const { requestConfirm, confirmDialog } = useConfirm();

  const fetchFeatures = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getFeatures();
      setFeatures(res.data || []);
    } catch (error) {
      setMessage({ type: 'error', text: error?.response?.data?.detail || error.message || 'Failed to load features' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFeatures();
    getMeters()
      .then((res) => setMeters(res.data || []))
      .catch(() => {});
  }, [fetchFeatures]);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await createFeature(formData);
      setShowModal(false);
      setFormData({ ...EMPTY_FORM });
      setMessage({ type: 'success', text: `Feature "${formData.name}" created successfully.` });
      fetchFeatures();
    } catch (error) {
      setMessage({ type: 'error', text: error?.response?.data?.detail || error.message || 'Failed to create feature' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await requestConfirm({
        title: 'Delete feature',
        message: 'Delete this feature? This cannot be undone.',
        confirmLabel: 'Delete',
        variant: 'danger',
        icon: Trash2,
        action: async () => {
          await deleteFeature(id);
          setMessage({ type: 'success', text: 'Feature deleted.' });
          fetchFeatures();
        },
      });
    } catch (error) {
      setMessage({ type: 'error', text: error?.response?.data?.detail || error.message || 'Failed to delete feature' });
    }
  };

  if (loading) return <LoadingSpinner message="Loading features..." />;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Features</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Features map usage meters to sellable quantities used in plan rate cards
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchFeatures}
            className="inline-flex items-center px-4 py-2.5 rounded-lg bg-white border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
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
        <div className={`p-3.5 rounded-lg text-sm flex items-center border ${message.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
          {message.type === 'success' ? <CheckCircle className="w-4 h-4 mr-2 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />}
          {message.text}
        </div>
      )}

      <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-700 text-sm">
        <Layers className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <p>
          A <strong>feature</strong> is a sellable quantity backed by a meter. Features are referenced by
          plan rate cards to define pricing. Create a meter first, then a feature for it.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Name</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Key</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Meter</th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {features.length === 0 ? (
              <tr><td colSpan="4" className="px-6 py-12 text-center">
                <Layers className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-slate-500 text-sm">No features yet. Click "Add Feature".</p>
              </td></tr>
            ) : (
              features.map((f) => (
                <tr key={f.id} className="hover:bg-slate-50/60 transition">
                  <td className="px-6 py-4">
                    <p className="font-medium text-slate-900">{f.name}</p>
                    {f.unitCost && (
                      <p className="text-xs text-slate-400">unit cost: {f.unitCost.amount} {f.unitCost.currency || ''}</p>
                    )}
                  </td>
                  <td className="px-6 py-4 font-mono text-sm text-slate-600">{f.key}</td>
                  <td className="px-6 py-4 hidden md:table-cell">
                    <span className="inline-flex px-2.5 py-1 rounded-md bg-slate-100 text-slate-600 text-xs font-mono">{f.meterSlug || '-'}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => handleDelete(f.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg" title="Delete"><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add Feature modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-slate-100">
              <h3 className="text-lg font-semibold text-slate-900">Add Feature</h3>
            </div>
            <div className="px-6 py-4 space-y-4">
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
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Key</label>
                <input
                  type="text"
                  placeholder="api_requests_feature"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={formData.key}
                  onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                />
              </div>
              <div>
                <SearchableSelect
                  label="Meter"
                  value={formData.meterSlug}
                  onChange={(v) => setFormData({ ...formData, meterSlug: v })}
                  options={meters.map((m) => ({ value: m.slug, label: `${m.name} — ${m.slug}` }))}
                  placeholder="Select a meter"
                  allowCustom
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900">Cancel</button>
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
