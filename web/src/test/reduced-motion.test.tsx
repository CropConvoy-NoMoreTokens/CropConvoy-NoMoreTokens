import { test, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LazyMotion, domAnimation } from 'motion/react';
import Landing from '../pages/Landing';
vi.mock('motion/react', async original => ({ ...await original<typeof import('motion/react')>(), useReducedMotion: () => true }));
test('reduced motion leaves content visible and section navigation instant', async () => {
  render(<LazyMotion features={domAnimation}><MemoryRouter initialEntries={['/?section=faq']}><Landing /></MemoryRouter></LazyMotion>);
  expect(screen.getByRole('heading', { name: /Better harvests/ }).parentElement).not.toHaveStyle({ opacity: 0 });
  await waitFor(() => expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ behavior: 'instant', block: 'start' }));
});


test('prediction workspace stays visible with reduced motion', async () => {
  const { AppRoutes } = await import('../App');
  const { AppProvider } = await import('../state/AppContext');
  const { createDemoService } = await import('../api/demo');
  const { mockCatalog, mockHealth, mockHistory, mockForecast } = await import('./mlFixtures');
  vi.stubGlobal('fetch', vi.fn((url: string) => Promise.resolve(new Response(JSON.stringify(
    String(url).includes('/catalog') ? mockCatalog :
    String(url).includes('/health') ? mockHealth :
    String(url).includes('/history') ? mockHistory : mockForecast
  ), {status: 200}))));
  render(<AppProvider service={createDemoService()}><MemoryRouter initialEntries={['/insights']}><AppRoutes /></MemoryRouter></AppProvider>);
  const title = await screen.findByRole('heading', {name: /Plan your.*next harvest/});
  expect(title.closest('.insights-page')).not.toHaveStyle({opacity: 0});
  expect(await screen.findByRole('heading', {name: 'Tomato in October 2026'})).toBeInTheDocument();
  vi.unstubAllGlobals();
});
