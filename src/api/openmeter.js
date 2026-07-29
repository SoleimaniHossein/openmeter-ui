import axios from 'axios';

let API_TOKEN = localStorage.getItem('openmeter_token') || '';
// Use relative path - goes through Vite proxy
const API_BASE_URL = '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Authorization': `Bearer ${API_TOKEN}`,
    'Content-Type': 'application/json',
  },
  // Don't add any CORS headers - the proxy handles it
});

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
  if (response?.data?.data) return response.data.data;
  if (response?.data?.items) return response.data.items;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response)) return response;
  return [];
};

// Helper to get total count
const getTotal = (response) => {
  if (!response) return 0;
  if (response?.meta?.page?.total) return response.meta.page.total;
  if (response?.totalCount) return response.totalCount;
  if (Array.isArray(response)) return response.length;
  return 0;
};

// ============ METERS ============
export const getMeters = async () => {
  try {
    const response = await api.get('/openmeter/meters');
    return { 
      data: extractData(response), 
      total: getTotal(response.data) 
    };
  } catch (error) {
    console.error('Error fetching meters:', error);
    throw error;
  }
};

export const createMeter = async (meterData) => {
  try {
    const response = await api.post('/openmeter/meters', meterData);
    return response.data;
  } catch (error) {
    console.error('Error creating meter:', error);
    throw error;
  }
};

export const updateMeter = async (meterId, meterData) => {
  try {
    const response = await api.put(`/openmeter/meters/${meterId}`, meterData);
    return response.data;
  } catch (error) {
    console.error('Error updating meter:', error);
    throw error;
  }
};

export const deleteMeter = async (meterId) => {
  try {
    await api.delete(`/openmeter/meters/${meterId}`);
  } catch (error) {
    console.error('Error deleting meter:', error);
    throw error;
  }
};

export const queryMeter = async (meterId, from, to, granularity = 'PT1H', groupBy = []) => {
  try {
    const response = await api.post(`/openmeter/meters/${meterId}/query`, {
      from,
      to,
      granularity,
      group_by_dimensions: groupBy,
    });
    return response.data;
  } catch (error) {
    console.error('Error querying meter:', error);
    throw error;
  }
};

// ============ CUSTOMERS ============
export const getCustomers = async () => {
  try {
    const response = await api.get('/openmeter/customers');
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
    const response = await api.post('/openmeter/customers', customerData);
    return response.data;
  } catch (error) {
    console.error('Error creating customer:', error);
    throw error;
  }
};

export const updateCustomer = async (customerId, customerData) => {
  try {
    const response = await api.put(`/openmeter/customers/${customerId}`, customerData);
    return response.data;
  } catch (error) {
    console.error('Error updating customer:', error);
    throw error;
  }
};

export const deleteCustomer = async (customerId) => {
  try {
    await api.delete(`/openmeter/customers/${customerId}`);
  } catch (error) {
    console.error('Error deleting customer:', error);
    throw error;
  }
};

export const getCustomerBilling = async (customerId) => {
  try {
    const response = await api.get(`/openmeter/customers/${customerId}/billing`);
    return response.data;
  } catch (error) {
    console.error('Error fetching customer billing:', error);
    throw error;
  }
};

// ============ FEATURES ============
export const getFeatures = async () => {
  try {
    const response = await api.get('/openmeter/features');
    return { 
      data: extractData(response), 
      total: getTotal(response.data) 
    };
  } catch (error) {
    console.error('Error fetching features:', error);
    throw error;
  }
};

export const createFeature = async (featureData) => {
  try {
    const response = await api.post('/openmeter/features', featureData);
    return response.data;
  } catch (error) {
    console.error('Error creating feature:', error);
    throw error;
  }
};

export const deleteFeature = async (featureId) => {
  try {
    await api.delete(`/openmeter/features/${featureId}`);
  } catch (error) {
    console.error('Error deleting feature:', error);
    throw error;
  }
};

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

export const getEvents = async (params = {}) => {
  try {
    const response = await api.get('/openmeter/events', { params });
    return { 
      data: response.data?.data || [], 
      meta: response.data?.meta || {} 
    };
  } catch (error) {
    console.error('Error fetching events:', error);
    throw error;
  }
};

// ============ INVOICES ============
export const getInvoices = async (params = {}) => {
  try {
    const response = await api.get('/openmeter/billing/invoices', { params });
    return { 
      data: extractData(response), 
      total: getTotal(response.data) 
    };
  } catch (error) {
    console.error('Error fetching invoices:', error);
    throw error;
  }
};

export const getInvoice = async (invoiceId) => {
  try {
    const response = await api.get(`/openmeter/billing/invoices/${invoiceId}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching invoice:', error);
    throw error;
  }
};

export const deleteInvoice = async (invoiceId) => {
  try {
    await api.delete(`/openmeter/billing/invoices/${invoiceId}`);
  } catch (error) {
    console.error('Error deleting invoice:', error);
    throw error;
  }
};

export const advanceInvoice = async (invoiceId) => {
  try {
    const response = await api.post(`/openmeter/billing/invoices/${invoiceId}/advance`);
    return response.data;
  } catch (error) {
    console.error('Error advancing invoice:', error);
    throw error;
  }
};

// ============ PLANS ============
export const getPlans = async () => {
  try {
    const response = await api.get('/openmeter/plans');
    return { 
      data: extractData(response), 
      total: getTotal(response.data) 
    };
  } catch (error) {
    console.error('Error fetching plans:', error);
    throw error;
  }
};

// ============ SUBSCRIPTIONS ============
export const getSubscriptions = async () => {
  try {
    const response = await api.get('/openmeter/subscriptions');
    return { 
      data: extractData(response), 
      total: getTotal(response.data) 
    };
  } catch (error) {
    console.error('Error fetching subscriptions:', error);
    throw error;
  }
};

export default api;
