# Decargot

[![release](https://img.shields.io/github/v/release/SUP2Ak/decargot?style=flat-square)](https://github.com/SUP2Ak/decargot/releases)

[![](https://img.shields.io/badge/Français-000?style=for-the-badge&logo=github&logoColor=white)](README.fr.md)

---

**Decargot** is a modern desktop app (Tauri + React + Mantine) for Windows, designed to scan, visualize and clean up Rust (Cargo) `target` folders on your drives.

---

## Features

- **Fast scan** of multiple folders/disks for Cargo projects and their `target` folders
- **Display the size** of each detected `target` folder
- **Permanent and secure deletion** of `target` folders (no recycle bin)
- **Real-time progress bar** during deletion, with freed space estimation
- **Duplicate detection and management** (same `target` folder found multiple times)
- **Multi-selection** and batch deletion
- **Modern, responsive UI** (Mantine, React), dark theme, smooth animations
- **Built-in updater** (check and install new versions in one click)
- **Windows support** (Linux/Mac planned)

---

## Installation

1. **Download the latest `.msi` release** from the [Releases page](https://github.com/SUP2Ak/decargot/releases).
2. **Run the installer** and follow the instructions.
3. **Launch Decargot** from the Start menu or desktop shortcut.

> The app includes an auto-updater: you'll be notified when a new version is available and can install it in one click.

---

## Usage

1. **Select one or more folders/disks** to scan.
2. **Start the scan** to detect all Cargo projects and their `target` folders.
3. **View the size** of each detected `target` folder.
4. **Select folders to delete** (individually or in batch).
5. **Start deletion**: the progress bar updates in real time, and disk space is freed instantly.

---

## Roadmap

- [ ] Linux/Mac support
- [ ] More cleaning options (node_modules, .venv, ...)
- [ ] Deletion history
- [ ] Advanced UI customization
- [ ] **Multi-language support**

---

## Warning

> **Warning:** Deletion is permanent (no recycle bin). Double-check your selection before cleaning.

---

## License

MIT

---

## Author

- [SUP2Ak](https://github.com/SUP2Ak)
