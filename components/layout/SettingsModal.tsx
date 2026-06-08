'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import { useAuth } from '@/components/auth/AuthProvider';
import { updateProfile, changePassword, apiError, STYLE_KEY, CUSTOM_INSTRUCTIONS_KEY } from '@/services/api';
import { useT, getLang, setLang, type Lang } from '@/lib/i18n';
import { ConfirmModal } from '@/components/layout/Dialogs';
import { Logo } from '@/components/layout/Logo';
import {
  ACCENTS,
  applyAccent,
  ACCENT_KEY,
  applyTextSize,
  TEXT_SIZE_KEY,
  VOICE_KEY,
  FONT_KEY,
  FONT_OPTIONS,
  applyFont,
  CODE_FONT_KEY,
  CODE_FONT_OPTIONS,
  applyCodeFont,
} from '@/components/layout/AccentPicker';

type Tab = 'account' | 'appearance' | 'chat' | 'data' | 'security' | 'about';

const APP_VERSION = '1.0.0';
const NOTIF_KEY = 'close_ai_notify_on_done';
const DENSITY_KEY = 'close_ai_density';

function applyDensity(d: string) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.remove('density-compact', 'density-comfortable', 'density-spacious');
  const next = d === 'compact' || d === 'spacious' ? d : 'comfortable';
  root.classList.add(`density-${next}`);
}

const inputCls =
  'w-full max-w-sm bg-[var(--fill)] border border-[var(--line)] rounded-lg px-3.5 py-2.5 text-sm text-[var(--ink)] placeholder:text-[var(--ink-4)] outline-none focus:border-[var(--accent)] transition-colors';
const btnCls =
  'text-sm font-medium rounded-lg bg-[var(--accent)] text-white px-5 py-2 hover:bg-[var(--accent-strong)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors';
const headingCls = 'text-base font-semibold text-[var(--ink)]';
const subCls = 'text-xs text-[var(--ink-3)] mt-0.5';
const fieldLabel = 'block text-xs font-medium text-[var(--ink-3)] mb-1.5';

function setHtmlTheme(theme: 'light' | 'dark') {
  const root = document.documentElement;
  root.classList.remove('light', 'dark');
  root.classList.add(theme);
  try {
    localStorage.setItem('theme', theme);
  } catch {
    /* ignore */
  }
}

