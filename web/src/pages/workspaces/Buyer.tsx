import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Basket, Plus, ArrowClockwise, CheckCircle, ArrowRight } from '@phosphor-icons/react';
import type { Order, Point, Meta } from '../../api/types';
import { ApiError } from '../../api/client';
import { DEMO_IDS } from '../../api/demo';
import { useApp } from '../../state/AppContext';
import { colomboToUtc, tomorrowAt, rupeesToMinor, money, dateTime, shortId } from '../../lib/format';
import { orderSchema, validationErrors } from '../../lib/validation';
import { Field, ErrorNotice, ErrorSummary, Confirm, CopyButton, Skeleton } from '../../components/ui';
import { LocationPicker } from '../../components/LocationPicker';
import { ModeNotice } from '../Workspace';
const empty = { crop: '', quantity: '', price: '', deadline: '' };
export default function Buyer() {
  const { service, notify, remember, identity } = useApp();
  const [params, setParams] = useSearchParams();
  const creating = params.get('view') === 'new';
  function createNew() {
    if (saved) { setForm(empty); setSaved(null); setErrors({}); setError(undefined); setPinConfirmed(false); setAllowsPartial(true); }
    setParams({ view: 'new' });
  }
  const [form, setForm] = useState(empty);
  const [delivery, setDelivery] = useState<Point>({ lat: 7.2906, lng: 80.6337 });
  const [allowsPartial, setAllowsPartial] = useState(true);
  const [pinConfirmed, setPinConfirmed] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [saved, setSaved] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const [error, setError] = useState<unknown>();
  const [listError, setListError] = useState<unknown>();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [meta, setMeta] = useState<Meta>();
  const [reset, setReset] = useState(false);
  const mounted = useRef(true);
  const load = useCallback(async () => { setLoading(true); setListError(undefined); try { const result = await service.listOrders(); if (!mounted.current) return; setOrders(result.data); setMeta(result.meta); result.data.forEach(row => remember({ title: `Order ${shortId(row.id)}`, description: `${row.remainingKg} kg ${row.crop} at ${money(row.pricePerKgMinor)}/kg`, href: `/app/buyer?order=${row.id}` })); } catch (e) { if (mounted.current) setListError(e); } finally { if (mounted.current) setLoading(false); } }, [service, remember]);
  useEffect(() => { mounted.current = true; void load(); return () => { mounted.current = false; }; }, [load]);
  const field = (key: keyof typeof empty) => ({ value: form[key], onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => { setForm(old => ({ ...old, [key]: e.target.value })); setSaved(null); } });
  function sample() { setForm({ crop: 'tomato', quantity: '100', price: '220', deadline: tomorrowAt(20) }); setAllowsPartial(true); setErrors({}); setSaved(null); notify('Sample order filled. Confirm your delivery pin before saving.'); }
  async function submit(event: FormEvent) {
    event.preventDefault(); if (locked.current || saved) return; setError(undefined); setSaved(null);
    const result = orderSchema.safeParse({ demoBuyerId: identity?.id ?? DEMO_IDS.buyer, crop: form.crop, remainingKg: form.quantity ? Number(form.quantity) : NaN, pricePerKgMinor: rupeesToMinor(form.price), delivery, deadlineAt: colomboToUtc(form.deadline), allowsPartial });
    const problems = result.success ? {} : validationErrors(result.error);
    if (!pinConfirmed) problems.deliveryConfirmation = 'Confirm your delivery pin before saving.';
    setErrors(problems); if (!result.success || !pinConfirmed) return;
    locked.current = true; setBusy(true);
    try { const response = await service.createOrder(result.data); setSaved(response.data); setMeta(response.meta); setOrders(old => [...old, response.data]); remember({ title: `Order ${shortId(response.data.id)}`, description: `${response.data.remainingKg} kg ${response.data.crop}`, href: `/app/buyer?order=${response.data.id}` }); setParams({ order: response.data.id }); notify('Your order has been saved.'); }
    catch (e) { setError(e); if (e instanceof ApiError) setErrors(Object.fromEntries(e.fields.map(f => [f.path, f.message]))); }
    finally { locked.current = false; setBusy(false); }
  }
  return <div className="workspace-grid"><div className="workspace-main"><nav className="harvest-navigation" aria-label="Buyer workspace views"><button className={`harvest-tab ${!creating ? 'active' : ''}`} aria-pressed={!creating} disabled={busy} onClick={() => setParams({})}><Basket size={18} />My orders</button><button className={`harvest-tab ${creating ? 'active' : ''}`} aria-pressed={creating} disabled={busy} onClick={createNew}><Plus size={18} />New order</button></nav>{saved && <div className="notice notice-success" role="status"><CheckCircle /><div><strong>Order saved successfully</strong><p>{saved.remainingKg} kg of {saved.crop}. ID: {saved.id}</p><CopyButton text={saved.id} label="Copy saved order ID" /></div></div>}{creating && <section className="panel"><div className="panel-topline"><span className="badge">Create an order</span><Basket size={28} /></div><h2>What are you<br />looking for?</h2><p className="muted">Make your requirements clear, from the first kilogram to the delivery window.</p><ErrorNotice error={error} />{meta && service.mode === 'api' && <ModeNotice meta={meta} />}
    <form onSubmit={submit} noValidate><ErrorSummary errors={errors} /><div className="form-grid"><Field name="crop" label="Crop" error={errors.crop}><select {...field('crop')}><option value="">Choose a crop</option><option value="tomato">Tomato</option><option value="potato">Potato</option><option value="carrot">Carrot</option></select></Field><Field name="remainingKg" label="Quantity needed (whole kg)" error={errors.remainingKg}><input type="number" min="1" step="1" {...field('quantity')} /></Field><Field name="pricePerKgMinor" label="Offered price per kg (LKR)" error={errors.pricePerKgMinor}><input inputMode="decimal" {...field('price')} /></Field><Field name="deadlineAt" label="Delivery deadline" error={errors.deadlineAt} hint="Sri Lanka time (Asia/Colombo)."><input type="datetime-local" {...field('deadline')} /></Field></div><label className="checkbox-label"><input type="checkbox" checked={allowsPartial} onChange={e => { setAllowsPartial(e.target.checked); setSaved(null); }} />Allow this order to be fulfilled in smaller, whole-listing deliveries.</label><p className="field-hint">The prototype matches whole harvest listings. Its matching policy requires partial fulfillment to be allowed.</p><LocationPicker label="Delivery" name="delivery" value={delivery} onChange={point => { setDelivery(point); setPinConfirmed(false); setSaved(null); }} errors={errors} /><label className="checkbox-label"><input id="deliveryConfirmation" type="checkbox" checked={pinConfirmed} onChange={e => setPinConfirmed(e.target.checked)} />I have checked the delivery pin.</label>{errors.deliveryConfirmation && <p className="field-error">{errors.deliveryConfirmation}</p>}<div className="button-row"><button className="button" disabled={busy || Boolean(saved)}>{busy ? 'Saving order…' : 'Save order'}<ArrowRight /></button><button type="button" className="button button-secondary" onClick={sample} disabled={busy}>Try sample</button><button type="button" className="text-button" onClick={() => setReset(true)} disabled={busy}>Clear form</button></div></form>
  </section>}{!creating && <section className="panel"><div className="panel-topline"><h2 className="compact-heading">Registered orders</h2><button className="icon-button" aria-label="Refresh orders" onClick={() => void load()} disabled={loading || busy}><ArrowClockwise /></button></div><ErrorNotice error={listError} retry={() => void load()} />{loading ? <Skeleton label="Loading orders" /> : !orders.length ? <div className="empty-state"><Basket size={32} /><h3>A fresh start.</h3><p>Add an order to tell growers what you need.</p><button className="button" onClick={createNew}><Plus />Add order</button></div> : <div className="record-list">{orders.map(row => <article id={`order-${row.id}`} className={`record ${params.get('order') === row.id ? 'selected-record' : ''}`} key={row.id}><div className="record-heading"><h3>{row.remainingKg} kg {row.crop}</h3><span className="badge">Open</span></div><p>{money(row.pricePerKgMinor)} per kg</p><p className="muted small">By {dateTime(row.deadlineAt)} · {row.allowsPartial ? 'Partial fulfillment allowed' : 'Full order only'}</p><div className="record-footer"><span className="small muted">{shortId(row.id)}</span><CopyButton text={row.id} label="Copy order ID" /></div></article>)}</div>}</section>}</div><aside className="workspace-aside"><img src="/images/buyer-480.webp" width="480" height="600" alt="Fresh tomatoes and carrots sorted for a produce buyer" loading="lazy" /><div className="aside-content"><Basket size={29} /><h3>Good produce starts<br />with a clear brief.</h3><p>Crop, quantity, price and timing help growers understand what you need.</p><ul><li>Set a clear delivery deadline</li><li>Confirm an accessible location</li><li>Review before committing</li></ul></div></aside>
    <Confirm open={reset} onClose={() => setReset(false)} onConfirm={() => { setForm(empty); setAllowsPartial(true); setPinConfirmed(false); setSaved(null); setErrors({}); setError(undefined); setReset(false); }} title="Clear this order form?" label="Clear form"><p>Your unsaved entries will be cleared. Orders already saved will remain in the list.</p></Confirm>
  </div>;
}
