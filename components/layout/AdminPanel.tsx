'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import { useAuth } from '@/components/auth/AuthProvider';
import { ConfirmModal } from '@/components/layout/Dialogs';
import { Logo } from '@/components/layout/Logo';
import {
  adminStats,
  adminListUsers,
  adminUpdateUser,
  adminDeleteUser,
  adminAuditLog,
  adminGetFeatures,
  adminSetFeatures,
  adminUserApiKeys,
  adminRevokeApiKey,
  adminDeleteApiKey,
  adminListApps,
  adminAppsSummary,
  adminAppDocuments,
  adminAppActivity,
  adminSetAppPlan,
  adminDeleteAppDocument,
  adminListPlans,
  adminCreatePlan,
  adminUpdatePlan,
  adminDeletePlan,
  adminListCssReviews,
  adminApproveCss,
  adminRejectCss,
  adminWidgetAnalytics,
  type AdminWidgetAnalytics,
  adminListBroadcasts,
  adminCreateBroadcast,
  adminSetBroadcastActive,
  adminDeleteBroadcast,
  announcementAudience,
  adminUserActivity,
  type UserActivity,
  adminListInvites,
  adminCreateInvite,
  adminDeleteInvite,
  adminListWebhooks,
  adminCreateWebhook,
  adminUpdateWebhook,
  adminDeleteWebhook,
  adminTestWebhook,
  apiError,
  type AdminStats,
  type AdminUser,
  type AdminAuditEntry,
  type AdminApiKey,
  type AdminApp,
  type AdminAppsSummary,
  type AdminAppDocuments,
  type AdminAppActivity,
  type AdminAppPlanCount,
  type AdminPlan,
  type AdminPlanInput,
  type AdminPlanPatch,
  type AdminCssReview,
  type AdminBroadcast,
  type BroadcastLevel,
  type AdminInvite,
  type AdminWebhook,
  type FeatureMap,
} from '@/services/api';
import { useFeatures } from '@/components/providers/FeatureProvider';
import { FEATURE_GROUPS } from '@/lib/features';

type Tab = 'dashboard' | 'users' | 'apps' | 'plans' | 'reviews' | 'broadcast' | 'invites' | 'webhooks' | 'features' | 'audit';

const headingCls = 'text-base font-semibold text-[var(--ink)]';
const subCls = 'text-xs text-[var(--ink-3)] mt-0.5';

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(n);
}

// The backend stores naive UTC timestamps (datetime.utcnow) and serialises them
// with no timezone marker. JS would otherwise read them as LOCAL time and be off
// by the user's UTC offset — so append 'Z' to force UTC, then convert to local.
function parseUTC(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const hasTz = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(iso);
  const d = new Date(hasTz ? iso : `${iso}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Full local date + time, e.g. "13 Jun 2026, 10:04 PM". */
function fmtDateTime(iso: string | null | undefined): string {
  const d = parseUTC(iso);
  if (!d) return '—';
  return d.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

/** Short relative label, e.g. "6h ago" — shown as a hover hint alongside the date. */
function timeAgo(iso: string | null | undefined): string {
  const d = parseUTC(iso);
  if (!d) return '';
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const day = Math.floor(h / 24);
  if (day < 30) return `${day}d ago`;
  const mo = Math.floor(day / 30);
  return `${mo}mo ago`;
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
function shortDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

const DASH_ICON = {
  users: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4-4 4 4 0 004 4zm6 0a3 3 0 10-3-3" /></svg>
  ),
  chat: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 10h8M8 14h5m-9 6l3.5-2H18a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12z" /></svg>
  ),
  key: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4-2a6 6 0 01-7.74 5.74L9 17H7v2H5v2H2v-3l6.26-6.26A6 6 0 1121 7z" /></svg>
  ),
  share: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8.7 10.7l6.6-3.4M8.7 13.3l6.6 3.4M18 8a3 3 0 100-6 3 3 0 000 6zM6 15a3 3 0 100-6 3 3 0 000 6zm12 7a3 3 0 100-6 3 3 0 000 6z" /></svg>
  ),
};

function KpiCard({
  icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border p-4 ${
        accent
          ? 'border-[var(--accent)]/40 bg-gradient-to-br from-[var(--accent)]/12 to-transparent'
          : 'border-[var(--line)] bg-[var(--fill)]'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[28px] leading-none font-semibold text-[var(--ink)] tabular-nums">{value}</p>
          <p className="text-xs text-[var(--ink-3)] mt-2">{label}</p>
          {hint && <p className="text-[10px] text-[var(--ink-4)] mt-0.5">{hint}</p>}
        </div>
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
            accent ? 'bg-[var(--accent)]/15 text-[var(--accent-fg)]' : 'bg-[var(--fill-strong)] text-[var(--ink-3)]'
          }`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: number; tone?: 'amber' | 'red' }) {
  const color = tone === 'red' ? 'text-red-400' : tone === 'amber' ? 'text-amber-400' : 'text-[var(--ink)]';
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--fill)] px-3 py-2.5">
      <p className={`text-lg font-semibold tabular-nums ${color}`}>{fmt(value)}</p>
      <p className="text-[10px] text-[var(--ink-4)] mt-0.5">{label}</p>
    </div>
  );
}

