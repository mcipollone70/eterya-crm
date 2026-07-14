const WEATHER_DESCRIPTIONS: Record<number, string> = {
  0: "Sereno",
  1: "Prevalentemente sereno",
  2: "Parzialmente nuvoloso",
  3: "Nuvoloso",
  45: "Nebbia",
  48: "Nebbia gelata",
  51: "Pioggerella leggera",
  53: "Pioggerella",
  55: "Pioggerella intensa",
  61: "Pioggia leggera",
  63: "Pioggia",
  65: "Pioggia intensa",
  71: "Neve leggera",
  73: "Neve",
  75: "Neve intensa",
  80: "Rovesci leggeri",
  81: "Rovesci",
  82: "Rovesci intensi",
  95: "Temporale",
};

export async function fetchWeatherLabel(
  latitude = 41.8719,
  longitude = 12.5674
): Promise<string> {
  try {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", String(latitude));
    url.searchParams.set("longitude", String(longitude));
    url.searchParams.set("current", "temperature_2m,weather_code");
    url.searchParams.set("timezone", "Europe/Rome");

    const response = await fetch(url.toString(), {
      next: { revalidate: 1800 },
    });

    if (!response.ok) {
      return "Meteo non disponibile";
    }

    const payload = (await response.json()) as {
      current?: { temperature_2m?: number; weather_code?: number };
    };

    const temperature = payload.current?.temperature_2m;
    const weatherCode = payload.current?.weather_code;

    if (temperature == null) {
      return "Meteo non disponibile";
    }

    const description =
      weatherCode != null
        ? (WEATHER_DESCRIPTIONS[weatherCode] ?? "Condizioni variabili")
        : "Condizioni attuali";

    return `${Math.round(temperature)}°C · ${description}`;
  } catch {
    return "Meteo non disponibile";
  }
}
