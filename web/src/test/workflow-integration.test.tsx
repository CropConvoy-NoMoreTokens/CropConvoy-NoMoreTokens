import { test, expect, vi } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { AppRoutes } from '../App';
import { AppProvider } from '../state/AppContext';
import { createHttpService } from '../api/service';
import { setApiToken } from '../api/authSession';
import { money } from '../lib/format';
import examples from './fixtures/workflow-responses.json';

// Full backend-produced fixture, copied into web/ so builds remain independent.
// api/test/workflow.test.ts checks this copy against the runtime contract/reference.
vi.mock('../components/MapCanvas', () => ({ default: ({ points, geometry }: { points: Array<{ label: string }>; geometry?: unknown }) =>
  <div aria-label="Test route map">{points.map(point => point.label).join(', ')} {geometry ? 'Returned geometry' : 'No geometry'}</div> }));
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const plan = examples.success.data.plan;
const listing = plan.sourceSnapshot.listing;
const farmer = { id: listing.demoFarmerId, role: 'farmer', username: 'farmer' };
const token = 'W'.repeat(43);
const path = `/app/farmer?listing=${listing.id}&plan=${plan.id}`;
function RouteLocation() { return <output data-testid="route">{useLocation().search}</output>; }
function start(route = path) {
  vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-25T03:01:00Z'));
  setApiToken(token);
  localStorage.setItem('cropconvoy.preferences', 'essential');
  const user = userEvent.setup();
  render(<AppProvider service={createHttpService()}><MemoryRouter initialEntries={[route]}><AppRoutes /><RouteLocation /></MemoryRouter></AppProvider>);
  return user;
}
function mockApi(stored = plan, generate: unknown = examples.empty, decision: unknown = examples.stale, currentListing = listing) {
  const fetcher = vi.fn(async (url: string | URL | Request, options?: RequestInit) => {
    const pathname = new URL(String(url)).pathname;
    expect(new Headers(options?.headers).get('Authorization')).toBe(`Bearer ${token}`);
    if (pathname === '/api/auth/me') return response({ data: farmer, meta: examples.success.meta });
    if (pathname === `/api/listings/${listing.id}`) return response({ data: currentListing, meta: { ...examples.success.meta, mode: 'stub' } });
    if (pathname === '/api/plans/generate') {
      expect(JSON.parse(String(options?.body))).toEqual({ listingId: listing.id });
      return response(generate);
    }
    if (pathname.endsWith('/decision')) return response(decision, 409);
    if (pathname === `/api/plans/${plan.id}`) return response({ data: stored, meta: examples.success.meta });
    throw new Error(`Unexpected test request: ${pathname}`);
  });
  vi.stubGlobal('fetch', fetcher); return fetcher;
}

test('API proposal shows stored minimum, all source locations and partial-search warning after refresh', async () => {
  const stored = { ...structuredClone(plan), searchComplete: false };
  // The current listing may differ from the authoritative proposal snapshot.
  const fetcher = mockApi(stored, examples.empty, examples.stale, { ...listing, minNetMinor: 9900000 });
  const user = start();
  const proposal = await screen.findByRole('region', { name: 'A clearer picture of your proceeds.' });
  expect(within(proposal).getByText(money(1600000).replace(/\s/g, ' '))).toBeInTheDocument();
  expect(within(proposal).getByText(money(1665000).replace(/\s/g, ' '))).toBeInTheDocument();
  expect(await screen.findByText(/Search incomplete\. Review this evaluated proposal/)).toBeInTheDocument();
  expect(await screen.findByLabelText('Test route map')).toHaveTextContent('Trip start, Harvest pickup, Buyer delivery, Trip end');
  expect(screen.getByText(/AI-assisted selection was unavailable or invalid for part of this search/)).toBeInTheDocument();
  expect(screen.queryByText('API mode')).not.toBeInTheDocument();
  expect(screen.queryByText('Fallback mode')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Refresh proposal' }));
  await waitFor(() => expect(fetcher.mock.calls.filter(([url]) => String(url).endsWith(`/api/plans/${plan.id}`))).toHaveLength(2));
  expect(screen.getByText(/Search incomplete\. Review this evaluated proposal/)).toBeInTheDocument();
});

test('stored proposal keeps its fallback explanation after the listing loads', async () => {
  let resolveListing!: (value: Response) => void;
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (new URL(url).pathname === '/api/auth/me') return response({ data: farmer, meta: examples.success.meta });
    return url.includes('/api/listings/') ? new Promise<Response>(resolve => { resolveListing = resolve; })
      : response({ data: plan, meta: examples.success.meta });
  }));
  start();
  await waitFor(() => expect(resolveListing).toBeTypeOf('function'));
  resolveListing(response({ data: listing, meta: { ...examples.success.meta, mode: 'stub' } }));
  await screen.findByRole('region', { name: 'A clearer picture of your proceeds.' });
  expect(screen.getByText(/AI-assisted selection was unavailable or invalid for part of this search/)).toBeInTheDocument();
  expect(screen.queryByText('Backend preview')).not.toBeInTheDocument();
});

