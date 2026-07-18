"use client";

import { useCallback, useEffect, useState } from "react";
import { CloudRain, CloudSun, Loader2, Sun } from "lucide-react";
import { fetchWeatherDetailClient, type WeatherDetail } from "../../utils/weather-detail";

const FALLBACK_COORDS = { lat: 41.8719, lng: 12.5674 };

export function CentroOperativoWeather() {
  const [weather, setWeather] = useState<WeatherDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadWeather = useCallback(async (lat: number, lng: number) => {
    setIsLoading(true);
    const detail = await fetchWeatherDetailClient(lat, lng);
    setWeather(detail);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const timer = window.setTimeout(() => {
      if (!navigator.geolocation) {
        void loadWeather(FALLBACK_COORDS.lat, FALLBACK_COORDS.lng);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (cancelled) {
            return;
          }
          void loadWeather(position.coords.latitude, position.coords.longitude);
        },
        () => {
          if (cancelled) {
            return;
          }
          void loadWeather(FALLBACK_COORDS.lat, FALLBACK_COORDS.lng);
        },
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 300_000 }
      );
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [loadWeather]);

  const WeatherIcon = weather?.available
    ? weather.precipitationMm > 0
      ? CloudRain
      : weather.isDay
        ? Sun
        : CloudSun
    : CloudSun;

  if (isLoading) {
    return (
      <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin text-sky-500" />
        Meteo…
      </div>
    );
  }

  if (!weather?.available) {
    return (
      <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-500">
        <CloudSun className="h-5 w-5 text-slate-400" />
        Meteo non disponibile
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700">
      <WeatherIcon className="h-5 w-5 text-amber-500" />
      <span className="font-semibold tabular-nums">{weather.temperatureC}°C</span>
      <span className="text-slate-500">·</span>
      <span>{weather.description}</span>
    </div>
  );
}
