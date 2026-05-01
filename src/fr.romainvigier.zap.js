#!@GJS@ -m

// SPDX-FileCopyrightText: 2022 Romain Vigier <contact AT romainvigier.fr>
//
// SPDX-License-Identifier: GPL-3.0-or-later

import GLib from 'gi://GLib';


imports.package.init({ // eslint-disable-line no-restricted-globals
    name: '@PACKAGE_NAME@',
    version: '@PACKAGE_VERSION@',
    prefix: '@PREFIX@',
    libdir: '@LIBDIR@',
});
globalThis.devel = '@DEVEL@' === 'True';

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
