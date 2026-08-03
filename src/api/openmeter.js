import axios from 'axios';

let API_TOKEN = localStorage.getItem('openmeter_token') || '';

// The effective API base URL for browser requests. An explicit absolute
// VITE_API_BASE_URL is used verbatim (direct, non-proxy access in production).
// Otherwise the browser talks to its own origin via the Vite dev proxy, which
// forwards the request to the selected backend (no CORS needed).
const DEFAULT_API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const PROXY_TARGET_KEY = 'openmeter_proxy_target';

const getStoredProxyTarget = () => localStorage.getItem(PROXY_TARGET_KEY) || '';

// Extract the origin (scheme://host[:port]) from a backend URL so the Vite
// proxy can route the request to the selected backend. Normalizes bare
// host[:port] values to an http:// URL.
const toOrigin = (url) => {
  if (!url) return '';
  let value = String(url).trim();
  if (/^https?:/i.test(value)) {
    /* already absolute */
  } else if (/^\/\//.test(value)) {
    value = 'http:' + value;
  } else if (/^[a-zA-Z0-9][a-zA-Z0-9.-]*:\d+(\/|$)/.test(value)) {
    value = 'http://' + value;
  } else {
    return '';
  }
  try {
    return new URL(value).origin;
  } catch {
    return '';
  }
};

// Send the selected backend origin to the Vite dev proxy on every request. The
// proxy uses it to pick the upstream target (falling back to API_PROXY_TARGET).
const applyProxyTarget = () => {
  const target = getStoredProxyTarget() || import.meta.env.VITE_API_PROXY_TARGET || '';
  const origin = toOrigin(target);
  if (origin) {
    api.defaults.headers.common['X-API-Target'] = origin;
  } else {
    delete api.defaults.headers.common['X-API-Target'];
  }
};

const api = axios.create({
  baseURL: DEFAULT_API_BASE_URL,
  headers: {
    'Authorization': `Bearer ${API_TOKEN}`,
    'Content-Type': 'application/json',
  },
  // Don't add any CORS headers - the proxy handles it
});

applyProxyTarget();

// Tag likely-CORS failures so components can show a helpful message.
// Browsers can't distinguish CORS from other network errors, so we treat any
// no-response network error aimed at a different origin as a CORS problem.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.code === 'ERR_NETWORK' && !error.response && error.config?.baseURL) {
      const base = error.config.baseURL;
      if (/^https?:/i.test(base)) {
        try {
          if (new URL(base, window.location.origin).origin !== window.location.origin) {
            error.isCors = true;
            error.corsTarget = base;
          }
        } catch {
          /* ignore malformed URLs */
        }
      }
    }
    return Promise.reject(error);
  }
);

// Runtime API target management (editable from the Settings screen).
export const getApiProxyTarget = () => getStoredProxyTarget();

// The backend origin requests are currently routed to (for diagnostics).
export const getEffectiveProxyTarget = () =>
  api.defaults.headers.common['X-API-Target'] ||
  import.meta.env.VITE_API_PROXY_TARGET ||
  '(default via proxy)';

export const setApiProxyTarget = (url) => {
  const trimmed = (url || '').trim();
  if (trimmed) {
    localStorage.setItem(PROXY_TARGET_KEY, trimmed);
  } else {
    localStorage.removeItem(PROXY_TARGET_KEY);
  }
  applyProxyTarget();
};

// Token management
export const setApiToken = (token) => {
  API_TOKEN = token;
  localStorage.setItem('openmeter_token', token);
  api.defaults.headers['Authorization'] = `Bearer ${token}`;
};

export const getApiToken = () => API_TOKEN;

export const clearApiToken = () => {
  API_TOKEN = '';
  localStorage.removeItem('openmeter_token');
  delete api.defaults.headers['Authorization'];
};

// Helper to extract data from various response formats
const extractData = (response) => {
  if (!response) return [];
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response)) return response;
  if (response?.data?.items) return response.data.items;
  if (response?.data?.data) return response.data.data;
  if (response?.items) return response.items;
  return [];
};

// Helper to get total count
const getTotal = (response) => {
  if (!response) return 0;
  if (typeof response?.totalCount === 'number') return response.totalCount;
  if (typeof response?.data?.totalCount === 'number') return response.data.totalCount;
  if (response?.meta?.page?.total) return response.meta.page.total;
  if (Array.isArray(response?.data)) return response.data.length;
  if (Array.isArray(response)) return response.length;
  return 0;
};

