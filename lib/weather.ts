import { FIT_EPOCH } from "./engine.js";

export type Weather = {
  source: "Open-Meteo"; lat: number; lon: number; start: string; end: string;
  temp: number | null; feels: number | null; rh: number | null; dew: number | null;
  wind: number | null; windDir: number | null; gust: number | null; rain: number | null; tempMax: number | null;
};

const VARS = "temperature_2m,apparent_temperature,relative_humidity_2m,dew_point_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m,precipitation";
const day = (d: Date) => d.toISOString().slice(0, 10);

/** Hourly weather for the run's start point, averaged over the hours it covered. Weather data by Open-Meteo.com (CC BY 4.0). */
export async function fetchWeather(pos: { lat: number; lon: number }, firstFit: number, lastFit: number): Promise<Weather | null> {
  const s = new Date((firstFit + FIT_EPOCH) * 1000), e = new Date((lastFit + FIT_EPOCH) * 1000);
  const q = `latitude=${pos.lat}&longitude=${pos.lon}&start_date=${day(s)}&end_date=${day(e)}&hourly=${VARS}&timezone=GMT&wind_speed_unit=kmh`;
  const tryUrl = async (url: string) => { try { const r = await fetch(url); if (!r.ok) return null; return await r.json(); } catch { return null; } };
  // the archive covers everything up to yesterday or so; very recent hours come from the forecast service
  let j = await tryUrl(`https://archive-api.open-meteo.com/v1/archive?${q}`);
  const pick = (data: any) => {
    if (!data?.hourly?.time) return null;
    const h0 = new Date(s); h0.setUTCMinutes(0, 0, 0);
    const idx = data.hourly.time.map((t: string, i: number) => ({ t: new Date(t + "Z").getTime(), i })).filter((x: any) => x.t >= h0.getTime() && x.t <= e.getTime()).map((x: any) => x.i);
    if (!idx.length) return null;
    const avg = (k: string) => { const v = idx.map((i: number) => data.hourly[k]?.[i]).filter((x: any) => x != null); return v.length ? +(v.reduce((a: number, b: number) => a + b, 0) / v.length).toFixed(1) : null; };
    const sum = (k: string) => { const v = idx.map((i: number) => data.hourly[k]?.[i]).filter((x: any) => x != null); return v.length ? +v.reduce((a: number, b: number) => a + b, 0).toFixed(1) : null; };
    const max = (k: string) => { const v = idx.map((i: number) => data.hourly[k]?.[i]).filter((x: any) => x != null); return v.length ? Math.max(...v) : null; };
    const w: Weather = { source: "Open-Meteo", lat: pos.lat, lon: pos.lon, start: s.toISOString(), end: e.toISOString(),
      temp: avg("temperature_2m"), feels: avg("apparent_temperature"), rh: avg("relative_humidity_2m"), dew: avg("dew_point_2m"),
      wind: avg("wind_speed_10m"), windDir: avg("wind_direction_10m"), gust: max("wind_gusts_10m"), rain: sum("precipitation"), tempMax: max("temperature_2m") };
    return w.temp == null ? null : w;
  };
  let w = pick(j);
  if (!w) { j = await tryUrl(`https://api.open-meteo.com/v1/forecast?${q}`); w = pick(j); }
  return w;
}

export function windWord(deg: number | null) {
  if (deg == null) return "";
  return ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.round(deg / 45) % 8];
}
