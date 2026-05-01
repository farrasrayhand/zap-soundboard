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
            `SELECT ?uuid ?name ?collectionUuid ?position {
                ?group a zap:Group;
                    zap:uuid ?uuid;
                    zap:name ?name;
                    zap:groupCollectionUuid ?collectionUuid;
                    zap:groupPosition ?position.
            }`
        );
        while (groupCursor.next(this.#cancellable)) {
            const data = {};
            for (let i = 0; i < groupCursor.nColumns; i++) {
                const value = groupCursor.get_string(i);
                switch (groupCursor.get_variable_name(i)) {
                    case 'uuid': data.uuid = value ? value[0] : ''; break;
                    case 'name': data.name = value ? value[0] : ''; break;
                    case 'collectionUuid': data.collectionUuid = value ? value[0] : ''; break;
                    case 'position': data.position = groupCursor.get_integer(i); break;
                }
            }
            this.#groups.push(new Group(data));
        }

        // Zaps
        const cursor = globalThis.database.query(
            `SELECT ?uuid ?name ?collectionUuid ?uri ?color ?loop ?volume ?position ?groupName ?hotkey {
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
                OPTIONAL { ?zap zap:hotkey ?hotkey }
            }`
        );
        while (cursor.next(this.#cancellable)) {
            const data = {};
            for (let i = 0; i < cursor.nColumns; i++) {
                const value = cursor.get_string(i);
                switch (cursor.get_variable_name(i)) {
                    case 'uuid': data.uuid = value ? value[0] : ''; break;
                    case 'name': data.name = value ? value[0] : ''; break;
                    case 'collectionUuid': data.collectionUuid = value ? value[0] : ''; break;
                    case 'uri': data.file = value ? Gio.File.new_for_uri(value[0]) : null; break;
                    case 'color': data.color = value ? Color.fromId(value[0]) : Color.GRAY; break;
                    case 'loop': data.loop = cursor.get_boolean(i); break;
                    case 'volume': data.volume = cursor.get_double(i); break;
                    case 'position': data.position = cursor.get_integer(i); break;
                    case 'groupName': data.groupName = value ? value[0] : ''; break;
                    case 'hotkey': data.hotkey = value ? value[0] : ''; break;
                }
            }
            this.#zaps.push(new Zap(data));
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

    addGroup({ name, collectionUuid }) {
        console.debug(`Adding new group "${name}"...`);
        const uuid = GLib.uuid_string_random();
        const position = this.#groups.filter(g => g.collectionUuid === collectionUuid).length;
        
        const group = new Group({ uuid, name, collectionUuid, position });
        
        const resource = Tracker.Resource.new(null);
        resource.set_uri('rdf:type', 'zap:Group');
        resource.set_string('zap:uuid', uuid);
        resource.set_string('zap:name', name);
        resource.set_string('zap:groupCollectionUuid', collectionUuid);
        resource.set_int('zap:groupPosition', position);
        globalThis.database.batch([resource]);
        
        this.#groups.push(group);
        this.emit('groups-changed');
        return group;
    }

    removeGroup({ group }) {
        globalThis.database.update(
            `DELETE { ?g a rdfs:Resource } WHERE { ?g a zap:Group; zap:uuid "${group.uuid}" }`
        );
        // Also clear groupName for all zaps in this group
        this.#zaps.filter(z => z.groupName === group.name && z.collectionUuid === group.collectionUuid).forEach(z => {
            this.changeGroupName({ zap: z, groupName: '' });
        });
        
        const index = this.#groups.indexOf(group);
        this.#groups.splice(index, 1);
        this.emit('groups-changed');
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

    add({ name, collection, uri, color = Color.GRAY, loop = false, volume = 1, groupName = '', hotkey = '' }) {
        const originalFile = Gio.File.new_for_uri(uri);
        if (!originalFile.query_exists(this.#cancellable))
            throw new Error(`File '${uri}' does not exist.`);
        const uuid = GLib.uuid_string_random();
        const originalFileName = originalFile.get_basename();
        const extension = originalFileName.substring(originalFileName.lastIndexOf('.') + 1) || originalFileName;
        const file = ZAPS_DIR.get_child(`${uuid}.${extension}`);
        originalFile.copy(file, Gio.FileCopyFlags.NONE, this.#cancellable, null);

        const zap = new Zap({
            uuid, name, collectionUuid: collection.uuid, file, color, loop, volume,
            position: this.#getTotalInCollection(collection.uuid),
            groupName,
            hotkey,
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
        resource.set_string('zap:hotkey', zap.hotkey);
        globalThis.database.batch([resource]);

        this.#zaps.push(zap);
        this.emit('items-changed', this.#zaps.length - 1, 0, 1);
        this.emit('zap-added', zap.uuid);
        return zap;
    }

    remove({ zap }) {
        globalThis.database.update(`DELETE { ?z a rdfs:Resource } WHERE { ?z a zap:Zap; zap:uuid "${zap.uuid}" }`);
        zap.file.delete(this.#cancellable);
        const index = this.#zaps.indexOf(zap);
        this.#zaps.splice(index, 1);
        this.emit('items-changed', index, 1, 0);
        this.emit('zap-removed', zap.uuid);
    }

    removeAllOfCollection({ collection }) {
        this.#zaps.filter(z => z.collectionUuid === collection.uuid).forEach(z => this.remove({ zap: z }));
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
        this.#updateProperty(zap, 'color', color.id);
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
            `DELETE { ?zap zap:${property} ?v } INSERT { ?zap zap:${property} ${valStr} } 
             WHERE { ?zap a zap:Zap; zap:uuid "${zap.uuid}"; zap:${property} ?v }`
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