// ============ METERS ============
// Meters use the upstream OpenMeter v1 API so SUM/AVG meters get full
// valueProperty + groupBy support (the legacy gateway only exposes snake_case).
export const getMeters = async (params = {}) => {
  try {
    const response = await api.get('/v1/meters', { params: { pageSize: 100, ...params } });
    return {
      data: extractData(response),
      total: getTotal(response.data),
    };
  } catch (error) {
    console.error('Error fetching meters:', error);
    throw error;
  }
};

export const createMeter = async (meterData) => {
  try {
    const response = await api.post('/v1/meters', meterData);
    return response.data;
  } catch (error) {
    console.error('Error creating meter:', error);
    throw error;
  }
};

// v1 only allows updating name, description and groupBy (slug/aggregation/eventType are immutable).
export const updateMeter = async (meterIdOrSlug, meterData) => {
  try {
    const response = await api.put(`/v1/meters/${meterIdOrSlug}`, meterData);
    return response.data;
  } catch (error) {
    console.error('Error updating meter:', error);
    throw error;
  }
};

export const deleteMeter = async (meterIdOrSlug) => {
  try {
    await api.delete(`/v1/meters/${meterIdOrSlug}`);
  } catch (error) {
    console.error('Error deleting meter:', error);
    throw error;
  }
};

const WINDOW_SIZE_MAP = { 'PT1M': 'MINUTE', 'PT1H': 'HOUR', 'P1D': 'DAY', 'P1M': 'MONTH' };

export const queryMeter = async (meterId, from, to, granularity = 'PT1H', groupBy = []) => {
  try {
    const response = await api.post(`/v1/meters/${meterId}/query`, {
      from,
      to,
      ...(granularity ? { windowSize: WINDOW_SIZE_MAP[granularity] || granularity } : {}),
      ...(Array.isArray(groupBy) && groupBy.length ? { groupBy } : {}),
    });
    const data = response.data?.data || [];
    // Normalize v1 rows (windowStart/windowEnd) to {from, value} for the charts.
    return {
      data: data.map((p) => ({ from: p.windowStart, to: p.windowEnd, value: p.value || 0, subject: p.subject })),
      from: response.data?.from,
      to: response.data?.to,
    };
  } catch (error) {
    console.error('Error querying meter:', error);
    throw error;
  }
};

// ============ CUSTOMERS ============
// Customers are served by the upstream OpenMeter API (v1) which returns the
// full resource including email and usage attribution.
export const getCustomers = async (params = {}) => {
  try {
    const response = await api.get('/v1/customers', { params });
    return {
      data: extractData(response),
      total: getTotal(response.data)
    };
  } catch (error) {
    console.error('Error fetching customers:', error);
    throw error;
  }
};

export const createCustomer = async (customerData) => {
  try {
    const response = await api.post('/v1/customers', customerData);
    return response.data;
  } catch (error) {
    console.error('Error creating customer:', error);
    throw error;
  }
};

export const updateCustomer = async (customerId, customerData) => {
  try {
    const response = await api.put(`/v1/customers/${customerId}`, customerData);
    return response.data;
  } catch (error) {
    console.error('Error updating customer:', error);
    throw error;
  }
};

export const deleteCustomer = async (customerId) => {
  try {
    await api.delete(`/v1/customers/${customerId}`);
  } catch (error) {
    console.error('Error deleting customer:', error);
    throw error;
  }
};

// ============ FEATURES ============
// Per OpenMeter docs, features are immutable after creation: there is no
// update endpoint. Features can only be created, listed, retrieved, and
// archived (DELETE). The `key` is the immutable identifier used throughout
// the API.
export const getFeatures = async (params = {}) => {
  try {
    const response = await api.get('/v1/features', { params: { pageSize: 100, ...params } });
    return {
      data: extractData(response),
      total: getTotal(response.data),
    };
  } catch (error) {
    console.error('Error fetching features:', error);
    throw error;
  }
};

export const createFeature = async (featureData) => {
  try {
    const response = await api.post('/v1/features', featureData);
    return response.data;
  } catch (error) {
    console.error('Error creating feature:', error);
    throw error;
  }
};

