import React, { useState, useEffect, useCallback } from 'react';
import { Plus, RefreshCw, Trash2, AlertCircle, CheckCircle, Rocket, Archive, Layers, Package, X, Edit2, GitBranch } from 'lucide-react';
import { getPlans, createPlan, updatePlan, publishPlan, archivePlan, deletePlan, createNextPlanVersion, getFeatures } from '../api/openmeter';
import SearchableSelect from './SearchableSelect';
import TextBox from './TextBox';
import TextArea from './TextArea';
import LoadingSpinner from './LoadingSpinner';
import { useConfirm } from '../hooks/useConfirm';
import { describeApiError } from '../utils/errors';

const CADENCES = [
  { value: 'P1M', label: 'Monthly (P1M)' },
  { value: 'P3M', label: 'Quarterly (P3M)' },
  { value: 'P1Y', label: 'Annual (P1Y)' },
];

const DURATIONS = [
  { value: '', label: 'Entire term' },
  { value: 'P1W', label: '1 week (P1W)' },
  { value: 'P2W', label: '2 weeks (P2W)' },
  { value: 'P1M', label: '1 month (P1M)' },
  { value: 'P3M', label: '3 months (P3M)' },
  { value: 'P1Y', label: '1 year (P1Y)' },
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

const emptyPhase = () => ({
  key: 'default',
  name: 'Default',
  duration: '',
  rateCards: [emptyRateCard()],
});

const EMPTY_FORM = {
  key: '',
  name: '',
  description: '',
  currency: 'USD',
  billingCadence: 'P1M',
  phases: [emptyPhase()],
};

const getStatusBadge = (status) => {
  const map = {
    active: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
    draft: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300',
    scheduled: 'bg-sky-100 dark:bg-sky-500/15 text-sky-700 dark:text-sky-400',
    archived: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400',
  };
  return map[status] || 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300';
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
      setMessage({ type: 'error', text: describeApiError(error, 'Failed to load plans') });
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

  const setPhase = (phaseIdx, field, value) => {
    setFormData((prev) => {
      const phases = [...prev.phases];
      phases[phaseIdx] = { ...phases[phaseIdx], [field]: value };
      return { ...prev, phases };
    });
  };

  const setRateCard = (phaseIdx, index, field, value) => {
    setFormData((prev) => {
      const phases = [...prev.phases];
      const rateCards = [...(phases[phaseIdx].rateCards || [])];
      rateCards[index] = { ...rateCards[index], [field]: value };
      phases[phaseIdx] = { ...phases[phaseIdx], rateCards };
      return { ...prev, phases };
    });
  };

  const setTier = (phaseIdx, rcIndex, tierIndex, field, value) => {
    setFormData((prev) => {
      const phases = [...prev.phases];
      const rateCards = [...(phases[phaseIdx].rateCards || [])];
      const tiers = [...(rateCards[rcIndex].tiers || [])];
      tiers[tierIndex] = { ...tiers[tierIndex], [field]: value };
      rateCards[rcIndex] = { ...rateCards[rcIndex], tiers };
      phases[phaseIdx] = { ...phases[phaseIdx], rateCards };
      return { ...prev, phases };
    });
  };

  const addPhase = () => {
    setFormData((prev) => ({ ...prev, phases: [...prev.phases, emptyPhase()] }));
  };

  const removePhase = (phaseIdx) => {
    setFormData((prev) => {
      const phases = prev.phases.filter((_, idx) => idx !== phaseIdx);
      return { ...prev, phases: phases.length ? phases : [emptyPhase()] };
    });
  };

  const addRateCard = (phaseIdx) => {
    setFormData((prev) => {
      const phases = [...prev.phases];
      phases[phaseIdx] = { ...phases[phaseIdx], rateCards: [...(phases[phaseIdx].rateCards || []), emptyRateCard()] };
      return { ...prev, phases };
    });
  };

  const removeRateCard = (phaseIdx, index) => {
    setFormData((prev) => {
      const phases = [...prev.phases];
      phases[phaseIdx] = { ...phases[phaseIdx], rateCards: phases[phaseIdx].rateCards.filter((_, idx) => idx !== index) };
      return { ...prev, phases };
    });
  };

  const removeTier = (phaseIdx, rcIndex, tierIndex) => {
    setFormData((prev) => {
      const phases = [...prev.phases];
      const rateCards = [...(phases[phaseIdx].rateCards || [])];
      rateCards[rcIndex] = { ...rateCards[rcIndex], tiers: rateCards[rcIndex].tiers.filter((_, idx) => idx !== tierIndex) };
      phases[phaseIdx] = { ...phases[phaseIdx], rateCards };
      return { ...prev, phases };
    });
  };

  const addTier = (phaseIdx, rcIndex) => {
    setFormData((prev) => {
      const phases = [...prev.phases];
      const rateCards = [...(phases[phaseIdx].rateCards || [])];
      rateCards[rcIndex] = { ...rateCards[rcIndex], tiers: [...(rateCards[rcIndex].tiers || []), { upToAmount: '', unitPrice: '', flatPrice: '' }] };
      phases[phaseIdx] = { ...phases[phaseIdx], rateCards };
      return { ...prev, phases };
    });
  };

  const handleSubmit = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const phases = formData.phases.map((ph) => ({
        key: ph.key || 'default',
        name: ph.name || 'Default',
        duration: ph.duration || null,
        rateCards: (ph.rateCards || [])
          .filter((rc) => rc.name || rc.featureKey)
          .map((rc) => buildRateCard(rc, formData.billingCadence)),
      }));

      const payload = {
        key: formData.key,
        name: formData.name,
        ...(formData.description ? { description: formData.description } : {}),
        currency: formData.currency.toUpperCase(),
        billingCadence: formData.billingCadence,
        phases,
      };

      if (editingPlan) {
        await updatePlan(editingPlan.id, payload);
        setMessage({ type: 'success', text: `Plan "${payload.name}" v${editingPlan.version} updated.` });
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
      setMessage({ type: 'error', text: detail || describeApiError(error, `Failed to ${editingPlan ? 'update' : 'create'} plan`) });
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async (plan) => {
    try {
      await requestConfirm({
        title: 'Publish plan',
        message: `Publish "${plan.name}" v${plan.version}? It becomes available for subscriptions and archives the previous active version.`,
        confirmLabel: 'Publish',
        icon: Rocket,
        action: async () => {
          await publishPlan(plan.id);
          setMessage({ type: 'success', text: `Plan "${plan.name}" v${plan.version} published.` });
          fetchPlans();
        },
      });
    } catch (error) {
      setMessage({ type: 'error', text: describeApiError(error, 'Failed to publish plan') });
    }
  };

  const handleArchive = async (plan) => {
    try {
      await requestConfirm({
        title: 'Archive plan',
        message: `Archive "${plan.name}" v${plan.version}? It will no longer be available for new subscriptions.`,
        confirmLabel: 'Archive',
        icon: Archive,
        action: async () => {
          await archivePlan(plan.id);
          setMessage({ type: 'success', text: `Plan "${plan.name}" v${plan.version} archived.` });
          fetchPlans();
        },
      });
    } catch (error) {
      setMessage({ type: 'error', text: describeApiError(error, 'Failed to archive plan') });
    }
  };

  const handleDelete = async (plan) => {
    try {
      await requestConfirm({
        title: 'Delete plan',
        message: `Delete "${plan.name}" v${plan.version}? This cannot be undone.`,
        confirmLabel: 'Delete',
        variant: 'danger',
        icon: Trash2,
        action: async () => {
          await deletePlan(plan.id);
          setMessage({ type: 'success', text: `Plan "${plan.name}" deleted.` });
          fetchPlans();
        },
      });
    } catch (error) {
      setMessage({ type: 'error', text: describeApiError(error, 'Failed to delete plan') });
    }
  };

  const handleNewVersion = async (plan) => {
    try {
      await requestConfirm({
        title: 'Create new version',
        message: `Create a new draft version of "${plan.name}" (v${plan.version + 1})? The current version stays in use until you publish the new one.`,
        confirmLabel: 'Create version',
        icon: GitBranch,
        action: async () => {
          const next = await createNextPlanVersion(plan.id);
          setMessage({ type: 'success', text: `Created draft v${next.version} of "${next.name}". Edit it, then publish.` });
          openEdit(next);
          fetchPlans();
        },
      });
    } catch (error) {
      setMessage({ type: 'error', text: describeApiError(error, 'Failed to create new version') });
    }
  };

  const openEdit = (plan) => {
    const phases = (plan.phases || []).length
      ? plan.phases.map((ph) => ({
          key: ph.key || 'default',
          name: ph.name || 'Default',
          duration: ph.duration || '',
          rateCards: (ph.rateCards || []).map(fromRateCard),
        }))
      : [emptyPhase()];
    setEditingPlan(plan);
    setFormData({
      key: plan.key,
      name: plan.name,
      description: plan.description || '',
      currency: plan.currency || 'USD',
      billingCadence: plan.billingCadence || 'P1M',
      phases,
    });
    setShowModal(true);
  };

  if (loading) return <LoadingSpinner message="Loading plans..." />;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Plans</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Plans bundle rate cards (pricing) that customers subscribe to
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchPlans}
            className="inline-flex items-center px-4 py-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition"
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
        <div className={`p-3.5 rounded-lg text-sm flex items-center border ${message.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400' : 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-400'}`}>
          {message.type === 'success' ? <CheckCircle className="w-4 h-4 mr-2 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />}
          {message.text}
        </div>
      )}

      <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 text-indigo-700 dark:text-indigo-300 text-sm">
        <Package className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <p>
          A <strong>plan</strong> bundles <strong>rate cards</strong> (flat fee, per-unit, tiered,
          package, dynamic) grouped into <strong>phases</strong> (trials, ramps). Plans are{' '}
          <strong>versioned</strong> — editing a published plan creates a new draft version; publishing
          it makes it active and archives the previous one.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {plans.length === 0 ? (
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-12 text-center">
            <Package className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
            <p className="text-slate-500 dark:text-slate-400 text-sm">No plans yet. Click "Add Plan".</p>
          </div>
        ) : (
          plans.map((p) => (
            <div key={p.id} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col">
              <div className="p-5 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-white">{p.name}</h3>
                    <p className="font-mono text-xs text-slate-400 dark:text-slate-500 mt-0.5">{p.key} · v{p.version}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex px-2.5 py-1 rounded-md text-xs font-medium ${getStatusBadge(p.status)}`}>{p.status}</span>
                  </div>
                </div>
                {p.description && <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">{p.description}</p>}
                <div className="flex items-center gap-3 mt-3 text-xs text-slate-500 dark:text-slate-400">
                  <span className="inline-flex px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 font-medium">{p.currency}</span>
                  <span className="inline-flex px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 font-mono">{p.billingCadence}</span>
                  <span className="inline-flex px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700">{p.settlementMode}</span>
                </div>
              </div>

              <div className="p-5 flex-1 space-y-3">
                {!p.phases?.length && <p className="text-sm text-slate-400 dark:text-slate-500">No phases</p>}
                {p.phases?.map((ph) => (
                  <div key={ph.id || ph.key}>
                    <p className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-2">
                      <Layers className="w-3.5 h-3.5 inline mr-1 text-slate-400 dark:text-slate-500" />
                      {ph.name} {ph.duration ? `(${ph.duration})` : '(entire term)'}
                    </p>
                    {ph.rateCards?.length === 0 && <p className="text-xs text-slate-400 dark:text-slate-500">No rate cards</p>}
                    {ph.rateCards?.map((rc) => {
                      const model = rc.price?.type === 'flat' ? 'Flat fee' : (rc.price?.type || rc.type);
                      return (
                        <div key={rc.id || rc.key} className="flex items-center justify-between rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 px-3 py-2 mb-1.5">
                          <div className="flex items-center gap-2 min-w-0">
                            {rc.type === 'flat_fee' ? <Layers className="w-4 h-4 text-slate-400 dark:text-slate-500 flex-shrink-0" /> : <Package className="w-4 h-4 text-indigo-400 flex-shrink-0" />}
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{rc.name}</p>
                              <p className="font-mono text-[11px] text-slate-400 dark:text-slate-500 truncate">{model} · {rc.featureKey || 'flat fee'}</p>
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0 ml-2">
                            <p className="font-mono text-sm text-slate-700 dark:text-slate-200">
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

              <div className="px-5 py-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 dark:bg-slate-800/60 flex flex-wrap items-center justify-end gap-2">
                {p.status === 'draft' && (
                  <button
                    onClick={() => handlePublish(p)}
                    className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition"
                  >
                    <Rocket className="w-3.5 h-3.5 mr-1" /> Publish
                  </button>
                )}
                {p.status === 'draft' && (
                  <button
                    onClick={() => openEdit(p)}
                    className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 transition"
                  >
                    <Edit2 className="w-3.5 h-3.5 mr-1" /> Edit
                  </button>
                )}
                {p.status === 'active' && (
                  <button
                    onClick={() => handleNewVersion(p)}
                    className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition"
                  >
                    <GitBranch className="w-3.5 h-3.5 mr-1" /> Edit (new version)
                  </button>
                )}
                {p.status === 'scheduled' && (
                  <button
                    onClick={() => openEdit(p)}
                    className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 transition"
                  >
                    <Edit2 className="w-3.5 h-3.5 mr-1" /> Edit
                  </button>
                )}
                {(p.status === 'active' || p.status === 'scheduled') && (
                  <button
                    onClick={() => handleArchive(p)}
                    className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-500/20 transition"
                  >
                    <Archive className="w-3.5 h-3.5 mr-1" /> Archive
                  </button>
                )}
                {p.status !== 'active' && (
                  <button
                    onClick={() => handleDelete(p)}
                    className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add/Edit Plan modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 dark:bg-slate-950/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between sticky top-0 bg-white dark:bg-slate-900 z-10">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                {editingPlan ? `Edit ${editingPlan.name} v${editingPlan.version}` : 'Add Plan'}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg" title="Close"><X className="w-4 h-4" /></button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">Name</label>
                  <TextBox
                    type="text"
                    placeholder="API Basic Plan"
                    className="w-full"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">Key</label>
                  <TextBox
                    type="text"
                    placeholder="api_basic_plan"
                    className="w-full"
                    value={formData.key}
                    onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                    disabled={!!editingPlan}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">Currency</label>
                  <TextBox
                    type="text"
                    placeholder="USD"
                    maxLength="3"
                    className="w-full uppercase"
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
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">Description</label>
                  <TextArea
                    rows="2"
                    placeholder="Optional description shown to customers"
                    className="w-full"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
              </div>

              <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Phases</label>
                  <button
                    onClick={addPhase}
                    className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" /> Add phase
                  </button>
                </div>
                <p className="text-xs text-slate-400 dark:text-slate-500 mb-3">
                  Phases run in order and create time-based offering changes (e.g. a trial, then the paid plan).
                </p>

                {formData.phases.map((ph, pi) => (
                  <div key={pi} className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 mb-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Phase {pi + 1}</span>
                      {formData.phases.length > 1 && (
                        <button
                          onClick={() => removePhase(pi)}
                          className="p-1 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded"
                          title="Remove phase"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Key</label>
                        <TextBox
                          type="text"
                          placeholder="default"
                          className="w-full"
                          value={ph.key}
                          onChange={(e) => setPhase(pi, 'key', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Name</label>
                        <TextBox
                          type="text"
                          placeholder="Default"
                          className="w-full"
                          value={ph.name}
                          onChange={(e) => setPhase(pi, 'name', e.target.value)}
                        />
                      </div>
                      <div className="relative">
                        <SearchableSelect
                          label="Duration"
                          options={DURATIONS}
                          value={ph.duration}
                          onChange={(v) => setPhase(pi, 'duration', v)}
                          placeholder="Entire term"
                          allowCustom
                        />
                      </div>
                    </div>

                    <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
                      <div className="flex items-center justify-between mb-3">
                        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Rate cards</label>
                        <button
                          onClick={() => addRateCard(pi)}
                          className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition"
                        >
                          <Plus className="w-3.5 h-3.5 mr-1" /> Add rate card
                        </button>
                      </div>

                      {(ph.rateCards || []).map((rc, ri) => (
                        <div key={ri} className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 mb-3 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Rate card {ri + 1}</span>
                            {ph.rateCards.length > 1 && (
                              <button
                                onClick={() => removeRateCard(pi, ri)}
                                className="p-1 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded"
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
                                onChange={(v) => setRateCard(pi, ri, 'model', v)}
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Name</label>
                              <TextBox
                                type="text"
                                placeholder="API Requests"
                                className="w-full"
                                value={rc.name}
                                onChange={(e) => setRateCard(pi, ri, 'name', e.target.value)}
                              />
                            </div>
                            <div className="relative">
                              <SearchableSelect
                                label={rc.model === 'flat' ? 'Feature (optional)' : 'Feature'}
                                options={features.map((f) => ({ value: f.key, label: `${f.name} (${f.key})` }))}
                                value={rc.featureKey}
                                onChange={(v) => setRateCard(pi, ri, 'featureKey', v)}
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
                                  onChange={(v) => setRateCard(pi, ri, 'cadence', v)}
                                />
                              </div>
                            )}

                            {rc.model === 'unit' && (
                              <div>
                                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Unit price</label>
                                <TextBox
                                  type="number"
                                  min="0"
                                  step="any"
                                  placeholder="0.01"
                                  className="w-full"
                                  value={rc.amount}
                                  onChange={(e) => setRateCard(pi, ri, 'amount', e.target.value)}
                                />
                              </div>
                            )}

                            {rc.model === 'package' && (
                              <>
                                <div>
                                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Price per package</label>
                                  <TextBox
                                    type="number"
                                    min="0"
                                    step="any"
                                    placeholder="10.00"
                                    className="w-full"
                                    value={rc.amount}
                                    onChange={(e) => setRateCard(pi, ri, 'amount', e.target.value)}
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Units per package</label>
                                  <TextBox
                                    type="number"
                                    min="1"
                                    step="any"
                                    placeholder="20"
                                    className="w-full"
                                    value={rc.quantityPerPackage}
                                    onChange={(e) => setRateCard(pi, ri, 'quantityPerPackage', e.target.value)}
                                  />
                                </div>
                              </>
                            )}

                            {rc.model === 'dynamic' && (
                              <div>
                                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Multiplier (markup)</label>
                                <TextBox
                                  type="number"
                                  min="0"
                                  step="any"
                                  placeholder="1.0"
                                  className="w-full"
                                  value={rc.multiplier}
                                  onChange={(e) => setRateCard(pi, ri, 'multiplier', e.target.value)}
                                />
                                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">1.0 = base price, 1.5 = +50% markup.</p>
                              </div>
                            )}
                          </div>

                          {rc.model === 'tiered' && (
                            <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
                              <div className="relative max-w-xs mb-3">
                                <SearchableSelect
                                  label="Tiering mode"
                                  options={TIER_MODES}
                                  value={rc.tierMode}
                                  onChange={(v) => setRateCard(pi, ri, 'tierMode', v)}
                                />
                              </div>
                              <div className="space-y-2">
                                {rc.tiers.map((tier, t) => (
                                  <div key={t} className="flex items-center gap-2">
                                    <TextBox
                                      type="number"
                                      min="0"
                                      step="any"
                                      placeholder="Up to (∞ = blank)"
                                      className="w-1/3"
                                      value={tier.upToAmount}
                                      onChange={(e) => setTier(pi, ri, t, 'upToAmount', e.target.value)}
                                    />
                                    <TextBox
                                      type="number"
                                      min="0"
                                      step="any"
                                      placeholder="Unit price"
                                      className="w-1/3"
                                      value={tier.unitPrice}
                                      onChange={(e) => setTier(pi, ri, t, 'unitPrice', e.target.value)}
                                    />
                                    <TextBox
                                      type="number"
                                      min="0"
                                      step="any"
                                      placeholder="Flat price"
                                      className="w-1/3"
                                      value={tier.flatPrice}
                                      onChange={(e) => setTier(pi, ri, t, 'flatPrice', e.target.value)}
                                    />
                                    <button
                                      onClick={() => removeTier(pi, ri, t)}
                                      className="p-1.5 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg"
                                      title="Remove tier"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  </div>
                                ))}
                                <button
                                  onClick={() => addTier(pi, ri)}
                                  className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition"
                                >
                                  <Plus className="w-3.5 h-3.5 mr-1" /> Add tier
                                </button>
                                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                                  Blank "up to" = open-ended (∞). Leave unit price or flat price blank to omit it.
                                </p>
                              </div>
                            </div>
                          )}

                          {rc.model === 'flat' && (
                            <div>
                              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Amount</label>
                              <TextBox
                                type="number"
                                min="0"
                                step="any"
                                placeholder="199.00"
                                className="w-full"
                                value={rc.amount}
                                onChange={(e) => setRateCard(pi, ri, 'amount', e.target.value)}
                              />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 sticky bottom-0 bg-white dark:bg-slate-900">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white">Cancel</button>
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
