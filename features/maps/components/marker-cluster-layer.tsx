"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet.markercluster";
import { useMap } from "react-leaflet";
import type { MapCompany } from "../types/map";
import {
  buildBrandMarkerIconHtml,
  buildMapCompanyPopupHtml,
  buildNeutralMarkerIconHtml,
  resolveBrandMarkerIconMetrics,
  resolveMapBrandMarkerVisual,
  resolveMapCompanyStatusMarkerColor,
} from "../utils/map-brand-markers";

interface MarkerClusterLayerProps {
  companies: MapCompany[];
}

/**
 * Sempre L.marker + divIcon (mai CircleMarker): MarkerClusterGroup con tipi misti
 * può non disegnare i Path (aziende senza Brand spariscono dalla mappa).
 */
function createCompanyMarker(company: MapCompany): L.Marker {
  // Tutti i Brand ricevuti (nessun truncate/overwrite): visual usa l'array completo.
  const visual = resolveMapBrandMarkerVisual(company.brands);
  // Stessa fonte stato del popup (relationship_status se Brand, altrimenti commercial_status).
  const statusColor = resolveMapCompanyStatusMarkerColor(company);
  const popupOptions = { maxWidth: 300, minWidth: 220 } as const;
  const latLng: L.LatLngExpression = [company.latitude, company.longitude];

  if (!visual.initials) {
    const icon = L.divIcon({
      className: "eterya-map-brand-marker",
      html: buildNeutralMarkerIconHtml(statusColor),
      iconSize: [16, 16],
      iconAnchor: [8, 8],
      popupAnchor: [0, -8],
    });
    const marker = L.marker(latLng, { icon });
    marker.bindPopup(buildMapCompanyPopupHtml(company), popupOptions);
    return marker;
  }

  // Fill = stato relazione (stessa fonte del popup). Le lettere identificano i Brand.
  const fillColor = statusColor;
  const metrics = resolveBrandMarkerIconMetrics(visual.initials, visual.showCrown);

  const icon = L.divIcon({
    className: "eterya-map-brand-marker",
    html: buildBrandMarkerIconHtml(visual, fillColor),
    iconSize: metrics.iconSize,
    iconAnchor: metrics.iconAnchor,
    popupAnchor: metrics.popupAnchor,
  });

  const marker = L.marker(latLng, { icon });
  marker.bindPopup(buildMapCompanyPopupHtml(company), popupOptions);
  return marker;
}

export function MarkerClusterLayer({ companies }: MarkerClusterLayerProps) {
  const map = useMap();
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }
    const styleId = "eterya-map-brand-marker-style";
    if (!document.getElementById(styleId)) {
      const style = document.createElement("style");
      style.id = styleId;
      style.textContent = `
        .eterya-map-brand-marker {
          background: transparent !important;
          border: none !important;
          overflow: visible !important;
        }
        .eterya-map-brand-marker > div {
          overflow: visible !important;
        }
        .leaflet-marker-icon.eterya-map-brand-marker {
          z-index: 600 !important;
          overflow: visible !important;
        }
        .leaflet-div-icon.eterya-map-brand-marker {
          overflow: visible !important;
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

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
      // Zoom alto: mostra marker individuali (lettere Brand) invece dei cluster.
      disableClusteringAtZoom: 12,
    });

    for (const company of companies) {
      cluster.addLayer(createCompanyMarker(company));
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
