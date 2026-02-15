import { useState, useEffect } from 'react';

interface Upload {
  id: string;
  filename: string;
  rowCount: number;
  uploadedAt: string;
}

export default function DataManagement({ onDataChange }: { onDataChange: () => void }) {
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    fetch('/api/uploads', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setUploads(d.uploads || []))
      .finally(() => setLoading(false));
  }, []);

  async function deleteAll() {
    setDeleting(true);
    try {
      await fetch('/api/data', { method: 'DELETE', credentials: 'include' });
      setUploads([]);
      setConfirmDelete(false);
      onDataChange();
    } finally {
      setDeleting(false);
    }
  }

  async function exportData() {
    const resp = await fetch('/api/export', { credentials: 'include' });
    if (!resp.ok) return;
    const blob = await resp.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `ledgr-export-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="max-w-2xl">
      <h2 className="font-serif italic text-2xl text-text-primary mb-6">Manage Your Data</h2>

      {/* Upload history */}
      <section className="bg-bg-card border border-border-subtle rounded-2xl p-5 mb-6">
        <h3 className="text-xs uppercase tracking-wider text-text-secondary font-semibold mb-4">Upload History</h3>
        {loading ? (
          <p className="text-text-muted text-sm">Loading\u2026</p>
        ) : uploads.length === 0 ? (
          <p className="text-text-muted text-sm">No uploads yet.</p>
        ) : (
          <div className="space-y-2">
            {uploads.map((u) => (
              <div key={u.id} className="flex items-center justify-between px-3 py-2 bg-bg-elevated rounded-lg">
                <div>
                  <span className="text-sm text-text-primary font-medium">{u.filename}</span>
                  <span className="text-xs text-text-muted ml-3">{u.rowCount} rows</span>
                </div>
                <span className="text-xs text-text-muted">
                  {new Date(u.uploadedAt).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={exportData}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-accent-emerald/25 bg-accent-emerald/10 text-accent-emerald hover:bg-accent-emerald/[0.18] transition-colors"
        >
          \u21e9 Export Decrypted CSV
        </button>
        {confirmDelete ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-accent-rose">Delete ALL data?</span>
            <button
              onClick={deleteAll}
              disabled={deleting}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-accent-rose/20 text-accent-rose hover:bg-accent-rose/30 transition-colors disabled:opacity-50"
            >
              {deleting ? 'Deleting\u2026' : 'Yes, delete'}
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="px-4 py-2 rounded-lg text-sm font-medium text-text-muted hover:text-text-primary transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-accent-rose/25 bg-accent-rose/10 text-accent-rose hover:bg-accent-rose/[0.18] transition-colors"
          >
            \ud83d\uddd1 Delete All Data
          </button>
        )}
      </div>

      {/* Encryption notice */}
      <div className="mt-8 bg-bg-elevated rounded-xl p-4 border border-border-subtle">
        <h4 className="text-xs uppercase tracking-wider text-text-secondary font-semibold mb-2">\ud83d\udd10 Data Security</h4>
        <p className="text-sm text-text-muted leading-relaxed">
          Your uploaded CSV files are encrypted with AES-256-GCM using a key derived from your user ID
          and a server-side secret. Transaction data is stored in Cloudflare D1 and is only accessible
          when authenticated with your Microsoft account.
        </p>
      </div>
    </div>
  );
}
