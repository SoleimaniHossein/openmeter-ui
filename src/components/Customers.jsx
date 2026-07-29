import React, { useState, useEffect } from 'react';
import { Plus, RefreshCw, Edit2, Trash2, Eye } from 'lucide-react';
import { getCustomers, createCustomer, updateCustomer, deleteCustomer, getCustomerBilling } from '../api/openmeter';
import LoadingSpinner from './LoadingSpinner';

const Customers = () => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [formData, setFormData] = useState({ key: '', name: '', primaryEmail: '' });

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const res = await getCustomers();
      setCustomers(res.data || []);
    } catch (error) { console.error('Error:', error); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchCustomers(); }, []);

  const handleSubmit = async () => {
    try {
      if (editingCustomer) {
        await updateCustomer(editingCustomer.id, formData);
      } else {
        await createCustomer(formData);
      }
      setShowModal(false);
      setEditingCustomer(null);
      setFormData({ key: '', name: '', primaryEmail: '' });
      fetchCustomers();
    } catch (error) { console.error('Error:', error); }
  };

  const handleDelete = async (id) => {
    if (confirm('Delete this customer?')) {
      try { await deleteCustomer(id); fetchCustomers(); } catch (error) { console.error('Error:', error); }
    }
  };

  const handleEdit = (customer) => {
    setEditingCustomer(customer);
    setFormData({ key: customer.key, name: customer.name, primaryEmail: customer.primaryEmail || '' });
    setShowModal(true);
  };

  const handleViewBilling = async (customer) => {
    try {
      const billing = await getCustomerBilling(customer.id);
      alert(`Customer: ${customer.name}\nBilling Profile: ${billing?.billingProfile?.id || 'None'}\nApp Data: ${JSON.stringify(billing?.appData || {}, null, 2)}`);
    } catch (error) { alert('Error fetching billing data'); }
  };

  if (loading) return <LoadingSpinner message="Loading customers..." />;

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Customers</h2>
        <button onClick={() => { setEditingCustomer(null); setFormData({ key: '', name: '', primaryEmail: '' }); setShowModal(true); }} className="flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition">
          <Plus className="w-4 h-4 mr-2" /> Add Customer
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50"><tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Key</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
          </tr></thead>
          <tbody className="divide-y divide-gray-200">
            {customers.length === 0 ? <tr><td colSpan="4" className="px-6 py-4 text-center text-gray-500">No customers</td></tr> :
              customers.map(c => <tr key={c.id}>
                <td className="px-6 py-4 font-mono text-sm">{c.key}</td>
                <td className="px-6 py-4">{c.name}</td>
                <td className="px-6 py-4 text-sm text-gray-500">{c.primaryEmail || '-'}</td>
                <td className="px-6 py-4">
                  <button onClick={() => handleViewBilling(c)} className="p-1 text-blue-600 hover:bg-blue-50 rounded"><Eye className="w-4 h-4" /></button>
                  <button onClick={() => handleEdit(c)} className="p-1 text-green-600 hover:bg-green-50 rounded"><Edit2 className="w-4 h-4" /></button>
                  <button onClick={() => handleDelete(c.id)} className="p-1 text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
                </td>
              </tr>)
            }
          </tbody>
        </table>
      </div>

      {showModal && <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-md">
          <h3 className="text-lg font-semibold mb-4">{editingCustomer ? 'Edit' : 'Add'} Customer</h3>
          <div className="space-y-3">
            <input type="text" placeholder="Key" className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500" value={formData.key} onChange={e => setFormData({ ...formData, key: e.target.value })} disabled={!!editingCustomer} />
            <input type="text" placeholder="Name" className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
            <input type="email" placeholder="Email" className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500" value={formData.primaryEmail} onChange={e => setFormData({ ...formData, primaryEmail: e.target.value })} />
          </div>
          <div className="flex justify-end space-x-3 mt-6">
            <button onClick={() => setShowModal(false)} className="px-4 py-2 text-gray-600 hover:text-gray-800">Cancel</button>
            <button onClick={handleSubmit} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition">Save</button>
          </div>
        </div>
      </div>}
    </div>
  );
};

export default Customers;
