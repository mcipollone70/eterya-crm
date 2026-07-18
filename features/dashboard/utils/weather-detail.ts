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

export interface WeatherDetail {
  temperatureC: number;
  description: string;
  windSpeedKmh: number;
  precipitationMm: number;
  isDay: boolean;
  available: boolean;
}

const UNAVAILABLE: WeatherDetail = {
  temperatureC: 0,
  description: "Meteo non disponibile",
  windSpeedKmh: 0,
  precipitationMm: 0,
  isDay: true,
  available: false,
};

export async function fetchWeatherDetail(
  latitude = 41.8719,
  longitude = 12.5674
): Promise<WeatherDetail> {
  try {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", String(latitude));
    url.searchParams.set("longitude", String(longitude));
    url.searchParams.set(
      "current",
      "temperature_2m,weather_code,wind_speed_10m,precipitation,is_day"
    );
    url.searchParams.set("timezone", "Europe/Rome");

    const response = await fetch(url.toString(), {
      next: { revalidate: 1800 },
    });

    if (!response.ok) {
      return UNAVAILABLE;
    }

    const payload = (await response.json()) as {
      current?: {
        temperature_2m?: number;
        weather_code?: number;
        wind_speed_10m?: number;
        precipitation?: number;
        is_day?: number;
      };
    };

    const current = payload.current;
    if (current?.temperature_2m == null) {
      return UNAVAILABLE;
    }

    const weatherCode = current.weather_code;
    const description =
      weatherCode != null
        ? (WEATHER_DESCRIPTIONS[weatherCode] ?? "Condizioni variabili")
        : "Condizioni attuali";

    return {
      temperatureC: Math.round(current.temperature_2m),
      description,
      windSpeedKmh: Math.round(current.wind_speed_10m ?? 0),
      precipitationMm: Math.round((current.precipitation ?? 0) * 10) / 10,
      isDay: (current.is_day ?? 1) === 1,
      available: true,
    };
  } catch {
    return UNAVAILABLE;
  }
}

export async function fetchWeatherDetailClient(
  latitude: number,
  longitude: number
): Promise<WeatherDetail> {
  try {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", String(latitude));
    url.searchParams.set("longitude", String(longitude));
    url.searchParams.set(
      "current",
      "temperature_2m,weather_code,wind_speed_10m,precipitation,is_day"
    );
    url.searchParams.set("timezone", "Europe/Rome");

    const response = await fetch(url.toString());
    if (!response.ok) {
      return UNAVAILABLE;
    }

    const payload = (await response.json()) as {
      current?: {
        temperature_2m?: number;
        weather_code?: number;
        wind_speed_10m?: number;
        precipitation?: number;
        is_day?: number;
      };
    };

    const current = payload.current;
    if (current?.temperature_2m == null) {
      return UNAVAILABLE;
    }

    const weatherCode = current.weather_code;
    const description =
      weatherCode != null
        ? (WEATHER_DESCRIPTIONS[weatherCode] ?? "Condizioni variabili")
        : "Condizioni attuali";

    return {
      temperatureC: Math.round(current.temperature_2m),
      description,
      windSpeedKmh: Math.round(current.wind_speed_10m ?? 0),
      precipitationMm: Math.round((current.precipitation ?? 0) * 10) / 10,
      isDay: (current.is_day ?? 1) === 1,
      available: true,
    };
  } catch {
    return UNAVAILABLE;
  }
}
