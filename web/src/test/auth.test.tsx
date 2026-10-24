import { test, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes } from '../App';
import { AppProvider } from '../state/AppContext';
import { createHttpService } from '../api/service';
import { DEMO_IDS } from '../api/demo';

vi.mock('../components/MapCanvas', () => ({ default: () => <div aria-label="Test map" /> }));
const meta = { mode: 'live', persistence: 'postgres', requestId: 'auth-test' };
const okay = (data: unknown) => new Response(JSON.stringify({ data, meta }), { status: 200, headers: { 'Content-Type': 'application/json' } });
const buyer = { id: DEMO_IDS.buyer, username: 'buyer', role: 'buyer' };
function start(path: string) {
  localStorage.setItem('cropconvoy.preferences', 'essential');
  const user = userEvent.setup();
  render(<AppProvider service={createHttpService()}><MemoryRouter initialEntries={[path]}><AppRoutes /></MemoryRouter></AppProvider>);
  return user;
}

test('API login uses the server identity, sends bearer headers, and revokes on sign out', async () => {
  const fetcher = vi.fn().mockImplementation(async (url: string, options: RequestInit) => {
    const path = new URL(url).pathname;
    if (path === '/api/auth/login') return okay({ token: 'A'.repeat(43), tokenType: 'Bearer', expiresAt: new Date(Date.now() + 3600000).toISOString(), user: buyer });
    if (path === '/api/orders') return okay([]);
    if (path === '/api/auth/logout') return okay({ signedOut: true });
    throw new Error(`Unexpected ${path} ${options?.method}`);
  });
  vi.stubGlobal('fetch', fetcher);
  const user = start('/login');
  await user.click(await screen.findByRole('button', { name: 'Use buyer demo account' }));
  await user.click(screen.getByRole('button', { name: 'Sign in' }));
  expect(await screen.findByRole('heading', { name: 'Fresh possibilities ahead.' })).toBeInTheDocument();
  expect(sessionStorage.getItem('cropconvoy.apiToken')).toBe('A'.repeat(43));
  expect(sessionStorage.getItem('cropconvoy.identity')).toBeNull();
  await waitFor(() => expect(fetcher.mock.calls.some(([url, options]) => new URL(url).pathname === '/api/orders' && new Headers(options.headers).get('Authorization') === `Bearer ${'A'.repeat(43)}`)).toBe(true));
  await user.click(screen.getByRole('button', { name: 'Sign out' }));
  expect(await screen.findByRole('heading', { name: /Welcome to/ })).toBeInTheDocument();
  expect(sessionStorage.getItem('cropconvoy.apiToken')).toBeNull();
  expect(fetcher.mock.calls.some(([url, options]) => new URL(url).pathname === '/api/auth/logout' && new Headers(options.headers).get('Authorization') === `Bearer ${'A'.repeat(43)}`)).toBe(true);
});

test('API mode ignores a stored demo role and restores identity from the server', async () => {
  sessionStorage.setItem('cropconvoy.identity', JSON.stringify({ role: 'farmer', username: 'farmer' }));
  sessionStorage.setItem('cropconvoy.apiToken', 'B'.repeat(43));
  const fetcher = vi.fn().mockImplementation(async (url: string) => new URL(url).pathname === '/api/auth/me' ? okay(buyer) : okay([]));
  vi.stubGlobal('fetch', fetcher);
  start('/app/buyer');
  expect(await screen.findByRole('heading', { name: 'Fresh possibilities ahead.' })).toBeInTheDocument();
  expect(sessionStorage.getItem('cropconvoy.identity')).toBeNull();
  expect(new Headers(fetcher.mock.calls[0][1].headers).get('Authorization')).toBe(`Bearer ${'B'.repeat(43)}`);
});

test('API mode rejects invalid credentials without granting a local role', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: {
    code: 'INVALID_CREDENTIALS', message: 'Invalid username or password',
  } }), { status: 401, headers: { 'Content-Type': 'application/json' } })));
  const user = start('/login');
  await user.click(await screen.findByRole('button', { name: 'Use farmer demo account' }));
  await user.click(screen.getByRole('button', { name: 'Sign in' }));
  expect((await screen.findAllByText('Those demo credentials do not match.')).length).toBeGreaterThan(0);
  expect(sessionStorage.getItem('cropconvoy.apiToken')).toBeNull();
  expect(screen.queryByRole('heading', { name: 'A good day to grow.' })).not.toBeInTheDocument();
});

test('a 401 clears API identity and sends the user back to login', async () => {
  sessionStorage.setItem('cropconvoy.apiToken', 'C'.repeat(43));
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string) => new URL(url).pathname === '/api/auth/me'
    ? okay(buyer)
    : new Response(JSON.stringify({ error: { code: 'SESSION_INVALID', message: 'Session expired' } }), { status: 401, headers: { 'Content-Type': 'application/json' } })));
  start('/app/buyer');
  expect(await screen.findByRole('heading', { name: /Welcome to/ })).toBeInTheDocument();
  expect(sessionStorage.getItem('cropconvoy.apiToken')).toBeNull();
});
