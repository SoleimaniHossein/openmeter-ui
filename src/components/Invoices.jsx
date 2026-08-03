import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { RefreshCw, FileText, Eye, Loader2, Receipt, Wallet, Clock, AlertCircle, CheckCircle, Info, Send } from 'lucide-react';
import { getInvoices, getCustomers, invoiceCustomer } from '../api/openmeter';
import { describeInvoiceError } from '../utils/billing';
import { describeApiError } from '../utils/errors';
import LoadingSpinner from './LoadingSpinner';
import InvoiceStatusBadge from './InvoiceStatusBadge';
import InvoiceDetail from './InvoiceDetail';
import SearchableSelect from './SearchableSelect';
import { useConfirm } from '../hooks/useConfirm';

const STATUS_FILTERS = [
  { label: 'All statuses', value: '' },
  { label: 'Gathering', value: 'gathering' },
  { label: 'Draft', value: 'draft' },
  { label: 'Issuing', value: 'issuing' },
  { label: 'Issued', value: 'issued' },
  { label: 'Payment processing', value: 'payment_processing' },
  { label: 'Overdue', value: 'overdue' },
  { label: 'Uncollectible', value: 'uncollectible' },
  { label: 'Paid', value: 'paid' },
  { label: 'Voided', value: 'voided' },
];

const formatMoney = (value, currency = 'USD') => {
  const num = Number(value || 0);
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD' }).format(num);
};

