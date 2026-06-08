'use client';

import { Toaster } from 'react-hot-toast';
import { useAuth } from '@/components/auth/AuthProvider';
import { AuthScreen } from '@/components/auth/AuthScreen';
import { AppLayout } from './AppLayout';
import { Logo } from './Logo';

export function AppRoot() {
  const { user, ready } = useAuth();

  return (
    <>
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
        <div className="min-h-screen flex items-center justify-center">
          <Logo size={48} />
        </div>
      ) : user ? (
        <AppLayout />
      ) : (
        <AuthScreen />
      )}
    </>
  );
}
