#!@GJS@ -m

// SPDX-FileCopyrightText: 2022 Romain Vigier <contact AT romainvigier.fr>
//
// SPDX-License-Identifier: GPL-3.0-or-later

import 'gi://Adw?version=1';
import 'gi://Gdk?version=4.0';
import 'gi://Gtk?version=4.0';

import GLib from 'gi://GLib';
import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import system from 'system';


imports.package.init({ // eslint-disable-line no-restricted-globals
    name: '@PACKAGE_NAME@',
    version: '@PACKAGE_VERSION@',
    prefix: '@PREFIX@',
    libdir: '@LIBDIR@',
});
globalThis.devel = '@DEVEL@' === 'True';

// Setup local environment for development
try {
    const scriptFile = Gio.File.new_for_path(system.programInvocationName);
    const buildSrcDir = scriptFile.get_parent();
    const buildRoot = buildSrcDir.get_parent();
    const sourceRoot = buildRoot.get_parent();

    // Register Resources once
    const registered = new Set();
    [buildSrcDir, buildRoot.get_child('data')].forEach(dir => {
        if (!dir.query_exists(null)) return;
        const enumerator = dir.enumerate_children('standard::name', Gio.FileQueryInfoFlags.NONE, null);
        let info;
        while ((info = enumerator.next_file(null)) !== null) {
            const name = info.get_name();
            if (name.endsWith('.gresource')) {
                const resFile = dir.get_child(name);
                const path = resFile.get_path();
                if (!registered.has(path)) {
                    const resource = Gio.Resource.load(path);
                    Gio.resources_register(resource);
                    registered.add(path);
                }
            }
        }
    });

    // Register Icons Path
    GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
        const display = Gdk.Display.get_default();
        if (display) {
            const iconTheme = Gtk.IconTheme.get_for_display(display);
            
            // 1. Add resource path for internal icons (Play, Stop, etc.)
            // This works for both installed and development versions
            iconTheme.add_resource_path('/fr/romainvigier/zap/icons');

            // 2. Add local search path (only if running from build directory)
            const localIcons = sourceRoot.get_child('data').get_child('icons');
            if (localIcons.query_exists(null)) {
                iconTheme.add_search_path(localIcons.get_path());
            }
        }
        return GLib.SOURCE_REMOVE;
    });

} catch (e) {
}
imports.package.initGettext(); // eslint-disable-line no-restricted-globals
const loop = new GLib.MainLoop(null, false);
import('resource:///fr/romainvigier/zap/js/main.js')
    .then(main => {
        GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            loop.quit();
            imports.package.run(main); // eslint-disable-line no-restricted-globals
            return GLib.SOURCE_REMOVE;
        });
    })
    .catch(logError);
loop.run();
