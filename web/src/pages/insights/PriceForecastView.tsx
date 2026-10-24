import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowUpRight, ChartLineUp, Info } from '@phosphor-icons/react';
import { mlClient } from '../../api/mlClient';
import type { MlCatalog, PriceForecastResponse, PriceHistoryResponse } from '../../api/mlTypes';
import { CopyButton, ErrorNotice, ErrorSummary, Field, Skeleton } from '../../components/ui';
import { monthLabel, money, ProduceImage, usePrediction } from './shared';

const serialMonth = (value:string) => Number(value.slice(0,4))*12+Number(value.slice(5,7))-1;
export default function PriceForecastView({catalog,ready}:{catalog:MlCatalog;ready:boolean}) {
 const [produce,setProduce]=useState(Object.keys(catalog.produce)[0] || 'tomato');
 const [market,setMarket]=useState(Object.keys(catalog.markets)[0] || 'dambulla');
 const [target,setTarget]=useState(catalog.forecast_months[0] || '');
 const [history,setHistory]=useState<PriceHistoryResponse|null>(null);
 const [historyError,setHistoryError]=useState<unknown>(null);
 const [historyLoading,setHistoryLoading]=useState(false);
 const [historyRevision,setHistoryRevision]=useState(0);
 const [range,setRange]=useState('12');
 const [table,setTable]=useState(false);
 const [errors,setErrors]=useState<Record<string,string>>({});
 const heading=useRef<HTMLHeadingElement>(null);
 const form=useRef<HTMLFormElement>(null);
 const prediction=usePrediction<PriceForecastResponse>();
 const signature=JSON.stringify([produce,market,target]);
 const dirty=Boolean(prediction.result && signature!==prediction.signature);
 const fields={...prediction.fields,...errors};
 const forecast=prediction.result;
 useEffect(()=>{
  if(!catalog.forecast_months.includes(target))setTarget(catalog.forecast_months[0] || '');
 },[catalog.forecast_months]);
 useEffect(()=>{
  const controller=new AbortController();
  setHistoryLoading(true);setHistoryError(null);setHistory(null);
  mlClient.getPriceHistory(produce,market,controller.signal)
   .then(value=>{if(!controller.signal.aborted)setHistory(value);})
   .catch(error=>{if(!controller.signal.aborted)setHistoryError(error);})
   .finally(()=>{if(!controller.signal.aborted)setHistoryLoading(false);});
  return ()=>controller.abort();
 },[produce,market,historyRevision]);
 async function update(userInitiated=false) {
  const invalid:Record<string,string>={};
  if(!catalog.produce[produce])invalid.produceId='Choose a produce item.';
  if(!catalog.markets[market])invalid.marketId='Choose a market.';
  if(!catalog.forecast_months.includes(target))invalid.targetMonth='Choose an available forecast month.';
  setErrors(invalid);
  if(Object.keys(invalid).length){requestAnimationFrame(()=>form.current?.querySelector<HTMLElement>('[role="alert"]')?.focus());return;}
  if(!ready)return;
  await prediction.run(signal=>mlClient.getPriceForecast({produceId:produce,marketId:market,targetMonth:target},signal),signature,
   userInitiated?()=>requestAnimationFrame(()=>heading.current?.focus()):undefined);
 }
 useEffect(()=>{if(ready&&target)void update();},[ready]);
 function submit(event:FormEvent){event.preventDefault();void update(true);}
 const observed=(history?.prices||[]).slice(range==='all'?0:-Number(range)).map(p=>({month:p.month,value:p.price_per_kg_minor,forecast:false}));
 const plotted=forecast&&forecast.produce_id===history?.produce_id&&forecast.market_id===history?.market_id?forecast:null;
 const points=[...observed,...(plotted?[{month:plotted.target_month,value:plotted.forecast_price_per_kg_minor,forecast:true}]:[])];
 const xMin=points.length?serialMonth(points[0].month):0;
 const xMax=Math.max(xMin+1,...points.map(p=>serialMonth(p.month)));
 const low=points.length?Math.min(...points.map(p=>p.value))*.85:0;
 const high=Math.max(low+100,...points.map(p=>p.value*1.15));
 const x=(month:string)=>65+(serialMonth(month)-xMin)/(xMax-xMin)*630;
 const y=(value:number)=>215-(value-low)/(high-low)*170;
 const path=observed.map((p,i)=>(i?'L ':'M ')+x(p.month)+' '+y(p.value)).join(' ');
 const end=observed.at(-1);
 const labels=observed.filter((_,i)=>i===0||i===observed.length-1||i%Math.ceil(observed.length/4)===0);
 return <div className="price-workspace">
  <form className="produce-form" onSubmit={submit} ref={form} noValidate>
   <div className="section-topline"><div><span className="eyebrow">01 / Pick your produce</span><h2>What’s on your mind?</h2></div><span className="small muted">Six crops. More perspective.</span></div>
   <ErrorSummary errors={fields}/>
   <fieldset className="produce-picker"><legend className="sr-only">Produce item</legend>
    {Object.entries(catalog.produce).map(([id,item])=><label className={'produce-option '+(produce===id?'selected':'')} key={id}>
     <input type="radio" name="produceId" value={id} checked={produce===id} onChange={()=>setProduce(id)}/>
     <ProduceImage id={id} label={item.label} eager/><span>{item.label}</span><span className="produce-check" aria-hidden="true">{produce===id?'✓':''}</span>
    </label>)}
   </fieldset>
   <div className="forecast-controls">
    <Field name="marketId" label="Market" error={fields.marketId}><select value={market} onChange={e=>setMarket(e.target.value)}>{Object.entries(catalog.markets).map(([id,item])=><option key={id} value={id}>{item.label}</option>)}</select></Field>
    <Field name="targetMonth" label="Forecast month" error={fields.targetMonth}><select value={target} disabled={!catalog.forecast_months.length} onChange={e=>setTarget(e.target.value)}>
     {!catalog.forecast_months.length&&<option value="">No available months</option>}
     {catalog.forecast_months.map(month=><option key={month} value={month}>{monthLabel(month)}</option>)}
    </select></Field>
    <button className="button" disabled={!ready||prediction.loading||!target}>{prediction.loading?'Updating…':'Update forecast'}<ArrowUpRight size={20}/></button>
   </div>
   {!target&&<p className="notice notice-info" role="status">The historical data is too old for a current forecast. Updated data is needed before predictions can continue.</p>}
  </form>
  <ErrorNotice error={prediction.error} retry={()=>void update(true)}/>
  {dirty&&<p className="notice notice-info" role="status">Your selections have changed. Update the forecast to see their result. The previous result is shown below.</p>}
  {prediction.loading&&!forecast&&<div className="forecast-result-placeholder"><Skeleton label="Calculating your forecast…"/></div>}
  {forecast&&<section className={'forecast-result '+(dirty?'outdated-result':'')} aria-busy={prediction.loading}>
   <div className="forecast-result-copy">
    <span className="eyebrow">A look ahead / {catalog.markets[forecast.market_id]?.label}</span>
    <h2 tabIndex={-1} ref={heading}>{catalog.produce[forecast.produce_id]?.label} in {monthLabel(forecast.target_month)}</h2>
    <p className="forecast-amount">{money(forecast.forecast_price_per_kg_minor)}<span> / kg</span></p>
    <p className="forecast-comparison"><ChartLineUp size={18}/>{forecast.predicted_change_pct>0?'+':''}{forecast.predicted_change_pct}% compared with the latest known price</p>
    <div className="forecast-comparisons">
     <div><span>Latest known · {forecast.origin_month}</span><strong>{money(forecast.latest_known_price_per_kg_minor)}<small>/kg</small></strong></div>
     <div><span>Same month, last year</span><strong>{forecast.previous_year_price_per_kg_minor!==null?money(forecast.previous_year_price_per_kg_minor):'Unavailable'}<small>/kg</small></strong></div>
     <div><span>Forecast horizon</span><strong>{forecast.horizon_months} {forecast.horizon_months===1?'month':'months'}</strong></div>
    </div>
    <CopyButton label="Copy forecast" text={catalog.produce[forecast.produce_id]?.label+' · '+catalog.markets[forecast.market_id]?.label+' · '+forecast.target_month+': '+money(forecast.forecast_price_per_kg_minor)+'/kg. Synthetic-data demonstration.'}/>
   </div>
   <div className="forecast-produce-visual"><span className="produce-orbit" aria-hidden="true"/><ProduceImage id={forecast.produce_id} label={catalog.produce[forecast.produce_id]?.label||forecast.produce_id} eager/><span className="forecast-image-caption">Fresh perspective.<br/>Clearer possibilities.</span></div>
  </section>}
  <span className="sr-only" role="status">{forecast&&!prediction.loading?'Forecast updated for '+forecast.produce_id+', '+forecast.target_month:''}</span>
  <section className="history-section">
   <div className="section-topline"><div><span className="eyebrow">02 / The bigger picture</span><h2>Every season tells a story.</h2><p className="small muted">{catalog.produce[produce]?.label} in {catalog.markets[market]?.label} · synthetic monthly history</p></div>
    <div className="history-ranges" role="group" aria-label="History range">{[['12','12 months'],['36','3 years'],['all','All history']].map(([value,label])=><button key={value} type="button" aria-pressed={range===value} onClick={()=>setRange(value)}>{label}</button>)}</div>
   </div>
   <ErrorNotice error={historyError} retry={()=>setHistoryRevision(r=>r+1)}/>
   {historyLoading&&<Skeleton label="Loading historical prices…"/>}
   {!historyLoading&&points.length>0&&<div className="price-chart-panel">
    <div className="chart-legend"><span><i/>Observed history</span>{plotted&&<span><i className="forecast-key"/>Model forecast</span>}<span>LKR / kg</span></div>
    <svg viewBox="0 0 760 270" role="img" aria-label={'Historical price chart for '+produce+' in '+market+', '+observed.length+' monthly observations'}>
     {[0,.5,1].map(t=><g key={t}><line x1="65" x2="695" y1={45+t*170} y2={45+t*170} stroke="var(--border)" strokeDasharray="3 5"/><text x="55" y={49+t*170} textAnchor="end" fill="var(--muted)" fontSize="12">{Math.round((high-t*(high-low))/100)}</text></g>)}
     <path d={path} fill="none" stroke="var(--strong)" strokeWidth="2.5"/>
     {plotted&&end&&<><path d={'M '+x(end.month)+' '+y(end.value)+' L '+x(plotted.target_month)+' '+y(plotted.forecast_price_per_kg_minor)} fill="none" stroke="var(--strong)" strokeWidth="2.5" strokeDasharray="5 5"/><circle cx={x(plotted.target_month)} cy={y(plotted.forecast_price_per_kg_minor)} r="6" fill="var(--accent)" stroke="var(--ink)" strokeWidth="2"/></>}
     {labels.map(p=><text key={p.month} x={x(p.month)} y="246" fill="var(--muted)" fontSize="11" textAnchor="middle">{p.month}</text>)}
     {plotted&&<text x={x(plotted.target_month)} y="263" fill="var(--strong)" fontSize="11" textAnchor="middle">{plotted.target_month}</text>}
    </svg>
    <button className="text-button" type="button" aria-expanded={table} aria-controls="price-data-table" onClick={()=>setTable(!table)}>{table?'Hide price table':'View accessible price table'}<ArrowUpRight size={16}/></button>
    {table&&<div className="price-table-wrap" id="price-data-table"><table><caption>Historical and predicted prices</caption><thead><tr><th>Month</th><th>Price / kg</th><th>Source</th></tr></thead><tbody>{points.map(p=><tr key={p.month+p.forecast}><td>{p.month}</td><td>{money(p.value)}</td><td>{p.forecast?'Model forecast':'Synthetic history'}</td></tr>)}</tbody></table></div>}
   </div>}
   {!historyLoading&&!historyError&&!points.length&&<p className="empty-state">No historical prices are available for this selection.</p>}
   <p className="chart-footnote"><Info size={15}/> A forecast is a single monthly estimate. Dashed lines connect observations; they do not predict the intervening months.</p>
  </section>
 </div>;
}
