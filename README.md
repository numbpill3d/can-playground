# CAN Frame Playground - Tauri Desktop Application

A desktop version of the CAN Frame Playground tool built with Tauri for cross-platform deployment. This application allows you to parse, visualize, and analyze CAN bus logs with a native desktop experience.

## Features

- **Parse CAN bus logs** with syntax highlighting and validation
- **Visualize hex dumps** with delta change detection and highlighting
- **Graph delta changes** over time for trend analysis
- **Signal annotation system** to label and document specific fields
- **Dark/light mode support** for comfortable viewing
- **Drag-and-drop file support** for easy log loading
- **Privacy-focused** - All processing happens locally, no data leaves your machine
- **Cross-platform** - Works on Windows, macOS, and Linux

## Prerequisites

Before building the application, ensure you have the following installed:

- **Rust**: Install via [rustup](https://rustup.rs/) (recommended)
- **Node.js** (18+): Required for development tools
- **Platform-specific dependencies**:
  - **Linux**: `webkit2gtk` (install with `sudo apt install libwebkit2gtk-4.1-dev` on Ubuntu/Debian)
  - **Windows**: WebView2 runtime (automatically installed)
  - **macOS**: No additional dependencies needed

## Installation & Development

### Clone and Setup
```bash
# Navigate to the project directory
cd can-playground

# Install dependencies
npm install
```

### Development Mode
```bash
# Run in development mode
cargo tauri dev
```

This will start the application in development mode with hot reloading enabled.

### Production Build
```bash
# Build for production
cargo tauri build
```

This will create platform-specific bundles in `target/release/bundle/`.

## Project Structure

```
can-playground/
├── src/                    # Frontend files (HTML, CSS, JS)
│   ├── index.html          # Main application HTML structure
│   ├── script.js           # Core application logic and parsing functions
│   └── styles.css          # Complete styling with dark/light mode
├── src-tauri/              # Rust backend
│   ├── Cargo.toml          # Rust dependencies and configuration
│   ├── src/
│   │   └── main.rs         # Rust application entry point
│   └── icons/              # Application icons
├── tauri.conf.json         # Tauri configuration
├── Cargo.toml              # Rust project manifest
├── build.rs                # Build script for Tauri
├── package.json            # Node.js package configuration
└── README.md               # This file
```

## Configuration

### Window Settings
- **Title**: "CAN Frame Playground"
- **Size**: 1200x800 pixels (resizable)
- **Minimum Size**: 800x600 pixels
- **Resizable**: Yes

### Security Settings
- **CSP**: Disabled to allow CDN resources (Chart.js, PapaParse)
- **External Resources**: CDN-hosted Chart.js and PapaParse for visualization

## Usage Guide

### Loading CAN Logs
1. Copy your CAN log data (supports candump format)
2. Paste it into the input text area
3. Click the "Parse Log" button

### Supported Formats
- Candump format: `(timestamp) interface ID#payload`
- Example: `(1720000000.123456) can0 123#AABBCCDDEEFF0011`

### Navigation
- **Hex Dump Tab**: Shows raw hex values with change highlighting
- **Delta Graph Tab**: Plots value changes over time
- **Annotations Tab**: Allows signal labeling and documentation

### Highlighting Modes
- **Delta from Previous**: Highlights bytes that changed from the previous frame
- **Relative to Baseline**: Highlights differences from a baseline frame

## Customization

### Adding Custom Icons
Replace the placeholder icons in `src-tauri/icons/` with your custom icons:
- `icon.png` (for Linux/macOS)
- `icon.ico` (for Windows)
- `icon.icns` (for macOS)

### Modifying the UI
All UI changes can be made in the files under the `src/` directory:
- `index.html`: Structure and external resource links
- `styles.css`: Visual styling and dark mode themes
- `script.js`: Core application logic

### Adding New Features
To add new features, you can extend the JavaScript functionality in `script.js` or add new Rust commands in `src-tauri/src/main.rs`.

## Distribution

The built application bundles will be located in `target/release/bundle/`:

- **Windows**: 
  - `target/release/bundle/msi/can-frame-playground_x.x.x_x64.msi`
  - `target/release/bundle/app/can-frame-playground_x.x.x_x64.app`

- **macOS**: 
  - `target/release/bundle/dmg/can-frame-playground_x.x.x_x64.dmg`
  - `target/release/bundle/macos/can-frame-playground_x.x.x_x64.app`

- **Linux**: 
  - `target/release/bundle/deb/can-frame-playground_x.x.x_amd64.deb`
  - `target/release/bundle/appimage/can-frame-playground_x.x.x_amd64.AppImage`

## Troubleshooting

### Common Issues

1. **Build fails on Linux**
   - Ensure you have `webkit2gtk` installed: `sudo apt install libwebkit2gtk-4.1-dev`

2. **Missing dependencies**
   - Run `cargo tauri info` to diagnose dependency issues

3. **Icons not showing**
   - Verify icon paths in `tauri.conf.json` match actual files

4. **External resources not loading**
   - Check internet connection for CDN resources (Chart.js, PapaParse)

### Getting Help

Run `cargo tauri info` to get detailed system information for troubleshooting.

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Commit your changes (`git commit -m 'Add amazing feature'`)
5. Push to the branch (`git push origin feature/amazing-feature`)
6. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Technologies Used

- **[Tauri](https://tauri.app/)**: Framework for building desktop apps with web technologies
- **[Rust](https://www.rust-lang.org/)**: Backend language for system-level operations
- **Web Technologies**: HTML, CSS, JavaScript for the UI
- **[Chart.js](https://www.chartjs.org/)**: For plotting delta graphs
- **[PapaParse](https://www.papaparse.com/)**: For CSV parsing

## Acknowledgments

- Thanks to the Tauri team for creating an excellent framework for desktop applications
- The CAN bus community for their continued work in automotive communication protocols
- Zenotrek for getting me interested in car hacking/reverse engingeering in the first place

---

Built with ❤️ using Tauri v2
