import { getDistanceKm } from "@/features/maps/utils/geo-distance";
import type { GeoPoint } from "../types/visit-tour";

interface NearestNeighborStop {
  id: string;
  latitude: number;
  longitude: number;
}

/**
 * Ordine suggerito: nearest-neighbor dalla partenza, destinazione finale invariata.
 */
export function optimizeNearestNeighborOrder(
  origin: GeoPoint,
  stops: NearestNeighborStop[],
  currentOrder: string[]
): string[] {
  if (stops.length <= 1) {
    return stops.map((stop) => stop.id);
  }

  const stopById = new Map(stops.map((stop) => [stop.id, stop]));
  const orderedIds =
    currentOrder.length > 0
      ? currentOrder.filter((id) => stopById.has(id))
      : stops.map((stop) => stop.id);

  const remaining = new Set(orderedIds);
  const result: string[] = [];
  let current = origin;

  while (remaining.size > 0) {
    let nearestId: string | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;

    for (const id of remaining) {
      const stop = stopById.get(id);
      if (!stop) {
        continue;
      }

      const distance = getDistanceKm(
        current.lat,
        current.lng,
        stop.latitude,
        stop.longitude
      );

      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestId = id;
      }
    }

    if (!nearestId) {
      break;
    }

    result.push(nearestId);
    remaining.delete(nearestId);
    const picked = stopById.get(nearestId)!;
    current = { lat: picked.latitude, lng: picked.longitude };
  }

  return result;
}
