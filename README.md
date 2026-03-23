# CAN Frame Playground

A desktop CAN bus analysis tool built with Tauri. Parse, visualize, and reverse-engineer CAN logs — or capture live from a SocketCAN interface. All processing is local, nothing leaves your machine.

<img width="1204" height="800" alt="canplkayround3" src="https://github.com/user-attachments/assets/a91d967a-691b-4b14-bd5d-86bc34e4749c" />


---

## Install (Linux)

Pre-built binaries are available on the [releases page](https://github.com/numbpilled/can-playground/releases).

**.deb** — Debian / Ubuntu / Mint / Kali:
```bash
sudo dpkg -i "CAN Frame Playground_0.1.0_amd64.deb"
```

**.rpm** — Fedora / RHEL / openSUSE:
```bash
sudo rpm -i "CAN Frame Playground-0.1.0-1.x86_64.rpm"
```

**.AppImage** — any Linux distro, no install needed:
```bash
chmod +x "CAN Frame Playground_0.1.0_amd64.AppImage"
./"CAN Frame Playground_0.1.0_amd64.AppImage"
```

> **Note:** live capture requires `candump` — install via `sudo apt install can-utils`. Windows and macOS can build from source but live capture is Linux-only.

---

## Features

### Analysis Views
- **Hex Dump** — frame-by-frame byte table with delta/baseline change highlighting, signal overlay coloring, per-cell tooltips (hex, dec, bin, delta), virtual scroll for smooth handling of 100k+ frame logs, and keyboard arrow-key frame navigation
- **Delta Graph** — Chart.js line plot with scroll-wheel zoom and drag-pan; modes: byte values, decoded signals, message rate (inter-frame interval); toggle delta mode, hide static bytes; **Compare IDs** overlays multiple CAN IDs on the same graph
- **Bit Map** — canvas-rendered bit-level timeline across all frames; static bits are muted, toggling bits are colored per byte; styled hover tooltip shows frame, byte, bit, value, and toggle status; auto-subsamples large logs
- **Stats** — per-byte table: min, max, mean, stdev, unique value count, change rate, inline range bar; timing section: avg rate (Hz), min/max/avg interval, total span
- **Annotations** — define signals with start bit, length, byte order (Intel LE / Motorola BE), type, scale, offset, unit; decoded value from latest frame shown live; delete per signal

### Input & Import
- **candump format**: `(1720000000.123456) can0 123#AABBCCDDEEFF0011`
- **Simple format**: `123#AABBCCDDEEFF0011` (sequential synthetic timestamps assigned automatically)
- **Vector .asc**: `0.000000  1  123  Rx  d 8 AA BB CC DD EE FF 00 11`
- **PCAN .trc**: `1)  0.0000 Rx  0123  8  AA BB CC DD EE FF 00 11` (v1.1 and v2.x)
- **Open File** — load any log file via button or drag-and-drop onto the textarea
- **DBC import** — import `.dbc` files to auto-annotate all matching IDs (Intel and Motorola byte order)
- **Import Signals** — import a previously exported signals JSON to restore annotations without a full session

### Live Capture
- Connect to any SocketCAN interface (`can0`, `vcan0`, `any`, etc.)
- Frames stream in real-time, sidebar and views update live
- Requires `candump` to be installed (standard in `can-utils` on Linux)
- Automatically detects available CAN interfaces

### Hex Dump Tools
- **Frame filter** — filter displayed rows by byte conditions: `B0>0x80`, `B2==0xFF`, `B1!=0x00`, space-separated or `&&`
- **Right-click copy** — copy any frame row as: candump line, hex string, Python bytes literal, C array, or CSV
- **Signal overlay** — colored badges in column headers and bottom borders on cells where an annotation covers that byte
- **Highlight modes** — delta from previous frame, relative to baseline (frame 0), or none
- **Keyboard navigation** — arrow keys step through frames; `1–5` switch tabs; `f` focuses filter; `Ctrl+Enter` parses

### Session & Export
- **Save / Load Session** — serialize the full log + annotations + ID labels to a `.json` file and restore later
- **Export Signals** — export all signal annotations as JSON
- **Export CSV** — export decoded signal values for all frames across all IDs

### General
- **ID Labels** — assign human-readable names to CAN IDs in the sidebar (persist in sessions)
- Dark / light mode toggle
- No network requests, no telemetry

---

## Prerequisites (building from source)

- **Rust** — install via [rustup](https://rustup.rs/)
- **Node.js** (18+)
- **Linux**: `sudo apt install libwebkit2gtk-4.1-dev` (or distro equivalent)
- **Windows**: WebView2 runtime (auto-installed on Win11, download for Win10)
- **macOS**: no additional dependencies
- **Live capture** (Linux only): `sudo apt install can-utils`

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
│   ├── src/main.rs         # live capture commands
│   ├── capabilities/
│   │   └── default.json
│   └── icons/
├── tauri.conf.json
├── Cargo.toml
├── build.rs
└── package.json
```

---

## Usage

### Parsing logs
1. paste candump, .asc, .trc, or bare `ID#payload` lines into the text area — or drag-drop / open a file
2. click **Parse Log** (or press `Ctrl+Enter`)
3. click any ID in the sidebar to inspect it

### ID labels
double-click any ID label in the sidebar to give it a human-readable name (e.g. `Engine ECU`). labels persist in saved sessions.

### Defining signals manually
1. switch to the **Annotations** tab
2. fill in signal name, start bit, length, byte order, type, scale, offset, unit
3. click **Add Signal** — the signal appears as a colored overlay in the hex dump and shows its decoded value live

### Using a DBC file
1. click **Import DBC** in the header
2. pick your `.dbc` file — all signals for matching IDs are imported automatically
3. switch to **Annotations** to review, or see the overlays immediately in **Hex Dump**

### Live capture
1. enter a SocketCAN interface name (e.g. `can0`, `any`) in the capture input in the header — or click the interface dropdown to pick a detected one
2. click **Start Capture** — frames stream in and the UI updates live
3. click **Stop Capture** when done

### Filtering frames
in the **Hex Dump** tab, type conditions in the filter bar:
```
B0 > 0x80
B2 == 0xFF  B1 != 0x00
B0 >= 0x10 && B0 <= 0x7F
```

### Keyboard shortcuts
| Key | Action |
|-----|--------|
| `Ctrl+Enter` | Parse log |
| `1` – `5` | Switch tabs |
| `↑` / `↓` | Step through frames (Hex Dump tab) |
| `f` | Focus frame filter |
| `Esc` | Close context menu |

### Copying a frame
right-click any row in the hex dump for copy options.

---

## Troubleshooting

**app gets stuck on startup / blank window**
- make sure `tauri.conf.json` has no `devUrl` field under `build` — it should only have `frontendDist: "./src"`. if a `devUrl` is present, tauri will wait for a dev server that never starts.

**build fails on linux**
- install webkit2gtk: `sudo apt install libwebkit2gtk-4.1-dev`
- run `cargo tauri info` for a full dependency report

**live capture fails**
- ensure `candump` is installed: `sudo apt install can-utils`
- ensure the interface is up: `sudo ip link set can0 up type can bitrate 500000`
- for virtual testing: `sudo modprobe vcan && sudo ip link add dev vcan0 type vcan && sudo ip link set vcan0 up`

**DBC signals decode incorrectly**
- double-check byte order (Intel vs Motorola) and start bit convention — different tools use different numbering schemes

---

## Tech Stack

- [Tauri v2](https://tauri.app/) — desktop shell
- [Rust](https://www.rust-lang.org/) — native backend / live capture
- [Chart.js](https://www.chartjs.org/) + [chartjs-plugin-zoom](https://www.chartjs.org/chartjs-plugin-zoom/) — graphing
- HTML / CSS / vanilla JS — UI

---

## License

MIT — see LICENSE file.

---

*acknowledgments: tauri team, the CAN bus community, and Zenotrek for getting me into car hacking / reverse engineering in the first place*
