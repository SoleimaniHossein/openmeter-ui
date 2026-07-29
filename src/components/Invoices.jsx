import React, { useState, useEffect } from 'react';
import { RefreshCw, FileText, Trash2, Eye } from 'lucide-react';
import { getInvoices, deleteInvoice, advanceInvoice, getInvoice } from '../api/openmeter';
import LoadingSpinner from './LoadingSpinner';

const Invoices = () => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const res = await getInvoices({ limit: 50 });
      setInvoices(res.data || []);
    } catch (error) { console.error('Error:', error); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchInvoices(); }, []);

  const handleDelete = async (id) => {
    if (confirm('Delete this invoice?')) {
      try { await deleteInvoice(id); fetchInvoices(); } catch (error) { console.error('Error:', error); }
    }
  };

  const handleAdvance = async (id) => {
    try { await advanceInvoice(id); fetchInvoices(); } catch (error) { console.error('Error:', error); }
  };

  const handleView = async (id) => {
    try {
      const invoice = await getInvoice(id);
      setSelectedInvoice(invoice);
    } catch (error) { console.error('Error:', error); }
  };

  if (loading) return <LoadingSpinner message="Loading invoices..." />;

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Invoices</h2>
        <button onClick={fetchInvoices} className="flex items-center px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition">
          <RefreshCw className="w-4 h-4 mr-2" /> Refresh
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50"><tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Number</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
          </tr></thead>
          <tbody className="divide-y divide-gray-200">
            {invoices.length === 0 ? <tr><td colSpan="5" className="px-6 py-4 text-center text-gray-500">No invoices</td></tr> :
              invoices.map(inv => <tr key={inv.id}>
                <td className="px-6 py-4 font-mono text-sm">{inv.number || inv.id}</td>
                <td className="px-6 py-4">{inv.customer?.name || inv.customer?.key || '-'}</td>
                <td className="px-6 py-4 font-semibold">${(inv.totals?.total || 0).toFixed(2)}</td>
                <td className="px-6 py-4"><span className={`px-2 py-1 rounded text-xs ${inv.status === 'paid' ? 'bg-green-100 text-green-600' : inv.status === 'draft' ? 'bg-yellow-100 text-yellow-600' : 'bg-gray-100 text-gray-600'}`}>{inv.status}</span></td>
                <td className="px-6 py-4">
                  <button onClick={() => handleView(inv.id)} className="p-1 text-blue-600 hover:bg-blue-50 rounded"><Eye className="w-4 h-4" /></button>
                  {inv.status === 'draft' && <button onClick={() => handleAdvance(inv.id)} className="p-1 text-green-600 hover:bg-green-50 rounded"><RefreshCw className="w-4 h-4" /></button>}
                  {inv.status === 'draft' && <button onClick={() => handleDelete(inv.id)} className="p-1 text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>}
                </td>
              </tr>)
            }
          </tbody>
        </table>
      </div>

      {selectedInvoice && <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-auto">
          <h3 className="text-lg font-semibold mb-4">Invoice Details</h3>
          <pre className="bg-gray-50 p-4 rounded text-sm overflow-auto">{JSON.stringify(selectedInvoice, null, 2)}</pre>
          <div className="flex justify-end mt-4"><button onClick={() => setSelectedInvoice(null)} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition">Close</button></div>
        </div>
      </div>}
    </div>
  );
};

export default Invoices;
