import { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Company } from '../companies';
import { clusterCompanies } from '../geo';
import { OUTBOUND_ATTRS, outboundHref } from '../outbound';

const MELBOURNE: L.LatLngExpression = [-37.8136, 144.9631];

/** Escapes text going into popup HTML, which Leaflet takes as a raw string. */
const esc = (text: string) =>
  text.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string)
  );

/**
 * Companies plotted by the postcode in their address, one marker per suburb.
 * Hovering a marker opens its list of companies; each name links out to that
 * company's own site.
 *
 * Circles rather than pins: a pin points at an address, and this data only
 * knows the suburb. A disc sized by how many companies are in the area says
 * "around here, this many" without pretending to a street corner.
 */
export function CompanyMap({
  companies,
  highlight,
}: {
  companies: Company[];
  /** A company being hovered in the list beside the map, if any. */
  highlight?: string | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  // Keyed by company name so a hover in the list can find its marker.
  const markersRef = useRef(new Map<string, L.CircleMarker>());

  const { clusters, unplaced } = useMemo(() => clusterCompanies(companies), [companies]);

  // The map itself is created once and kept; only its markers change as the
  // filters change.
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;
    const map = L.map(containerRef.current, {
      center: MELBOURNE,
      zoom: 11,
      scrollWheelZoom: false,
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '© OpenStreetMap contributors',
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    // Leaflet sizes itself once and never notices the container changing, so
    // switching between the split and full-width views leaves it drawing at the
    // old width with grey gaps where tiles should be. Watching the element is
    // more reliable than reacting to the view prop: it also covers a window
    // resize and the sidebar reflowing.
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();
    markersRef.current.clear();

    clusters.forEach((cluster) => {
      const count = cluster.companies.length;
      const marker = L.circleMarker([cluster.lat, cluster.lng], {
        // Area, not radius, tracks the count — doubling a radius quadruples the
        // ink and reads as four times as many.
        radius: 8 + Math.sqrt(count) * 3,
        weight: 2,
        color: '#00171f',
        fillColor: '#00171f',
        fillOpacity: 0.18,
      });

      const list = cluster.companies
        .slice(0, 12)
        .map((c) => {
          const href = c.website || c.linkedin;
          const openings = c.openings > 0 ? ` <em>${c.openings} open</em>` : '';
          return href
            ? `<li><a href="${esc(outboundHref(href, 'startups-map'))}" ${OUTBOUND_ATTRS}>${esc(
                c.name
              )}</a>${openings}</li>`
            : `<li>${esc(c.name)}${openings}</li>`;
        })
        .join('');
      const more = count > 12 ? `<p class="map-pop-more">+ ${count - 12} more</p>` : '';

      marker.bindPopup(
        `<div class="map-pop">
           <p class="map-pop-title">${esc(cluster.suburb)} · ${count} ${
          count === 1 ? 'company' : 'companies'
        }</p>
           <ul class="map-pop-list">${list}</ul>
           ${more}
         </div>`,
        { closeButton: true, maxHeight: 240 }
      );

      // Opens on hover as asked, and stays open so the links inside can be
      // clicked — a tooltip that vanishes when you reach for it is no use.
      marker.on('mouseover', () => marker.openPopup());
      marker.on('click', () => marker.openPopup());
      marker.addTo(layer);
      cluster.companies.forEach((c) => markersRef.current.set(c.name, marker));
    });

    if (clusters.length) {
      map.fitBounds(
        L.latLngBounds(clusters.map((c) => [c.lat, c.lng] as L.LatLngTuple)),
        { padding: [40, 40], maxZoom: 13 }
      );
    }
  }, [clusters]);

  // Hovering a card in the split view opens that company's suburb on the map,
  // so the two halves stay in step rather than being read separately.
  useEffect(() => {
    const marker = highlight ? markersRef.current.get(highlight) : undefined;
    if (!marker) return;
    marker.openPopup();
    marker.setStyle({ fillOpacity: 0.42 });
    return () => {
      marker.setStyle({ fillOpacity: 0.18 });
    };
  }, [highlight]);

  return (
    <div className="company-map">
      <div className="company-map-canvas" ref={containerRef} />
      <p className="company-map-note">
        Pins are placed by postcode, so they show the suburb rather than the street.
        {unplaced.length > 0 &&
          ` ${unplaced.length} ${
            unplaced.length === 1 ? 'company has' : 'companies have'
          } no postcode we can read, so ${
            unplaced.length === 1 ? "it isn't" : "they aren't"
          } on the map.`}
      </p>
    </div>
  );
}
