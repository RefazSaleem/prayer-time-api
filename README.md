# Next Prayer API

A simple Node.js API that returns the next prayer time based on your configured location and calculation settings.

---

## Requirements

- [Node.js](https://nodejs.org/) installed

---

## Installation

```bash
npm install
```

---

## Configurations

Edit parameters in config.env file

## Start Server

```bash
node server.js
```

Server runs on:

```text
http://localhost:3000
```

Or run installation and server together:

```bash
npm install && node server.js
```

---

# Authentication

All requests require an API key in the request header:

```http
x-api-key: api-key
```

---

# API Endpoints

## Get Next Prayer

### Request

```bash
curl http://localhost:3000/next-prayer \
  -H "x-api-key: api-key"
```

### Example Response

```json
{
  "prayer": "Maghrib",
  "time": "06:48 PM",
  "time24": "18:48",
  "isoTime": "2026-05-14T14:48:31.000Z",
  "inMinutes": 56,
  "tomorrow": false,
  "location": {
    "latitude": 25.2048,
    "longitude": 55.2708,
    "timezone": "Asia/Dubai",
    "method": 4,
    "madhab": "Shafi/Hanbali/Maliki"
  }
}
```

---

## Get Next Prayer Time (24-Hour Format)

### Request

```bash
curl "http://localhost:3000/next-prayer?time24" \
  -H "x-api-key: api-key"
```

### Example Response

```text
18:48
```

---

## Get Remaining Minutes Until Next Prayer

### Request

```bash
curl "http://localhost:3000/next-prayer?inminutes" \
  -H "x-api-key: api-key"
```

### Example Response

```text
59
```

---

# Query Parameters

| Parameter | Description |
|---|---|
| `time24` | Returns only the prayer time in 24-hour format |
| `inminutes` | Returns only the remaining minutes until the next prayer |

---

# Example Response Fields

| Field | Description |
|---|---|
| `prayer` | Name of the upcoming prayer |
| `time` | Prayer time in 12-hour format |
| `time24` | Prayer time in 24-hour format |
| `isoTime` | ISO formatted prayer time |
| `inMinutes` | Minutes remaining until prayer |
| `tomorrow` | Indicates whether the prayer is on the next day |
| `location` | Current calculation settings and location data |

---

# Notes

- Default timezone: `Asia/Dubai`
- Uses prayer calculation method `4`
- Madhab: `Shafi/Hanbali/Maliki`

---

# License

MIT License
