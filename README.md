# HydroSense PWA

GitHub Pages-ready offline PWA shell for a USB-UART HydroSense dashboard.

## Files
- `index.html`
- `styles.css`
- `app.js`
- `manifest.webmanifest`
- `sw.js`
- `icons/`

## Deploy to GitHub Pages
1. Put all files in the repo root.
2. Commit and push to `main`.
3. In GitHub -> Settings -> Pages:
   - Source: **Deploy from a branch**
   - Branch: **main**
   - Folder: **/(root)**
4. Open your `github.io` URL in Chrome/Chromium.

## Notes
- Web Serial requires Chrome/Chromium.
- Linux users need permission to open the serial device, often via the `dialout` group.
- The PWA shell can work offline once cached.

## Extras included
- Default baud preset set to **57600**
- Last-used baud is saved in local storage
- Download current telemetry buffer as CSV from the Log screen
