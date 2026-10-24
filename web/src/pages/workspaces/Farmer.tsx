import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowRight, Sparkle, Plant, CheckCircle, Plus, PencilSimple, ArrowClockwise, ImageSquare } from '@phosphor-icons/react';
import type { Crop, Listing, ListingInput, Plan, GenerationResult, Point, PlaceCandidate } from '../../api/types';
import { ApiError } from '../../api/client';
import { DEMO_IDS } from '../../api/demo';
import { useApp } from '../../state/AppContext';
import { colomboToUtc, localDateInput, tomorrowAt, rupeesToMinor, money, shortId, dateTime } from '../../lib/format';
import { listingSchema, validationErrors } from '../../lib/validation';
import { Field, ErrorNotice, ErrorSummary, Confirm, CopyButton, Skeleton } from '../../components/ui';
import { LocationPicker } from '../../components/LocationPicker';
import Proposal from './Proposal';
export default function Farmer() {
  const { service, notify, remember, identity } = useApp();
  const [params, setParams] = useSearchParams();
  const [phase, setPhase] = useState<'describe' | 'review'>('describe');
  const [text, setText] = useState('');
  const [form, setForm] = useState({ crop: '', quantity: '', minimum: '', ready: '' });
  const [pickup, setPickup] = useState<Point>({ lat: NaN, lng: NaN });
  const [pinConfirmed, setPinConfirmed] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [listing, setListing] = useState<Listing | null>(null);
  const [harvests, setHarvests] = useState<Listing[]>([]);
  const [loadingHarvests, setLoadingHarvests] = useState(true);
  const [harvestsError, setHarvestsError] = useState<unknown>();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [outcome, setOutcome] = useState<GenerationResult | null>(null);
  const [blockedPlanId, setBlockedPlanId] = useState<string>();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState('');
  const lock = useRef(false);
  const imageInput = useRef<HTMLInputElement>(null);
  const resetting = useRef(false);
  const [publishInput, setPublishInput] = useState<ListingInput | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [questions, setQuestions] = useState<string[]>([]);
  const [placeQuery, setPlaceQuery] = useState('');
  const [placeCandidates, setPlaceCandidates] = useState<PlaceCandidate[]>([]);
  const [placeMessage, setPlaceMessage] = useState('');
  const [placeBusy, setPlaceBusy] = useState(false);
  const listingId = params.get('listing');
  const planId = params.get('plan');
  const loadHarvests = useCallback(async () => {
    setLoadingHarvests(true); setHarvestsError(undefined);
    try { const result = await service.listListings(identity?.id ?? DEMO_IDS.farmer); setHarvests(result.data); }
    catch (e) { setHarvestsError(e); }
    finally { setLoadingHarvests(false); }
  }, [service, identity?.id]);
  useEffect(() => { void loadHarvests(); }, [loadHarvests]);
  function openHarvest(row: Listing) {
    setListing(row); setPlan(null); setOutcome(null); setError(undefined); setErrors({});
    setParams({ listing: row.id });
  }
  const field = (key: keyof typeof form) => ({ value: form[key], onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(old => ({ ...old, [key]: e.target.value })) });
  useEffect(() => {
    if (resetting.current) { if (!listingId) resetting.current = false; return; }
    if (!listingId) { setBusy(current => current === 'load' ? '' : current); return; }
    let active = true; setBusy('load');
    service.getListing(listingId).then(result => { if (active) { setListing(result.data); setError(undefined); remember({ title: `Harvest ${shortId(result.data.id)}`, description: `${result.data.quantityKg} kg ${result.data.crop}`, href: `/app/farmer?listing=${result.data.id}` }); } }).catch(e => { if (active) setError(e); }).finally(() => { if (active) setBusy(''); });
    return () => { active = false; };
    // Loading is keyed by the URL, not by the response state it updates.
    // Depending on listing.id cancels this effect before finally can clear busy.
  }, [listingId, service, remember]);
  useEffect(() => {
    if (resetting.current) return;
    if (!planId) { setPlan(null); return; }
    if (plan?.id === planId) return;
    let active = true;
    service.getPlan(planId).then(result => { if (active) { setPlan(result.data); remember({ title: `Proposal ${shortId(result.data.id)}`, description: `${money(result.data.quoteSnapshot.netMinor)} estimated proceeds`, href: `/app/farmer?listing=${result.data.listingId}&plan=${result.data.id}` }); } }).catch(e => { if (active) setError(e); });
    return () => { active = false; };
  }, [planId, service, plan?.id, remember]);
  async function task(name: string, action: () => Promise<void>) {
    if (lock.current) return; lock.current = true; setBusy(name); setError(undefined);
    try { await action(); } catch (e) { setError(e); if (e instanceof ApiError && e.fields.length) setErrors(Object.fromEntries(e.fields.map(f => [f.path, f.message]))); }
    finally { setBusy(''); lock.current = false; }
  }
  function sample() { setText(`I have 80 kg of tomatoes in Dambulla. Ready ${colomboToUtc(tomorrowAt(8))}. Minimum net Rs. 16,000.`); setErrors({}); notify('Sample description added. Review and confirm all details before publishing.'); }
  async function uploadImage(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 3 * 1024 * 1024 || !file.size) {
      setErrors(old => ({ ...old, harvestImage: 'Choose a JPEG, PNG, or WebP image smaller than 3 MB.' }));
      input.value = '';
      return;
    }
    setErrors(old => { const rest = { ...old }; delete rest.harvestImage; return rest; });
    await task('image', async () => {
      const response = await service.readHarvestImage(file);
      const recognized = response.data.text.trim();
      if (!recognized) { setErrors(old => ({ ...old, harvestImage: 'No readable text was found. Type your description manually or try another image.' })); return; }
      const combined = text.trim() ? `${text.trim()}\n${recognized}` : recognized;
      if (combined.length > 5000) { setErrors(old => ({ ...old, harvestImage: 'The combined description exceeds 5,000 characters. Shorten it before uploading.' })); return; }
      setText(combined);
      notify('Text from the image was added. Review and correct it before continuing.');
    });
    input.value = '';
  }
  async function lookupPlace(place: string) {
    setPickup({ lat: NaN, lng: NaN }); setPinConfirmed(false); setPlaceCandidates([]);
    if (!place.trim()) { setPlaceMessage('Enter a pickup place or choose the pin on the map.'); return; }
    setPlaceBusy(true); setPlaceMessage('');
    try {
      const { data } = await service.resolveLocation(place.trim());
      setPlaceCandidates(data.candidates);
      if (data.candidates.length > 0) {
        setPickup(data.candidates[0].point);
        setPlaceMessage(data.candidates.length > 1
          ? 'The first place is shown on the map. Choose another suggestion if needed, then check the exact pickup pin.'
          : 'Approximate place found. Move the pin to the exact roadside pickup point, then confirm it.');
      } else setPlaceMessage('Place not found. Choose the pickup pin on the map or enter coordinates.');
    } catch { setPlaceMessage('Place lookup is unavailable. Choose the pickup pin on the map or enter coordinates.'); }
    finally { setPlaceBusy(false); }
  }
  async function extract(event: FormEvent) {
    event.preventDefault();
    if (!text.trim() || text.length > 5000) { setErrors({ harvestText: 'Enter a harvest description between 1 and 5,000 characters.' }); return; }
    setErrors({});
    await task('extract', async () => {
      try {
        const result = await service.extract({ text, localTimeContext: { now: new Date().toISOString(), timeZone: 'Asia/Colombo' } });
        const draft = result.data.draft;
        setForm({ crop: draft.crop || '', quantity: draft.quantityKg === null ? '' : String(draft.quantityKg), minimum: draft.minNetMinor === null ? '' : String(draft.minNetMinor / 100), ready: draft.readyAt ? localDateInput(draft.readyAt) : '' });
        setQuestions(result.data.questions);
        setPlaceQuery(draft.locationText ?? '');
        await lookupPlace(draft.locationText ?? '');
        setPhase('review');
      } catch (e) { setPhase('review'); setQuestions(['Extraction is unavailable. You can still enter your harvest details manually.']); throw e; }
    });
  }
  function preparePublish(event: FormEvent) {
    event.preventDefault(); setError(undefined);
    const result = listingSchema.safeParse({ demoFarmerId: identity?.id ?? DEMO_IDS.farmer, crop: form.crop, quantityKg: form.quantity ? Number(form.quantity) : NaN, pickup, readyAt: colomboToUtc(form.ready), minNetMinor: rupeesToMinor(form.minimum), confirmed });
    const problems = result.success ? {} : validationErrors(result.error);
    if (!pinConfirmed) problems.pickupConfirmation = 'Confirm that the pickup pin is correct.';
    setErrors(problems);
    if (result.success && pinConfirmed) setPublishInput(result.data);
  }
  async function publish() {
    if (!publishInput) return;
    await task('publish', async () => {
      const result = await service.createListing(publishInput);
      setListing(result.data);
      setHarvests(old => [result.data, ...old.filter(row => row.id !== result.data.id)]);
      setPublishInput(null);
      setParams({ listing: result.data.id });
      remember({ title: `Harvest ${shortId(result.data.id)}`, description: `${result.data.quantityKg} kg ${result.data.crop}`, href: `/app/farmer?listing=${result.data.id}` });
      notify('Your confirmed harvest has been saved.');
    });
  }
  async function generate() {
    if (!listing) return;
    await task('generate', async () => {
      const result = await service.generate(listing.id);
      setOutcome(result.data);
      setPlan(result.data.plan);
      setBlockedPlanId(undefined);
      setParams(result.data.plan ? { listing: listing.id, plan: result.data.plan.id } : { listing: listing.id });
      if (result.data.plan) remember({
        title: `Proposal ${shortId(result.data.plan.id)}`,
        description: `${money(result.data.plan.quoteSnapshot.netMinor)} estimated proceeds`,
        href: `/app/farmer?listing=${listing.id}&plan=${result.data.plan.id}`
      });
    });
  }
  async function decide(decision: 'accept' | 'reject') {
    if (!plan) return;
    await task('decision', async () => {
      try {
        const result = await service.decide(plan.id, decision);
        setPlan(result.data);
        notify(decision === 'accept' ? 'Pending buyer and transporter confirmations.' : 'Proposal rejected.');
      } catch (e) {
        if (e instanceof ApiError && e.status === 409) setBlockedPlanId(plan.id);
        throw e;
      }
    });
  }
  async function refreshPlan() {
    if (!plan) return;
    await task('refresh', async () => {
      const result = await service.getPlan(plan.id);
      setPlan(result.data);
      notify('Proposal refreshed.');
    });
  }
  function reset() {
    resetting.current = true;
    setListing(null);
    setPlan(null);
    setBlockedPlanId(undefined);
    setOutcome(null);
    setParams({});
    setText('');
    setPickup({ lat: NaN, lng: NaN });
    setPlaceQuery('');
    setPlaceCandidates([]);
    setPlaceMessage('');
    setForm({ crop: '', quantity: '', minimum: '', ready: '' });
    setPhase('describe');
    setErrors({});
    setError(undefined);
    setConfirmed(false);
    setPinConfirmed(false);
    setResetOpen(false);
    setQuestions([]);
  }
  return <div className="workspace-grid"><div className="workspace-main"><ErrorNotice error={error} />
    {!listing && phase === 'review' && <section className="panel" aria-label="Find pickup place"><h3>Find your pickup place</h3><p className="muted">Search a town or village from your description. The result is approximate; check the exact roadside pickup pin on the map below.</p><form onSubmit={event => { event.preventDefault(); void lookupPlace(placeQuery); }}><Field name="pickupPlace" label="Pickup town or village"><input id="pickupPlace" value={placeQuery} onChange={event => { setPlaceQuery(event.target.value); setPickup({ lat: NaN, lng: NaN }); setPinConfirmed(false); setPlaceCandidates([]); setPlaceMessage('Search this place or choose a pin manually.'); }} maxLength={120} placeholder="Dambulla / දඹුල්ල" /></Field><button className="button button-secondary" disabled={Boolean(busy) || placeBusy || !placeQuery.trim()}>{placeBusy ? 'Finding place…' : 'Find place'}</button></form>{placeMessage && <p className="small" role="status">{placeMessage}</p>}{placeCandidates.length > 1 && <div className="button-row" aria-label="Place suggestions">{placeCandidates.map((candidate, index) => <button key={`${candidate.label}-${index}`} type="button" className="button button-secondary" onClick={() => { setPickup(candidate.point); setPinConfirmed(false); setPlaceMessage('Approximate place selected. Move the pin to the exact roadside pickup point, then confirm it.'); }}>{candidate.label}</button>)}</div>}{service.mode === 'api' && <p className="small muted">Place search uses <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>. Search only place names; avoid personal details.</p>}</section>}
    {busy === 'load' ? <Skeleton label="Loading your harvest" /> : listing ? <section className="panel saved-listing"><div className="panel-topline"><span className="badge"><CheckCircle />Harvest saved</span><CopyButton text={listing.id} label="Copy listing ID" /></div><h2>{listing.quantityKg} kg of {listing.crop === 'tomato' ? 'tomatoes' : listing.crop === 'potato' ? 'potatoes' : 'carrots'}</h2><p className="muted">Listing {shortId(listing.id)} · Ready {dateTime(listing.readyAt)}</p><dl className="compact-details"><div><dt>Minimum net proceeds</dt><dd>{money(listing.minNetMinor)}</dd></div><div><dt>Pickup coordinates</dt><dd>{listing.pickup.lat.toFixed(4)}, {listing.pickup.lng.toFixed(4)}</dd></div></dl><div className="button-row"><button className="button" disabled={Boolean(busy)} onClick={generate}>{busy === 'generate' ? 'Finding options…' : plan ? 'Generate another proposal' : 'Find a proposal'}<ArrowRight /></button><button className="button button-secondary" disabled={Boolean(busy)} onClick={() => setResetOpen(true)}><Plus />New harvest</button></div></section> : phase === 'describe' ? <section className="panel"><div className="panel-topline"><span className="badge">Your harvest</span><Plant size={28} /></div><h2>What is ready<br />for its next journey?</h2><p className="muted">Describe your crop, quantity, location, ready date and minimum proceeds in English or Sinhala.</p><form onSubmit={extract} noValidate><ErrorSummary errors={errors} /><Field name="harvestText" label="Tell us about your harvest" error={errors.harvestText} hint="You will review and confirm everything before publishing."><textarea rows={6} value={text} onChange={e => setText(e.target.value)} maxLength={5000} disabled={Boolean(busy)} placeholder="For example: I have 80 kg of tomatoes in Dambulla…" /></Field><div className="button-row"><button className="button" disabled={Boolean(busy)}>{busy === 'extract' ? 'Reading your harvest…' : 'Review details'}<Sparkle /></button><button type="button" className="button button-secondary" onClick={sample} disabled={Boolean(busy)}>Try sample</button>{service.mode === 'api' && <><input ref={imageInput} className="sr-only" tabIndex={-1} aria-hidden="true" data-testid="harvest-image-file" type="file" accept="image/jpeg,image/png,image/webp" disabled={Boolean(busy)} onChange={event => { void uploadImage(event); }} /><button type="button" className="button button-secondary" onClick={() => imageInput.current?.click()} disabled={Boolean(busy)}><ImageSquare />{busy === 'image' ? 'Reading photo…' : 'Upload photo'}</button></>}</div>{service.mode === 'api' && <p className="small muted harvest-upload-hint">Upload a photo of English or Sinhala harvest notes (JPEG, PNG, or WebP; up to 3 MB). Check the added text before continuing.</p>}{errors.harvestImage && <p className="field-error" role="alert">{errors.harvestImage}</p>}<button type="button" className="text-button form-manual" onClick={() => { setPhase('review'); setErrors({}); }} disabled={Boolean(busy)}><PencilSimple />Enter details manually</button></form>{busy === 'extract' && <Skeleton label="Extracting harvest details" />}</section> : <section className="panel"><div className="panel-topline"><span className="badge">Review & confirm</span><button className="text-button" onClick={() => setPhase('describe')} disabled={Boolean(busy)}>Edit description</button></div><h2>Make it yours.<br />Check every detail.</h2>{questions.length > 0 && <div className="notice notice-info"><Sparkle /><p>{questions.join(' ')}</p></div>}<form onSubmit={preparePublish} noValidate><ErrorSummary errors={errors} /><div className="form-grid"><Field name="crop" label="Crop" error={errors.crop}><select {...field('crop')}><option value="">Choose a crop</option><option value="tomato">Tomato</option><option value="potato">Potato</option><option value="carrot">Carrot</option></select></Field><Field name="quantityKg" label="Quantity (whole kg)" error={errors.quantityKg}><input type="number" min="1" step="1" {...field('quantity')} /></Field><Field name="minNetMinor" label="Minimum net proceeds (LKR)" error={errors.minNetMinor} hint="The total you want after transport, not a per-kg price."><input inputMode="decimal" {...field('minimum')} /></Field><Field name="readyAt" label="Ready date & time" error={errors.readyAt} hint="Sri Lanka time (Asia/Colombo)."><input type="datetime-local" {...field('ready')} /></Field></div><LocationPicker label="Pickup" name="pickup" value={pickup} onChange={value => { setPickup(value); setPinConfirmed(false); }} errors={errors} /><label className="checkbox-label"><input id="pickupConfirmation" type="checkbox" checked={pinConfirmed} onChange={e => setPinConfirmed(e.target.checked)} />I have checked the pickup pin.</label>{errors.pickupConfirmation && <p className="field-error">{errors.pickupConfirmation}</p>}<label className="checkbox-label"><input id="confirmed" type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />I confirm these harvest details are correct.</label>{errors.confirmed && <p className="field-error">Confirm your harvest details before publishing.</p>}<div className="button-row"><button className="button" disabled={Boolean(busy)}>Publish harvest<ArrowRight /></button><button type="button" className="button button-secondary" onClick={() => setResetOpen(true)} disabled={Boolean(busy)}>Discard</button></div></form></section>}

    {outcome && !outcome.plan && service.mode === 'api' && outcome.mode === 'deterministic_fallback' && <p className="small muted" role="status">AI-assisted selection was unavailable or invalid during this search. No proposal was saved; review the recorded outcomes below or try again.</p>}
    {outcome && !outcome.plan && service.mode === 'api' && outcome.mode === 'stub' && <p className="small muted" role="status">This backend preview did not complete a proposal search.</p>}
    {busy === 'generate' && <div className="panel"><Skeleton label="Finding a proposal" /><p className="muted">Reviewing available options. Your minimum proceeds remain part of the decision.</p></div>}
    {outcome && !outcome.plan && <section className="panel empty-state" role="status"><Plant size={36} /><h2>{outcome.searchComplete ? 'No suitable proposal this time.' : 'No proposal from this incomplete search.'}</h2><p>{outcome.searchComplete ? 'Try adjusting your harvest requirements or check again when new orders and trips are available.' : 'The search is incomplete or the sample scenario does not meet your requirements. This does not prove that no real match exists.'}</p>{outcome.trace.map((entry, i) => <p className="small muted" key={i}>{entry.outcome}</p>)}{outcome.rejections.map((entry, i) => <p key={i}>{entry.codes.join(', ').replaceAll('_', ' ')}</p>)}<button className="button button-secondary" disabled={Boolean(busy)} onClick={generate}>Try again<ArrowClockwise /></button></section>}
    {plan && plan.id === planId && listing && plan.listingId !== listing.id && <ErrorNotice error={new Error('This proposal belongs to a different harvest. Open its matching listing before reviewing a decision.')} />}
    {plan && plan.id === planId && listing && plan.listingId === listing.id && <Proposal key={plan.id} plan={plan} listing={listing} searchComplete={plan.searchComplete ?? (outcome?.plan?.id === plan.id ? outcome.searchComplete : undefined)} decisionUnavailable={blockedPlanId === plan.id} busy={Boolean(busy)} onDecision={decide} onRefresh={() => void refreshPlan()} />}
    {outcome && (outcome.alternatives.length > 0 || outcome.rejections.length > 0) && <details className="panel trace-details"><summary>Other evaluated options</summary>{outcome.alternatives.map(quote => <div className="record" key={quote.quoteId}><h3>Order {shortId(quote.orderId)}</h3><p>Estimated proceeds: {money(quote.netMinor)}</p><p className="small muted">Transport: {money(quote.transportMinor)}. This is an evaluated alternative, not the selected proposal.</p></div>)}{outcome.rejections.map((rejection, index) => <p className="small muted" key={index}>Order {shortId(rejection.orderId)}: {rejection.codes.join(', ').replaceAll('_', ' ')}</p>)}</details>}
    <section className="panel" aria-labelledby="my-harvests-title">
      <div className="panel-topline"><h2 id="my-harvests-title" className="compact-heading">My harvests</h2><button className="icon-button" aria-label="Refresh harvests" disabled={loadingHarvests || Boolean(busy)} onClick={() => void loadHarvests()}><ArrowClockwise /></button></div>
      <ErrorNotice error={harvestsError} retry={() => void loadHarvests()} />
      {loadingHarvests ? <Skeleton label="Loading saved harvests" /> : !harvestsError && !harvests.length ? <div className="empty-state"><Plant size={32} /><h3>No saved harvests yet.</h3><p>Publish a harvest and it will appear here when you return.</p></div> : <div className="record-list">{harvests.map(row => <article key={row.id} className={`record ${listing?.id === row.id ? 'selected-record' : ''}`}><div className="record-heading"><h3>{row.quantityKg} kg {row.crop}</h3><span className="badge">{row.status}</span></div><p>Minimum proceeds: {money(row.minNetMinor)}</p><p className="small muted">Ready {dateTime(row.readyAt)}</p><div className="record-footer"><button className="text-button" aria-label={`Open harvest ${shortId(row.id)}`} disabled={Boolean(busy)} onClick={() => openHarvest(row)}>Open harvest<ArrowRight /></button><CopyButton text={row.id} label="Copy harvest ID" /></div></article>)}</div>}
    </section>
  </div><aside className="workspace-aside"><img src="/images/farmer-480.webp" width="480" height="600" alt="Farmer carefully picking ripe tomatoes" loading="lazy" /><div className="aside-content"><Plant size={29} /><h3>Your harvest.<br />Your decision.</h3><p>Review details, pickup location and estimated proceeds before taking the next step.</p><ul><li>Whole harvest quantities</li><li>Transparent transport estimates</li><li>Your minimum proceeds respected</li></ul><p className="small muted">Acceptance still requires buyer and transporter confirmations.</p></div></aside>
    <Confirm open={Boolean(publishInput)} onClose={() => setPublishInput(null)} onConfirm={() => void publish()} title="Publish this harvest?" label="Confirm publication" busy={busy === 'publish'}><p>You are publishing {publishInput?.quantityKg} kg of {publishInput?.crop} with minimum net proceeds of {money(publishInput?.minNetMinor || 0)}. Check that the pickup and ready time are correct.</p></Confirm>
    <Confirm open={resetOpen} onClose={() => setResetOpen(false)} onConfirm={reset} title={listing ? 'Start a new harvest?' : 'Discard these details?'} label={listing ? 'Start new harvest' : 'Discard details'}><p>{listing ? 'Your saved listing remains available through its ID. This opens a fresh harvest form.' : 'Your unsaved description and form entries will be cleared.'}</p></Confirm>
  </div>;
}
