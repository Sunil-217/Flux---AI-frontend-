'use client';

import { useEffect, useState } from 'react';
import { Toaster } from 'react-hot-toast';
import { useAuth } from '@/components/auth/AuthProvider';
import { AuthScreen } from '@/components/auth/AuthScreen';
import { Environment } from '@/components/fx/Environment';
import { AppLayout } from './AppLayout';
import { Logo } from './Logo';

/**
 * First paint while the stored session is being restored.
 *
 * A returning user with a cached identity never sees this — they get the
 * workspace immediately. It is reached on a first sign-in on this device, and
 * when the backend is genuinely slow to answer. In that second case a bare
 * logo is indistinguishable from a hung app, so after a few seconds it says
 * what is actually happening. The wording claims nothing about progress,
 * because there is no progress to report.
 */
function BootScreen() {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setSlow(true), 3500);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-5">
      <Logo size={48} />
      <p
        className="fx-label transition-opacity duration-500"
        style={{ opacity: slow ? 1 : 0 }}
        aria-live="polite"
      >
        {slow ? 'Waking the server' : ''}
      </p>
    </div>
  );
}

export function AppRoot() {
  const { user, ready } = useAuth();

  return (
    <>
      {/* The room every screen sits in. One fixed, contained layer — it is
          behind the app shell, so nothing below it reflows. */}
      <Environment />

      <Toaster
        position="top-right"
        gutter={8}
        containerStyle={{ top: 76 }}
        toastOptions={{
          duration: 4000,
          style: {
            background: 'var(--elevated)',
            color: 'var(--ink)',
            border: '1px solid var(--line)',
            fontSize: '13px',
            borderRadius: '14px',
            padding: '10px 14px',
            boxShadow: '0 12px 40px rgba(0,0,0,0.28)',
            backdropFilter: 'blur(12px)',
          },
          success: { iconTheme: { primary: '#7c6cff', secondary: 'var(--elevated)' } },
          error: { iconTheme: { primary: '#f87171', secondary: 'var(--elevated)' } },
        }}
      />

      {!ready ? (
        <BootScreen />
      ) : user ? (
        <AppLayout />
      ) : (
        <AuthScreen />
      )}
    </>
  );
}
