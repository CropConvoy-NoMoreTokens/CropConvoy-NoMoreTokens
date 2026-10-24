import { distance, lineString, nearestPointOnLine } from '@turf/turf';
import type { LineString, Point } from '../../core/contracts.js';
import { ApiError } from '../../core/errors.js';
import { geometrySchema } from './contracts.js';
type Coord = [number, number];
export class FeasibilityError extends ApiError {
  constructor(public readonly codes: string[]) { super(422, codes[0], 'Transport arrangement fails: ' + codes.join(', ')); }
}
export function meters(a: Point, b: Point): number {
  return distance([a.lng, a.lat], [b.lng, b.lat], { units: 'meters' });
}
function intersects(a: Coord, b: Coord, c: Coord, d: Coord): boolean {
  const cross = (p: Coord, q: Coord, r: Coord) => (q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]);
  const on = (p: Coord, q: Coord, r: Coord) =>
    Math.abs(cross(p,q,r)) < 1e-12 && r[0] >= Math.min(p[0],q[0])-1e-12 && r[0] <= Math.max(p[0],q[0])+1e-12 &&
    r[1] >= Math.min(p[1],q[1])-1e-12 && r[1] <= Math.max(p[1],q[1])+1e-12;
  const x=cross(a,b,c), y=cross(a,b,d), u=cross(c,d,a), v=cross(c,d,b);
  return ((x > 0) !== (y > 0) && (u > 0) !== (v > 0)) || on(a,b,c) || on(a,b,d) || on(c,d,a) || on(c,d,b);
}
/** Conservative regional MVP: reject loops, overlaps, crossings and unbounded geometry work. */
export function assertSimpleRoute(raw: LineString): void {
  const { coordinates } = geometrySchema.parse(raw);
  const c = coordinates.filter((p,i) => i===0 || p[0]!==coordinates[i-1][0] || p[1]!==coordinates[i-1][1]);
  if (c.length < 2) throw new FeasibilityError(['INVALID_ROUTE']);
  const seen = new Set<string>();
  for (const p of c) {
    const key = p.join(',');
    if (seen.has(key)) throw new FeasibilityError(['AMBIGUOUS_ROUTE']);
    seen.add(key);
  }
  // Adjacent segments can reverse without repeating a vertex.
  for (let i=1;i<c.length-1;i++) {
    const a=c[i-1], b=c[i], d=c[i+1];
    const cross=(b[0]-a[0])*(d[1]-b[1])-(b[1]-a[1])*(d[0]-b[0]);
    const dot=(b[0]-a[0])*(d[0]-b[0])+(b[1]-a[1])*(d[1]-b[1]);
    if (Math.abs(cross)<1e-12 && dot<0) throw new FeasibilityError(['AMBIGUOUS_ROUTE']);
  }
  const segments = c.slice(1).map((b,i) => ({ a:c[i], b, i,
    minX:Math.min(c[i][0],b[0]), maxX:Math.max(c[i][0],b[0]),
    minY:Math.min(c[i][1],b[1]), maxY:Math.max(c[i][1],b[1]) })).sort((a,b)=>a.minX-b.minX);
  let active: typeof segments = [], comparisons=0;
  for (const s of segments) {
    active=active.filter(t=>t.maxX>=s.minX);
    for (const t of active) {
      if (++comparisons>300000) throw new FeasibilityError(['ROUTE_TOO_COMPLEX']);
      if (Math.abs(s.i-t.i)<=1 || t.maxY<s.minY || s.maxY<t.minY) continue;
      if (intersects(s.a,s.b,t.a,t.b)) throw new FeasibilityError(['AMBIGUOUS_ROUTE']);
    }
    active.push(s);
  }
}
export function projectToRoute(route: LineString, point: Point) {
  let progress=0;
  const projections: Array<{ distanceM:number; progressM:number; point:Point }>=[];
  for (let i=1;i<route.coordinates.length;i++) {
    const a=route.coordinates[i-1], b=route.coordinates[i];
    const length=distance(a,b,{units:'meters'});
    if (length===0) continue;
    const near=nearestPointOnLine(lineString([a,b]), [point.lng,point.lat], {units:'meters'});
    projections.push({ distanceM:near.properties.pointDistance,
      progressM:progress+near.properties.lineDistance,
      point:{lng:near.geometry.coordinates[0],lat:near.geometry.coordinates[1]} });
    progress+=length;
  }
  const best=projections.reduce((a,b)=>b.distanceM<a.distanceM?b:a);
  if (projections.some(p=>Math.abs(p.distanceM-best.distanceM)<=0.5 && Math.abs(p.progressM-best.progressM)>100)) {
    throw new FeasibilityError(['AMBIGUOUS_PROJECTION']);
  }
  return best;
}
export function checkCorridor(route: LineString, pickup: Point, delivery: Point, corridorM: number) {
  assertSimpleRoute(route);
  const p=projectToRoute(route,pickup), d=projectToRoute(route,delivery);
  const codes:string[]=[];
  if (p.distanceM>corridorM) codes.push('PICKUP_TOO_FAR');
  if (d.distanceM>corridorM) codes.push('DELIVERY_TOO_FAR');
  if (d.progressM-p.progressM<1) codes.push('WRONG_DIRECTION');
  if (codes.length) throw new FeasibilityError(codes);
  return {pickup:p, delivery:d, routeCarryDistanceM:d.progressM-p.progressM};
}
