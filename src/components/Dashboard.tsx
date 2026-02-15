import { useState, useEffect, useCallback } from 'react';
import { useSession, signOut } from '../lib/auth-client';
import type { ClientData } from '../lib/process-csv';
import OverviewTab from './dashboard/OverviewTab';
import TransactionsTab from './dashboard/TransactionsTab';
import CategoriesTab from './dashboard/CategoriesTab';
import MerchantsTab from './dashboard/MerchantsTab';
import InsightsTab from './dashboard/InsightsTab';
import UploadModal from './dashboard/UploadModal';
import DataManagement from './dashboard/DataManagement';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'transactions', label: 'Transactions' },
  { id: 'categories', label: 'Categories' },
  { id: 'merchants', label: 'Merchants' },
  { id: 'insights', label: 'Insights' },
  { id: 'manage', label: 'Manage Data' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export default function Dashboard() {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [data, setData] = useState<ClientData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [isEmpty, setIsEmpty] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await fetch('/api/data', { credentials: 'include' });
      const json = await resp.json();
      if (json.empty) {
        setIsEmpty(true);
        setData(null);
      } else {
        setIsEmpty(false);
        setData(json.data);
      }
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleUploadComplete = () => {
    setShowUpload(false);
    fetchData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex gap-2">
          <span className="w-2 h-2 rounded-full bg-accent-emerald animate-pulse" />
          <span className="w-2 h-2 rounded-full bg-accent-emerald animate-pulse [animation-delay:150ms]" />
          <span className="w-2 h-2 rounded-full bg-accent-emerald animate-pulse [animation-delay:300ms]" />
        </div>
      </div>
    );
  }

  return (
    <div className="relative z-10 max-w-[1440px] mx-auto p-4 md:p-10">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-8">
        <div>
          <h1 className="font-serif italic text-4xl md:text-5xl font-normal leading-tight bg-gradient-to-r from-text-primary via-accent-emerald to-accent-sky bg-clip-text text-transparent">
            Ledgr
          </h1>
          {data && (
            <p className="text-[0.7rem] font-medium tracking-widest uppercase text-text-muted mt-1">
              {data.stats.dateRange.from} — {data.stats.dateRange.to} · {data.stats.totalTransactions.toLocaleString()} transactions
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowUpload(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-accent-emerald/25 bg-accent-emerald/10 text-accent-emerald hover:bg-accent-emerald/[0.18] transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M8 10V2m0 0L5 5m3-3 3 3M2 10v2a2 2 0 002 2h8a2 2 0 002-2v-2" />
            </svg>
            Upload CSV
          </button>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border border-border-subtle bg-bg-card text-accent-emerald">
            ● Revolut
          </span>
          <div className="flex items-center gap-2">
            {session?.user?.image && (
              <img src={session.user.image} alt="" className="w-7 h-7 rounded-full" />
            )}
            <button
              onClick={() => signOut()}
              className="text-xs text-text-muted hover:text-text-primary transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <nav className="flex gap-2 overflow-x-auto py-3 sticky top-0 z-50 bg-bg-primary border-b border-border-subtle">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium border transition-all ${
              activeTab === tab.id
                ? 'bg-bg-card text-text-primary border-accent-emerald'
                : 'bg-transparent text-text-muted border-border-subtle hover:text-text-secondary hover:border-border-default'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Content */}
      {isEmpty && !data ? (
        <div className="text-center py-20">
          <div className="text-4xl mb-4 opacity-50">📊</div>
          <h2 className="text-xl font-semibold text-text-primary mb-2">No data yet</h2>
          <p className="text-text-muted mb-6">
            Upload your Revolut CSV statement to get started
          </p>
          <button
            onClick={() => setShowUpload(true)}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium bg-accent-emerald/10 border border-accent-emerald/25 text-accent-emerald hover:bg-accent-emerald/[0.18] transition-colors"
          >
            Upload CSV
          </button>
        </div>
      ) : data ? (
        <div className="mt-6">
          {activeTab === 'overview' && <OverviewTab data={data} />}
          {activeTab === 'transactions' && <TransactionsTab data={data} />}
          {activeTab === 'categories' && <CategoriesTab data={data} />}
          {activeTab === 'merchants' && <MerchantsTab data={data} />}
          {activeTab === 'insights' && <InsightsTab data={data} onRefresh={fetchData} />}
          {activeTab === 'manage' && <DataManagement onDataChange={fetchData} />}
        </div>
      ) : null}

      {/* Footer */}
      <footer className="text-center py-8 mt-12 border-t border-border-subtle text-xs text-text-muted">
        Dashboard powered by AI insights · Data encrypted at rest · Not financial advice
      </footer>

      {/* Upload Modal */}
      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onComplete={handleUploadComplete}
        />
      )}
    </div>
  );
}
