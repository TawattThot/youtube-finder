# YouTube Finder

Free, static web app (works on phones) for finding the videos YouTube buries.

Live: https://tawattthot.github.io/youtube-finder/

- **Low-view search**: keep only videos in a view range (default 200–2,000), optionally from small channels (max subscribers), by upload window. Sorted newest first by default. "Pages to scan" (1–5, default 2) controls how many searches a run spends.
- **Local eyes**: find videos uploaded near a place since an event (geotagged search + place name "footage" search, merged).

## Get a free YouTube API key
1. Go to https://console.cloud.google.com/ and sign in with Google.
2. Create a project (top bar → New project).
3. APIs & Services → Library → search **YouTube Data API v3** → Enable.
4. APIs & Services → Credentials → Create credentials → **API key**.
5. Edit the key → Application restrictions → **Websites** → add `https://tawattthot.github.io/*`. API restrictions → YouTube Data API v3. Save.
6. Open the app → **Settings** → paste the key → Save. It's stored only in your browser's localStorage, never in this repo.

## Quota
Free limit is 10,000 units/day. Each search page costs 100 units (~100 searches/day); view/channel lookups cost 1 unit each. Resets at midnight Pacific.

## Code
- `api.js` – API calls, enrichment, cards
- `filter.js` – low-view filtering logic (refine here)
- `local.js` – Local eyes logic (`findLocalVideos`)
- `app.js` – UI wiring