test('generation with no proposal clears the previous plan URL and explains fallback', async () => {
  mockApi(); const user = start();
  await user.click(await screen.findByRole('button', { name: 'Generate another proposal' }));
  await screen.findByRole('heading', { name: 'No suitable proposal this time.' });
  await waitFor(() => expect(screen.getByTestId('route')).not.toHaveTextContent('plan='));
  expect(screen.queryByRole('region', { name: 'A clearer picture of your proceeds.' })).not.toBeInTheDocument();
  expect(screen.getByText(/AI-assisted selection was unavailable or invalid during this search/)).toBeInTheDocument();
});

test('409 decisions block repeated submission and keep regeneration available', async () => {
  const fetcher = mockApi(); const user = start();
  await user.click(await screen.findByRole('button', { name: 'Accept proposal' }));
  await user.click(await screen.findByRole('button', { name: 'Confirm acceptance' }));
  await screen.findByText(examples.stale.error.message);
  expect(screen.getByRole('button', { name: 'Accept proposal' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Reject proposal' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Generate another proposal' })).toBeEnabled();
  expect(fetcher.mock.calls.filter(([url]) => String(url).endsWith('/decision'))).toHaveLength(1);
});

test('expired API proposals remain readable but cannot submit either decision', async () => {
  mockApi({ ...plan, expiresAt: '2026-10-25T03:00:00Z' }); start();
  await screen.findByText('This proposal has expired. Generate another proposal before deciding.');
  expect(screen.getByRole('button', { name: 'Accept proposal' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Reject proposal' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Generate another proposal' })).toBeEnabled();
});

test('legacy stored plans without search status do not imply a completed search', async () => {
  const { searchComplete: _ignored, ...legacy } = plan;
  mockApi(legacy as typeof plan); start();
  await screen.findByText(/Search completeness was not recorded/);
});

test('versioned proposal displays carrying and detour components from stored snapshots', async () => {
  const stored = structuredClone(plan);
  Object.assign(stored.quoteSnapshot, { ratePerKgKmMinor: 20, routeCarryDistanceM: 30000,
    shipmentChargeMinor: 48000, detourChargeMinor: 60000, transportMinor: 143000, netMinor: 1617000 });
  stored.sourceSnapshot.trip.ratePerKgKmMinor = 20;
  mockApi(stored); start();
  const proposal = await screen.findByRole('region', { name: 'A clearer picture of your proceeds.' });
  expect(within(proposal).getByText('Added detour')).toBeInTheDocument();
  expect(within(proposal).getByText(money(48000).replace(/\s/g, ' '))).toBeInTheDocument();
  expect(within(proposal).getByText(money(60000).replace(/\s/g, ' '))).toBeInTheDocument();
  expect(within(proposal).getByText(money(1617000).replace(/\s/g, ' '))).toBeInTheDocument();
  expect(within(proposal).getByText(/80 kg × 30\.00 km/)).toBeInTheDocument();
});

test('authoritative quote expiry blocks decisions even if the plan advertises a later expiry', async () => {
  const stored = structuredClone(plan);
  stored.quoteSnapshot.expiresAt = '2026-10-25T03:00:00Z';
  mockApi(stored); start();
  await screen.findByText('This proposal has expired. Generate another proposal before deciding.');
  expect(screen.getByRole('button', { name: 'Accept proposal' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Reject proposal' })).toBeDisabled();
});
