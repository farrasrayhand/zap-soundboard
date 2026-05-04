#!/bin/bash

# SPDX-FileCopyrightText: 2022 Romain Vigier <contact AT romainvigier.fr>
# SPDX-FileCopyrightText: 2026 Farras Rayhand <farrasrayhand@gmail.com>
#
# SPDX-License-Identifier: GPL-3.0-or-later

# =============================================================
# Zap - Linux Uninstall Script
# Removes all files installed by install-linux.sh
# =============================================================

set -e

INSTALL_PREFIX="${HOME}/.local"
APP_ID="fr.romainvigier.zap"

echo "=== Zap Soundboard - Linux Uninstaller ==="
echo ""

read -p "Remove Zap from the system? Sound data you've added will NOT be deleted. [y/N] " yn
[[ "$yn" == "y" || "$yn" == "Y" ]] || { echo "Cancelled."; exit 0; }

echo ""

# ---- Binary ----
echo "[1/7] Removing binary..."
BIN="$INSTALL_PREFIX/bin/$APP_ID"
if [ -f "$BIN" ]; then
    rm -f "$BIN"
    echo "  Removed: $BIN"
else
    echo "  Not found: $BIN"
fi

# ---- GResource bundles ----
echo ""
echo "[2/7] Removing resource bundles..."
PKGDATA="$INSTALL_PREFIX/share/$APP_ID"
if [ -d "$PKGDATA" ]; then
    rm -rf "$PKGDATA"
    echo "  Removed: $PKGDATA"
else
    echo "  Not found: $PKGDATA"
fi

# ---- GSettings schema ----
echo ""
echo "[3/7] Removing GSettings schema..."
SCHEMA_FILE="$INSTALL_PREFIX/share/glib-2.0/schemas/$APP_ID.gschema.xml"
if [ -f "$SCHEMA_FILE" ]; then
    rm -f "$SCHEMA_FILE"
    echo "  Removed: $SCHEMA_FILE"
    # Recompile schemas without this app
    SCHEMA_DIR="$INSTALL_PREFIX/share/glib-2.0/schemas"
    glib-compile-schemas "$SCHEMA_DIR" 2>/dev/null && echo "  Schemas recompiled." || true
else
    echo "  Not found: $SCHEMA_FILE"
fi

# ---- Desktop file ----
echo ""
echo "[4/7] Removing desktop entry..."
DESKTOP_FILE="$INSTALL_PREFIX/share/applications/$APP_ID.desktop"
if [ -f "$DESKTOP_FILE" ]; then
    rm -f "$DESKTOP_FILE"
    echo "  Removed: $DESKTOP_FILE"
    update-desktop-database "$INSTALL_PREFIX/share/applications" 2>/dev/null || true
else
    echo "  Not found: $DESKTOP_FILE"
fi

# ---- Icons ----
echo ""
echo "[5/7] Removing icons..."
ICON_FILES=(
    "$INSTALL_PREFIX/share/icons/hicolor/scalable/apps/$APP_ID.svg"
    "$INSTALL_PREFIX/share/icons/hicolor/symbolic/apps/$APP_ID-symbolic.svg"
    "$INSTALL_PREFIX/share/pixmaps/$APP_ID.svg"
)
for ICON in "${ICON_FILES[@]}"; do
    if [ -f "$ICON" ]; then
        rm -f "$ICON"
        echo "  Removed: $ICON"
    else
        echo "  Not found: $ICON"
    fi
done
gtk-update-icon-cache -f "$INSTALL_PREFIX/share/icons/hicolor" 2>/dev/null || true
xdg-desktop-menu forceupdate 2>/dev/null || true

# ---- D-Bus files ----
echo ""
echo "[6/7] Removing D-Bus files..."
DBUS_FILES=(
    "$HOME/.local/share/dbus-1/services/$APP_ID.service"
    "$INSTALL_PREFIX/share/dbus-1/services/$APP_ID.service"
    "$INSTALL_PREFIX/share/dbus-1/interfaces/$APP_ID.Collections.xml"
    "$INSTALL_PREFIX/share/dbus-1/interfaces/$APP_ID.Zaps.xml"
)
for F in "${DBUS_FILES[@]}"; do
    if [ -f "$F" ]; then
        rm -f "$F"
        echo "  Removed: $F"
    else
        echo "  Not found: $F"
    fi
done

# ---- AppStream metainfo ----
METAINFO="$INSTALL_PREFIX/share/metainfo/$APP_ID.metainfo.xml"
if [ -f "$METAINFO" ]; then
    rm -f "$METAINFO"
    echo "  Removed: $METAINFO"
fi

# ---- User data (optional) ----
echo ""
echo "[7/7] User data (database & settings)..."
USER_DATA_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/$APP_ID"
USER_SETTINGS="${XDG_CONFIG_HOME:-$HOME/.config}/dconf"  # dconf stores all GSettings

echo "  Database location: $USER_DATA_DIR"
if [ -d "$USER_DATA_DIR" ]; then
    read -p "  Also delete the database (stored sounds list)? [y/N] " yn2
    if [[ "$yn2" == "y" || "$yn2" == "Y" ]]; then
        rm -rf "$USER_DATA_DIR"
        echo "  Removed: $USER_DATA_DIR"
    else
        echo "  Skipped. Data kept in: $USER_DATA_DIR"
    fi
else
    echo "  Database not found in: $USER_DATA_DIR"
fi

# Reset GSettings if dconf is available
if command -v dconf &>/dev/null; then
    read -p "  Reset GSettings (window size preferences, etc.)? [y/N] " yn3
    if [[ "$yn3" == "y" || "$yn3" == "Y" ]]; then
        dconf reset -f "/fr/romainvigier/zap/" 2>/dev/null && echo "  GSettings reset." || echo "  No settings to reset."
    fi
fi

echo ""
echo "=== Uninstall complete! ==="
echo "Zap has been removed from the system."
