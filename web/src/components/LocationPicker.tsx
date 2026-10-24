import { lazy, Suspense } from 'react';
import { MapPin } from '@phosphor-icons/react';
import type { Point, LineString } from '../api/types';
import { Field, Skeleton } from './ui';
const LeafletMap = lazy(() => import('./MapCanvas'));
export function LocationPicker({ label, value, onChange, name, errors = {} }: { label: string; value: Point; onChange(point: Point): void; name: string; errors?: Record<string, string> }) {
  return <fieldset className="location-picker"><legend><MapPin />{label}</legend><p className="field-hint">Select a point on the map or enter coordinates. Pins should be beside an accessible road.</p>
    <Suspense fallback={<Skeleton label="Loading map" />}><LeafletMap points={[{ ...value, label }]} onPick={onChange} /></Suspense>
    <div className="form-grid"><Field name={`${name}.lat`} label={`${label} latitude`} error={errors[`${name}.lat`]}><input type="number" step="any" value={Number.isNaN(value.lat) ? '' : value.lat} onChange={e => onChange({ ...value, lat: e.target.value === '' ? NaN : Number(e.target.value) })} /></Field><Field name={`${name}.lng`} label={`${label} longitude`} error={errors[`${name}.lng`]}><input type="number" step="any" value={Number.isNaN(value.lng) ? '' : value.lng} onChange={e => onChange({ ...value, lng: e.target.value === '' ? NaN : Number(e.target.value) })} /></Field></div>
  </fieldset>;
}
export function RouteMap({ points, geometry }: { points: Array<Point & { label: string }>; geometry?: LineString | null }) {
  return <Suspense fallback={<Skeleton label="Loading route map" />}><LeafletMap points={points} geometry={geometry} /></Suspense>;
}
