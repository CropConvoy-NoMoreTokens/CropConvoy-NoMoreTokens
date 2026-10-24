import { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from '../state/AppContext';
import type { ProposalSummary } from '../api/types';
import { money, dateTime, shortId } from '../lib/format';
import { Confirm, ErrorNotice, Skeleton } from './ui';
import { RouteMap } from './LocationPicker';

export const statusLabel = (status: string) => ({ farmer_accepted_pending_confirmations: 'Pending buyer and transporter confirmations.', confirmed: 'Booking confirmed', proposed: 'Awaiting farmer decision', declined: 'Declined by buyer or driver', rejected: 'Proposal rejected', expired: 'Expired', unavailable: 'No longer available', superseded: 'Another proposal selected' }[status] ?? status);
export default function ProposalHistory({ listingId, onOpen }: { listingId?: string; onOpen?: (id: string) => void }) {
  const {service,identity}=useApp();
  const request=useRef(0);
  const [items,setItems]=useState<ProposalSummary[]>([]),[cursor,setCursor]=useState<string|null>(null);
  const [count,setCount]=useState(0),[loading,setLoading]=useState(true),[error,setError]=useState<unknown>();
  const [filter,setFilter]=useState<'pending'|'history'|'all'>(onOpen?'all':'pending');
  const [routeLayer,setRouteLayer]=useState<'original'|'proposed'>('proposed');
  const [selected,setSelected]=useState<ProposalSummary|null>(null),[decision,setDecision]=useState<'approve'|'reject'|null>(null),[busy,setBusy]=useState(false);
  const load=useCallback(async (next?:string)=>{
    const version=++request.current; setLoading(true);setError(undefined);
    try {const result=await service.listPlans({listingId,status:filter,cursor:next});if(version!==request.current)return;setItems(old=>next?[...old,...result.data.items]:result.data.items);setCursor(result.data.nextCursor);setCount(result.data.pendingCount);}
    catch(e){if(version===request.current)setError(e);}finally{if(version===request.current)setLoading(false);}
  },[service,listingId,filter]);
  useEffect(()=>{void load();return ()=>{request.current++;};},[load]);
  async function decide(){if(!selected || !decision || !identity)return;setBusy(true);setError(undefined);let failure:unknown;
    try {await service.approve(selected.id,identity.role==='buyer'?'buyer':'driver',decision);setSelected(null);}
    catch(e){failure=e;setSelected(null);}finally{setDecision(null);setBusy(false);await load();if(failure)setError(failure);}}
  return <section className="panel" aria-label={onOpen?'Proposal history':'Approvals'}><div className="panel-topline"><h2 className="compact-heading">{onOpen?'Proposal history':`Approvals (${count} pending)`}</h2><button className="text-button" disabled={loading||busy} onClick={()=>void load()}>Refresh proposals</button></div>
    {!onOpen && <div className="segmented-control"><button className={filter==='pending'?'active':''} onClick={()=>{setFilter('pending');setSelected(null);}}>Pending</button><button className={filter==='history'?'active':''} onClick={()=>{setFilter('history');setSelected(null);}}>History</button></div>}
    {!onOpen && service.mode==='demo' && <p className="notice notice-info">Buyer and driver approvals require API mode and PostgreSQL. Demo estimates are not bookings.</p>}
    <ErrorNotice error={error} retry={()=>void load()} />
    {loading && <Skeleton label="Loading proposal history" />}
    {!loading && !error && !items.length && <p className="empty-state">{onOpen?'No saved proposals for this harvest yet.':'No proposals in this view.'}</p>}
    <div className="record-list">{items.map(row=><article className="record" key={row.id}><div className="record-heading"><h3>{row.quantityKg} kg {row.crop}</h3><span className="badge">{statusLabel(row.status)}</span></div><p>{dateTime(row.createdAt)} · {shortId(row.id)}</p><p>Purchase amount {money(row.grossMinor)} · Transport {money(row.transportMinor)}</p>{row.netMinor!==undefined && <p>Estimated proceeds {money(row.netMinor)}</p>}<button className="text-button" disabled={busy||loading} onClick={()=>onOpen?onOpen(row.id):setSelected(row)}>{onOpen?'Open proposal':'Review proposal'}</button></article>)}</div>
    {cursor && <button className="button button-secondary" disabled={loading} onClick={()=>void load(cursor)}>Load more proposals</button>}
    {selected && <section className="record" aria-label="Approval details"><h3>{statusLabel(selected.status)}</h3><p>Reference: {selected.id}</p><p>{selected.quantityKg} kg × {money(selected.pricePerKgMinor??0)} per kg · Purchase {money(selected.grossMinor)} · Transport {money(selected.transportMinor)}</p>{selected.legacy && <p className="notice notice-info">This older tariff is read-only. The farmer must generate a new proposal before it can be approved.</p>}<p>Pickup {dateTime(selected.pickupAt)} · Delivery {dateTime(selected.deliveryAt)}</p><p>Pickup: {selected.pickup?.lat}, {selected.pickup?.lng}<br/>Delivery: {selected.delivery?.lat}, {selected.delivery?.lng}</p><p>Buyer: {selected.booking?.buyer ?? 'pending'} · Driver: {selected.booking?.driver ?? 'pending'}</p>
      {identity?.role==='transporter' && <><div className="segmented-control" aria-label="Approval route layer"><button aria-pressed={routeLayer==='original'} className={routeLayer==='original'?'active':''} onClick={()=>setRouteLayer('original')}>Original route</button><button aria-pressed={routeLayer==='proposed'} className={routeLayer==='proposed'?'active':''} onClick={()=>setRouteLayer('proposed')}>Proposed route</button></div><RouteMap points={[...(selected.pickup?[{...selected.pickup,label:'Harvest pickup'}]:[]),...(selected.delivery?[{...selected.delivery,label:'Buyer delivery'}]:[])]} geometry={routeLayer==='original'?selected.baseGeometry:selected.modifiedGeometry}/><p>Carrying {selected.quantityKg} kg over {((selected.routeCarryDistanceM??0)/1000).toFixed(2)} km at {money(selected.ratePerKgKmMinor??0)}/kg/km. Extra distance {((selected.extraDistanceM??0)/1000).toFixed(2)} km.</p><p>Base {money(selected.baseMinor??0)} · Carrying {money(selected.shipmentChargeMinor??0)} · Detour {money(selected.detourChargeMinor??0)} · Handling {money(selected.handlingMinor??0)}</p></>}
      <p>Approval deadline: {dateTime(selected.booking?.approvalExpiresAt??selected.expiresAt)}</p><p className="small muted">Pending approval does not reserve order quantity or vehicle space. One shipment per confirmed trip.</p>
      {selected.status==='farmer_accepted_pending_confirmations' && !selected.legacy && selected.booking?.[identity?.role==='buyer'?'buyer':'driver']==='pending' && Date.parse(selected.booking.approvalExpiresAt)>Date.now() && service.mode==='api' && <div className="button-row"><button className="button" disabled={busy} onClick={()=>setDecision('approve')}>Approve proposal</button><button className="button button-secondary" disabled={busy} onClick={()=>setDecision('reject')}>Reject proposal</button></div>}
      <button className="text-button" disabled={busy} onClick={()=>setSelected(null)}>Close details</button></section>}
    <Confirm open={Boolean(decision)} onClose={()=>setDecision(null)} title={decision==='approve'?'Approve this proposal?':'Reject this proposal?'} label={decision==='approve'?'Confirm approval':'Confirm rejection'} busy={busy} onConfirm={()=>void decide()}><p>{decision==='approve'?'The booking is confirmed only after all parties approve and availability is checked.':'This ends the pending proposal for all parties.'}</p></Confirm>
  </section>;
}
