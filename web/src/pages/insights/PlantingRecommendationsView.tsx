import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowUpRight, CaretDown, Info, Plant, WarningCircle } from '@phosphor-icons/react';
import { mlClient } from '../../api/mlClient';
import type { Financials, MlCatalog, PlantingRecommendationsRequest, PlantingRecommendationsResponse } from '../../api/mlTypes';
import { ErrorNotice, ErrorSummary, Field, Skeleton } from '../../components/ui';
import { monthLabel, money, ProduceImage, usePrediction } from './shared';

function Breakdown({title, values}:{title:string; values:Financials}) {
  return <div className="projection-breakdown"><h4>{title}</h4><dl>
    <div><dt>Revenue</dt><dd>{money(values.revenue_minor)}</dd></div>
    <div><dt>Cultivation</dt><dd>− {money(values.cultivation_cost_minor)}</dd></div>
    <div><dt>Marketing & transport</dt><dd>− {money(values.marketing_cost_minor)}</dd></div>
    <div className="breakdown-total"><dt>Net return</dt><dd>{money(values.net_return_minor)}</dd></div>
  </dl></div>;
}

export default function PlantingRecommendationsView({catalog,ready}:{catalog:MlCatalog;ready:boolean}) {
  const [month,setMonth] = useState(catalog.planting_months[0] || '');
  const [region,setRegion] = useState('mild_midcountry');
  const [market,setMarket] = useState('dambulla');
  const [area,setArea] = useState('1');
  const [soil,setSoil] = useState('loam');
  const [ph,setPh] = useState('6');
  const [irrigation,setIrrigation] = useState(true);
  const [costs,setCosts] = useState<Record<string,string>>({});
  const [errors,setErrors] = useState<Record<string,string>>({});
  const prediction = usePrediction<PlantingRecommendationsResponse>();
  const heading = useRef<HTMLHeadingElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const signature = JSON.stringify([month,region,market,area,soil,ph,irrigation,costs]);
  const dirty = Boolean(prediction.result && signature !== prediction.signature);
  const fields = {...prediction.fields,...errors};
  const response = prediction.result;
  const climate = catalog.climate_profiles[region];
  const loss = catalog.assumptions.loss_rate*100;
  const priceDiscount = catalog.assumptions.stress_price_discount*100;
  const yieldDiscount = catalog.assumptions.stress_yield_discount*100;
  useEffect(() => {
    if (!catalog.planting_months.includes(month)) setMonth(catalog.planting_months[0] || '');
  }, [catalog.planting_months]);

  async function compare(userInitiated=false) {
    const invalid:Record<string,string> = {};
    if (!catalog.planting_months.includes(month)) invalid.plantingMonth = 'Choose an available planting month.';
    if (!catalog.climate_profiles[region]) invalid.regionProfile = 'Choose a region profile.';
    if (!catalog.markets[market]) invalid.marketId = 'Choose a market.';
    if (!area.trim() || !Number.isFinite(Number(area)) || Number(area)<0.1 || Number(area)>100) invalid.areaHa = 'Enter an area from 0.1 to 100 hectares.';
    if (!ph.trim() || !Number.isFinite(Number(ph)) || Number(ph)<0 || Number(ph)>14) invalid.soilPh = 'Enter a pH from 0 to 14.';
    const overrides:Record<string,number> = {};
    Object.entries(costs).forEach(([crop,value]) => {
      if (value.trim()) {
        if (!Number.isFinite(Number(value)) || Number(value)<0 || Number(value)>1_000_000_000) invalid['cultivationCostOverride.'+crop] = 'Enter a cost from LKR 0 to 1,000,000,000.';
        else overrides[crop] = Number(value);
      }
    });
    setErrors(invalid);
    if (Object.keys(invalid).length) { requestAnimationFrame(() => form.current?.querySelector<HTMLElement>('[role="alert"]')?.focus()); return; }
    if (!ready) return;
    const req:PlantingRecommendationsRequest = {plantingMonth:month,regionProfile:region,marketId:market,
      areaHa:Number(area),soilType:soil,soilPh:Number(ph),irrigationAvailable:irrigation,
      ...(Object.keys(overrides).length ? {cultivationCostOverride:overrides} : {})};
    await prediction.run(signal => mlClient.getPlantingRecommendations(req,signal), signature,
      userInitiated ? () => requestAnimationFrame(() => heading.current?.focus()) : undefined);
  }
  useEffect(() => { if (ready && month) void compare(); },[ready]);
  function submit(event:FormEvent) { event.preventDefault(); void compare(true); }

  return <div className="planting-layout">
    <form className="planting-form" ref={form} onSubmit={submit} noValidate>
      <span className="eyebrow">01 / Start with your land</span><h2>A good season<br/>starts here.</h2>
      <p className="small muted">A few details help us compare what could grow next.</p>
      <ErrorSummary errors={fields}/>
      <Field name="plantingMonth" label="Planting month" error={fields.plantingMonth}>
        <select value={month} onChange={e => setMonth(e.target.value)}>{catalog.planting_months.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}</select>
      </Field>
      <Field name="regionProfile" label="Region climate profile" error={fields.regionProfile}>
        <select value={region} onChange={e => setRegion(e.target.value)}>{Object.entries(catalog.climate_profiles).map(([id,c]) => <option key={id} value={id}>{c.label}</option>)}</select>
      </Field>
      <p className="climate-note">{climate?.temp_mean}°C · {climate?.rainfall_mean} mm monthly rainfall assumed</p>
      <Field name="marketId" label="Target sales market" error={fields.marketId}>
        <select value={market} onChange={e => setMarket(e.target.value)}>{Object.entries(catalog.markets).map(([id,m]) => <option key={id} value={id}>{m.label}</option>)}</select>
      </Field>
      <div className="planting-input-pair">
        <Field name="areaHa" label="Area (hectares)" error={fields.areaHa}><input type="number" min="0.1" max="100" step="0.1" value={area} onChange={e => setArea(e.target.value)}/></Field>
        <Field name="soilPh" label="Soil pH" error={fields.soilPh}><input type="number" min="0" max="14" step="0.1" value={ph} onChange={e => setPh(e.target.value)}/></Field>
      </div>
      <Field name="soilType" label="Soil type" error={fields.soilType}><select value={soil} onChange={e => setSoil(e.target.value)}>
        <option value="loam">Loam</option><option value="sandy_loam">Sandy loam</option><option value="clay">Clay</option>
      </select></Field>
      <label className="irrigation-choice"><input type="checkbox" checked={irrigation} onChange={e => setIrrigation(e.target.checked)}/><span>Irrigation available<small>Uncheck for rain-fed cultivation</small></span></label>
      <details className="cost-assumptions">
        <summary>Assumptions & cultivation costs<CaretDown size={16}/></summary>
        <div><p className="small muted">{loss}% post-harvest loss and {money(catalog.assumptions.marketing_transport_lkr_kg*100)}/kg marketing and transport. Stress scenario: price −{priceDiscount}%, yield −{yieldDiscount}%.</p>
          {Object.entries(catalog.crops).map(([id,crop]) => <Field key={id} name={'cultivationCostOverride.'+id} label={crop.label+' cost (LKR/ha)'} error={fields['cultivationCostOverride.'+id]} hint={'Default: '+money(crop.cost_lkr_ha*100)}>
            <input type="number" min="0" max="1000000000" step="0.01" placeholder={String(crop.cost_lkr_ha)} value={costs[id] || ''} onChange={e => setCosts({...costs,[id]:e.target.value})}/>
          </Field>)}
        </div>
      </details>
      <button className="button" disabled={!ready || prediction.loading || !month}>{prediction.loading ? 'Comparing…' : 'Compare planting options'}<ArrowUpRight size={20}/></button>
      <p className="small muted planting-form-note">The current month uses today’s date in Sri Lanka. Future months start on the first day.</p>
    </form>
    <section className="planting-results" aria-busy={prediction.loading}>
      <div className="section-topline"><div><span className="eyebrow">02 / Explore your possibilities</span><h2 ref={heading} tabIndex={-1}>Room to grow.</h2>
        <p className="small muted">{response ? monthLabel(response.planting_month)+' · '+catalog.markets[response.market_id]?.label+' · '+response.area_ha+' ha' : 'Your comparisons will appear here.'}</p>
      </div><Plant size={28} className="results-leaf"/></div>
      <ErrorNotice error={prediction.error} retry={() => void compare(true)}/>
      {dirty && <p className="notice notice-info" role="status">Your inputs have changed. Compare again to update these previous results.</p>}
      {prediction.loading && !response && <Skeleton label="Comparing planting options…"/>}
      {response && response.recommendations.length > 0 && response.recommendations.every(r => r.stressed.net_return_minor <= 0) && <div className="notice notice-error" role="alert"><WarningCircle size={22}/><div><strong>No positive-return option under these assumptions.</strong><p>Every eligible option breaks even or loses money in the stress scenario. The ranking shows relative outcomes, not a planting recommendation.</p></div></div>}
      {response && !response.recommendations.length && <div className="planting-empty"><Plant size={40}/><h3>No suitable crops in this comparison.</h3><p>All three options fall outside the supported conditions or forecast window. See the reasons below.</p></div>}
      {response?.recommendations.map((rec,index) => {
        const positive = rec.stressed.net_return_minor > 0;
        const zero = rec.stressed.net_return_minor === 0;
        const top = index === 0;
        const badge = top ? positive ? 'Recommended under these assumptions' : zero ? 'Break-even option' : 'Lowest projected loss' : 'Option '+(index+1);
        return <article key={rec.crop_id} className={'crop-projection '+(top && positive ? 'best-projection ' : '')+(dirty ? 'outdated-result' : '')}>
          <div className="crop-projection-top"><div className="crop-thumbnail"><ProduceImage id={rec.crop_id} label={rec.crop_label}/></div><div className="crop-identity"><span className={'projection-rank '+(!positive ? 'rank-caution' : '')}>{badge}</span><h3>{rec.crop_label}</h3><p>{catalog.crops[rec.crop_id]?.duration_days} days to harvest · {rec.harvest_month}</p></div><span className="projection-number" aria-hidden="true">{String(index+1).padStart(2,'0')}</span></div>
          <div className="projection-returns">
            <div><span>Stressed net return / hectare</span><strong className={!positive ? 'negative-return' : ''}>{money(rec.stressed.net_return_per_ha_minor)}</strong></div>
            <div><span>Central net return / hectare</span><strong>{money(Math.round(rec.central.net_return_minor/rec.area_ha))}</strong></div>
          </div>
          <dl className="projection-facts"><div><dt>Predicted yield</dt><dd>{rec.predicted_yield_kg_ha.toLocaleString()}<small> kg/ha</small></dd></div><div><dt>Harvest-month price</dt><dd>{money(rec.forecast_price_per_kg_minor)}<small>/kg</small></dd></div></dl>
          <details className="projection-details"><summary>See the numbers & harvest schedule<CaretDown size={16}/></summary>
            <p className="small muted">Plant {rec.planting_date} → Harvest {rec.harvest_date}. Projected {rec.central.harvested_kg.toLocaleString()} kg harvested; {rec.central.sellable_kg.toLocaleString()} kg sellable. Model forecast using synthetic data.</p>
            <div className="projection-scenarios"><Breakdown title={'Central · '+rec.area_ha+' ha'} values={rec.central}/><Breakdown title={'Stressed · '+rec.area_ha+' ha'} values={rec.stressed}/></div>
          </details>
        </article>;
      })}
      {response && response.exclusions.length > 0 && <section className="crop-exclusions"><h3>Outside this comparison</h3><p className="small muted">These options don’t meet the demo’s supported conditions.</p>
        {response.exclusions.map(ex => <article key={ex.crop_id}><div className="exclusion-thumbnail"><ProduceImage id={ex.crop_id} label={ex.crop_label}/></div><div><h4>{ex.crop_label}</h4><ul>{ex.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul></div></article>)}
      </section>}
      <span className="sr-only" role="status">{response && !prediction.loading ? 'Comparison complete. '+response.recommendations.length+' eligible crops.' : ''}</span>
      <p className="chart-footnote"><Info size={16}/> Stress testing assumes {priceDiscount}% lower prices and {yieldDiscount}% lower yields. It is an illustrative scenario, not a confidence interval.</p>
    </section>
  </div>;
}
