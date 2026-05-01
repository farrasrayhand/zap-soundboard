// SPDX-FileCopyrightText: 2022 Romain Vigier <contact AT romainvigier.fr>
//
// SPDX-License-Identifier: GPL-3.0-or-later

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';

import { Color } from '../enums/Color.js';


/**
 * A Zap.
 */
export class Zap extends GObject.Object {

    static {
        GObject.registerClass({
            GTypeName: 'Zap',
            Properties: {
                uuid: GObject.ParamSpec.string('uuid', 'UUID', 'UUID', GObject.ParamFlags.READWRITE, ''),
                name: GObject.ParamSpec.string('name', 'Name', 'Name', GObject.ParamFlags.READWRITE, ''),
                collectionUuid: GObject.ParamSpec.string('collection-uuid', 'Collection UUID', 'Collection UUID', GObject.ParamFlags.READWRITE, ''),
                file: GObject.ParamSpec.object('file', 'File', 'File', GObject.ParamFlags.READWRITE, Gio.File),
                color: GObject.ParamSpec.jsobject('color', 'Color', 'Color', GObject.ParamFlags.READWRITE, Color.GRAY),
                loop: GObject.ParamSpec.boolean('loop', 'Loop', 'Loop', GObject.ParamFlags.READWRITE, false),
                volume: GObject.ParamSpec.double('volume', 'Volume', 'Volume', GObject.ParamFlags.READWRITE, 0.0, 1.0, 1.0),
                playing: GObject.ParamSpec.boolean('playing', 'Playing', 'Playing', GObject.ParamFlags.READWRITE, false),
                progress: GObject.ParamSpec.double('progress', 'Progress', 'Progress', GObject.ParamFlags.READWRITE, 0.0, 1.0, 0.0),
                position: GObject.ParamSpec.uint('position', 'Position', 'Position', GObject.ParamFlags.READWRITE, 0, GLib.MAXUINT32, 0),
                groupName: GObject.ParamSpec.string('group-name', 'Group Name', 'Group Name', GObject.ParamFlags.READWRITE, ''),
            },
        }, this);
    }

    /**
     * @param {object} params Parameter object.
     * @param {string} params.uuid UUID.
     * @param {string} params.name Name.
     * @param {string} params.collectionUuid Collection UUID.
     * @param {Gio.File} params.file GFile.
     * @param {Color} params.color Color.
     * @param {boolean} params.loop Loop.
     * @param {number} params.volume Volume, between 0 and 1.
     * @param {boolean} params.playing Playing state.
     * @param {number} params.progress Progress, between 0 and 1.
     * @param {number} params.position Position in the collection, an unsigned integer.
     * @param {string} params.groupName Name of the group.
     */
    constructor({
        uuid = '',
        name = '',
        collectionUuid = '',
        file = null,
        color = Color.GRAY,
        loop = false,
        volume = 1,
        playing = false,
        progress = 0,
        position = 0,
        groupName = '',
        ...params
    } = {}) {
        super(params);
        /**
         * UUID of the Zap.
         *
         * @type {string}
         */
        this.uuid = uuid;
        /**
         * Name of the Zap.
         *
         * @type {string}
         */
        this.name = name;
        /**
         * UUID of the Zap's collection.
         *
         * @type {string}
         */
        this.collectionUuid = collectionUuid;
        /**
         * GFile of the Zap.
         *
         * @type {Gio.File}
         */
        this.file = file;
        /**
         * Color of the Zap.
         *
         * @type {Color}
         */
        this.color = color;
        /**
         * If the Zap will repeat after it finishes playing.
         *
         * @type {boolean}
         */
        this.loop = loop;
        /**
         * The Zap volume, between 0 and 1.
         *
         * @type {number}
         */
        this.volume = volume;
        /**
         * If the Zap is playing.
         *
         * @type {boolean}
         */
        this.playing = playing;
        /**
         * The Zap's current progress, between 0 and 1.
         *
         * @type {number}
         */
        this.progress = progress;
        /**
         * Position of the Zap in its collection as an unsigned integer.
         *
         * @type {number}
         */
        this.position = position;
        /**
         * Name of the group the Zap belongs to.
         *
         * @type {string}
         */
        this.groupName = groupName || '';
    }

    /**
     * Wrap the Zap's properties in GVariants.
     *
     * @returns {object} The Zap.
     */
    toVariant() {
        return {
            uuid: new GLib.Variant('s', this.uuid),
            name: new GLib.Variant('s', this.name),
            collectionUuid: new GLib.Variant('s', this.collectionUuid),
            color: new GLib.Variant('s', this.color.id),
            loop: new GLib.Variant('b', this.loop),
            volume: new GLib.Variant('d', this.volume),
            playing: new GLib.Variant('b', this.playing),
            progress: new GLib.Variant('d', this.progress),
            position: new GLib.Variant('i', this.position),
            groupName: new GLib.Variant('s', this.groupName || ''),
        };
    }

}
