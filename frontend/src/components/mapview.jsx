import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

export default function MapView({ pickup, delivery }) {

  // Default center (India)
    const pickupPos = [19.0760, 72.8777];
    const deliveryPos = [18.5204, 73.8567]; // Pune example

    const center = pickupPos;

  return (
    <MapContainer
      center={center}
      zoom={6}
      style={{ height: '200px', width: '100%', borderRadius: 10 }}
    >
      <TileLayer
        attribution="&copy; OpenStreetMap"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* Pickup */}
      <Marker position={center}>
        <Popup>Pickup: {pickup}</Popup>
      </Marker>

      {/* Delivery */}
      <Marker position={center}>
        <Popup>Delivery: {delivery}</Popup>
      </Marker>

    </MapContainer>
  );
}