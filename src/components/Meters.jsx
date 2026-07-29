import React, { useState, useEffect } from 'react';
import { Plus, RefreshCw, Edit2, Trash2, Eye } from 'lucide-react';
import { getMeters, createMeter, updateMeter, deleteMeter, queryMeter } from '../api/openmeter';
import LoadingSpinner from './LoadingSpinner';

const Meters = () => {
  const [meters, setMeters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingMeter, setEditingMeter] = useState(null);
  const [formData, setFormData] = useState({ name: '', key: '', aggregation: 'COUNT', eventType: 'api_requests' });
  const [viewingUsage, setViewingUsage] = useState(null);

  const fetchMeters = async () => {
    setLoading(true);
    try {
      const res = await getMeters();
      setMeters(res.data || []);
    } catch (error) { console.error('Error:', error); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchMeters(); }, []);

  const handleSubmit = async () => {
    try {
      if (editingMeter) {
        await updateMeter(editingMeter.id, formData);
      } else {
        await createMeter(formData);
      }
      setShowModal(false);
      setEditingMeter(null);
      setFormData({ name: '', key: '', aggregation: 'COUNT', eventType: 'api_requests' });
      fetchMeters();
    } catch (error) { console.error('Error:', error); }
  };

  const handleDelete = async (id) => {
    if (confirm('Delete this meter?')) {
      try { await deleteMeter(id); fetchMeters(); } catch (error) { console.error('Error:', error); }
    }
  };

  const handleEdit = (meter) => {
    setEditingMeter(meter);
    setFormData({ name: meter.name, key: meter.key, aggregation: meter.aggregation, eventType: meter.eventType });
    setShowModal(true);
  };

  const handleViewUsage = async (meter) => {
    try {
      const now = new Date();
      const from = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const result = await queryMeter(meter.id, from.toISOString(), now.toISOString(), 'PT1H');
      const total = result?.data?.reduce((sum, p) => sum + (p.value || 0), 0) || 0;
      alert(`Meter: ${meter.name}\nTotal Usage (24h): ${total} units`);
    } catch (error) { alert('Error fetching usage'); }
  };

  if (loading) return <LoadingSpinner message="Loading meters..." />;

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Meters</h2>
        <button onClick={() => { setEditingMeter(null); setFormData({ name: '', key: '', aggregation: 'COUNT', eventType: 'api_requests' }); setShowModal(true); }} className="flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition">
          <Plus className="w-4 h-4 mr-2" /> Add Meter
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50"><tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Key</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Aggregation</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
          </tr></thead>
          <tbody className="divide-y divide-gray-200">
            {meters.length === 0 ? <tr><td colSpan="4" className="px-6 py-4 text-center text-gray-500">No meters</td></tr> :
              meters.map(m => <tr key={m.id}>
                <td className="px-6 py-4">{m.name}</td>
                <td className="px-6 py-4 font-mono text-sm">{m.key}</td>
                <td className="px-6 py-4"><span className="px-2 py-1 bg-blue-100 text-blue-600 rounded text-xs">{m.aggregation}</span></td>
                <td className="px-6 py-4">
                  <button onClick={() => handleViewUsage(m)} className="p-1 text-blue-600 hover:bg-blue-50 rounded"><Eye className="w-4 h-4" /></button>
                  <button onClick={() => handleEdit(m)} className="p-1 text-green-600 hover:bg-green-50 rounded"><Edit2 className="w-4 h-4" /></button>
                  <button onClick={() => handleDelete(m.id)} className="p-1 text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
                </td>
              </tr>)
            }
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-md">
          <h3 className="text-lg font-semibold mb-4">{editingMeter ? 'Edit' : 'Add'} Meter</h3>
          <div className="space-y-3">
            <input type="text" placeholder="Name" className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
            <input type="text" placeholder="Key" className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500" value={formData.key} onChange={e => setFormData({ ...formData, key: e.target.value })} disabled={!!editingMeter} />
            <select className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500" value={formData.aggregation} onChange={e => setFormData({ ...formData, aggregation: e.target.value })}>
              <option value="COUNT">Count</option>
              <option value="SUM">Sum</option>
              <option value="AVG">Average</option>
              <option value="MIN">Min</option>
              <option value="MAX">Max</option>
            </select>
            <input type="text" placeholder="Event Type" className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500" value={formData.eventType} onChange={e => setFormData({ ...formData, eventType: e.target.value })} />
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

export default Meters;
