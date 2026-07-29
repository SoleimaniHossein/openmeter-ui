import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, parseISO, isValid } from 'date-fns';

const UsageChart = ({ data }) => {
  const validData = (data || []).filter(p => p.from && isValid(new Date(p.from))).map(p => ({
    time: format(new Date(p.from), 'HH:mm'),
    value: p.value || 0,
  }));

  if (validData.length === 0) return <div className="h-64 flex items-center justify-center text-gray-500">No data</div>;

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={validData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="time" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip />
        <Line type="monotone" dataKey="value" stroke="#3B82F6" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
};

export default UsageChart;
