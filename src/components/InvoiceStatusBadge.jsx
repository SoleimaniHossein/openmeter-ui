import React from 'react';

const STATUS_STYLES = {
  gathering: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300',
  draft: 'bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400',
  issuing: 'bg-indigo-100 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300',
  issued: 'bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400',
  payment_processing: 'bg-purple-100 dark:bg-purple-500/15 text-purple-700 dark:text-purple-400',
  overdue: 'bg-orange-100 dark:bg-orange-500/15 text-orange-700 dark:text-orange-400',
  paid: 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  uncollectible: 'bg-red-100 dark:bg-red-500/15 text-red-700 dark:text-red-400',
  voided: 'bg-slate-200 dark:bg-slate-600 text-slate-500 dark:text-slate-400',
};

const STATUS_LABELS = {
  gathering: 'Gathering',
  draft: 'Draft',
  issuing: 'Issuing',
  issued: 'Issued',
  payment_processing: 'Payment Processing',
  overdue: 'Overdue',
  paid: 'Paid',
  uncollectible: 'Uncollectible',
  voided: 'Voided',
};

const InvoiceStatusBadge = ({ status, extendedStatus }) => {
  const base = STATUS_STYLES[status] || 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300';
  const label = STATUS_LABELS[status] || status || 'Unknown';
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${base}`}>
      {label}
      {extendedStatus && extendedStatus !== status && (
        <span className="ml-1 opacity-70">({extendedStatus})</span>
      )}
    </span>
  );
};

export default InvoiceStatusBadge;
