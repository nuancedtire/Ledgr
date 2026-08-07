import { useState, useCallback, useRef } from 'react';

interface UploadResult {
  success: boolean;
  totalRows: number;
  newRows: number;
  duplicateRows: number;
  uploadId: string;
  error?: string;
}

type UploadState = 'idle' | 'reading' | 'uploading' | 'success' | 'error';

export default function CSVUpload({ onComplete }: { onComplete?: () => void }) {
  const [state, setState] = useState<UploadState>('idle');
  const [dragOver, setDragOver] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.endsWith('.csv')) {
      setError('Please upload a CSV file');
      setState('error');
      return;
    }

    setState('reading');
    setError(null);

    try {
      const csvText = await file.text();
      const lines = csvText.trim().split('\n');

      setState('uploading');

      const resp = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'text/csv' },
        body: csvText,
      });

      const data = await resp.json() as UploadResult & { error?: string };

      if (!resp.ok) {
        throw new Error(data.error || `Upload failed: ${resp.status}`);
      }

      setResult(data);
      setState('success');
      onComplete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      setState('error');
    }
  }, [onComplete]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const reset = useCallback(() => {
    setState('idle');
    setResult(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  if (state === 'success' && result) {
    return (
      <div className="upload-result">
        <div className="upload-result-icon">✅</div>
        <h4>Upload Complete</h4>
        <div className="upload-stats">
          <div className="upload-stat">
            <span className="upload-stat-value">{result.totalRows}</span>
            <span className="upload-stat-label">Total rows</span>
          </div>
          <div className="upload-stat">
            <span className="upload-stat-value">{result.newRows}</span>
            <span className="upload-stat-label">New transactions</span>
          </div>
          <div className="upload-stat">
            <span className="upload-stat-value">{result.duplicateRows}</span>
            <span className="upload-stat-label">Duplicates skipped</span>
          </div>
        </div>
        <button className="btn btn-primary" onClick={reset}>Upload Another</button>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="upload-result">
        <div className="upload-result-icon">❌</div>
        <h4>Upload Failed</h4>
        <p className="upload-error-msg">{error}</p>
        <button className="btn btn-primary" onClick={reset}>Try Again</button>
      </div>
    );
  }

  if (state === 'reading' || state === 'uploading') {
    return (
      <div className="upload-progress-container">
        <div className="upload-spinner" />
        <p>{state === 'reading' ? 'Reading file…' : 'Uploading & processing…'}</p>
        <p className="upload-progress-sub">This may take a moment for large files</p>
      </div>
    );
  }

  return (
    <div
      className={`dropzone ${dragOver ? 'dragover' : ''}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={() => fileInputRef.current?.click()}
    >
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="var(--text-muted)" strokeWidth="1.5">
        <path d="M24 32V8m0 0l-8 8m8-8 8 8" />
        <path d="M8 28v8a4 4 0 004 4h24a4 4 0 004-4v-8" />
      </svg>
      <p className="dropzone-text">Drop your Revolut CSV here</p>
      <p className="dropzone-sub">
        or <span className="dropzone-browse">browse</span>
      </p>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        onChange={handleFileInput}
        hidden
      />
    </div>
  );
}
