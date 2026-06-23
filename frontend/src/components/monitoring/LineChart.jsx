import { forwardRef, useEffect, useRef } from 'react';
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';

Chart.register(
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Legend,
  Filler,
);

const LineChart = forwardRef(function LineChart({ data, options, height = 224 }, ref) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current) return undefined;

    chartRef.current = new Chart(canvasRef.current, {
      type: 'line',
      data,
      options,
    });

    if (ref) {
      if (typeof ref === 'function') {
        ref({ resetZoom: () => chartRef.current?.resetZoom?.() });
      } else {
        ref.current = { resetZoom: () => chartRef.current?.resetZoom?.() };
      }
    }

    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!chartRef.current) return;
    chartRef.current.data = data;
    chartRef.current.options = options;
    chartRef.current.update();
  }, [data, options]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: `${height}px` }}
      role="img"
      aria-label={data?.datasets?.[0]?.label || 'Gráfico de tendencias'}
    />
  );
});

export default LineChart;
