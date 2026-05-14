"use strict";

const fs   = require("fs");
const path = require("path");

const CONFIG_PATH = path.join(__dirname, "config.env");

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Config file not found: ${filePath}`);
  }
  const raw = fs.readFileSync(filePath, "utf8");
  const out  = {};
  for (const rawLine of raw.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    out[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
  }
  return out;
}

function requireString(env, key) {
  const v = env[key];
  if (!v) throw new Error(`[config] Missing required key: ${key}`);
  return v;
}

function requireFloat(env, key, min, max) {
  const v = parseFloat(env[key]);
  if (isNaN(v))            throw new Error(`[config] ${key} must be a number (got: "${env[key]}")`);
  if (v < min || v > max)  throw new Error(`[config] ${key} must be between ${min} and ${max} (got: ${v})`);
  return v;
}

function requireInt(env, key, allowed) {
  const v = parseInt(env[key], 10);
  if (isNaN(v))                       throw new Error(`[config] ${key} must be an integer (got: "${env[key]}")`);
  if (allowed && !allowed.includes(v)) throw new Error(`[config] ${key} must be one of [${allowed.join(", ")}] (got: ${v})`);
  return v;
}

function requirePort(env, key) {
  const v = parseInt(env[key], 10);
  if (isNaN(v) || v < 1 || v > 65535)
    throw new Error(`[config] ${key} must be a valid port 1–65535 (got: "${env[key]}")`);
  return v;
}

function requireTimezone(env, key) {
  const tz = requireString(env, key);
  try { Intl.DateTimeFormat(undefined, { timeZone: tz }); }
  catch { throw new Error(`[config] ${key} is not a valid IANA timezone: "${tz}"`); }
  return tz;
}

function requireApiKeys(env, key) {
  const keys = requireString(env, key).split(",").map(k => k.trim()).filter(Boolean);
  if (keys.length === 0) throw new Error(`[config] ${key} must contain at least one API key`);
  return keys;
}

function parseAllowedOrigins(env, key) {
  const raw = env[key] || "*";
  return raw === "*" ? "*" : raw.split(",").map(o => o.trim()).filter(Boolean);
}

function loadConfig() {
  const env = parseEnvFile(CONFIG_PATH);
  const VALID_METHODS = [1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12, 13, 14, 15];
  return {
    port:           requirePort(env, "PORT"),
    hostname:       requireString(env, "HOSTNAME"),
    allowedOrigins: parseAllowedOrigins(env, "ALLOWED_ORIGINS"),
    latitude:       requireFloat(env, "LATITUDE",  -90,  90),
    longitude:      requireFloat(env, "LONGITUDE", -180, 180),
    timezone:       requireTimezone(env, "TIMEZONE"),
    method:         requireInt(env, "METHOD", VALID_METHODS),
    madhab:         requireInt(env, "MADHAB", [1, 2]),
    apiKeys:        requireApiKeys(env, "API_KEYS"),
  };
}

module.exports = loadConfig();
