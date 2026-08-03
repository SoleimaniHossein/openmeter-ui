import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Activity,
  TrendingUp,
  RefreshCw,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  Gauge,
  Layers,
  BarChart3,
  Radio,
} from 'lucide-react';
import { getMeters, getCustomers, queryMeter } from '../api/openmeter';
import { describeApiError } from '../utils/errors';
import UsageChart from './UsageChart';
import LoadingSpinner from './LoadingSpinner';

const RANGES = [
  { value: '1h', label: '1h', ms: 3600 * 1000, granularity: 'PT1M' },
  { value: '24h', label: '24h', ms: 24 * 3600 * 1000, granularity: 'PT1H' },
  { value: '7d', label: '7d', ms: 7 * 24 * 3600 * 1000, granularity: 'PT1H' },
  { value: '30d', label: '30d', ms: 30 * 24 * 3600 * 1000, granularity: 'P1D' },
  { value: '90d', label: '90d', ms: 90 * 24 * 3600 * 1000, granularity: 'P1D' },
  { value: '1y', label: '1y', ms: 365 * 24 * 3600 * 1000, granularity: 'P1M' },
];

const GRANULARITIES = [
  { value: 'PT1M', label: '1m', bucketMs: 60 * 1000 },
  { value: 'PT1H', label: '1h', bucketMs: 3600 * 1000 },
  { value: 'P1D', label: '1d', bucketMs: 24 * 3600 * 1000 },
  { value: 'P1M', label: '1mo', bucketMs: 30 * 24 * 3600 * 1000 },
];

const MAX_BUCKETS = 2000;

const bucketsFor = (rangeMs, granularity) => {
  const g = GRANULARITIES.find((x) => x.value === granularity);
  return g ? Math.round(rangeMs / g.bucketMs) : 0;
};

const labelFormatFor = (rangeMs, granularity) => {
  if (granularity === 'PT1M') return 'HH:mm';
  if (granularity === 'PT1H') return rangeMs <= 24 * 3600 * 1000 ? 'HH:mm' : 'MMM d HH:mm';
  if (granularity === 'P1D') return 'MMM d';
  return 'MMM yyyy';
};

