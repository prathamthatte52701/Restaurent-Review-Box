import { MapContainer, Marker, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '../listing/map.css';

const pin = L.divIcon({ className: 'rrb-pin', html: '<span></span>', iconSize: [30, 38], iconAnchor: [15, 36] });

export default function DetailMap({ lat, lng, name }) {
  return (
    <MapContainer center={[lat, lng]} zoom={16} scrollWheelZoom={false} className="h-64 w-full rounded-lg border border-border sm:h-80">
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19} />
      <Marker position={[lat, lng]} icon={pin} title={name} alt={name} />
    </MapContainer>
  );
}
