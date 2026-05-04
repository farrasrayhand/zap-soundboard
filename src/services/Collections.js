// SPDX-FileCopyrightText: 2022 Romain Vigier <contact AT romainvigier.fr>
//
// SPDX-License-Identifier: GPL-3.0-or-later

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Tracker from 'gi://Tracker';

import { Collection } from '../classes/Collection.js';

import { Color } from '../enums/Color.js';

import { Service } from './Service.js';


/**
 * The Collections service handles collection creation, modification and deletion. It saves all the changes to the database.
 *
 * You need to call the `restore()` method after constructing it.
 *
 * It will emit the `collection-added`, `collection-removed` and `collection-updated` signals when a collection is added, removed or updated. The signal parameter is the UUID of the collection.
 *
 * It implements the `Gio.ListModel` interface.
 */
export class Collections extends Service {

    #cancellable;
    /** @type {Collection[]} */
    #collections = [];

    static {
        GObject.registerClass({
            GTypeName: 'ZapCollections',
            Implements: [Gio.ListModel],
            Signals: {
                'collection-added': { param_types: [GObject.TYPE_STRING] },
                'collection-removed': { param_types: [GObject.TYPE_STRING] },
                'collection-updated': { param_types: [GObject.TYPE_STRING] },
            },
        }, this);
    }

    /** */
    constructor() {
        console.debug('Initializing Collections service...');
        super();
        this.#cancellable = new Gio.Cancellable();
        console.debug('Collections service initialized.');
    }

    /**
     * Get item virtual function.
     *
     * @param {number} position Item position.
     * @returns {?Collection} Item at the given position.
     */
    vfunc_get_item(position) {
        return this.#collections[position] || null;
    }

    /**
     * Get item type virtual function.
     *
     * @returns {Collection.$gtype} Collection class.
     */
    vfunc_get_item_type() {
        return Collection;
    }

    /**
     * Get number of items virtual function.
     *
     * @returns {number} Number of items.
     */
    vfunc_get_n_items() {
        return this.#collections.length;
    }

    /**
     * Start the service.
     */
    start() {
        console.debug('Starting Collections service...');
        this.#restoreCollections();
        this.#ensureOneCollectionExists();
        console.debug('Collections service started.');
    }

