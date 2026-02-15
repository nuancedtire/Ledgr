import { useState } from 'react';
import CSVUpload from './CSVUpload';

export default function UploadModal() {
  const [open, setOpen] = useState(false);

  const handleComplete = () => {
    // Refresh the page to reload dashboard data after upload
    setTimeout(() => {
      window.location.reload();
    }, 1500);
  };

  return (
    <>
      <button className="btn btn-upload" onClick={() => setOpen(true)} aria-label="Upload CSV">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M8 10V2m0 0L5 5m3-3 3 3M2 10v2a2 2 0 002 2h8a2 2 0 002-2v-2" />
        </svg>
        Upload CSV
      </button>

      {open && (
        <div className="modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="modal">
            <div className="modal-header">
              <h3>Upload Statement</h3>
              <button className="modal-close" onClick={() => setOpen(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <CSVUpload onComplete={handleComplete} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
