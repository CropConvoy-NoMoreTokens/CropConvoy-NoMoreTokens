import { beforeEach, describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { PlantingRecommendationsResponse } from '../api/mlTypes';
import { AppProvider } from '../state/AppContext';
import { createDemoService } from '../api/demo';
import { AppRoutes } from '../App';
import { mockCatalog, mockHealth, mockHistory, mockForecast, mockRecommendations } from './mlFixtures';

let catalog=structuredClone(mockCatalog);
let health=structuredClone(mockHealth);
let failNetwork=false;
let forecastCalls = 0;
let plantingCalls = 0;
let failForecast = false;
let failHealth = false;
let deferred: ((response:Response)=>void) | null = null;
let deferForecast = false;
let recommendations:PlantingRecommendationsResponse = structuredClone(mockRecommendations);
const json = (data:unknown,status=200) => new Response(JSON.stringify(data),{status});
beforeEach(() => {
  health=structuredClone(mockHealth);
  catalog=structuredClone(mockCatalog); failNetwork=false;
  forecastCalls=0; plantingCalls=0; failForecast=false; failHealth=false;
  deferred=null; deferForecast=false; recommendations=structuredClone(mockRecommendations);
  vi.stubGlobal('fetch',vi.fn((url:string,options?:RequestInit) => {
    const path=String(url);
    if (path.includes('/v1/catalog')) return Promise.resolve(json(catalog));
    if (path.endsWith('/health')) return Promise.resolve(json(failHealth ? {detail:{message:'Inference unavailable'}} : health,failHealth ? 503 : 200));
    if (path.includes('/history')) {
      const parsed=new URL(path);
      return Promise.resolve(json({...mockHistory,produce_id:parsed.searchParams.get('produceId'),market_id:parsed.searchParams.get('marketId')}));
    }
    if (path.includes('/forecast')) {
      forecastCalls++;
      if (failNetwork) return Promise.reject(new Error('Offline'));
      if (deferForecast) return new Promise<Response>(resolve => { deferred=resolve; });
      if (failForecast) return Promise.resolve(json({detail:{message:'Check month',fields:[{path:'targetMonth',message:'Choose a supported month.'}]}},422));
      const request=JSON.parse(String(options?.body));
      return Promise.resolve(json({...mockForecast,produce_id:request.produceId,market_id:request.marketId,target_month:request.targetMonth}));
    }
    if (path.includes('/recommendations')) { plantingCalls++; return Promise.resolve(json(recommendations)); }
    return Promise.reject(new Error('Unexpected request '+path));
  }));
});
function setup(path='/insights') {
  render(<AppProvider service={createDemoService()}><MemoryRouter initialEntries={[path]}><AppRoutes/></MemoryRouter></AppProvider>);
  return userEvent.setup();
}
async function loaded() { await screen.findByRole('heading',{name:/Tomato in October/i}); }

describe('Prediction demo',() => {
 test('CPU inference is ready and can produce forecasts', async () => {
  health.inference_device='cpu'; health.gpu_name='CPU';
  setup(); await loaded();
  expect(screen.getByText('CPU ready')).toBeInTheDocument();
  expect(forecastCalls).toBeGreaterThan(0);
  expect(screen.queryByText('Predictions unavailable')).not.toBeInTheDocument();
 });
 test('shows generated produce choices, verified status, history ranges and accessible table',async() => {
  const user=setup(); await loaded();
  expect(screen.getByRole('heading',{level:1})).toHaveTextContent('Plan yournext harvest.');
  expect(screen.getByText('Synthetic-data demo')).toBeInTheDocument();
  expect(screen.getByText('GPU ready')).toBeInTheDocument();
  expect(screen.getAllByRole('radio')).toHaveLength(6);
  expect(document.querySelector('img[src*="carrot-320"]')).toHaveAttribute('width','320');
  await user.click(screen.getByRole('button',{name:'All history'}));
  await user.click(screen.getByRole('button',{name:'View accessible price table'}));
  expect(within(screen.getByRole('table')).getByText('2016-01')).toBeInTheDocument();
  await user.click(screen.getByRole('button',{name:'Hide price table'}));
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
 });
 test('preserves previous result until explicit update and submits the selected fruit',async() => {
  const user=setup(); await loaded();
  await user.click(screen.getByRole('radio',{name:'Banana'}));
  expect(screen.getByText(/Your selections have changed/)).toBeInTheDocument();
  expect(forecastCalls).toBe(1);
  await user.click(screen.getByRole('button',{name:'Update forecast'}));
  await screen.findByRole('heading',{name:/Banana in October/i});
  expect(forecastCalls).toBe(2);
 });
 test('blocks duplicate submissions and identifies results for older inputs',async() => {
  const user=setup(); await loaded(); deferForecast=true;
  await user.click(screen.getByRole('button',{name:'Update forecast'}));
  expect(screen.getByRole('button',{name:'Updating…'})).toBeDisabled();
  await user.click(screen.getByRole('radio',{name:'Carrot'}));
  deferred?.(json(mockForecast));
  await waitFor(()=>expect(screen.getByRole('button',{name:'Update forecast'})).toBeEnabled());
  expect(forecastCalls).toBe(2);
  expect(screen.getByRole('heading',{name:/Tomato in October/i})).toBeInTheDocument();
  expect(screen.getByText(/Your selections have changed/)).toBeInTheDocument();
 });
 test('ignores a deferred result after switching workflows',async() => {
  const user=setup(); await loaded(); deferForecast=true;
  await user.click(screen.getByRole('button',{name:'Update forecast'}));
  await user.click(screen.getByRole('tab',{name:'What to plant'}));
  await screen.findByText('Recommended under these assumptions');
  deferred?.(json({...mockForecast,forecast_price_per_kg_minor:999999}));
  expect(screen.queryByRole('heading',{name:/Tomato in October/i})).not.toBeInTheDocument();
 });
 test('shows API field feedback and keeps inputs and previous results on failure',async() => {
  const user=setup(); await loaded(); failForecast=true;
  await user.click(screen.getByRole('button',{name:'Update forecast'}));
  expect(await screen.findByText('Choose a supported month.',{selector:'.field-error'})).toBeInTheDocument();
  expect(screen.getByRole('combobox',{name:'Forecast month'})).toHaveValue('2026-10');
  expect(screen.getByRole('heading',{name:/Tomato in October/i})).toBeInTheDocument();
  failForecast=false;
  await user.click(screen.getByRole('button',{name:'Try again'}));
  await waitFor(()=>expect(screen.queryByText('Check month')).not.toBeInTheDocument());
 });
 test('supports keyboard tabs and planting financial details',async() => {
  const user=setup(); await loaded();
  screen.getByRole('tab',{name:'Price forecast'}).focus();
  await user.keyboard('{ArrowRight}');
  expect(screen.getByRole('tab',{name:'What to plant'})).toHaveAttribute('aria-selected','true');
  await screen.findByText('Recommended under these assumptions');
  const details=screen.getAllByText('See the numbers & harvest schedule')[0];
  await user.click(details);
  expect(screen.getAllByText('Marketing & transport').length).toBeGreaterThan(0);
 });
 test('validates preserved area and cost inputs before submission',async() => {
  const user=setup('/insights?tab=planting');
  await screen.findByText('Recommended under these assumptions');
  await user.clear(screen.getByRole('spinbutton',{name:'Area (hectares)'}));
  await user.click(screen.getByRole('button',{name:'Compare planting options'}));
  expect(screen.getByText('Enter an area from 0.1 to 100 hectares.',{selector:'.field-error'})).toBeInTheDocument();
  expect(plantingCalls).toBe(1);
  await user.type(screen.getByRole('spinbutton',{name:'Area (hectares)'}),'1');
  await user.click(screen.getByText('Assumptions & cultivation costs'));
  await user.type(screen.getByRole('spinbutton',{name:'Tomato cost (LKR/ha)'}),'-10');
  await user.click(screen.getByRole('button',{name:'Compare planting options'}));
  expect(screen.getByText('Enter a cost from LKR 0 to 1,000,000,000.',{selector:'.field-error'})).toBeInTheDocument();
  expect(plantingCalls).toBe(1);
 });
 test('never recommends negative or break-even outcomes',async() => {
  recommendations.recommendations.forEach(r=>{r.stressed.net_return_minor=-100; r.stressed.net_return_per_ha_minor=-100;});
  recommendations.all_negative_returns=true;
  setup('/insights?tab=planting');
  expect(await screen.findByText('Lowest projected loss')).toBeInTheDocument();
  expect(screen.queryByText('Recommended under these assumptions')).not.toBeInTheDocument();
  expect(screen.getByText('No positive-return option under these assumptions.')).toBeInTheDocument();
 });
 test('labels break-even and empty/excluded comparisons',async() => {
  recommendations.recommendations[0].stressed.net_return_minor=0;
  recommendations.recommendations[0].stressed.net_return_per_ha_minor=0;
  const user=setup('/insights?tab=planting');
  await screen.findByText('Break-even option');
  recommendations={...recommendations,recommendations:[],exclusions:[{crop_id:'potato',crop_label:'Potato',reasons:['Unsupported soil.']}]};
  await user.selectOptions(screen.getByRole('combobox',{name:'Soil type'}),'clay');
  await user.click(screen.getByRole('button',{name:'Compare planting options'}));
  expect(await screen.findByText('No suitable crops in this comparison.')).toBeInTheDocument();
  expect(screen.getByText('Unsupported soil.')).toBeInTheDocument();
 });
 test('keeps history available when GPU health fails and can retry',async() => {
  failHealth=true; const user=setup();
  await screen.findByText('Predictions unavailable');
  await screen.findByRole('button',{name:'View accessible price table'});
  expect(screen.getByRole('button',{name:'Update forecast'})).toBeDisabled();
  expect(forecastCalls).toBe(0);
  failHealth=false;
  await user.click(screen.getByRole('button',{name:'Try again'}));
  await loaded();
 });
 test('uses catalog dates and disables stale forecast windows',async() => {
  catalog.forecast_months=[];
  setup();
  expect(await screen.findByText(/historical data is too old/)).toBeInTheDocument();
  expect(screen.getByRole('button',{name:'Update forecast'})).toBeDisabled();
  expect(forecastCalls).toBe(0);
 });
 test('handles network failure and preserves selection for retry',async() => {
  const user=setup(); await loaded();
  await user.click(screen.getByRole('radio',{name:'Papaya'})); failNetwork=true;
  await user.click(screen.getByRole('button',{name:'Update forecast'}));
  expect(await screen.findByText(/We could not reach the prediction service/)).toBeInTheDocument();
  expect(screen.getByRole('radio',{name:'Papaya'})).toBeChecked();
  failNetwork=false;
  await user.click(screen.getByRole('button',{name:'Try again'}));
  await screen.findByRole('heading',{name:/Papaya in October/});
 });
 test('handles failed image loading with a labeled fallback',async() => {
  setup(); await loaded();
  const image=document.querySelector('img[src*="carrot-320"]')!;
  fireEvent.error(image);
  expect(document.querySelector('.produce-image-fallback')).toHaveTextContent('Carrot');
 });
});
