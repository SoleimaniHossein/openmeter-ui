import React from 'react';

const STATUS_STYLES = {
  gathering: 'bg-slate-100 text-slate-600',
  draft: 'bg-amber-100 text-amber-700',
  issuing: 'bg-indigo-100 text-indigo-700',
  issued: 'bg-blue-100 text-blue-700',
  payment_processing: 'bg-purple-100 text-purple-700',
  overdue: 'bg-orange-100 text-orange-700',
  paid: 'bg-emerald-100 text-emerald-700',
  uncollectible: 'bg-red-100 text-red-700',
  voided: 'bg-slate-200 text-slate-500',
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
  const base = STATUS_STYLES[status] || 'bg-gray-100 text-gray-600';
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
