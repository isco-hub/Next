import { useEffect, useRef } from "react";
import L from "leaflet";
import { REGION_CENTRE, SUPPORTED_REGION } from "@nextcrop/api-client";
import "leaflet/dist/leaflet.css";

interface Point {
  lat: number;
  lon: number;
}

export interface LocationMapProps {
  point: Point | null;
  onPick: (point: Point) => void;
  label: string;
}

export default function LocationMap({ point, onPick, label }: LocationMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.CircleMarker | null>(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [REGION_CENTRE.lat, REGION_CENTRE.lon],
      zoom: 8,
      minZoom: 7,
      maxZoom: 15,
      scrollWheelZoom: false,
      zoomControl: true,
      preferCanvas: true,
    });
    mapRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    L.polygon(
      SUPPORTED_REGION.map(([lon, lat]) => [lat, lon] as L.LatLngTuple),
      {
        color: "#1f6f43",
        weight: 2,
        fillColor: "#1f6f43",
        fillOpacity: 0.08,
      },
    ).addTo(map);

    map.fitBounds(
      L.latLngBounds(
        SUPPORTED_REGION.map(([lon, lat]) => [lat, lon] as L.LatLngTuple),
      ),
      { padding: [16, 16] },
    );

    map.on("click", (event: L.LeafletMouseEvent) => {
      onPickRef.current({ lat: event.latlng.lat, lon: event.latlng.lng });
    });

    const resize = window.setTimeout(() => map.invalidateSize(), 100);

    return () => {
      window.clearTimeout(resize);
      markerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!point) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }
    if (markerRef.current) {
      markerRef.current.setLatLng([point.lat, point.lon]);
    } else {
      markerRef.current = L.circleMarker([point.lat, point.lon], {
        radius: 9,
        color: "#155232",
        weight: 3,
        fillColor: "#e9a23b",
        fillOpacity: 0.85,
      }).addTo(map);
    }
  }, [point]);

  return <div ref={containerRef} className="mapCanvas" aria-label={label} />;
}
