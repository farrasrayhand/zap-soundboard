<!--
SPDX-FileCopyrightText: 2022 Romain Vigier <contact AT romainvigier.fr>

SPDX-License-Identifier: CC-BY-SA-4.0
-->

# Zap

Play all your favorite sound effects! This handy soundboard makes your livestreams and videocasts more entertaining.

Import audio files, arrange them in collections and customize their appearance.

This project is a fork of the original [Zap](https://gitlab.com/rmnvgr/zap) by Romain Vigier.

## New Features & Improvements

- **Persistent Grouping System**: Organize Zaps into named groups. Reorder groups and rename them on the fly.
- **Preferences & Safety Mode**: Settings window with a "Safety Mode" to prevent overlapping sounds, configurable fade-out duration, global hotkeys, and a "Hide Stop Button" option.
- **Seamless Migration (Import/Export)**: Back up your entire setup (collections, groups, sounds, settings, global hotkeys, and window preferences) into a single `.zap` archive. Includes progress bar and summary dialog after import/export. Everything is preserved — including layout positions, UUIDs, and group assignments — for a hassle-free transition between PCs.
- **Clean Up Unused Sounds**: Remove orphaned sound files left behind after deleting Zaps (Menu or `Ctrl+Shift+P`).
- **Live Volume Sync**: Volume changes in the edit popover apply instantly to currently playing sounds.
- **Simplified Group Selection**: Clean dropdown-only group picker in Add and Edit popups with a "No group" option to unassign.
- **Expanded Color Palette**: 18 colors optimized for Dark Mode and accessibility.
- **Playback Timestamps**: See current position and duration on each Zap.
- **Drag-and-Drop Reordering**: Rearrange Zaps by drag-and-drop; groups can be reordered with move up/down buttons.
- **Linux Installation Scripts**: Included `install-linux.sh` and `uninstall-linux.sh` for easy setup on Linux systems without Flatpak.
- **Enhanced Stability**: Optimized UI refresh logic, fixed memory corruption issues, and improved database query handling.

![](./resources/screenshots/1.png)

## Installing

Zap is available as a Flatpak on Flathub:

<a href="https://flathub.org/apps/details/fr.romainvigier.zap"><img src="https://flathub.org/assets/badges/flathub-badge-en.png" alt="Download on Flathub" width="240"></a>

## Building from source

### Dependencies

- GJS >= 1.73.2
- GTK >= 4.8.0
- Libadwaita >= 1.2.0
- GStreamer >= 1.20.0
- Tracker >= 3.4.0

### Using Meson

```
meson builddir
meson install -C builddir
```

See [`meson_options.txt`](./meson_options.txt) for available options.

### Using Flatpak

```
flatpak-builder --install builddir build-aux/fr.romainvigier.zap.yml
```

The GNOME platform and SDK runtimes must be installed.


## Contributing

See [`CONTRIBUTING.md`](./CONTRIBUTING.md).

The application is part of [GNOME Circle](https://circle.gnome.org/), so the [GNOME Code of Conduct](https://wiki.gnome.org/Foundation/CodeOfConduct) applies to this project.
