import {test,expect,vi} from 'vitest';
import {render,screen,within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter} from 'react-router-dom';
import {AppRoutes} from '../App';
import {AppProvider} from '../state/AppContext';
import {createHttpService} from '../api/service';
import {createDemoService,DEMO_IDS} from '../api/demo';
import {setApiToken} from '../api/authSession';
import {colomboToUtc,tomorrowAt} from '../lib/format';

test.each(['buyer','transporter'] as const)('%s can approve a pending proposal and find it in history',async role=>{
  setApiToken('A'.repeat(43));localStorage.setItem('cropconvoy.preferences','essential');
  const now=new Date().toISOString(); let approved=false;
  const summary={id:'44444444-4444-4444-8444-444444444444',listingId:DEMO_IDS.farmer,orderId:DEMO_IDS.buyer,tripId:DEMO_IDS.transporter,quantityKg:80,crop:'tomato',status:'farmer_accepted_pending_confirmations',createdAt:now,expiresAt:'2099-01-01T00:00:00Z',pickupAt:now,deliveryAt:now,grossMinor:1760000,transportMinor:95000,legacy:false,booking:{buyer:'pending',driver:'pending',approvalExpiresAt:'2099-01-01T00:00:00Z',farmerAcceptedAt:now}};
  const meta={mode:'live',persistence:'postgres',requestId:'test'};
  const fetcher=vi.fn(async(url: string|URL|Request,options?:RequestInit)=>{
    const path=new URL(String(url));let data:unknown=[];
    if(path.pathname==='/api/auth/me')data={id:DEMO_IDS[role],username:role,role};
    else if(path.pathname==='/api/plans')data={items:approved && path.searchParams.get('status')==='pending'?[]:[{...summary,status:approved?'confirmed':summary.status}],nextCursor:null,pendingCount:approved?0:1};
    else if(path.pathname.endsWith('-decision')){expect(JSON.parse(String(options?.body))).toEqual({decision:'approve'});approved=true;data={...summary,status:'confirmed'};}
    return new Response(JSON.stringify({data,meta}),{status:200});
  });vi.stubGlobal('fetch',fetcher);
  const user=userEvent.setup();render(<AppProvider service={createHttpService()}><MemoryRouter initialEntries={[`/app/${role}?view=approvals`]}><AppRoutes/></MemoryRouter></AppProvider>);
  await user.click(await screen.findByRole('button',{name:'Review proposal'}));
  await user.click(screen.getByRole('button',{name:'Approve proposal'}));
  const dialog=await screen.findByRole('dialog');await user.click(within(dialog).getByRole('button',{name:'Confirm approval'}));
  expect(await screen.findByRole('heading',{name:'Approvals (0 pending)'})).toBeInTheDocument();
  await user.click(screen.getByRole('button',{name:'History'}));expect(await screen.findByText('Booking confirmed')).toBeInTheDocument();
  expect(fetcher.mock.calls.some(([url])=>String(url).includes(`/${role==='buyer'?'buyer':'driver'}-decision`))).toBe(true);
});

test('farmer can discover an accepted proposal from saved harvest history after login',async()=>{
  localStorage.setItem('cropconvoy.preferences','essential');sessionStorage.setItem('cropconvoy.identity',JSON.stringify({role:'farmer',username:'farmer'}));
  const service=createDemoService();
  const listing=await service.createListing({demoFarmerId:DEMO_IDS.farmer,crop:'tomato',quantityKg:80,pickup:{lat:7.8,lng:80.6},readyAt:colomboToUtc(tomorrowAt(8)),minNetMinor:1400000,confirmed:true});
  const generated=await service.generate(listing.data.id);await service.decide(generated.data.plan!.id,'accept');
  const restored=createDemoService();const user=userEvent.setup();render(<AppProvider service={restored}><MemoryRouter initialEntries={['/app/farmer']}><AppRoutes/></MemoryRouter></AppProvider>);
  await user.click(await screen.findByRole('button',{name:/Open harvest/}));
  const history=await screen.findByRole('region',{name:'Proposal history'});
  await user.click(await within(history).findByRole('button',{name:'Open proposal'}));
  expect(await screen.findByRole('region',{name:'A clearer picture of your proceeds.'})).toBeInTheDocument();
  expect(await within(await screen.findByRole('region',{name:'Proposal history'})).findByText('Pending buyer and transporter confirmations.')).toBeInTheDocument();
});
