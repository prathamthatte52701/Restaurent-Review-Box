import { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import icon2x from 'leaflet/dist/images/marker-icon-2x.png';
import shadow from 'leaflet/dist/images/marker-shadow.png';
import { DEFAULT_CENTER } from '../../../lib/restaurantForm.js';

// Vite does not resolve Leaflet's default icon URLs, so build the icon explicitly from imported assets.
const pin = L.icon({ iconUrl: icon, iconRetinaUrl: icon2x, shadowUrl: shadow, iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41] });

function Clicks({ onPick }) {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) });
  return null;
}
function Follow({ pos }) {
  const map = useMap();
  useEffect(() => {
    if (pos && !map.getBounds().contains(pos)) map.setView(pos, map.getZoom());
  }, [pos?.[0], pos?.[1]]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
function Resize() {
  const map = useMap();
  useEffect(() => { const t = setTimeout(() => map.invalidateSize(), 100); return () => clearTimeout(t); }, [map]);
  return null;
}

/** lat/lng are numbers or NaN; onPick(lat, lng) rounds to 6 dp. */
export default function MapPicker({ lat, lng, onPick }) {
  const valid = Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
  const pos = valid ? [lat, lng] : [DEFAULT_CENTER.lat, DEFAULT_CENTER.lng];
  const ref = useRef(null);
  const round = (n) => Math.round(n * 1e6) / 1e6;
  const handlers = useMemo(
    () => ({ dragend: () => { const ll = ref.current?.getLatLng(); if (ll) onPick(round(ll.lat), round(ll.lng)); } }),
    [onPick],
  );
  return (
    <MapContainer center={pos} zoom={15} scrollWheelZoom className="z-0 h-72 w-full rounded-lg border border-border sm:h-96" aria-label="Location map">
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <Clicks onPick={(a, b) => onPick(round(a), round(b))} />
      <Follow pos={valid ? pos : null} />
      <Resize />
      <Marker draggable position={pos} icon={pin} eventHandlers={handlers} ref={ref} />
    </MapContainer>
  );
}
