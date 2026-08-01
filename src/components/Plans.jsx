import React, { useState, useEffect, useCallback } from 'react';
import { Plus, RefreshCw, Trash2, AlertCircle, CheckCircle, Rocket, Archive, Layers, Package, X, Edit2 } from 'lucide-react';
import { getPlans, createPlan, updatePlan, publishPlan, archivePlan, deletePlan, getFeatures } from '../api/openmeter';
import SearchableSelect from './SearchableSelect';
import LoadingSpinner from './LoadingSpinner';
import { useConfirm } from '../hooks/useConfirm';

const CADENCES = [
  { value: 'P1M', label: 'Monthly (P1M)' },
  { value: 'P3M', label: 'Quarterly (P3M)' },
  { value: 'P1Y', label: 'Annual (P1Y)' },
];

const MODELS = [
  { value: 'flat', label: 'Flat fee' },
  { value: 'unit', label: 'Per-unit (usage-based)' },
  { value: 'tiered', label: 'Tiered (usage-based)' },
  { value: 'package', label: 'Package (usage-based)' },
  { value: 'dynamic', label: 'Dynamic (usage-based)' },
];

const TIER_MODES = [
  { value: 'graduated', label: 'Graduated — each unit charged per its tier' },
  { value: 'volume', label: 'Volume — all units at the highest tier' },
];

const emptyRateCard = () => ({
  model: 'unit',
  key: '',
  name: '',
  featureKey: '',
  cadence: 'P1M', // '' means one-time (flat fee only)
  amount: '',
  quantityPerPackage: '',
  multiplier: '1',
  tierMode: 'graduated',
  tiers: [{ upToAmount: '', unitPrice: '', flatPrice: '' }],
});

const EMPTY_FORM = {
  key: '',
  name: '',
  currency: 'USD',
  billingCadence: 'P1M',
  phaseKey: 'default',
  phaseName: 'Default',
  rateCards: [emptyRateCard()],
};

const getStatusBadge = (status) => {
  const map = {
    active: 'bg-emerald-50 text-emerald-700',
    draft: 'bg-slate-100 text-slate-600',
    archived: 'bg-amber-50 text-amber-700',
  };
  return map[status] || 'bg-slate-100 text-slate-600';
};

// Convert a form rate-card into an API PlanRateCard.
const buildRateCard = (rc, planCadence) => {
  const isFlat = rc.model === 'flat';
  const rateCardKey = isFlat
    ? rc.key || rc.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')
    : rc.featureKey;
  let price;
  if (isFlat) {
    price = { type: 'flat', amount: rc.amount };
  } else if (rc.model === 'unit') {
    price = { type: 'unit', amount: rc.amount };
  } else if (rc.model === 'package') {
    price = { type: 'package', amount: rc.amount, quantityPerPackage: rc.quantityPerPackage };
  } else if (rc.model === 'dynamic') {
    price = { type: 'dynamic', multiplier: rc.multiplier || '1' };
  } else {
    const tiers = (rc.tiers || [])
      .filter((t) => t.upToAmount !== '' || t.unitPrice !== '' || t.flatPrice !== '')
      .map((t) => {
        const tier = {
          unitPrice: t.unitPrice !== '' ? { type: 'unit', amount: t.unitPrice } : null,
          flatPrice: t.flatPrice !== '' ? { type: 'flat', amount: t.flatPrice } : null,
        };
        // Open-ended tier: omit upToAmount entirely (API rejects null).
        if (t.upToAmount !== '') tier.upToAmount = t.upToAmount;
        return tier;
      });
    price = { type: 'tiered', mode: rc.tierMode, tiers };
  }

  return {
    type: isFlat ? 'flat_fee' : 'usage_based',
    key: rateCardKey,
    name: rc.name,
    ...(rc.featureKey ? { featureKey: rc.featureKey } : {}),
    billingCadence: isFlat ? (rc.cadence || null) : planCadence,
    price,
  };
};

