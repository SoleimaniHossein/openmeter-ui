import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, RefreshCw, Edit2, Trash2, FileText, Receipt, Loader2, AlertCircle, CheckCircle, Users, Send, Info, PackagePlus, BadgeCheck, X, ArrowLeftRight, Ban } from 'lucide-react';
import { getCustomers, createCustomer, updateCustomer, deleteCustomer, invoiceCustomer, getPlans, createSubscription, cancelSubscription, changeSubscription } from '../api/openmeter';
import { describeInvoiceError, hasSubscription } from '../utils/billing';
import { describeApiError } from '../utils/errors';
import LoadingSpinner from './LoadingSpinner';
import SearchableSelect from './SearchableSelect';
import TextBox from './TextBox';
import { useConfirm } from '../hooks/useConfirm';

const EMPTY_FORM = { key: '', name: '', primaryEmail: '', currency: '', subjects: '' };

const parseSubjects = (value) =>
  (value || '').split(',').map((s) => s.trim()).filter(Boolean);

const Customers = () => {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [invoicingId, setInvoicingId] = useState(null);
  const [message, setMessage] = useState(null);
  const [formData, setFormData] = useState({ ...EMPTY_FORM });

  const [subscribeCustomer, setSubscribeCustomer] = useState(null);
  const [subscribing, setSubscribing] = useState(false);
  const [subscribePlanKey, setSubscribePlanKey] = useState('');
  const [alignCurrency, setAlignCurrency] = useState(true);
  const { requestConfirm, confirmDialog } = useConfirm();

  const [changingCustomer, setChangingCustomer] = useState(null);
  const [changing, setChanging] = useState(false);
  const [changePlanKey, setChangePlanKey] = useState('');
  const [changeTiming, setChangeTiming] = useState('immediate');

  const [cancelingCustomer, setCancelingCustomer] = useState(null);
  const [canceling, setCanceling] = useState(false);
  const [cancelTiming, setCancelTiming] = useState('immediate');

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getCustomers({ pageSize: 200 });
      setCustomers(res.data || []);
    } catch (error) {
      setMessage({ type: 'error', text: describeApiError(error, 'Failed to load customers') });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCustomers();
    getPlans()
      .then((res) => {
        setPlans(res.data || []);
        if (res.data?.length) setSubscribePlanKey(res.data[0].key);
      })
      .catch(() => setPlans([]));
  }, [fetchCustomers]);

  const getPlan = (key) => plans.find((p) => p.key === key);

  const handleSubmit = async () => {
    try {
      const subjectKeys = parseSubjects(formData.subjects);
      const payload = {
        key: formData.key,
        name: formData.name,
        ...(formData.primaryEmail ? { primaryEmail: formData.primaryEmail } : {}),
        ...(formData.currency ? { currency: formData.currency.toUpperCase() } : {}),
        ...(subjectKeys.length ? { usageAttribution: { subjectKeys } } : {}),
      };
      if (editingCustomer) {
        await updateCustomer(editingCustomer.id, payload);
      } else {
        await createCustomer(payload);
      }
      setShowModal(false);
      setEditingCustomer(null);
      setFormData({ ...EMPTY_FORM });
      setMessage({ type: 'success', text: `Customer ${editingCustomer ? 'updated' : 'created'} successfully.` });
      fetchCustomers();
    } catch (error) {
      setMessage({ type: 'error', text: describeApiError(error, 'Failed to save customer') });
    }
  };

  const handleDelete = async (id) => {
    try {
      await requestConfirm({
        title: 'Delete customer',
        message: 'Delete this customer? This cannot be undone.',
        confirmLabel: 'Delete',
        variant: 'danger',
        icon: Trash2,
        action: async () => {
          await deleteCustomer(id);
          fetchCustomers();
        },
      });
    } catch (error) { setMessage({ type: 'error', text: describeApiError(error, 'Failed to delete customer') }); }
  };

  const handleEdit = (customer) => {
    setEditingCustomer(customer);
    setFormData({
      key: customer.key || '',
      name: customer.name,
      primaryEmail: customer.primaryEmail || '',
      currency: customer.currency || '',
      subjects: (customer.usageAttribution?.subjectKeys || []).join(', '),
    });
    setShowModal(true);
  };

  const openSubscribe = (customer) => {
    setSubscribeCustomer(customer);
    setSubscribePlanKey(plans[0]?.key || '');
    setAlignCurrency(true);
  };

  const handleSubscribe = async () => {
    if (!subscribeCustomer || !subscribePlanKey) return;
    const plan = getPlan(subscribePlanKey);
    if (!plan) return;
    setSubscribing(true);
    setMessage(null);
    try {
      if (alignCurrency && subscribeCustomer.currency && plan.currency &&
          subscribeCustomer.currency.toUpperCase() !== plan.currency.toUpperCase()) {
        await updateCustomer(subscribeCustomer.id, {
          key: subscribeCustomer.key,
          name: subscribeCustomer.name,
          primaryEmail: subscribeCustomer.primaryEmail,
          currency: plan.currency,
          usageAttribution: subscribeCustomer.usageAttribution,
        });
      }
      await createSubscription({
        customerId: subscribeCustomer.id,
        plan: { key: plan.key },
        name: `${plan.name || plan.key} v${plan.version || 1}`,
      });
      setSubscribeCustomer(null);
      setMessage({ type: 'success', text: `${subscribeCustomer.name} is now subscribed to "${plan.name || plan.key}". Send usage events, then generate an invoice.` });
      fetchCustomers();
    } catch (error) {
      setMessage({ type: 'error', text: describeApiError(error, 'Failed to create subscription') });
    } finally {
      setSubscribing(false);
    }
  };

  const getActiveSubscription = (customer) =>
    customer?.subscriptions?.find((s) => s.status === 'active');

  const openChangePlan = (customer) => {
    const current = getActiveSubscription(customer);
    setChangingCustomer(customer);
    setChangePlanKey(plans.find((p) => p.key !== current?.plan?.key)?.key || plans[0]?.key || '');
    setChangeTiming('immediate');
  };

  const handleChangePlan = async () => {
    const subscription = getActiveSubscription(changingCustomer);
    if (!changingCustomer || !subscription || !changePlanKey) return;
    const plan = getPlan(changePlanKey);
    if (!plan) return;
    setChanging(true);
    setMessage(null);
    try {
      await changeSubscription(subscription.id, plan.key, {
        timing: changeTiming,
        name: `${plan.name || plan.key} v${plan.version || 1}`,
      });
      setChangingCustomer(null);
      setMessage({ type: 'success', text: `${changingCustomer.name}'s subscription will switch to "${plan.name || plan.key}"${changeTiming === 'immediate' ? '' : ' at the next billing cycle'}.` });
      fetchCustomers();
    } catch (error) {
      setMessage({ type: 'error', text: describeApiError(error, 'Failed to change subscription') });
    } finally {
      setChanging(false);
    }
  };

  const openCancel = (customer) => {
    setCancelingCustomer(customer);
    setCancelTiming('immediate');
  };

  const handleCancel = async () => {
    const subscription = getActiveSubscription(cancelingCustomer);
    if (!cancelingCustomer || !subscription) return;
    setCanceling(true);
    setMessage(null);
    try {
      await cancelSubscription(subscription.id, cancelTiming);
      setCancelingCustomer(null);
      setMessage({
        type: 'success',
        text: cancelTiming === 'immediate'
          ? `${cancelingCustomer.name}'s subscription has been canceled.`
          : `${cancelingCustomer.name}'s subscription will be canceled at the end of the current billing period.`,
      });
      fetchCustomers();
    } catch (error) {
      setMessage({ type: 'error', text: describeApiError(error, 'Failed to cancel subscription') });
    } finally {
      setCanceling(false);
    }
  };

  const handleGenerateInvoice = async (customer) => {
    setInvoicingId(customer.id);
    setMessage(null);
    try {
      await requestConfirm({
        title: 'Generate invoice',
        message: `Generate an invoice for "${customer.name}" from their pending line items?`,
        confirmLabel: 'Generate',
        icon: Receipt,
        action: async () => {
          const created = await invoiceCustomer(customer.id);
          setMessage({
            type: 'success',
            text: created.length
              ? `Invoice created for ${customer.name} (${created.map((i) => i.number || i.id).join(', ')}).`
              : `Invoice created for ${customer.name}.`,
          });
        },
      });
    } catch (error) {
      const info = describeInvoiceError(error, customer);
      let action = null;
      if (info.action?.kind === 'subscribe') {
        action = { label: info.action.label, onClick: () => openSubscribe(customer) };
      } else if (info.action?.kind === 'edit-customer') {
        action = { label: info.action.label, onClick: () => handleEdit(customer) };
      } else if (info.action?.kind === 'send-events') {
        const subject = customer?.usageAttribution?.subjectKeys?.[0] || '';
        action = { label: info.action.label, onClick: () => navigate(subject ? `/events?subject=${encodeURIComponent(subject)}` : '/events') };
      }
      setMessage({ type: 'error', title: info.title, hint: info.hint, action });
    } finally {
      setInvoicingId(null);
    }
  };

  const handleViewInvoices = (customer) => {
    navigate(`/invoices?customer=${encodeURIComponent(customer.id)}`);
  };

  const getInitials = (name) =>
    (name || '?').split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();

  if (loading) return <LoadingSpinner message="Loading customers..." />;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Customers</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Manage customers and generate their invoices</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchCustomers}
            className="inline-flex items-center px-4 py-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition"
          >
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </button>
          <button
            onClick={() => { setEditingCustomer(null); setFormData({ ...EMPTY_FORM }); setShowModal(true); }}
            className="inline-flex items-center px-4 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-medium shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition"
          >
            <Plus className="w-4 h-4 mr-2" /> Add Customer
          </button>
        </div>
      </div>

      {message && (
        <div className={`p-3.5 rounded-lg text-sm border ${message.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400' : 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-400'}`}>
          <div className="flex items-start">
            {message.type === 'success' ? <CheckCircle className="w-4 h-4 mr-2 flex-shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0 mt-0.5" />}
            <div className="flex-1">
              <p className="font-medium">{message.title || message.text}</p>
              {message.hint && <p className={`mt-1 text-xs ${message.type === 'success' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>{message.hint}</p>}
              {message.action && (
                <button
                  onClick={message.action.onClick}
                  className="mt-2 inline-flex items-center px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-400 text-xs font-medium hover:bg-red-50 dark:hover:bg-red-500/10 transition"
                >
                  <Send className="w-3.5 h-3.5 mr-1" /> {message.action.label}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 text-indigo-700 dark:text-indigo-300 text-sm">
        <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <p>
          To invoice a customer you need billable lines. Usage events only become lines when the customer
          is <strong>subscribed to a plan</strong> with rate cards. Add <strong>subject key(s)</strong> to the
          customer, subscribe them to a plan, send usage events with a matching{' '}
          <code className="text-xs">subject</code>, then click <strong>Invoice</strong>.
        </p>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Customer</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide hidden xl:table-cell">Key</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide hidden lg:table-cell">Subjects</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide hidden md:table-cell">Plan</th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {customers.length === 0 ? (
              <tr><td colSpan="5" className="px-6 py-12 text-center">
                <Users className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                <p className="text-slate-500 dark:text-slate-400 text-sm">No customers yet. Click "Add Customer".</p>
              </td></tr>
            ) : (
              customers.map((c) => {
                const subscribed = hasSubscription(c);
                return (
                  <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60/60 dark:hover:bg-slate-800/40 transition">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-br from-indigo-100 to-violet-100 text-indigo-600 dark:text-indigo-400 text-xs font-bold">
                          {getInitials(c.name)}
                        </div>
                        <div>
                          <p className="font-medium text-slate-900 dark:text-white">{c.name}</p>
                          {c.primaryEmail && <p className="text-xs text-slate-400 dark:text-slate-500">{c.primaryEmail}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono text-sm text-slate-600 dark:text-slate-300 hidden xl:table-cell">{c.key || '-'}</td>
                    <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400 hidden lg:table-cell">
                      {c.usageAttribution?.subjectKeys?.length
                        ? <span className="font-mono text-xs">{c.usageAttribution.subjectKeys.join(', ')}</span>
                        : '-'}
                    </td>
                    <td className="px-6 py-4 hidden md:table-cell">
                      {subscribed ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs font-medium">
                          <BadgeCheck className="w-3.5 h-3.5 mr-1" />
                          {c.subscriptions.find((s) => s.status === 'active')?.name || 'Subscribed'}
                        </span>
                      ) : (
                        <span className="inline-flex px-2.5 py-1 rounded-md bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 text-xs font-medium">
                          No plan
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-1.5">
                        {!subscribed && plans.length > 0 && (
                          <button
                            onClick={() => openSubscribe(c)}
                            className="inline-flex items-center px-2.5 py-1.5 rounded-lg text-xs font-medium bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 hover:bg-violet-100 dark:hover:bg-violet-500/20 transition"
                            title="Subscribe this customer to a plan so usage becomes billable"
                          >
                            <PackagePlus className="w-3.5 h-3.5 mr-1" /> Subscribe
                          </button>
                        )}
                        {subscribed && plans.length > 0 && (
                          <button
                            onClick={() => openChangePlan(c)}
                            className="inline-flex items-center px-2.5 py-1.5 rounded-lg text-xs font-medium bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-500/20 transition"
                            title="Change this customer's subscription to a different plan"
                          >
                            <ArrowLeftRight className="w-3.5 h-3.5 mr-1" /> Change
                          </button>
                        )}
                        {subscribed && (
                          <button
                            onClick={() => openCancel(c)}
                            className="inline-flex items-center px-2.5 py-1.5 rounded-lg text-xs font-medium bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 transition"
                            title="Cancel this customer's subscription"
                          >
                            <Ban className="w-3.5 h-3.5 mr-1" /> Cancel
                          </button>
                        )}
                        <button
                          onClick={() => handleGenerateInvoice(c)}
                          disabled={invoicingId === c.id}
                          className="inline-flex items-center px-2.5 py-1.5 rounded-lg text-xs font-medium bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Generate invoice from pending line items"
                        >
                          {invoicingId === c.id ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <FileText className="w-3.5 h-3.5 mr-1" />}
                          Invoice
                        </button>
                        <button
                          onClick={() => handleViewInvoices(c)}
                          className="inline-flex items-center px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition"
                          title="View this customer's invoices"
                        >
                          <Receipt className="w-3.5 h-3.5 mr-1" /> Invoices
                        </button>
                        <button onClick={() => handleEdit(c)} className="p-1.5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-lg" title="Edit"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(c.id)} className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg" title="Delete"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Customer modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 dark:bg-slate-950/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{editingCustomer ? 'Edit' : 'Add'} Customer</h3>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">Key</label>
                <TextBox
                  type="text"
                  placeholder="e.g. customer_001"
                  className="w-full"
                  value={formData.key}
                  onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                  disabled={!!editingCustomer}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">Name</label>
                <TextBox
                  type="text"
                  placeholder="ACME Inc."
                  className="w-full"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">Email</label>
                <TextBox
                  type="email"
                  placeholder="billing@acme.com"
                  className="w-full"
                  value={formData.primaryEmail}
                  onChange={(e) => setFormData({ ...formData, primaryEmail: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">Currency</label>
                <TextBox
                  type="text"
                  placeholder="USD"
                  className="w-full"
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                />
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5">
                  Must match the plan's currency. Leaving it blank lets the plan's currency be used.
                </p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">
                  Subjects <span className="text-slate-400 dark:text-slate-500 normal-case font-normal">(comma-separated)</span>
                </label>
                <TextBox
                  type="text"
                  placeholder="e.g. customer-001, user-42"
                  className="w-full"
                  value={formData.subjects}
                  onChange={(e) => setFormData({ ...formData, subjects: e.target.value })}
                />
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5">
                  Subject keys map usage events to this customer. Send events with a matching{' '}
                  <code className="text-[11px]">subject</code> to generate billable usage lines.
                </p>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white">Cancel</button>
              <button onClick={handleSubmit} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Subscribe modal */}
      {subscribeCustomer && (
        <div className="fixed inset-0 bg-slate-900/50 dark:bg-slate-950/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Subscribe {subscribeCustomer.name}</h3>
              <button onClick={() => setSubscribeCustomer(null)} className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg" title="Close"><X className="w-4 h-4" /></button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <SearchableSelect
                  label="Plan"
                  value={subscribePlanKey}
                  onChange={setSubscribePlanKey}
                  options={plans.map((p) => ({ value: p.key, label: `${p.name} (${p.currency}) — ${p.billingCadence || 'one-time'}` }))}
                  placeholder="Select a plan"
                />
                {getPlan(subscribePlanKey) && (
                  <ul className="mt-2 space-y-1 text-xs text-slate-500 dark:text-slate-400">
                    {getPlan(subscribePlanKey).phases?.flatMap((ph) => ph.rateCards || []).map((rc, i) => (
                      <li key={i} className="flex items-center justify-between">
                        <span>{rc.name}</span>
                        <span className="font-mono text-slate-400 dark:text-slate-500">
                          {rc.price?.type === 'usage_based' || rc.price?.type === 'unit'
                            ? `${rc.price.amount || 0} / ${rc.price.aggregation || 'unit'}`
                            : rc.price?.amount || ''}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {subscribeCustomer.currency && getPlan(subscribePlanKey)?.currency &&
                subscribeCustomer.currency.toUpperCase() !== getPlan(subscribePlanKey).currency.toUpperCase() && (
                <label className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={alignCurrency}
                    onChange={(e) => setAlignCurrency(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span>
                    Customer currency is <strong>{subscribeCustomer.currency}</strong> but the plan is{' '}
                    <strong>{getPlan(subscribePlanKey).currency}</strong>. Update the customer currency to match.
                  </span>
                </label>
              )}
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Once subscribed, send usage events for subject{' '}
                <code className="text-[11px]">{(subscribeCustomer.usageAttribution?.subjectKeys || ['<subject key>'])[0]}</code>{' '}
                to generate billable lines, then generate an invoice.
              </p>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
              <button onClick={() => setSubscribeCustomer(null)} className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white">Cancel</button>
              <button
                onClick={handleSubscribe}
                disabled={subscribing}
                className="inline-flex items-center px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 transition disabled:opacity-50"
              >
                {subscribing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <PackagePlus className="w-4 h-4 mr-2" />}
                Subscribe
              </button>
            </div>
          </div>
        </div>
      )}
      {confirmDialog}

      {/* Change plan modal */}
      {changingCustomer && (
        <div className="fixed inset-0 bg-slate-900/50 dark:bg-slate-950/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Change plan for {changingCustomer.name}</h3>
              <button onClick={() => setChangingCustomer(null)} className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg" title="Close"><X className="w-4 h-4" /></button>
            </div>
            <div className="px-6 py-4 space-y-4">
              {(() => {
                const current = getActiveSubscription(changingCustomer);
                return (
                  <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300">
                    Current plan: <strong>{current?.name || current?.plan?.key || 'Unknown'}</strong>
                    {current?.activeTo && ` · active until ${new Date(current.activeTo).toLocaleDateString()}`}
                  </div>
                );
              })()}
              <div>
                <SearchableSelect
                  label="New plan"
                  value={changePlanKey}
                  onChange={setChangePlanKey}
                  options={plans
                    .filter((p) => p.key !== getActiveSubscription(changingCustomer)?.plan?.key)
                    .map((p) => ({ value: p.key, label: `${p.name} (${p.currency}) — ${p.billingCadence || 'one-time'}` }))}
                  placeholder="Select a plan"
                />
                {getPlan(changePlanKey) && (
                  <ul className="mt-2 space-y-1 text-xs text-slate-500 dark:text-slate-400">
                    {getPlan(changePlanKey).phases?.flatMap((ph) => ph.rateCards || []).map((rc, i) => (
                      <li key={i} className="flex items-center justify-between">
                        <span>{rc.name}</span>
                        <span className="font-mono text-slate-400 dark:text-slate-500">
                          {rc.price?.type === 'usage_based' || rc.price?.type === 'unit'
                            ? `${rc.price.amount || 0} / ${rc.price.aggregation || 'unit'}`
                            : rc.price?.amount || ''}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">When to switch</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'immediate', label: 'Immediately' },
                    { value: 'next_billing_cycle', label: 'Next billing cycle' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setChangeTiming(opt.value)}
                      className={`px-3 py-2 rounded-lg border text-sm font-medium transition ${
                        changeTiming === opt.value
                          ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-300 dark:border-amber-500/30 text-amber-700 dark:text-amber-400'
                          : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
              <button onClick={() => setChangingCustomer(null)} className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white">Cancel</button>
              <button
                onClick={handleChangePlan}
                disabled={changing || !changePlanKey}
                className="inline-flex items-center px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 transition disabled:opacity-50"
              >
                {changing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ArrowLeftRight className="w-4 h-4 mr-2" />}
                Change Plan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel subscription modal */}
      {cancelingCustomer && (
        <div className="fixed inset-0 bg-slate-900/50 dark:bg-slate-950/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Cancel subscription for {cancelingCustomer.name}</h3>
              <button onClick={() => setCancelingCustomer(null)} className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg" title="Close"><X className="w-4 h-4" /></button>
            </div>
            <div className="px-6 py-4 space-y-4">
              {(() => {
                const current = getActiveSubscription(cancelingCustomer);
                return (
                  <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300">
                    <strong>{current?.name || current?.plan?.key || 'Active subscription'}</strong>
                    {current?.activeTo && ` · active until ${new Date(current.activeTo).toLocaleDateString()}`}
                  </div>
                );
              })()}
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">When to cancel</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'immediate', label: 'Immediately' },
                    { value: 'next_billing_cycle', label: 'End of billing period' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setCancelTiming(opt.value)}
                      className={`px-3 py-2 rounded-lg border text-sm font-medium transition ${
                        cancelTiming === opt.value
                          ? 'bg-red-50 dark:bg-red-500/10 border-red-300 dark:border-red-500/30 text-red-700 dark:text-red-400'
                          : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5">
                  {cancelTiming === 'immediate'
                    ? 'Usage stops being billable as soon as the subscription is canceled.'
                    : 'The subscription stays active until the end of the current billing period, then cancels.'}
                </p>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
              <button onClick={() => setCancelingCustomer(null)} className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white">Keep subscription</button>
              <button
                onClick={handleCancel}
                disabled={canceling}
                className="inline-flex items-center px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition disabled:opacity-50"
              >
                {canceling ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Ban className="w-4 h-4 mr-2" />}
                Cancel Subscription
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Customers;
