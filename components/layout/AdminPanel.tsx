'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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
  apiError,
  type AdminStats,
  type AdminUser,
  type AdminAuditEntry,
  type FeatureMap,
} from '@/services/api';
import { useFeatures } from '@/components/providers/FeatureProvider';
import { FEATURE_GROUPS } from '@/lib/features';

type Tab = 'dashboard' | 'users' | 'features' | 'audit';

const headingCls = 'text-base font-semibold text-[var(--ink)]';
const subCls = 'text-xs text-[var(--ink-3)] mt-0.5';

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(n);
}

function timeAgo(iso: string | null): string {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '—';
  const s = Math.floor((Date.now() - then) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        accent ? 'border-[var(--accent)]/40 bg-[var(--accent)]/5' : 'border-[var(--line)] bg-[var(--fill)]'
      }`}
    >
      <p className="text-2xl font-semibold text-[var(--ink)] tabular-nums">{value}</p>
      <p className="text-[11px] text-[var(--ink-3)] mt-1">{label}</p>
      {hint && <p className="text-[10px] text-[var(--ink-4)] mt-0.5">{hint}</p>}
    </div>
  );
}

function DashboardTab() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminStats()
      .then(setStats)
      .catch((e) => toast.error(apiError(e, 'Could not load stats.')))
      .finally(() => setLoading(false));
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

      <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--ink-4)] mb-2">Users</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
        <StatCard label="Total users" value={fmt(u.total)} accent />
        <StatCard label="Verified" value={fmt(u.verified)} hint={`${u.unverified} unverified`} />
        <StatCard label="Admins" value={fmt(u.admins)} />
        <StatCard label="Banned" value={fmt(u.banned)} />
        <StatCard label="New · 7 days" value={fmt(u.new_7d)} />
        <StatCard label="New · 30 days" value={fmt(u.new_30d)} />
      </div>

      <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--ink-4)] mb-2">Content & usage</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
        <StatCard label="Total chats" value={fmt(c.chats)} />
        <StatCard label="API keys" value={fmt(c.api_keys)} hint={`${c.active_api_keys} active`} />
        <StatCard label="API calls" value={fmt(c.api_calls)} />
        <StatCard label="Shared links" value={fmt(c.shared_chats)} />
        <StatCard label="Users with memory" value={fmt(c.memory_users)} />
      </div>

      {stats.recent_signups.length > 0 && (
        <div className="pt-2">
          <p className="text-sm font-medium text-[var(--ink)] mb-3">Recent sign-ups</p>
          <div className="space-y-2">
            {stats.recent_signups.map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl border border-[var(--line)] bg-[var(--fill)]"
              >
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
                <span className="flex-shrink-0 text-[11px] text-[var(--ink-4)]">{timeAgo(s.created_at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

// ── Users ───────────────────────────────────────────────────────────────────
function Badge({ children, tone }: { children: React.ReactNode; tone: 'admin' | 'banned' | 'unverified' }) {
  const cls =
    tone === 'admin'
      ? 'text-[var(--accent-fg)] bg-[var(--accent)]/10'
      : tone === 'banned'
        ? 'text-red-400 bg-red-400/10'
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
  onPatch: (patch: { is_verified?: boolean; is_admin?: boolean; is_banned?: boolean }) => void;
  onDelete: () => void;
  busy: boolean;
}) {
  const isSelf = u.id === selfId;
  const locked = u.is_protected || isSelf; // can't demote / ban / delete

  const actionBtn =
    'text-xs font-medium px-2.5 py-1 rounded-lg border transition-colors disabled:opacity-40 disabled:cursor-not-allowed';

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-3.5 py-3 rounded-xl border border-[var(--line)] bg-[var(--fill)]">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[var(--accent)] to-[var(--accent-strong)] flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
          {u.name?.[0]?.toUpperCase() ?? 'U'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-[var(--ink)] truncate">{u.name}</p>
            {u.is_admin && <Badge tone="admin">{u.is_protected ? 'Super Admin' : 'Admin'}</Badge>}
            {u.is_banned && <Badge tone="banned">Banned</Badge>}
            {!u.is_verified && <Badge tone="unverified">Unverified</Badge>}
          </div>
          <p className="text-[11px] text-[var(--ink-4)] truncate">{u.email}</p>
          <p className="text-[11px] text-[var(--ink-4)] mt-0.5">
            {u.chat_count} chats · {u.api_key_count} keys · joined {timeAgo(u.created_at)}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap flex-shrink-0">
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
  );
}

function UsersTab() {
  const { user } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [confirm, setConfirm] = useState<
    | { kind: 'ban' | 'demote' | 'delete'; target: AdminUser }
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
    patch: { is_verified?: boolean; is_admin?: boolean; is_banned?: boolean }
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
    patch: { is_verified?: boolean; is_admin?: boolean; is_banned?: boolean }
  ) => {
    if (patch.is_banned === true) return setConfirm({ kind: 'ban', target });
    if (patch.is_admin === false) return setConfirm({ kind: 'demote', target });
    applyPatch(target, patch);
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

      {loading ? (
        <p className="text-xs text-[var(--ink-4)]">Loading users…</p>
      ) : users.length === 0 ? (
        <p className="text-xs text-[var(--ink-4)]">No users {query ? 'match that search' : 'yet'}.</p>
      ) : (
        <div className="space-y-2">
          {users.map((u) => (
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
                : 'Delete user'
          }
          message={
            confirm.kind === 'ban'
              ? `Ban ${confirm.target.email}? They'll be signed out and unable to log in until unbanned.`
              : confirm.kind === 'demote'
                ? `Remove admin access from ${confirm.target.email}? They'll lose access to this panel.`
                : `Permanently delete ${confirm.target.email}? This wipes their account, chats, documents, API keys, and memory. This can't be undone.`
          }
          confirmLabel={confirm.kind === 'ban' ? 'Ban' : confirm.kind === 'demote' ? 'Demote' : 'Delete'}
          danger
          onConfirm={() => {
            const { kind, target } = confirm;
            if (kind === 'ban') applyPatch(target, { is_banned: true });
            else if (kind === 'demote') applyPatch(target, { is_admin: false });
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
              <span className="flex-shrink-0 text-[11px] text-[var(--ink-4)]">{timeAgo(e.created_at)}</span>
            </div>
          ))}
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
  return (
    <svg className={cls} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
  );
};

export function AdminPanel({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('dashboard');

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
            </button>
          ))}
        </nav>

        {/* Content */}
        <div className="flex-1 min-w-0 overflow-y-auto px-5 md:px-8 py-6 md:py-7 max-w-5xl">
          {tab === 'dashboard' && <DashboardTab />}
          {tab === 'users' && <UsersTab />}
          {tab === 'features' && <FeaturesTab />}
          {tab === 'audit' && <AuditTab />}
        </div>
      </div>
    </div>,
    document.body
  );
}
