# 1,000 Rejections

Tracker for the 1,000 rejections challenge: log every no, keep a backlog of asks, and watch the fear shrink.

Live: https://rejections-chi.vercel.app

## How it's built

A plain static site with no build step. Every file is served as it is.

- `index.html`: the five tabs (Today, Grid, Ideas, History, More), the dialogs, and the script order (library.js → app.js → extras.js → nav.js → tour.js)
- `app.js`: data, rendering, logging, settings, backup, import and export
- `extras.js`: the second copy in IndexedDB, the calendar (.ics) file, month in review, share picture
- `nav.js`: the tab bar, the Grid tab (tap-for-details, milestones), Pending on Today, the square-fill animation, haptics and the theme switch
- `tour.js`: the guided tour, using sample data
- `library.js`: the ask library (window.ASK_LIBRARY)
- `app.css`: all styles and tokens (warm paper, charcoal, one cobalt accent; Schibsted Grotesk and IBM Plex Mono; light and dark)

## Design system (app.css :root)

- **Type:** six sizes, --fs-1 12 · --fs-2 14 · --fs-3 16 · --fs-4 22 · --fs-5 32 · --fs-display (the count). Weights are 400, 600, 700, 800 and 900 (900 for the count and numbers only).
- **Radii:** --r-s 4 (tags, badges), --r-m 10 (controls), --r-l 16 (cards, dialogs, panels) and --r-pill. Grid squares are square.
- **Spacing:** --s-1 to --s-6 = 4, 8, 12, 16, 24, 32.
- **Color:** --line is for decorative hairlines. --edge is for control borders (≥3:1). --muted-strong is for labels on --cell. --danger is themed. --cell-edge outlines empty squares.
- **Buttons:** filled cobalt (.b.no) is used for one action per screen or dialog only. Row actions use .ra (quiet outline, 36px visible, 44px tap area). Text actions use .link.
- **Rows:** every list row comes from askRow() in app.js.
- `sw.js`: offline service worker. Bump `CACHE` whenever files change.

Data stays on the phone, in localStorage (`rejections.v1`, `rejections.settings`), with a second copy in IndexedDB (`rejections` / `copy` / `main`). There is no server and no sync.

When you change something, bump `VERSION` in app.js and `CACHE` in sw.js.

## Versions

- v6.1 (Nov 3, 2026): your own categories. Pick "New category…" in any category picker, or use More → Categories to add, rename (merges if the name exists) or remove (its asks move to Misc.). Kept in settings.customTypes, so backups carry them; categories already on asks or in an imported CSV join the list.
- v6 (Nov 2, 2026): design and UX pass from the audit. Fixed the Edit dialog overflow; rebuilt Today's hierarchy with a compact log form; reflection is offered, never forced; one filled action per screen; 44px targets; Grid usability; shared rows; More and Settings cleanup; a 9-step tour; type, radius and spacing scales.
- v5.1 (Nov 2, 2026): accent changed from vermilion to cobalt (#2747c7; #8ea2ff in dark), with a new icon to match.
- v5 (Nov 2, 2026): redesign from the design questionnaire, with five tabs and a new look. The data format didn't change.
- v4.1 (Oct 30, 2026): commit 0e50a55 on main. To go back, revert to it or promote that deployment in Vercel.
