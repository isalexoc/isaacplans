---
name: verify
description: Build, launch, and visually verify UI changes in this Next.js app (dev server + headless Chrome screenshots)
---

# Verifying UI changes in this repo

## Launch

```bash
pnpm dev > /path/to/dev.log 2>&1   # run in background; "Ready in Xs" appears in ~7s
```

Poll the log for `Ready in`, then hit `http://localhost:3000`.

## Drive

- Public/signed-out pages need no auth. Signed-in areas require a Clerk session — verify those manually in a browser.
- Localized slugs differ per locale — look them up in `i18n/routing.ts` (e.g. `/final-expense/sale-sticker` → `/es/gastos-finales/sticker-de-venta`).
- Warm each route with `curl` before screenshotting: dev mode compiles on first hit and a cold route screenshots blank.
- `curl` the page and grep for expected copy + `MISSING_MESSAGE` to catch broken next-intl keys server-side.

## Screenshot (headless Chrome)

```bash
"C:/Program Files/Google/Chrome/Application/chrome.exe" --headless --disable-gpu --no-sandbox \
  --hide-scrollbars --user-data-dir="$(mktemp -d)" --timeout=25000 \
  --screenshot="$PWD/out.png" --window-size=1440,3400 "http://localhost:3000/en/..."
```

Gotchas:
- **Always pass `--timeout=<ms>`** — dev-mode HMR keeps the page "loading" forever and Chrome hangs without it.
- **Fresh `--user-data-dir` per shot** (profile locks otherwise).
- **Minimum window width is ~500px.** Below that Chrome clamps the window but crops the PNG, so a 390px capture shows fake right-edge clipping. Use 500px as the narrowest mobile check; verify true phone widths in DevTools manually.
- Killing the dev server mid-request logs harmless `ECONNRESET uncaughtException` lines in dev.log.
