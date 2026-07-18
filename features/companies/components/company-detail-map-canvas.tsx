"use client";

import { useEffect } from "react";
import L from "leaflet";
import { MapContainer, Marker, TileLayer } from "react-leaflet";

interface CompanyDetailMapCanvasProps {
  latitude: number;
  longitude: number;
  companyName: string;
}

const COMPANY_ICON = L.divIcon({
  className: "",
  html: `<span style="display:block;width:16px;height:16px;border-radius:9999px;background:#4f46e5;border:2px solid white;box-shadow:0 0 0 2px rgba(79,70,229,0.35);"></span>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

export function CompanyDetailMapCanvas({
  latitude,
  longitude,
  companyName,
}: CompanyDetailMapCanvasProps) {
  useEffect(() => {
    void import("leaflet/dist/leaflet.css");
  }, []);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200">
      <MapContainer
        center={[latitude, longitude]}
        zoom={14}
        scrollWheelZoom={false}
        dragging
        className="h-72 w-full"
        style={{ minHeight: 288 }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={[latitude, longitude]} icon={COMPANY_ICON} title={companyName} />
      </MapContainer>
    </div>
  );
}
