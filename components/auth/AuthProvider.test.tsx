import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthProvider';
import type { User } from '@/types';

/**
 * Session restoration is the one place where a mistake either locks a real user
 * out or paints a workspace they should not see, so the contract is pinned here
 * rather than left to a manual check.
 *
 * The behaviour under test replaced a version that blocked all rendering on a
 * `/me` round trip and called `clearToken()` on ANY rejection — which meant a
 * free-tier backend waking from sleep showed a bare logo for half a minute and
 * then signed the user out.
 */

const { getMe, clearToken } = vi.hoisted(() => ({
  getMe: vi.fn(),
  clearToken: vi.fn(),
}));

vi.mock('@/services/api', () => ({
  getMe,
  clearToken,
  getToken: () => localStorage.getItem('close_ai_token'),
  setToken: (t: string) => localStorage.setItem('close_ai_token', t),
}));

const ALICE: User = { id: 7, name: 'Alice', email: 'a@example.com', is_admin: true };

function Probe() {
  const { user, ready } = useAuth();
  return (
    <div>
      <span data-testid="ready">{ready ? 'ready' : 'booting'}</span>
      <span data-testid="user">{user ? user.email : 'none'}</span>
      <span data-testid="admin">{user?.is_admin ? 'admin' : 'not-admin'}</span>
    </div>
  );
}

const mount = () => render(<AuthProvider><Probe /></AuthProvider>);
const cached = () => localStorage.getItem('close_ai_user');

beforeEach(() => {
  localStorage.clear();
  getMe.mockReset();
  clearToken.mockReset();
  clearToken.mockImplementation(() => localStorage.removeItem('close_ai_token'));
});
afterEach(() => localStorage.clear());

describe('no stored token', () => {
  it('becomes ready without asking the server', async () => {
    mount();
    await waitFor(() => expect(screen.getByTestId('ready')).toHaveTextContent('ready'));
    expect(screen.getByTestId('user')).toHaveTextContent('none');
    expect(getMe).not.toHaveBeenCalled();
  });
});

describe('token with a cached identity', () => {
  beforeEach(() => {
    localStorage.setItem('close_ai_token', 't');
    localStorage.setItem('close_ai_user', JSON.stringify({ id: 7, name: 'Alice', email: 'a@example.com' }));
  });

  it('paints the workspace before the server answers', async () => {
    // A request that never settles: the UI must not wait for it.
    getMe.mockReturnValue(new Promise(() => {}));
    mount();
    await waitFor(() => expect(screen.getByTestId('ready')).toHaveTextContent('ready'));
    expect(screen.getByTestId('user')).toHaveTextContent('a@example.com');
  });

  it('never restores admin from the cache — only the server grants it', async () => {
    getMe.mockReturnValue(new Promise(() => {}));
    mount();
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('a@example.com'));
    expect(screen.getByTestId('admin')).toHaveTextContent('not-admin');
  });

  it('upgrades to the fresh identity once the server answers', async () => {
    getMe.mockResolvedValue(ALICE);
    mount();
    await waitFor(() => expect(screen.getByTestId('admin')).toHaveTextContent('admin'));
  });

  it('keeps the session when the backend is unreachable', async () => {
    // No `response` field is what axios gives for a timeout or network error.
    getMe.mockRejectedValue(new Error('timeout of 120000ms exceeded'));
    mount();
    await waitFor(() => expect(screen.getByTestId('ready')).toHaveTextContent('ready'));
    expect(screen.getByTestId('user')).toHaveTextContent('a@example.com');
    expect(clearToken).not.toHaveBeenCalled();
    expect(localStorage.getItem('close_ai_token')).toBe('t');
  });

  it('ends the session only when the server rejects the token', async () => {
    getMe.mockRejectedValue({ response: { status: 401 } });
    mount();
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('none'));
    expect(clearToken).toHaveBeenCalled();
    expect(cached()).toBeNull();
  });
});

describe('token with no cached identity', () => {
  beforeEach(() => localStorage.setItem('close_ai_token', 't'));

  it('waits for the server, then caches what came back', async () => {
    let settle: (u: User) => void = () => {};
    getMe.mockReturnValue(new Promise<User>((r) => { settle = r; }));
    mount();
    // Nothing to paint from, so it is still booting.
    expect(screen.getByTestId('ready')).toHaveTextContent('booting');
    settle(ALICE);
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('a@example.com'));
    expect(JSON.parse(cached() as string)).toEqual({
      id: 7, name: 'Alice', email: 'a@example.com', phone: undefined, avatar: undefined,
    });
  });

  it('ignores a corrupt cache instead of throwing', async () => {
    localStorage.setItem('close_ai_user', '{not json');
    getMe.mockResolvedValue(ALICE);
    expect(() => mount()).not.toThrow();
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('a@example.com'));
  });
});
