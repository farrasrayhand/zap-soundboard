// SPDX-FileCopyrightText: 2022 Romain Vigier <contact AT romainvigier.fr>
//
// SPDX-License-Identifier: GPL-3.0-or-later

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Tracker from 'gi://Tracker';

import { Collection } from '../classes/Collection.js';
import { Group } from '../classes/Group.js';
import { Zap } from '../classes/Zap.js';

import { Color } from '../enums/Color.js';

import { Service } from './Service.js';


const ZAPS_DIR = Gio.File.new_for_path(GLib.build_filenamev([GLib.get_user_data_dir(), pkg.name, 'zaps']));

/**
 * The Zap service handles Zap and Group creation, modification and deletion.
 */
export class Zaps extends Service {

    #cancellable;
    /** @type {Zap[]} */
    #zaps = [];
    /** @type {Group[]} */
    #groups = [];

    static {
        GObject.registerClass({
            GTypeName: 'ZapZapManager',
            Implements: [Gio.ListModel],
            Signals: {
                'zap-added': { param_types: [GObject.TYPE_STRING] },
                'zap-removed': { param_types: [GObject.TYPE_STRING] },
                'zap-updated': { param_types: [GObject.TYPE_STRING, GObject.TYPE_STRING] },
                'groups-changed': { param_types: [] },
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

    /** @returns {Group[]} */
    get groups() {
        return this.#groups;
    }

    vfunc_get_item(position) {
        return this.#zaps[position] || null;
    }

    vfunc_get_item_type() {
        return Zap;
    }

    vfunc_get_n_items() {
        return this.#zaps.length;
    }

    start() {
        console.debug('Starting Zaps service...');
        this.#createZapsDirectory();
        this.#restore();
        console.debug('Zaps service started.');
    }

    #createZapsDirectory() {
        if (ZAPS_DIR.query_exists(this.#cancellable))
            return;
        ZAPS_DIR.make_directory_with_parents(this.#cancellable);
    }

    #restore() {
        console.debug('Restoring Groups and Zaps...');
        
        // Groups
        const groupCursor = globalThis.database.query(
            `PREFIX zap: <https://zap.romainvigier.fr#>
             SELECT ?uuid ?name ?collectionUuid ?position {
                ?group a zap:Group;
                    zap:uuid ?uuid.
                OPTIONAL { ?group zap:name ?name }
                OPTIONAL { ?group zap:groupCollectionUuid ?collectionUuid }
                OPTIONAL { ?group zap:groupPosition ?position }
            }`
        );
        while (groupCursor.next(this.#cancellable)) {
            const data = {};
            for (let i = 0; i < groupCursor.nColumns; i++) {
                const value = groupCursor.get_string(i);
                const actualValue = Array.isArray(value) ? value[0] : value;

                switch (groupCursor.get_variable_name(i)) {
                    case 'uuid': data.uuid = actualValue || ''; break;
                    case 'name': data.name = actualValue || ''; break;
                    case 'collectionUuid': data.collectionUuid = actualValue || ''; break;
                    case 'position': data.position = groupCursor.get_integer(i); break;
                }
            }
            if (data.uuid && !this.#groups.find(g => g.uuid === data.uuid)) {
                this.#groups.push(new Group(data));
            }
        }

        // Zaps
        const cursor = globalThis.database.query(
            `PREFIX zap: <https://zap.romainvigier.fr#>
             SELECT ?uuid ?name ?collectionUuid ?uri ?color ?loop ?volume ?position ?groupName ?hotkey {
                ?zap a zap:Zap;
                    zap:uuid ?uuid.
                OPTIONAL { ?zap zap:name ?name }
                OPTIONAL { ?zap zap:collectionUuid ?collectionUuid }
                OPTIONAL { ?zap zap:uri ?uri }
                OPTIONAL { ?zap zap:color ?color }
                OPTIONAL { ?zap zap:loop ?loop }
                OPTIONAL { ?zap zap:volume ?volume }
                OPTIONAL { ?zap zap:position ?position }
                OPTIONAL { ?zap zap:groupName ?groupName }
                OPTIONAL { ?zap zap:hotkey ?hotkey }
            }`
        );
        while (cursor.next(this.#cancellable)) {
            const data = {};
            for (let i = 0; i < cursor.nColumns; i++) {
                const value = cursor.get_string(i);
                const actualValue = Array.isArray(value) ? value[0] : value;

                switch (cursor.get_variable_name(i)) {
                    case 'uuid': data.uuid = actualValue || ''; break;
                    case 'name': data.name = actualValue || ''; break;
                    case 'collectionUuid': data.collectionUuid = actualValue || ''; break;
                    case 'uri': data.file = actualValue ? Gio.File.new_for_uri(actualValue) : null; break;
                    case 'color': data.color = actualValue ? Color.fromId(actualValue) : Color.GRAY; break;
                    case 'loop': data.loop = cursor.get_boolean(i); break;
                    case 'volume': data.volume = cursor.get_double(i); break;
                    case 'position': data.position = cursor.get_integer(i); break;
                    case 'groupName': data.groupName = actualValue || ''; break;
                    case 'hotkey': data.hotkey = actualValue || ''; break;
                }
            }
            if (data.uuid && !this.#zaps.find(z => z.uuid === data.uuid)) {
                this.#zaps.push(new Zap(data));
            }
        }
        this.emit('items-changed', 0, 0, this.#zaps.length);
        this.emit('groups-changed');
    }

    exit() {
        this.#cancellable.cancel();
    }

    find({ uuid }) {
        const zap = this.#zaps.find(element => element.uuid === uuid);
        if (zap === undefined)
            throw new Error(`No Zap with UUID "${uuid}" found.`);
        return zap;
    }

    /**
     * Get unique group names for a collection.
     *
     * @param {string} collectionUuid Collection UUID.
     * @returns {string[]} Unique group names.
     */
    getGroupNames(collectionUuid) {
        const names = new Set();
        this.#groups.filter(g => g.collectionUuid === collectionUuid).forEach(g => names.add(g.name));
        return Array.from(names).sort();
    }

    addGroup({ name, collectionUuid, uuid = null, position = null }) {
        if (!collectionUuid) {
            console.warn('Cannot add group: collectionUuid is missing');
            return null;
        }

        const groupUuid = uuid || GLib.uuid_string_random();

        // Check for existing group in memory
        const existing = this.#groups.find(g => g.uuid === groupUuid);
        if (existing) {
            console.debug(`Group with UUID "${groupUuid}" already exists, updating.`);
            this.renameGroup({ group: existing, name });
            if (position !== null) this.#updateGroupProperty(existing, 'position', position);
            if (existing.collectionUuid !== collectionUuid) {
                this.#updateGroupProperty(existing, 'groupCollectionUuid', collectionUuid);
                existing.collectionUuid = collectionUuid;
            }
            return existing;
        }

        console.debug(`Adding new group "${name}" in collection "${collectionUuid}"...`);
        const groupPosition = position !== null ? position : this.#groups.filter(g => g.collectionUuid === collectionUuid).length;
        
        const group = new Group({ uuid: groupUuid, name, collectionUuid, position: groupPosition });
        
        const resource = Tracker.Resource.new(`zap:group:${groupUuid}`);
        resource.set_uri('rdf:type', 'zap:Group');
        resource.set_string('zap:uuid', groupUuid);
        resource.set_string('zap:name', name);
        resource.set_string('zap:groupCollectionUuid', collectionUuid);
        resource.set_int('zap:groupPosition', groupPosition);
        globalThis.database.batch([resource]);
        
        this.#groups.push(group);
        this.emit('groups-changed');
        return group;
    }

    removeGroup({ group }) {
        console.debug(`Removing group "${group.name}"...`);
        globalThis.database.update(
            `PREFIX zap: <https://zap.romainvigier.fr#>
             DELETE WHERE { ?g a zap:Group; zap:uuid "${Tracker.sparql_escape_string(group.uuid)}"; ?p ?o }`
        );
        // Also clear groupName for all zaps in this group
        this.#zaps.filter(z => z.groupName === group.name && z.collectionUuid === group.collectionUuid).forEach(z => {
            this.changeGroupName({ zap: z, groupName: '' });
        });

        const index = this.#groups.findIndex(element => element.uuid === group.uuid);
        if (index !== -1) {
            this.#groups.splice(index, 1);
            this.emit('groups-changed');
        }
    }
    renameGroup({ group, name }) {
        if (group.name === name) return;
        const oldName = group.name;
        
        globalThis.database.update(
            `DELETE { ?group zap:name ?v } INSERT { ?group zap:name "${Tracker.sparql_escape_string(name)}" } 
             WHERE { ?group a zap:Group; zap:uuid "${group.uuid}"; zap:name ?v }`
        );
        
        // Update all Zaps that belong to this group name
        this.#zaps.filter(z => z.groupName === oldName && z.collectionUuid === group.collectionUuid).forEach(z => {
            this.changeGroupName({ zap: z, groupName: name });
        });

        group.name = name;
        this.emit('groups-changed');
    }

    moveGroup({ group, position }) {
        const collectionGroups = this.#groups
            .filter(g => g.collectionUuid === group.collectionUuid)
            .sort((a, b) => a.position - b.position);
        
        const oldPosition = group.position;
        const newPosition = Math.max(0, Math.min(position, collectionGroups.length - 1));
        
        if (oldPosition === newPosition) return;

        const diff = oldPosition - newPosition;
        
        collectionGroups.forEach(g => {
            if (g === group) {
                this.#updateGroupProperty(group, 'position', newPosition);
                return;
            }
            if (diff < 0 && (g.position < oldPosition || g.position > newPosition)) return;
            if (diff > 0 && (g.position < newPosition || g.position > oldPosition)) return;
            this.#updateGroupProperty(g, 'position', g.position + Math.sign(diff));
        });
        
        this.emit('groups-changed');
    }

    #updateGroupProperty(group, property, value) {
        const valStr = typeof value === 'string' ? `"${value}"` : value;
        const sparqlProperty = property === 'position' ? 'groupPosition' : property;
        globalThis.database.update(
            `PREFIX zap: <https://zap.romainvigier.fr#>
             DELETE { ?group zap:${sparqlProperty} ?v } INSERT { ?group zap:${sparqlProperty} ${valStr} } 
             WHERE { 
                ?group a zap:Group; 
                    zap:uuid "${group.uuid}".
                OPTIONAL { ?group zap:${sparqlProperty} ?v }
             }`
        );
        group[property] = value;
    }

    add({ name, collection, uri, color = Color.GRAY, loop = false, volume = 1, groupName = '', hotkey = '', uuid = null, position = null }) {
        if (!collection || !collection.uuid) {
            console.error('Cannot add zap: collection or collection UUID is missing');
            return null;
        }

        const collectionUuid = collection.uuid;
        const zapUuid = uuid || GLib.uuid_string_random();

        // Ensure the group exists if groupName is provided
        if (groupName && !this.#groups.find(g => g.name === groupName && g.collectionUuid === collectionUuid)) {
            this.addGroup({ name: groupName, collectionUuid: collectionUuid });
        }

        // Check for existing zap in memory
        const existing = this.#zaps.find(z => z.uuid === zapUuid);
        if (existing) {
            console.debug(`Zap with UUID "${zapUuid}" already exists, updating properties.`);
            // Update properties if they differ
            this.rename({ zap: existing, name });
            this.changeCollection({ zap: existing, collectionUuid });
            this.changeColor({ zap: existing, color });
            this.loop({ zap: existing, loop });
            this.changeVolume({ zap: existing, volume });
            this.changeGroupName({ zap: existing, groupName });
            this.changeHotkey({ zap: existing, hotkey });
            return existing;
        }

        const originalFile = Gio.File.new_for_uri(uri);
        if (!originalFile.query_exists(this.#cancellable))
            throw new Error(`File '${uri}' does not exist.`);
        
        const originalFileName = originalFile.get_basename();
        const extension = originalFileName.substring(originalFileName.lastIndexOf('.') + 1) || originalFileName;
        const file = ZAPS_DIR.get_child(`${zapUuid}.${extension}`);
        
        try {
            originalFile.copy(file, Gio.FileCopyFlags.OVERWRITE, this.#cancellable, null);
        } catch (e) {
            console.warn(`Failed to copy sound file: ${e.message}`);
        }

        const zap = new Zap({
            uuid: zapUuid, name, collectionUuid: collectionUuid, file, color, loop, volume,
            position: position !== null ? position : this.#getTotalInCollection(collectionUuid),
            groupName,
            hotkey,
        });

        const resource = Tracker.Resource.new(`zap:zap:${zapUuid}`);
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
        resource.set_string('zap:hotkey', zap.hotkey);
        globalThis.database.batch([resource]);

        this.#zaps.push(zap);
        this.emit('items-changed', this.#zaps.length - 1, 0, 1);
        this.emit('zap-added', zap.uuid);

        return zap;
    }

    remove({ zap, deleteFile = true }) {
        console.debug(`Removing zap "${zap.name}"...`);

        // Delete from database
        globalThis.database.update(
            `PREFIX zap: <https://zap.romainvigier.fr#>
             DELETE WHERE { ?z a zap:Zap; zap:uuid "${Tracker.sparql_escape_string(zap.uuid)}"; ?p ?o }`
        );

        if (deleteFile) {
            try {
                zap.file.delete(this.#cancellable);
            } catch (e) {
                console.warn(`Could not delete sound file: ${e.message}`);
            }
        }

        const index = this.#zaps.findIndex(element => element.uuid === zap.uuid);
        if (index !== -1) {
            this.#zaps.splice(index, 1);
            this.emit('items-changed', index, 1, 0);
        }
        this.emit('zap-removed', zap.uuid);
    }

    removeAllOfCollection({ collection, deleteFiles = true }) {
        this.#zaps.filter(z => z.collectionUuid === collection.uuid).forEach(z => this.remove({ zap: z, deleteFile: deleteFiles }));
        this.#groups.filter(g => g.collectionUuid === collection.uuid).forEach(g => this.removeGroup({ group: g }));
    }

    rename({ zap, name }) {
        if (zap.name === name) return;
        this.#updateProperty(zap, 'name', Tracker.sparql_escape_string(name));
    }

    changeCollection({ zap, collectionUuid }) {
        if (zap.collectionUuid === collectionUuid) return;
        const oldCollectionUuid = zap.collectionUuid;
        this.#updateProperty(zap, 'collectionUuid', Tracker.sparql_escape_string(collectionUuid));
        this.#updateProperty(zap, 'position', this.#getTotalInCollection(zap.collectionUuid));
        this.#ensurePositionsInCollection(oldCollectionUuid);
    }

    changeColor({ zap, color }) {
        if (zap.color === color) return;
        
        globalThis.database.update(
            `PREFIX zap: <https://zap.romainvigier.fr#>
             DELETE { ?zap zap:color ?v } INSERT { ?zap zap:color "${color.id}" } 
             WHERE { ?zap a zap:Zap; zap:uuid "${zap.uuid}"; zap:color ?v }`
        );
        
        zap.color = color;
        const index = this.#zaps.indexOf(zap);
        this.emit('items-changed', index, 1, 1);
        this.emit('zap-updated', zap.uuid, 'color');
    }

    loop({ zap, loop }) {
        if (zap.loop === loop) return;
        this.#updateProperty(zap, 'loop', loop);
    }

    changeVolume({ zap, volume }) {
        if (zap.volume === volume) return;
        this.#updateProperty(zap, 'volume', volume);
    }

    changePosition({ zap, position }) {
        if (zap.position === position) return;
        let desiredPosition = Math.max(0, Math.min(position, this.#getTotalInCollection(zap.collectionUuid) - 1));
        const oldPosition = zap.position;
        const diff = oldPosition - desiredPosition;
        this.#zaps.filter(z => z.collectionUuid === zap.collectionUuid).forEach(z => {
            if (z === zap) {
                this.#updateProperty(zap, 'position', desiredPosition);
                return;
            }
            if (diff < 0 && (z.position < oldPosition || z.position > desiredPosition)) return;
            if (diff > 0 && (z.position < desiredPosition || z.position > oldPosition)) return;
            this.#updateProperty(z, 'position', z.position + Math.sign(diff));
        });
    }

    changeGroupName({ zap, groupName }) {
        if (zap.groupName === groupName) return;
        this.#updateProperty(zap, 'groupName', Tracker.sparql_escape_string(groupName));
    }

    changeHotkey({ zap, hotkey }) {
        if (zap.hotkey === hotkey) return;
        this.#updateProperty(zap, 'hotkey', Tracker.sparql_escape_string(hotkey));
    }

    #updateProperty(zap, property, value) {
        const valStr = typeof value === 'string' ? `"${value}"` : value;
        globalThis.database.update(
            `PREFIX zap: <https://zap.romainvigier.fr#>
             DELETE { ?zap zap:${property} ?v } INSERT { ?zap zap:${property} ${valStr} } 
             WHERE { 
                ?zap a zap:Zap; 
                    zap:uuid "${zap.uuid}".
                OPTIONAL { ?zap zap:${property} ?v }
             }`
        );
        zap[property] = value;
        const index = this.#zaps.indexOf(zap);
        this.emit('items-changed', index, 1, 1);
        this.emit('zap-updated', zap.uuid, property);
    }

    #getTotalInCollection(uuid) {
        return this.#zaps.filter(z => z.collectionUuid === uuid).length;
    }

    #ensurePositionsInCollection(uuid) {
        this.#zaps.filter(z => z.collectionUuid === uuid)
            .sort((a, b) => a.position - b.position)
            .forEach((zap, index) => {
                if (zap.position !== index) this.#updateProperty(zap, 'position', index);
            });
    }

}
