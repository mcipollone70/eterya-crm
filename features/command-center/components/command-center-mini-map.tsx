"use client";

import { useEffect, useState } from "react";
import L from "leaflet";
import { MapContainer, Marker, TileLayer, useMap } from "react-leaflet";
import { DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM } from "@/features/maps/constants/map-config";
import type { MapCompany } from "@/features/maps/types/map";

interface CommandCenterMiniMapProps {
  companies: MapCompany[];
}

function UserLocationMarker() {
  const map = useMap();
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setPosition(coords);
        map.setView(coords, Math.max(map.getZoom(), 11));
      },
      () => undefined,
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, [map]);

  if (!position) {
    return null;
  }

  const icon = L.divIcon({
    className: "",
    html: `<span style="display:block;width:14px;height:14px;border-radius:50%;background:#2563eb;border:3px solid white;box-shadow:0 0 0 2px #2563eb66"></span>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });

  return <Marker position={position} icon={icon} />;
}

function FitBounds({ companies }: { companies: MapCompany[] }) {
  const map = useMap();

  useEffect(() => {
    if (companies.length === 0) {
      return;
    }
    const bounds = L.latLngBounds(companies.map((c) => [c.latitude, c.longitude]));
    map.fitBounds(bounds.pad(0.2));
  }, [companies, map]);

  return null;
}

export function CommandCenterMiniMap({ companies }: CommandCenterMiniMapProps) {
  const center = companies[0]
    ? { lat: companies[0].latitude, lng: companies[0].longitude }
    : DEFAULT_MAP_CENTER;

  const companyIcon = L.divIcon({
    className: "",
    html: `<span style="display:block;width:10px;height:10px;border-radius:50%;background:#7c3aed;border:2px solid white"></span>`,
    iconSize: [10, 10],
    iconAnchor: [5, 5],
  });

  if (companies.length === 0) {
    return (
      <div className="flex h-56 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-500 sm:h-72">
        Nessun cliente geolocalizzato per la mappa.
      </div>
    );
  }

  return (
    <div className="h-56 overflow-hidden rounded-xl border border-slate-200 sm:h-72">
      <MapContainer
        center={center}
        zoom={DEFAULT_MAP_ZOOM}
        className="h-full w-full"
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <UserLocationMarker />
        <FitBounds companies={companies} />
        {companies.map((company) => (
          <Marker
            key={company.id}
            position={[company.latitude, company.longitude]}
            icon={companyIcon}
          />
        ))}
      </MapContainer>
    </div>
  );
}
