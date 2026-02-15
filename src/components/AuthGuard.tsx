import { useSession, signIn } from '../lib/auth-client';
import type { ReactNode } from 'react';

export default function AuthGuard({ children }: { children: ReactNode }) {
  const { data: session, isPending } = useSession();

  if (isPending) {
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

  if (!session?.user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="bg-bg-card border border-border-subtle rounded-2xl p-10 max-w-md w-full text-center">
          <h1 className="font-serif italic text-5xl mb-2 bg-gradient-to-r from-text-primary via-accent-emerald to-accent-sky bg-clip-text text-transparent">
            Ledgr
          </h1>
          <p className="text-text-muted text-sm mb-8">
            Personal financial dashboard with AI-powered insights
          </p>
          <button
            onClick={() => signIn.social({ provider: 'microsoft', callbackURL: '/' })}
            className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-[#2F2F2F] hover:bg-[#3a3a3a] text-white rounded-xl font-medium transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 21 21" fill="none">
              <rect x="1" y="1" width="9" height="9" fill="#F25022" />
              <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
              <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
              <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
            </svg>
            Sign in with Microsoft
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
