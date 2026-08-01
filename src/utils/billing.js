// Helpers for interpreting OpenMeter billing API errors and invoice readiness.

export const isNoLinesError = (error) => {
  const code = error?.response?.data?.extensions?.code;
  const detail = error?.response?.data?.detail || error?.message || '';
  return code === 'invoice_create_no_lines' || detail.toLowerCase().includes('would have no lines');
};

// Does this customer have any active subscription that provides rate cards?
export const hasSubscription = (customer) =>
  Array.isArray(customer?.subscriptions) && customer.subscriptions.some((s) => s.status === 'active');

export const hasSubjectKeys = (customer) =>
  Array.isArray(customer?.usageAttribution?.subjectKeys) && customer.usageAttribution.subjectKeys.length > 0;

// Returns a friendly, actionable explanation for a failed invoice generation.
// `action` is { label, kind } where kind is one of:
//   'subscribe' | 'edit-customer' | 'send-events'
// so the caller can route it appropriately.
export const describeInvoiceError = (error, customer) => {
  const name = customer?.name || 'this customer';

  if (isNoLinesError(error)) {
    if (!hasSubscription(customer)) {
      return {
        title: `Can't invoice ${name} yet — they have no subscription.`,
        hint: 'Usage events only become billable line items when the customer is subscribed to a plan with rate cards. Subscribe this customer to a plan first, then generate the invoice again.',
        action: { label: 'Subscribe to a plan', kind: 'subscribe' },
      };
    }
    if (!hasSubjectKeys(customer)) {
      return {
        title: `No billable line items found for ${name}.`,
        hint: 'Add subject key(s) to the customer so usage events are attributed to them, then send usage events for those subjects.',
        action: { label: 'Manage customer', kind: 'edit-customer' },
      };
    }
    return {
      title: `No billable usage found for ${name} in this period.`,
      hint: `Send usage events with subject "${customer?.usageAttribution?.subjectKeys?.[0] || ''}" for the plan's meter(s), then generate the invoice again.`,
      action: { label: 'Send usage events', kind: 'send-events' },
    };
  }

  return {
    title: error?.response?.data?.detail || error?.message || 'Failed to generate invoice.',
    hint: '',
  };
};