    /**
     * Restore collections from the database.
     */
    #restoreCollections() {
        console.debug('Restoring collections...');
        const cursor = globalThis.database.query(
            `PREFIX zap: <https://zap.romainvigier.fr#>
             SELECT ?uuid ?name {
                ?collection a zap:Collection;
                    zap:uuid ?uuid.
                OPTIONAL { ?collection zap:name ?name }
            }`
        );
        while (cursor.next(this.#cancellable)) {
            const data = {};
            for (let i = 0; i < cursor.nColumns; i++) {
                const value = cursor.get_string(i);
                const actualValue = Array.isArray(value) ? value[0] : value;

                switch (cursor.get_variable_name(i)) {
                    case 'uuid':
                        data.uuid = actualValue || '';
                        break;
                    case 'name':
                        data.name = actualValue || '';
                        break;
                    default:
                }
            }
            if (data.uuid && !this.#collections.find(c => c.uuid === data.uuid)) {
                this.#collections.push(new Collection(data));
            }
        }
        this.emit('items-changed', 0, 0, this.#collections.length);
        console.debug(`${this.#collections.length} collections restored.`);
    }

    /**
     * Exit the service.
     */
    exit() {
        console.debug('Exiting Collections service...');
        this.#cancellable.cancel();
        console.debug('Collections service exited.');
    }

    /**
     * Find a collection with its UUID.
     *
     * @param {object} params Parameter object.
     * @param {string} params.uuid Desired UUID.
     * @returns {Collection} The found collection.
     * @throws Throws an error if no collection has the given UUID.
     */
    find({ uuid }) {
        if (!uuid) return null;
        const collection = this.#collections.find(element => element.uuid === uuid);
        if (collection === undefined)
            throw new Error(`No collection with UUID "${uuid}" found.`);
        return collection;
    }

    /**
     * Add a collection.
     *
     * @param {object} params Parameter object.
     * @param {string} params.name Name of the collection.
     * @returns {Collection} The added collection.
     */
    add({ name, uuid = null }) {
        if (uuid) {
            const existing = this.#collections.find(c => c.uuid === uuid);
            if (existing) {
                console.debug(`Collection with UUID "${uuid}" already exists.`);
                if (existing.name !== name)
                    this.rename({ collection: existing, name });
                return existing;
            }
        }

        console.debug(`Adding new "${name}" collection...`);

        const collection = new Collection({
            uuid: uuid || GLib.uuid_string_random(),
            name,
        });

        const resource = Tracker.Resource.new(`zap:collection:${collection.uuid}`);
        resource.set_uri('rdf:type', 'zap:Collection');
        resource.set_string('zap:uuid', collection.uuid);
        resource.set_string('zap:name', collection.name);
        globalThis.database.batch([resource]);

        this.#collections.push(collection);

        this.emit('items-changed', this.#collections.length - 1, 0, 1);
        this.emit('collection-added', collection.uuid);

        console.debug(`Collection "${name}" added.`);

        return collection;
    }

    /**
     * Add the default collection.
     */
    addDefaultCollection() {
        console.debug('Adding default collection...');

        /* Translators: Default collection name. */
        const defaultName = _('Zaps');
        const collection = this.add({ name: defaultName });

        globalThis.zaps.add({
            // Translators: Name of a sample Zap
            name: _('Theme Song 8-bit'),
            collection,
            uri: 'resource:///fr/romainvigier/zap/sounds/theme-song-8bit-loop.ogg',
            color: Color.PURPLE,
            loop: true,
        });
        globalThis.zaps.add({
            // Translators: Name of a sample Zap
            name: _('Applause'),
            collection,
            uri: 'resource:///fr/romainvigier/zap/sounds/applause.ogg',
            color: Color.GREEN,
        });
        globalThis.zaps.add({
            // Translators: Name of a sample Zap
            name: _('Bark'),
            collection,
            uri: 'resource:///fr/romainvigier/zap/sounds/bark.ogg',
            color: Color.BLUE,
        });
    }

    /**
     * Remove a collection.
     *
     * @param {object} params Parameter object.
     * @param {Collection} params.collection Collection.
     */
    remove({ collection }) {
        if (!collection) return;
        console.debug(`Removing collection "${collection.name}"...`);

        globalThis.zaps.removeAllOfCollection({ collection });

        globalThis.database.update(
            `PREFIX zap: <https://zap.romainvigier.fr#>
             DELETE WHERE { 
                ?collection a zap:Collection; 
                    zap:uuid "${Tracker.sparql_escape_string(collection.uuid)}";
                    ?p ?o.
             }`
        );

        const index = this.#collections.findIndex(element => element.uuid === collection.uuid);
        if (index !== -1) {
            this.#collections.splice(index, 1);
            this.emit('items-changed', index, 1, 0);
        }

        this.emit('collection-removed', collection.uuid);

        console.debug(`Collection "${collection.name}" removed.`);

        this.#ensureOneCollectionExists();
    }

    /**
     * Rename a collection.
     *
     * @param {object} params Parameter object.
     * @param {Collection} params.collection Collection.
     * @param {string} params.name New name.
     */
    rename({ collection, name }) {
        const oldName = collection.name;
        console.debug(`Renaming collection "${oldName}" to "${name}"...`);

        if (collection.name === name)
            return;

        globalThis.database.update(
            `PREFIX zap: <https://zap.romainvigier.fr#>
             DELETE { ?collection zap:name ?v } 
             INSERT { ?collection zap:name "${Tracker.sparql_escape_string(name)}" } 
             WHERE { 
                ?collection a zap:Collection; 
                    zap:uuid "${Tracker.sparql_escape_string(collection.uuid)}".
                OPTIONAL { ?collection zap:name ?v }
             }`
        );

        collection.name = name;

        const index = this.#collections.findIndex(element => element === collection);
        if (index !== -1)
            this.emit('items-changed', index, 1, 1);

        this.emit('collection-updated', collection.uuid);

        console.debug(`Collection "${oldName}" renamed to "${name}".`);
    }

    /**
     * Make sure there's a least one collection, creating a default one if necessary.
     */
    #ensureOneCollectionExists() {
        if (this.#collections.length === 0)
            this.addDefaultCollection();
    }

}
