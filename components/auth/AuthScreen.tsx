'use client';

import { useEffect, useRef, useState } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';
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
  checkInvite,
  acceptInvite,
  apiError,
} from '@/services/api';

type Mode = 'signin' | 'signup' | 'otp' | 'forgot' | 'reset' | 'invite';

const inputCls =
  'w-full bg-[var(--fill)] border border-[var(--line)] rounded-xl px-3.5 py-2.5 text-[15px] text-[var(--ink)] placeholder:text-[var(--ink-4)] outline-none focus:border-[var(--accent)]/60 transition-colors';

function Field({ label, ...props }: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-[var(--ink-3)] mb-1.5">{label}</span>
      <input {...props} className={inputCls} />
    </label>
  );
}

// ── Password strength: cheap heuristic, never blocks submit — it's a nudge, not
// a gate. Score 0–4 maps to a 4-segment bar + a colour + a word.
function scorePassword(pw: string): { score: number; label: string; color: string } {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  s = Math.min(s, 4);
  const labels = ['Too short', 'Weak', 'Fair', 'Good', 'Strong'];
  const colors = ['#ef4444', '#ef4444', '#f59e0b', '#eab308', '#22c55e'];
  return { score: s, label: labels[s], color: colors[s] };
}

function PasswordField({
  label,
  showStrength,
  ...props
}: { label: string; showStrength?: boolean } & InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false);
  const pw = typeof props.value === 'string' ? props.value : '';
  const st = showStrength && pw ? scorePassword(pw) : null;
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
      {st && (
        <div className="mt-2" aria-live="polite">
          <div className="flex gap-1.5">
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className="h-1 flex-1 rounded-full transition-colors duration-300"
                style={{ background: i < st.score ? st.color : 'var(--line-strong)' }}
              />
            ))}
          </div>
          <span className="mt-1 block text-[11px] font-medium" style={{ color: st.color }}>
            {st.label}
          </span>
        </div>
      )}
    </label>
  );
}

// ── Segmented OTP: six boxes with auto-advance, backspace-to-prev, arrow keys
// and full-code paste. `value` is the plain compact string the form already
// uses, so the rest of the flow is unchanged. Auto-submit on the 6th digit is
// handled by the parent's effect (which sees the committed value), not here.
function OtpInput({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const focus = (i: number) => {
    const el = refs.current[Math.max(0, Math.min(5, i))];
    el?.focus();
    el?.select();
  };
  const commit = (next: string) => {
    const v = next.replace(/\D/g, '').slice(0, 6);
    onChange(v);
    return v;
  };

  const onBox = (i: number, raw: string) => {
    const digits = raw.replace(/\D/g, '');
    if (!digits) return; // clears are handled in keydown
    commit(value.slice(0, i) + digits + value.slice(i + 1));
    focus(Math.min(i + digits.length, 5));
  };

  const onKey = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      if (value[i]) {
        commit(value.slice(0, i) + value.slice(i + 1));
        focus(i);
      } else if (i > 0) {
        commit(value.slice(0, i - 1) + value.slice(i));
        focus(i - 1);
      }
    } else if (e.key === 'ArrowLeft' && i > 0) {
      focus(i - 1);
    } else if (e.key === 'ArrowRight' && i < 5) {
      focus(i + 1);
    }
  };

  const onPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6);
    if (!text) return;
    const v = commit(text);
    focus(Math.min(v.length, 5));
  };

  return (
    <div className="flex justify-between gap-2 sm:gap-2.5" onPaste={onPaste}>
      {Array.from({ length: 6 }).map((_, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          value={value[i] ?? ''}
          onChange={(e) => onBox(i, e.target.value)}
          onKeyDown={(e) => onKey(i, e)}
          onFocus={(e) => e.target.select()}
          disabled={disabled}
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          aria-label={`Digit ${i + 1}`}
          autoFocus={i === 0}
          className={`w-full aspect-square min-w-0 text-center text-xl font-semibold rounded-xl bg-[var(--fill)] text-[var(--ink)] outline-none transition-all focus:bg-[var(--fill-hover)] focus:border-[var(--accent)]/70 focus:scale-[1.04] ${
            value[i] ? 'border border-[var(--accent)]/45' : 'border border-[var(--line)]'
          }`}
        />
      ))}
    </div>
  );
}

// ── Left brand panel value props (desktop only). ──
function FeatureIcon({ children }: { children: ReactNode }) {
  return (
    <span
      className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-[var(--accent-fg)]"
      style={{ background: 'color-mix(in srgb, var(--accent) 14%, transparent)' }}
    >
      {children}
    </span>
  );
}

