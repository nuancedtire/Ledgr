import { useState, useMemo, useCallback } from 'react';

interface Transaction {
  id: string;
  date: string;
  time: string;
  desc: string;
  amt: number;
  fee: number;
  cat: string;
  type: string;
  bal: number | null;
  state: string;
  product: string;
}

interface Upload {
  id: string;
  filename: string;
  rowCount: number;
  uploadedAt: string;
}

interface Props {
  transactions: Transaction[];
  uploads: Upload[];
}

function fmtGBP(n: number): string {
  const sign = n < 0 ? '-' : '';
  return sign + '£' + Math.abs(n).toFixed(2);
}

export default function DataManager({ transactions: initialTxns, uploads: initialUploads }: Props) {
  const [transactions, setTransactions] = useState(initialTxns);
  const [uploads, setUploads] = useState(initialUploads);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState<'transactions' | 'uploads'>('transactions');

  // Unique categories and types
  const allCategories = useMemo(
    () => [...new Set(transactions.map((t) => t.cat))].sort(),
    [transactions],
  );
  const allTypes = useMemo(
    () => [...new Set(transactions.map((t) => t.type))].sort(),
    [transactions],
  );

  // Filtered transactions
  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      if (search && !t.desc.toLowerCase().includes(search.toLowerCase())) return false;
      if (categoryFilter && t.cat !== categoryFilter) return false;
      if (typeFilter && t.type !== typeFilter) return false;
      return true;
    });
  }, [transactions, search, categoryFilter, typeFilter]);

  // Pagination
  const [page, setPage] = useState(1);
  const perPage = 25;
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === paginated.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(paginated.map((t) => t.id)));
    }
  };

  const deleteSelected = useCallback(async () => {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} transaction(s)? This cannot be undone.`)) return;

    setDeleting(true);
    try {
      const resp = await fetch('/api/transactions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [...selected] }),
      });

      if (resp.ok) {
        setTransactions((prev) => prev.filter((t) => !selected.has(t.id)));
        setSelected(new Set());
      } else {
        const data = await resp.json();
        alert(`Delete failed: ${data.error || 'Unknown error'}`);
      }
    } catch (err) {
      alert('Delete failed: Network error');
    } finally {
      setDeleting(false);
    }
  }, [selected]);

  const deleteUpload = useCallback(async (uploadId: string) => {
    if (!confirm('Delete this upload and all its transactions? This cannot be undone.')) return;

    try {
      const resp = await fetch('/api/uploads', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uploadId }),
      });

      if (resp.ok) {
        setUploads((prev) => prev.filter((u) => u.id !== uploadId));
        window.location.reload(); // Refresh to update transaction list
      } else {
        const data = await resp.json();
        alert(`Delete failed: ${data.error || 'Unknown error'}`);
      }
    } catch {
      alert('Delete failed: Network error');
    }
  }, []);

  return (
    <div className="data-manager">
      <div className="dm-tabs">
        <button
          className={`dm-tab ${activeTab === 'transactions' ? 'active' : ''}`}
          onClick={() => setActiveTab('transactions')}
        >
          Transactions ({transactions.length})
        </button>
        <button
          className={`dm-tab ${activeTab === 'uploads' ? 'active' : ''}`}
          onClick={() => setActiveTab('uploads')}
        >
          Uploads ({uploads.length})
        </button>
      </div>

      {activeTab === 'transactions' && (
        <div className="dm-transactions">
          {/* Filters */}
          <div className="dm-filters">
            <input
              type="text"
              placeholder="Search descriptions…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="dm-search"
            />
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setPage(1);
              }}
              className="dm-select"
            >
              <option value="">All Categories</option>
              {allCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setPage(1);
              }}
              className="dm-select"
            >
              <option value="">All Types</option>
              {allTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            {selected.size > 0 && (
              <button
                className="btn btn-danger"
                onClick={deleteSelected}
                disabled={deleting}
              >
                {deleting ? 'Deleting…' : `Delete ${selected.size} selected`}
              </button>
            )}
          </div>

          {/* Results count */}
          <p className="dm-count">
            Showing {paginated.length} of {filtered.length} transactions
          </p>

          {/* Table */}
          <div className="dm-table-wrap">
            <table className="dm-table">
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      checked={paginated.length > 0 && selected.size === paginated.length}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Category</th>
                  <th>Type</th>
                  <th className="text-right">Amount</th>
                  <th className="text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((t) => (
                  <tr key={t.id} className={selected.has(t.id) ? 'selected' : ''}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selected.has(t.id)}
                        onChange={() => toggleSelect(t.id)}
                      />
                    </td>
                    <td className="mono">{t.date}</td>
                    <td className="desc-cell">{t.desc}</td>
                    <td>
                      <span className="cat-badge">{t.cat}</span>
                    </td>
                    <td>{t.type}</td>
                    <td className={`text-right mono ${t.amt >= 0 ? 'positive' : 'negative'}`}>
                      {fmtGBP(t.amt)}
                    </td>
                    <td className="text-right mono">{t.bal !== null ? fmtGBP(t.bal) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="dm-pagination">
              <button
                className="btn btn-sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                ← Prev
              </button>
              <span>
                Page {page} of {totalPages}
              </span>
              <button
                className="btn btn-sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next →
              </button>
            </div>
          )}
        </div>
      )}

      {activeTab === 'uploads' && (
        <div className="dm-uploads">
          {uploads.length === 0 ? (
            <p className="dm-empty">No uploads yet. Upload a Revolut CSV to get started.</p>
          ) : (
            <div className="dm-upload-list">
              {uploads.map((u) => (
                <div key={u.id} className="dm-upload-card">
                  <div className="dm-upload-info">
                    <strong>{u.filename}</strong>
                    <span className="dm-upload-meta">
                      {u.rowCount} transactions · Uploaded{' '}
                      {new Date(u.uploadedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => deleteUpload(u.id)}
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