const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [range, setRange] = useState('24h');
  const [granularity, setGranularity] = useState('PT1H');
  const [selectedMeterId, setSelectedMeterId] = useState('all');
  const [stats, setStats] = useState({ totalCustomers: 0, totalMeters: 0, totalUsage: 0, peakUsage: 0, avgUsage: 0, trend: 0 });
  const [meters, setMeters] = useState([]);
  const [meterUsage, setMeterUsage] = useState([]);
  const [combinedSeries, setCombinedSeries] = useState([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [metersRes, customersRes] = await Promise.all([getMeters(), getCustomers()]);
      const meters = metersRes.data || [];
      const customers = customersRes.data || [];

      const conf = RANGES.find((r) => r.value === range);
      const now = new Date();
      const from = new Date(now.getTime() - conf.ms);

      const usageByMeter = [];
      const combined = new Map();

      if (meters.length > 0) {
        const results = await Promise.all(
          meters.slice(0, 8).map(async (meter) => {
            try {
              const res = await queryMeter(meter.id, from.toISOString(), now.toISOString(), granularity);
              return { meter, data: res.data || [] };
            } catch {
              return { meter, data: [] };
            }
          })
        );
        for (const { meter, data } of results) {
          const total = data.reduce((s, p) => s + (p.value || 0), 0);
          const peak = data.reduce((mx, p) => Math.max(mx, p.value || 0), 0);
          usageByMeter.push({ meter, total, peak, series: data });
          for (const p of data) {
            const key = p.from;
            combined.set(key, (combined.get(key) || 0) + (p.value || 0));
          }
        }
        usageByMeter.sort((a, b) => b.total - a.total);
      }

      const combinedSeries = [...combined.entries()]
        .sort((a, b) => (a[0] < b[0] ? -1 : 1))
        .map(([from, value]) => ({ from, value }));

      const totalUsage = combinedSeries.reduce((s, p) => s + p.value, 0);
      const peakUsage = combinedSeries.reduce((mx, p) => Math.max(mx, p.value), 0);
      const avgUsage = combinedSeries.length ? Math.round(totalUsage / combinedSeries.length) : 0;

      let trend = 0;
      if (combinedSeries.length >= 4) {
        const half = Math.floor(combinedSeries.length / 2);
        const first = combinedSeries.slice(0, half).reduce((s, p) => s + p.value, 0);
        const second = combinedSeries.slice(half).reduce((s, p) => s + p.value, 0);
        if (first > 0) trend = Math.round(((second - first) / first) * 100);
      }

      setMeters(meters);
      setMeterUsage(usageByMeter);
      setCombinedSeries(combinedSeries);
      setStats({ totalCustomers: customers.length, totalMeters: meters.length, totalUsage, peakUsage, avgUsage, trend });
    } catch (err) {
      setError(describeApiError(err, 'Failed to load dashboard data'));
    } finally {
      setLoading(false);
    }
  }, [range, granularity]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const changeRange = (value) => {
    const r = RANGES.find((x) => x.value === value);
    setRange(value);
    setGranularity(r.granularity);
    setSelectedMeterId('all');
  };

  const conf = RANGES.find((r) => r.value === range);
  const labelFormat = labelFormatFor(conf.ms, granularity);
  const selected = meterUsage.find((u) => u.meter.id === selectedMeterId);
  const chartSeries = selectedMeterId === 'all' || !selected ? combinedSeries : selected.series;

  if (loading && !meters.length) return <LoadingSpinner message="Loading dashboard..." />;
  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl p-8 text-center">
        <p className="text-red-600 dark:text-red-400 font-semibold">Error loading data</p>
        <p className="text-red-500 dark:text-red-400 text-sm mt-1">{error}</p>
        <button onClick={fetchData} className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition">Retry</button>
      </div>
    );
  }

  const StatCard = ({ title, value, sub, icon: Icon, accent, trend }) => {
    const palettes = {
      indigo: { icon: 'from-indigo-500 to-violet-600', ring: 'text-indigo-600 dark:text-indigo-400', glow: 'bg-indigo-50 dark:bg-indigo-500/10' },
      emerald: { icon: 'from-emerald-500 to-teal-600', ring: 'text-emerald-600 dark:text-emerald-400', glow: 'bg-emerald-50 dark:bg-emerald-500/10' },
      amber: { icon: 'from-amber-500 to-orange-600', ring: 'text-amber-600 dark:text-amber-400', glow: 'bg-amber-50 dark:bg-amber-500/10' },
      sky: { icon: 'from-sky-500 to-blue-600', ring: 'text-sky-600 dark:text-sky-400', glow: 'bg-sky-50 dark:bg-sky-500/10' },
    };
    const p = palettes[accent] || palettes.indigo;
    return (
      <div className="relative bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 transition hover:shadow-md dark:hover:shadow-black/40 hover:-translate-y-0.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-slate-500 dark:text-slate-400">{title}</p>
            <p className={`text-3xl font-bold mt-1.5 ${p.ring} truncate`}>{value}</p>
            {sub && (
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5 flex items-center gap-1">
                {trend !== undefined && trend !== 0 && (
                  <span className={`inline-flex items-center gap-0.5 font-semibold ${trend > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                    {trend > 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {Math.abs(trend)}%
                  </span>
                )}
                {sub}
              </p>
            )}
          </div>
          <div className={`w-12 h-12 rounded-xl ${p.glow} flex items-center justify-center flex-shrink-0`}>
            <Icon className={`w-6 h-6 ${p.ring}`} />
          </div>
        </div>
      </div>
    );
  };

  const maxTotal = meterUsage.reduce((m, u) => Math.max(m, u.total), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-indigo-500 dark:text-indigo-400" /> Usage Overview
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Metered usage across your customers and meters.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            {RANGES.map((r) => (
              <button
                key={r.value}
                onClick={() => changeRange(r.value)}
                className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition ${
                  range === r.value
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            {GRANULARITIES.map((g) => {
              const buckets = bucketsFor(conf.ms, g.value);
              const disabled = buckets < 1 || buckets > MAX_BUCKETS;
              return (
                <button
                  key={g.value}
                  onClick={() => setGranularity(g.value)}
                  disabled={disabled}
                  title={disabled ? `Not available for the ${range} range` : `Bucket: ${g.label}`}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                    granularity === g.value
                      ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                  } ${disabled ? 'opacity-40 cursor-not-allowed hover:text-slate-500 dark:hover:text-slate-400' : ''}`}
                >
                  {g.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        <StatCard title="Total Customers" value={stats.totalCustomers.toLocaleString()} sub="Across all plans" icon={Users} accent="indigo" />
        <StatCard title="Total Meters" value={stats.totalMeters.toLocaleString()} sub="Usage sources" icon={Activity} accent="emerald" />
        <StatCard
          title={`Usage (${range})`}
          value={stats.totalUsage.toLocaleString()}
          sub="vs previous period"
          icon={Gauge}
          accent="amber"
          trend={stats.trend}
        />
        <StatCard title="Peak Bucket" value={stats.peakUsage.toLocaleString()} sub={`Avg ${stats.avgUsage.toLocaleString()} per bucket`} icon={TrendingUp} accent="sky" />
      </div>

      {/* Chart + meters breakdown */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="min-w-0">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center">
                <Zap className="w-5 h-5 mr-2 text-amber-500 dark:text-amber-400" />
                {selectedMeterId === 'all' || !selected ? 'All meters' : selected.meter.name}
              </h3>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 font-mono">
                {selectedMeterId === 'all' || !selected ? 'combined usage' : selected.meter.slug}
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5 max-w-full overflow-x-auto">
              <button
                onClick={() => setSelectedMeterId('all')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                  selectedMeterId === 'all'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <Radio className="w-3.5 h-3.5" /> All
              </button>
              {meterUsage.map(({ meter, total }) => (
                <button
                  key={meter.id}
                  onClick={() => setSelectedMeterId(meter.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                    selectedMeterId === meter.id
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {meter.slug}
                  <span className={selectedMeterId === meter.id ? 'text-indigo-200' : 'text-slate-400 dark:text-slate-500'}>{total.toLocaleString()}</span>
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="h-72 flex items-center justify-center">
              <LoadingSpinner message="Refreshing usage..." />
            </div>
          ) : chartSeries.length > 0 ? (
            <>
              <UsageChart data={chartSeries} labelFormat={labelFormat} />
              <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                <div>
                  <p className="text-xs text-slate-400 dark:text-slate-500">Total</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                    {chartSeries.reduce((s, p) => s + p.value, 0).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 dark:text-slate-500">Peak bucket</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                    {chartSeries.reduce((mx, p) => Math.max(mx, p.value), 0).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 dark:text-slate-500">Avg per bucket</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                    {chartSeries.length ? Math.round(chartSeries.reduce((s, p) => s + p.value, 0) / chartSeries.length).toLocaleString() : 0}
                  </p>
                </div>
              </div>
            </>
          ) : (
            <p className="text-center text-slate-400 dark:text-slate-500 py-16">No usage data available</p>
          )}
        </div>

        {/* Meters breakdown */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center mb-1">
            <Layers className="w-5 h-5 mr-2 text-indigo-500 dark:text-indigo-400" /> Meter breakdown
          </h3>
          <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">Usage per meter in the last {range} ({granularity} buckets).</p>
          {meters.length === 0 ? (
            <div className="text-center py-10">
              <Activity className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
              <p className="text-slate-500 dark:text-slate-400 text-sm">No meters configured yet.</p>
            </div>
          ) : (
            <ul className="space-y-2.5">
              {meterUsage.map(({ meter, total }) => {
                const share = maxTotal > 0 ? Math.max(4, Math.round((total / maxTotal) * 100)) : 0;
                const isActive = selectedMeterId === meter.id;
                return (
                  <li
                    key={meter.id}
                    onClick={() => setSelectedMeterId(meter.id)}
                    className={`group cursor-pointer p-3 rounded-xl border transition ${
                      isActive
                        ? 'border-indigo-200 dark:border-indigo-500/40 bg-indigo-50/60 dark:bg-indigo-500/10'
                        : 'border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 hover:bg-slate-50 dark:hover:bg-slate-800/70'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500/15 to-violet-500/15 dark:from-indigo-400/20 dark:to-violet-400/20 flex items-center justify-center flex-shrink-0">
                        <Activity className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{meter.name}</p>
                        <p className="font-mono text-xs text-slate-400 dark:text-slate-500 truncate">{meter.slug}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-bold text-slate-900 dark:text-white">{total.toLocaleString()}</p>
                        <p className="text-[11px] text-slate-400 dark:text-slate-500">{meter.aggregation}</p>
                      </div>
                    </div>
                    <div className="mt-2.5 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-500"
                        style={{ width: `${share}%` }}
                      />
                    </div>
                  </li>
                );
              })}
              {meters.length > 8 && (
                <li className="text-xs text-slate-400 dark:text-slate-500 text-center pt-1">
                  Showing top {meterUsage.length} of {meters.length} meters
                </li>
              )}
            </ul>
          )}
        </div>
      </div>

      <button
        onClick={fetchData}
        className="fixed bottom-8 right-8 bg-indigo-600 text-white p-3.5 rounded-full shadow-lg hover:bg-indigo-700 dark:hover:bg-indigo-500 transition"
        title="Refresh"
      >
        <RefreshCw className={`w-6 h-6 ${loading ? 'animate-spin' : ''}`} />
      </button>
    </div>
  );
};

export default Dashboard;
