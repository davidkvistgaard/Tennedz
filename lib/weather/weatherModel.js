// lib/weather/weatherModel.js
import seedrandom from "seedrandom";

// Simple normal generator using Box–Muller
function normal(rng) {
  let u = 0, v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function seasonFromMonth(month1to12) {
  const m = Number(month1to12);
  if ([12, 1, 2].includes(m)) return "WINTER";
  if ([3, 4, 5].includes(m)) return "SPRING";
  if ([6, 7, 8].includes(m)) return "SUMMER";
  return "AUTUMN";
}

// Country “climate” presets (good-enough MVP)
// Values are rough and intended for gameplay feel, not meteorological accuracy.
const CLIMATE = {
  FR: {
    WINTER: { tMean: 5, tSd: 4, rainP: 0.45, windMean: 22, windSd: 10 },
    SPRING: { tMean: 11, tSd: 4, rainP: 0.40, windMean: 24, windSd: 12 },
    SUMMER: { tMean: 22, tSd: 4, rainP: 0.25, windMean: 16, windSd: 8 },
    AUTUMN: { tMean: 12, tSd: 4, rainP: 0.45, windMean: 20, windSd: 10 }
  },
  BE: {
    WINTER: { tMean: 4, tSd: 4, rainP: 0.50, windMean: 24, windSd: 12 },
    SPRING: { tMean: 10, tSd: 4, rainP: 0.45, windMean: 26, windSd: 14 },
    SUMMER: { tMean: 20, tSd: 4, rainP: 0.28, windMean: 16, windSd: 8 },
    AUTUMN: { tMean: 11, tSd: 4, rainP: 0.50, windMean: 22, windSd: 10 }
  },
  NL: {
    WINTER: { tMean: 4, tSd: 4, rainP: 0.50, windMean: 26, windSd: 14 },
    SPRING: { tMean: 10, tSd: 4, rainP: 0.42, windMean: 28, windSd: 14 },
    SUMMER: { tMean: 20, tSd: 4, rainP: 0.25, windMean: 18, windSd: 9 },
    AUTUMN: { tMean: 11, tSd: 4, rainP: 0.50, windMean: 24, windSd: 12 }
  },
  ES: {
    WINTER: { tMean: 10, tSd: 5, rainP: 0.35, windMean: 18, windSd: 10 },
    SPRING: { tMean: 16, tSd: 5, rainP: 0.35, windMean: 18, windSd: 10 },
    SUMMER: { tMean: 28, tSd: 5, rainP: 0.12, windMean: 14, windSd: 8 },
    AUTUMN: { tMean: 18, tSd: 5, rainP: 0.35, windMean: 16, windSd: 9 }
  },
  IT: {
    WINTER: { tMean: 8, tSd: 5, rainP: 0.35, windMean: 16, windSd: 9 },
    SPRING: { tMean: 15, tSd: 5, rainP: 0.35, windMean: 16, windSd: 9 },
    SUMMER: { tMean: 26, tSd: 5, rainP: 0.18, windMean: 12, windSd: 7 },
    AUTUMN: { tMean: 16, tSd: 5, rainP: 0.38, windMean: 14, windSd: 8 }
  },
  DK: {
    WINTER: { tMean: 2, tSd: 4, rainP: 0.50, windMean: 30, windSd: 14 },
    SPRING: { tMean: 9, tSd: 4, rainP: 0.40, windMean: 28, windSd: 14 },
    SUMMER: { tMean: 18, tSd: 4, rainP: 0.28, windMean: 20, windSd: 10 },
    AUTUMN: { tMean: 10, tSd: 4, rainP: 0.50, windMean: 28, windSd: 14 }
  },
  GB: {
    WINTER: { tMean: 6, tSd: 4, rainP: 0.55, windMean: 24, windSd: 12 },
    SPRING: { tMean: 11, tSd: 4, rainP: 0.45, windMean: 22, windSd: 12 },
    SUMMER: { tMean: 19, tSd: 4, rainP: 0.35, windMean: 16, windSd: 9 },
    AUTUMN: { tMean: 12, tSd: 4, rainP: 0.55, windMean: 22, windSd: 12 }
  }
};

// fallback to FR
function getClimate(countryCode, season) {
  const cc = (countryCode || "FR").toUpperCase();
  const c = CLIMATE[cc] || CLIMATE.FR;
  return c[season] || c.SPRING;
}

function windDir(rng) {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.floor(rng() * dirs.length)];
}

function makeWeather({ seed, country_code, month }) {
  const rng = seedrandom(String(seed));
  const season = seasonFromMonth(month);
  const cl = getClimate(country_code, season);

  const temp = clamp(cl.tMean + cl.tSd * normal(rng), -8, 42);
  const wind = clamp(cl.windMean + cl.windSd * normal(rng), 0, 90);

  const rainRoll = rng();
  const raining = rainRoll < cl.rainP;
  const precipitation_mm = raining ? clamp((Math.pow(rng(), 0.35) * 12), 0.0, 40.0) : 0.0;

  let condition = "Clear";
  if (precipitation_mm > 0 && temp <= 1) condition = "Snow";
  else if (precipitation_mm > 10) condition = "Heavy rain";
  else if (precipitation_mm > 0) condition = "Showers";

  return {
    temp_c: Math.round(temp * 10) / 10,
    wind_kph: Math.round(wind),
    wind_dir: windDir(rng),
    precipitation_mm: Math.round(precipitation_mm * 10) / 10,
    condition,
    country_code: (country_code || "FR").toUpperCase(),
    season
  };
}

/**
 * Forecast that changes slowly before deadline (hourly), weighted by country + season.
 * Use game_date month to choose season.
 */
export function generateForecast({ event_id, country_code, game_date_iso, now = new Date() }) {
  const month = game_date_iso ? (new Date(game_date_iso).getMonth() + 1) : (now.getMonth() + 1);
  const hourBucket = Math.floor(now.getTime() / (1000 * 60 * 60)); // changes hourly
  const seed = `${event_id}:forecast:${hourBucket}`;
  return {
    source: "SIM_FORECAST",
    ...makeWeather({ seed, country_code, month }),
    confidence: 0.62
  };
}

/**
 * Locked weather at/after deadline. Deterministic for fairness.
 * If you lock it once and store it, everyone sees identical weather.
 */
export function generateLockedWeather({ event_id, country_code, game_date_iso, deadline_iso }) {
  const month = game_date_iso ? (new Date(game_date_iso).getMonth() + 1) : (new Date().getMonth() + 1);
  const seed = `${event_id}:locked:${deadline_iso || "deadline"}`;
  return {
    source: "LOCKED_SIM",
    ...makeWeather({ seed, country_code, month }),
    confidence: 0.85
  };
}
