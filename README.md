# CAN Frame Playground

A desktop CAN bus analysis tool built with Tauri. Parse, visualize, and reverse-engineer CAN logs with full privacy — all processing is local, nothing leaves your machine.

---

## Features

### Analysis Views
- **Hex Dump** — frame-by-frame byte table with delta/baseline change highlighting, signal overlay coloring, and per-cell tooltips showing hex, decimal, binary, and delta from previous/baseline
- **Delta Graph** — Chart.js line plot of byte values over time; toggle delta mode (change per frame), hide static bytes, switch to **Message Rate** view (inter-frame interval in ms), or **compare multiple IDs** overlaid on the same graph
- **Bit Map** — canvas-rendered bit-level timeline for all bytes; static bits are muted, toggling bits are colored per byte. hover for per-bit details. auto-subsamples large logs
- **Stats** — per-byte table with min, max, mean, stdev, unique value count, change rate, and an inline range bar. timing section shows avg rate (Hz), min/max/avg interval, total span
- **Annotations** — define signals with start bit, length, byte order (Intel LE / Motorola BE), scaling, offset, and unit. decoded value from the latest frame shown live. delete per signal

### Input & Import
- **candump format**: `(1720000000.123456) can0 123#AABBCCDDEEFF0011`
- **Simple format**: `123#AABBCCDDEEFF0011`
- **DBC file import** — import `.dbc` files to auto-annotate all matching IDs with their signal definitions (Intel and Motorola byte order both supported)

### Hex Dump Tools
- **Frame filter** — filter displayed rows by byte conditions: `B0>0x80`, `B2==0xFF`, `B1!=0x00`, space-separated or `&&`
- **Right-click copy** — copy any frame row as: candump line, hex string, Python bytes literal, C array, or CSV
- **Signal overlay** — colored badges in column headers and bottom borders on cells wherever an annotation covers that byte
- **Highlight modes** — delta from previous frame, relative to baseline (frame 0), or none

### General
- Dark / light mode toggle
- Export annotations as JSON
- Privacy-focused — no network requests, no telemetry

---

## Prerequisites

- **Rust** — install via [rustup](https://rustup.rs/)
- **Node.js** (18+)
- **Linux only**: `sudo apt install libwebkit2gtk-4.1-dev` (or equivalent for your distro)
- **Windows**: WebView2 runtime (auto-installed on Win11, download for Win10)
- **macOS**: no additional dependencies

---

## Getting Started

```bash
# install js deps (tauri cli)
npm install

# run in dev mode (hot-reloads frontend on file changes)
npm run tauri dev

# production build
npm run tauri build
```

Binaries land in `target/release/bundle/`.

> **Note:** the first `npm run tauri dev` will take several minutes to compile ~473 rust crates. subsequent runs are fast (cached).

---

## Project Structure

```
can-playground/
├── src/                    # frontend (HTML/CSS/JS)
│   ├── index.html
│   ├── script.js
│   └── styles.css
├── src-tauri/              # rust backend
│   ├── src/main.rs
│   └── icons/
├── tauri.conf.json
├── Cargo.toml
├── build.rs
└── package.json
```

---

## Usage

### Parsing logs
1. paste candump output (or `ID#payload` lines) into the text area
2. click **Parse Log**
3. click any ID in the sidebar to inspect it

### Defining signals manually
1. switch to the **Annotations** tab
2. fill in signal name, start bit, length, byte order, type, scale, offset, unit
3. click **Add Signal** — the signal will appear as a colored overlay in the hex dump and show its decoded value live

### Using a DBC file
1. click **Import DBC** in the header
2. pick your `.dbc` file — all signals for matching IDs are imported automatically
3. switch to **Annotations** to review, or see the overlays immediately in **Hex Dump**

### Filtering frames
in the **Hex Dump** tab, type conditions in the filter bar:
```
B0 > 0x80
B2 == 0xFF  B1 != 0x00
B0 >= 0x10 && B0 <= 0x7F
```

### Copying a frame
right-click any row in the hex dump for copy options.

---

## Troubleshooting

**app gets stuck on startup / blank window**
- make sure `tauri.conf.json` has no `devUrl` field under `build` — it should only have `frontendDist: "./src"`. if a `devUrl` is present, tauri will wait for a dev server that never starts.

**build fails on linux**
- install webkit2gtk: `sudo apt install libwebkit2gtk-4.1-dev`
- run `cargo tauri info` for a full dependency report

**DBC signals decode incorrectly**
- double-check byte order (Intel vs Motorola) and start bit convention — different tools use different numbering schemes

---

## Tech Stack

- [Tauri v2](https://tauri.app/) — desktop shell
- [Rust](https://www.rust-lang.org/) — native backend
- [Chart.js](https://www.chartjs.org/) — graphing
- HTML / CSS / vanilla JS — UI

---

## License

MIT — see LICENSE file.

---

*acknowledgments: tauri team, the CAN bus community, and Zenotrek for getting me into car hacking / reverse engineering in the first place*