const Invoices = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlCustomer = searchParams.get('customer') || '';

  const [invoices, setInvoices] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCustomer, setSelectedCustomer] = useState(urlCustomer);
  const [statusFilter, setStatusFilter] = useState(
    (searchParams.get('status') || '').split(',').filter(Boolean)
  );
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [invoicing, setInvoicing] = useState(false);
  const [message, setMessage] = useState(null);
  const { requestConfirm, confirmDialog } = useConfirm();

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const params = { pageSize: 100, expand: 'lines' };
      if (selectedCustomer) params.customers = selectedCustomer;
      if (statusFilter.length) params.statuses = statusFilter;
      const res = await getInvoices(params);
      setInvoices(res.data || []);
    } catch (error) {
      setMessage({ type: 'error', text: describeApiError(error, 'Failed to load invoices') });
    } finally {
      setLoading(false);
    }
  }, [selectedCustomer, statusFilter]);

  const fetchCustomers = useCallback(async () => {
    try {
      const res = await getCustomers({ pageSize: 200 });
      setCustomers(res.data || []);
    } catch (error) {
      console.error('Error loading customers:', error);
    }
  }, []);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);
  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  useEffect(() => {
    const next = {};
    if (selectedCustomer) next.customer = selectedCustomer;
    if (statusFilter.length) next.status = statusFilter.join(',');
    setSearchParams(next, { replace: true });
  }, [selectedCustomer, statusFilter, setSearchParams]);

  const handleGenerateInvoice = async (customerId = selectedCustomer) => {
    if (!customerId) {
      setMessage({ type: 'error', text: 'Select a customer to invoice first.' });
      return;
    }
    const customer = customers.find((c) => c.id === customerId);
    setInvoicing(true);
    setMessage(null);
    try {
      await requestConfirm({
        title: 'Generate invoice',
        message: `Generate an invoice for "${customer?.name || customerId}" from their pending line items?`,
        confirmLabel: 'Generate',
        icon: Receipt,
        action: async () => {
          const created = await invoiceCustomer(customerId);
          await fetchInvoices();
          setMessage({
            type: 'success',
            text: created.length
              ? `Invoice created (${created.map((i) => i.number || i.id).join(', ')}).`
              : 'Invoice created successfully.',
          });
        },
      });
    } catch (error) {
      const info = describeInvoiceError(error, customer);
      let action = null;
      if (info.action?.kind === 'send-events') {
        const subject = customer?.usageAttribution?.subjectKeys?.[0] || '';
        action = { label: info.action.label, onClick: () => (window.location.href = subject ? `/events?subject=${encodeURIComponent(subject)}` : '/events') };
      } else if (info.action?.kind === 'subscribe') {
        action = { label: info.action.label, onClick: () => (window.location.href = '/customers') };
      } else if (info.action?.kind === 'edit-customer') {
        action = { label: info.action.label, onClick: () => (window.location.href = '/customers') };
      }
      setMessage({
        type: 'error',
        title: info.title,
        hint: info.hint,
        action,
      });
    } finally {
      setInvoicing(false);
    }
  };

  const customerName = (id) => customers.find((x) => x.id === id)?.name || id || '-';

  const stats = useMemo(() => {
    const total = invoices.reduce((sum, i) => sum + (Number(i.totals?.total) || 0), 0);
    const open = invoices.filter((i) => ['draft', 'issued', 'overdue', 'payment_processing', 'gathering'].includes(i.status));
    const paid = invoices.filter((i) => i.status === 'paid');
    return {
      count: invoices.length,
      total,
      open: open.length,
      paid: paid.length,
      currency: invoices.find((i) => i.currency)?.currency || 'USD',
    };
  }, [invoices]);

  if (loading && invoices.length === 0) return <LoadingSpinner message="Loading invoices..." />;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Invoices</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Create and manage invoices for your customers</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleGenerateInvoice}
            disabled={invoicing}
            className="inline-flex items-center px-4 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-medium shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {invoicing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />}
            Generate Invoice
          </button>
          <button
            onClick={fetchInvoices}
            className="inline-flex items-center px-4 py-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition"
          >
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
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
          The <strong>Generate Invoice</strong> action creates an invoice from a customer's pending line
          items. Customers need a <strong>subscription</strong> (rate cards) plus usage events for their
          subjects to produce billable lines.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500 dark:text-slate-400">Total Invoices</p>
            <Receipt className="w-4 h-4 text-slate-400 dark:text-slate-500" />
          </div>
          <p className="text-2xl font-semibold text-slate-900 dark:text-white mt-1">{stats.count}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500 dark:text-slate-400">Total Billed</p>
            <Wallet className="w-4 h-4 text-slate-400 dark:text-slate-500" />
          </div>
          <p className="text-2xl font-semibold text-slate-900 dark:text-white mt-1">{formatMoney(stats.total, stats.currency)}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500 dark:text-slate-400">Open</p>
            <FileText className="w-4 h-4 text-slate-400 dark:text-slate-500" />
          </div>
          <p className="text-2xl font-semibold text-amber-600 dark:text-amber-400 mt-1">{stats.open}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500 dark:text-slate-400">Paid</p>
            <Clock className="w-4 h-4 text-slate-400 dark:text-slate-500" />
          </div>
          <p className="text-2xl font-semibold text-emerald-600 dark:text-emerald-400 mt-1">{stats.paid}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <SearchableSelect
              label="Customer"
              value={selectedCustomer}
              onChange={setSelectedCustomer}
              options={[
                { value: '', label: 'All customers' },
                ...customers.map((c) => ({ value: c.id, label: `${c.name}${c.key ? ` (${c.key})` : ''}` })),
              ]}
              placeholder="All customers"
            />
          </div>
          <div>
            <SearchableSelect
              label="Status"
              multiple
              value={statusFilter}
              onChange={setStatusFilter}
              options={STATUS_FILTERS.filter((s) => s.value !== '').map((s) => ({ value: s.value, label: s.label }))}
              placeholder="All statuses"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={fetchInvoices}
              className="w-full px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition"
            >
              Apply Filters
            </button>
          </div>
          <div className="flex items-end justify-end">
            {selectedCustomer && (
              <span className="inline-flex items-center px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 text-xs font-medium">
                Filtered by customer
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Number</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Customer</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide hidden md:table-cell">Period</th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Total</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Status</th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {invoices.length === 0 ? (
              <tr><td colSpan="6" className="px-6 py-12 text-center">
                <Receipt className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                <p className="text-slate-500 dark:text-slate-400 text-sm">
                  {selectedCustomer ? 'No invoices for this customer yet. Click "Generate Invoice".' : 'No invoices found.'}
                </p>
              </td></tr>
            ) : (
              invoices.map((inv) => {
                const period = inv.period
                  ? `${new Date(inv.period.from).toLocaleDateString()} – ${new Date(inv.period.to).toLocaleDateString()}`
                  : '-';
                return (
                  <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60/60 dark:hover:bg-slate-800/40 transition">
                    <td className="px-6 py-4 font-mono text-sm text-slate-700 dark:text-slate-200">{inv.number || inv.id}</td>
                    <td className="px-6 py-4">
                      <p className="font-medium text-slate-900 dark:text-white">{inv.customer?.name || customerName(inv.customer?.id) || '-'}</p>
                      {inv.customer?.key && <p className="text-xs text-slate-400 dark:text-slate-500 font-mono">{inv.customer.key}</p>}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400 hidden md:table-cell">{period}</td>
                    <td className="px-6 py-4 font-semibold text-slate-900 dark:text-white text-right">{formatMoney(inv.totals?.total, inv.currency)}</td>
                    <td className="px-6 py-4"><InvoiceStatusBadge status={inv.status} extendedStatus={inv.statusDetails?.extendedStatus} /></td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        {inv.status === 'gathering' && (
                          <button
                            onClick={() => handleGenerateInvoice(inv.customer?.id)}
                            disabled={invoicing}
                            className="inline-flex items-center px-2.5 py-1.5 rounded-lg text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition disabled:opacity-50"
                          >
                            <FileText className="w-4 h-4 mr-1" /> Finalize
                          </button>
                        )}
                        <button
                          onClick={() => setSelectedInvoice(inv)}
                          className="inline-flex items-center px-2.5 py-1.5 rounded-lg text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition"
                        >
                          <Eye className="w-4 h-4 mr-1" /> View
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {selectedInvoice && (
        <InvoiceDetail invoice={selectedInvoice} onClose={() => setSelectedInvoice(null)} onChanged={fetchInvoices} />
      )}
      {confirmDialog}
    </div>
  );
};

export default Invoices;
