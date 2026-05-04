#!/bin/bash

# SPDX-FileCopyrightText: 2022 Romain Vigier <contact AT romainvigier.fr>
# SPDX-FileCopyrightText: 2026 Farras Rayhand <farrasrayhand@gmail.com>
#
# SPDX-License-Identifier: GPL-3.0-or-later

# =============================================================
# Zap - Linux Install Script (Fixed)
# Fixes: DBus activatable error, color not working on GTK4 4.12+
# =============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_PREFIX="${HOME}/.local"

echo "=== Zap Soundboard - Linux Installer (Fixed) ==="
echo ""

# ---- Detect OS and Install Dependencies ----
echo "[1/5] Checking system and dependencies..."

if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
    LIKE=$ID_LIKE
else
    OS=$(uname -s)
fi

install_apt() {
    echo "  Detected Debian/Ubuntu-based system."
    sudo apt update
    sudo apt install -y gjs meson ninja-build \
        libgtk-4-dev libadwaita-1-dev \
        libgstreamer1.0-dev gstreamer1.0-plugins-good gstreamer1.0-plugins-bad \
        gstreamer1.0-plugins-ugly gstreamer1.0-libav \
        libtracker-sparql-3.0-dev gettext
}

install_pacman() {
    echo "  Detected Arch/CachyOS-based system."
    sudo pacman -S --needed --noconfirm \
        gjs gtk4 libadwaita gstreamer gst-plugins-base \
        gst-plugins-good gst-plugins-bad gst-plugins-ugly \
        gst-libav tinysparql localsearch meson ninja gettext
}

case "$OS" in
    ubuntu|debian|pop|mint|kali)
        install_apt
        ;;
    arch|cachyos|manjaro|endeavouros)
        install_pacman
        ;;
    *)
        if [[ "$LIKE" == *"arch"* ]]; then
            install_pacman
        elif [[ "$LIKE" == *"debian"* ]] || [[ "$LIKE" == *"ubuntu"* ]]; then
            install_apt
        else
            echo "  WARNING: Unsupported distribution ($OS). Please install dependencies manually."
            echo "  Requirements: GJS, GTK4, Libadwaita, GStreamer (base, good, bad, ugly, libav), Tracker3/Tinysparql."
            read -p "  Continue anyway? [y/N] " yn
            [[ "$yn" == "y" || "$yn" == "Y" ]] || exit 1
        fi
        ;;
esac

# ---- Build ----
echo ""
echo "[2/5] Building with meson..."
cd "$SCRIPT_DIR"

BUILD_DIR="$SCRIPT_DIR/_build"
rm -rf "$BUILD_DIR"

meson setup "$BUILD_DIR" \
    --prefix="$INSTALL_PREFIX" \
    --buildtype=release \
    -Ddevel=False

ninja -C "$BUILD_DIR"

# ---- Install ----
echo ""
echo "[3/5] Installing to $INSTALL_PREFIX ..."
ninja -C "$BUILD_DIR" install

# ---- Compile schemas ----
echo ""
echo "[4/5] Compiling GSettings schemas..."
SCHEMA_DIR="$INSTALL_PREFIX/share/glib-2.0/schemas"
if [ -d "$SCHEMA_DIR" ]; then
    glib-compile-schemas "$SCHEMA_DIR"
    echo "  Schemas compiled."
else
    echo "  WARNING: Schema dir not found: $SCHEMA_DIR"
fi

# ---- Register D-Bus service ----
echo ""
echo "[5/5] Setting up D-Bus service..."
DBUS_SERVICE_DIR="$HOME/.local/share/dbus-1/services"
DBUS_SERVICE_FILE="$DBUS_SERVICE_DIR/fr.romainvigier.zap.service"

mkdir -p "$DBUS_SERVICE_DIR"

# Write D-Bus service file pointing to installed binary
cat > "$DBUS_SERVICE_FILE" << EOF
[D-BUS Service]
Name=fr.romainvigier.zap
Exec=$INSTALL_PREFIX/bin/fr.romainvigier.zap --gapplication-service
EOF
echo "  D-Bus service registered at: $DBUS_SERVICE_FILE"

# ---- Update desktop DB ----
update-desktop-database "$INSTALL_PREFIX/share/applications" 2>/dev/null || true
gtk-update-icon-cache -f "$INSTALL_PREFIX/share/icons/hicolor" 2>/dev/null || true

echo ""
echo "=== Installation complete! ==="
echo ""
echo "Run Zap with:"
echo "  $INSTALL_PREFIX/bin/fr.romainvigier.zap"
echo ""
echo "Or find it in your app launcher as 'Zap'"
