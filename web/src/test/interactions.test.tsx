import { describe, test, expect, vi } from 'vitest';
import { render, screen, within, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes } from '../App';
import { AppProvider } from '../state/AppContext';
import { createDemoService, DEMO_IDS } from '../api/demo';
import { ApiError } from '../api/client';
import { colomboToUtc, tomorrowAt } from '../lib/format';
import { createHttpService } from '../api/service';
import type { CropConvoyService } from '../api/types';
import { CopyButton } from '../components/ui';
vi.mock('../components/MapCanvas', () => ({ default: ({ points, onPick, geometry }: { points: Array<{ lat: number; lng: number; label: string }>; onPick?: (point: { lat: number; lng: number }) => void; geometry?: unknown }) => <div aria-label="Test map"><p>{points.map(p => p.label).join(', ')} {geometry ? 'Returned geometry' : 'No road geometry'}</p>{onPick && <button type="button" onClick={() => onPick({ lat: 7.8, lng: 80.6 })}>Choose map pin</button>}</div> }));
function start(path = '/', role?: string, service?: CropConvoyService) {
  if (role) sessionStorage.setItem('cropconvoy.identity', JSON.stringify({ role, username: role }));
  localStorage.setItem('cropconvoy.preferences', 'essential');
  const user = userEvent.setup();
  render(<AppProvider service={service || createDemoService()}><MemoryRouter initialEntries={[path]}><AppRoutes /></MemoryRouter></AppProvider>);
  return user;
}
describe('landing and shared controls', () => {
  test('theme, role tabs, FAQ and privacy choices work', async () => {
    const user = start();
    await user.click(screen.getByRole('button', { name: 'Switch to dark mode' })); expect(document.documentElement.dataset.theme).toBe('dark');
    await user.click(screen.getByRole('tab', { name: 'For buyers' })); expect(screen.getByRole('tabpanel')).toHaveTextContent('Find a harvest');
    await user.keyboard('{ArrowRight}'); expect(screen.getByRole('tab', { name: 'For transporters' })).toHaveAttribute('aria-selected', 'true');
    const faq = screen.getByText('Does accepting a proposal book a vehicle?'); await user.click(faq); expect(faq.closest('details')).toHaveAttribute('open');
    await user.click(screen.getByRole('button', { name: 'Privacy preferences' })); await user.click(screen.getByRole('button', { name: 'Save preferences' })); expect(localStorage.getItem('cropconvoy.preferences')).toBe('preferences'); expect(localStorage.getItem('cropconvoy.theme')).toBe('dark');
    await user.click(screen.getByRole('button', { name: 'Privacy preferences' })); await user.click(screen.getByRole('button', { name: 'Essential only' })); expect(localStorage.getItem('cropconvoy.theme')).toBeNull();
  });
  test('search handles results, no results, Enter navigation and Escape focus restoration', async () => {
    const user = start(); const button = screen.getByRole('button', { name: 'Search site' });
    await user.click(button); const input = await screen.findByRole('textbox', { name: 'Search CropConvoy' });
    await user.type(input, 'nothing-matches-here'); expect(screen.getByText(/No results for/)).toBeInTheDocument();
    await user.clear(input); await user.type(input, 'transport cost'); expect(screen.getByRole('link', { name: /How is transport cost/ })).toBeInTheDocument();
    await user.keyboard('{Escape}'); expect(screen.queryByRole('dialog')).not.toBeInTheDocument(); expect(button).toHaveFocus();
    await user.click(button); await user.type(screen.getByRole('textbox', { name: 'Search CropConvoy' }), 'demo account'); await user.keyboard('{Enter}'); expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  test('mobile navigation, help search and skip link have outcomes', async () => {
    const user = start(); await user.click(screen.getByRole('button', { name: 'Open mobile menu' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('link', { name: 'Get started' })); expect(await screen.findByRole('heading', { name: /Welcome to/ })).toBeInTheDocument(); expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Open help and contact' })); await user.type(screen.getByRole('textbox', { name: 'Search help' }), 'zz-no-topic'); expect(screen.getByText(/No help topics match/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close dialog' }));
    await user.click(screen.getByRole('link', { name: 'Skip to content' })); expect(document.getElementById('main-content')).toHaveFocus();
  });
  test('copy announces success and clipboard failure without false success', async () => {
    const user = userEvent.setup(); const write = vi.fn().mockResolvedValue(undefined); Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: write } });
    render(<AppProvider service={createDemoService()}><CopyButton text="record-id" label="Copy record" /></AppProvider>);
    await user.click(screen.getByRole('button', { name: 'Copy record' })); expect(write).toHaveBeenCalledWith('record-id'); expect(screen.getByText('Copied')).toBeInTheDocument();
    write.mockRejectedValueOnce(new Error('denied')); await user.click(screen.getByRole('button', { name: 'Copy record' })); expect(write).toHaveBeenCalledTimes(2); expect(screen.getByText('Copy manually: record-id')).toBeInTheDocument(); expect(screen.queryByText('Copied')).not.toBeInTheDocument();
  });
  test('keyboard search shortcut, help disclosures and not-found navigation work', async () => {
    const user = start('/not-a-page'); await user.click(screen.getByRole('link', { name: 'Back to home' }));
    await user.keyboard('{Control>}k{/Control}'); expect(await screen.findByRole('textbox', { name: 'Search CropConvoy' })).toBeInTheDocument(); await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'Help & contact' })); const dialog = await screen.findByRole('dialog'); const question = within(dialog).getByText('How does CropConvoy find a match?'); await user.click(question); expect(question.closest('details')).toHaveAttribute('open'); await user.click(within(dialog).getByRole('link', { name: 'Open demo' })); expect(await screen.findByLabelText('Demo username')).toBeInTheDocument();
  });
  test('each FAQ disclosure can open and close', async () => {
    const user = start(); const questions = ['How does CropConvoy find a match?', 'How is transport cost calculated?', 'Does accepting a proposal book a vehicle?', 'Can I explore without a real account?', 'What if extraction misses a detail?', 'What is stored on this device?'];
    for (const name of questions) { const question = screen.getByText(name); await user.click(question); expect(question.closest('details')).toHaveAttribute('open'); await user.click(question); expect(question.closest('details')).not.toHaveAttribute('open'); }
  });
});
describe('demo accounts and role workflows', () => {
  test('invalid login, reveal, autofill, sign in, role guard and logout work', async () => {
    const user = start('/login');
    await screen.findByRole('button', { name: 'Enter demo' }); await user.click(screen.getByRole('button', { name: 'Enter demo' })); expect(screen.getAllByText('Enter a demo username.').length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: 'Use farmer demo account' })); await user.click(screen.getByRole('button', { name: 'Show password' })); expect(screen.getByLabelText('Demo password')).toHaveAttribute('type', 'text');
    await user.click(screen.getByRole('button', { name: 'Hide password' })); expect(screen.getByLabelText('Demo password')).toHaveAttribute('type', 'password');
    await user.click(screen.getByRole('button', { name: 'Enter demo' })); expect(await screen.findByRole('heading', { name: 'A good day to grow.' })).toBeInTheDocument();
    expect(sessionStorage.getItem('cropconvoy.identity')).not.toContain('password');
    await user.click(screen.getByRole('button', { name: 'Sign out' })); expect(await screen.findByRole('heading', { name: /Welcome to/ })).toBeInTheDocument(); expect(sessionStorage.getItem('cropconvoy.identity')).toBeNull();
  });
  test('farmer sample → review → explicit publish → proposal → accept → refresh', async () => {
    const service = createDemoService(); const publish = vi.spyOn(service, 'createListing');
    const user = start('/app/farmer', 'farmer', service);
    await user.click(await screen.findByRole('button', { name: 'Try sample' })); await user.click(screen.getByRole('button', { name: 'Review details' }));
    await screen.findByText(/Approximate place found/); expect(publish).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Publish harvest' })); expect(screen.getAllByText('Confirm that the pickup pin is correct.').length).toBeGreaterThan(0);
    await user.click(screen.getByLabelText('I have checked the pickup pin.')); await user.click(screen.getByLabelText('I confirm these harvest details are correct.'));
    await user.click(screen.getByRole('button', { name: 'Publish harvest' })); await user.click(screen.getByRole('button', { name: 'Confirm publication' }));
    expect(await screen.findByRole('heading', { name: '80 kg of tomatoes' })).toBeInTheDocument(); expect(publish).toHaveBeenCalledOnce();
    await user.click(screen.getByRole('button', { name: 'Find a proposal' })); expect(await screen.findByRole('heading', { name: /A clearer picture/ })).toBeInTheDocument(); expect(screen.getByText(/Road route pending/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Accept proposal' })); await user.click(screen.getByRole('button', { name: 'Confirm acceptance' }));
    expect(await screen.findByText('Pending buyer and transporter confirmations.', { selector: 'strong' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Refresh proposal' }));
    await user.click(screen.getByRole('button', { name: 'New harvest' })); await user.click(screen.getByRole('button', { name: 'Cancel' })); expect(screen.getByRole('heading', { name: '80 kg of tomatoes' })).toBeInTheDocument();
  });
  test('Sinhala harvest place defaults the map to the first candidate without confirming the pin', async () => {
    const service = createDemoService();
    vi.spyOn(service, 'extract').mockResolvedValue({ data: { draft: { crop: 'tomato', quantityKg: 80,
      locationText: 'දඹුල්ල', readyAt: null, minNetMinor: null }, missingFields: ['readyAt', 'minNetMinor'],
      questions: ['Enter the exact date and minimum proceeds.'] },
    meta: { mode: 'demo', persistence: 'session', requestId: 'test' } });
    const resolve = vi.spyOn(service, 'resolveLocation').mockResolvedValue({ data: { candidates: [
      { label: 'දඹුල්ල town', point: { lat: 7.8742, lng: 80.6511 } },
      { label: 'දඹුල්ල village', point: { lat: 7.9, lng: 80.7 } },
    ] }, meta: { mode: 'demo', persistence: 'session', requestId: 'test' } });
    const user = start('/app/farmer', 'farmer', service);
    await user.type(await screen.findByLabelText('Tell us about your harvest'), 'දඹුල්ලේ තක්කාලි කිලෝ 80');
    await user.click(screen.getByRole('button', { name: 'Review details' }));
    expect(await screen.findByRole('button', { name: 'දඹුල්ල town' })).toBeInTheDocument();
    expect(resolve).toHaveBeenCalledWith('දඹුල්ල');
    expect(screen.getByLabelText('Pickup latitude')).toHaveValue(7.8742);
    expect(screen.getByLabelText('I have checked the pickup pin.')).not.toBeChecked();
    await user.click(screen.getByRole('button', { name: 'දඹුල්ල village' }));
    expect(screen.getByLabelText('Pickup latitude')).toHaveValue(7.9);
    expect(screen.getByLabelText('I have checked the pickup pin.')).not.toBeChecked();
  });
  test('an uploaded image fills the harvest textbox for review without publishing', async () => {
    sessionStorage.setItem('cropconvoy.apiToken', 'test-token');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: {
      id: DEMO_IDS.farmer, username: 'farmer', role: 'farmer' }, meta: { mode: 'live', persistence: 'postgres', requestId: 'test' } }),
    { status: 200, headers: { 'Content-Type': 'application/json' } })));
    const service = createDemoService(); service.mode = 'api';
    const readImage = vi.spyOn(service, 'readHarvestImage').mockResolvedValue({ data: { text: 'දඹුල්ලේ තක්කාලි කිලෝ 80' },
      meta: { mode: 'live', persistence: 'postgres', requestId: 'test' } });
    const publish = vi.spyOn(service, 'createListing');
    const user = start('/app/farmer', 'farmer', service);
    const file = new File(['image bytes'], 'notes.png', { type: 'image/png' });
    const uploadButton = await screen.findByRole('button', { name: 'Upload photo' });
    expect(uploadButton.parentElement).toContainElement(screen.getByRole('button', { name: 'Try sample' }));
    const input = screen.getByTestId('harvest-image-file');
    const openPicker = vi.spyOn(input, 'click');
    await user.click(uploadButton);
    expect(openPicker).toHaveBeenCalledOnce();
    await user.upload(input, file);
    expect(await screen.findByLabelText('Tell us about your harvest')).toHaveValue('දඹුල්ලේ තක්කාලි කිලෝ 80');
    expect(readImage).toHaveBeenCalledWith(file);
    expect(publish).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Review details' }));
    expect(await screen.findByRole('button', { name: 'Publish harvest' })).toBeInTheDocument();
    expect(publish).not.toHaveBeenCalled();
  });
  test('buyer validates, saves exact money, clears only after confirmation and refreshes', async () => {
    const service = createDemoService(); const save = vi.spyOn(service, 'createOrder'); const user = start('/app/buyer', 'buyer', service);
    await user.click(await screen.findByRole('button', { name: 'Save order' })); expect(save).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Try sample' })); await user.click(screen.getByLabelText('I have checked the delivery pin.'));
    await user.dblClick(screen.getByRole('button', { name: 'Save order' })); await screen.findByText('Order saved successfully'); expect(save).toHaveBeenCalledOnce(); expect(save.mock.calls[0][0].pricePerKgMinor).toBe(22000);
    await user.click(screen.getByRole('button', { name: 'Refresh orders' }));
    await user.click(screen.getByRole('button', { name: 'Clear form' })); await user.click(screen.getByRole('button', { name: 'Cancel' })); expect(screen.getByLabelText('Quantity needed (whole kg)')).toHaveValue(100);
    await user.click(screen.getByRole('button', { name: 'Clear form' })); await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Clear form' })); expect(screen.getByLabelText('Quantity needed (whole kg)')).toHaveValue(null);
  });
  test('transporter creates a trip, converts units, and toggles route view without fake geometry', async () => {
    const service = createDemoService(); const save = vi.spyOn(service, 'createTrip'); const user = start('/app/transporter', 'transporter', service);
    await user.click(await screen.findByRole('button', { name: 'Try sample' })); await user.click(screen.getByLabelText('I have checked both route pins and the journey details.'));
    await user.click(screen.getByRole('button', { name: 'Save trip' })); expect(await screen.findByText('Demo trip saved successfully')).toBeInTheDocument(); expect(save.mock.calls[0][0]).toMatchObject({ maxExtraDistanceM: 10000, maxExtraTimeS: 3600, baseMinor: 35000, perKmMinor: 10000 });
    const hide = screen.getByRole('button', { name: 'Hide route' }); await user.click(hide); expect(screen.getAllByRole('button', { name: 'View route' })).toHaveLength(2);
    await user.click(screen.getAllByRole('button', { name: 'View route' })[0]); expect(screen.getByText(/Only selected endpoints/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Refresh trips' }));
  });
  test('API-mode field errors remain visible with entries preserved', async () => {
    sessionStorage.setItem('cropconvoy.apiToken', 'test-token');
    const service = createHttpService(); vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url, options) => new Response(JSON.stringify(String(url).endsWith('/api/auth/me') ? { data: { id: DEMO_IDS.buyer, username: 'buyer', role: 'buyer' }, meta: { mode: 'live', persistence: 'postgres', requestId: 'test' } } : options?.method === 'POST' ? { error: { code: 'VALIDATION_ERROR', message: 'Please check this deadline', fields: [{ path: 'deadlineAt', message: 'Choose a later delivery deadline.' }] } } : { data: [], meta: { mode: 'stub', persistence: 'memory', requestId: 'test' } }), { status: String(url).endsWith('/api/auth/me') ? 200 : options?.method === 'POST' ? 422 : 200, headers: { 'Content-Type': 'application/json' } })));
    const user = start('/app/buyer', 'buyer', service); await user.click(await screen.findByRole('button', { name: 'Try sample' })); await user.click(screen.getByLabelText('I have checked the delivery pin.')); await user.click(screen.getByRole('button', { name: 'Save order' })); expect((await screen.findAllByText('Choose a later delivery deadline.')).length).toBeGreaterThan(0); expect(screen.getByLabelText('Quantity needed (whole kg)')).toHaveValue(100);
  });
  test('extraction failure opens manual entry without publishing', async () => {
    sessionStorage.setItem('cropconvoy.apiToken', 'test-token');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { id: DEMO_IDS.farmer, username: 'farmer', role: 'farmer' }, meta: { mode: 'live', persistence: 'postgres', requestId: 'test' } }), { status: 200, headers: { 'Content-Type': 'application/json' } })));
    const service = createDemoService(); service.mode = 'api'; vi.spyOn(service, 'extract').mockRejectedValue(new ApiError('Extraction is unavailable. Enter the fields manually.', 503, 'DEPENDENCY_UNAVAILABLE')); const save = vi.spyOn(service, 'createListing');
    const user = start('/app/farmer', 'farmer', service); await user.type(await screen.findByLabelText('Tell us about your harvest'), 'A harvest with incomplete details'); await user.click(screen.getByRole('button', { name: 'Review details' }));
    expect(await screen.findByRole('button', { name: 'Publish harvest' })).toBeInTheDocument(); expect(screen.getByText('Extraction is unavailable. Enter the fields manually.')).toBeInTheDocument(); expect(screen.getByLabelText('Quantity (whole kg)')).toHaveValue(null); expect(save).not.toHaveBeenCalled();
  });
  test('empty trip list can recover from a dependency failure', async () => {
    const service = createDemoService(); const load = vi.spyOn(service, 'listTrips').mockRejectedValueOnce(new ApiError('Routing storage is unavailable', 503)).mockResolvedValue({ data: [], meta: { mode: 'demo', persistence: 'session', requestId: 'test' } });
    const user = start('/app/transporter', 'transporter', service); await screen.findByText('Routing storage is unavailable'); await user.click(screen.getByRole('button', { name: 'Try again' })); expect(await screen.findByRole('heading', { name: 'The next journey starts here.' })).toBeInTheDocument(); expect(load).toHaveBeenCalledTimes(2);
  });
  test('rejection, stored-geometry layer toggles and fresh-harvest reset work', async () => {
    const service = createDemoService(); const listing = await service.createListing({ demoFarmerId: DEMO_IDS.farmer, crop: 'tomato', quantityKg: 80, pickup: { lat: 7.87, lng: 80.65 }, readyAt: colomboToUtc(tomorrowAt(8)), minNetMinor: 1600000, confirmed: true }); const generated = await service.generate(listing.data.id); const plan = generated.data.plan!;
    // Synthetic test-only geometry exercises rendering. It is never shipped as a road fixture.
    vi.spyOn(service, 'getPlan').mockResolvedValue({ data: { ...plan, quoteSnapshot: { ...plan.quoteSnapshot, baseGeometry: { type: 'LineString', coordinates: [[80.65, 7.87], [80.63, 7.29]] }, modifiedGeometry: { type: 'LineString', coordinates: [[80.65, 7.87], [80.64, 7.6], [80.63, 7.29]] } } }, meta: generated.meta });
    const user = start(`/app/farmer?listing=${listing.data.id}&plan=${plan.id}`, 'farmer', service); await user.click(await screen.findByRole('button', { name: 'Original route' })); expect(screen.getByRole('button', { name: 'Original route' })).toHaveAttribute('aria-pressed', 'true'); await user.click(screen.getByRole('button', { name: 'Proposed route' }));
    await user.click(screen.getByRole('button', { name: 'Reject proposal' })); await user.click(screen.getByRole('button', { name: 'Confirm rejection' })); expect(await screen.findByText('Proposal rejected', { selector: 'strong' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'New harvest' })); await user.click(screen.getByRole('button', { name: 'Start new harvest' })); expect(await screen.findByLabelText('Tell us about your harvest')).toHaveValue('');
  });
  test('stale acceptance shows a 409 error and leaves regeneration available', async () => {
    const service = createDemoService(); const listing = await service.createListing({ demoFarmerId: DEMO_IDS.farmer, crop: 'tomato', quantityKg: 80, pickup: { lat: 7.87, lng: 80.65 }, readyAt: colomboToUtc(tomorrowAt(8)), minNetMinor: 1600000, confirmed: true }); const plan = (await service.generate(listing.data.id)).data.plan!;
    vi.spyOn(service, 'decide').mockRejectedValue(new ApiError('This proposal is stale. Generate a new one.', 409, 'STALE_PLAN'));
    const user = start(`/app/farmer?listing=${listing.data.id}&plan=${plan.id}`, 'farmer', service); await user.click(await screen.findByRole('button', { name: 'Accept proposal' })); await user.click(screen.getByRole('button', { name: 'Confirm acceptance' })); expect(await screen.findByText('This proposal is stale. Generate a new one.')).toBeInTheDocument(); expect(screen.getByRole('button', { name: 'Generate another proposal' })).toBeEnabled();
  });
  test('manual entry, description editing, map changes and discard confirmations work', async () => {
    const user = start('/app/farmer', 'farmer'); const description = await screen.findByLabelText('Tell us about your harvest'); await user.type(description, 'A description to keep'); await user.click(screen.getByRole('button', { name: 'Enter details manually' }));
    await user.click(screen.getByRole('button', { name: 'Edit description' })); expect(screen.getByLabelText('Tell us about your harvest')).toHaveValue('A description to keep'); await user.click(screen.getByRole('button', { name: 'Enter details manually' }));
    await user.click(screen.getByRole('button', { name: 'Publish harvest' })); await user.click(screen.getByRole('link', { name: 'Choose a supported crop.' })); expect(screen.getByLabelText('Crop')).toHaveFocus();
    await user.click(screen.getByLabelText('I have checked the pickup pin.')); await user.click(await screen.findByRole('button', { name: 'Choose map pin' })); expect(screen.getByLabelText('Pickup latitude')).toHaveValue(7.8); expect(screen.getByLabelText('I have checked the pickup pin.')).not.toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Discard' })); await user.click(screen.getByRole('button', { name: 'Cancel' })); expect(screen.getByRole('button', { name: 'Publish harvest' })).toBeInTheDocument(); await user.click(screen.getByRole('button', { name: 'Discard' })); await user.click(screen.getByRole('button', { name: 'Discard details' })); expect(screen.getByLabelText('Tell us about your harvest')).toHaveValue('');
  });
  test('an incomplete no-proposal result provides a working retry', async () => {
    const service = createDemoService(); const listing = await service.createListing({ demoFarmerId: DEMO_IDS.farmer, crop: 'tomato', quantityKg: 80, pickup: { lat: 7.87, lng: 80.65 }, readyAt: colomboToUtc(tomorrowAt(8)), minNetMinor: 1700000, confirmed: true }); const generate = vi.spyOn(service, 'generate');
    const user = start(`/app/farmer?listing=${listing.data.id}`, 'farmer', service); await user.click(await screen.findByRole('button', { name: 'Find a proposal' })); expect(await screen.findByRole('heading', { name: 'No proposal from this incomplete search.' })).toBeInTheDocument(); await user.click(screen.getByRole('button', { name: 'Try again' })); await waitFor(() => expect(generate).toHaveBeenCalledTimes(2));
  });
  test('transporter clear form is reversible until confirmed', async () => {
    const user = start('/app/transporter', 'transporter'); await user.click(await screen.findByRole('button', { name: 'Try sample' })); await user.click(screen.getByRole('button', { name: 'Clear form' })); await user.click(await screen.findByRole('button', { name: 'Cancel' })); expect(screen.getByLabelText('Available capacity (whole kg)')).toHaveValue(120);
    await user.click(screen.getByRole('button', { name: 'Clear form' })); await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Clear form' })); expect(screen.getByLabelText('Available capacity (whole kg)')).toHaveValue(null);
  });
});


