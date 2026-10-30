# 1,000 Rejections

Tracker for the 1,000 rejections challenge: log every no, keep a backlog of asks, and watch the fear shrink.

Live: https://rejections-chi.vercel.app

## How it's built

A plain static site with no build step. Every file is served as it is.

- `index.html`: the page, its dialogs and the script order (library.js → app.js → extras.js → tour.js)
- `app.js`: data, rendering, logging, settings, backup, import and export
- `extras.js`: the second copy in IndexedDB, the calendar (.ics) file, month in review, share picture
- `tour.js` / `tour.css`: the guided tour, using sample data
- `library.js`: the ask library (window.ASK_LIBRARY)
- `style.css`, `v4.css`: styles
- `sw.js`: offline service worker. Bump `CACHE` whenever files change.

Data stays on the phone, in localStorage (`rejections.v1`, `rejections.settings`), with a second copy in IndexedDB (`rejections` / `copy` / `main`). There is no server and no sync.

When you change something, bump `VERSION` in app.js and `CACHE` in sw.js.
