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
