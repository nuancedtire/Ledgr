import type { ClientData } from './types';
import { renderOverview } from './tabs/overview';
import { renderTransactions } from './tabs/transactions';
import { renderCategories } from './tabs/categories';
import { renderMerchants } from './tabs/merchants';
import { renderInsights } from './tabs/insights';

const dataEl = document.getElementById('app-data');
const DATA: ClientData | null = dataEl
  ? JSON.parse(dataEl.textContent!)
  : null;

const TAB_RENDERERS: Record<string, (data: ClientData) => void> = {
  'tab-overview': renderOverview,
  'tab-transactions': renderTransactions,
  'tab-categories': renderCategories,
  'tab-merchants': renderMerchants,
  'tab-insights': renderInsights,
};

function initTab(target: string): void {
  if (!DATA) return; // No data loaded yet
  // Skip React-managed tabs
  if (target === 'tab-upload' || target === 'tab-manage') return;
  TAB_RENDERERS[target]?.(DATA);
}

// Tab switching
document.querySelectorAll<HTMLElement>('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    const target = tab.dataset.target!;
    document.getElementById(target)?.classList.add('active');
    initTab(target);
  });
});

// Init
const activeTab = document.querySelector<HTMLElement>('.tab.active');
initTab(activeTab?.dataset.target ?? 'tab-overview');
