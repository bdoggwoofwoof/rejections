# 1,000 Rejections

Tracker for the 1,000 rejections challenge: log every no, keep a backlog of asks, and watch the fear shrink.

Live: https://rejections-chi.vercel.app

## How it's built

A plain static site with no build step. Every file is served as it is.

- `index.html`: the five tabs (Today, Grid, Ideas, History, More), the dialogs, and the script order (library.js → app.js → extras.js → nav.js → tour.js)
- `app.js`: data, rendering, logging, settings, backup, import and export
- `extras.js`: the second copy in IndexedDB, the calendar (.ics) file, month in review, share picture
- `nav.js`: the tab bar, the full grid with tap-for-details, Pending on Today, the square-fill animation, haptics and the theme switch
- `tour.js`: the guided tour, using sample data
- `library.js`: the ask library (window.ASK_LIBRARY)
- `app.css`: all styles (v5 design: warm paper, charcoal, one vermilion accent; Schibsted Grotesk and IBM Plex Mono; light and dark)
- `sw.js`: offline service worker. Bump `CACHE` whenever files change.

Data stays on the phone, in localStorage (`rejections.v1`, `rejections.settings`), with a second copy in IndexedDB (`rejections` / `copy` / `main`). There is no server and no sync.

When you change something, bump `VERSION` in app.js and `CACHE` in sw.js.

## Versions

- v5 (Nov 2, 2026): redesign from the design questionnaire, with five tabs and a new look. The data format didn't change.
- v4.1 (Oct 30, 2026): commit 0e50a55 on main. To go back, revert to it or promote that deployment in Vercel.
