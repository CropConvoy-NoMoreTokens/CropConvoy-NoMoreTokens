import {test} from 'node:test';
import assert from 'node:assert/strict';
import express,{Router,type ErrorRequestHandler} from 'express';
import {ZodError} from 'zod';
import {registerRoutes} from './routes.js';
import {createLogisticsService} from './service.js';
import {ApiError} from '../../core/errors.js';
import {setup} from './test-fixtures.js';
import type {AddressInfo} from 'node:net';

test('live trip HTTP endpoints require new tariff and retrieve persisted geometry',async t=>{
  const s=setup();
  const app=express();app.use(express.json());
  app.use((_req,res,next)=>{res.locals.requestId='test-request';next();});
  const router=Router();
  registerRoutes(router,s.deps,createLogisticsService(s.deps,{repository:s.repository}));
  app.use(router);
  const errors:ErrorRequestHandler=(error,_req,res,_next)=>{
    if(error instanceof ZodError){res.status(422).json({error:{code:'VALIDATION_ERROR'}});return;}
    if(error instanceof ApiError){res.status(error.status).json({error:{code:error.code}});return;}
    res.status(500).json({error:{code:'UNEXPECTED'}});
  };
  app.use(errors);
  const server=app.listen(0,'127.0.0.1');
  await new Promise<void>(resolve=>server.once('listening',resolve));
  t.after(()=>new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve())));
  const base='http://127.0.0.1:'+(server.address() as AddressInfo).port;
  const {id,status,createdAt,routeGeoJSON,routeDistanceM,routeDurationS,routeProvider,routeProfile,...input}=s.trip;
  const post=(body:unknown)=>fetch(base+'/api/trips',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const legacy={...input} as Partial<typeof input>;delete legacy.shipmentPerKmMinor;delete legacy.pricingVersion;
  assert.equal((await post(legacy)).status,422);
  const response=await post(input);assert.equal(response.status,201);
  const saved=await response.json();assert.equal(saved.data.shipmentPerKmMinor,1000);
  assert.deepEqual(saved.data.routeGeoJSON,routeGeoJSON);
  const trips=await (await fetch(base+'/api/trips')).json();assert.equal(trips.data.length,2);
});
