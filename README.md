# YouTube Finder

Free app for finding the videos YouTube buries — static web page **and** Android APK (Capacitor). **No API key required.**

- **Web (GitHub Pages):** https://tawattthot.github.io/youtube-finder/
- **Android APK:** [YouTube-Finder-debug.apk](https://github.com/TawattThot/youtube-finder/releases/download/latest/YouTube-Finder-debug.apk) ([release page](https://github.com/TawattThot/youtube-finder/releases/tag/latest)).

## What it does
- **Low-view search**: keep only videos in a view range (default 200–2,000), by upload window, newest first by default. “Pages to scan” (1–5). Optional **Hide Shorts**. Optional max-subscribers filter when a Google key is set.
- **Local eyes**: find videos about a place since an event (place name + keywords + “footage”). TV/big channels hidden by default. Map/radius search is available when a Google key is set.
- **Weird filters** (all off by default, both tabs): optional oddball filters — first upload, raw footage, fast upload after an event, dead channel, ~silent/no talking, unpolished titles, ~language≠place, zero-ad. Matching cards get small badges. Filters that need channel/playlist or deep video parts use a Google key when set (batched; no extra `search.list`). ~ = best guess.

## How search works (no key)
The app talks to public **Invidious** and **Piped** instances that allow browser CORS. It tries several mirrors with timeouts and falls over automatically. Results show which mirror (or Google) served them.

Public mirrors come and go. If all of them fail, add an optional Google API key in **Settings** as a backup.

## Optional Google API key (backup)
1. https://console.cloud.google.com/ → New project.
2. Enable **YouTube Data API v3**.
3. Create an **API key**. Restrict it to YouTube Data API v3.
4. Application restrictions: Websites → `https://tawattthot.github.io/*` (or None for the Android app).
5. Settings → paste → Save. Stored only in localStorage on that device — never in this repo.

With a key you also get: map-radius Local eyes, channel subscriber filtering, and a fallback when mirrors are down. Free Google quota is 10,000 units/day (~100 searches).

## Install the Android app
1. Download **[YouTube-Finder-debug.apk](https://github.com/TawattThot/youtube-finder/releases/download/latest/YouTube-Finder-debug.apk)**.
2. Allow the one-time install from that source.
3. Launch **YouTube Finder** — search works immediately. Settings key is optional.

To auto-rebuild the APK on every push to `main`, copy `scripts/android-apk.yml.workflow` to `.github/workflows/android-apk.yml` and push.

## Code
- `mirrors.js` – Invidious/Piped free search + failover
- `api.js` – Google backup + card rendering
- `filter.js` – low-view filtering
- `weird.js` – optional Weird filters + badges
- `local.js` – Local eyes (mirrors by default; Google for map radius)
- `app.js` – UI wiring
- `www/` – Capacitor copy (`npm run build`)
- `android/` – Capacitor Android project

## Develop locally
```bash
npm install
npm run build
npx cap sync android
```
