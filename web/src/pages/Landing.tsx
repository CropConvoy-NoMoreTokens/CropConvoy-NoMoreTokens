import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, Plant, Basket, Truck, CheckCircle, CaretDown, Handshake, MapPin } from '@phosphor-icons/react';
import { m as motion, useReducedMotion } from 'motion/react';
import { Reveal } from '../components/ui';
import { faqs } from '../lib/content';
import { money } from '../lib/format';
const roles = [
  { id: 'farmer', label: 'For farmers', title: 'Your harvest. Your next opportunity.', body: 'Tell us what is ready. Set your minimum proceeds. Review the buyer, transport and costs before you decide.', image: 'farmer', alt: 'Sri Lankan farmer harvesting fresh tomatoes in a green field', icon: Plant, action: 'Explore farmer demo' },
  { id: 'buyer', label: 'For buyers', title: 'Find a harvest that fits your needs.', body: 'Share the crops, quantities and delivery window you need. Keep your requirements clear from the start.', image: 'buyer', alt: 'Fresh tomatoes and carrots being checked at a produce market', icon: Basket, action: 'Explore buyer demo' },
  { id: 'transporter', label: 'For transporters', title: 'Make more of the journey ahead.', body: 'Register where you are going, available space and detour limits. Review proposed pickups before any commitment.', image: 'transport', alt: 'Vegetable crates being loaded into a small farm delivery vehicle', icon: Truck, action: 'Explore transporter demo' },
];
export default function Landing() {
  const [role, setRole] = useState(0);
  const [params] = useSearchParams();
  const reduced = useReducedMotion();
  const active = roles[role];
  useEffect(() => {
    const section = params.get('section');
    if (!section) return;
    const node = document.getElementById(section);
    if (node instanceof HTMLDetailsElement) node.open = true;
    const frame = requestAnimationFrame(() => { node?.scrollIntoView({ behavior: reduced ? 'instant' : 'smooth', block: 'start' }); node?.focus({ preventScroll: true }); });
    return () => cancelAnimationFrame(frame);
  }, [params, reduced]);
  return <>
    <section className="hero" aria-labelledby="hero-title"><picture><source media="(max-width: 640px)" srcSet="/images/hero-mobile.webp" /><img className="hero-photo" src="/images/hero-1920.webp" width="1920" height="1080" alt="Green Sri Lankan farmland at sunrise with harvest crates and a small delivery truck" fetchPriority="high" /></picture><div className="hero-scrim" /><div className="hero-content">
      <motion.div initial={reduced ? false : { opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .65 }}><p className="hero-eyebrow"><Plant size={18} /> From field to possibility</p><h1 id="hero-title">Better harvests.<br /><span>Better journeys.</span></h1><p className="hero-description">Connect your harvest with buyers and transport, with clear costs before you decide.</p><div className="button-row"><Link className="button hero-primary" to="/login">Get started<span className="button-arrow"><ArrowUpRight /></span></Link><Link className="hero-secondary" to="/?section=how-it-works">How it works<ArrowRight /></Link></div></motion.div>
    </div></section>
    <section className="intro-section section-container"><Reveal><p className="intro-lead">A good harvest is only<br className="desktop-break" /> the beginning.</p></Reveal><Reveal delay={.1}><div className="intro-copy"><p>Getting it to the right buyer should feel just as considered. CropConvoy brings harvests, buyer needs and transport plans into one clear conversation.</p><p className="muted">Built around what matters: your produce, your route, and the proceeds you take home.</p><Link className="inline-link" to="/?section=for-everyone">A place for every part of the journey<ArrowUpRight /></Link></div></Reveal></section>
    <section id="how-it-works" tabIndex={-1} className="process-section section-container"><Reveal><div className="section-heading"><p className="eyebrow">A clearer way forward</p><h2>From ready to go,<br />with you in control.</h2></div></Reveal><div className="process-grid">
      <Reveal className="process-item"><Plant size={34} weight="duotone" /><h3>Share your harvest</h3><p>Describe what is ready, choose your pickup point, and confirm the details that matter.</p></Reveal>
      <Reveal className="process-item" delay={.09}><MapPin size={34} weight="duotone" /><h3>Explore the match</h3><p>Review a compatible buyer and a proposed transport option, with the costs clearly laid out.</p></Reveal>
      <Reveal className="process-item" delay={.18}><Handshake size={34} weight="duotone" /><h3>Make your decision</h3><p>See estimated proceeds and choose your next step. Buyer and transporter approvals still come next.</p></Reveal>
    </div></section>
    <section id="for-everyone" tabIndex={-1} className="roles-section section-container"><Reveal><div className="section-heading"><h2>Different roles.<br />One better connection.</h2></div></Reveal><div className="role-tabs" role="tablist" aria-label="Explore CropConvoy roles">{roles.map((item, i) => <button key={item.id} id={`role-tab-${item.id}`} role="tab" aria-selected={i === role} aria-controls="role-panel" tabIndex={i === role ? 0 : -1} onClick={() => setRole(i)} onKeyDown={e => { if (['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(e.key)) { e.preventDefault(); const next = e.key === 'Home' ? 0 : e.key === 'End' ? 2 : (role + (e.key === 'ArrowRight' ? 1 : 2)) % 3; setRole(next); document.getElementById(`role-tab-${roles[next].id}`)?.focus(); } }}><item.icon size={20} />{item.label}</button>)}</div>
      <div className="role-feature" id="role-panel" role="tabpanel" aria-labelledby={`role-tab-${active.id}`}><div className="role-image"><img key={active.image} src={`/images/${active.image}-800.webp`} srcSet={`/images/${active.image}-480.webp 480w, /images/${active.image}-800.webp 800w`} sizes="(max-width: 767px) 100vw, 50vw" alt={active.alt} width="800" height="1000" loading="lazy" /></div><div className="role-feature-copy"><active.icon size={44} weight="duotone" /><h3>{active.title}</h3><p>{active.body}</p><Link className="button" to={`/login?role=${active.id}`}>{active.action}<ArrowUpRight /></Link><span className="small muted">Explore with sample accounts and clearly labeled demo data.</span></div></div>
    </section>
    <section className="earnings-section section-container"><Reveal className="earnings-copy"><p className="eyebrow">Every rupee, in the open</p><h2>See what you<br />could take home.</h2><p>A higher sale price is only part of the picture. Review transport costs and estimated net proceeds together.</p><Link className="inline-link" to="/login?role=farmer">Try the farmer demo<ArrowUpRight /></Link></Reveal><Reveal className="earnings-card" delay={.1}><div className="card-heading"><span className="badge">Illustrative example</span><Plant size={26} /></div><h3>80 kg of tomatoes</h3><p className="muted">At Rs. 220 per kilogram</p><dl className="earnings-lines"><div><dt>Sale amount</dt><dd>{money(1760000)}</dd></div><div><dt>Sample transport</dt><dd>− {money(95000)}</dd></div><div className="net-line"><dt>Estimated proceeds</dt><dd>{money(1665000)}</dd></div></dl><p className="estimate-note"><CheckCircle />Before production costs and other unspecified fees. Sample pricing, not a validated shipment offer.</p></Reveal></section>
    <section id="faq" tabIndex={-1} className="faq-section section-container"><Reveal><div className="section-heading"><h2>A few things<br />you might wonder.</h2><p>Clear answers, before your next step.</p></div></Reveal><div className="faq-list">{faqs.map(f => <details id={f.id} tabIndex={-1} key={f.id}><summary>{f.question}<CaretDown /></summary><p>{f.answer}</p></details>)}</div></section>
    <section className="closing-section section-container"><Reveal><Plant size={40} weight="duotone" /><h2>Good things grow<br />when we connect.</h2><Link className="button" to="/login">Get started<ArrowUpRight /></Link></Reveal></section>
  </>;
}
