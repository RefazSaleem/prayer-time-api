"use strict";

const express = require("express");

let CONFIG;
try {
  CONFIG = require("./config");
} catch (err) {
  console.error("\n❌  Configuration error:\n  ", err.message, "\n");
  process.exit(1);
}

const app = express();

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (CONFIG.allowedOrigins === "*") {
    res.setHeader("Access-Control-Allow-Origin", "*");
  } else if (origin && CONFIG.allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Headers", "x-api-key, Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

function julianDate(Y, M, D) {
  if (M <= 2) { Y--; M += 12; }
  const A = Math.trunc(Y / 100);
  const B = 2 - A + Math.trunc(A / 4);
  return Math.trunc(365.25 * (Y + 4716)) + Math.trunc(30.6001 * (M + 1)) + D + B - 1524.5;
}

function sunPosition(jd) {
  const D   = jd - 2451545.0;
  const g   = (357.529 + 0.98560028 * D) % 360;
  const q   = (280.459 + 0.98564736 * D) % 360;
  const L   = (q + 1.915 * Math.sin(g * RAD) + 0.02 * Math.sin(2 * g * RAD)) % 360;
  const e   = 23.439 - 0.0000004 * D;
  const RA  = Math.atan2(Math.cos(e * RAD) * Math.sin(L * RAD), Math.cos(L * RAD)) * DEG / 15;
  const dec = Math.asin(Math.sin(e * RAD) * Math.sin(L * RAD)) * DEG;
  const EqT = q / 15 - ((RA + 360) % 24);
  return { dec, EqT };
}

function hourAngle(lat, dec, angle) {
  const cos = (-Math.sin(angle * RAD) - Math.sin(lat * RAD) * Math.sin(dec * RAD))
              / (Math.cos(lat * RAD) * Math.cos(dec * RAD));
  if (cos < -1) return 18;
  if (cos > 1)  return 0;
  return Math.acos(cos) * DEG / 15;
}

function asrHourAngle(lat, dec, shadowMultiplier) {
  const angle = Math.atan(1 / (shadowMultiplier + Math.tan(Math.abs(lat - dec) * RAD))) * DEG;
  return hourAngle(lat, dec, -angle);
}

const METHODS = {
  1:  { fajr: 18,   isha: 17 },
  2:  { fajr: 15,   isha: 15 },
  3:  { fajr: 19.5, isha: 17.5 },
  4:  { fajr: 18.5, ishaMin: 90 },
  5:  { fajr: 18,   isha: 18 },
  7:  { fajr: 17.7, isha: 14 },
  8:  { fajr: 19.5, ishaMin: 90 },
  9:  { fajr: 18,   isha: 17.5 },
  10: { fajr: 18,   ishaMin: 90 },
  11: { fajr: 20,   isha: 18 },
  12: { fajr: 12,   isha: 12 },
  13: { fajr: 18,   isha: 17 },
  14: { fajr: 16,   isha: 15 },
  15: { fajr: 18,   isha: 18 },
};

function localDateParts(tz) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const get = type => parseInt(parts.find(p => p.type === type).value);
  return { year: get("year"), month: get("month") - 1, day: get("day") };
}

function offsetDateParts(tz, daysAhead) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysAhead);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(d);
  const get = type => parseInt(parts.find(p => p.type === type).value);
  return { year: get("year"), month: get("month") - 1, day: get("day") };
}

function calcPrayerTimesUTC(dateParts) {
  const { latitude: lat, longitude: lon, method, madhab } = CONFIG;
  const { year, month, day } = dateParts;
  const jd      = julianDate(year, month + 1, day);
  const { dec, EqT } = sunPosition(jd);
  const noon    = 12 - lon / 15 - EqT;
  const m       = METHODS[method] || METHODS[4];
  const shadow  = madhab === 2 ? 2 : 1;
  const sunrise = noon - hourAngle(lat, dec, -0.8333);
  const sunset  = noon + hourAngle(lat, dec, -0.8833);
  return {
    fajr:    noon - hourAngle(lat, dec, -m.fajr),
    sunrise,
    dhuhr:   noon + 0.0333,
    asr:     noon + asrHourAngle(lat, dec, shadow),
    maghrib: sunset + 0.0167,
    isha:    m.ishaMin ? sunset + m.ishaMin / 60 : noon + hourAngle(lat, dec, -m.isha),
  };
}

function fracToDate(utcFrac, dateParts) {
  const h  = Math.floor(utcFrac);
  const mi = Math.floor((utcFrac - h) * 60);
  const s  = Math.floor(((utcFrac - h) * 60 - mi) * 60);
  return new Date(Date.UTC(dateParts.year, dateParts.month, dateParts.day, h, mi, s));
}

function fmt12(date) {
  return date.toLocaleTimeString("en-US", { timeZone: CONFIG.timezone, hour: "2-digit", minute: "2-digit", hour12: true });
}

