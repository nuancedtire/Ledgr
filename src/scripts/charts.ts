import { Chart, type ChartConfiguration } from 'chart.js/auto';

export const CHART_GRID = 'rgba(255,255,255,0.04)';
export const CHART_TICK = '#555570';
const TOOLTIP_BG = '#1e1e2a';
const TOOLTIP_BORDER = '#2a2a3a';

const registry = new Map<string, Chart>();

export function destroyChart(id: string): void {
  const existing = registry.get(id);
  if (existing) {
    existing.destroy();
    registry.delete(id);
  }
}

export function createChart(canvasId: string, config: ChartConfiguration): Chart | null {
  destroyChart(canvasId);
  const canvas = document.getElementById(canvasId) as HTMLCanvasElement | null;
  if (!canvas) return null;

  const isDoughnut = config.type === 'doughnut' || config.type === 'pie';

  // Deep-merge defaults
  const opts = config.options ?? {};
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

  config.options = opts;
  const chart = new Chart(canvas, config);
  registry.set(canvasId, chart);
  return chart;
}
