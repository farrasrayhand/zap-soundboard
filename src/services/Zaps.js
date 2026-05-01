// SPDX-FileCopyrightText: 2022 Romain Vigier <contact AT romainvigier.fr>
//
// SPDX-License-Identifier: GPL-3.0-or-later

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Tracker from 'gi://Tracker';

import { Collection } from '../classes/Collection.js';
import { Zap } from '../classes/Zap.js';

import { Color } from '../enums/Color.js';

import { Service } from './Service.js';


const ZAPS_DIR = Gio.File.new_for_path(GLib.build_filenamev([GLib.get_user_data_dir(), pkg.name, 'zaps']));

/**
 * The Zap service handles Zap creation, modification and deletion. It saves all the changes to the database.
 *
 * You need to call the `restore()` method after constructing it.
 *
 * It will emit the `zap-added`, `zap-removed` and `zap-updated` signals when a Zap is added, removed or updated. The signal parameter is the UUID of the Zap.
 *
 * It implements the `Gio.ListModel` interface.
 */
export class Zaps extends Service {

    #cancellable;
    /** @type {Zap[]} */
    #zaps = [];

    static {
        GObject.registerClass({
            GTypeName: 'ZapZapManager',
            Implements: [Gio.ListModel],
            Signals: {
                'zap-added': { param_types: [GObject.TYPE_STRING] },
                'zap-removed': { param_types: [GObject.TYPE_STRING] },
                'zap-updated': { param_types: [GObject.TYPE_STRING] },
            },
        }, this);
    }

    /** */
    constructor() {
        console.debug('Initializing Zaps service...');
        super();
        this.#cancellable = new Gio.Cancellable();
        console.debug('Zaps service initialized.');
    }

    /**
     * Get item virtual function.
     *
     * @param {number} position Item position.
     * @returns {?Zap} Item at the given position.
     */
    vfunc_get_item(position) {
        return this.#zaps[position] || null;
    }

    /**
     * Get item type virtual function.
     *
     * @returns {Zap.$gtype} Collection class.
     */
    vfunc_get_item_type() {
        return Zap;
    }

    /**
     * Get number of items virtual function.
     *
     * @returns {number} Number of items.
     */
    vfunc_get_n_items() {
        return this.#zaps.length;
    }

    /**
     * Start the service.
     */
    start() {
        console.debug('Starting Zaps service...');
        this.#createZapsDirectory();
        this.#restoreZaps();
        console.debug('Zaps service started.');
    }

