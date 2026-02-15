import { useState } from 'react';
import type { ClientData, AIInsight } from '../../lib/process-csv';

const ICON_MAP: Record<string, string> = {
  warning: '\u26a0', success: '\u2713', tip: '\ud83d\udca1', info: '\u2139',
};

const COLOR_MAP: Record<string, { border: string; text: string }> = {
  warning: { border: 'border-l-accent-amber', text: 'text-accent-amber' },
  success: { border: 'border-l-accent-emerald', text: 'text-accent-emerald' },
  tip: { border: 'border-l-accent-sky', text: 'text-accent-sky' },
  info: { border: 'border-l-accent-violet', text: 'text-accent-violet' },
};

interface Props {
  data: ClientData;
  onRefresh: () => void;
}

export default function InsightsTab({ data, onRefresh }: Props) {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generateInsights() {
    setGenerating(true);
    setError(null);
    try {
      const resp = await fetch('/api/insights', {
        method: 'POST',
        credentials: 'include',
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || 'Failed');
      onRefresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to generate insights');
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-serif italic text-2xl text-text-primary">AI Insights</h2>
          <p className="text-xs text-text-muted mt-1">Powered by Kimi K2.5 via Kilo AI</p>
        </div>
        <button
          onClick={generateInsights}
          disabled={generating}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-accent-sky/25 bg-accent-sky/10 text-accent-sky hover:bg-accent-sky/[0.18] transition-colors disabled:opacity-50"
        >
          {generating ? (
            <>
              <span className="w-3 h-3 rounded-full border-2 border-accent-sky/30 border-t-accent-sky animate-spin" />
              Generating\u2026
            </>
          ) : (
            <>
              \ud83e\udde0 Generate Insights
            </>
          )}
        </button>
      </div>

      {error && <p className="text-accent-rose text-sm mb-4">\u274c {error}</p>}

      {data.insights.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-4xl mb-4 opacity-50">\ud83e\udde0</div>
          <h3 className="text-lg font-semibold text-text-primary mb-2">No insights yet</h3>
          <p className="text-text-muted text-sm mb-6">
            Click \u201cGenerate Insights\u201d to get AI-powered personalised financial advice
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.insights.map((ins, i) => (
            <InsightCard key={i} insight={ins} />
          ))}
        </div>
      )}
    </div>
  );
}

function InsightCard({ insight }: { insight: AIInsight }) {
  const colors = COLOR_MAP[insight.type] ?? COLOR_MAP.info;
  return (
    <div className={`bg-bg-card border border-border-subtle rounded-2xl p-5 border-l-[3px] ${colors.border} hover:border-border-default transition-colors`}>
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span className="text-base">{ICON_MAP[insight.type] ?? '\u2139'}</span>
        <span className="text-sm font-semibold text-text-primary flex-1">{insight.title}</span>
        {insight.metric && (
          <span className="font-mono text-xs font-semibold px-2 py-0.5 bg-white/[0.04] rounded text-text-primary">
            {insight.metric}
          </span>
        )}
      </div>
      <p className="text-sm leading-relaxed text-text-secondary">{insight.description}</p>
    </div>
  );
}
