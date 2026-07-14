"use client";

import { useEffect } from "react";
import { CircleMarker, Polyline, TileLayer, useMap } from "react-leaflet";
import { COMMERCIAL_STATUS_MARKER_COLORS } from "@/features/maps/constants/map-config";
import type { GeoPoint, VisitTourCandidate, VisitTourDestination } from "../types/visit-tour";

interface VisitTourMapProps {
  routeCoordinates: GeoPoint[];
  destination: VisitTourDestination | null;
  selectedCompanies: VisitTourCandidate[];
  origin: GeoPoint | null;
  orderedStopIds?: string[];
}

function FitTourBounds({
  routeCoordinates,
  destination,
  selectedCompanies,
  origin,
}: VisitTourMapProps) {
  const map = useMap();

  useEffect(() => {
    const points: GeoPoint[] = [...routeCoordinates];
    if (destination) {
      points.push(destination.point);
    }
    if (origin) {
      points.push(origin);
    }
    for (const company of selectedCompanies) {
      points.push({ lat: company.latitude, lng: company.longitude });
    }

    if (points.length === 0) {
      return;
    }

    map.fitBounds(
      points.map((point) => [point.lat, point.lng] as [number, number]),
      { padding: [32, 32] }
    );
  }, [destination, map, origin, routeCoordinates, selectedCompanies]);

  return null;
}

export function VisitTourMap({
  routeCoordinates,
  destination,
  selectedCompanies,
  origin,
  orderedStopIds,
}: VisitTourMapProps) {
  const selectedIds = new Set(selectedCompanies.map((company) => company.id));

  const orderedTourLine: GeoPoint[] = [];
  if (origin) {
    orderedTourLine.push(origin);
  }
  if (orderedStopIds && orderedStopIds.length > 0) {
    for (const stopId of orderedStopIds) {
      const company = selectedCompanies.find((item) => item.id === stopId);
      if (company) {
        orderedTourLine.push({ lat: company.latitude, lng: company.longitude });
      }
    }
  }
  if (destination) {
    orderedTourLine.push(destination.point);
  }

  return (
    <>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitTourBounds
        routeCoordinates={routeCoordinates}
        destination={destination}
        selectedCompanies={selectedCompanies}
        origin={origin}
      />

      {routeCoordinates.length > 1 && (
        <Polyline
          positions={routeCoordinates.map((point) => [point.lat, point.lng])}
          pathOptions={{ color: "#4f46e5", weight: 5, opacity: 0.85 }}
        />
      )}

      {orderedTourLine.length > 1 && (
        <Polyline
          positions={orderedTourLine.map((point) => [point.lat, point.lng])}
          pathOptions={{ color: "#0f766e", weight: 4, opacity: 0.8, dashArray: "8 6" }}
        />
      )}

      {origin && (
        <CircleMarker
          center={[origin.lat, origin.lng]}
          radius={9}
          pathOptions={{ color: "#ffffff", weight: 2, fillColor: "#0ea5e9", fillOpacity: 1 }}
        />
      )}

      {destination && (
        <CircleMarker
          center={[destination.point.lat, destination.point.lng]}
          radius={10}
          pathOptions={{ color: "#ffffff", weight: 2, fillColor: "#dc2626", fillOpacity: 1 }}
        />
      )}

      {selectedCompanies.map((company) => (
        <CircleMarker
          key={company.id}
          center={[company.latitude, company.longitude]}
          radius={8}
          pathOptions={{
            color: "#ffffff",
            weight: 2,
            fillColor: COMMERCIAL_STATUS_MARKER_COLORS[company.commercial_status],
            fillOpacity: selectedIds.has(company.id) ? 1 : 0.7,
          }}
        />
      ))}
    </>
  );
}