    /**
     * Create the directory where Zaps will be copied.
     */
    #createZapsDirectory() {
        if (ZAPS_DIR.query_exists(this.#cancellable))
            return;
        console.debug('Creating Zaps directory...');
        ZAPS_DIR.make_directory_with_parents(this.#cancellable);
        console.debug('Zaps directory created.');
    }

    /**
     * Restore Zaps from the database.
     */
    #restoreZaps() {
        console.debug('Restoring Zaps...');
        const cursor = globalThis.database.query(
            `SELECT ?uuid ?name ?collectionUuid ?uri ?color ?loop ?volume ?position ?groupName {
                ?zap a zap:Zap;
                    zap:uuid ?uuid;
                    zap:name ?name;
                    zap:collectionUuid ?collectionUuid;
                    zap:uri ?uri;
                    zap:color ?color;
                    zap:loop ?loop;
                    zap:volume ?volume;
                    zap:position ?position.
                OPTIONAL { ?zap zap:groupName ?groupName }
            }`
        );
        while (cursor.next(this.#cancellable)) {
            const data = {};
            for (let i = 0; i < cursor.nColumns; i++) {
                switch (cursor.get_variable_name(i)) {
                    case 'uuid':
                        [data.uuid] = cursor.get_string(i);
                        break;
                    case 'name':
                        [data.name] = cursor.get_string(i);
                        break;
                    case 'collectionUuid':
                        [data.collectionUuid] = cursor.get_string(i);
                        break;
                    case 'uri':
                        data.file = Gio.File.new_for_uri(cursor.get_string(i)[0]);
                        break;
                    case 'color':
                        data.color = Color.fromId(cursor.get_string(i)[0]);
                        break;
                    case 'loop':
                        data.loop = cursor.get_boolean(i);
                        break;
                    case 'volume':
                        data.volume = cursor.get_double(i);
                        break;
                    case 'position':
                        data.position = cursor.get_integer(i);
                        break;
                    case 'groupName':
                        [data.groupName] = cursor.get_string(i);
                        break;
                    default:
                }
            }
            this.#zaps.push(new Zap(data));
        }
        this.emit('items-changed', 0, 0, this.#zaps.length);
        console.debug(`${this.#zaps.length} Zaps restored.`);
    }

    /**
     * Exit the service.
     */
    exit() {
        console.debug('Exiting Zaps service...');
        this.#cancellable.cancel();
        console.debug('Zaps service exited.');
    }

    /**
     * Find a Zap with its UUID.
     *
     * @param {object} params Parameter object.
     * @param {string} params.uuid Desired UUID.
     * @returns {Zap} The found Zap.
     * @throws Throws an error if no Zap has the given UUID.
     */
    find({ uuid }) {
        const zap = this.#zaps.find(element => element.uuid === uuid);
        if (zap === undefined)
            throw new Error(`No Zap with UUID "${uuid}" found.`);
        return zap;
    }

    /**
     * Add a Zap.
     *
     * @param {object} params Parameter object.
     * @param {string} params.name Name of the Zap.
     * @param {Collection} params.collection Collection the Zap belongs to.
     * @param {string} params.uri URI of the audio file the Zap will play.
     * @param {Color} params.color Color of the Zap.
     * @param {boolean} params.loop If the Zap is looping.
     * @param {number} params.volume Volume of the Zap, between 0 and 1.
     * @param {string} params.groupName Group name.
     * @returns {Zap} The newly added Zap.
     * @throws Throws an error if the file doesn't exist.
     */
    add({ name, collection, uri, color = Color.GRAY, loop = false, volume = 1, groupName = '' }) {
        console.debug(`Adding new "${name}" Zap...`);
        const originalFile = Gio.File.new_for_uri(uri);
        if (!originalFile.query_exists(this.#cancellable))
            throw new Error(`File '${uri}' does not exist.`);
        const uuid = GLib.uuid_string_random();
        const originalFileName = originalFile.get_basename();
        const extension = originalFileName.substring(originalFileName.lastIndexOf('.') + 1, originalFileName.length) || originalFileName;
        const file = ZAPS_DIR.get_child(`${uuid}.${extension}`);
        originalFile.copy(file, Gio.FileCopyFlags.NONE, this.#cancellable, null);

        const zap = new Zap({
            uuid,
            name,
            collectionUuid: collection.uuid,
            file,
            color,
            loop,
            volume,
            position: this.#getTotalInCollection(collection.uuid),
            groupName,
        });

        const resource = Tracker.Resource.new(null);
        resource.set_uri('rdf:type', 'zap:Zap');
        resource.set_string('zap:uuid', zap.uuid);
        resource.set_string('zap:name', zap.name);
        resource.set_string('zap:collectionUuid', zap.collectionUuid);
        resource.set_string('zap:uri', zap.file.get_uri());
        resource.set_string('zap:color', zap.color.id);
        resource.set_boolean('zap:loop', zap.loop);
        resource.set_double('zap:volume', zap.volume);
        resource.set_int('zap:position', zap.position);
        resource.set_string('zap:groupName', zap.groupName);
        globalThis.database.batch([resource]);

        this.#zaps.push(zap);

        this.emit('items-changed', this.#zaps.length - 1, 0, 1);
        this.emit('zap-added', zap.uuid);

        console.debug(`Zap "${name}" added.`);

        return zap;
    }

    /**
     * Remove a Zap.
     *
     * @param {object} params Parameter object.
     * @param {Zap} params.zap Zap.
     */
    remove({ zap }) {
        console.debug(`Removing Zap "${zap.name}"...`);

        globalThis.database.update(
            `DELETE {
                ?zap a rdfs:Resource
            } WHERE {
                ?zap a zap:Zap;
                    zap:uuid ?uuid.
                FILTER (?uuid = "${Tracker.sparql_escape_string(zap.uuid)}")
            }`
        );

        zap.file.delete(this.#cancellable);

        const index = this.#zaps.findIndex(element => element === zap);
        this.#zaps.splice(index, 1);

        this.emit('items-changed', index, 1, 0);
        this.emit('zap-removed', zap.uuid);

        console.debug(`Zap "${zap.name}" removed.`);
    }

    /**
     * Remove all the Zaps in the given collection.
     *
     * @param {object} params Parameter object.
     * @param {Collection} params.collection Collection.
     */
    removeAllOfCollection({ collection }) {
        this.#zaps.filter(zap => zap.collectionUuid === collection.uuid).forEach(zap => this.remove({ zap }));
    }

    /**
     * Rename a Zap.
     *
     * @param {object} params Parameter object.
     * @param {Zap} params.zap Zap.
     * @param {string} params.name New name.
     */
    rename({ zap, name }) {
        if (zap.name === name)
            return;
        const oldName = zap.name;
        console.debug(`Renaming Zap "${oldName}" to "${name}"...`);
        this.#updateProperty(zap, 'name', Tracker.sparql_escape_string(name));
        console.debug(`Zap "${oldName}" renamed to "${name}".`);
    }

    /**
     * Change the collection a Zap belongs to.
     *
     * @param {object} params Parameter object.
     * @param {Zap} params.zap Zap.
     * @param {string} params.collectionUuid UUID of the new collection.
     */
    changeCollection({ zap, collectionUuid }) {
        if (zap.collectionUuid === collectionUuid)
            return;
        console.debug(`Moving Zap "${zap.name}" to collection "${collectionUuid}"...`);
        const oldCollectionUuid = zap.collectionUuid;
        this.#updateProperty(zap, 'collectionUuid', Tracker.sparql_escape_string(collectionUuid));
        this.#updateProperty(zap, 'position', this.#getTotalInCollection(zap.collectionUuid));
        this.#ensurePositionsInCollection(oldCollectionUuid);
        console.debug(`Zap "${zap.name}" moved to collection "${collectionUuid}".`);
    }

    /**
     * Change the color of a Zap.
     *
     * @param {object} params Parameter object.
     * @param {Zap} params.zap Zap.
     * @param {Color} params.color New color.
     */
    changeColor({ zap, color }) {
        if (zap.color === color)
            return;
        console.debug(`Changing Zap "${zap.name}" color to ${color.name}...`);

        globalThis.database.update(
            `DELETE {
                ?zap zap:color ?color
            } INSERT {
                ?zap zap:color "${color.id}"
            } WHERE {
                ?zap a zap:Zap;
                    zap:uuid ?uuid;
                    zap:color ?color.
                FILTER (?uuid = "${Tracker.sparql_escape_string(zap.uuid)}")
            }`
        );

        zap.color = color;

        const index = this.#zaps.findIndex(element => element === zap);
        this.emit('items-changed', index, 1, 1);
        this.emit('zap-updated', zap.uuid);

        console.debug(`Zap "${zap.name}" color changed to ${color.name}.`);
    }

    /**
     * Change if the Zap is looping or not.
     *
     * @param {object} params Parameter object.
     * @param {Zap} params.zap Zap.
     * @param {boolean} params.loop If the Zap will loop.
     */
    loop({ zap, loop }) {
        if (zap.loop === loop)
            return;
        console.debug(loop ? `Start looping Zap "${zap.name}"...` : `Stop looping Zap "${zap.name}"...`);
        this.#updateProperty(zap, 'loop', loop);
        console.debug(loop ? `Started looping Zap "${zap.name}".` : `Stopped looping Zap "${zap.name}".`);
    }

    /**
     * Change the volume of a Zap.
     *
     * @param {object} params Parameter object.
     * @param {Zap} params.zap UUID of the Zap.
     * @param {number} params.volume New volume, between 0 and 1.
     */
    changeVolume({ zap, volume }) {
        if (zap.volume === volume)
            return;
        console.debug(`Changing Zap "${zap.name}" volume to ${volume}...`);
        this.#updateProperty(zap, 'volume', volume);
        console.debug(`Zap "${zap.name}" volume changed to ${volume}.`);
    }

    /**
     * Change the position of a Zap in its collection.
     *
     * @param {object} params Parameter object.
     * @param {Zap} params.zap Zap.
     * @param {number} params.position New position, an unsigned integer.
     */
    changePosition({ zap, position }) {
        if (zap.position === position)
            return;
        console.debug(`Moving Zap "${zap.name}" to position ${position}...`);

        let desiredPosition = position;
        if (desiredPosition < 0)
            desiredPosition = 0;
        const totalInCollection = this.#getTotalInCollection(zap.collectionUuid);
        if (desiredPosition > totalInCollection)
            desiredPosition = totalInCollection - 1;

        const oldPosition = zap.position;
        const diff = oldPosition - desiredPosition;
        this.#zaps.filter(z => z.collectionUuid === zap.collectionUuid).forEach(z => {
            if (z === zap) {
                this.#updateProperty(zap, 'position', desiredPosition);
                return;
            }
            if (diff < 0 && (z.position < oldPosition || z.position > desiredPosition))
                return;
            if (diff > 0 && (z.position < desiredPosition || z.position > oldPosition))
                return;
            this.#updateProperty(z, 'position', z.position + Math.sign(diff));
        });
        console.debug(`Moved Zap "${zap.name}" to position ${position}.`);
    }

    /**
     * Change the group of a Zap.
     *
     * @param {object} params Parameter object.
     * @param {Zap} params.zap Zap.
     * @param {string} params.groupName New group name.
     */
    changeGroupName({ zap, groupName }) {
        if (zap.groupName === groupName)
            return;
        console.debug(`Changing Zap "${zap.name}" group to "${groupName}"...`);
        this.#updateProperty(zap, 'groupName', Tracker.sparql_escape_string(groupName));
        console.debug(`Zap "${zap.name}" group changed to "${groupName}".`);
    }

    /**
     * Convenience method to update the property of a Zap.
     *
     * @param {Zap} zap Zap.
     * @param {string} property Name of the property.
     * @param {*} value New value.
     * @throws Throws an error if no Zap has the given UUID.
     */
    #updateProperty(zap, property, value) {
        globalThis.database.update(
            `DELETE {
                ?zap zap:${property} ?${property}
            } INSERT {
                ?zap zap:${property} "${value}"
            } WHERE {
                ?zap a zap:Zap;
                    zap:uuid ?uuid;
                    zap:${property} ?${property}.
                FILTER (?uuid = "${Tracker.sparql_escape_string(zap.uuid)}")
            }`
        );

        zap[property] = value;

        const index = this.#zaps.findIndex(element => element === zap);
        this.emit('items-changed', index, 1, 1);
        this.emit('zap-updated', zap.uuid);
    }

    /**
     * Get the total number of Zaps in a collection.
     *
     * @param {string} uuid UUID of the collection.
     * @returns {number} Total number.
     */
    #getTotalInCollection(uuid) {
        return this.#zaps.filter(zap => zap.collectionUuid === uuid).length;
    }

    /**
     * Ensure that all positions in the given collection are consecutive.
     *
     * @param {string} uuid UUID of the collection.
     */
    #ensurePositionsInCollection(uuid) {
        this.#zaps
            .filter(zap => zap.collectionUuid === uuid)
            .sort((a, b) => a.position - b.position)
            .forEach((zap, index) => {
                if (zap.position === index)
                    return;
                this.#updateProperty(zap, 'position', index);
            });
    }

}
