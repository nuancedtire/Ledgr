import { useState, useRef, type DragEvent } from 'react';

interface Props {
  onClose: () => void;
  onComplete: () => void;
}

export default function UploadModal({ onClose, onComplete }: Props) {
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ uploaded: number; newTransactions: number; duplicatesSkipped: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (!file.name.endsWith('.csv')) {
      setError('Please upload a .csv file');
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const text = await file.text();
      const resp = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'text/csv' },
        credentials: 'include',
        body: text,
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Upload failed');
      setResult(data);
      setTimeout(onComplete, 1500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  return (
    <div
      className="fixed inset-0 z-[1000] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-bg-card border border-border-default rounded-2xl w-full max-w-lg animate-fade-in-up">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle">
          <h3 className="font-serif italic text-xl">Upload Statement</h3>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary text-2xl leading-none">
            &times;
          </button>
        </div>
        <div className="p-6">
          {result ? (
            <div className="text-center py-6">
              <div className="text-3xl mb-3">✅</div>
              <p className="text-text-primary font-medium">
                Uploaded {result.uploaded} transactions
              </p>
              <p className="text-text-muted text-sm mt-1">
                {result.newTransactions} new · {result.duplicatesSkipped} duplicates skipped
              </p>
            </div>
          ) : (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => fileRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
                dragOver
                  ? 'border-accent-emerald bg-accent-emerald/5'
                  : 'border-border-default hover:border-accent-emerald/50'
              }`}
            >
              {uploading ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="flex gap-2">
                    <span className="w-2 h-2 rounded-full bg-accent-emerald animate-pulse" />
                    <span className="w-2 h-2 rounded-full bg-accent-emerald animate-pulse [animation-delay:150ms]" />
                    <span className="w-2 h-2 rounded-full bg-accent-emerald animate-pulse [animation-delay:300ms]" />
                  </div>
                  <p className="text-text-secondary text-sm">Processing…</p>
                </div>
              ) : (
                <>
                  <svg className="mx-auto mb-4" width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.4">
                    <path d="M24 32V8m0 0l-8 8m8-8 8 8" />
                    <path d="M8 28v8a4 4 0 004 4h24a4 4 0 004-4v-8" />
                  </svg>
                  <p className="text-text-secondary">Drop your Revolut CSV here</p>
                  <p className="text-text-muted text-sm mt-2">
                    or <span className="text-accent-emerald underline">browse</span>
                  </p>
                </>
              )}
              <input
                ref={fileRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
            </div>
          )}
          {error && (
            <p className="text-accent-rose text-sm mt-3 text-center">❌ {error}</p>
          )}
        </div>
      </div>
    </div>
  );
}
