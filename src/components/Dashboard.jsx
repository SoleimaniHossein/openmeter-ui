import React, { useState, useEffect } from 'react';
import { Users, Activity, TrendingUp, RefreshCw, Zap } from 'lucide-react';
import { getMeters, getCustomers, queryMeter } from '../api/openmeter';
import UsageChart from './UsageChart';
import LoadingSpinner from './LoadingSpinner';

const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalCustomers: 0, totalMeters: 0, totalUsage: 0 });
  const [chartData, setChartData] = useState([]);
  const [error, setError] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [metersRes, customersRes] = await Promise.all([getMeters(), getCustomers()]);
      const meters = metersRes.data || [];
      const customers = customersRes.data || [];

      let usageData = [];
      let totalUsage = 0;

      if (meters.length > 0) {
        const now = new Date();
        const from = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        try {
          const result = await queryMeter(
            meters[0].id,
            from.toISOString(),
            now.toISOString(),
            'PT1H'
          );
          if (result?.data) {
            usageData = result.data.map(p => ({ from: p.from, value: p.value || 0 }));
            totalUsage = usageData.reduce((sum, p) => sum + p.value, 0);
          }
        } catch (e) { console.warn('Meter query failed:', e); }
      }

      setChartData(usageData);
      setStats({ totalCustomers: customers.length, totalMeters: meters.length, totalUsage });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  if (loading) return <LoadingSpinner message="Loading dashboard..." />;
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <p className="text-red-600 font-semibold">Error loading data</p>
        <p className="text-red-500 text-sm">{error}</p>
        <button onClick={fetchData} className="mt-3 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition">Retry</button>
      </div>
    );
  }

  const StatCard = ({ title, value, icon: Icon, color }) => (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div><p className="text-sm text-gray-500">{title}</p><p className="text-2xl font-semibold">{value}</p></div>
        <div className={`p-3 bg-${color}-100 rounded-full`}><Icon className={`w-6 h-6 text-${color}-600`} /></div>
      </div>
    </div>
  );

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <StatCard title="Total Customers" value={stats.totalCustomers} icon={Users} color="blue" />
        <StatCard title="Total Meters" value={stats.totalMeters} icon={Activity} color="green" />
        <StatCard title="Total Usage (24h)" value={stats.totalUsage} icon={TrendingUp} color="orange" />
      </div>
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center"><Zap className="w-5 h-5 mr-2 text-yellow-500" />Usage Overview</h3>
        {chartData.length > 0 ? <UsageChart data={chartData} /> : <p className="text-center text-gray-500 py-8">No usage data available</p>}
      </div>
      <button onClick={fetchData} className="fixed bottom-8 right-8 bg-blue-600 text-white p-3 rounded-full shadow-lg hover:bg-blue-700 transition">
        <RefreshCw className="w-6 h-6" />
      </button>
    </div>
  );
};

export default Dashboard;
