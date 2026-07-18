"use client";

import { useEffect } from "react";
import L from "leaflet";
import { MapContainer, Marker, TileLayer, CircleMarker } from "react-leaflet";
import type { CommercialStatus } from "@/lib/supabase/types";
import type { MapPreviewCompany } from "../../types/intelligent-dashboard";

interface QuickMapCanvasProps {
  center: { lat: number; lng: number };
  userLocation: { lat: number; lng: number } | null;
  companies: MapPreviewCompany[];
  markerColors: Record<CommercialStatus, string>;
}

const USER_ICON = L.divIcon({
  className: "",
  html: `<span style="display:block;width:14px;height:14px;border-radius:9999px;background:#4f46e5;border:2px solid white;box-shadow:0 0 0 2px rgba(79,70,229,0.35);"></span>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

export function QuickMapCanvas({
  center,
  userLocation,
  companies,
  markerColors,
}: QuickMapCanvasProps) {
  useEffect(() => {
    void import("leaflet/dist/leaflet.css");
  }, []);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200">
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={userLocation ? 11 : 7}
        scrollWheelZoom={false}
        dragging
        className="h-[220px] w-full"
        style={{ minHeight: 220 }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {userLocation ? (
          <Marker position={[userLocation.lat, userLocation.lng]} icon={USER_ICON} />
        ) : null}
        {companies.map((company) => {
          const status = company.commercialStatus as CommercialStatus;
          const color = markerColors[status] ?? "#64748b";

          return (
            <CircleMarker
              key={company.id}
              center={[company.latitude, company.longitude]}
              radius={6}
              pathOptions={{
                color: "#ffffff",
                weight: 2,
                fillColor: color,
                fillOpacity: 0.95,
              }}
            />
          );
        })}
      </MapContainer>
    </div>
  );
}