// Convert an API rate card back into form state for editing.
const fromRateCard = (rc) => {
  const p = rc.price || {};
  const model = p.type === 'flat' ? 'flat' : (p.type || 'unit');
  const isFlat = model === 'flat';
  return {
    model,
    key: rc.key || '',
    name: rc.name || '',
    featureKey: rc.featureKey || '',
    cadence: isFlat ? (rc.billingCadence || '') : 'P1M',
    amount: p.amount != null ? String(p.amount) : '',
    quantityPerPackage: p.quantityPerPackage != null ? String(p.quantityPerPackage) : '',
    multiplier: p.multiplier != null ? String(p.multiplier) : '1',
    tierMode: p.mode || 'graduated',
    tiers: Array.isArray(p.tiers)
      ? p.tiers.map((t) => ({
          upToAmount: t.upToAmount != null ? String(t.upToAmount) : '',
          unitPrice: t.unitPrice?.amount != null ? String(t.unitPrice.amount) : '',
          flatPrice: t.flatPrice?.amount != null ? String(t.flatPrice.amount) : '',
        }))
      : [{ upToAmount: '', unitPrice: '', flatPrice: '' }],
  };
};

const Plans = () => {
  const [plans, setPlans] = useState([]);
  const [features, setFeatures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [formData, setFormData] = useState(JSON.parse(JSON.stringify(EMPTY_FORM)));
  const [message, setMessage] = useState(null);
  const [saving, setSaving] = useState(false);
  const { requestConfirm, confirmDialog } = useConfirm();

  const fetchPlans = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getPlans();
      setPlans(res.data || []);
    } catch (error) {
      setMessage({ type: 'error', text: error?.response?.data?.detail || error.message || 'Failed to load plans' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlans();
    getFeatures()
      .then((res) => setFeatures(res.data || []))
      .catch(() => {});
  }, [fetchPlans]);

  const setRateCard = (index, field, value) => {
    setFormData((prev) => {
      const rateCards = [...prev.rateCards];
      rateCards[index] = { ...rateCards[index], [field]: value };
      return { ...prev, rateCards };
    });
  };

  const setTier = (rcIndex, tierIndex, field, value) => {
    setFormData((prev) => {
      const rateCards = [...prev.rateCards];
      const tiers = [...(rateCards[rcIndex].tiers || [])];
      tiers[tierIndex] = { ...tiers[tierIndex], [field]: value };
      rateCards[rcIndex] = { ...rateCards[rcIndex], tiers };
      return { ...prev, rateCards };
    });
  };

  const handleSubmit = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const rateCards = formData.rateCards
        .filter((rc) => rc.name || rc.featureKey)
        .map((rc) => buildRateCard(rc, formData.billingCadence));

      const payload = {
        key: formData.key,
        name: formData.name,
        currency: formData.currency.toUpperCase(),
        billingCadence: formData.billingCadence,
        phases: [
          {
            key: formData.phaseKey,
            name: formData.phaseName,
            duration: null,
            rateCards,
          },
        ],
      };

      if (editingPlan) {
        await updatePlan(editingPlan.id, payload);
        setMessage({ type: 'success', text: `Plan "${payload.name}" updated.` });
      } else {
        const created = await createPlan(payload);
        setMessage({
          type: 'success',
          text: `Plan "${created.name}" created. It must be published before it can be used in subscriptions.`,
        });
      }
      setShowModal(false);
      setEditingPlan(null);
      setFormData(JSON.parse(JSON.stringify(EMPTY_FORM)));
      fetchPlans();
    } catch (error) {
      const detail = error?.response?.data?.detail || error?.response?.data?.extensions?.validationErrors?.map(v => v.message).join('; ');
      setMessage({ type: 'error', text: detail || error.message || `Failed to ${editingPlan ? 'update' : 'create'} plan` });
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async (plan) => {
    if (!(await requestConfirm({
      title: 'Publish plan',
      message: `Publish "${plan.name}"? It becomes available for subscriptions.`,
      confirmLabel: 'Publish',
      icon: Rocket,
    }))) return;
    try {
      await publishPlan(plan.id);
      setMessage({ type: 'success', text: `Plan "${plan.name}" published.` });
      fetchPlans();
    } catch (error) {
      setMessage({ type: 'error', text: error?.response?.data?.detail || error.message || 'Failed to publish plan' });
    }
  };

  const handleArchive = async (plan) => {
    if (!(await requestConfirm({
      title: 'Archive plan',
      message: `Archive "${plan.name}"?`,
      confirmLabel: 'Archive',
      icon: Archive,
    }))) return;
    try {
      await archivePlan(plan.id);
      setMessage({ type: 'success', text: `Plan "${plan.name}" archived.` });
      fetchPlans();
    } catch (error) {
      setMessage({ type: 'error', text: error?.response?.data?.detail || error.message || 'Failed to archive plan' });
    }
  };

  const handleDelete = async (plan) => {
    if (!(await requestConfirm({
      title: 'Delete plan',
      message: `Delete "${plan.name}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      variant: 'danger',
      icon: Trash2,
    }))) return;
    try {
      await deletePlan(plan.id);
      setMessage({ type: 'success', text: `Plan "${plan.name}" deleted.` });
      fetchPlans();
    } catch (error) {
      setMessage({ type: 'error', text: error?.response?.data?.detail || error.message || 'Failed to delete plan' });
    }
  };

  const openEdit = (plan) => {
    const phase = plan.phases?.[0];
    const rateCards = (phase?.rateCards || []).map(fromRateCard);
    setEditingPlan(plan);
    setFormData({
      key: plan.key,
      name: plan.name,
      currency: plan.currency || 'USD',
      billingCadence: plan.billingCadence || 'P1M',
      phaseKey: phase?.key || 'default',
      phaseName: phase?.name || 'Default',
      rateCards: rateCards.length ? rateCards : [emptyRateCard()],
    });
    setShowModal(true);
  };

  if (loading) return <LoadingSpinner message="Loading plans..." />;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Plans</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Plans bundle rate cards (pricing) that customers subscribe to
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchPlans}
            className="inline-flex items-center px-4 py-2.5 rounded-lg bg-white border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
          >
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </button>
          <button
            onClick={() => { setEditingPlan(null); setFormData(JSON.parse(JSON.stringify(EMPTY_FORM))); setShowModal(true); }}
            className="inline-flex items-center px-4 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-medium shadow-sm hover:bg-indigo-700 transition"
          >
            <Plus className="w-4 h-4 mr-2" /> Add Plan
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
        <Package className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <p>
          A <strong>plan</strong> defines rate cards for features. Rate cards support flat fees (one-time
          or recurring), per-unit, tiered (graduated/volume), package and dynamic pricing. Plans must be{' '}
          <strong>published</strong> before they can be used.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {plans.length === 0 ? (
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-12 text-center">
            <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-slate-500 text-sm">No plans yet. Click "Add Plan".</p>
          </div>
        ) : (
          plans.map((p) => (
            <div key={p.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col">
              <div className="p-5 border-b border-slate-100">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-slate-900">{p.name}</h3>
                    <p className="font-mono text-xs text-slate-400 mt-0.5">{p.key} · v{p.version}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex px-2.5 py-1 rounded-md text-xs font-medium ${getStatusBadge(p.status)}`}>{p.status}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-3 text-xs text-slate-500">
                  <span className="inline-flex px-2 py-0.5 rounded bg-slate-100 font-medium">{p.currency}</span>
                  <span className="inline-flex px-2 py-0.5 rounded bg-slate-100 font-mono">{p.billingCadence}</span>
                  <span className="inline-flex px-2 py-0.5 rounded bg-slate-100">{p.settlementMode}</span>
                </div>
              </div>

              <div className="p-5 flex-1 space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Rate cards</p>
                {!p.phases?.length && <p className="text-sm text-slate-400">No phases</p>}
                {p.phases?.map((ph) => (
                  <div key={ph.id || ph.key}>
                    <p className="text-xs font-medium text-slate-600 mb-2">{ph.name} {ph.duration ? `(${ph.duration})` : '(entire term)'}</p>
                    {ph.rateCards?.length === 0 && <p className="text-xs text-slate-400">No rate cards</p>}
                    {ph.rateCards?.map((rc) => {
                      const model = rc.price?.type === 'flat' ? 'Flat fee' : (rc.price?.type || rc.type);
                      return (
                        <div key={rc.id || rc.key} className="flex items-center justify-between rounded-lg bg-slate-50 border border-slate-100 px-3 py-2 mb-1.5">
                          <div className="flex items-center gap-2 min-w-0">
                            {rc.type === 'flat_fee' ? <Layers className="w-4 h-4 text-slate-400 flex-shrink-0" /> : <Package className="w-4 h-4 text-indigo-400 flex-shrink-0" />}
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-slate-700 truncate">{rc.name}</p>
                              <p className="font-mono text-[11px] text-slate-400 truncate">{model} · {rc.featureKey || 'flat fee'}</p>
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0 ml-2">
                            <p className="font-mono text-sm text-slate-700">
                              {rc.price?.type === 'flat'
                                ? `${p.currency} ${rc.price.amount}${rc.billingCadence ? ` / ${rc.billingCadence}` : ' (one-time)'}`
                                : rc.price?.type === 'tiered'
                                  ? `${p.currency} tiered (${rc.price.mode})`
                                  : rc.price?.type === 'package'
                                    ? `${p.currency} ${rc.price.amount} / ${rc.price.quantityPerPackage} units`
                                    : rc.price?.type === 'dynamic'
                                      ? `dynamic × ${rc.price.multiplier}`
                                      : rc.price?.amount != null
                                        ? `${p.currency} ${rc.price.amount}${rc.price?.aggregation ? ` / ${rc.price.aggregation}` : ' / unit'}`
                                        : 'free'}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>

              <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50/60 flex flex-wrap items-center justify-end gap-2">
                {p.status === 'draft' && (
                  <button
                    onClick={() => handlePublish(p)}
                    className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition"
                  >
                    <Rocket className="w-3.5 h-3.5 mr-1" /> Publish
                  </button>
                )}
                {p.status === 'active' && (
                  <button
                    onClick={() => handleArchive(p)}
                    className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-50 text-amber-700 hover:bg-amber-100 transition"
                  >
                    <Archive className="w-3.5 h-3.5 mr-1" /> Archive
                  </button>
                )}
                {p.status === 'draft' && (
                  <button
                    onClick={() => openEdit(p)}
                    className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 transition"
                  >
                    <Edit2 className="w-3.5 h-3.5 mr-1" /> Edit
                  </button>
                )}
                <button
                  onClick={() => handleDelete(p)}
                  className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100 transition"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add/Edit Plan modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <h3 className="text-lg font-semibold text-slate-900">{editingPlan ? 'Edit' : 'Add'} Plan</h3>
              <button onClick={() => setShowModal(false)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg" title="Close"><X className="w-4 h-4" /></button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Name</label>
                  <input
                    type="text"
                    placeholder="API Basic Plan"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Key</label>
                  <input
                    type="text"
                    placeholder="api_basic_plan"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={formData.key}
                    onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                    disabled={!!editingPlan}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Currency</label>
                  <input
                    type="text"
                    placeholder="USD"
                    maxLength="3"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 uppercase"
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value.toUpperCase() })}
                  />
                </div>
                <div className="relative">
                  <SearchableSelect
                    label="Billing Cadence"
                    options={CADENCES}
                    value={formData.billingCadence}
                    onChange={(v) => setFormData({ ...formData, billingCadence: v })}
                    placeholder="Select cadence"
                  />
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Rate Cards</label>
                  <button
                    onClick={() => setFormData((prev) => ({ ...prev, rateCards: [...prev.rateCards, emptyRateCard()] }))}
                    className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" /> Add rate card
                  </button>
                </div>

                {formData.rateCards.map((rc, i) => (
                  <div key={i} className="rounded-xl border border-slate-200 p-4 mb-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-500">Rate card {i + 1}</span>
                      {formData.rateCards.length > 1 && (
                        <button
                          onClick={() => setFormData((prev) => ({ ...prev, rateCards: prev.rateCards.filter((_, idx) => idx !== i) }))}
                          className="p-1 text-red-500 hover:bg-red-50 rounded"
                          title="Remove"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="relative">
                        <SearchableSelect
                          label="Pricing model"
                          options={MODELS}
                          value={rc.model}
                          onChange={(v) => setRateCard(i, 'model', v)}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Name</label>
                        <input
                          type="text"
                          placeholder="API Requests"
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          value={rc.name}
                          onChange={(e) => setRateCard(i, 'name', e.target.value)}
                        />
                      </div>
                      <div className="relative">
                        <SearchableSelect
                          label={rc.model === 'flat' ? 'Feature (optional)' : 'Feature'}
                          options={features.map((f) => ({ value: f.key, label: `${f.name} (${f.key})` }))}
                          value={rc.featureKey}
                          onChange={(v) => setRateCard(i, 'featureKey', v)}
                          allowCustom
                          placeholder={rc.model === 'flat' ? '— none —' : 'Select a feature'}
                        />
                      </div>

                      {rc.model === 'flat' && (
                        <div className="relative">
                          <SearchableSelect
                            label="Charge"
                            options={[
                              { value: '', label: 'One-time fee' },
                              ...CADENCES.map((c) => ({ value: c.value, label: `Recurring — ${c.label}` })),
                            ]}
                            value={rc.cadence}
                            onChange={(v) => setRateCard(i, 'cadence', v)}
                          />
                        </div>
                      )}

                      {rc.model === 'unit' && (
                        <div>
                          <label className="block text-xs font-medium text-slate-500 mb-1">Unit price</label>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            placeholder="0.01"
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            value={rc.amount}
                            onChange={(e) => setRateCard(i, 'amount', e.target.value)}
                          />
                        </div>
                      )}

                      {rc.model === 'package' && (
                        <>
                          <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">Price per package</label>
                            <input
                              type="number"
                              min="0"
                              step="any"
                              placeholder="10.00"
                              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              value={rc.amount}
                              onChange={(e) => setRateCard(i, 'amount', e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">Units per package</label>
                            <input
                              type="number"
                              min="1"
                              step="any"
                              placeholder="20"
                              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              value={rc.quantityPerPackage}
                              onChange={(e) => setRateCard(i, 'quantityPerPackage', e.target.value)}
                            />
                          </div>
                        </>
                      )}

                      {rc.model === 'dynamic' && (
                        <div>
                          <label className="block text-xs font-medium text-slate-500 mb-1">Multiplier (markup)</label>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            placeholder="1.0"
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            value={rc.multiplier}
                            onChange={(e) => setRateCard(i, 'multiplier', e.target.value)}
                          />
                          <p className="text-xs text-slate-400 mt-1">1.0 = base price, 1.5 = +50% markup.</p>
                        </div>
                      )}
                    </div>

                    {rc.model === 'tiered' && (
                      <div className="border-t border-slate-100 pt-3">
                        <div className="relative max-w-xs mb-3">
                          <SearchableSelect
                            label="Tiering mode"
                            options={TIER_MODES}
                            value={rc.tierMode}
                            onChange={(v) => setRateCard(i, 'tierMode', v)}
                          />
                        </div>
                        <div className="space-y-2">
                          {rc.tiers.map((tier, t) => (
                            <div key={t} className="flex items-center gap-2">
                              <input
                                type="number"
                                min="0"
                                step="any"
                                placeholder="Up to (∞ = blank)"
                                className="w-1/3 px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                value={tier.upToAmount}
                                onChange={(e) => setTier(i, t, 'upToAmount', e.target.value)}
                              />
                              <input
                                type="number"
                                min="0"
                                step="any"
                                placeholder="Unit price"
                                className="w-1/3 px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                value={tier.unitPrice}
                                onChange={(e) => setTier(i, t, 'unitPrice', e.target.value)}
                              />
                              <input
                                type="number"
                                min="0"
                                step="any"
                                placeholder="Flat price"
                                className="w-1/3 px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                value={tier.flatPrice}
                                onChange={(e) => setTier(i, t, 'flatPrice', e.target.value)}
                              />
                              <button
                                onClick={() => setFormData((prev) => {
                                  const rateCards = [...prev.rateCards];
                                  const tiers = rateCards[i].tiers.filter((_, idx) => idx !== t);
                                  rateCards[i] = { ...rateCards[i], tiers };
                                  return { ...prev, rateCards };
                                })}
                                className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"
                                title="Remove tier"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                          <button
                            onClick={() => setFormData((prev) => {
                              const rateCards = [...prev.rateCards];
                              rateCards[i] = { ...rateCards[i], tiers: [...rateCards[i].tiers, { upToAmount: '', unitPrice: '', flatPrice: '' }] };
                              return { ...prev, rateCards };
                            })}
                            className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 transition"
                          >
                            <Plus className="w-3.5 h-3.5 mr-1" /> Add tier
                          </button>
                          <p className="text-xs text-slate-400 mt-1">
                            Blank "up to" = open-ended (∞). Leave unit price or flat price blank to omit it.
                          </p>
                        </div>
                      </div>
                    )}

                    {rc.model === 'flat' && (
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Amount</label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          placeholder="199.00"
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          value={rc.amount}
                          onChange={(e) => setRateCard(i, 'amount', e.target.value)}
                        />
                      </div>
                    )}
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
                {saving ? 'Saving...' : (editingPlan ? 'Save Changes' : 'Create Plan')}
              </button>
            </div>
          </div>
        </div>
      )}
      {confirmDialog}
    </div>
  );
};

export default Plans;
