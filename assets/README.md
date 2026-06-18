# Assets

Place your app icons here before building/distributing:

- `icon.ico` — Windows app + tray icon (required by `electron-builder.yml`).
- `icon.icns` — macOS app icon (optional; electron-builder can derive it).
- `iconTemplate.png` — macOS tray icon (monochrome template, ~16×16, with `@2x` variant).

The tray falls back to a transparent placeholder icon if these are missing, so
the app still runs in development without them.
