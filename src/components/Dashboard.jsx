import React, { useState, useEffect } from 'react';
import {
  Users,
  Activity,
  TrendingUp,
  RefreshCw,
  Zap,
  ArrowUpRight,
  Gauge,
  Layers,
} from 'lucide-react';
import { getMeters, getCustomers, queryMeter } from '../api/openmeter';
import UsageChart from './UsageChart';
import LoadingSpinner from './LoadingSpinner';
import { useTheme } from '../context/ThemeContext';

const Dashboard = () => {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalCustomers: 0, totalMeters: 0, totalUsage: 0, peakUsage: 0 });
  const [chartData, setChartData] = useState([]);
  const [meters, setMeters] = useState([]);
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
      let peakUsage = 0;

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
            peakUsage = usageData.reduce((max, p) => Math.max(max, p.value), 0);
          }
        } catch (e) { console.warn('Meter query failed:', e); }
      }

      setMeters(meters);
      setChartData(usageData);
      setStats({ totalCustomers: customers.length, totalMeters: meters.length, totalUsage, peakUsage });
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
      <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl p-8 text-center">
        <p className="text-red-600 dark:text-red-400 font-semibold">Error loading data</p>
        <p className="text-red-500 dark:text-red-400 text-sm mt-1">{error}</p>
        <button onClick={fetchData} className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition">Retry</button>
      </div>
    );
  }

  const StatCard = ({ title, value, sub, icon: Icon, accent }) => {
    const palettes = {
      indigo: {
        icon: 'from-indigo-500 to-violet-600',
        ring: 'text-indigo-600 dark:text-indigo-400',
        glow: 'bg-indigo-50 dark:bg-indigo-500/10',
      },
      emerald: {
        icon: 'from-emerald-500 to-teal-600',
        ring: 'text-emerald-600 dark:text-emerald-400',
        glow: 'bg-emerald-50 dark:bg-emerald-500/10',
      },
      amber: {
        icon: 'from-amber-500 to-orange-600',
        ring: 'text-amber-600 dark:text-amber-400',
        glow: 'bg-amber-50 dark:bg-amber-500/10',
      },
      sky: {
        icon: 'from-sky-500 to-blue-600',
        ring: 'text-sky-600 dark:text-sky-400',
        glow: 'bg-sky-50 dark:bg-sky-500/10',
      },
    };
    const p = palettes[accent] || palettes.indigo;
    return (
      <div className="group relative bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 transition hover:shadow-md dark:hover:shadow-black/40 hover:-translate-y-0.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-slate-500 dark:text-slate-400">{title}</p>
            <p className={`text-3xl font-bold mt-1.5 ${p.ring}`}>{value}</p>
            {sub && <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 flex items-center gap-1"><ArrowUpRight className="w-3 h-3" />{sub}</p>}
          </div>
          <div className={`w-12 h-12 rounded-xl ${p.glow} flex items-center justify-center flex-shrink-0`}>
            <Icon className={`w-6 h-6 ${p.ring}`} />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Welcome banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 text-white p-6 lg:p-8">
        <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-16 right-24 w-40 h-40 rounded-full bg-white/10 blur-3xl" />
        <div className="relative">
          <div className="flex items-center gap-2 text-indigo-200 text-sm font-medium">
            <Zap className="w-4 h-4" /> Usage &amp; billing overview
          </div>
          <h1 className="text-2xl lg:text-3xl font-bold mt-2">Welcome back 👋</h1>
          <p className="text-indigo-100 mt-1.5 max-w-xl text-sm lg:text-base">
            Here's what's happening across your meters, customers and usage in the last 24 hours.
          </p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        <StatCard title="Total Customers" value={stats.totalCustomers} sub="Across all plans" icon={Users} accent="indigo" />
        <StatCard title="Total Meters" value={stats.totalMeters} sub="Usage sources" icon={Activity} accent="emerald" />
        <StatCard title="Usage (24h)" value={stats.totalUsage.toLocaleString()} sub="Sum of top meter" icon={Gauge} accent="amber" />
        <StatCard title="Peak Hour" value={stats.peakUsage.toLocaleString()} sub="Highest single hour" icon={TrendingUp} accent="sky" />
      </div>

      {/* Chart + side panel */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center">
              <Zap className="w-5 h-5 mr-2 text-amber-500 dark:text-amber-400" /> Usage Overview
            </h3>
            {meters.length > 0 && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400 font-mono">
                {meters[0].slug}
              </span>
            )}
          </div>
          {chartData.length > 0 ? (
            <UsageChart data={chartData} />
          ) : (
            <p className="text-center text-slate-400 dark:text-slate-500 py-8">
              No usage data available
            </p>
          )}
        </div>

        {/* Top meters panel */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center mb-4">
            <Layers className="w-5 h-5 mr-2 text-indigo-500 dark:text-indigo-400" /> Meters
          </h3>
          {meters.length === 0 ? (
            <div className="text-center py-10">
              <Activity className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
              <p className="text-slate-500 dark:text-slate-400 text-sm">No meters configured yet.</p>
            </div>
          ) : (
            <ul className="space-y-2.5">
              {meters.slice(0, 6).map((m) => (
                <li
                  key={m.id}
                  className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 hover:bg-slate-50 dark:hover:bg-slate-800/70 transition"
                >
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500/15 to-violet-500/15 dark:from-indigo-400/20 dark:to-violet-400/20 flex items-center justify-center flex-shrink-0">
                    <Activity className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{m.name}</p>
                    <p className="font-mono text-xs text-slate-400 dark:text-slate-500 truncate">{m.slug}</p>
                  </div>
                  <span className="inline-flex px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[11px] font-semibold flex-shrink-0">
                    {m.aggregation}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <button
        onClick={fetchData}
        className="fixed bottom-8 right-8 bg-indigo-600 text-white p-3.5 rounded-full shadow-lg hover:bg-indigo-700 dark:hover:bg-indigo-500 transition"
        title="Refresh"
      >
        <RefreshCw className="w-6 h-6" />
      </button>
    </div>
  );
};

export default Dashboard;
