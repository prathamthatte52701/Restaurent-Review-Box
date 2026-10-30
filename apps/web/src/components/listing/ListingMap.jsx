import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Circle, MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import './map.css';
import { costForTwo, statusText } from '../../lib/restaurants.js';

const INDORE = [22.7196, 75.8577];
const pin = L.divIcon({ className: 'rrb-pin', html: '<span></span>', iconSize: [30, 38], iconAnchor: [15, 36], popupAnchor: [0, -34] });
const meIcon = L.divIcon({ className: 'rrb-me', html: '<span></span>', iconSize: [18, 18], iconAnchor: [9, 9] });

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text; // textContent: names are never parsed as HTML
  return n;
};

function popupFor(r, go) {
  const root = el('div', 'rrb-pop');
  const a = el('a', 'rrb-pop-title', r.name);
  a.href = `/restaurants/${r.slug}`;
  a.addEventListener('click', (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    go(`/restaurants/${r.slug}`);
  });
  root.append(a);
  const rating = r.ratingCount ? `★ ${Number(r.ratingAvg).toFixed(1)} (${r.ratingCount})` : 'New';
  const meta = [rating, (r.cuisines || []).slice(0, 2).map((c) => c.name).join(', '), costForTwo(r.priceForTwo)].filter(Boolean).join(' · ');
  root.append(el('p', 'rrb-pop-meta', meta));
  const status = statusText(r.openStatus);
  if (status) root.append(el('p', r.openStatus.isOpen ? 'rrb-pop-open' : 'rrb-pop-meta', status));
  const more = el('a', 'rrb-pop-link', 'View details →');
  more.href = a.href;
  more.addEventListener('click', (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    go(a.getAttribute('href'));
  });
  root.append(more);
  return root;
}

/** One cluster group per mount; cleared + removed on cleanup so filter churn never leaks layers or duplicates pins. */
function Pins({ restaurants, center, radiusKm }) {
  const map = useMap();
  const navigate = useNavigate();
  useEffect(() => {
    const group = L.markerClusterGroup({ showCoverageOnHover: false, maxClusterRadius: 50, spiderfyOnMaxZoom: true });
    const pts = [];
    for (const r of restaurants) {
      const [lng, lat] = r.location?.coordinates || [];
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      pts.push([lat, lng]);
      group.addLayer(L.marker([lat, lng], { icon: pin, title: r.name, alt: r.name, keyboard: true }).bindPopup(popupFor(r, navigate), { minWidth: 200, maxWidth: 260 }));
    }
    map.addLayer(group);
    const me = center ? L.marker([center.lat, center.lng], { icon: meIcon, title: 'You are here', interactive: false, keyboard: false }).addTo(map) : null;
    if (center) pts.push([center.lat, center.lng]);
    if (pts.length === 1) map.setView(pts[0], 15);
    else if (pts.length > 1) map.fitBounds(L.latLngBounds(pts), { padding: [40, 40], maxZoom: 16 });
    return () => {
      group.clearLayers();
      map.removeLayer(group);
      me?.remove();
    };
  }, [map, restaurants, center, navigate]);
  return radiusKm && center ? <Circle center={[center.lat, center.lng]} radius={radiusKm * 1000} pathOptions={{ color: 'rgb(var(--primary))', weight: 1.5, fillOpacity: 0.05 }} /> : null;
}

export default function ListingMap({ restaurants, center, radiusKm }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border" data-testid="listing-map">
      <MapContainer center={INDORE} zoom={12} minZoom={3} maxZoom={19} scrollWheelZoom className="h-[28rem] w-full lg:h-[36rem]" attributionControl>
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19} />
        <Pins restaurants={restaurants} center={center} radiusKm={radiusKm} />
      </MapContainer>
    </div>
  );
}
