import React, { useState } from 'react';
import { X, RefreshCw, ArrowRight, Send, Trash2, Ban, AlertCircle } from 'lucide-react';
import { format, isValid } from 'date-fns';
import { advanceInvoice, approveInvoice, deleteInvoice, voidInvoice, getInvoice } from '../api/openmeter';
import InvoiceStatusBadge from './InvoiceStatusBadge';

const formatMoney = (value, currency = 'USD') => {
  const num = Number(value || 0);
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD' }).format(num);
};

const formatDate = (value) => {
  if (!value) return '-';
  const d = new Date(value);
  return isValid(d) ? format(d, 'MMM d, yyyy') : '-';
};

const formatPeriod = (period) => {
  if (!period?.from) return '-';
  const from = new Date(period.from);
  const to = period.to ? new Date(period.to) : null;
  if (!isValid(from)) return '-';
  const f = format(from, 'MMM d, yyyy');
  const t = to && isValid(to) ? format(to, 'MMM d, yyyy') : 'now';
  return `${f} – ${t}`;
};

const ActionButton = ({ onClick, disabled, loading, icon: Icon, label, color }) => (
  <button
    onClick={onClick}
    disabled={disabled || loading}
    className={`inline-flex items-center px-3 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed ${color}`}
  >
    {loading ? <RefreshCw className="w-4 h-4 mr-1.5 animate-spin" /> : <Icon className="w-4 h-4 mr-1.5" />}
    {label}
  </button>
);

const Field = ({ label, value }) => (
  <div>
    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">{label}</p>
    <p className="text-sm text-slate-700">{value || '—'}</p>
  </div>
);

const InvoiceDetail = ({ invoice: initialInvoice, onClose, onChanged }) => {
  const [invoice, setInvoice] = useState(initialInvoice);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [action, setAction] = useState(null);

  const available = invoice?.statusDetails?.availableActions || {};
  const currency = invoice?.currency || 'USD';
  const totals = invoice?.totals || {};
  const lines = invoice?.lines || [];

  const runAction = async (type, fn, confirmMsg) => {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setAction(type);
    setError(null);
    try {
      const updated = await fn(invoice.id);
      if (type === 'delete') {
        onClose();
        if (onChanged) onChanged();
        return;
      }
      if (updated) setInvoice(updated);
      if (onChanged) onChanged();
    } catch (err) {
      setError(err?.response?.data?.detail || err.message || 'Action failed');
    } finally {
      setAction(null);
    }
  };

  const handleRefresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const updated = await getInvoice(invoice.id);
      setInvoice(updated);
    } catch (err) {
      setError(err?.response?.data?.detail || err.message || 'Failed to refresh invoice');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h3 className="text-lg font-bold text-slate-900">Invoice {invoice.number || invoice.id}</h3>
              <InvoiceStatusBadge status={invoice.status} extendedStatus={invoice.statusDetails?.extendedStatus} />
            </div>
            <p className="text-sm text-slate-500 mt-1">
              {invoice.type === 'credit_note' ? 'Credit note' : 'Invoice'}
              {invoice.issuedAt && <> · Issued {formatDate(invoice.issuedAt)}</>}
              {invoice.dueAt && <> · Due {formatDate(invoice.dueAt)}</>}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-center">
              <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" /> {error}
            </div>
          )}

          {/* Parties */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6 bg-slate-50 rounded-xl border border-slate-100 p-4">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Supplier</p>
              <p className="font-semibold text-slate-900">{invoice.supplier?.name || '—'}</p>
              {invoice.supplier?.key && <p className="text-sm text-slate-500 font-mono">{invoice.supplier.key}</p>}
              {invoice.supplier?.taxId?.code && <p className="text-sm text-slate-500">Tax ID: {invoice.supplier.taxId.code}</p>}
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Customer</p>
              <p className="font-semibold text-slate-900">{invoice.customer?.name || '—'}</p>
              {invoice.customer?.key && <p className="text-sm text-slate-500 font-mono">{invoice.customer.key}</p>}
              {invoice.customer?.usageAttribution?.subjectKeys?.length > 0 && (
                <p className="text-sm text-slate-500">Subjects: {invoice.customer.usageAttribution.subjectKeys.join(', ')}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
            <Field label="Billing Period" value={formatPeriod(invoice.period)} />
            <Field label="Created" value={formatDate(invoice.createdAt)} />
            <Field label="Draft Until" value={formatDate(invoice.draftUntil)} />
          </div>

          {/* Line items */}
          <div className="overflow-hidden border border-slate-200 rounded-xl mb-6">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Item</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide hidden sm:table-cell">Period</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Qty</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lines.length === 0 && (
                  <tr><td colSpan="4" className="px-4 py-8 text-center text-slate-400">
                    {invoice.status === 'gathering' ? 'Gathering usage — no lines finalized yet.' : 'No line items.'}
                  </td></tr>
                )}
                {lines.map((line) => (
                  <tr key={line.id}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{line.name}</p>
                      {line.description && <p className="text-xs text-slate-400">{line.description}</p>}
                    </td>
                    <td className="px-4 py-3 text-slate-500 hidden sm:table-cell">{formatPeriod(line.period)}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{Number(line.quantity ?? 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">
                      {formatMoney(line.totals?.total, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="flex justify-end mb-6">
            <div className="w-full max-w-xs space-y-2 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal</span>
                <span>{formatMoney(totals.amount, currency)}</span>
              </div>
              {Number(totals.discountsTotal || 0) !== 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>Discounts</span>
                  <span>-{formatMoney(totals.discountsTotal, currency)}</span>
                </div>
              )}
              {Number(totals.creditsTotal || 0) !== 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>Credits</span>
                  <span>-{formatMoney(totals.creditsTotal, currency)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-600">
                <span>Taxes</span>
                <span>{formatMoney(totals.taxesTotal, currency)}</span>
              </div>
              <div className="flex justify-between font-bold text-slate-900 border-t border-slate-200 pt-2">
                <span>Total</span>
                <span>{formatMoney(totals.total, currency)}</span>
              </div>
            </div>
          </div>

          {invoice.externalIds?.invoicing && (
            <p className="text-xs text-slate-400">External invoicing ID: {invoice.externalIds.invoicing}</p>
          )}
        </div>

        {/* Actions footer */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-6 py-4 border-t border-slate-100">
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="inline-flex items-center px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <div className="flex flex-wrap gap-2">
            {available.advance && (
              <ActionButton
                onClick={() => runAction('advance', advanceInvoice)}
                loading={action === 'advance'}
                icon={ArrowRight}
                label="Advance"
                color="bg-indigo-600 text-white hover:bg-indigo-700"
              />
            )}
            {available.approve && (
              <ActionButton
                onClick={() => runAction('approve', approveInvoice, 'Send this invoice to the customer?')}
                loading={action === 'approve'}
                icon={Send}
                label="Send to Customer"
                color="bg-emerald-600 text-white hover:bg-emerald-700"
              />
            )}
            {available.delete && (
              <ActionButton
                onClick={() => runAction('delete', deleteInvoice, 'Delete this draft invoice?')}
                loading={action === 'delete'}
                icon={Trash2}
                label="Delete"
                color="bg-red-600 text-white hover:bg-red-700"
              />
            )}
            {available.void && (
              <ActionButton
                onClick={() => runAction('void', voidInvoice, 'Void this invoice?')}
                loading={action === 'void'}
                icon={Ban}
                label="Void"
                color="bg-slate-700 text-white hover:bg-slate-800"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvoiceDetail;
