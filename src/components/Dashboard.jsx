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
      <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center">
        <p className="text-red-600 font-semibold">Error loading data</p>
        <p className="text-red-500 text-sm mt-1">{error}</p>
        <button onClick={fetchData} className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition">Retry</button>
      </div>
    );
  }

  const StatCard = ({ title, value, icon: Icon, accent }) => {
    const palettes = {
      indigo: { bg: 'bg-indigo-50', text: 'text-indigo-600', icon: 'bg-indigo-500/10' },
      emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', icon: 'bg-emerald-500/10' },
      amber: { bg: 'bg-amber-50', text: 'text-amber-600', icon: 'bg-amber-500/10' },
    };
    const p = palettes[accent] || palettes.indigo;
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-500">{title}</p>
            <p className="text-3xl font-semibold text-slate-900 mt-1">{value}</p>
          </div>
          <div className={`${p.icon} p-3 rounded-full`}>
            <Icon className={`w-6 h-6 ${p.text}`} />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard title="Total Customers" value={stats.totalCustomers} icon={Users} accent="indigo" />
        <StatCard title="Total Meters" value={stats.totalMeters} icon={Activity} accent="emerald" />
        <StatCard title="Total Usage (24h)" value={stats.totalUsage} icon={TrendingUp} accent="amber" />
      </div>
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
          <Zap className="w-5 h-5 mr-2 text-amber-500" /> Usage Overview
        </h3>
        {chartData.length > 0 ? <UsageChart data={chartData} /> : <p className="text-center text-slate-400 py-8">No usage data available</p>}
      </div>
      <button
        onClick={fetchData}
        className="fixed bottom-8 right-8 bg-indigo-600 text-white p-3.5 rounded-full shadow-lg hover:bg-indigo-700 transition"
        title="Refresh"
      >
        <RefreshCw className="w-6 h-6" />
      </button>
    </div>
  );
};

export default Dashboard;
