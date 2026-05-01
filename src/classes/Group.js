// SPDX-FileCopyrightText: 2022 Romain Vigier <contact AT romainvigier.fr>
// SPDX-FileCopyrightText: 2026 Farras Rayhand <farrasrayhand@gmail.com>
//
// SPDX-License-Identifier: GPL-3.0-or-later

import GLib from 'gi://GLib';
import GObject from 'gi://GObject';

/**
 * A Group of Zaps.
 */
export class Group extends GObject.Object {

    static {
        GObject.registerClass({
            GTypeName: 'ZapGroup',
            Properties: {
                uuid: GObject.ParamSpec.string('uuid', 'UUID', 'UUID', GObject.ParamFlags.READWRITE, ''),
                name: GObject.ParamSpec.string('name', 'Name', 'Name', GObject.ParamFlags.READWRITE, ''),
                collectionUuid: GObject.ParamSpec.string('collection-uuid', 'Collection UUID', 'Collection UUID', GObject.ParamFlags.READWRITE, ''),
                position: GObject.ParamSpec.uint('position', 'Position', 'Position', GObject.ParamFlags.READWRITE, 0, GLib.MAXUINT32, 0),
            },
        }, this);
    }

    /**
     * @param {object} params Parameter object.
     * @param {string} params.uuid UUID.
     * @param {string} params.name Name.
     * @param {string} params.collectionUuid Collection UUID.
     * @param {number} params.position Position in the collection.
     */
    constructor({
        uuid = '',
        name = '',
        collectionUuid = '',
        position = 0,
        ...params
    } = {}) {
        super(params);
        this.uuid = uuid;
        this.name = name;
        this.collectionUuid = collectionUuid;
        this.position = position;
    }

    /**
     * Wrap the Group's properties in GVariants.
     *
     * @returns {object} The Group.
     */
    toVariant() {
        return {
            uuid: new GLib.Variant('s', this.uuid),
            name: new GLib.Variant('s', this.name),
            collectionUuid: new GLib.Variant('s', this.collectionUuid),
            position: new GLib.Variant('i', this.position),
        };
    }

}
