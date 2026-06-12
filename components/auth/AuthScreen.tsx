'use client';

import { useRef, useState } from 'react';
import type { InputHTMLAttributes } from 'react';
import toast from 'react-hot-toast';
import { Logo } from '@/components/layout/Logo';
import { useAuth } from './AuthProvider';
import {
  signin,
  signup,
  verifyOtp,
  resendOtp,
  forgotPassword,
  resetPassword,
  apiError,
} from '@/services/api';

type Mode = 'signin' | 'signup' | 'otp' | 'forgot' | 'reset';

const inputCls =
  'w-full bg-[var(--fill)] border border-[var(--line)] rounded-xl px-3.5 py-2.5 text-[15px] text-[var(--ink)] placeholder:text-[var(--ink-4)] outline-none focus:border-red-400/60 transition-colors';

function Field({ label, ...props }: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-[var(--ink-3)] mb-1.5">{label}</span>
      <input {...props} className={inputCls} />
    </label>
  );
}

function PasswordField({
  label,
  ...props
}: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false);
  return (
    <label className="block">
      <span className="block text-xs font-medium text-[var(--ink-3)] mb-1.5">{label}</span>
      <div className="relative">
        <input {...props} type={show ? 'text' : 'password'} className={`${inputCls} pr-11`} />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setShow((s) => !s)}
          aria-label={show ? 'Hide password' : 'Show password'}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[var(--ink-4)] hover:text-[var(--ink-2)] transition-colors"
        >
          {show ? (
            // currently visible → click to hide
            <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
              <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
              <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
              <line x1="2" x2="22" y1="2" y2="22" />
            </svg>
          ) : (
            // hidden → click to show
            <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      </div>
    </label>
  );
}

