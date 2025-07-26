import React, { useState, useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import Sidebar from "../../components/Sidebar";
import { MapPin, Search } from "lucide-react";

// Fix Leaflet’s default icon paths
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require("leaflet/dist/images/marker-icon-2x.png"),
  iconUrl: require("leaflet/dist/images/marker-icon.png"),
  shadowUrl: require("leaflet/dist/images/marker-shadow.png"),
});

// Create a red icon for the user's location marker
const redIcon = new L.Icon({
  iconUrl:
    'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
  iconRetinaUrl:
    'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// Haversine formula to calculate distance between two lat/lng points
function getDistance(lat1, lon1, lat2, lon2) {
  const toRad = (x) => (x * Math.PI) / 180;
  const R = 6371e3; // metres
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δφ = toRad(lat2 - lat1);
  const Δλ = toRad(lon2 - lon1);

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // in metres
}

export default function PharmacyLocator() {
  const [userLocation, setUserLocation] = useState(null);
  const [geoError, setGeoError] = useState("");
  const [pharmacies, setPharmacies] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPharmacy, setSelectedPharmacy] = useState(null);
  const mapRef = useRef(null);

  // 1) Get the user's current geolocation
  useEffect(() => {
    if (!navigator.geolocation) {
      setGeoError("Geolocation is not supported by your browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setUserLocation({ lat: coords.latitude, lng: coords.longitude });
        setGeoError("");
      },
      () => setGeoError("Location access is required to find nearby pharmacies.")
    );
  }, []);

  // 2) Fetch nearby pharmacies via Overpass API and sort by distance
  useEffect(() => {
    if (!userLocation) return;
    const radius = 5000; // meters
    const query = `
      [out:json];
      node
        [amenity=pharmacy]
        (around:${radius},${userLocation.lat},${userLocation.lng});
      out;
    `;
    const url =
      "https://overpass-api.de/api/interpreter?data=" +
      encodeURIComponent(query);

    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        const elements = data.elements || [];
        const mapped = elements
          .map((el) => {
            const distance = getDistance(
              userLocation.lat,
              userLocation.lng,
              el.lat,
              el.lon
            );
            return {
              id: el.id,
              name: el.tags?.name || "Unnamed Pharmacy",
              address: [
                el.tags?.["addr:housenumber"],
                el.tags?.["addr:street"],
                el.tags?.city,
              ]
                .filter(Boolean)
                .join(", "),
              lat: el.lat,
              lng: el.lon,
              distance,
            };
          })
          .sort((a, b) => a.distance - b.distance);
        setPharmacies(mapped);
      })
      .catch(console.error);
  }, [userLocation]);

  // 3) Filter by search
  const filtered = pharmacies.filter((ph) =>
    ph.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 4) Zoom + select
  const handleSelect = (ph) => {
    setSelectedPharmacy(ph);
    mapRef.current?.setView([ph.lat, ph.lng], 16);
  };

  // 5) Open Google Maps directions
  const handleDirections = (ph) => {
    if (!userLocation) {
      setGeoError("Location access is required to get directions.");
      return;
    }
    const { lat: oLat, lng: oLng } = userLocation;
    const { lat: dLat, lng: dLng } = ph;
    const url = `https://www.google.com/maps/dir/?api=1&origin=${oLat},${oLng}&destination=${dLat},${dLng}&travelmode=driving`;
    window.open(url, "_blank");
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />

      <div className="flex-1 p-6 max-w-7xl mx-auto">
        <h1 className="text-2xl font-semibold mb-2">Pharmacy Locator</h1>
        <p className="text-gray-600 mb-2">
          Allow location access to find nearby pharmacies.
        </p>
        {geoError && (
          <div className="bg-yellow-100 text-yellow-800 p-3 rounded mb-6">
            {geoError}
          </div>
        )}

        {/* ——— Map ——— */}
        <MapContainer
          center={
            userLocation
              ? [userLocation.lat, userLocation.lng]
              : [44.6488, -63.5752]
          }
          zoom={13}
          whenCreated={(map) => (mapRef.current = map)}
          className="w-full h-96 rounded-lg overflow-hidden shadow-sm border mb-6"
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenStreetMap contributors"
          />

          {userLocation && (
            <Marker
              position={[userLocation.lat, userLocation.lng]}
              icon={redIcon}
            >
              <Popup>You are here</Popup>
            </Marker>
          )}

          {(selectedPharmacy ? [selectedPharmacy] : pharmacies).map((ph) => (
            <Marker key={ph.id} position={[ph.lat, ph.lng]}>
              <Popup>
                <div>
                  <strong>{ph.name}</strong>
                  {ph.address && <p className="mt-1">{ph.address}</p>}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDirections(ph);
                    }}
                    className="text-blue-600 hover:underline"
                  >
                    Get Directions
                  </button>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        {/* ——— Search ——— */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <div className="relative max-w-md mx-auto">
            <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search pharmacies..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setSelectedPharmacy(null);
              }}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        {/* ——— List + Directions ——— */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-lg font-medium mb-4">
            Nearby Pharmacies ({filtered.length})
          </h2>

          {filtered.length === 0 ? (
            <p className="text-gray-500">No pharmacies found.</p>
          ) : (
            <ul className="space-y-4">
              {filtered.map((ph) => (
                <li
                  key={ph.id}
                  className={`flex items-center gap-4 border p-4 rounded-lg cursor-pointer hover:bg-gray-50 ${
                    selectedPharmacy?.id === ph.id
                      ? "bg-blue-50 border-blue-200"
                      : ""
                  }`}
                  onClick={() => handleSelect(ph)}
                >
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <MapPin className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium">{ph.name}</h3>
                    {ph.address && (
                      <p className="text-sm text-gray-600">{ph.address}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      {(ph.distance/1000).toFixed(2)} km away
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDirections(ph);
                    }}
                    className="text-blue-600 hover:underline"
                  >
                    Get Directions
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
