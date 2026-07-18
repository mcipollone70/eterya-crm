"use client";

import { useCallback, useEffect, useState } from "react";
import { CloudRain, CloudSun, Loader2, Navigation, Sun, Wind } from "lucide-react";
import { fetchWeatherDetailClient, type WeatherDetail } from "../../utils/weather-detail";
import { DashboardWidgetShell } from "./dashboard-widget-shell";

const FALLBACK_COORDS = { lat: 41.8719, lng: 12.5674 };

export function WeatherWidget() {
  const [weather, setWeather] = useState<WeatherDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [usingLocation, setUsingLocation] = useState(false);

  const loadWeather = useCallback(async (lat: number, lng: number, fromGps: boolean) => {
    setIsLoading(true);
    setUsingLocation(fromGps);
    const detail = await fetchWeatherDetailClient(lat, lng);
    setWeather(detail);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const timer = window.setTimeout(() => {
      if (!navigator.geolocation) {
        void loadWeather(FALLBACK_COORDS.lat, FALLBACK_COORDS.lng, false);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (cancelled) {
            return;
          }
          void loadWeather(position.coords.latitude, position.coords.longitude, true);
        },
        () => {
          if (cancelled) {
            return;
          }
          void loadWeather(FALLBACK_COORDS.lat, FALLBACK_COORDS.lng, false);
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

  return (
    <DashboardWidgetShell
      title="Meteo"
      icon={<CloudSun className="h-4 w-4 text-sky-600" />}
    >
      {isLoading ? (
        <div className="flex h-28 items-center justify-center text-sm text-slate-500">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Caricamento meteo…
        </div>
      ) : weather?.available ? (
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-50 text-sky-600">
              <WeatherIcon className="h-7 w-7" />
            </span>
            <div>
              <p className="text-3xl font-bold tabular-nums text-slate-900">
                {weather.temperatureC}°C
              </p>
              <p className="text-sm text-slate-600">{weather.description}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 text-sm text-slate-700">
              <CloudRain className="h-4 w-4 text-sky-500" />
              <span>{weather.precipitationMm} mm pioggia</span>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 text-sm text-slate-700">
              <Wind className="h-4 w-4 text-sky-500" />
              <span>{weather.windSpeedKmh} km/h vento</span>
            </div>
          </div>

          {usingLocation ? (
            <p className="inline-flex items-center gap-1 text-xs text-slate-500">
              <Navigation className="h-3 w-3" />
              Basato sulla tua posizione
            </p>
          ) : (
            <p className="text-xs text-slate-500">Posizione approssimativa (Italia centrale)</p>
          )}
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
          Meteo non disponibile.
        </p>
      )}
    </DashboardWidgetShell>
  );
}
