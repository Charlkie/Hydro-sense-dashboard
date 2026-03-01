# HydroSense PWA

GitHub Pages-ready offline PWA shell for a USB-UART HydroSense dashboard.

## Included
- Offline-capable PWA shell
- USB serial connection in Chrome/Chromium
- Default baud preset set to **57600**
- Last-used baud remembered in local storage
- Live telemetry cards and plot
- **Options** page for polling-rate control
- CSV export of current telemetry buffer

## Control protocol
Telemetry lines from STM32:
`pH,NTU,temp_C,do_mgL`

Commands sent from dashboard:
- `PING`
- `GET RATE`
- `SET RATE 500`
- `START`
- `STOP`

Expected control responses from STM32:
- `PONG`
- `DATA RATE 500`
- `OK RATE 500`
- `OK STARTED`
- `OK STOPPED`
- `ERR BAD_VALUE`

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
- Linux users often need serial permission via the `dialout` group.
- The PWA shell can work offline once cached.
