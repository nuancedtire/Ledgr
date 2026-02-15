import { useState, useCallback, useRef } from 'react';

interface UploadResult {
  success: boolean;
  uploadId?: string;
  rowCount?: number;
  filename?: string;
  error?: string;
}

export default function CsvUpload({ onComplete }: { onComplete?: () => void }) {
  const [state, setState] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [progress, setProgress] = useState('');
  const [result, setResult] = useState<UploadResult | null>(null);
  const [overwrite, setOverwrite] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const upload = useCallback(
    async (file: File) => {
      if (!file.name.endsWith('.csv')) {
        setResult({ success: false, error: 'Please select a CSV file' });
        setState('error');
        return;
      }

      setState('uploading');
      setProgress('Reading file…');

      try {
        const formData = new FormData();
        formData.append('file', file);
        if (overwrite) formData.append('overwrite', 'true');

        setProgress('Uploading and processing…');

        const resp = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        const data = (await resp.json()) as UploadResult;

        if (!resp.ok || !data.success) {
          throw new Error(data.error || `Upload failed (${resp.status})`);
        }

        setResult(data);
        setState('success');
        setProgress('');
        onComplete?.();
      } catch (err) {
        setResult({
          success: false,
          error: err instanceof Error ? err.message : 'Upload failed',
        });
        setState('error');
        setProgress('');
      }
    },
    [overwrite, onComplete],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) upload(file);
    },
    [upload],
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) upload(file);
    },
    [upload],
  );

  const reset = () => {
    setState('idle');
    setResult(null);
    setProgress('');
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="upload-island">
      {state === 'idle' && (
        <>
          <div
            className={`dropzone ${dragOver ? 'dragover' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
          >
            <svg
              width="48"
              height="48"
              viewBox="0 0 48 48"
              fill="none"
              stroke="var(--text-muted)"
              strokeWidth="1.5"
            >
              <path d="M24 32V8m0 0l-8 8m8-8 8 8" />
              <path d="M8 28v8a4 4 0 004 4h24a4 4 0 004-4v-8" />
            </svg>
            <p className="dropzone-text">Drop your Revolut CSV here</p>
            <p className="dropzone-sub">or click to browse</p>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              hidden
            />
          </div>
          <label className="overwrite-toggle">
            <input
              type="checkbox"
              checked={overwrite}
              onChange={(e) => setOverwrite(e.target.checked)}
            />
            <span>Replace existing data (overwrite)</span>
          </label>
        </>
      )}

      {state === 'uploading' && (
        <div className="upload-status">
          <div className="spinner" />
          <p>{progress}</p>
        </div>
      )}

      {state === 'success' && result && (
        <div className="upload-status success">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="var(--accent-emerald)" strokeWidth="2">
            <circle cx="24" cy="24" r="20" />
            <path d="M16 24l6 6 10-12" />
          </svg>
          <p className="status-title">Upload complete!</p>
          <p className="status-detail">
            {result.rowCount} transactions from <strong>{result.filename}</strong> have been
            encrypted and stored.
          </p>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>
            Refresh Dashboard
          </button>
          <button className="btn btn-secondary" onClick={reset}>
            Upload Another
          </button>
        </div>
      )}

      {state === 'error' && result && (
        <div className="upload-status error">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="var(--accent-rose)" strokeWidth="2">
            <circle cx="24" cy="24" r="20" />
            <path d="M18 18l12 12M30 18L18 30" />
          </svg>
          <p className="status-title">Upload failed</p>
          <p className="status-detail">{result.error}</p>
          <button className="btn btn-secondary" onClick={reset}>
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}