export function AuthScreen() {
  const { login } = useAuth();
  const [mode, setMode] = useState<Mode>('signin');
  const [loading, setLoading] = useState(false);

  // ── 3D tilt: the card subtly follows the cursor (GPU transform only, rAF-
  // throttled). Max ±4° keeps it premium rather than gimmicky; resets on leave.
  const cardRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const onTilt = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = cardRef.current;
    if (!card || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const { clientX, clientY } = e;
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const r = card.getBoundingClientRect();
      const px = (clientX - r.left) / r.width; // 0..1
      const py = (clientY - r.top) / r.height;
      card.style.setProperty('--rx', `${((0.5 - py) * 8).toFixed(2)}deg`);
      card.style.setProperty('--ry', `${((px - 0.5) * 8).toFixed(2)}deg`);
      card.style.setProperty('--mx', `${(px * 100).toFixed(1)}%`);
      card.style.setProperty('--my', `${(py * 100).toFixed(1)}%`);
    });
  };
  const resetTilt = () => {
    const card = cardRef.current;
    if (!card) return;
    cancelAnimationFrame(rafRef.current);
    card.style.setProperty('--rx', '0deg');
    card.style.setProperty('--ry', '0deg');
  };

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const wrap = (fn: () => Promise<void>) => async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await fn();
    } finally {
      setLoading(false);
    }
  };

  const doSignin = wrap(async () => {
    try {
      const r = await signin(email.trim(), password);
      toast.success(`Welcome back, ${r.user.name}!`);
      login(r.access_token, r.user);
    } catch (err) {
      toast.error(apiError(err, 'Sign in failed.'));
    }
  });

  const doSignup = wrap(async () => {
    try {
      await signup({ name: name.trim(), email: email.trim(), password, phone: phone.trim() });
      toast.success('Verification code sent to your email.');
      setCode('');
      setMode('otp');
    } catch (err) {
      toast.error(apiError(err, 'Sign up failed.'));
    }
  });

  const doVerify = wrap(async () => {
    try {
      const r = await verifyOtp(email.trim(), code.trim());
      toast.success(`Welcome, ${r.user.name}!`);
      login(r.access_token, r.user);
    } catch (err) {
      toast.error(apiError(err, 'Verification failed.'));
    }
  });

  const doForgot = wrap(async () => {
    try {
      await forgotPassword(email.trim());
      toast.success('If the account exists, a reset code was sent.');
      setCode('');
      setNewPassword('');
      setMode('reset');
    } catch (err) {
      toast.error(apiError(err));
    }
  });

  const doReset = wrap(async () => {
    try {
      const r = await resetPassword(email.trim(), code.trim(), newPassword);
      toast.success('Password reset! You are now signed in.');
      login(r.access_token, r.user);
    } catch (err) {
      toast.error(apiError(err, 'Reset failed.'));
    }
  });

  const resend = async (which: 'otp' | 'reset') => {
    try {
      if (which === 'otp') await resendOtp(email.trim());
      else await forgotPassword(email.trim());
      toast.success('A new code was sent.');
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  const titles: Record<Mode, [string, string]> = {
    signin: ['Welcome back', 'Sign in to continue to Close AI'],
    signup: ['Create your account', 'Join Close AI in a few seconds'],
    otp: ['Verify your email', `We sent a 6-digit code to ${email}`],
    forgot: ['Reset your password', "Enter your email and we'll send a reset code"],
    reset: ['Set a new password', `Enter the code sent to ${email}, then your new password`],
  };

  const btn =
    'btn-shine w-full py-2.5 rounded-xl text-sm font-semibold text-white bg-[var(--accent)] hover:bg-[var(--accent-strong)] hover:shadow-[0_8px_28px_-10px_color-mix(in_srgb,var(--accent)_65%,transparent)] hover:-translate-y-px transition-all active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed';
  const linkCls = 'text-[var(--accent-fg)] font-medium hover:underline';
  const codeInput = (
    <Field
      label="6-digit code"
      required
      value={code}
      onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
      placeholder="6-digit code"
      inputMode="numeric"
      autoFocus
    />
  );

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center px-4 text-[var(--ink)] overflow-hidden">
      {/* ── Brand layer: the Aperture glyph as environment ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
        <div className="brand-glyph" />
        <div className="grain-overlay" />
      </div>

      {/* ── Card: entrance + cursor-follow 3D tilt + rotating border beam ── */}
      <div
        ref={cardRef}
        onMouseMove={onTilt}
        onMouseLeave={resetTilt}
        className="relative w-full max-w-md animate-card-in"
        style={{
          transform: 'perspective(1200px) rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg))',
          transition: 'transform 0.18s ease-out',
          transformStyle: 'preserve-3d',
        }}
      >
        <div
          className="relative w-full bg-[var(--panel)] backdrop-blur-xl border border-[var(--line)] rounded-2xl p-8"
          style={{
            boxShadow:
              '0 28px 80px -28px rgba(0,0,0,0.6), 0 10px 32px -14px color-mix(in srgb, var(--accent) 24%, transparent), inset 0 1px 0 rgba(255,255,255,0.05)',
          }}
        >
          {/* Specular highlight that follows the cursor */}
          <div
            className="absolute inset-0 rounded-2xl pointer-events-none"
            aria-hidden
            style={{ background: 'radial-gradient(420px circle at var(--mx, 50%) var(--my, 28%), rgba(255,255,255,0.075), transparent 46%)' }}
          />
          <div className="relative">
        <div className="flex flex-col items-center mb-7">
          <div style={{ filter: 'drop-shadow(0 14px 22px color-mix(in srgb, var(--accent) 30%, transparent))' }}>
            <Logo size={52} />
          </div>
          <h1 className="mt-4 text-xl font-semibold tracking-tight">{titles[mode][0]}</h1>
          <p className="text-sm text-[var(--ink-3)] mt-1 text-center">{titles[mode][1]}</p>
        </div>

        {mode === 'signin' && (
          <form onSubmit={doSignin} className="space-y-4 auth-stagger">
            <Field label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
            <PasswordField label="Password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
            <div className="text-right -mt-1">
              <button type="button" onClick={() => setMode('forgot')} className="text-xs text-[var(--ink-3)] hover:text-[var(--accent-fg)]">
                Forgot password?
              </button>
            </div>
            <button type="submit" disabled={loading} className={btn}>{loading ? 'Signing in…' : 'Sign in'}</button>
            <p className="text-center text-sm text-[var(--ink-3)]">
              Don&apos;t have an account? <button type="button" onClick={() => setMode('signup')} className={linkCls}>Sign up</button>
            </p>
          </form>
        )}

        {mode === 'signup' && (
          <form onSubmit={doSignup} className="space-y-4 auth-stagger">
            <Field label="Full name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoComplete="name" />
            <Field label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
            <Field label="Phone number" type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="9876543210" autoComplete="tel" />
            <PasswordField label="Password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" autoComplete="new-password" minLength={8} />
            <button type="submit" disabled={loading} className={btn}>{loading ? 'Sending code…' : 'Create account'}</button>
            <p className="text-center text-sm text-[var(--ink-3)]">
              Already have an account? <button type="button" onClick={() => setMode('signin')} className={linkCls}>Sign in</button>
            </p>
          </form>
        )}

        {mode === 'otp' && (
          <form onSubmit={doVerify} className="space-y-4 auth-stagger">
            {codeInput}
            <button type="submit" disabled={loading || code.length < 6} className={btn}>{loading ? 'Verifying…' : 'Verify & continue'}</button>
            <div className="flex items-center justify-between text-sm">
              <button type="button" onClick={() => setMode('signup')} className="text-[var(--ink-3)] hover:text-[var(--ink)]">← Back</button>
              <button type="button" onClick={() => resend('otp')} className={linkCls}>Resend code</button>
            </div>
          </form>
        )}

        {mode === 'forgot' && (
          <form onSubmit={doForgot} className="space-y-4 auth-stagger">
            <Field label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" autoFocus />
            <button type="submit" disabled={loading} className={btn}>{loading ? 'Sending…' : 'Send reset code'}</button>
            <p className="text-center text-sm">
              <button type="button" onClick={() => setMode('signin')} className="text-[var(--ink-3)] hover:text-[var(--ink)]">← Back to sign in</button>
            </p>
          </form>
        )}

        {mode === 'reset' && (
          <form onSubmit={doReset} className="space-y-4 auth-stagger">
            {codeInput}
            <PasswordField label="New password" required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="At least 8 characters" autoComplete="new-password" minLength={8} />
            <button type="submit" disabled={loading || code.length < 6} className={btn}>{loading ? 'Resetting…' : 'Reset password'}</button>
            <div className="flex items-center justify-between text-sm">
              <button type="button" onClick={() => setMode('signin')} className="text-[var(--ink-3)] hover:text-[var(--ink)]">← Sign in</button>
              <button type="button" onClick={() => resend('reset')} className={linkCls}>Resend code</button>
            </div>
          </form>
        )}

        <p className="mt-7 pt-5 border-t border-[var(--line)] text-center text-[11px] text-[var(--ink-4)]">
          Powered by <span className="text-[var(--accent-fg)] font-medium">Fluxera</span>
        </p>
          </div>
        </div>
      </div>
    </div>
  );
}
