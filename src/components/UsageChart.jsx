import React from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart
} from 'recharts';
import { format, parseISO, isValid } from 'date-fns';
import { useTheme } from '../context/ThemeContext';

const UsageChart = ({ data, labelFormat = 'HH:mm' }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const validData = (data || []).filter(p => p.from && isValid(new Date(p.from))).map(p => ({
    time: format(new Date(p.from), labelFormat),
    value: p.value || 0,
  }));

  const axisColor = isDark ? '#94a3b8' : '#64748b';
  const gridColor = isDark ? '#334155' : '#e2e8f0';
  const lineColor = isDark ? '#818cf8' : '#4f46e5';
  const tooltipBg = isDark ? '#1e293b' : '#ffffff';
  const tooltipBorder = isDark ? '#475569' : '#e2e8f0';
  const tooltipText = isDark ? '#f1f5f9' : '#1e293b';

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div
        className="rounded-lg border px-3 py-2 shadow-lg text-sm"
        style={{ background: tooltipBg, borderColor: tooltipBorder, color: tooltipText }}
      >
        <p className="font-semibold">{label}</p>
        <p className="mt-0.5 flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full" style={{ background: lineColor }} />
          {Number(payload[0].value || 0).toLocaleString()} units
        </p>
      </div>
    );
  };

  if (validData.length === 0) {
    return <div className="h-64 flex items-center justify-center text-slate-500 dark:text-slate-400">No data</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={validData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="usageGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={lineColor} stopOpacity={isDark ? 0.4 : 0.25} />
            <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
        <XAxis dataKey="time" tick={{ fontSize: 12, fill: axisColor }} axisLine={{ stroke: gridColor }} tickLine={false} minTickGap={24} />
        <YAxis tick={{ fontSize: 12, fill: axisColor }} axisLine={false} tickLine={false} width={48} />
        <Tooltip content={<CustomTooltip />} cursor={{ stroke: gridColor }} />
        <Area
          type="monotone"
          dataKey="value"
          stroke={lineColor}
          strokeWidth={2.5}
          fill="url(#usageGradient)"
          dot={false}
          activeDot={{ r: 5, strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
};

export default UsageChart;
