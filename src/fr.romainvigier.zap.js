#!@GJS@ -m

// SPDX-FileCopyrightText: 2022 Romain Vigier <contact AT romainvigier.fr>
//
// SPDX-License-Identifier: GPL-3.0-or-later

import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import system from 'system';


imports.package.init({ // eslint-disable-line no-restricted-globals
    name: '@PACKAGE_NAME@',
    version: '@PACKAGE_VERSION@',
    prefix: '@PREFIX@',
    libdir: '@LIBDIR@',
});
globalThis.devel = '@DEVEL@' === 'True';

// Load the src resource bundle manually if we are running from the build directory
try {
    const scriptFile = Gio.File.new_for_path(system.programInvocationName);
    const buildSrcDir = scriptFile.get_parent();
    const buildRoot = buildSrcDir.get_parent();

    const searchDirs = [buildSrcDir, buildRoot];

    // Add all subdirs of build root to search path
    const enumerator = buildRoot.enumerate_children('standard::name,standard::type', Gio.FileQueryInfoFlags.NONE, null);
    let info;
    while ((info = enumerator.next_file(null)) !== null) {
        if (info.get_file_type() === Gio.FileType.DIRECTORY) {
            searchDirs.push(buildRoot.get_child(info.get_name()));
        }
    }

    for (const dir of searchDirs) {
        const dirEnumerator = dir.enumerate_children('standard::name', Gio.FileQueryInfoFlags.NONE, null);
        let fileInfo;
        while ((fileInfo = dirEnumerator.next_file(null)) !== null) {
            const name = fileInfo.get_name();
            if (name.endsWith('.gresource')) {
                const resourceFile = dir.get_child(name);
                const resource = Gio.Resource.load(resourceFile.get_path());
                Gio.resources_register(resource);
            }
        }
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