test('saved harvests can be reopened after signing out and back in', async () => {
  const service = createDemoService();
  const saved = await service.createListing({ demoFarmerId: DEMO_IDS.farmer, crop: 'tomato', quantityKg: 80, pickup: { lat: 7.87, lng: 80.65 }, readyAt: colomboToUtc(tomorrowAt(8)), minNetMinor: 1400000, confirmed: true });
  await service.createListing({ ...saved.data, demoFarmerId: '99999999-9999-4999-8999-999999999999', quantityKg: 999 });
  const user = start('/app/farmer', 'farmer', service);
  const list = await screen.findByRole('region', { name: 'My harvests' });
  expect(await within(list).findByText('80 kg tomato')).toBeInTheDocument();
  expect(within(list).queryByText('999 kg tomato')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Sign out' }));
  await user.click(await screen.findByRole('button', { name: 'Use farmer demo account' }));
  await user.click(screen.getByRole('button', { name: 'Enter demo' }));
  const restored = await screen.findByRole('region', { name: 'My harvests' });
  await user.click(await within(restored).findByRole('button', { name: /Open harvest/ }));
  expect(await screen.findByText('Harvest saved')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Find a proposal' })).toBeInTheDocument();
});


test('a delayed harvest response clears loading and enables actions after a deep link', async () => {
  const service = createDemoService();
  const saved = await service.createListing({ demoFarmerId: DEMO_IDS.farmer, crop: 'tomato', quantityKg: 80, pickup: { lat: 7.87, lng: 80.65 }, readyAt: colomboToUtc(tomorrowAt(8)), minNetMinor: 1400000, confirmed: true });
  let resolve!: (value: typeof saved) => void;
  const response = new Promise<typeof saved>(done => { resolve = done; });
  const getListing = vi.fn(() => response);
  start(`/app/farmer?listing=${saved.data.id}`, 'farmer', { ...service, getListing });
  await screen.findByLabelText('Loading your harvest');
  await act(async () => { resolve(saved); });
  expect(await screen.findByText('Harvest saved')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Find a proposal' })).toBeEnabled();
  expect(screen.queryByLabelText('Loading your harvest')).not.toBeInTheDocument();
  expect(getListing).toHaveBeenCalledTimes(1);
});
