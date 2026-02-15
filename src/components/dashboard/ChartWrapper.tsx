import { useEffect, useRef, useCallback } from 'react';
import { Chart, type ChartConfiguration } from 'chart.js/auto';

const CHART_GRID = 'rgba(255,255,255,0.04)';
const CHART_TICK = '#555570';
const TOOLTIP_BG = '#1e1e2a';
const TOOLTIP_BORDER = '#2a2a3a';

interface Props {
  config: ChartConfiguration;
  className?: string;
}

export default function ChartWrapper({ config, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  const createOrUpdate = useCallback(() => {
    if (!canvasRef.current) return;
    if (chartRef.current) chartRef.current.destroy();

    const isDoughnut = config.type === 'doughnut' || config.type === 'pie';
    const opts = { ...config.options } as any;
    opts.responsive = true;
    opts.maintainAspectRatio = false;
    if (!opts.plugins) opts.plugins = {};
    opts.plugins.tooltip = {
      backgroundColor: TOOLTIP_BG,
      borderColor: TOOLTIP_BORDER,
      borderWidth: 1,
      titleColor: '#e0e0f0',
      bodyColor: '#b0b0c0',
      padding: 10,
      cornerRadius: 8,
      ...(opts.plugins.tooltip ?? {}),
    };

    if (!isDoughnut) {
      if (!opts.scales) opts.scales = {};
      opts.scales.x = {
        grid: { color: CHART_GRID },
        ticks: { color: CHART_TICK, font: { size: 11 } },
        ...(opts.scales.x ?? {}),
      };
      opts.scales.y = {
        grid: { color: CHART_GRID },
        ticks: { color: CHART_TICK, font: { size: 11 } },
        ...(opts.scales.y ?? {}),
      };
    }

    chartRef.current = new Chart(canvasRef.current, { ...config, options: opts });
  }, [config]);

  useEffect(() => {
    createOrUpdate();
    return () => { chartRef.current?.destroy(); };
  }, [createOrUpdate]);

  return (
    <div className={className || 'chart-wrap'}>
      <canvas ref={canvasRef} />
    </div>
  );
}

export { CHART_GRID, CHART_TICK };
