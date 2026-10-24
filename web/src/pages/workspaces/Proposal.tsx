import { useEffect, useState } from 'react';
import { CheckCircle, ArrowClockwise, ArrowRight, MapPin, Info } from '@phosphor-icons/react';
import type { Plan, Listing } from '../../api/types';
import { money, dateTime, shortId } from '../../lib/format';
import { CopyButton, Confirm } from '../../components/ui';
import { RouteMap } from '../../components/LocationPicker';
import { statusLabel } from '../../components/ProposalHistory';
import { useApp } from '../../state/AppContext';
export default function Proposal({ plan, listing, busy, searchComplete, decisionUnavailable = false, onDecision, onRefresh }: { plan: Plan; listing: Listing; busy: boolean; searchComplete?: boolean; decisionUnavailable?: boolean; onDecision(decision: 'accept' | 'reject'): Promise<void>; onRefresh(): void }) {
  const { service } = useApp();
  const [decision, setDecision] = useState<'accept' | 'reject' | null>(null);
  const [layer, setLayer] = useState<'original' | 'proposed'>('proposed');
  const [now, setNow] = useState(Date.now);
  const expiresAt = Math.min(Date.parse(plan.expiresAt), Date.parse(plan.quoteSnapshot.expiresAt ?? plan.expiresAt));
  const expired = !Number.isFinite(expiresAt) || expiresAt <= now;
  useEffect(() => {
    if (expired) return;
    const timer = setTimeout(() => setNow(Date.now()), Math.min(expiresAt - now, 2_147_483_647));
    return () => clearTimeout(timer);
  }, [expiresAt, now, expired]);
  useEffect(() => { if (expired || decisionUnavailable) setDecision(null); }, [expired, decisionUnavailable]);
  const unavailable = busy || expired || decisionUnavailable;
  const quotedListing = plan.sourceSnapshot?.listing ?? listing;
  const points = plan.sourceSnapshot ? [
    { ...plan.sourceSnapshot.trip.start, label: 'Trip start' },
    { ...quotedListing.pickup, label: 'Harvest pickup' },
    { ...plan.sourceSnapshot.order.delivery, label: 'Buyer delivery' },
    { ...plan.sourceSnapshot.trip.end, label: 'Trip end' },
  ] : [{ ...quotedListing.pickup, label: 'Harvest pickup' }];
  const quote = plan.quoteSnapshot;
  const breakdown = quote.pricingVersion === 'weight-distance-v2' &&
    typeof quote.shipmentChargeMinor === 'number' && typeof quote.detourChargeMinor === 'number' &&
    typeof quote.routeCarryDistanceM === 'number' && typeof quote.ratePerKgKmMinor === 'number'
    ? { shipment: quote.shipmentChargeMinor, detour: quote.detourChargeMinor,
      carryingDistanceM: quote.routeCarryDistanceM, rate: quote.ratePerKgKmMinor } : null;
  const geometry = layer === 'original' ? quote.baseGeometry : quote.modifiedGeometry;
  const summary = `CropConvoy ${service.mode === 'demo' ? 'demo estimate' : 'proposal'} ${plan.id}\n${quote.quantityKg} kg ${quotedListing.crop}\nSale: ${money(quote.grossMinor)}\nTransport: ${money(quote.transportMinor)}\nEstimated proceeds: ${money(quote.netMinor)}\nStatus: ${plan.status}\n${plan.status==='confirmed'?'Booking confirmed.':'Buyer and transporter confirmations are required.'}`;
  return <section className="proposal-panel panel" aria-labelledby="proposal-title"><div className="panel-topline"><span className="badge">{service.mode === 'demo' ? 'Sample estimate' : 'Your proposal'}</span><CopyButton text={summary} label="Copy proposal" /></div><h2 id="proposal-title">A clearer picture of your proceeds.</h2><p>{plan.review.explanation}</p><dl className="earnings-lines"><div><dt>Sale amount <small>{quote.quantityKg} kg × {money(quote.pricePerKgMinor)}</small></dt><dd>{money(quote.grossMinor)}</dd></div><div><dt>{service.mode === 'demo' ? 'Sample transport' : 'Transport estimate'}</dt><dd>− {money(quote.transportMinor)}</dd></div>{breakdown && <><div><dt>Base charge</dt><dd>{money(quote.baseMinor)}</dd></div><div><dt>Carrying <small>{quote.quantityKg} kg × {(breakdown.carryingDistanceM / 1000).toFixed(2)} km × {money(breakdown.rate)}/kg/km</small></dt><dd>{money(breakdown.shipment)}</dd></div><div><dt>Added detour</dt><dd>{money(breakdown.detour)}</dd></div><div><dt>Handling</dt><dd>{money(quote.handlingMinor)}</dd></div></>}<div className="net-line"><dt>Estimated proceeds</dt><dd>{money(quote.netMinor)}</dd></div><div><dt>Your minimum</dt><dd>{money(quotedListing.minNetMinor)}</dd></div></dl><p className="small muted">Before production costs and other unspecified fees.</p>
    <div className="proposal-info"><span><CheckCircle />Buyer order {shortId(plan.orderId)}</span><span><MapPin />Trip {shortId(plan.tripId)}</span></div>
    <h3>Locations & route</h3>{quote.baseGeometry && quote.modifiedGeometry && <div className="segmented-control" aria-label="Route layer"><button className={layer === 'original' ? 'active' : ''} aria-pressed={layer === 'original'} onClick={() => setLayer('original')}>Original route</button><button className={layer === 'proposed' ? 'active' : ''} aria-pressed={layer === 'proposed'} onClick={() => setLayer('proposed')}>Proposed route</button></div>}
    <RouteMap points={points} geometry={geometry} />{!geometry ? <p className="notice notice-info"><Info />Road route pending. Only selected location pins are shown; road distance, feasibility and delivery timing are not validated.</p> : <p className="small muted">{plan.status==='confirmed'?'Agreed route.':'Proposed route requires transporter approval.'} Pickup {dateTime(quote.pickupAt)}; delivery {dateTime(quote.deliveryAt)} (Sri Lanka time).</p>}
    {service.mode === 'api' && searchComplete !== true && <p className="notice notice-info" role="status">{searchComplete === false ? 'Search incomplete. Review this evaluated proposal; more options may be available.' : 'Search completeness was not recorded for this proposal. It does not establish the best option across all buyers and trips.'}</p>}
    <details className="trace-details"><summary>View recorded actions and constraints</summary><ul>{plan.trace.map((entry, i) => <li key={i}><strong>{entry.role}: </strong>{entry.outcome}</li>)}</ul><ul>{Object.entries(quote.ruleOutcomes).map(([key, value]) => <li key={key}>{key.replace(/([A-Z])/g, ' $1')}: {value ? 'yes' : 'pending / not met'}</li>)}</ul></details>
    {plan.status === 'proposed' ? <>{(expired || decisionUnavailable) && <p className="notice notice-info" role="status">{expired ? 'This proposal has expired. Generate another proposal before deciding.' : 'This proposal needs to be regenerated or its recorded decision refreshed before deciding again.'}</p>}<p className="small muted">Review before {Number.isFinite(expiresAt) ? dateTime(new Date(expiresAt).toISOString()) : 'regenerating this proposal'}. Acceptance records your interest; it does not book transport.</p><div className="button-row"><button className="button" disabled={unavailable} onClick={() => setDecision('accept')}>Accept proposal<ArrowRight /></button><button className="button button-secondary" disabled={unavailable} onClick={() => setDecision('reject')}>Reject proposal</button></div></> : <div className={`notice ${plan.status === 'rejected' ? 'notice-info' : 'notice-success'}`} role="status"><CheckCircle /><div><strong>{statusLabel(plan.status)}</strong><p>{service.mode === 'demo' ? 'Your demo decision is saved in this browser session.' : 'Your decision has been recorded.'}</p></div></div>}
    {plan.booking && <p className="notice notice-info">Farmer accepted · Buyer {plan.booking.buyer} · Driver {plan.booking.driver}{plan.status==='farmer_accepted_pending_confirmations' ? ` · Approve before ${dateTime(plan.booking.approvalExpiresAt)}. Space and demand are not reserved yet.` : ''}{plan.booking.confirmedAt ? ` · Confirmed ${dateTime(plan.booking.confirmedAt)}` : ''}</p>}
    <button className="text-button refresh-proposal" disabled={busy} onClick={onRefresh}><ArrowClockwise />Refresh proposal</button>
    <Confirm open={Boolean(decision)} onClose={() => setDecision(null)} title={decision === 'accept' ? 'Accept this proposal?' : 'Reject this proposal?'} label={decision === 'accept' ? 'Confirm acceptance' : 'Confirm rejection'} busy={busy} onConfirm={() => { if (decision && !unavailable) void onDecision(decision).then(() => setDecision(null)); }}><p>{decision === 'accept' ? 'Buyer and transporter confirmations will still be pending. This does not reserve stock or book a vehicle.' : 'This proposal will be marked as rejected. You can generate another proposal afterwards.'}</p>{service.mode === 'demo' && <p className="muted">This is a simulated demo decision only.</p>}</Confirm>
  </section>;
}
