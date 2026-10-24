import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, Polyline, useMap, useMapEvents } from 'react-leaflet';
import type { Point, LineString } from '../api/types';
import 'leaflet/dist/leaflet.css';
function Pick({ onPick }: { onPick?: (point: Point) => void }) { useMapEvents({ click(event) { onPick?.({ lat: Number(event.latlng.lat.toFixed(6)), lng: Number(event.latlng.lng.toFixed(6)) }); } }); return null; }
function Bounds({ points }: { points: Point[] }) {
  const map = useMap();
  const key = points.map(p => `${p.lat},${p.lng}`).join(';');
  useEffect(() => { if (points.length > 1) map.fitBounds(points.map(p => [p.lat, p.lng]), { padding: [35, 35], maxZoom: 12 }); else if (points[0]) map.setView([points[0].lat, points[0].lng], map.getZoom()); }, [key, map]);
  return null;
}
export default function MapCanvas({ points, onPick, geometry }: { points: Array<Point & { label: string }>; onPick?: (point: Point) => void; geometry?: LineString | null }) {
  const [failed, setFailed] = useState(false);
  const valid = points.filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180);
  const center: [number, number] = valid[0] ? [valid[0].lat, valid[0].lng] : [7.8742, 80.6511];
  const line = geometry?.type === 'LineString' && geometry.coordinates.length > 1 && geometry.coordinates.every(p => p.length === 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]) && Math.abs(p[0]) <= 180 && Math.abs(p[1]) <= 90) ? geometry.coordinates : null;
  return <div className="map-wrap"><MapContainer center={center} zoom={10} scrollWheelZoom={false} className="map-canvas" attributionControl aria-label={onPick ? 'Choose a location on the map' : 'Locations and returned road geometry'}>
    {!failed && <TileLayer url={import.meta.env.VITE_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'} attribution={import.meta.env.VITE_MAP_ATTRIBUTION || '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'} eventHandlers={{ tileerror: () => setFailed(true) }} />}
    <Pick onPick={onPick} /><Bounds points={valid} />
    {valid.map((p, i) => <CircleMarker key={`${p.label}-${i}`} center={[p.lat, p.lng]} radius={8} pathOptions={{ color: '#09190D', fillColor: '#83F674', fillOpacity: 1, weight: 2 }}><Popup>{p.label}</Popup></CircleMarker>)}
    {line && <Polyline positions={line.map(([lng, lat]): [number, number] => [lat, lng])} pathOptions={{ color: '#267735', weight: 5 }} />}
  </MapContainer>{failed && <p className="map-warning" role="status">Map tiles are unavailable. Coordinates and location pins still work.</p>}</div>;
}
