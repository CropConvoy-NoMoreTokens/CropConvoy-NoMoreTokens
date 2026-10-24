import './insights/insights.css';
import { m, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowClockwise, ArrowUpRight, Cpu, Leaf, ChartLineUp } from '@phosphor-icons/react';
import { mlClient } from '../api/mlClient';
import type { MlCatalog, MlHealth } from '../api/mlTypes';
import { ErrorNotice, Skeleton } from '../components/ui';
import PriceForecastView from './insights/PriceForecastView';
import PlantingRecommendationsView from './insights/PlantingRecommendationsView';

export default function Insights() {
  const reduced = useReducedMotion();
  const [params, setParams] = useSearchParams();
  const active = params.get('tab') === 'planting' ? 'planting' : 'prices';
  const [catalog, setCatalog] = useState<MlCatalog | null>(null);
  const [health, setHealth] = useState<MlHealth | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [healthError, setHealthError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(null); setHealth(null); setHealthError(null);
    Promise.allSettled([mlClient.getCatalog(controller.signal), mlClient.getHealth(controller.signal)])
      .then(([cat, status]) => {
        if (controller.signal.aborted) return;
        if (cat.status === 'fulfilled') setCatalog(cat.value); else setError(cat.reason);
        if (status.status === 'fulfilled') setHealth(status.value); else setHealthError(status.reason);
        setLoading(false);
      });
    return () => controller.abort();
  }, [revision]);
  const ready = Boolean(health?.models_loaded && /^(cpu|cuda(:\d+)?)$/.test(health.inference_device));
  const engineLabel = health?.inference_device === 'cpu' ? 'CPU ready' : 'GPU ready';
  function changeTab(index:number) {
    setParams(index === 1 ? {tab:'planting'} : {});
  }
  return <m.div initial={reduced ? false : {opacity:0,y:12}} animate={{opacity:1,y:0}} transition={{duration:.35}} className="workspace section-container insights-page">
    <header className="insights-intro">
      <div><span className="eyebrow"><Leaf size={17}/> A little foresight. A better season.</span>
        <h1>Plan your<br/><span>next harvest.</span></h1>
        <p>Explore market prices. Find what could grow next.<br className="desktop-only"/> Put the numbers behind your next move.</p>
      </div>
      <div className="insights-intro-note">
        <span className="demo-stamp">Synthetic-data demo</span>
        <p>A space to explore possibilities.<br/>Generated data, transparent assumptions.</p>
        <details className="engine-details"><summary><span className={'engine-dot ' + (ready ? 'online' : '')}/>{loading ? 'Connecting…' : ready ? engineLabel : 'Predictions unavailable'}<Cpu size={16}/></summary>
          <div>{health && <><p>{health.gpu_name}</p><p>Verified inference: {health.inference_device}</p><p>History through {health.data_cutoff}</p><p>Feature version {health.feature_version}</p></>}
            {Boolean(healthError) && <p>The inference service or models are not ready. Retry when the service is available.</p>}
            <button type="button" className="text-button" disabled={loading} onClick={() => setRevision(r => r + 1)}><ArrowClockwise/> Check again</button>
          </div>
        </details>
      </div>
    </header>
    <div className="insights-tabs" role="tablist" aria-label="Prediction tools">
      {(['prices','planting'] as const).map((tab,index) => <button key={tab} ref={el => { tabs.current[index] = el; }}
        id={'insights-tab-' + tab} role="tab" aria-selected={active === tab} aria-controls={'insights-panel-' + tab}
        tabIndex={active === tab ? 0 : -1} onClick={() => changeTab(index)}
        onKeyDown={event => { if (['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) {
          event.preventDefault(); const next = event.key === 'Home' ? 0 : event.key === 'End' ? 1 : 1-index;
          changeTab(next); tabs.current[next]?.focus();
        } }} className={active === tab ? 'active' : ''}>
        {index === 0 ? <ChartLineUp size={20}/> : <Leaf size={20}/>}
        <span>{index === 0 ? 'Price forecast' : 'What to plant'}</span><ArrowUpRight size={18}/>
      </button>)}
    </div>
    <ErrorNotice error={error} retry={() => setRevision(r => r + 1)}/>
    {!loading && catalog && !ready && <div className="notice notice-info" role="status"><span>Predictions are unavailable right now. Your entries and historical prices are still accessible.</span><button className="text-button" onClick={() => setRevision(r => r + 1)}>Try again</button></div>}
    {loading && !catalog && <div className="prediction-tools-placeholder"><Skeleton label="Loading prediction tools…"/></div>}
    {catalog && <section role="tabpanel" id={'insights-panel-' + active} aria-labelledby={'insights-tab-' + active}>
      {active === 'prices' ? <PriceForecastView key="prices" catalog={catalog} ready={ready}/> : <PlantingRecommendationsView key="planting" catalog={catalog} ready={ready}/>}
    </section>}
    <p className="insights-disclaimer">Built to demonstrate possibilities, using synthetic data. These projections are illustrative and are not validated farming or trading advice.</p>
  </m.div>;
}
