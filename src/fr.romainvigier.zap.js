#!@GJS@ -m

// SPDX-FileCopyrightText: 2022 Romain Vigier <contact AT romainvigier.fr>
//
// SPDX-License-Identifier: GPL-3.0-or-later

import GLib from 'gi://GLib';
import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk?version=4.0';
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
    const sourceRoot = buildRoot.get_parent(); // /home/br3ad/Projects/zap

    // Register Resources
    const registeredPaths = new Set();
    const searchDirs = [buildSrcDir, buildRoot];

    const enumerator = buildRoot.enumerate_children('standard::name,standard::type', Gio.FileQueryInfoFlags.NONE, null);
    let info;
    while ((info = enumerator.next_file(null)) !== null) {
        if (info.get_file_type() === Gio.FileType.DIRECTORY) {
            searchDirs.push(buildRoot.get_child(info.get_name()));
        }
    }

    for (const dir of searchDirs) {
        if (!dir.query_exists(null)) continue;
        const dirEnumerator = dir.enumerate_children('standard::name', Gio.FileQueryInfoFlags.NONE, null);
        let fileInfo;
        while ((fileInfo = dirEnumerator.next_file(null)) !== null) {
            const name = fileInfo.get_name();
            if (name.endsWith('.gresource')) {
                const resourceFile = dir.get_child(name);
                const path = resourceFile.get_path();
                if (!registeredPaths.has(path)) {
                    const resource = Gio.Resource.load(path);
                    Gio.resources_register(resource);
                    registeredPaths.add(path);
                }
            }
        }
    }

    // Register Icons Path
    const iconTheme = Gtk.IconTheme.get_for_display(Gdk.Display.get_default());
    const localIcons = sourceRoot.get_child('data').get_child('icons');
    if (localIcons.query_exists(null)) {
        iconTheme.add_search_path(localIcons.get_path());
    }

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
