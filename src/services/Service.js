// SPDX-FileCopyrightText: 2022 Romain Vigier <contact AT romainvigier.fr>
//
// SPDX-License-Identifier: GPL-3.0-or-later

import GObject from 'gi://GObject';

/**
 * Service base class.
 *
 * The `start()` method must be called after construction, and the `exit()` method must be called before exiting.
 */
export class Service extends GObject.Object {

    static {
        GObject.registerClass(this);
    }

    /**
     * Start the service.
     */
    start() {}

    /**
     * Exit the service.
     */
    exit() {}

}
