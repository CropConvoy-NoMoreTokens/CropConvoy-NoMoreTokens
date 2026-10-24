import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createOsrmRoutingClient,RoutingError} from './routing.js';
const points=[{lng:80,lat:7},{lng:80.6,lat:7}];
const body={code:'Ok',routes:[{geometry:{type:'LineString',coordinates:[[80,7],[80.6,7]]},distance:1000,duration:100,
  legs:[{distance:1000,duration:100}]}],waypoints:points.map(p=>({location:[p.lng,p.lat]}))};
function client(reply:unknown,status=200){
  return createOsrmRoutingClient({baseUrl:'https://roads.example',fetch:async()=>new Response(JSON.stringify(reply),{status})});
}
test('OSRM requests full road geometry with longitude first and parses legs/snapping',async()=>{
  let requested:URL|undefined;
  const c=createOsrmRoutingClient({baseUrl:'https://roads.example/prefix',fetch:async url=>{
    requested=new URL(String(url));return new Response(JSON.stringify(body));
  }});
  const r=await c.route(points,new AbortController().signal);
  assert.equal(requested?.pathname,'/prefix/route/v1/driving/80,7;80.6,7');
  assert.equal(requested?.searchParams.get('overview'),'full');assert.equal(requested?.searchParams.get('geometries'),'geojson');
  assert.deepEqual(r.snappedPoints,points);assert.equal(r.distanceM,1000);
});
test('routing distinguishes inaccessible stops from provider outage and malformed payloads',async()=>{
  for(const [reply,status,code] of [
    [{code:'NoRoute'},400,'NO_ROAD_ROUTE'],[{code:'NoSegment'},400,'NO_ROAD_ROUTE'],
    [{error:'overloaded'},503,'ROUTING_UNAVAILABLE'],[{...body,waypoints:[]},200,'INVALID_ROUTING_RESPONSE'],
    [{...body,routes:[{...body.routes[0],distance:Infinity}]},200,'INVALID_ROUTING_RESPONSE'],
    [{...body,routes:[{...body.routes[0],legs:[{distance:50,duration:100}]}]},200,'INVALID_ROUTING_RESPONSE'],
  ] as const){
    await assert.rejects(client(reply,status).route(points,new AbortController().signal),e=>e instanceof RoutingError&&e.code===code);
  }
});
test('a provider ignoring AbortSignal still times out and parent cancellation propagates',async()=>{
  const c=createOsrmRoutingClient({baseUrl:'https://roads.example',timeoutMs:15,fetch:()=>new Promise(()=>{})});
  const keepAlive=setTimeout(()=>{},200);
  try {
    await assert.rejects(c.route(points,new AbortController().signal),e=>e instanceof RoutingError&&e.code==='ROUTING_TIMEOUT');
    const abort=new AbortController();abort.abort(new Error('cancelled'));
    await assert.rejects(c.route(points,abort.signal),/cancelled/);
  }finally{clearTimeout(keepAlive);}
});
