// SPDX-FileCopyrightText: 2022 Romain Vigier <contact AT romainvigier.fr>
//
// SPDX-License-Identifier: GPL-3.0-or-later

import GLib from 'gi://GLib';
import GObject from 'gi://GObject';


/**
 * A collection.
 */
export class Collection extends GObject.Object {

    static {
        GObject.registerClass({
            GTypeName: 'ZapCollection',
            Properties: {
                uuid: GObject.ParamSpec.string('uuid', 'UUID', 'UUID', GObject.ParamFlags.READWRITE, ''),
                name: GObject.ParamSpec.string('name', 'Name', 'Name', GObject.ParamFlags.READWRITE, ''),
            },
        }, this);
    }

    /**
     * @param {object} params Parameter object.
     * @param {string} params.uuid UUID of the collection.
     * @param {string} params.name Name of the collection.
     */
    constructor({ uuid = '', name = '', ...params } = {}) {
        super(params);
        /**
         * UUID of the collection.
         *
         * @type {string}
         */
        this.uuid = uuid;
        /**
         * Name of the collection.
         *
         * @type {string}
         */
        this.name = name;
    }

    /**
     * Wrap the collection's properties in GVariants.
     *
     * @returns {object} The collection.
     */
    toVariant() {
        return {
            uuid: new GLib.Variant('s', this.uuid),
            name: new GLib.Variant('s', this.name),
        };
    }

}
