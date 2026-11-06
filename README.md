# YouTube Finder

Free app for finding the videos YouTube buries — static web page **and** Android APK (Capacitor).

- **Web (GitHub Pages):** https://tawattthot.github.io/youtube-finder/
- **Android APK:** download the latest debug build from [Releases](https://github.com/TawattThot/youtube-finder/releases/tag/latest) (`YouTube-Finder-debug.apk`).

## What it does
- **Low-view search**: keep only videos in a view range (default 200–2,000), optionally from small channels (max subscribers), by upload window. Sorted newest first by default. "Pages to scan" (1–5, default 2) controls how many searches a run spends. Optional **Hide Shorts**.
- **Local eyes**: find videos uploaded near a place since an event (geotagged search + place-name search, merged; TV/big channels hidden by default).

## Get a free YouTube API key
1. Go to https://console.cloud.google.com/ and sign in with Google.
2. Create a project (top bar → New project).
3. APIs & Services → Library → search **YouTube Data API v3** → Enable.
4. APIs & Services → Credentials → Create credentials → **API key**.
5. Edit the key → **API restrictions** → restrict to **YouTube Data API v3**.
6. **Application restrictions**
   - For the **website only**: Websites → add `https://tawattthot.github.io/*`.
   - For the **Android app** (or both): leave Application restrictions as **None** (the key still only works for YouTube Data API v3). Don't paste the key into chat or commit it.
7. Open the app → **Settings** → paste the key → Save. Stored only in localStorage on that device/browser — never in this repo.

## Install the Android app
1. On your phone, open the [latest release](https://github.com/TawattThot/youtube-finder/releases/tag/latest) and download **YouTube-Finder-debug.apk**.
2. Open the APK. If Android blocks it, allow installs from that app (Chrome / Files / etc.) — "unknown sources" for this one install.
3. Launch **YouTube Finder** → Settings → paste your API key once.
4. Video cards open in the YouTube app or your browser.

Every push to `main` rebuilds the APK via GitHub Actions and updates that release.

## Quota
Free limit is 10,000 units/day. Each search page costs 100 units (~100 searches/day); view/channel lookups cost 1 unit each. Resets at midnight Pacific.

## Code
- `api.js` – API calls, enrichment, cards
- `filter.js` – low-view filtering logic
- `local.js` – Local eyes (`findLocalVideos` + OpenStreetMap Nominatim geocode)
- `app.js` – UI wiring
- `www/` – copy of the static files for Capacitor (`npm run build`)
- `android/` – Capacitor Android project (`com.tawattthot.youtubefinder`)

Root `index.html` / JS / CSS stay at the repo root so GitHub Pages keeps working. `scripts/build-www.sh` copies them into `www/` for the native shell.

## Develop locally
```bash
npm install
npm run build          # refresh www/
npx cap sync android   # push www/ into the Android project
# open in Android Studio, or let CI build the APK
```
