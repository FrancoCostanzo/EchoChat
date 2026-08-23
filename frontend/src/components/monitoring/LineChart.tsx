import { forwardRef, useEffect, useRef, type Ref } from 'react';
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
  type ChartData,
  type ChartOptions,
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

export interface LineChartHandle {
  resetZoom: () => void;
}

interface LineChartProps {
  data: ChartData<'line'>;
  options?: ChartOptions<'line'>;
  height?: number;
}

const LineChart = forwardRef(function LineChart({ data, options, height = 224 }: LineChartProps, ref: Ref<LineChartHandle>) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<Chart<'line'> | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return undefined;

    chartRef.current = new Chart(canvasRef.current, {
      type: 'line',
      data,
      options,
    });

    if (ref) {
      const handle: LineChartHandle = {
        resetZoom: () => (chartRef.current as Chart<'line'> & { resetZoom?: () => void })?.resetZoom?.(),
      };
      if (typeof ref === 'function') {
        ref(handle);
      } else {
        ref.current = handle;
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
    chartRef.current.options = options ?? {};
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
