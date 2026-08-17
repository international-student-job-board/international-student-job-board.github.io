import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { placeFor } from '../geo';

/**
 * One employer's whereabouts, from the postcode in its address.
 *
 * Only ever rendered once the reader has asked for it, so Leaflet — the largest
 * thing the site can load — stays out of the way of everyone who doesn't.
 */
export function EmployerMap({ address, state }: { address: string; state: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const found = placeFor(address, state);
  const place = found?.place;

  useEffect(() => {
    if (!place || !containerRef.current) return;
    const map = L.map(containerRef.current, {
      center: [place.lat, place.lng],
      zoom: 13,
      scrollWheelZoom: false,
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '© OpenStreetMap contributors',
    }).addTo(map);
    L.circleMarker([place.lat, place.lng], {
      radius: 10,
      weight: 2,
      color: '#00171f',
      fillColor: '#00171f',
      fillOpacity: 0.25,
    }).addTo(map);

    // Leaflet measures its container once, and this one was display:none until
    // the disclosure opened — so it has to be told to look again.
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(containerRef.current);
    map.invalidateSize();

    return () => {
      observer.disconnect();
      map.remove();
    };
  }, [place, found?.exact]);

  if (!place) {
    return (
      <p className="panel-note">
        We can't place this employer on a map from the address we have.
      </p>
    );
  }

  return (
    <div className="employer-map">
      <div className="employer-map-canvas" ref={containerRef} />
      <p className="employer-map-note">
        {place.suburb}
        {found?.exact ? '' : ' — placed to the city, not the street'}
      </p>
    </div>
  );
}
