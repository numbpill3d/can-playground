# CAN Frame Playground - Tauri Desktop App

A desktop version of the CAN Frame Playground tool built with Tauri for cross-platform deployment.

## Features

- Parse CAN bus logs with syntax highlighting
- Visualize hex dumps with delta change detection
- Graph delta changes over time
- Annotate signals with custom names and properties
- Dark/light mode support
- Drag-and-drop file support
- All processing happens locally - no data leaves your machine

## Prerequisites

Before building the application, ensure you have the following installed:

- **Rust**: Install via [rustup](https://rustup.rs/) (recommended)
- **Node.js** (18+): Required for development tools
- **Platform-specific dependencies**:
  - **Linux**: `webkit2gtk` (install with `sudo apt install libwebkit2gtk-4.1-dev` on Ubuntu/Debian)
  - **Windows**: WebView2 runtime (automatically installed)
  - **macOS**: No additional dependencies needed

## Installation & Development

1. **Clone and navigate to the project directory**
   ```bash
   cd can-playground
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Run in development mode**
   ```bash
   cargo tauri dev
   ```

## Building for Production

To build the application for distribution:

```bash
cargo tauri build
```

This will create platform-specific bundles in `target/release/bundle/`:
- **Windows**: `.msi` installer and `.exe` executable
- **macOS**: `.app` bundle and `.dmg` disk image
- **Linux**: `.deb` package, `.AppImage`, and other formats

## Project Structure

```
can-playground/
├── src/                    # Frontend files (HTML, CSS, JS)
│   ├── index.html          # Main application HTML
│   ├── script.js           # Application logic
│   └── styles.css          # Styling
├── src-tauri/              # Rust backend
│   ├── Cargo.toml          # Rust dependencies
│   ├── src/
│   │   └── main.rs         # Rust application entry point
│   └── icons/              # Application icons
├── tauri.conf.json         # Tauri configuration
└── Cargo.toml              # Rust project manifest
```

## Configuration Notes

- **Window Size**: Starts at 1200x800 with minimum size of 800x600
- **Title**: "CAN Frame Playground"
- **Security**: CSP disabled to allow CDN resources (Chart.js, PapaParse)
- **Icons**: Placeholder icons included (replace with your own)

## Customization

### Adding Custom Icons

Replace the placeholder icons in `src-tauri/icons/` with your custom icons:
- `icon.png` (for Linux/macOS)
- `icon.ico` (for Windows)
- Various sizes as needed

### Modifying the UI

All UI changes can be made in the files under the `src/` directory:
- `index.html`: Structure and external resource links
- `styles.css`: Visual styling and dark mode themes
- `script.js`: Core application logic

## Distribution

The built application bundles will be located in `target/release/bundle/`:
- **Windows**: `target/release/bundle/msi/can-frame-playground_x.x.x_x64.msi`
- **macOS**: `target/release/bundle/dmg/can-frame-playground_x.x.x_x64.dmg`
- **Linux**: `target/release/bundle/deb/can-frame-playground_x.x.x_amd64.deb` and `target/release/bundle/appimage/can-frame-playground_x.x.x_amd64.AppImage`

## Troubleshooting

### Common Issues

1. **Build fails on Linux**
   - Ensure you have `webkit2gtk` installed: `sudo apt install libwebkit2gtk-4.1-dev`

2. **Missing dependencies**
   - Run `cargo tauri info` to diagnose dependency issues

3. **Icons not showing**
   - Verify icon paths in `tauri.conf.json` match actual files

### Getting Help

Run `cargo tauri info` to get detailed system information for troubleshooting.

## Technologies Used

- **Tauri**: Framework for building desktop apps with web technologies
- **Rust**: Backend language for system-level operations
- **Web Technologies**: HTML, CSS, JavaScript for the UI
- **Chart.js**: For plotting delta graphs
- **PapaParse**: For CSV parsing (if applicable)

---

Built with ❤️ using Tauri v2