// Static row (label + description on the left, control on the right). Module-level
// so it never remounts — important so inputs elsewhere keep focus.
function Row({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6 py-4 border-b border-[var(--line)] last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-[var(--ink)]">{title}</p>
        {desc && <p className="text-xs text-[var(--ink-3)] mt-0.5">{desc}</p>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

const navIcon = (key: Tab) => {
  const cls = 'w-4 h-4';
  if (key === 'account')
    return (
      <svg className={cls} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
    );
  if (key === 'appearance')
    return (
      <svg className={cls} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="13.5" cy="6.5" r="1.5" /><circle cx="17.5" cy="10.5" r="1.5" /><circle cx="8.5" cy="7.5" r="1.5" /><circle cx="6.5" cy="12.5" r="1.5" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 2a10 10 0 100 20c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01a1.5 1.5 0 011.13-2.49H16a6 6 0 006-6c0-5.52-4.48-9-10-9z" /></svg>
    );
  if (key === 'chat')
    return (
      <svg className={cls} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 10h8M8 14h5m-9 6l3.5-2H18a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12z" /></svg>
    );
  if (key === 'data')
    return (
      <svg className={cls} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><ellipse cx="12" cy="5" rx="9" ry="3" /><path strokeLinecap="round" d="M3 5v6c0 1.66 4.03 3 9 3s9-1.34 9-3V5M3 11v6c0 1.66 4.03 3 9 3s9-1.34 9-3v-6" /></svg>
    );
  if (key === 'about')
    return (
      <svg className={cls} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 8h.01M11 12h1v4h1" /></svg>
    );
  return (
    <svg className={cls} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2" /><path strokeLinecap="round" strokeLinejoin="round" d="M8 11V7a4 4 0 118 0v4" /></svg>
  );
};

export function SettingsModal({
  onClose,
  onClearChats,
}: {
  onClose: () => void;
  onClearChats: () => void;
}) {
  const { user, updateUser } = useAuth();
  const [tab, setTab] = useState<Tab>('account');
  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [savingPw, setSavingPw] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(
    typeof document !== 'undefined' && document.documentElement.classList.contains('light')
      ? 'light'
      : 'dark'
  );
  const [accent, setAccent] = useState(
    (typeof window !== 'undefined' && localStorage.getItem(ACCENT_KEY)) || 'red'
  );
  const [textSize, setTextSize] = useState(
    (typeof window !== 'undefined' && localStorage.getItem(TEXT_SIZE_KEY)) || 'medium'
  );
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voice, setVoice] = useState(
    (typeof window !== 'undefined' && localStorage.getItem(VOICE_KEY)) || ''
  );
  const [font, setFont] = useState(
    (typeof window !== 'undefined' && localStorage.getItem(FONT_KEY)) || 'default'
  );
  const [codeFont, setCodeFont] = useState(
    (typeof window !== 'undefined' && localStorage.getItem(CODE_FONT_KEY)) || 'default'
  );
  const [style, setStyle] = useState(
    (typeof window !== 'undefined' && localStorage.getItem(STYLE_KEY)) || 'default'
  );
  const [customInstr, setCustomInstr] = useState(
    (typeof window !== 'undefined' && localStorage.getItem(CUSTOM_INSTRUCTIONS_KEY)) || ''
  );
  const [instrSaved, setInstrSaved] = useState(false);
  const [density, setDensity] = useState(
    (typeof window !== 'undefined' && localStorage.getItem(DENSITY_KEY)) || 'comfortable'
  );
  const [notify, setNotify] = useState(
    typeof window !== 'undefined' && localStorage.getItem(NOTIF_KEY) === 'on'
  );
  const t = useT();
  const [lang, setLangState] = useState<Lang>('en');
  useEffect(() => setLangState(getLang()), []);
  const pickLang = (l: Lang) => {
    setLang(l);
    setLangState(l);
  };

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.onvoiceschanged = load;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  const profileChanged = name.trim() !== (user?.name ?? '') || phone.trim() !== (user?.phone ?? '');

  const saveProfile = () => {
    if (!name.trim() || !profileChanged) return;
    setSavingProfile(true);
    updateProfile(name.trim(), phone.trim())
      .then((u) => {
        updateUser(u);
        toast.success('Profile updated');
      })
      .catch((e) => toast.error(apiError(e, 'Could not update profile.')))
      .finally(() => setSavingProfile(false));
  };

  const savePw = () => {
    if (!cur || next.length < 8) {
      toast.error('New password must be at least 8 characters.');
      return;
    }
    setSavingPw(true);
    changePassword(cur, next)
      .then(() => {
        toast.success('Password updated');
        setCur('');
        setNext('');
      })
      .catch((e) => toast.error(apiError(e, 'Could not change password.')))
      .finally(() => setSavingPw(false));
  };

  const pickAccent = (a: string) => {
    applyAccent(a);
    setAccent(a);
    try {
      localStorage.setItem(ACCENT_KEY, a);
    } catch {
      /* ignore */
    }
  };
  const pickTextSize = (s: string) => {
    applyTextSize(s);
    setTextSize(s);
    try {
      localStorage.setItem(TEXT_SIZE_KEY, s);
    } catch {
      /* ignore */
    }
  };
  const pickVoice = (name: string) => {
    setVoice(name);
    try {
      localStorage.setItem(VOICE_KEY, name);
    } catch {
      /* ignore */
    }
  };
  const testVoice = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const u = new SpeechSynthesisUtterance('Hello! This is a preview of the selected voice.');
    const v = window.speechSynthesis.getVoices().find((x) => x.name === voice);
    if (v) u.voice = v;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  };
  const pickFont = (f: string) => {
    applyFont(f);
    setFont(f);
    try {
      localStorage.setItem(FONT_KEY, f);
    } catch {
      /* ignore */
    }
  };
  const pickCodeFont = (f: string) => {
    applyCodeFont(f);
    setCodeFont(f);
    try {
      localStorage.setItem(CODE_FONT_KEY, f);
    } catch {
      /* ignore */
    }
  };
  const pickDensity = (d: string) => {
    applyDensity(d);
    setDensity(d);
    try {
      localStorage.setItem(DENSITY_KEY, d);
    } catch {
      /* ignore */
    }
  };
  const toggleNotify = async () => {
    if (notify) {
      setNotify(false);
      try {
        localStorage.setItem(NOTIF_KEY, 'off');
      } catch {
        /* ignore */
      }
      return;
    }
    if (typeof Notification === 'undefined') {
      toast.error("This browser doesn't support notifications.");
      return;
    }
    let perm = Notification.permission;
    if (perm === 'default') {
      try {
        perm = await Notification.requestPermission();
      } catch {
        perm = 'denied';
      }
    }
    if (perm !== 'granted') {
      toast.error('Notification permission denied.');
      return;
    }
    setNotify(true);
    try {
      localStorage.setItem(NOTIF_KEY, 'on');
    } catch {
      /* ignore */
    }
    toast.success('Notifications enabled.');
  };

  const exportAllChats = async () => {
    try {
      // Pull the user's current chat blob via the GET /chats endpoint.
      const { getChats } = await import('@/services/api');
      const sessions = await getChats();
      const blob = new Blob([JSON.stringify(sessions, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `close-ai-chats-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${sessions.length} chat${sessions.length === 1 ? '' : 's'}`);
    } catch {
      toast.error('Could not export your chats.');
    }
  };
  const pickStyle = (s: string) => {
    setStyle(s);
    try {
      localStorage.setItem(STYLE_KEY, s);
    } catch {
      /* ignore */
    }
  };
  const saveCustomInstr = () => {
    try {
      localStorage.setItem(CUSTOM_INSTRUCTIONS_KEY, customInstr.trim());
      setInstrSaved(true);
      setTimeout(() => setInstrSaved(false), 1800);
    } catch {
      /* ignore */
    }
  };
  const [confirmClear, setConfirmClear] = useState(false);
  const doClear = () => {
    onClearChats();
    toast.success('All conversations cleared');
    onClose();
  };

  if (typeof document === 'undefined') return null;

  const nav: { key: Tab; label: string }[] = [
    { key: 'account', label: 'Account' },
    { key: 'appearance', label: 'Appearance' },
    { key: 'chat', label: 'Chat' },
    { key: 'data', label: 'Data' },
    { key: 'security', label: 'Security' },
    { key: 'about', label: 'About' },
  ];

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-4xl h-[640px] max-h-[92vh] flex flex-col rounded-2xl bg-[var(--elevated)] border border-[var(--line-strong)] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--line)]">
          <h2 className="text-xl font-display font-medium text-[var(--ink)] tracking-tight">Settings</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--fill)] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Left nav */}
          <nav className="w-56 flex-shrink-0 border-r border-[var(--line)] bg-[var(--base)]/40 p-4 space-y-1.5 overflow-y-auto">
            {nav.map((n) => (
              <button
                key={n.key}
                onClick={() => setTab(n.key)}
                className={`flex items-center gap-3 w-full text-left px-3.5 py-2.5 rounded-xl text-sm transition-colors ${
                  tab === n.key
                    ? 'bg-[var(--fill-strong)] text-[var(--ink)] font-medium'
                    : 'text-[var(--ink-3)] hover:bg-[var(--fill)] hover:text-[var(--ink-2)]'
                }`}
              >
                {navIcon(n.key)}
                {t(n.label)}
              </button>
            ))}
          </nav>

          {/* Right content */}
          <div className="flex-1 min-w-0 overflow-y-auto px-8 py-7">
            {tab === 'account' && (
              <>
                <div className="mb-5">
                  <h3 className={headingCls}>Account</h3>
                  <p className={subCls}>Manage your profile details.</p>
                </div>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[var(--accent)] to-[var(--accent-strong)] flex items-center justify-center text-white text-lg font-semibold flex-shrink-0">
                    {user?.name?.[0]?.toUpperCase() ?? 'U'}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--ink)] truncate">{user?.name}</p>
                    <p className="text-xs text-[var(--ink-4)] truncate">{user?.email}</p>
                  </div>
                </div>
                <label className={fieldLabel}>Display name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} className={`${inputCls} mb-4`} />
                <label className={fieldLabel}>Phone number</label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Add a phone number"
                  className={`${inputCls} mb-5`}
                />
                <div className="flex justify-end max-w-sm">
                  <button onClick={saveProfile} disabled={savingProfile || !name.trim() || !profileChanged} className={btnCls}>
                    {savingProfile ? 'Saving…' : 'Save changes'}
                  </button>
                </div>
                <div className="mt-8 pt-5 border-t border-[var(--line)]">
                  <button
                    onClick={() => setConfirmClear(true)}
                    className="text-sm font-medium text-red-400 hover:text-red-300 transition-colors"
                  >
                    Clear all conversations
                  </button>
                  <p className="text-xs text-[var(--ink-4)] mt-1">
                    Permanently removes every chat. This can&apos;t be undone.
                  </p>
                </div>
              </>
            )}

            {tab === 'appearance' && (
              <>
                <div className="mb-3">
                  <h3 className={headingCls}>Appearance</h3>
                  <p className={subCls}>Customize how the app looks and feels.</p>
                </div>
                <Row title="Theme" desc="Use a light or dark interface.">
                  <div className="inline-flex rounded-lg border border-[var(--line)] bg-[var(--base)] p-0.5">
                    {(['light', 'dark'] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => {
                          setHtmlTheme(t);
                          setTheme(t);
                        }}
                        className={`px-3.5 py-1.5 rounded-md text-sm capitalize transition-colors ${
                          theme === t ? 'bg-[var(--fill-strong)] text-[var(--ink)]' : 'text-[var(--ink-3)] hover:text-[var(--ink)]'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </Row>
                <Row title={t('Language')} desc="Display language for the interface.">
                  <div className="inline-flex rounded-lg border border-[var(--line)] bg-[var(--base)] p-0.5">
                    {([['en', 'English'], ['ta', 'தமிழ்']] as const).map(([code, label]) => (
                      <button
                        key={code}
                        onClick={() => pickLang(code)}
                        className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                          lang === code
                            ? 'bg-[var(--fill-strong)] text-[var(--ink)]'
                            : 'text-[var(--ink-3)] hover:text-[var(--ink)]'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </Row>
                <Row title="Message text size" desc="Size of the chat conversation text.">
                  <div className="inline-flex rounded-lg border border-[var(--line)] bg-[var(--base)] p-0.5">
                    {(['small', 'medium', 'large'] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => pickTextSize(s)}
                        className={`px-3 py-1.5 rounded-md text-sm capitalize transition-colors ${
                          textSize === s ? 'bg-[var(--fill-strong)] text-[var(--ink)]' : 'text-[var(--ink-3)] hover:text-[var(--ink)]'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </Row>
                <Row title="Density" desc="How tightly the UI is packed.">
                  <div className="inline-flex rounded-lg border border-[var(--line)] bg-[var(--base)] p-0.5">
                    {(['compact', 'comfortable', 'spacious'] as const).map((d) => (
                      <button
                        key={d}
                        onClick={() => pickDensity(d)}
                        className={`px-3 py-1.5 rounded-md text-sm capitalize transition-colors ${
                          density === d ? 'bg-[var(--fill-strong)] text-[var(--ink)]' : 'text-[var(--ink-3)] hover:text-[var(--ink)]'
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </Row>
                <Row title="Interface font" desc="Font used across the app.">
                  <select
                    value={font}
                    onChange={(e) => pickFont(e.target.value)}
                    className="bg-[var(--base)] border border-[var(--line)] rounded-lg px-2.5 py-1.5 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)]"
                  >
                    {FONT_OPTIONS.map((o) => (
                      <option key={o.key} value={o.key}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </Row>
                <Row title="Code font" desc="Font for code blocks and snippets.">
                  <select
                    value={codeFont}
                    onChange={(e) => pickCodeFont(e.target.value)}
                    className="bg-[var(--base)] border border-[var(--line)] rounded-lg px-2.5 py-1.5 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)]"
                  >
                    {CODE_FONT_OPTIONS.map((o) => (
                      <option key={o.key} value={o.key}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </Row>
                <div className="py-4">
                  <p className="text-sm font-medium text-[var(--ink)]">Accent color</p>
                  <p className="text-xs text-[var(--ink-3)] mt-0.5 mb-3">Pick the highlight color used across the app.</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(ACCENTS).map(([n, a]) => (
                      <button
                        key={n}
                        onClick={() => pickAccent(n)}
                        title={a.label}
                        aria-label={a.label}
                        className={`w-6 h-6 shrink-0 rounded-full transition-transform hover:scale-110 ${
                          accent === n ? 'ring-2 ring-offset-2 ring-offset-[var(--elevated)] ring-[var(--ink-2)]' : ''
                        }`}
                        style={{ background: a.vars['--accent'] }}
                      />
                    ))}
                  </div>
                </div>
                {voices.length > 0 && (
                  <Row title="Read-aloud voice" desc="Voice used for the read-aloud (🔊) button.">
                    <div className="flex items-center gap-2">
                      <select
                        value={voice}
                        onChange={(e) => pickVoice(e.target.value)}
                        className="bg-[var(--base)] border border-[var(--line)] rounded-lg px-2.5 py-1.5 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)] max-w-[150px]"
                      >
                        <option value="">Default</option>
                        {voices.map((v) => (
                          <option key={v.name} value={v.name}>
                            {v.name}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={testVoice}
                        className="text-xs text-[var(--ink-3)] hover:text-[var(--ink)] border border-[var(--line)] rounded-lg px-2.5 py-1.5 transition-colors"
                      >
                        Test
                      </button>
                    </div>
                  </Row>
                )}
              </>
            )}

            {tab === 'chat' && (
              <>
                <div className="mb-3">
                  <h3 className={headingCls}>Chat</h3>
                  <p className={subCls}>Tune how Close AI responds to you.</p>
                </div>
                <Row title="Response style" desc="Sets the tone and length of answers.">
                  <div className="inline-flex rounded-lg border border-[var(--line)] bg-[var(--base)] p-0.5">
                    {(['default', 'concise', 'explanatory', 'formal'] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => pickStyle(s)}
                        className={`px-3 py-1.5 rounded-md text-xs sm:text-sm capitalize transition-colors ${
                          style === s
                            ? 'bg-[var(--fill-strong)] text-[var(--ink)]'
                            : 'text-[var(--ink-3)] hover:text-[var(--ink)]'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </Row>
                <div className="py-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-sm font-medium text-[var(--ink)]">Custom instructions</p>
                    {instrSaved && <span className="text-xs text-[var(--accent-fg)]">Saved ✓</span>}
                  </div>
                  <p className="text-xs text-[var(--ink-3)] mb-2.5">
                    Tell Close AI how to respond — e.g. &ldquo;Always answer in Tanglish&rdquo;, &ldquo;Keep code
                    comments minimal&rdquo;, or &ldquo;I&apos;m a beginner, explain simply&rdquo;.
                  </p>
                  <textarea
                    value={customInstr}
                    onChange={(e) => setCustomInstr(e.target.value)}
                    onBlur={saveCustomInstr}
                    rows={4}
                    maxLength={1200}
                    placeholder="Add custom instructions…"
                    className="w-full bg-[var(--fill)] border border-[var(--line)] rounded-lg px-3.5 py-2.5 text-sm text-[var(--ink)] placeholder:text-[var(--ink-4)] outline-none focus:border-[var(--accent)] transition-colors resize-none"
                  />
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[11px] text-[var(--ink-4)]">{customInstr.length}/1200</span>
                    <button onClick={saveCustomInstr} className={btnCls}>
                      Save
                    </button>
                  </div>
                </div>
                <Row
                  title="Notify when a long reply finishes"
                  desc="Browser notification when a streamed answer completes (works when the tab is in the background)."
                >
                  <button
                    onClick={toggleNotify}
                    aria-pressed={notify}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      notify ? 'bg-[var(--accent)]' : 'bg-[var(--fill-strong)]'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                        notify ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </Row>
              </>
            )}

            {tab === 'data' && (
              <>
                <div className="mb-3">
                  <h3 className={headingCls}>Data</h3>
                  <p className={subCls}>Export or wipe what Close AI has stored for your account.</p>
                </div>
                <Row title="Export all conversations" desc="Download a JSON archive of every chat you have.">
                  <button onClick={exportAllChats} className={btnCls}>
                    Export
                  </button>
                </Row>
                <Row
                  title="Browser storage"
                  desc="Settings, prompts, folders, and per-chat preferences are stored locally."
                >
                  <button
                    onClick={() => {
                      try {
                        const prefix = 'close_ai_';
                        const keys = Object.keys(localStorage).filter((k) => k.startsWith(prefix));
                        keys.forEach((k) => localStorage.removeItem(k));
                        toast.success(`Cleared ${keys.length} local preference${keys.length === 1 ? '' : 's'}.`);
                      } catch {
                        toast.error("Couldn't clear local preferences.");
                      }
                    }}
                    className="text-sm font-medium rounded-lg border border-[var(--line)] text-[var(--ink-2)] px-4 py-2 hover:bg-[var(--fill)] hover:text-[var(--ink)] transition-colors"
                  >
                    Reset local preferences
                  </button>
                </Row>
                <div className="mt-8 pt-5 border-t border-[var(--line)]">
                  <p className="text-xs font-medium uppercase tracking-wide text-[var(--ink-4)] mb-2">
                    Danger zone
                  </p>
                  <button
                    onClick={() => setConfirmClear(true)}
                    className="text-sm font-medium text-red-400 hover:text-red-300 transition-colors"
                  >
                    Clear all conversations
                  </button>
                  <p className="text-xs text-[var(--ink-4)] mt-1">
                    Permanently removes every chat. This can&apos;t be undone.
                  </p>
                </div>
              </>
            )}

            {tab === 'security' && (
              <>
                <div className="mb-5">
                  <h3 className={headingCls}>Security</h3>
                  <p className={subCls}>Update your account password.</p>
                </div>
                <label className={fieldLabel}>Current password</label>
                <input
                  type="password"
                  value={cur}
                  onChange={(e) => setCur(e.target.value)}
                  placeholder="••••••••"
                  className={`${inputCls} mb-4`}
                />
                <label className={fieldLabel}>New password</label>
                <input
                  type="password"
                  value={next}
                  onChange={(e) => setNext(e.target.value)}
                  placeholder="At least 8 characters"
                  className={`${inputCls} mb-5`}
                />
                <div className="flex justify-end max-w-sm">
                  <button onClick={savePw} disabled={savingPw || !cur || next.length < 8} className={btnCls}>
                    {savingPw ? 'Updating…' : 'Update password'}
                  </button>
                </div>
              </>
            )}

            {tab === 'about' && (
              <>
                <div className="flex items-center gap-3 mb-6">
                  <Logo size={44} />
                  <div className="min-w-0">
                    <p className="text-base font-display font-medium text-[var(--ink)]">Close AI</p>
                    <p className="text-xs text-[var(--ink-3)] mt-0.5">
                      Document intelligence · v{APP_VERSION}
                    </p>
                  </div>
                </div>
                <Row title="Version" desc="Current build of the app.">
                  <span className="text-sm text-[var(--ink-2)] font-mono">{APP_VERSION}</span>
                </Row>
                <Row title="Model" desc="Powering chat, code, vision, and embeddings.">
                  <span className="text-xs text-[var(--ink-2)]">NVIDIA NIM · Llama-3.3-70B</span>
                </Row>
                <Row title="Powered by" desc="The team behind Close AI.">
                  <span className="text-sm text-[var(--accent-fg)] font-medium">Fluxera</span>
                </Row>
                <Row title="Shortcuts" desc="Press the ? key anywhere to view keyboard shortcuts.">
                  <kbd className="px-2 py-0.5 rounded-md bg-[var(--fill)] border border-[var(--line)] text-[11px] font-medium text-[var(--ink-2)]">
                    ?
                  </kbd>
                </Row>
                <p className="mt-6 text-[11px] text-[var(--ink-4)] leading-relaxed">
                  Close AI may make mistakes — verify important info. Your conversations and
                  uploads are private to your account.
                </p>
              </>
            )}
          </div>
        </div>
      </div>
      {confirmClear && (
        <ConfirmModal
          title="Clear all conversations"
          message="Delete ALL conversations? This permanently removes every chat and can't be undone."
          confirmLabel="Delete all"
          danger
          onConfirm={doClear}
          onClose={() => setConfirmClear(false)}
        />
      )}
    </div>,
    document.body
  );
}