function fmt24(date) {
  return date.toLocaleTimeString("en-GB", { timeZone: CONFIG.timezone, hour: "2-digit", minute: "2-digit" });
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function locationMeta() {
  return {
    latitude:  CONFIG.latitude,
    longitude: CONFIG.longitude,
    timezone:  CONFIG.timezone,
    method:    CONFIG.method,
    madhab:    CONFIG.madhab === 1 ? "Shafi/Hanbali/Maliki" : "Hanafi",
  };
}

const PRAYER_NAMES = ["fajr", "dhuhr", "asr", "maghrib", "isha"];

function getNextPrayer() {
  const now           = new Date();
  const todayParts    = localDateParts(CONFIG.timezone);
  const tomorrowParts = offsetDateParts(CONFIG.timezone, 1);
  const todayTimes    = calcPrayerTimesUTC(todayParts);
  const tomorrowTimes = calcPrayerTimesUTC(tomorrowParts);

  const candidates = [
    ...PRAYER_NAMES.map(name => ({
      name,
      date:     fracToDate(todayTimes[name], todayParts),
      tomorrow: false,
    })),
    { name: "fajr", date: fracToDate(tomorrowTimes.fajr, tomorrowParts), tomorrow: true },
  ];

  const next = candidates.find(c => c.date > now);
  if (!next) throw new Error("Could not determine next prayer — check timezone and location config.");

  return {
    prayer:    capitalize(next.name),
    time:      fmt12(next.date),
    time24:    fmt24(next.date),
    isoTime:   next.date.toISOString(),
    inMinutes: Math.round((next.date - now) / 60_000),
    tomorrow:  next.tomorrow,
  };
}

function getAllPrayersToday() {
  const now        = new Date();
  const todayParts = localDateParts(CONFIG.timezone);
  const times      = calcPrayerTimesUTC(todayParts);

  const prayers = {};
  for (const name of ["fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha"]) {
    const d = fracToDate(times[name], todayParts);
    prayers[name] = { time: fmt12(d), time24: fmt24(d), isoTime: d.toISOString(), passed: d < now };
  }

  const { year, month, day } = todayParts;
  return {
    date: new Date(year, month, day).toLocaleDateString("en-US", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    }),
    prayers,
    location: locationMeta(),
  };
}

function apiKeyAuth(req, res, next) {
  const key = req.headers["x-api-key"] || req.query.api_key;
  if (!key || !CONFIG.apiKeys.includes(key)) {
    return res.status(401).json({
      error:   "Unauthorized",
      message: "Provide a valid API key via the x-api-key header or ?api_key= query param.",
    });
  }
  next();
}

const FIELD_MAP = {
  prayer:    r => r.prayer,
  time:      r => r.time,
  time24:    r => r.time24,
  inminutes: r => String(r.inMinutes),
  tomorrow:  r => String(r.tomorrow),
};

app.get("/health", (_req, res) => {
  res.json({ status: "ok", server: "Prayer Time API", timestamp: new Date().toISOString() });
});

app.get("/next-prayer", apiKeyAuth, (req, res) => {
  try {
    const result = getNextPrayer();
    for (const key of Object.keys(FIELD_MAP)) {
      if (key in req.query) {
        if (req.query[key] !== "") {
          const value = FIELD_MAP[key](result).toLowerCase();
          return res.type("text").send(
            String(value === String(req.query[key]).toLowerCase())
          );
        }
        return res.type("text").send(FIELD_MAP[key](result));
      }
    }
    res.json({
      ...result,
      location: locationMeta(),
    });
  } catch (err) {
    res.status(500).json({
      error: "Calculation error",
      details: err.message,
    });
  }
});

app.get("/prayers/today", apiKeyAuth, (_req, res) => {
  try {
    res.json(getAllPrayersToday());
  } catch (err) {
    res.status(500).json({ error: "Calculation error", details: err.message });
  }
});

app.use((_req, res) => {
  res.status(404).json({
    error:     "Not found",
    endpoints: ["GET /health", "GET /next-prayer", "GET /prayers/today"],
  });
});

app.listen(CONFIG.port, CONFIG.hostname, () => {
  const origins = CONFIG.allowedOrigins === "*" ? "all" : CONFIG.allowedOrigins.join(", ");
  console.log(`\n🕌  Prayer Time API`);
  console.log(`   Listening : http://${CONFIG.hostname}:${CONFIG.port}`);
  console.log(`   Location  : ${CONFIG.latitude}, ${CONFIG.longitude}`);
  console.log(`   Timezone  : ${CONFIG.timezone}`);
  console.log(`   Method    : ${CONFIG.method}`);
  console.log(`   Origins   : ${origins}`);
  console.log(`   API keys  : ${CONFIG.apiKeys.length} configured\n`);
});
