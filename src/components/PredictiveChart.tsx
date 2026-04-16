import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { predictNextPoints } from '../lib/regression';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface PredictiveChartProps {
  data: { x: number; y: number }[];
  label: string;
  unit?: string;
}

const PredictiveChart: React.FC<PredictiveChartProps> = ({ data, label, unit }) => {
  const last10 = data.slice(-10);
  const { predictions, projectionAlert } = predictNextPoints(last10, 5);
  
  const alertText = projectionAlert(2);

  const chartData = {
    labels: [
      ...data.map(d => d.x.toString()),
      ...predictions.slice(1).map(p => p.x.toString())
    ],
    datasets: [
      {
        label: `Actual ${label}`,
        data: data.map(d => d.y),
        borderColor: '#58A6FF',
        backgroundColor: '#58A6FF',
        borderWidth: 2,
        tension: 0.1,
        pointRadius: 2,
      },
      {
        label: `Predicted ${label}`,
        // The data array for the predicted line must be padded with nulls 
        // until the point where the actual data ends.
        data: [
          ...Array(data.length - 1).fill(null),
          ...predictions.map(p => p.y)
        ],
        borderColor: '#FF4D4F',
        borderDash: [5, 5],
        borderWidth: 2,
        tension: 0,
        pointRadius: 0,
      }
    ],
  };

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: '#8B949E',
          font: { size: 10, family: 'Inter' },
          usePointStyle: true,
        }
      },
      tooltip: {
        backgroundColor: '#161B22',
        titleColor: '#8B949E',
        bodyColor: '#C9D1D9',
        borderColor: '#30363D',
        borderWidth: 1,
      }
    },
    scales: {
      x: {
        grid: { color: '#30363D', drawTicks: false },
        ticks: { color: '#8B949E', font: { size: 9 } }
      },
      y: {
        grid: { color: '#30363D', drawTicks: false },
        ticks: { 
          color: '#8B949E', 
          font: { size: 9 },
          callback: (value) => `${value}${unit || ''}`
        }
      }
    }
  };

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-bold text-accent uppercase tracking-widest">
          Linear Regression Lab
        </div>
        <div className="px-2 py-0.5 bg-danger/10 text-danger border border-danger/20 rounded text-[9px] font-bold animate-pulse">
          {alertText}
        </div>
      </div>
      <div className="flex-1 min-h-[180px]">
        <Line data={chartData} options={options} />
      </div>
    </div>
  );
};

export default PredictiveChart;
