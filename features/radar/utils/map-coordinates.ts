export function getValidMapCoordinates(
  latitude: number | null | undefined,
  longitude: number | null | undefined
): { latitude: number; longitude: number } | null {
  if (
    latitude == null ||
    longitude == null ||
    (latitude === 0 && longitude === 0)
  ) {
    return null;
  }

  return { latitude, longitude };
}

export function hasValidMapCoordinates(
  latitude: number | null | undefined,
  longitude: number | null | undefined
): boolean {
  return getValidMapCoordinates(latitude, longitude) !== null;
}
