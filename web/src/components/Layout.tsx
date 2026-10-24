import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { m as motion, useScroll, useSpring, useMotionValueEvent, useReducedMotion } from 'motion/react';
import { ArrowUp, ArrowUpRight, MagnifyingGlass, Moon, Sun, List, Plant, SignOut, ChatCircleDots, ArrowRight, Cookie, CheckCircle } from '@phosphor-icons/react';
import { useApp } from '../state/AppContext';
import { Modal } from './ui';
import { faqs } from '../lib/content';
import { Breadcrumbs } from './Breadcrumbs';
export function Brand() { return <Link to="/" className="brand" aria-label="CropConvoy home"><Plant size={33} weight="duotone" /><span>CropConvoy<span className="brand-period">.</span></span></Link>; }
export function Layout() {
  const app = useApp();
  const [menu, setMenu] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [help, setHelp] = useState(false);
  const [query, setQuery] = useState('');
  const [helpQuery, setHelpQuery] = useState('');
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const reduced = useReducedMotion();
  const { scrollYProgress, scrollY } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 160, damping: 30 });
  useMotionValueEvent(scrollY, 'change', value => setScrolled(previous => value > 550 ? previous || true : previous && false));
  useEffect(() => { setMenu(false); setSearchOpen(false); if (!location.search.includes('section=')) window.scrollTo({ top: 0, behavior: 'instant' }); document.getElementById('main-content')?.focus({ preventScroll: true }); }, [location.pathname, location.search]);
  useEffect(() => { const handler = (event: KeyboardEvent) => { if ((event.metaKey || event.ctrlKey) && event.key === 'k') { event.preventDefault(); setSearchOpen(value => !value); } }; window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler); }, []);
  const section = new URLSearchParams(location.search).get('section');
  const nav = <><Link to="/?section=how-it-works" aria-current={section === 'how-it-works' ? 'page' : undefined}>How it works</Link><Link to="/?section=for-everyone" aria-current={section === 'for-everyone' ? 'page' : undefined}>For everyone</Link><Link to="/?section=faq" aria-current={section === 'faq' ? 'page' : undefined}>FAQs</Link><Link to="/insights" aria-current={location.pathname === '/insights' ? 'page' : undefined}>Insights</Link></>;
  const pages = [
    { title: 'How it works', description: 'Publish a harvest, find a match, review a proposal.', href: '/?section=how-it-works' },
    { title: 'Insights', description: 'Synthetic produce price forecasts and planting recommendations.', href: '/insights' },
    { title: 'Farmer workspace', description: 'Harvest, pickup location and estimated proceeds.', href: '/app/farmer' },
    { title: 'Buyer workspace', description: 'Create and review crop orders.', href: '/app/buyer' },
    { title: 'Transporter workspace', description: 'Register a trip, capacity and pricing.', href: '/app/transporter' },
    ...faqs.map(f => ({ title: f.question, description: f.answer, href: `/?section=${f.id}` })), ...app.records,
  ];
  const matches = pages.filter(p => `${p.title} ${p.description}`.toLowerCase().includes(query.toLowerCase().trim()));
  function signout() { void app.logout().then(() => navigate('/login')); }
  return <>
    <a className="skip-link" href="#main-content" onClick={e => { e.preventDefault(); document.getElementById('main-content')?.focus(); }}>Skip to content</a>
    <motion.div className="scroll-progress" style={{ scaleX: reduced ? scrollYProgress : progress }} aria-hidden="true" />
    <header className="site-header"><Brand /><nav className="desktop-nav" aria-label="Main navigation">{nav}</nav><div className="header-actions">
      <button className="icon-button" aria-label="Search site" onClick={() => { setQuery(''); setSearchOpen(true); }}><MagnifyingGlass /></button>
      <button className="icon-button" aria-label={`Switch to ${app.theme === 'light' ? 'dark' : 'light'} mode`} onClick={app.toggleTheme}>{app.theme === 'light' ? <Moon /> : <Sun />}</button>
      {app.identity ? <><Link className="button button-small header-cta" to={`/app/${app.identity.role}`} aria-current={location.pathname === `/app/${app.identity.role}` ? 'page' : undefined}>Workspace<ArrowUpRight /></Link><button className="icon-button desktop-signout" aria-label="Sign out" onClick={signout}><SignOut /></button></> : <Link className="button button-small header-cta" to="/login" aria-current={location.pathname === '/login' ? 'page' : undefined}>Get started<ArrowUpRight /></Link>}
      <button className="icon-button mobile-menu-button" aria-label="Open mobile menu" aria-expanded={menu} onClick={() => setMenu(true)}><List size={25} /></button>
    </div></header>
    <main id="main-content" tabIndex={-1}><Breadcrumbs /><Outlet /></main>
    <footer className="site-footer"><div className="footer-top"><div><Brand /><p>Good harvests deserve a better way forward.</p></div><div className="footer-links">{nav}<button className="text-button" onClick={() => setHelp(true)}>Help & contact</button></div></div><div className="footer-bottom"><span>© {new Date().getFullYear()} CropConvoy. A harvest-to-market prototype.</span><button className="text-button" onClick={() => app.setPrivacyOpen(true)}>Privacy preferences</button><span>Made for Sri Lankan journeys.</span></div></footer>
    <div className={`floating-tools ${app.privacyOpen ? 'privacy-visible' : ''}`}>{scrolled && <button className="floating-button back-top" aria-label="Back to top" onClick={() => { window.scrollTo({ top: 0, behavior: reduced ? 'instant' : 'smooth' }); document.getElementById('main-content')?.focus({ preventScroll: true }); }}><ArrowUp /></button>}<button className="floating-button help-button" aria-label="Open help and contact" onClick={() => setHelp(true)}><ChatCircleDots size={25} /></button></div>
    <Modal open={menu} onOpenChange={setMenu} title="Explore CropConvoy" className="mobile-drawer"><nav className="drawer-links" aria-label="Mobile navigation">{nav}<Link to={app.identity ? `/app/${app.identity.role}` : '/login'} aria-current={location.pathname === (app.identity ? `/app/${app.identity.role}` : '/login') ? 'page' : undefined}>{app.identity ? 'Open workspace' : 'Get started'}<ArrowUpRight /></Link>{app.identity && <button className="text-button" onClick={signout}>Sign out<SignOut /></button>}</nav></Modal>
    <Modal open={searchOpen} onOpenChange={setSearchOpen} title="Find your way" description="Search CropConvoy pages, help and records loaded in this session.">
      <label className="search-field"><MagnifyingGlass /><input aria-label="Search CropConvoy" placeholder="Try transport, harvest or a listing ID…" value={query} onChange={e => setQuery(e.target.value)} autoComplete="off" onKeyDown={e => { if (e.key === 'Enter' && matches[0]) { navigate(matches[0].href); setSearchOpen(false); } }} /></label>
      <div className="search-results" aria-live="polite">{matches.length ? matches.slice(0, 12).map((item, i) => <Link key={`${item.href}-${i}`} className="search-result" to={item.href} onClick={() => setSearchOpen(false)}><span><strong>{item.title}</strong><small>{item.description}</small></span><ArrowUpRight /></Link>) : <p className="empty-state">No results for “{query}”. Try crop, order, transport or help.</p>}</div>
    </Modal>
    <Modal open={help} onOpenChange={setHelp} title="A little help, whenever you need it" description="Explore the demo, understand a proposal, or find the right workspace." className="help-panel">
      <input aria-label="Search help" placeholder="Search help…" value={helpQuery} onChange={e => setHelpQuery(e.target.value)} />
      <div className="help-topics">{faqs.filter(f => `${f.question} ${f.answer}`.toLowerCase().includes(helpQuery.toLowerCase())).map(f => <details key={f.id}><summary>{f.question}</summary><p>{f.answer}</p></details>)}{!faqs.some(f => `${f.question} ${f.answer}`.toLowerCase().includes(helpQuery.toLowerCase())) && <p>No help topics match. Try “demo” or “transport”.</p>}</div>
      <p className="muted small">No support phone or email is configured for this prototype. You can continue through the demo or read the FAQs here.</p><Link className="button" to={app.identity ? `/app/${app.identity.role}` : '/login'} onClick={() => setHelp(false)}>Open demo<ArrowRight /></Link>
    </Modal>
    {app.privacyOpen && <section className="privacy-banner" aria-label="Cookie and storage preferences"><Cookie size={28} /><div><strong>A small note on privacy</strong><p>We use browser storage for your demo session. Save your theme too, if you like. No advertising or analytics trackers.</p></div><div className="privacy-actions"><button className="button button-secondary button-small" onClick={() => app.choosePreferences('essential')}>Essential only</button><button className="button button-small" onClick={() => app.choosePreferences('preferences')}>Save preferences<CheckCircle /></button></div></section>}
    <div className={`toast ${app.message ? 'visible' : ''}`} role="status" aria-live="polite">{app.message && <><CheckCircle /><span>{app.message}</span></>}</div>
  </>;
}
