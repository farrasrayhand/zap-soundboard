#!/bin/bash
# =============================================================
# Zap - Linux Install Script (Fixed)
# Fixes: DBus activatable error, color not working on GTK4 4.12+
# =============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_PREFIX="${HOME}/.local"

echo "=== Zap Soundboard - Linux Installer (Fixed) ==="
echo ""

# ---- Check dependencies ----
echo "[1/5] Checking dependencies..."

check_dep() {
    if ! command -v "$1" &>/dev/null && ! pkg-config --exists "$2" 2>/dev/null; then
        echo "  MISSING: $3"
        MISSING=1
    else
        echo "  OK: $3"
    fi
}

MISSING=0
command -v gjs &>/dev/null && echo "  OK: gjs (GJS)" || { echo "  MISSING: gjs (GJS)"; MISSING=1; }
command -v meson &>/dev/null && echo "  OK: meson" || { echo "  MISSING: meson"; MISSING=1; }
command -v ninja &>/dev/null && echo "  OK: ninja" || { echo "  MISSING: ninja-build"; MISSING=1; }
pkg-config --exists gtk4 2>/dev/null && echo "  OK: GTK4 (libgtk-4-dev)" || { echo "  MISSING: libgtk-4-dev"; MISSING=1; }
pkg-config --exists libadwaita-1 2>/dev/null && echo "  OK: libadwaita-1 (libadwaita-1-dev)" || { echo "  MISSING: libadwaita-1-dev"; MISSING=1; }
pkg-config --exists gstreamer-1.0 2>/dev/null && echo "  OK: GStreamer (libgstreamer1.0-dev)" || { echo "  MISSING: libgstreamer1.0-dev + gstreamer1.0-plugins-good"; MISSING=1; }
pkg-config --exists tracker-sparql-3.0 2>/dev/null && echo "  OK: Tracker3 (libtracker-sparql-3.0-dev)" || { echo "  MISSING: libtracker-sparql-3.0-dev"; MISSING=1; }

if [ "$MISSING" = "1" ]; then
    echo ""
    echo "Install missing dependencies with:"
    echo "  sudo apt install gjs meson ninja-build \\"
    echo "    libgtk-4-dev libadwaita-1-dev \\"
    echo "    libgstreamer1.0-dev gstreamer1.0-plugins-good gstreamer1.0-plugins-bad \\"
    echo "    libtracker-sparql-3.0-dev gettext"
    echo ""
    read -p "Continue anyway? [y/N] " yn
    [[ "$yn" == "y" || "$yn" == "Y" ]] || exit 1
fi

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