// There is no update endpoint for features in the v1 API. If you need to
// change a feature, archive it and create a new one with a new key.
export const archiveFeature = async (featureId) => {
  try {
    await api.delete(`/v1/features/${featureId}`);
  } catch (error) {
    console.error('Error archiving feature:', error);
    throw error;
  }
};

// Backwards-compatible alias used elsewhere in the UI.
export const deleteFeature = archiveFeature;

// ============ EVENTS ============
export const sendEvent = async (event) => {
  try {
    const response = await api.post('/openmeter/events', event, {
      headers: {
        'Content-Type': 'application/cloudevents+json'
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error sending event:', error);
    throw error;
  }
};

// List ingested events. Uses the upstream v2 endpoint which supports cursor
// pagination and a JSON `filter` (e.g. { type: { $eq: "api.request" } }).
export const getEvents = async ({ type, cursor, limit = 50 } = {}) => {
  try {
    const params = { limit };
    if (cursor) params.cursor = cursor;
    const filter = {};
    if (type) filter.type = { $eq: type };
    if (Object.keys(filter).length) params.filter = JSON.stringify(filter);
    const response = await api.get('/v2/events', { params });
    return {
      data: response.data?.items || [],
      nextCursor: response.data?.nextCursor || '',
      totalCount: typeof response.data?.totalCount === 'number' ? response.data.totalCount : null,
    };
  } catch (error) {
    console.error('Error fetching events:', error);
    throw error;
  }
};

// ============ INVOICES ============
// Billing operations use the upstream OpenMeter API (v1). The API gateway only
// exposes a read-only view of invoices, so write operations (generate invoice,
// approve, void, pending lines) must hit the upstream directly.
export const getInvoices = async (params = {}) => {
  try {
    const response = await api.get('/v1/billing/invoices', { params });
    return {
      data: extractData(response),
      total: getTotal(response.data)
    };
  } catch (error) {
    console.error('Error fetching invoices:', error);
    throw error;
  }
};

// Fetch invoices for a specific customer (filtered server-side)
export const getCustomerInvoices = async (customerId, params = {}) => {
  return getInvoices({ ...params, customers: customerId, expand: 'lines' });
};

export const getInvoice = async (invoiceId) => {
  try {
    const response = await api.get(`/v1/billing/invoices/${invoiceId}`, {
      params: { expand: 'lines' },
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching invoice:', error);
    throw error;
  }
};

export const deleteInvoice = async (invoiceId) => {
  try {
    await api.delete(`/v1/billing/invoices/${invoiceId}`);
  } catch (error) {
    console.error('Error deleting invoice:', error);
    throw error;
  }
};

export const advanceInvoice = async (invoiceId) => {
  try {
    const response = await api.post(`/v1/billing/invoices/${invoiceId}/advance`);
    return response.data;
  } catch (error) {
    console.error('Error advancing invoice:', error);
    throw error;
  }
};

// Send the invoice to the customer (approve + start payment workflow)
export const approveInvoice = async (invoiceId) => {
  try {
    const response = await api.post(`/v1/billing/invoices/${invoiceId}/approve`);
    return response.data;
  } catch (error) {
    console.error('Error approving invoice:', error);
    throw error;
  }
};

// Void an already issued invoice.
// The API requires a body: a reason plus the action on the line items.
export const voidInvoice = async (invoiceId, { reason = 'Voided by user', percentage = 100 } = {}) => {
  try {
    const response = await api.post(`/v1/billing/invoices/${invoiceId}/void`, {
      reason,
      action: {
        percentage,
        action: { type: 'discard' },
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error voiding invoice:', error);
    throw error;
  }
};

// Retry a failed invoice issuing/payment step.
export const retryInvoice = async (invoiceId) => {
  try {
    const response = await api.post(`/v1/billing/invoices/${invoiceId}/retry`);
    return response.data;
  } catch (error) {
    console.error('Error retrying invoice:', error);
    throw error;
  }
};

// Snapshot the current usage quantities into the usage-based line items of a draft invoice.
export const snapshotQuantitiesInvoice = async (invoiceId) => {
  try {
    const response = await api.post(`/v1/billing/invoices/${invoiceId}/snapshot-quantities`);
    return response.data;
  } catch (error) {
    console.error('Error snapshotting invoice quantities:', error);
    throw error;
  }
};

// "Call" an invoice for a specific customer from their pending line items.
// Returns an array of created invoices (one per currency).
export const invoiceCustomer = async (customerId) => {
  try {
    const response = await api.post('/v1/billing/invoices/invoice', { customerId });
    const created = Array.isArray(response.data) ? response.data : [response.data].filter(Boolean);
    return created;
  } catch (error) {
    console.error('Error invoicing customer:', error);
    throw error;
  }
};

// Add a pending line item (charge) to a customer so it can be invoiced later.
export const createPendingLine = async (customerId, currency, lines) => {
  try {
    const response = await api.post(
      `/v1/billing/customers/${customerId}/invoices/pending-lines`,
      { currency, lines }
    );
    return response.data;
  } catch (error) {
    console.error('Error creating pending line:', error);
    throw error;
  }
};

// ============ PLANS ============
export const getPlans = async (params = {}) => {
  try {
    const response = await api.get('/v1/plans', { params: { pageSize: 100, ...params } });
    return {
      data: extractData(response),
      total: getTotal(response.data),
    };
  } catch (error) {
    console.error('Error fetching plans:', error);
    throw error;
  }
};

export const getPlan = async (planIdOrKey) => {
  try {
    const response = await api.get(`/v1/plans/${planIdOrKey}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching plan:', error);
    throw error;
  }
};

export const createPlan = async (planData) => {
  try {
    const response = await api.post('/v1/plans', planData);
    return response.data;
  } catch (error) {
    console.error('Error creating plan:', error);
    throw error;
  }
};

export const updatePlan = async (planId, planData) => {
  try {
    const response = await api.put(`/v1/plans/${planId}`, planData);
    return response.data;
  } catch (error) {
    console.error('Error updating plan:', error);
    throw error;
  }
};

export const publishPlan = async (planId) => {
  try {
    const response = await api.post(`/v1/plans/${planId}/publish`);
    return response.data;
  } catch (error) {
    console.error('Error publishing plan:', error);
    throw error;
  }
};

export const archivePlan = async (planId) => {
  try {
    const response = await api.post(`/v1/plans/${planId}/archive`);
    return response.data;
  } catch (error) {
    console.error('Error archiving plan:', error);
    throw error;
  }
};

// Create the next draft version of a plan (used to edit published plans without
// affecting running subscriptions). Returns the new draft version.
export const createNextPlanVersion = async (planIdOrKey) => {
  try {
    const response = await api.post(`/v1/plans/${planIdOrKey}/next`);
    return response.data;
  } catch (error) {
    console.error('Error creating plan version:', error);
    throw error;
  }
};

export const deletePlan = async (planId) => {
  try {
    await api.delete(`/v1/plans/${planId}`);
  } catch (error) {
    console.error('Error deleting plan:', error);
    throw error;
  }
};

// ============ SUBSCRIPTIONS ============
export const getSubscriptions = async () => {
  try {
    const response = await api.get('/openmeter/subscriptions');
    return {
      data: extractData(response),
      total: getTotal(response.data),
    };
  } catch (error) {
    console.error('Error fetching subscriptions:', error);
    throw error;
  }
};

export const createSubscription = async (subscriptionData) => {
  try {
    const response = await api.post('/v1/subscriptions', subscriptionData);
    return response.data;
  } catch (error) {
    console.error('Error creating subscription:', error);
    throw error;
  }
};

// Cancel a subscription. timing: 'immediate' | 'next_billing_cycle' | RFC3339 date-time
export const cancelSubscription = async (subscriptionId, timing = 'immediate') => {
  try {
    const response = await api.post(`/v1/subscriptions/${subscriptionId}/cancel`, { timing });
    return response.data;
  } catch (error) {
    console.error('Error canceling subscription:', error);
    throw error;
  }
};

// Change a running subscription to another plan.
export const changeSubscription = async (subscriptionId, planKey, options = {}) => {
  try {
    const response = await api.post(`/v1/subscriptions/${subscriptionId}/change`, {
      timing: options.timing || 'immediate',
      plan: { key: planKey },
      ...(options.name ? { name: options.name } : {}),
    });
    return response.data;
  } catch (error) {
    console.error('Error changing subscription:', error);
    throw error;
  }
};

export default api;