function SignupsChart({ data }: { data: { date: string; count: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const total = data.reduce((s, d) => s + d.count, 0);
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--fill)] p-4">
      <div className="flex items-baseline justify-between mb-3">
        <p className="text-sm font-medium text-[var(--ink)]">Sign-ups · last 14 days</p>
        <span className="text-xs text-[var(--ink-4)]">{total} total</span>
      </div>
      <div className="flex items-end gap-1.5 h-28">
        {data.map((d) => {
          const pct = d.count > 0 ? Math.max(Math.round((d.count / max) * 100), 8) : 3;
          return (
            <div
              key={d.date}
              className="flex-1 h-full flex items-end"
              title={`${shortDate(d.date)} · ${d.count} sign-up${d.count === 1 ? '' : 's'}`}
            >
              <div
                className={`w-full rounded-t-md transition-colors ${
                  d.count > 0 ? 'bg-[var(--accent)]/70 hover:bg-[var(--accent)]' : 'bg-[var(--fill-strong)]'
                }`}
                style={{ height: `${pct}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex justify-between mt-2 text-[10px] text-[var(--ink-4)]">
        <span>{shortDate(data[0]?.date)}</span>
        <span>Today</span>
      </div>
    </div>
  );
}

function SystemHealth({ system }: { system: AdminStats['system'] }) {
  const providers: [string, boolean][] = [
    ['NVIDIA NIM', system.providers.nvidia],
    ['Groq', system.providers.groq],
    ['Tavily (web)', system.providers.tavily],
    ['Email (SMTP)', system.providers.email],
  ];
  const isPg = system.database === 'PostgreSQL';
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--fill)] p-4">
      <p className="text-sm font-medium text-[var(--ink)] mb-3">System health</p>
      <div className="space-y-2 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-[var(--ink-3)]">Database</span>
          <span className={`font-medium ${isPg ? 'text-emerald-400' : 'text-amber-400'}`}>
            {system.database}
            {!isPg && <span className="text-[var(--ink-4)] font-normal"> · not persistent</span>}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[var(--ink-3)]">Environment</span>
          <span className="font-medium text-[var(--ink-2)] capitalize">{system.environment}</span>
        </div>
      </div>
      <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--ink-4)] mt-4 mb-2">AI providers</p>
      <div className="grid grid-cols-2 gap-2">
        {providers.map(([name, on]) => (
          <div key={name} className="flex items-center gap-2 text-xs">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${on ? 'bg-emerald-400' : 'bg-[var(--ink-4)]'}`} />
            <span className={on ? 'text-[var(--ink-2)]' : 'text-[var(--ink-4)]'}>{name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TopUsers({ users }: { users: AdminStats['top_users'] }) {
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--fill)] p-4">
      <p className="text-sm font-medium text-[var(--ink)] mb-3">Most active users</p>
      {users.length === 0 ? (
        <p className="text-xs text-[var(--ink-4)]">No activity yet.</p>
      ) : (
        <div className="space-y-2">
          {users.map((u, i) => (
            <div key={u.id} className="flex items-center gap-3">
              <span className="w-5 text-center text-xs font-semibold text-[var(--ink-4)]">{i + 1}</span>
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[var(--accent)] to-[var(--accent-strong)] flex items-center justify-center text-white text-[11px] font-semibold flex-shrink-0">
                {u.name?.[0]?.toUpperCase() ?? 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[var(--ink)] truncate">{u.name}</p>
                <p className="text-[10px] text-[var(--ink-4)] truncate">{u.email}</p>
              </div>
              <span className="text-xs font-medium text-[var(--ink-2)] tabular-nums flex-shrink-0">
                {fmt(u.chat_count)} chats
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DashboardTab() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [wa, setWa] = useState<AdminWidgetAnalytics | null>(null);

  useEffect(() => {
    adminStats()
      .then(setStats)
      .catch((e) => toast.error(apiError(e, 'Could not load stats.')))
      .finally(() => setLoading(false));
    adminWidgetAnalytics().then(setWa).catch(() => {});
  }, []);

  if (loading) return <p className="text-xs text-[var(--ink-4)]">Loading dashboard…</p>;
  if (!stats) return <p className="text-xs text-[var(--ink-4)]">No data.</p>;

  const u = stats.users;
  const c = stats.content;

  return (
    <>
      <div className="mb-5">
        <h3 className={headingCls}>Dashboard</h3>
        <p className={subCls}>Platform health at a glance.</p>
      </div>

      {/* KPI hero */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
        <KpiCard icon={DASH_ICON.users} label="Total users" value={fmt(u.total)} hint={`+${u.new_7d} this week`} accent />
        <KpiCard icon={DASH_ICON.chat} label="Total chats" value={fmt(c.chats)} />
        <KpiCard icon={DASH_ICON.key} label="API calls" value={fmt(c.api_calls)} hint={`${c.active_api_keys} active keys`} />
        <KpiCard icon={DASH_ICON.share} label="Shared links" value={fmt(c.shared_chats)} />
      </div>

      {/* Mini stats */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-5">
        <MiniStat label="Verified" value={u.verified} />
        <MiniStat label="Unverified" value={u.unverified} tone={u.unverified > 0 ? 'amber' : undefined} />
        <MiniStat label="Admins" value={u.admins} />
        <MiniStat label="Banned" value={u.banned} tone={u.banned > 0 ? 'red' : undefined} />
        <MiniStat label="New · 30d" value={u.new_30d} />
        <MiniStat label="w/ memory" value={c.memory_users} />
      </div>

      {/* Widget activity across all apps */}
      {wa && (
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--fill)] p-4 mb-5">
          <p className="text-sm font-medium text-[var(--ink)] mb-3">Widget activity · all apps</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
            <MiniStat label="Questions" value={wa.total_questions} />
            <MiniStat label="Conversations" value={wa.conversations} />
            <MiniStat label="Leads" value={wa.leads} />
            <MiniStat label="Unanswered" value={wa.unanswered} tone={wa.unanswered > 0 ? 'amber' : undefined} />
          </div>
          {wa.top_apps.length > 0 && (
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--ink-4)] mb-2">Busiest apps</p>
              <div className="space-y-1.5">
                {wa.top_apps.map((a) => (
                  <div key={a.key_id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-[var(--ink-2)] truncate">{a.name}</span>
                    <span className="text-[var(--ink-4)] tabular-nums flex-shrink-0">{fmt(a.questions)} questions</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Chart */}
      <div className="mb-5">
        <SignupsChart data={stats.signups_by_day} />
      </div>

      {/* System + Top users */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-5">
        <SystemHealth system={stats.system} />
        <TopUsers users={stats.top_users} />
      </div>

      {/* Recent signups */}
      {stats.recent_signups.length > 0 && (
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--fill)] p-4">
          <p className="text-sm font-medium text-[var(--ink)] mb-3">Recent sign-ups</p>
          <div className="space-y-2">
            {stats.recent_signups.map((s) => (
              <div key={s.id} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--accent)] to-[var(--accent-strong)] flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                  {s.name?.[0]?.toUpperCase() ?? 'U'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--ink)] truncate">{s.name}</p>
                  <p className="text-[11px] text-[var(--ink-4)] truncate">{s.email}</p>
                </div>
                {!s.is_verified && (
                  <span className="flex-shrink-0 text-[10px] font-medium text-amber-400 bg-amber-400/10 rounded-full px-2 py-0.5">
                    Unverified
                  </span>
                )}
                <span className="flex-shrink-0 text-[11px] text-[var(--ink-4)]" title={timeAgo(s.created_at)}>
                  {fmtDateTime(s.created_at)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

// ── Users ───────────────────────────────────────────────────────────────────
function Badge({ children, tone }: { children: React.ReactNode; tone: 'admin' | 'banned' | 'unverified' | 'api' }) {
  const cls =
    tone === 'admin'
      ? 'text-[var(--accent-fg)] bg-[var(--accent)]/10'
      : tone === 'banned'
        ? 'text-red-400 bg-red-400/10'
        : tone === 'api'
          ? 'text-orange-400 bg-orange-400/10'
          : 'text-amber-400 bg-amber-400/10';
  return (
    <span className={`flex-shrink-0 text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5 ${cls}`}>
      {children}
    </span>
  );
}

function UserRow({
  u,
  selfId,
  onPatch,
  onDelete,
  busy,
}: {
  u: AdminUser;
  selfId: number | undefined;
  onPatch: (patch: { is_verified?: boolean; is_admin?: boolean; is_banned?: boolean; api_blocked?: boolean }) => void;
  onDelete: () => void;
  busy: boolean;
}) {
  const isSelf = u.id === selfId;
  const locked = u.is_protected || isSelf; // can't demote / ban / delete

  const actionBtn =
    'text-xs font-medium px-2.5 py-1 rounded-lg border transition-colors disabled:opacity-40 disabled:cursor-not-allowed';

  // ── API-key management (lazy-loaded when the row is expanded) ──
  const [showKeys, setShowKeys] = useState(false);
  const [keys, setKeys] = useState<AdminApiKey[] | null>(null);
  const [loadingKeys, setLoadingKeys] = useState(false);
  const [keyBusy, setKeyBusy] = useState<number | null>(null);

  // ── Activity timeline (lazy-loaded when the row is expanded) ──
  const [showActivity, setShowActivity] = useState(false);
  const [activity, setActivity] = useState<UserActivity | null>(null);
  const [loadingActivity, setLoadingActivity] = useState(false);

  const toggleActivity = () => {
    const next = !showActivity;
    setShowActivity(next);
    if (next && activity === null) {
      setLoadingActivity(true);
      adminUserActivity(u.id)
        .then(setActivity)
        .catch((e) => toast.error(apiError(e, 'Could not load activity.')))
        .finally(() => setLoadingActivity(false));
    }
  };

  const loadKeys = useCallback(() => {
    setLoadingKeys(true);
    adminUserApiKeys(u.id)
      .then(setKeys)
      .catch((e) => toast.error(apiError(e, 'Could not load API keys.')))
      .finally(() => setLoadingKeys(false));
  }, [u.id]);

  const toggleKeys = () => {
    const next = !showKeys;
    setShowKeys(next);
    if (next && keys === null) loadKeys();
  };

  const revokeKey = async (id: number) => {
    setKeyBusy(id);
    try {
      await adminRevokeApiKey(id);
      setKeys((ks) => (ks ? ks.map((k) => (k.id === id ? { ...k, revoked: true } : k)) : ks));
      toast.success('Key revoked');
    } catch (e) {
      toast.error(apiError(e, 'Could not revoke key.'));
    } finally {
      setKeyBusy(null);
    }
  };

  const deleteKey = async (id: number) => {
    setKeyBusy(id);
    try {
      await adminDeleteApiKey(id);
      setKeys((ks) => (ks ? ks.filter((k) => k.id !== id) : ks));
      toast.success('Key deleted');
    } catch (e) {
      toast.error(apiError(e, 'Could not delete key.'));
    } finally {
      setKeyBusy(null);
    }
  };

  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--fill)]">
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-3.5 py-3">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[var(--accent)] to-[var(--accent-strong)] flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
          {u.name?.[0]?.toUpperCase() ?? 'U'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-[var(--ink)] truncate">{u.name}</p>
            {u.is_admin && <Badge tone="admin">{u.is_protected ? 'Super Admin' : 'Admin'}</Badge>}
            {u.is_banned && <Badge tone="banned">Banned</Badge>}
            {u.api_blocked && <Badge tone="api">API blocked</Badge>}
            {!u.is_verified && <Badge tone="unverified">Unverified</Badge>}
          </div>
          <p className="text-[11px] text-[var(--ink-4)] truncate">{u.email}</p>
          <p className="text-[11px] text-[var(--ink-4)] mt-0.5" title={timeAgo(u.created_at)}>
            {u.chat_count} chats · {u.api_key_count} keys · joined {fmtDateTime(u.created_at)}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap flex-shrink-0">
        <button
          onClick={toggleActivity}
          className={`${actionBtn} border-[var(--line)] text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--fill-strong)]`}
        >
          {showActivity ? 'Hide log' : 'Activity'}
        </button>
        <button
          onClick={toggleKeys}
          className={`${actionBtn} border-[var(--line)] text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--fill-strong)]`}
        >
          {showKeys ? 'Hide keys' : `Keys (${u.api_key_count})`}
        </button>
        {!u.is_verified && (
          <button
            disabled={busy}
            onClick={() => onPatch({ is_verified: true })}
            className={`${actionBtn} border-[var(--line)] text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--fill-strong)]`}
          >
            Verify
          </button>
        )}
        {u.is_admin ? (
          <button
            disabled={busy || locked}
            title={locked ? 'Protected admin — cannot be demoted' : undefined}
            onClick={() => onPatch({ is_admin: false })}
            className={`${actionBtn} border-[var(--line)] text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--fill-strong)]`}
          >
            Demote
          </button>
        ) : (
          <button
            disabled={busy}
            onClick={() => onPatch({ is_admin: true })}
            className={`${actionBtn} border-[var(--accent)]/40 text-[var(--accent-fg)] hover:bg-[var(--accent)]/10`}
          >
            Make admin
          </button>
        )}
        {u.is_banned ? (
          <button
            disabled={busy}
            onClick={() => onPatch({ is_banned: false })}
            className={`${actionBtn} border-[var(--line)] text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--fill-strong)]`}
          >
            Unban
          </button>
        ) : (
          <button
            disabled={busy || locked}
            title={locked ? 'Protected admin — cannot be banned' : undefined}
            onClick={() => onPatch({ is_banned: true })}
            className={`${actionBtn} border-amber-400/40 text-amber-400 hover:bg-amber-400/10`}
          >
            Ban
          </button>
        )}
        {u.api_blocked ? (
          <button
            disabled={busy}
            onClick={() => onPatch({ api_blocked: false })}
            className={`${actionBtn} border-[var(--line)] text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--fill-strong)]`}
          >
            Unblock API
          </button>
        ) : (
          <button
            disabled={busy}
            title="Disable this user's API keys and prevent new ones"
            onClick={() => onPatch({ api_blocked: true })}
            className={`${actionBtn} border-orange-400/40 text-orange-400 hover:bg-orange-400/10`}
          >
            Block API
          </button>
        )}
        <button
          disabled={busy || locked}
          title={locked ? 'Protected admin — cannot be deleted' : undefined}
          onClick={onDelete}
          className={`${actionBtn} border-red-400/40 text-red-400 hover:bg-red-400/10`}
        >
          Delete
        </button>
      </div>
    </div>

    {/* Expandable per-user API-key panel */}
    {showKeys && (
      <div className="border-t border-[var(--line)] px-3.5 py-3">
        <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--ink-4)] mb-2">
          API keys
        </p>
        {loadingKeys ? (
          <p className="text-xs text-[var(--ink-4)]">Loading…</p>
        ) : !keys || keys.length === 0 ? (
          <p className="text-xs text-[var(--ink-4)]">This user has no API keys.</p>
        ) : (
          <div className="space-y-1.5">
            {keys.map((k) => (
              <div
                key={k.id}
                className="flex items-center gap-3 px-3 py-2 rounded-lg border border-[var(--line)] bg-[var(--base)]/40"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-[var(--ink)] truncate">{k.name}</p>
                    {k.revoked && <Badge tone="banned">Revoked</Badge>}
                  </div>
                  <p className="text-[11px] font-mono text-[var(--ink-4)] truncate">
                    {k.prefix} · {k.usage_count} reqs · {k.total_tokens} tokens
                    {k.last_used_at ? ` · used ${fmtDateTime(k.last_used_at)}` : ' · never used'}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {!k.revoked && (
                    <button
                      disabled={keyBusy === k.id}
                      onClick={() => revokeKey(k.id)}
                      className={`${actionBtn} border-amber-400/40 text-amber-400 hover:bg-amber-400/10`}
                    >
                      Revoke
                    </button>
                  )}
                  <button
                    disabled={keyBusy === k.id}
                    onClick={() => deleteKey(k.id)}
                    className={`${actionBtn} border-red-400/40 text-red-400 hover:bg-red-400/10`}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )}

    {/* Expandable per-user activity timeline */}
    {showActivity && (
      <div className="border-t border-[var(--line)] px-3.5 py-3">
        <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--ink-4)] mb-2">
          Activity
        </p>
        {loadingActivity ? (
          <p className="text-xs text-[var(--ink-4)]">Loading…</p>
        ) : !activity ? (
          <p className="text-xs text-[var(--ink-4)]">No activity available.</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {([
                ['Chats', activity.footprint.chats],
                ['API keys', activity.footprint.api_keys],
                ['Memory', activity.footprint.memory_facts],
                ['Shared', activity.footprint.shared_chats],
              ] as [string, number][]).map(([label, n]) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-1 text-[11px] rounded-md px-2 py-0.5 border border-[var(--line)] bg-[var(--base)]/40 text-[var(--ink-3)]"
                >
                  <span className="font-semibold text-[var(--ink-2)]">{n}</span> {label}
                </span>
              ))}
            </div>
            {activity.events.length === 0 ? (
              <p className="text-xs text-[var(--ink-4)]">No recorded events.</p>
            ) : (
              <div className="space-y-1.5">
                {activity.events.map((ev, i) => (
                  <div
                    key={`${ev.type}-${ev.at}-${i}`}
                    className="flex items-start gap-3 px-3 py-2 rounded-lg border border-[var(--line)] bg-[var(--base)]/40"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-[var(--ink-2)] break-words">
                        <span className="text-[var(--ink)] font-medium">
                          {ev.label ?? ACTION_LABEL[ev.type] ?? ev.type}
                        </span>
                        {ev.actor && <span className="text-[var(--ink-4)]"> · by {ev.actor}</span>}
                      </p>
                      {ev.detail && (
                        <p className="text-[11px] text-[var(--ink-4)] mt-0.5 break-words">{ev.detail}</p>
                      )}
                    </div>
                    <span className="flex-shrink-0 text-[11px] text-[var(--ink-4)]" title={timeAgo(ev.at)}>
                      {fmtDateTime(ev.at)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    )}
    </div>
  );
}

function UsersTab() {
  const { user } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [filter, setFilter] = useState<'all' | 'admins' | 'banned' | 'unverified'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'name' | 'active'>('newest');
  const [confirm, setConfirm] = useState<
    | { kind: 'ban' | 'demote' | 'delete' | 'block'; target: AdminUser }
    | null
  >(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback((q: string) => {
    setLoading(true);
    adminListUsers(q, 100, 0)
      .then((r) => {
        setUsers(r.users);
        setTotal(r.total);
      })
      .catch((e) => toast.error(apiError(e, 'Could not load users.')))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load('');
  }, [load]);

  // Debounced search-as-you-type.
  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => load(query.trim()), 300);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [query, load]);

  const applyPatch = async (
    target: AdminUser,
    patch: { is_verified?: boolean; is_admin?: boolean; is_banned?: boolean; api_blocked?: boolean }
  ) => {
    setBusyId(target.id);
    try {
      const updated = await adminUpdateUser(target.id, patch);
      setUsers((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      toast.success('User updated');
    } catch (e) {
      toast.error(apiError(e, 'Could not update user.'));
    } finally {
      setBusyId(null);
    }
  };

  const doDelete = async (target: AdminUser) => {
    setBusyId(target.id);
    try {
      await adminDeleteUser(target.id);
      setUsers((prev) => prev.filter((x) => x.id !== target.id));
      setTotal((t) => Math.max(0, t - 1));
      toast.success(`Deleted ${target.email}`);
    } catch (e) {
      toast.error(apiError(e, 'Could not delete user.'));
    } finally {
      setBusyId(null);
    }
  };

  // Destructive actions (ban / demote / delete) confirm first; verify/unban/promote are immediate.
  const handlePatch = (
    target: AdminUser,
    patch: { is_verified?: boolean; is_admin?: boolean; is_banned?: boolean; api_blocked?: boolean }
  ) => {
    if (patch.is_banned === true) return setConfirm({ kind: 'ban', target });
    if (patch.is_admin === false) return setConfirm({ kind: 'demote', target });
    if (patch.api_blocked === true) return setConfirm({ kind: 'block', target });
    applyPatch(target, patch);
  };

  // Client-side filter + sort over the loaded page (search hits the server).
  const displayed = useMemo(() => {
    let list = users;
    if (filter === 'admins') list = list.filter((u) => u.is_admin);
    else if (filter === 'banned') list = list.filter((u) => u.is_banned);
    else if (filter === 'unverified') list = list.filter((u) => !u.is_verified);
    const sorted = [...list];
    sorted.sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'active') return b.chat_count - a.chat_count;
      const ta = a.created_at ? Date.parse(a.created_at) : 0;
      const tb = b.created_at ? Date.parse(b.created_at) : 0;
      return sortBy === 'oldest' ? ta - tb : tb - ta;
    });
    return sorted;
  }, [users, filter, sortBy]);

  const exportCsv = () => {
    const header = ['id', 'name', 'email', 'phone', 'verified', 'admin', 'banned', 'chats', 'api_keys', 'created_at'];
    const esc = (v: unknown) => {
      const s = String(v ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = displayed.map((u) => [
      u.id, u.name, u.email, u.phone ?? '', u.is_verified, u.is_admin, u.is_banned, u.chat_count, u.api_key_count, u.created_at ?? '',
    ]);
    const csv = [header, ...rows].map((r) => r.map(esc).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `close-ai-users-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${displayed.length} user${displayed.length === 1 ? '' : 's'}`);
  };

  return (
    <>
      <div className="mb-4">
        <h3 className={headingCls}>Users</h3>
        <p className={subCls}>{total} registered {total === 1 ? 'account' : 'accounts'}.</p>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--ink-4)]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="7" />
          <path strokeLinecap="round" d="M21 21l-4.3-4.3" />
        </svg>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or email…"
          className="w-full bg-[var(--fill)] border border-[var(--line)] rounded-lg pl-9 pr-3 py-2.5 text-sm text-[var(--ink)] placeholder:text-[var(--ink-4)] outline-none focus:border-[var(--accent)] transition-colors"
        />
      </div>

      {/* Filter chips + sort + export */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex gap-0.5 rounded-lg border border-[var(--line)] bg-[var(--base)] p-0.5">
          {(['all', 'admins', 'banned', 'unverified'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2.5 py-1 rounded-md text-xs capitalize transition-colors ${
                filter === f ? 'bg-[var(--fill-strong)] text-[var(--ink)]' : 'text-[var(--ink-3)] hover:text-[var(--ink)]'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          className="bg-[var(--base)] border border-[var(--line)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--ink)] outline-none focus:border-[var(--accent)]"
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="name">Name (A–Z)</option>
          <option value="active">Most active</option>
        </select>
        <button
          onClick={exportCsv}
          disabled={displayed.length === 0}
          className="ml-auto inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-[var(--line)] text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--fill-strong)] transition-colors disabled:opacity-40"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
          </svg>
          Export CSV
        </button>
      </div>

      {loading ? (
        <p className="text-xs text-[var(--ink-4)]">Loading users…</p>
      ) : displayed.length === 0 ? (
        <p className="text-xs text-[var(--ink-4)]">
          No users {query ? 'match that search' : filter !== 'all' ? `in “${filter}”` : 'yet'}.
        </p>
      ) : (
        <div className="space-y-2">
          {displayed.map((u) => (
            <UserRow
              key={u.id}
              u={u}
              selfId={user?.id}
              busy={busyId === u.id}
              onPatch={(patch) => handlePatch(u, patch)}
              onDelete={() => setConfirm({ kind: 'delete', target: u })}
            />
          ))}
        </div>
      )}

      {confirm && (
        <ConfirmModal
          title={
            confirm.kind === 'ban'
              ? 'Ban user'
              : confirm.kind === 'demote'
                ? 'Remove admin access'
                : confirm.kind === 'block'
                  ? 'Block API access'
                  : 'Delete user'
          }
          message={
            confirm.kind === 'ban'
              ? `Ban ${confirm.target.email}? They'll be signed out and unable to log in until unbanned.`
              : confirm.kind === 'demote'
                ? `Remove admin access from ${confirm.target.email}? They'll lose access to this panel.`
                : confirm.kind === 'block'
                  ? `Block API access for ${confirm.target.email}? All their API keys are revoked immediately and they can't create new ones until unblocked.`
                  : `Permanently delete ${confirm.target.email}? This wipes their account, chats, documents, API keys, and memory. This can't be undone.`
          }
          confirmLabel={
            confirm.kind === 'ban'
              ? 'Ban'
              : confirm.kind === 'demote'
                ? 'Demote'
                : confirm.kind === 'block'
                  ? 'Block API'
                  : 'Delete'
          }
          danger
          onConfirm={() => {
            const { kind, target } = confirm;
            if (kind === 'ban') applyPatch(target, { is_banned: true });
            else if (kind === 'demote') applyPatch(target, { is_admin: false });
            else if (kind === 'block') applyPatch(target, { api_blocked: true });
            else doDelete(target);
            setConfirm(null);
          }}
          onClose={() => setConfirm(null)}
        />
      )}
    </>
  );
}

// ── Features ──────────────────────────────────────────────────────────────────
function Toggle({
  on,
  busy,
  onClick,
}: {
  on: boolean;
  busy: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      aria-pressed={on}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
        on ? 'bg-[var(--accent)]' : 'bg-[var(--fill-strong)]'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
          on ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

// ── Developers (apps) ─────────────────────────────────────────────────────────
function fmtBytes(n: number): string {
  if (!n) return '0 B';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

const PLAN_PILL: Record<string, string> = {
  free: 'text-[var(--ink-3)] bg-[var(--fill-strong)]',
  go: 'text-sky-400 bg-sky-400/10',
  pro: 'text-violet-400 bg-violet-400/10',
  max: 'text-amber-400 bg-amber-400/10',
  enterprise: 'text-emerald-400 bg-emerald-400/10',
};
const planPill = (plan: string) => PLAN_PILL[plan] ?? PLAN_PILL.free;

const STATIC_PLANS: { key: string; label: string }[] = [
  { key: 'free', label: 'Free' },
  { key: 'go', label: 'Go' },
  { key: 'pro', label: 'Pro' },
  { key: 'max', label: 'Max' },
  { key: 'enterprise', label: 'Enterprise' },
];

const APP_ICON = {
  apps: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>
  ),
  doc: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 4H7a2 2 0 01-2-2V6a2 2 0 012-2h7l5 5v11a2 2 0 01-2 2z" /></svg>
  ),
};

function AppCard({
  app,
  plans,
  expanded,
  onToggle,
  onPatched,
  onRemoved,
  onRefresh,
}: {
  app: AdminApp;
  plans: { key: string; label: string }[];
  expanded: boolean;
  onToggle: () => void;
  onPatched: (a: AdminApp) => void;
  onRemoved: (id: number) => void;
  onRefresh: () => void;
}) {
  const [docs, setDocs] = useState<AdminAppDocuments | null>(null);
  const [activity, setActivity] = useState<AdminAppActivity | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<
    { kind: 'revoke' | 'delete' | 'doc'; docId?: number; filename?: string } | null
  >(null);

  const actionBtn =
    'text-xs font-medium px-2.5 py-1 rounded-lg border transition-colors disabled:opacity-40 disabled:cursor-not-allowed';

  useEffect(() => {
    if (expanded && docs === null) {
      setLoading(true);
      Promise.all([adminAppDocuments(app.id), adminAppActivity(app.id)])
        .then(([d, a]) => {
          setDocs(d);
          setActivity(a);
        })
        .catch((e) => toast.error(apiError(e, 'Could not load app details.')))
        .finally(() => setLoading(false));
    }
  }, [expanded, app.id, docs]);

  const changePlan = async (newPlan: string) => {
    if (newPlan === app.plan) return;
    setBusy(true);
    try {
      const updated = await adminSetAppPlan(app.id, newPlan);
      onPatched(updated);
      toast.success(`Plan set to ${updated.plan_label}`);
      onRefresh();
    } catch (e) {
      toast.error(apiError(e, 'Could not change plan.'));
    } finally {
      setBusy(false);
    }
  };

  const doRevoke = async () => {
    setBusy(true);
    try {
      await adminRevokeApiKey(app.id);
      onPatched({ ...app, revoked: true });
      toast.success('Key revoked');
    } catch (e) {
      toast.error(apiError(e, 'Could not revoke key.'));
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async () => {
    setBusy(true);
    try {
      await adminDeleteApiKey(app.id);
      onRemoved(app.id);
      toast.success('App deleted');
      onRefresh();
    } catch (e) {
      toast.error(apiError(e, 'Could not delete app.'));
    } finally {
      setBusy(false);
    }
  };

  const deleteDoc = async (docId: number) => {
    setBusy(true);
    try {
      await adminDeleteAppDocument(app.id, docId);
      setDocs((d) => (d ? { ...d, documents: d.documents.filter((x) => x.id !== docId) } : d));
      onPatched({ ...app, doc_count: Math.max(0, app.doc_count - 1) });
      toast.success('Document deleted');
    } catch (e) {
      toast.error(apiError(e, 'Could not delete document.'));
    } finally {
      setBusy(false);
    }
  };

  const toggleOwnerBlock = async () => {
    const blocking = !app.owner_api_blocked;
    setBusy(true);
    try {
      await adminUpdateUser(app.owner_id, { api_blocked: blocking });
      // Blocking an owner also revokes all their keys server-side.
      onPatched({ ...app, owner_api_blocked: blocking, revoked: blocking ? true : app.revoked });
      toast.success(blocking ? 'Owner API access blocked' : 'Owner API access restored');
      onRefresh();
    } catch (e) {
      toast.error(apiError(e, 'Could not update owner.'));
    } finally {
      setBusy(false);
    }
  };

  const limitLabel = app.doc_limit >= 100000 ? '∞' : String(app.doc_limit);

  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--fill)] overflow-hidden">
      {/* Row */}
      <div className="flex items-center gap-3 px-3.5 py-3">
        <button onClick={onToggle} className="flex items-center gap-3 flex-1 min-w-0 text-left">
          <svg
            className={`w-4 h-4 flex-shrink-0 text-[var(--ink-4)] transition-transform ${expanded ? 'rotate-90' : ''}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-medium text-[var(--ink)] truncate">{app.name}</p>
              <span className={`text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5 ${planPill(app.plan)}`}>
                {app.plan_label}
              </span>
              {app.revoked && <Badge tone="banned">Revoked</Badge>}
              {app.owner_api_blocked && <Badge tone="api">Owner blocked</Badge>}
            </div>
            <p className="text-[11px] text-[var(--ink-4)] truncate mt-0.5">
              {app.owner_email ?? 'unknown owner'} · <span className="font-mono">{app.prefix}</span>
            </p>
          </div>
        </button>
        <div className="hidden sm:flex items-center gap-5 flex-shrink-0 text-right">
          <div>
            <p className={`text-sm font-semibold tabular-nums ${app.near_limit ? 'text-amber-400' : 'text-[var(--ink)]'}`}>
              {app.doc_count}/{limitLabel}
            </p>
            <p className="text-[10px] text-[var(--ink-4)]">docs</p>
          </div>
          <div>
            <p className="text-sm font-semibold text-[var(--ink)] tabular-nums">{fmt(app.usage_count)}</p>
            <p className="text-[10px] text-[var(--ink-4)]">calls</p>
          </div>
          <div className="w-16">
            <p className="text-[11px] text-[var(--ink-3)]" title={fmtDateTime(app.last_used_at)}>
              {app.last_used_at ? timeAgo(app.last_used_at) : 'never'}
            </p>
            <p className="text-[10px] text-[var(--ink-4)]">last use</p>
          </div>
        </div>
      </div>

      {/* Drawer */}
      {expanded && (
        <div className="border-t border-[var(--line)] bg-[var(--base)]/40 px-3.5 py-3.5 space-y-4">
          {/* Toolbar: plan + actions */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] uppercase tracking-wide text-[var(--ink-4)]">Plan</span>
            <select
              value={app.plan}
              disabled={busy}
              onChange={(e) => changePlan(e.target.value)}
              className="bg-[var(--base)] border border-[var(--line)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--ink)] outline-none focus:border-[var(--accent)] disabled:opacity-40"
            >
              {plans.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </select>
            <span className="flex-1" />
            {app.widget_token && !app.revoked && (
              <a
                href={`/embed/chat?app=${app.widget_token}`}
                target="_blank"
                rel="noreferrer"
                className={`${actionBtn} border-[var(--line)] text-[var(--ink-2)] hover:bg-[var(--fill)]`}
              >
                Preview widget ↗
              </a>
            )}
            <button
              disabled={busy}
              onClick={toggleOwnerBlock}
              className={`${actionBtn} ${
                app.owner_api_blocked
                  ? 'border-emerald-400/40 text-emerald-400 hover:bg-emerald-400/10'
                  : 'border-orange-400/40 text-orange-400 hover:bg-orange-400/10'
              }`}
            >
              {app.owner_api_blocked ? 'Unblock owner' : 'Block owner API'}
            </button>
            {!app.revoked && (
              <button
                disabled={busy}
                onClick={() => setConfirm({ kind: 'revoke' })}
                className={`${actionBtn} border-amber-400/40 text-amber-400 hover:bg-amber-400/10`}
              >
                Revoke
              </button>
            )}
            <button
              disabled={busy}
              onClick={() => setConfirm({ kind: 'delete' })}
              className={`${actionBtn} border-red-400/40 text-red-400 hover:bg-red-400/10`}
            >
              Delete app
            </button>
          </div>

          {loading ? (
            <p className="text-xs text-[var(--ink-4)]">Loading…</p>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Documents */}
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--ink-4)] mb-2">
                  Documents ({docs?.documents.length ?? 0}/{limitLabel})
                </p>
                {!docs || docs.documents.length === 0 ? (
                  <p className="text-xs text-[var(--ink-4)]">No documents uploaded.</p>
                ) : (
                  <div className="space-y-1.5">
                    {docs.documents.map((d) => (
                      <div
                        key={d.id}
                        className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg border border-[var(--line)] bg-[var(--fill)]"
                      >
                        <svg className="w-4 h-4 flex-shrink-0 text-[var(--ink-4)]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.4a2 2 0 00-.6-1.4l-3.4-3.4a2 2 0 00-1.4-.6H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-[var(--ink)] truncate">{d.filename}</p>
                          <p className="text-[10px] text-[var(--ink-4)]">
                            {fmtBytes(d.file_size)} · {d.chunk_count} chunks · {fmtDateTime(d.uploaded_at)}
                          </p>
                        </div>
                        <button
                          disabled={busy}
                          onClick={() => setConfirm({ kind: 'doc', docId: d.id, filename: d.filename })}
                          className="text-[var(--ink-4)] hover:text-red-400 transition-colors flex-shrink-0 disabled:opacity-40"
                          title="Delete document"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.9 12a2 2 0 01-2 1.9H7.9a2 2 0 01-2-1.9L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Activity */}
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--ink-4)] mb-2">Activity</p>
                {!activity || activity.events.length === 0 ? (
                  <p className="text-xs text-[var(--ink-4)]">No activity yet.</p>
                ) : (
                  <ol className="space-y-2.5">
                    {activity.events.map((ev, i) => (
                      <li key={i} className="flex items-start gap-2.5">
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[var(--accent)] flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-[var(--ink-2)] truncate">{ev.label}</p>
                          {ev.detail && <p className="text-[10px] text-[var(--ink-4)]">{ev.detail}</p>}
                        </div>
                        <span className="text-[10px] text-[var(--ink-4)] flex-shrink-0" title={fmtDateTime(ev.at)}>
                          {ev.at ? timeAgo(ev.at) : ''}
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
                <div className="mt-3 pt-3 border-t border-[var(--line)] grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-sm font-semibold text-[var(--ink)] tabular-nums">{fmtBytes(app.total_size)}</p>
                    <p className="text-[10px] text-[var(--ink-4)]">storage</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[var(--ink)] tabular-nums">{fmt(app.usage_count)}</p>
                    <p className="text-[10px] text-[var(--ink-4)]">API calls</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[var(--ink)] tabular-nums">{fmt(app.total_tokens)}</p>
                    <p className="text-[10px] text-[var(--ink-4)]">tokens</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {confirm && (
        <ConfirmModal
          title={confirm.kind === 'doc' ? 'Delete document?' : confirm.kind === 'revoke' ? 'Revoke this key?' : 'Delete this app?'}
          message={
            confirm.kind === 'doc'
              ? `“${confirm.filename}” will be permanently removed from this app's knowledge base.`
              : confirm.kind === 'revoke'
                ? `Apps using ${app.prefix} stop working immediately. The row is kept for audit.`
                : `${app.name} (${app.prefix}) and all its documents will be permanently deleted.`
          }
          confirmLabel={confirm.kind === 'revoke' ? 'Revoke' : 'Delete'}
          danger
          onConfirm={() => {
            const c = confirm;
            setConfirm(null);
            if (c.kind === 'doc' && c.docId != null) deleteDoc(c.docId);
            else if (c.kind === 'revoke') doRevoke();
            else if (c.kind === 'delete') doDelete();
          }}
          onClose={() => setConfirm(null)}
        />
      )}
    </div>
  );
}

function AppsTab() {
  const [summary, setSummary] = useState<AdminAppsSummary | null>(null);
  const [apps, setApps] = useState<AdminApp[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [plan, setPlan] = useState('');
  const [status, setStatus] = useState<'all' | 'active' | 'revoked'>('all');
  const [sort, setSort] = useState<'recent' | 'usage' | 'docs' | 'created'>('recent');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadSummary = useCallback(() => {
    adminAppsSummary()
      .then(setSummary)
      .catch(() => {});
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    adminListApps({ q: query.trim(), plan, status, sort, limit: 300 })
      .then((r) => {
        setApps(r.apps);
        setTotal(r.total);
      })
      .catch((e) => toast.error(apiError(e, 'Could not load developer apps.')))
      .finally(() => setLoading(false));
  }, [query, plan, status, sort]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(load, 300);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [load]);

  const refresh = useCallback(() => {
    load();
    loadSummary();
  }, [load, loadSummary]);

  const patchApp = (next: AdminApp) => setApps((prev) => prev.map((a) => (a.id === next.id ? next : a)));
  const removeApp = (id: number) => setApps((prev) => prev.filter((a) => a.id !== id));

  const planOptions = (summary?.plans as AdminAppPlanCount[] | undefined)?.map((p) => ({ key: p.key, label: p.label })) ?? STATIC_PLANS;

  const exportCsv = () => {
    const header = ['owner_email', 'owner_name', 'app_name', 'prefix', 'plan', 'docs', 'doc_limit', 'size_bytes', 'api_calls', 'tokens', 'status', 'created_at', 'last_used_at'];
    const esc = (v: unknown) => {
      const s = String(v ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = apps.map((a) => [
      a.owner_email ?? '', a.owner_name ?? '', a.name, a.prefix, a.plan, a.doc_count, a.doc_limit,
      a.total_size, a.usage_count, a.total_tokens, a.revoked ? 'revoked' : 'active', a.created_at ?? '', a.last_used_at ?? '',
    ]);
    const csv = [header, ...rows].map((r) => r.map(esc).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `close-ai-developers-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${apps.length} app${apps.length === 1 ? '' : 's'}`);
  };

  return (
    <>
      <div className="mb-4">
        <h3 className={headingCls}>Developers</h3>
        <p className={subCls}>Every developer app (API key) and its knowledge base.</p>
      </div>

      {/* Summary KPIs */}
      {summary && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
            <KpiCard icon={APP_ICON.apps} label="Apps" value={fmt(summary.total_apps)} hint={`${summary.active_apps} active`} accent />
            <KpiCard icon={DASH_ICON.users} label="Developers" value={fmt(summary.developers)} />
            <KpiCard icon={APP_ICON.doc} label="Documents" value={fmt(summary.total_docs)} hint={fmtBytes(summary.total_size)} />
            <KpiCard icon={DASH_ICON.key} label="API calls" value={fmt(summary.api_calls)} />
          </div>
          {/* Plan breakdown */}
          <div className="flex flex-wrap gap-2 mb-5">
            {summary.plans.map((p) => (
              <span key={p.key} className={`text-[11px] font-medium rounded-full px-2.5 py-1 ${planPill(p.key)}`}>
                {p.label} · {p.count}
              </span>
            ))}
          </div>
        </>
      )}

      {/* Search */}
      <div className="relative mb-3">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--ink-4)]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="7" />
          <path strokeLinecap="round" d="M21 21l-4.3-4.3" />
        </svg>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by owner email, name, or app…"
          className="w-full bg-[var(--fill)] border border-[var(--line)] rounded-lg pl-9 pr-3 py-2.5 text-sm text-[var(--ink)] placeholder:text-[var(--ink-4)] outline-none focus:border-[var(--accent)] transition-colors"
        />
      </div>

      {/* Filters + export */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex gap-0.5 rounded-lg border border-[var(--line)] bg-[var(--base)] p-0.5">
          {(['all', 'active', 'revoked'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`px-2.5 py-1 rounded-md text-xs capitalize transition-colors ${
                status === s ? 'bg-[var(--fill-strong)] text-[var(--ink)]' : 'text-[var(--ink-3)] hover:text-[var(--ink)]'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <select
          value={plan}
          onChange={(e) => setPlan(e.target.value)}
          className="bg-[var(--base)] border border-[var(--line)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--ink)] outline-none focus:border-[var(--accent)]"
        >
          <option value="">All plans</option>
          {planOptions.map((p) => (
            <option key={p.key} value={p.key}>
              {p.label}
            </option>
          ))}
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as typeof sort)}
          className="bg-[var(--base)] border border-[var(--line)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--ink)] outline-none focus:border-[var(--accent)]"
        >
          <option value="recent">Newest</option>
          <option value="created">Oldest</option>
          <option value="usage">Most used</option>
          <option value="docs">Most docs</option>
        </select>
        <span className="flex-1" />
        <button
          onClick={exportCsv}
          disabled={apps.length === 0}
          className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-[var(--line)] text-[var(--ink-2)] hover:bg-[var(--fill)] transition-colors disabled:opacity-40"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v12m0 0l-4-4m4 4l4-4M4 20h16" />
          </svg>
          Export CSV
        </button>
      </div>

      {/* List */}
      {loading ? (
        <p className="text-xs text-[var(--ink-4)]">Loading apps…</p>
      ) : apps.length === 0 ? (
        <p className="text-sm text-[var(--ink-4)] py-8 text-center">No developer apps match.</p>
      ) : (
        <div className="space-y-2">
          {apps.map((a) => (
            <AppCard
              key={a.id}
              app={a}
              plans={planOptions}
              expanded={expandedId === a.id}
              onToggle={() => setExpandedId((id) => (id === a.id ? null : a.id))}
              onPatched={patchApp}
              onRemoved={removeApp}
              onRefresh={refresh}
            />
          ))}
          <p className="text-[11px] text-[var(--ink-4)] text-center pt-2">
            Showing {apps.length} of {total} app{total === 1 ? '' : 's'}
          </p>
        </div>
      )}
    </>
  );
}

// ── Plans ─────────────────────────────────────────────────────────────────────
const BLANK_PLAN: AdminPlanInput = {
  key: '', label: '', price: '₹0', doc_limit: 1, rate_limit: 20,
  blurb: '', features: [], highlighted: false, active: true,
};

const planInputCls =
  'bg-[var(--base)] border border-[var(--line)] rounded-lg px-3 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--ink-4)] outline-none focus:border-[var(--accent)] transition-colors w-full';
const planFieldLabel = 'text-[10px] font-medium uppercase tracking-wide text-[var(--ink-4)]';

function CheckIcon() {
  return (
    <svg className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function PlanEditorCard({
  plan, busy, isFirst, isLast, onSave, onDelete, onMove,
}: {
  plan: AdminPlan;
  busy: boolean;
  isFirst: boolean;
  isLast: boolean;
  onSave: (key: string, patch: AdminPlanPatch) => void;
  onDelete: (plan: AdminPlan) => void;
  onMove: (plan: AdminPlan, dir: -1 | 1) => void;
}) {
  const [label, setLabel] = useState(plan.label);
  const [price, setPrice] = useState(plan.price);
  const [docLimit, setDocLimit] = useState(String(plan.doc_limit));
  const [rateLimit, setRateLimit] = useState(String(plan.rate_limit));
  const [blurb, setBlurb] = useState(plan.blurb);
  const [features, setFeatures] = useState<string[]>(plan.features);
  const [highlighted, setHighlighted] = useState(plan.highlighted);
  const [active, setActive] = useState(plan.active);

  // Re-sync the draft whenever the saved plan changes (after save / reorder reload).
  useEffect(() => {
    setLabel(plan.label); setPrice(plan.price); setDocLimit(String(plan.doc_limit));
    setRateLimit(String(plan.rate_limit)); setBlurb(plan.blurb);
    setFeatures(plan.features); setHighlighted(plan.highlighted); setActive(plan.active);
  }, [plan]);

  const cleanFeatures = features.map((f) => f.trim()).filter(Boolean);
  const dirty =
    label !== plan.label ||
    price !== plan.price ||
    Number(docLimit || 0) !== plan.doc_limit ||
    Number(rateLimit || 0) !== plan.rate_limit ||
    blurb !== plan.blurb ||
    highlighted !== plan.highlighted ||
    active !== plan.active ||
    JSON.stringify(cleanFeatures) !== JSON.stringify(plan.features);

  const save = () =>
    onSave(plan.key, {
      label,
      price,
      doc_limit: Math.max(0, parseInt(docLimit || '0', 10) || 0),
      rate_limit: Math.max(1, parseInt(rateLimit || '1', 10) || 1),
      blurb,
      features: cleanFeatures,
      highlighted,
      active,
    });

  const iconBtn =
    'p-1.5 rounded-md border border-[var(--line)] text-[var(--ink-3)] hover:bg-[var(--fill)] hover:text-[var(--ink)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed';

  return (
    <div
      className={`rounded-2xl border p-4 ${
        highlighted
          ? 'border-[var(--accent)]/50 bg-gradient-to-br from-[var(--accent)]/10 to-transparent'
          : 'border-[var(--line)] bg-[var(--fill)]'
      } ${!active ? 'opacity-60' : ''}`}
    >
      {/* Header */}
      <div className="flex items-start gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="bg-transparent text-base font-semibold text-[var(--ink)] outline-none border-b border-transparent focus:border-[var(--accent)] max-w-[150px]"
            />
            <span className="text-[10px] font-mono text-[var(--ink-4)] bg-[var(--fill-strong)] rounded px-1.5 py-0.5">{plan.key}</span>
          </div>
          <p className="text-[11px] text-[var(--ink-4)] mt-1">
            {plan.app_count} app{plan.app_count === 1 ? '' : 's'} on this plan
          </p>
        </div>
        <button
          onClick={() => setHighlighted((h) => !h)}
          title="Mark as most popular"
          className={`p-1.5 rounded-md transition-colors ${highlighted ? 'text-amber-400' : 'text-[var(--ink-4)] hover:text-[var(--ink-2)]'}`}
        >
          <svg className="w-4 h-4" fill={highlighted ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.5l2.3 4.66 5.14.75-3.72 3.62.88 5.12L11.48 15.9 6.9 17.65l.88-5.12L4.05 8.9l5.14-.75 2.29-4.66z" />
          </svg>
        </button>
        <label className="flex items-center gap-1.5 text-[11px] text-[var(--ink-3)] cursor-pointer select-none mt-1">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="accent-[var(--accent)]" />
          Active
        </label>
      </div>

      {/* Price + limits */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div>
          <label className={planFieldLabel}>Price</label>
          <input value={price} onChange={(e) => setPrice(e.target.value)} className={planInputCls} placeholder="₹0" />
        </div>
        <div>
          <label className={planFieldLabel}>Doc limit</label>
          <input
            value={docLimit}
            onChange={(e) => setDocLimit(e.target.value.replace(/[^0-9]/g, ''))}
            className={planInputCls}
            inputMode="numeric"
            title="Use a large number (e.g. 100000) for unlimited"
          />
        </div>
        <div>
          <label className={planFieldLabel}>API / min</label>
          <input
            value={rateLimit}
            onChange={(e) => setRateLimit(e.target.value.replace(/[^0-9]/g, ''))}
            className={planInputCls}
            inputMode="numeric"
          />
        </div>
      </div>

      {/* Tagline */}
      <div className="mb-3">
        <label className={planFieldLabel}>Tagline</label>
        <input value={blurb} onChange={(e) => setBlurb(e.target.value)} className={planInputCls} placeholder="Short pricing-card description" />
      </div>

      {/* Services */}
      <div className="mb-3">
        <label className={planFieldLabel}>Services included</label>
        <div className="space-y-1.5 mt-1.5">
          {features.map((f, i) => (
            <div key={i} className="flex items-center gap-2">
              <CheckIcon />
              <input
                value={f}
                onChange={(e) => setFeatures((fs) => fs.map((x, j) => (j === i ? e.target.value : x)))}
                className={`${planInputCls} py-1.5`}
                placeholder="e.g. 10 knowledge-base documents"
              />
              <button
                onClick={() => setFeatures((fs) => fs.filter((_, j) => j !== i))}
                className="text-[var(--ink-4)] hover:text-red-400 transition-colors flex-shrink-0"
                title="Remove service"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          ))}
          <button onClick={() => setFeatures((fs) => [...fs, ''])} className="text-xs font-medium text-[var(--accent-fg)] hover:underline">
            + Add service
          </button>
        </div>
      </div>

      {/* Footer actions */}
      <div className="flex items-center gap-1.5 pt-3 border-t border-[var(--line)]">
        <button disabled={busy || isFirst} onClick={() => onMove(plan, -1)} title="Move up" className={iconBtn}>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" /></svg>
        </button>
        <button disabled={busy || isLast} onClick={() => onMove(plan, 1)} title="Move down" className={iconBtn}>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
        </button>
        <span className="flex-1" />
        <button
          disabled={busy || plan.key === 'free'}
          onClick={() => onDelete(plan)}
          title={plan.key === 'free' ? 'The Free plan is the default tier and cannot be deleted' : 'Delete plan'}
          className="text-xs font-medium px-2.5 py-1.5 rounded-lg border border-red-400/40 text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Delete
        </button>
        <button
          disabled={busy || !dirty}
          onClick={save}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-[var(--accent)] text-white hover:opacity-90 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {dirty ? 'Save changes' : 'Saved'}
        </button>
      </div>
    </div>
  );
}

function PlansTab() {
  const [plans, setPlans] = useState<AdminPlan[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<AdminPlan | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<AdminPlanInput>(BLANK_PLAN);

  const load = useCallback(() => {
    adminListPlans()
      .then(setPlans)
      .catch((e) => toast.error(apiError(e, 'Could not load plans.')));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (key: string, patch: AdminPlanPatch) => {
    setBusy(true);
    try {
      const updated = await adminUpdatePlan(key, patch);
      setPlans((ps) => (ps ? ps.map((p) => (p.key === key ? updated : p)) : ps));
      toast.success(`${updated.label} saved`);
    } catch (e) {
      toast.error(apiError(e, 'Could not save plan.'));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (plan: AdminPlan) => {
    setBusy(true);
    try {
      await adminDeletePlan(plan.key);
      setPlans((ps) => (ps ? ps.filter((p) => p.key !== plan.key) : ps));
      toast.success(`${plan.label} plan deleted`);
    } catch (e) {
      toast.error(apiError(e, 'Could not delete plan.'));
    } finally {
      setBusy(false);
    }
  };

  const move = async (plan: AdminPlan, dir: -1 | 1) => {
    if (!plans) return;
    const idx = plans.findIndex((p) => p.key === plan.key);
    const swap = idx + dir;
    if (swap < 0 || swap >= plans.length) return;
    const other = plans[swap];
    setBusy(true);
    try {
      await Promise.all([
        adminUpdatePlan(plan.key, { sort_order: other.sort_order }),
        adminUpdatePlan(other.key, { sort_order: plan.sort_order }),
      ]);
      load();
    } catch (e) {
      toast.error(apiError(e, 'Could not reorder plans.'));
    } finally {
      setBusy(false);
    }
  };

  const create = async () => {
    if (!draft.key.trim() || !draft.label.trim()) {
      toast.error('Plan key and name are required.');
      return;
    }
    setBusy(true);
    try {
      const created = await adminCreatePlan({ ...draft, features: draft.features.map((f) => f.trim()).filter(Boolean) });
      setPlans((ps) => (ps ? [...ps, created] : [created]));
      setAdding(false);
      setDraft(BLANK_PLAN);
      toast.success(`${created.label} plan created`);
    } catch (e) {
      toast.error(apiError(e, 'Could not create plan.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className={headingCls}>Plans</h3>
          <p className={subCls}>Set each tier&apos;s price and the services it provides. Doc limits &amp; API rate limits are enforced live.</p>
        </div>
        {!adding && (
          <button
            onClick={() => { setDraft(BLANK_PLAN); setAdding(true); }}
            className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg bg-[var(--accent)] text-white hover:opacity-90 transition-opacity flex-shrink-0"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m7-7H5" /></svg>
            New plan
          </button>
        )}
      </div>

      {/* New-plan form */}
      {adding && (
        <div className="rounded-2xl border border-[var(--accent)]/40 bg-[var(--fill)] p-4 mb-4">
          <p className="text-sm font-semibold text-[var(--ink)] mb-3">New plan</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-3">
            <div>
              <label className={planFieldLabel}>Key (id)</label>
              <input value={draft.key} onChange={(e) => setDraft((d) => ({ ...d, key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') }))} className={planInputCls} placeholder="team" />
            </div>
            <div>
              <label className={planFieldLabel}>Name</label>
              <input value={draft.label} onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))} className={planInputCls} placeholder="Team" />
            </div>
            <div>
              <label className={planFieldLabel}>Price</label>
              <input value={draft.price} onChange={(e) => setDraft((d) => ({ ...d, price: e.target.value }))} className={planInputCls} placeholder="₹2,999/mo" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={planFieldLabel}>Docs</label>
                <input value={String(draft.doc_limit)} onChange={(e) => setDraft((d) => ({ ...d, doc_limit: parseInt(e.target.value.replace(/[^0-9]/g, '') || '0', 10) }))} className={planInputCls} inputMode="numeric" />
              </div>
              <div>
                <label className={planFieldLabel}>API/min</label>
                <input value={String(draft.rate_limit)} onChange={(e) => setDraft((d) => ({ ...d, rate_limit: parseInt(e.target.value.replace(/[^0-9]/g, '') || '0', 10) }))} className={planInputCls} inputMode="numeric" />
              </div>
            </div>
          </div>
          <div className="mb-3">
            <label className={planFieldLabel}>Tagline</label>
            <input value={draft.blurb} onChange={(e) => setDraft((d) => ({ ...d, blurb: e.target.value }))} className={planInputCls} placeholder="Short pricing-card description" />
          </div>
          <div className="flex items-center justify-end gap-2">
            <button onClick={() => { setAdding(false); setDraft(BLANK_PLAN); }} className="text-sm font-medium text-[var(--ink-3)] hover:text-[var(--ink)] px-3 py-2 rounded-lg hover:bg-[var(--fill-strong)] transition-colors">Cancel</button>
            <button disabled={busy} onClick={create} className="text-sm font-semibold px-4 py-2 rounded-lg bg-[var(--accent)] text-white hover:opacity-90 transition-opacity disabled:opacity-40">Create plan</button>
          </div>
          <p className="text-[11px] text-[var(--ink-4)] mt-2">You can add the list of services after creating, in the plan card.</p>
        </div>
      )}

      {/* Plan cards */}
      {plans === null ? (
        <p className="text-xs text-[var(--ink-4)]">Loading plans…</p>
      ) : plans.length === 0 ? (
        <p className="text-sm text-[var(--ink-4)] py-8 text-center">No plans yet — create one.</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {plans.map((p, i) => (
            <PlanEditorCard
              key={p.key}
              plan={p}
              busy={busy}
              isFirst={i === 0}
              isLast={i === plans.length - 1}
              onSave={save}
              onDelete={(pl) => setConfirm(pl)}
              onMove={move}
            />
          ))}
        </div>
      )}

      {confirm && (
        <ConfirmModal
          title={`Delete the ${confirm.label} plan?`}
          message={
            confirm.app_count > 0
              ? `${confirm.app_count} app(s) are on this plan — you'll need to move them first, so this will be blocked.`
              : `The ${confirm.label} plan will be permanently removed from pricing and plan options.`
          }
          confirmLabel="Delete"
          danger
          onConfirm={() => {
            const p = confirm;
            setConfirm(null);
            remove(p);
          }}
          onClose={() => setConfirm(null)}
        />
      )}
    </>
  );
}

// ── Code Reviews (super-admin moderates dev-submitted widget CSS) ──────────────
function CodeReviewsTab() {
  const [reviews, setReviews] = useState<AdminCssReview[] | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [note, setNote] = useState('');

  const load = useCallback(() => {
    adminListCssReviews()
      .then((r) => setReviews(r.reviews))
      .catch((e) => toast.error(apiError(e, 'Could not load code reviews.')));
  }, []);

  useEffect(() => { load(); }, [load]);

  const approve = async (r: AdminCssReview) => {
    setBusyId(r.key_id);
    try {
      await adminApproveCss(r.key_id);
      setReviews((rs) => (rs ? rs.filter((x) => x.key_id !== r.key_id) : rs));
      toast.success(`Approved — now live on “${r.app_name}”`);
    } catch (e) {
      toast.error(apiError(e, 'Could not approve.'));
    } finally {
      setBusyId(null);
    }
  };

  const reject = async (r: AdminCssReview) => {
    setBusyId(r.key_id);
    try {
      await adminRejectCss(r.key_id, note.trim());
      setReviews((rs) => (rs ? rs.filter((x) => x.key_id !== r.key_id) : rs));
      setRejectingId(null);
      setNote('');
      toast.success('Rejected — developer notified.');
    } catch (e) {
      toast.error(apiError(e, 'Could not reject.'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <div className="mb-4">
        <h3 className={headingCls}>Code Reviews</h3>
        <p className={subCls}>Developer-submitted widget CSS awaiting approval. Approved code goes live on their site; the live widget is untouched until then.</p>
      </div>

      {reviews === null ? (
        <p className="text-xs text-[var(--ink-4)]">Loading…</p>
      ) : reviews.length === 0 ? (
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--fill)] py-12 text-center">
          <svg className="w-8 h-8 mx-auto text-emerald-400/70 mb-2" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <p className="text-sm text-[var(--ink-3)]">All clear — no pending code reviews.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => (
            <div key={r.key_id} className="rounded-xl border border-[var(--line)] bg-[var(--fill)] overflow-hidden">
              <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 border-b border-[var(--line)]">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--ink)] truncate">{r.app_name}</p>
                  <p className="text-[11px] text-[var(--ink-4)] truncate">
                    {r.owner_email ?? 'unknown'} · <span className="font-mono">{r.prefix}</span>
                    {r.submitted_at ? <span title={fmtDateTime(r.submitted_at)}> · {timeAgo(r.submitted_at)}</span> : null}
                  </p>
                </div>
                <Badge tone="api">Pending</Badge>
              </div>

              <pre className="text-[11px] font-mono text-[var(--ink-2)] bg-[var(--base)] px-3.5 py-3 overflow-x-auto max-h-56 whitespace-pre-wrap">{r.pending_css || '(empty)'}</pre>

              {rejectingId === r.key_id ? (
                <div className="px-3.5 py-3 border-t border-[var(--line)] space-y-2">
                  <input
                    autoFocus
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Reason for rejection (shown to the developer)"
                    className="w-full bg-[var(--base)] border border-[var(--line)] rounded-lg px-3 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--ink-4)] outline-none focus:border-[var(--accent)]"
                  />
                  <div className="flex items-center gap-2">
                    <button disabled={busyId === r.key_id} onClick={() => reject(r)} className="text-xs font-medium px-3 py-1.5 rounded-lg border border-red-400/40 text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-40">
                      Confirm reject
                    </button>
                    <button onClick={() => { setRejectingId(null); setNote(''); }} className="text-xs text-[var(--ink-4)] hover:text-[var(--ink)]">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-3.5 py-3 border-t border-[var(--line)]">
                  <button
                    disabled={busyId === r.key_id}
                    onClick={() => approve(r)}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-500/90 text-white hover:bg-emerald-500 transition-colors disabled:opacity-40"
                  >
                    Approve &amp; publish
                  </button>
                  <button
                    disabled={busyId === r.key_id}
                    onClick={() => { setRejectingId(r.key_id); setNote(''); }}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg border border-red-400/40 text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-40"
                  >
                    Reject
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function FeaturesTab() {
  const { refresh } = useFeatures();
  const [map, setMap] = useState<FeatureMap>({});
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  useEffect(() => {
    adminGetFeatures()
      .then(setMap)
      .catch((e) => toast.error(apiError(e, 'Could not load features.')))
      .finally(() => setLoading(false));
  }, []);

  const toggle = async (key: string, next: boolean) => {
    setBusyKey(key);
    // Optimistic.
    setMap((m) => ({ ...m, [key]: next }));
    try {
      const updated = await adminSetFeatures({ [key]: next });
      setMap(updated);
      // Sync this admin's own app gating immediately.
      await refresh();
      toast.success(next ? 'Feature enabled' : 'Feature disabled');
    } catch (e) {
      setMap((m) => ({ ...m, [key]: !next })); // revert
      toast.error(apiError(e, 'Could not update feature.'));
    } finally {
      setBusyKey(null);
    }
  };

  const enabledCount = Object.values(map).filter(Boolean).length;
  const total = Object.keys(map).length;

  return (
    <>
      <div className="mb-5">
        <h3 className={headingCls}>Features</h3>
        <p className={subCls}>
          Turn capabilities on or off for everyone. A disabled feature disappears from the UI for all
          users.{' '}
          {!loading && total > 0 && (
            <span className="text-[var(--ink-4)]">
              {enabledCount}/{total} enabled.
            </span>
          )}
        </p>
      </div>

      {loading ? (
        <p className="text-xs text-[var(--ink-4)]">Loading features…</p>
      ) : (
        <div className="space-y-6">
          {FEATURE_GROUPS.map((g) => (
            <div key={g.group}>
              <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--ink-4)] mb-2">
                {g.group}
              </p>
              <div className="rounded-xl border border-[var(--line)] bg-[var(--fill)] divide-y divide-[var(--line)]">
                {g.items.map((f) => {
                  const on = map[f.key] !== false;
                  return (
                    <div key={f.key} className="flex items-center gap-4 px-3.5 py-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[var(--ink)]">{f.label}</p>
                        <p className="text-xs text-[var(--ink-3)] mt-0.5">{f.desc}</p>
                      </div>
                      <Toggle on={on} busy={busyKey === f.key} onClick={() => toggle(f.key, !on)} />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ── Audit log ─────────────────────────────────────────────────────────────────
const ACTION_LABEL: Record<string, string> = {
  'user.verify': 'verified',
  'user.unverify': 'un-verified',
  'user.promote': 'promoted to admin',
  'user.demote': 'demoted',
  'user.ban': 'banned',
  'user.unban': 'unbanned',
  'user.delete': 'deleted',
  'features.update': 'updated feature flags',
  'apikey.revoke': 'revoked an API key of',
  'apikey.delete': 'deleted an API key of',
  'apikey.block_user': 'blocked API access for',
  'apikey.unblock_user': 'unblocked API access for',
  'broadcast.create': 'published an announcement',
  'broadcast.activate': 'activated an announcement',
  'broadcast.deactivate': 'deactivated an announcement',
  'broadcast.delete': 'deleted an announcement',
  'invite.create': 'sent an invite',
  'invite.revoke': 'revoked an invite',
  'webhook.create': 'created a webhook',
  'webhook.update': 'updated a webhook',
  'webhook.enable': 'enabled a webhook',
  'webhook.disable': 'disabled a webhook',
  'webhook.delete': 'deleted a webhook',
};

function AuditTab() {
  const [entries, setEntries] = useState<AdminAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminAuditLog(100)
      .then(setEntries)
      .catch((e) => toast.error(apiError(e, 'Could not load audit log.')))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <div className="mb-5">
        <h3 className={headingCls}>Audit log</h3>
        <p className={subCls}>Every privileged action, newest first.</p>
      </div>

      {loading ? (
        <p className="text-xs text-[var(--ink-4)]">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="text-xs text-[var(--ink-4)]">No admin actions recorded yet.</p>
      ) : (
        <div className="space-y-1.5">
          {entries.map((e) => (
            <div
              key={e.id}
              className="flex items-start gap-3 px-3.5 py-2.5 rounded-xl border border-[var(--line)] bg-[var(--fill)]"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[var(--ink-2)] break-words">
                  <span className="font-medium text-[var(--ink)]">{e.actor_email}</span>{' '}
                  {ACTION_LABEL[e.action] ?? e.action}
                  {e.target_email && (
                    <>
                      {' '}
                      <span className="font-medium text-[var(--ink)]">{e.target_email}</span>
                    </>
                  )}
                </p>
                {e.detail && <p className="text-[11px] text-[var(--ink-4)] mt-0.5">{e.detail}</p>}
              </div>
              <span className="flex-shrink-0 text-[11px] text-[var(--ink-4)]" title={timeAgo(e.created_at)}>
                {fmtDateTime(e.created_at)}
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ── Broadcast ───────────────────────────────────────────────────────────────
const BROADCAST_LEVELS: { value: BroadcastLevel; label: string; dot: string }[] = [
  { value: 'info', label: 'Info', dot: 'bg-[var(--accent)]' },
  { value: 'warning', label: 'Warning', dot: 'bg-amber-400' },
  { value: 'success', label: 'Success', dot: 'bg-emerald-400' },
];
const levelDot = (lvl: string) =>
  lvl === 'warning' ? 'bg-amber-400' : lvl === 'success' ? 'bg-emerald-400' : 'bg-[var(--accent)]';

function BroadcastTab() {
  const [list, setList] = useState<AdminBroadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [level, setLevel] = useState<BroadcastLevel>('info');
  const [posting, setPosting] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [confirmDel, setConfirmDel] = useState<AdminBroadcast | null>(null);
  // Email-all-users options for the composer.
  const [subject, setSubject] = useState('');
  const [emailUsers, setEmailUsers] = useState(false);
  const [audience, setAudience] = useState<number | null>(null);
  const [confirmEmail, setConfirmEmail] = useState(false);

  // Fetch the recipient count the first time "email all" is switched on.
  useEffect(() => {
    if (emailUsers && audience === null) {
      announcementAudience().then(setAudience).catch(() => setAudience(null));
    }
  }, [emailUsers, audience]);

  const load = useCallback(() => {
    setLoading(true);
    adminListBroadcasts()
      .then(setList)
      .catch((e) => toast.error(apiError(e, 'Could not load broadcasts.')))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const refresh = useCallback(async () => {
    try { setList(await adminListBroadcasts()); } catch { /* keep last-known */ }
  }, []);

  const post = async () => {
    const msg = message.trim();
    if (!msg) { toast.error('Enter a message to announce.'); return; }
    setPosting(true);
    try {
      const res = await adminCreateBroadcast(msg, level, {
        subject: subject.trim() || undefined,
        emailUsers,
      });
      setMessage('');
      setSubject('');
      const emailed = res.emailed ?? 0;
      toast.success(
        emailed > 0
          ? `Published — banner live + emailing ${emailed} user${emailed === 1 ? '' : 's'}.`
          : 'Announcement published — users see it on next load.'
      );
      await refresh();
    } catch (e) { toast.error(apiError(e, 'Could not publish.')); }
    finally { setPosting(false); }
  };

  // Emailing everyone is a one-way action — confirm first. Banner-only publishes immediately.
  const requestPublish = () => {
    if (!message.trim()) { toast.error('Enter a message to announce.'); return; }
    if (emailUsers) { setConfirmEmail(true); return; }
    post();
  };

  const toggleActive = async (b: AdminBroadcast) => {
    setBusyId(b.id);
    try { await adminSetBroadcastActive(b.id, !b.active); await refresh(); }
    catch (e) { toast.error(apiError(e, 'Could not update the announcement.')); }
    finally { setBusyId(null); }
  };

  const del = async (b: AdminBroadcast) => {
    setBusyId(b.id);
    try {
      await adminDeleteBroadcast(b.id);
      setList((prev) => prev.filter((x) => x.id !== b.id));
      toast.success('Announcement deleted');
    } catch (e) { toast.error(apiError(e, 'Could not delete.')); }
    finally { setBusyId(null); }
  };

  const active = list.find((b) => b.active) || null;

  return (
    <>
      <div className="mb-5">
        <h3 className={headingCls}>Announcements</h3>
        <p className={subCls}>Post an in-app banner to every user — and optionally email it to them too.</p>
      </div>

      {/* Compose */}
      <div className="rounded-2xl border border-[var(--line)] bg-[var(--fill)] p-4 mb-5">
        {emailUsers && (
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value.slice(0, 120))}
            placeholder="Email subject — defaults to “Announcement from Close AI”"
            className="w-full mb-2 bg-[var(--base)] border border-[var(--line)] rounded-xl px-3 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--ink-4)] outline-none focus:border-[var(--accent)] transition-colors"
          />
        )}
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, 500))}
          rows={2}
          placeholder="e.g. Scheduled maintenance tonight 10–11pm IST — chats may be briefly unavailable."
          className="w-full bg-[var(--base)] border border-[var(--line)] rounded-xl px-3 py-2.5 text-sm text-[var(--ink)] placeholder:text-[var(--ink-4)] outline-none focus:border-[var(--accent)] transition-colors resize-none"
        />
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <div className="flex gap-0.5 rounded-lg border border-[var(--line)] bg-[var(--base)] p-0.5">
            {BROADCAST_LEVELS.map((l) => (
              <button
                key={l.value}
                onClick={() => setLevel(l.value)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition-colors ${
                  level === l.value ? 'bg-[var(--fill-strong)] text-[var(--ink)]' : 'text-[var(--ink-3)] hover:text-[var(--ink)]'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${l.dot}`} />
                {l.label}
              </button>
            ))}
          </div>
          <span className="text-[11px] text-[var(--ink-4)]">{message.length}/500</span>
          <button
            onClick={requestPublish}
            disabled={posting || !message.trim()}
            className="ml-auto inline-flex items-center gap-1.5 text-sm font-medium rounded-lg bg-[var(--accent)] text-white px-4 py-1.5 hover:bg-[var(--accent-strong)] transition-colors disabled:opacity-50"
          >
            {posting ? 'Publishing…' : emailUsers ? 'Publish & email' : 'Publish'}
          </button>
        </div>

        {/* Also-email-all-users toggle */}
        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-[var(--line)]">
          <Toggle on={emailUsers} busy={false} onClick={() => setEmailUsers((v) => !v)} />
          <div className="min-w-0">
            <p className="text-sm text-[var(--ink-2)]">Also email all users</p>
            <p className="text-[11px] text-[var(--ink-4)]">
              {emailUsers
                ? audience === null
                  ? 'Counting recipients…'
                  : `Sends a branded email to ${audience} verified user${audience === 1 ? '' : 's'}.`
                : 'Off — shows the in-app banner only.'}
            </p>
          </div>
        </div>

        {active && (
          <p className="mt-3 text-[11px] text-[var(--ink-4)]">
            Live now: <span className="text-[var(--ink-2)]">{active.message}</span>
          </p>
        )}
      </div>

      <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--ink-4)] mb-2">History</p>
      {loading ? (
        <p className="text-xs text-[var(--ink-4)]">Loading…</p>
      ) : list.length === 0 ? (
        <p className="text-xs text-[var(--ink-4)]">No announcements yet.</p>
      ) : (
        <div className="space-y-2">
          {list.map((b) => (
            <div key={b.id} className="flex items-start gap-3 px-3.5 py-3 rounded-xl border border-[var(--line)] bg-[var(--fill)]">
              <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${levelDot(b.level)}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm text-[var(--ink)] break-words">{b.message}</p>
                  {b.active && (
                    <span className="flex-shrink-0 text-[10px] font-semibold uppercase tracking-wide text-emerald-400 bg-emerald-400/10 rounded-full px-2 py-0.5">
                      Live
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-[var(--ink-4)] mt-0.5" title={timeAgo(b.created_at)}>
                  {b.created_by ? `${b.created_by} · ` : ''}{fmtDateTime(b.created_at)}
                </p>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  disabled={busyId === b.id}
                  onClick={() => toggleActive(b)}
                  className="text-xs font-medium px-2.5 py-1 rounded-lg border border-[var(--line)] text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--fill-strong)] transition-colors disabled:opacity-40"
                >
                  {b.active ? 'Deactivate' : 'Activate'}
                </button>
                <button
                  disabled={busyId === b.id}
                  onClick={() => setConfirmDel(b)}
                  className="text-xs font-medium px-2.5 py-1 rounded-lg border border-red-400/40 text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-40"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {confirmEmail && (
        <ConfirmModal
          title="Email all users?"
          message={`This publishes the banner and emails ${audience ?? 'all'} verified user${audience === 1 ? '' : 's'} a branded announcement. Emails can't be unsent.`}
          confirmLabel="Publish & email"
          onConfirm={() => { setConfirmEmail(false); post(); }}
          onClose={() => setConfirmEmail(false)}
        />
      )}

      {confirmDel && (
        <ConfirmModal
          title="Delete announcement"
          message={`Delete this announcement? "${confirmDel.message.slice(0, 80)}${confirmDel.message.length > 80 ? '…' : ''}"`}
          confirmLabel="Delete"
          danger
          onConfirm={() => { del(confirmDel); setConfirmDel(null); }}
          onClose={() => setConfirmDel(null)}
        />
      )}
    </>
  );
}

// ── Invites ─────────────────────────────────────────────────────────────────
function InvitesTab() {
  const [list, setList] = useState<AdminInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [confirmDel, setConfirmDel] = useState<AdminInvite | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    adminListInvites()
      .then(setList)
      .catch((e) => toast.error(apiError(e, 'Could not load invites.')))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const refresh = useCallback(async () => {
    try { setList(await adminListInvites()); } catch { /* keep */ }
  }, []);

  const copy = (inv: AdminInvite) =>
    navigator.clipboard?.writeText(inv.link).then(() => toast.success('Invite link copied')).catch(() => {});

  const send = async () => {
    const e = email.trim();
    if (!e) { toast.error('Enter an email to invite.'); return; }
    setSending(true);
    try {
      const inv = await adminCreateInvite(e);
      setEmail('');
      toast.success(`Invite created for ${inv.email}`);
      copy(inv);
      await refresh();
    } catch (err) { toast.error(apiError(err, 'Could not create invite.')); }
    finally { setSending(false); }
  };

  const revoke = async (inv: AdminInvite) => {
    setBusyId(inv.id);
    try {
      await adminDeleteInvite(inv.id);
      setList((prev) => prev.filter((x) => x.id !== inv.id));
      toast.success('Invite revoked');
    } catch (e) { toast.error(apiError(e, 'Could not revoke invite.')); }
    finally { setBusyId(null); }
  };

  const statusBadge = (inv: AdminInvite) => {
    if (inv.accepted) return <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-400 bg-emerald-400/10 rounded-full px-2 py-0.5">Accepted</span>;
    if (inv.expired) return <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--ink-4)] bg-[var(--fill-strong)] rounded-full px-2 py-0.5">Expired</span>;
    return <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-400 bg-amber-400/10 rounded-full px-2 py-0.5">Pending</span>;
  };

  return (
    <>
      <div className="mb-5">
        <h3 className={headingCls}>Invites</h3>
        <p className={subCls}>Invite people by email — they set a password and skip verification.</p>
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); send(); }}
        className="flex flex-col sm:flex-row gap-2 mb-5"
      >
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="person@company.com"
          className="flex-1 bg-[var(--fill)] border border-[var(--line)] rounded-lg px-3 py-2.5 text-sm text-[var(--ink)] placeholder:text-[var(--ink-4)] outline-none focus:border-[var(--accent)] transition-colors"
        />
        <button
          type="submit"
          disabled={sending || !email.trim()}
          className="inline-flex items-center justify-center gap-1.5 text-sm font-medium rounded-lg bg-[var(--accent)] text-white px-4 py-2.5 hover:bg-[var(--accent-strong)] transition-colors disabled:opacity-50"
        >
          {sending ? 'Creating…' : 'Send invite'}
        </button>
      </form>

      {loading ? (
        <p className="text-xs text-[var(--ink-4)]">Loading…</p>
      ) : list.length === 0 ? (
        <p className="text-xs text-[var(--ink-4)]">No invites yet. Invite someone above.</p>
      ) : (
        <div className="space-y-2">
          {list.map((inv) => (
            <div key={inv.id} className="flex items-center gap-3 px-3.5 py-3 rounded-xl border border-[var(--line)] bg-[var(--fill)]">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium text-[var(--ink)] truncate">{inv.email}</p>
                  {statusBadge(inv)}
                </div>
                <p className="text-[11px] text-[var(--ink-4)] mt-0.5" title={timeAgo(inv.created_at)}>
                  {inv.invited_by ? `by ${inv.invited_by} · ` : ''}sent {fmtDateTime(inv.created_at)}
                </p>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {!inv.accepted && !inv.expired && (
                  <button
                    onClick={() => copy(inv)}
                    className="text-xs font-medium px-2.5 py-1 rounded-lg border border-[var(--line)] text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--fill-strong)] transition-colors"
                  >
                    Copy link
                  </button>
                )}
                <button
                  disabled={busyId === inv.id}
                  onClick={() => setConfirmDel(inv)}
                  className="text-xs font-medium px-2.5 py-1 rounded-lg border border-red-400/40 text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-40"
                >
                  {inv.accepted ? 'Remove' : 'Revoke'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {confirmDel && (
        <ConfirmModal
          title={confirmDel.accepted ? 'Remove invite' : 'Revoke invite'}
          message={
            confirmDel.accepted
              ? `Remove the accepted invite record for ${confirmDel.email}? Their account is unaffected.`
              : `Revoke the invite for ${confirmDel.email}? Their link will stop working.`
          }
          confirmLabel={confirmDel.accepted ? 'Remove' : 'Revoke'}
          danger
          onConfirm={() => { revoke(confirmDel); setConfirmDel(null); }}
          onClose={() => setConfirmDel(null)}
        />
      )}
    </>
  );
}

// ── Webhooks ────────────────────────────────────────────────────────────────
const EVENT_LABEL: Record<string, string> = {
  'user.signup': 'User signs up',
  'user.deleted': 'User deleted',
  'apikey.created': 'API key created',
  'broadcast.published': 'Broadcast published',
};

function WebhooksTab() {
  const [hooks, setHooks] = useState<AdminWebhook[]>([]);
  const [events, setEvents] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [url, setUrl] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<AdminWebhook | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingEvents, setEditingEvents] = useState<string[]>([]);

  const load = useCallback(() => {
    setLoading(true);
    adminListWebhooks()
      .then(({ webhooks, events }) => { setHooks(webhooks); setEvents(events); })
      .catch((e) => toast.error(apiError(e, 'Could not load webhooks.')))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const refresh = useCallback(async () => {
    try { const r = await adminListWebhooks(); setHooks(r.webhooks); setEvents(r.events); } catch { /* keep */ }
  }, []);

  const toggleEvent = (e: string) =>
    setSelected((prev) => (prev.includes(e) ? prev.filter((x) => x !== e) : [...prev, e]));

  const create = async () => {
    const u = url.trim();
    if (!/^https?:\/\//i.test(u)) { toast.error('URL must start with http:// or https://'); return; }
    if (selected.length === 0) { toast.error('Select at least one event.'); return; }
    setCreating(true);
    try {
      const wh = await adminCreateWebhook(u, selected);
      setUrl('');
      setSelected([]);
      if (wh.secret) setNewSecret(wh.secret);
      toast.success('Webhook created');
      await refresh();
    } catch (e) { toast.error(apiError(e, 'Could not create webhook.')); }
    finally { setCreating(false); }
  };

  const toggleEnabled = async (h: AdminWebhook) => {
    setBusyId(h.id);
    try { await adminUpdateWebhook(h.id, { enabled: !h.enabled }); await refresh(); }
    catch (e) { toast.error(apiError(e, 'Could not update webhook.')); }
    finally { setBusyId(null); }
  };

  const test = async (h: AdminWebhook) => {
    setBusyId(h.id);
    try {
      const status = await adminTestWebhook(h.id);
      const ok = /^2\d\d$/.test(status);
      (ok ? toast.success : toast.error)(`Test delivered — status: ${status}`);
      await refresh();
    } catch (e) { toast.error(apiError(e, 'Test failed.')); }
    finally { setBusyId(null); }
  };

  const del = async (h: AdminWebhook) => {
    setBusyId(h.id);
    try {
      await adminDeleteWebhook(h.id);
      setHooks((prev) => prev.filter((x) => x.id !== h.id));
      toast.success('Webhook deleted');
    } catch (e) { toast.error(apiError(e, 'Could not delete webhook.')); }
    finally { setBusyId(null); }
  };

  const saveEvents = async () => {
    if (editingId === null) return;
    setBusyId(editingId);
    try {
      await adminUpdateWebhook(editingId, { events: editingEvents });
      setHooks((prev) => prev.map((h) => h.id === editingId ? { ...h, events: editingEvents } : h));
      setEditingId(null);
      toast.success('Webhook events updated');
    } catch (e) { toast.error(apiError(e, 'Could not update webhook.')); }
    finally { setBusyId(null); }
  };

  const statusTone = (s: string | null) => {
    if (!s) return 'text-[var(--ink-4)]';
    if (/^2\d\d$/.test(s)) return 'text-emerald-400';
    return 'text-red-400';
  };

  return (
    <>
      <div className="mb-5">
        <h3 className={headingCls}>Webhooks</h3>
        <p className={subCls}>POST signed JSON to your systems when a platform event fires.</p>
      </div>

      {/* Create */}
      <div className="rounded-2xl border border-[var(--line)] bg-[var(--fill)] p-4 mb-5">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://your-app.com/webhooks/close-ai"
          className="w-full bg-[var(--base)] border border-[var(--line)] rounded-xl px-3 py-2.5 text-sm text-[var(--ink)] placeholder:text-[var(--ink-4)] outline-none focus:border-[var(--accent)] transition-colors"
        />
        <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--ink-4)] mt-3 mb-2">Events</p>
        <div className="flex flex-wrap gap-1.5">
          {events.map((e) => {
            const on = selected.includes(e);
            return (
              <button
                key={e}
                onClick={() => toggleEvent(e)}
                className={`text-xs font-medium px-2.5 py-1 rounded-lg border transition-colors ${
                  on ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent-fg)]' : 'border-[var(--line)] text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--fill-strong)]'
                }`}
              >
                {EVENT_LABEL[e] ?? e}
              </button>
            );
          })}
        </div>
        <div className="flex justify-end mt-3">
          <button
            onClick={create}
            disabled={creating || !url.trim() || selected.length === 0}
            className="inline-flex items-center gap-1.5 text-sm font-medium rounded-lg bg-[var(--accent)] text-white px-4 py-1.5 hover:bg-[var(--accent-strong)] transition-colors disabled:opacity-50"
          >
            {creating ? 'Creating…' : 'Create webhook'}
          </button>
        </div>
      </div>

      {/* One-time secret reveal */}
      {newSecret && (
        <div className="rounded-xl border border-[var(--accent)]/40 bg-[var(--accent)]/5 p-3.5 mb-5">
          <p className="text-xs font-medium text-[var(--ink)] mb-1">Signing secret — copy it now (shown once)</p>
          <p className="text-[11px] text-[var(--ink-3)] mb-2">
            Verify each delivery with the <span className="font-mono">X-CloseAI-Signature</span> header (HMAC-SHA256 of the body).
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 min-w-0 truncate text-xs font-mono text-[var(--ink-2)] bg-[var(--base)] rounded-lg px-2.5 py-1.5 border border-[var(--line)]">{newSecret}</code>
            <button
              onClick={() => { navigator.clipboard?.writeText(newSecret).then(() => toast.success('Secret copied')).catch(() => {}); }}
              className="text-xs font-medium px-2.5 py-1.5 rounded-lg border border-[var(--line)] text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--fill-strong)] transition-colors"
            >
              Copy
            </button>
            <button
              onClick={() => setNewSecret(null)}
              className="text-xs font-medium px-2.5 py-1.5 rounded-lg text-[var(--ink-3)] hover:text-[var(--ink)] transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-xs text-[var(--ink-4)]">Loading…</p>
      ) : hooks.length === 0 ? (
        <p className="text-xs text-[var(--ink-4)]">No webhooks yet. Add one above.</p>
      ) : (
        <div className="space-y-2">
          {hooks.map((h) => (
            <div key={h.id} className="px-3.5 py-3 rounded-xl border border-[var(--line)] bg-[var(--fill)]">
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-mono text-[var(--ink)] truncate">{h.url}</p>
                  <p className="text-[11px] text-[var(--ink-4)] mt-0.5">
                    {h.last_status ? (
                      <>last delivery <span className={statusTone(h.last_status)}>{h.last_status}</span>
                      {h.last_triggered_at ? ` · ${fmtDateTime(h.last_triggered_at)}` : ''}</>
                    ) : (
                      'never triggered'
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <Toggle on={h.enabled} busy={busyId === h.id} onClick={() => toggleEnabled(h)} />
                  <button
                    disabled={busyId === h.id}
                    onClick={() => test(h)}
                    className="text-xs font-medium px-2.5 py-1 rounded-lg border border-[var(--line)] text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--fill-strong)] transition-colors disabled:opacity-40"
                  >
                    Test
                  </button>
                  <button
                    disabled={busyId === h.id}
                    onClick={() => { setEditingId(h.id); setEditingEvents(h.events); }}
                    className="text-xs font-medium px-2.5 py-1 rounded-lg border border-[var(--line)] text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--fill-strong)] transition-colors disabled:opacity-40"
                  >
                    Edit events
                  </button>
                  <button
                    disabled={busyId === h.id}
                    onClick={() => setConfirmDel(h)}
                    className="text-xs font-medium px-2.5 py-1 rounded-lg border border-red-400/40 text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-40"
                  >
                    Delete
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {h.events.map((e) => (
                  <span key={e} className="text-[10px] font-medium text-[var(--ink-3)] bg-[var(--fill-strong)] rounded-full px-2 py-0.5">
                    {EVENT_LABEL[e] ?? e}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {confirmDel && (
        <ConfirmModal
          title="Delete webhook"
          message={`Delete the webhook to ${confirmDel.url}? Events will no longer be delivered there.`}
          confirmLabel="Delete"
          danger
          onConfirm={() => { del(confirmDel); setConfirmDel(null); }}
          onClose={() => setConfirmDel(null)}
        />
      )}

      {editingId !== null && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50" onClick={() => setEditingId(null)}>
          <div className="bg-[var(--surface)] rounded-2xl shadow-lg w-96 p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-[var(--ink)] mb-4">Edit webhook events</h3>
            <div className="space-y-2.5 mb-5">
              {events.map((e) => (
                <label key={e} className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingEvents.includes(e)}
                    onChange={(ev) => {
                      if (ev.target.checked) {
                        setEditingEvents((prev) => [...prev, e]);
                      } else {
                        setEditingEvents((prev) => prev.filter((x) => x !== e));
                      }
                    }}
                    className="w-4 h-4 rounded border border-[var(--line)] cursor-pointer"
                  />
                  <span className="text-sm text-[var(--ink)]">{EVENT_LABEL[e] ?? e}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-2.5 justify-end">
              <button
                onClick={() => setEditingId(null)}
                className="text-xs font-medium px-3 py-2 rounded-lg border border-[var(--line)] text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--fill-strong)] transition-colors"
              >
                Cancel
              </button>
              <button
                disabled={busyId === editingId}
                onClick={saveEvents}
                className="text-xs font-medium px-3 py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors disabled:opacity-40"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Shell ─────────────────────────────────────────────────────────────────────
const navIcon = (key: Tab) => {
  const cls = 'w-4 h-4';
  if (key === 'dashboard')
    return (
      <svg className={cls} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /></svg>
    );
  if (key === 'users')
    return (
      <svg className={cls} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4-4 4 4 0 004 4zm6 0a3 3 0 10-3-3" /></svg>
    );
  if (key === 'features')
    return (
      <svg className={cls} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
    );
  if (key === 'broadcast')
    return (
      <svg className={cls} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 11l14-6v14L3 13v-2zM3 11v2m4 .5V18a2 2 0 002 2h1a2 2 0 002-2v-2.5" /></svg>
    );
  if (key === 'invites')
    return (
      <svg className={cls} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l9 6 9-6M5 5h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z" /></svg>
    );
  if (key === 'webhooks')
    return (
      <svg className={cls} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
    );
  if (key === 'apps')
    return (
      <svg className={cls} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>
    );
  if (key === 'plans')
    return (
      <svg className={cls} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M3 6l.5 6.5a2 2 0 00.58 1.26l6.66 6.66a2 2 0 002.83 0l5.5-5.5a2 2 0 000-2.83L12.41 5.43A2 2 0 0011 4.85L4.5 4.35A1.5 1.5 0 003 5.85V6z" /></svg>
    );
  if (key === 'reviews')
    return (
      <svg className={cls} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
    );
  return (
    <svg className={cls} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
  );
};

export function AdminPanel({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [reviewCount, setReviewCount] = useState(0);

  useEffect(() => {
    adminListCssReviews().then((r) => setReviewCount(r.pending)).catch(() => {});
  }, [tab]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (typeof document === 'undefined') return null;

  const nav: { key: Tab; label: string }[] = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'users', label: 'Users' },
    { key: 'apps', label: 'Developers' },
    { key: 'plans', label: 'Plans' },
    { key: 'reviews', label: 'Code Reviews' },
    { key: 'broadcast', label: 'Announcements' },
    { key: 'invites', label: 'Invites' },
    { key: 'webhooks', label: 'Webhooks' },
    { key: 'features', label: 'Features' },
    { key: 'audit', label: 'Audit log' },
  ];

  return createPortal(
    <div className="fixed inset-0 z-[100] flex flex-col bg-[var(--base)]">
      {/* Header */}
      <div className="flex items-center justify-between px-5 md:px-7 h-16 flex-shrink-0 border-b border-[var(--line)] bg-[var(--panel)]">
        <div className="flex items-center gap-3 min-w-0">
          <Logo size={30} />
          <div className="min-w-0">
            <h2 className="text-lg font-display font-medium text-[var(--ink)] tracking-tight leading-none flex items-center gap-2">
              Admin
              <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--accent-fg)] bg-[var(--accent)]/10 rounded-full px-2 py-0.5">
                Control panel
              </span>
            </h2>
            <p className="text-[11px] text-[var(--ink-4)] mt-1 leading-none">Close AI · Fluxera</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 text-sm font-medium text-[var(--ink-3)] hover:text-[var(--ink)] rounded-lg px-3 py-1.5 hover:bg-[var(--fill)] transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to app
        </button>
      </div>

      <div className="flex flex-col md:flex-row flex-1 min-h-0">
        {/* Nav */}
        <nav className="flex md:flex-col md:w-56 flex-shrink-0 border-b md:border-b-0 md:border-r border-[var(--line)] bg-[var(--panel)]/40 p-2 md:p-4 gap-1 md:gap-1.5 overflow-x-auto md:overflow-y-auto">
          {nav.map((n) => (
            <button
              key={n.key}
              onClick={() => setTab(n.key)}
              className={`flex items-center gap-2 md:gap-3 flex-shrink-0 md:w-full text-left whitespace-nowrap px-3 md:px-3.5 py-2 md:py-2.5 rounded-xl text-sm transition-colors ${
                tab === n.key
                  ? 'bg-[var(--fill-strong)] text-[var(--ink)] font-medium'
                  : 'text-[var(--ink-3)] hover:bg-[var(--fill)] hover:text-[var(--ink-2)]'
              }`}
            >
              {navIcon(n.key)}
              {n.label}
              {n.key === 'reviews' && reviewCount > 0 && (
                <span className="ml-auto text-[10px] font-bold bg-red-500 text-white rounded-full px-1.5 py-0.5 min-w-[18px] text-center">{reviewCount}</span>
              )}
            </button>
          ))}
        </nav>

        {/* Content — fills the full page width (no max-width cap) */}
        <div key={tab} className="animate-fade-in flex-1 min-w-0 overflow-y-auto scroll-smooth px-5 md:px-8 py-6 md:py-7">
          {tab === 'dashboard' && <DashboardTab />}
          {tab === 'users' && <UsersTab />}
          {tab === 'apps' && <AppsTab />}
          {tab === 'plans' && <PlansTab />}
          {tab === 'reviews' && <CodeReviewsTab />}
          {tab === 'broadcast' && <BroadcastTab />}
          {tab === 'invites' && <InvitesTab />}
          {tab === 'webhooks' && <WebhooksTab />}
          {tab === 'features' && <FeaturesTab />}
          {tab === 'audit' && <AuditTab />}
        </div>
      </div>
    </div>,
    document.body
  );
}