const FEATURES: { icon: ReactNode; title: string; desc: string }[] = [
  {
    title: 'Chat with your documents',
    desc: 'Upload PDFs and ask anything in plain language.',
    icon: (
      <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6M9 13h6M9 17h4" />
      </svg>
    ),
  },
  {
    title: 'Grounded, cited answers',
    desc: 'Every response links back to its exact source.',
    icon: (
      <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </svg>
    ),
  },
  {
    title: 'Private by design',
    desc: 'Your sessions stay isolated and are never shared.',
    icon: (
      <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <rect x="3" y="11" width="18" height="11" rx="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    ),
  },
];

function BrandPanel() {
  return (
    <aside className="relative hidden lg:flex w-[46%] xl:w-[42%] flex-col justify-between overflow-hidden border-r border-[var(--line)] p-12 xl:p-16">
      {/* Ambient: cropped Aperture glyph + a soft, breathing accent orb. */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        <div className="brand-glyph" />
        <div
          className="absolute -bottom-24 -left-24 h-96 w-96 rounded-full blur-3xl animate-glow-pulse"
          style={{ background: 'radial-gradient(circle, color-mix(in srgb, var(--accent) 24%, transparent), transparent 70%)' }}
        />
        <div className="grain-overlay" />
      </div>

      {/* Wordmark */}
      <div className="relative flex items-center gap-3">
        <div style={{ filter: 'drop-shadow(0 8px 16px color-mix(in srgb, var(--accent) 28%, transparent))' }}>
          <Logo size={34} />
        </div>
        <span className="text-lg font-semibold tracking-tight text-[var(--ink)]">Close AI</span>
      </div>

      {/* Headline + value props */}
      <div className="relative max-w-md">
        <h2 className="font-display text-[2.4rem] xl:text-[2.8rem] leading-[1.08] tracking-tight text-[var(--ink)]">
          Your documents,
          <br />
          <span className="text-gradient">answered.</span>
        </h2>
        <p className="mt-4 text-[15px] leading-relaxed text-[var(--ink-3)]">
          Upload anything and ask away. Close AI reads, reasons, and cites — so every answer is grounded in your own sources.
        </p>

        <ul className="mt-10 space-y-6">
          {FEATURES.map((f) => (
            <li key={f.title} className="flex items-start gap-4">
              <FeatureIcon>{f.icon}</FeatureIcon>
              <div>
                <p className="text-sm font-semibold text-[var(--ink)]">{f.title}</p>
                <p className="mt-0.5 text-[13px] leading-relaxed text-[var(--ink-3)]">{f.desc}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Trust line */}
      <div className="relative flex items-center gap-2 text-xs text-[var(--ink-4)]">
        <span>Powered by</span>
        <span className="font-medium text-[var(--accent-fg)]">Fluxera</span>
        <span aria-hidden>·</span>
        <span>Enterprise-grade privacy</span>
      </div>
    </aside>
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
  const [inviteToken, setInviteToken] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');

  // If the page was opened from an invite link (/?invite=TOKEN), validate the
  // token and switch to the "accept invite" flow with the email pre-filled.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const tok = new URLSearchParams(window.location.search).get('invite');
    if (!tok) return;
    setInviteToken(tok);
    setMode('invite');
    checkInvite(tok)
      .then((r) => setInviteEmail(r.email))
      .catch((err) => {
        toast.error(apiError(err, 'This invite link is invalid or has expired.'));
        setMode('signin');
        try {
          window.history.replaceState({}, '', window.location.pathname);
        } catch {
          /* ignore */
        }
      });
  }, []);

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
      const r = await signup({ name: name.trim(), email: email.trim(), password, phone: phone.trim() });
      // Designated admin — server skipped OTP and returned a token: log in now.
      if (r.auto_login && r.access_token && r.user) {
        toast.success(`Welcome, ${r.user.name}!`);
        login(r.access_token, r.user);
        return;
      }
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

  const doAcceptInvite = wrap(async () => {
    try {
      const r = await acceptInvite({
        token: inviteToken,
        name: name.trim(),
        password,
        phone: phone.trim() || undefined,
      });
      toast.success(`Welcome, ${r.user.name}!`);
      try {
        window.history.replaceState({}, '', window.location.pathname);
      } catch {
        /* ignore */
      }
      login(r.access_token, r.user);
    } catch (err) {
      toast.error(apiError(err, 'Could not accept the invite.'));
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

  // Auto-submit the verify step the moment all six digits are present. Guarded
  // so it fires once per fill (not in a loop if the code is wrong), and runs in
  // an effect so `doVerify` reads the freshly-committed `code`.
  const otpFormRef = useRef<HTMLFormElement>(null);
  const autoFired = useRef(false);
  useEffect(() => {
    if (code.length < 6) autoFired.current = false;
    if (mode === 'otp' && code.length === 6 && !loading && !autoFired.current) {
      autoFired.current = true;
      otpFormRef.current?.requestSubmit();
    }
  }, [code, mode, loading]);

  const titles: Record<Mode, [string, string]> = {
    signin: ['Welcome back', 'Sign in to continue to Close AI'],
    signup: ['Create your account', 'Join Close AI in a few seconds'],
    otp: ['Verify your email', `We sent a 6-digit code to ${email}`],
    forgot: ['Reset your password', "Enter your email and we'll send a reset code"],
    reset: ['Set a new password', `Enter the code sent to ${email}, then your new password`],
    invite: [
      "You're invited",
      inviteEmail ? `Set up your Close AI account for ${inviteEmail}` : 'Set up your Close AI account',
    ],
  };

  const btn =
    'btn-shine w-full py-2.5 rounded-xl text-sm font-semibold text-white bg-[var(--accent)] hover:bg-[var(--accent-strong)] hover:shadow-[0_8px_28px_-10px_color-mix(in_srgb,var(--accent)_65%,transparent)] hover:-translate-y-px transition-all active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed';
  const linkCls = 'text-[var(--accent-fg)] font-medium hover:underline';

  return (
    <div className="relative flex min-h-screen w-full overflow-hidden text-[var(--ink)]">
      {/* ── Brand showcase (desktop) ── */}
      <BrandPanel />

      {/* ── Form column ── */}
      <main className="relative flex flex-1 items-center justify-center px-5 py-10 sm:px-8">
        {/* Mobile-only ambient (desktop ambient lives in the brand panel). */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden lg:hidden" aria-hidden>
          <div className="brand-glyph" />
          <div className="grain-overlay" />
        </div>

        {/* Card: entrance + cursor-follow 3D tilt + specular highlight. */}
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
                  <PasswordField label="Password" required showStrength value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" autoComplete="new-password" minLength={8} />
                  <button type="submit" disabled={loading} className={btn}>{loading ? 'Sending code…' : 'Create account'}</button>
                  <p className="text-center text-sm text-[var(--ink-3)]">
                    Already have an account? <button type="button" onClick={() => setMode('signin')} className={linkCls}>Sign in</button>
                  </p>
                </form>
              )}

              {mode === 'otp' && (
                <form ref={otpFormRef} onSubmit={doVerify} className="space-y-4 auth-stagger">
                  <div>
                    <span className="block text-xs font-medium text-[var(--ink-3)] mb-2">Verification code</span>
                    {/* Auto-submit is driven by the effect below (which reads the
                        freshly-committed code), not an onComplete here — an inline
                        callback would fire on the stale pre-render code. */}
                    <OtpInput value={code} onChange={setCode} disabled={loading} />
                  </div>
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
                  <div>
                    <span className="block text-xs font-medium text-[var(--ink-3)] mb-2">Reset code</span>
                    <OtpInput value={code} onChange={setCode} disabled={loading} />
                  </div>
                  <PasswordField label="New password" required showStrength value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="At least 8 characters" autoComplete="new-password" minLength={8} />
                  <button type="submit" disabled={loading || code.length < 6} className={btn}>{loading ? 'Resetting…' : 'Reset password'}</button>
                  <div className="flex items-center justify-between text-sm">
                    <button type="button" onClick={() => setMode('signin')} className="text-[var(--ink-3)] hover:text-[var(--ink)]">← Sign in</button>
                    <button type="button" onClick={() => resend('reset')} className={linkCls}>Resend code</button>
                  </div>
                </form>
              )}

              {mode === 'invite' && (
                <form onSubmit={doAcceptInvite} className="space-y-4 auth-stagger">
                  <label className="block">
                    <span className="block text-xs font-medium text-[var(--ink-3)] mb-1.5">Email</span>
                    <input value={inviteEmail} disabled placeholder="Validating invite…" className={`${inputCls} opacity-70 cursor-not-allowed`} />
                  </label>
                  <Field label="Full name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoComplete="name" autoFocus />
                  <Field label="Phone number" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="9876543210 (optional)" autoComplete="tel" />
                  <PasswordField label="Create a password" required showStrength value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" autoComplete="new-password" minLength={8} />
                  <button type="submit" disabled={loading || !inviteEmail} className={btn}>{loading ? 'Setting up…' : 'Accept invite & continue'}</button>
                  <p className="text-center text-sm text-[var(--ink-3)]">
                    Already have an account? <button type="button" onClick={() => setMode('signin')} className={linkCls}>Sign in</button>
                  </p>
                </form>
              )}

              <p className="mt-7 pt-5 border-t border-[var(--line)] text-center text-[11px] text-[var(--ink-4)]">
                Powered by <span className="text-[var(--accent-fg)] font-medium">Fluxera</span>
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
