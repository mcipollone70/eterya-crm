"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet.markercluster";
import { useMap } from "react-leaflet";
import { COMMERCIAL_STATUS_MARKER_COLORS } from "../constants/map-config";
import type { MapCompany } from "../types/map";
import { buildCompanyPopupHtml } from "../utils/map-filters";

interface MarkerClusterLayerProps {
  companies: MapCompany[];
}

export function MarkerClusterLayer({ companies }: MarkerClusterLayerProps) {
  const map = useMap();
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);

  useEffect(() => {
    if (!map) {
      return;
    }

    if (clusterRef.current) {
      map.removeLayer(clusterRef.current);
      clusterRef.current = null;
    }

    const cluster = L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 50,
    });

    for (const company of companies) {
      const color = COMMERCIAL_STATUS_MARKER_COLORS[company.commercial_status];

      const marker = L.circleMarker([company.latitude, company.longitude], {
        radius: 8,
        color: "#ffffff",
        weight: 2,
        fillColor: color,
        fillOpacity: 0.95,
      });

      marker.bindPopup(buildCompanyPopupHtml(company), {
        maxWidth: 280,
        minWidth: 220,
      });

      cluster.addLayer(marker);
    }

    map.addLayer(cluster);
    clusterRef.current = cluster;

    return () => {
      if (clusterRef.current) {
        map.removeLayer(clusterRef.current);
        clusterRef.current = null;
      }
    };
  }, [companies, map]);

  return null;
}
