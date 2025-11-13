'use client';

import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { format } from 'date-fns';

interface TrendDataPoint {
  timestamp: Date | string;
  driftCount: number;
  totalResources: number;
  criticalCount?: number;
  highCount?: number;
}

interface TrendChartProps {
  data: TrendDataPoint[];
  type?: 'line' | 'area' | 'bar';
  showCritical?: boolean;
}

export default function TrendChart({
  data,
  type = 'area',
  showCritical = true,
}: TrendChartProps) {
  // Format data for charts
  const chartData = data.map((point) => ({
    date: format(
      typeof point.timestamp === 'string'
        ? new Date(point.timestamp)
        : point.timestamp,
      'MMM dd'
    ),
    drift: point.driftCount,
    total: point.totalResources,
    critical: point.criticalCount || 0,
    high: point.highCount || 0,
  }));

  const renderChart = () => {
    const commonProps = {
      data: chartData,
      margin: { top: 10, right: 30, left: 0, bottom: 0 },
    };

    switch (type) {
      case 'line':
        return (
          <LineChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line
              type="monotone"
              dataKey="drift"
              stroke="#f59e0b"
              strokeWidth={2}
              name="Drift Count"
            />
            <Line
              type="monotone"
              dataKey="total"
              stroke="#3b82f6"
              strokeWidth={2}
              name="Total Resources"
            />
            {showCritical && (
              <Line
                type="monotone"
                dataKey="critical"
                stroke="#dc2626"
                strokeWidth={2}
                name="Critical"
              />
            )}
          </LineChart>
        );

      case 'area':
        return (
          <AreaChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Area
              type="monotone"
              dataKey="drift"
              stackId="1"
              stroke="#f59e0b"
              fill="#fef3c7"
              name="Drift Count"
            />
            {showCritical && (
              <>
                <Area
                  type="monotone"
                  dataKey="critical"
                  stackId="2"
                  stroke="#dc2626"
                  fill="#fee2e2"
                  name="Critical"
                />
                <Area
                  type="monotone"
                  dataKey="high"
                  stackId="2"
                  stroke="#f97316"
                  fill="#ffedd5"
                  name="High"
                />
              </>
            )}
          </AreaChart>
        );

      case 'bar':
        return (
          <BarChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="drift" fill="#f59e0b" name="Drift Count" />
            {showCritical && (
              <>
                <Bar dataKey="critical" fill="#dc2626" name="Critical" />
                <Bar dataKey="high" fill="#f97316" name="High" />
              </>
            )}
          </BarChart>
        );

      default:
        return null;
    }
  };

  return (
    <ResponsiveContainer width="100%" height={300}>
      {renderChart()}
    </ResponsiveContainer>
  );
}
