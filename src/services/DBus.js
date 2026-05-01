// SPDX-FileCopyrightText: 2022 Romain Vigier <contact AT romainvigier.fr>
//
// SPDX-License-Identifier: GPL-3.0-or-later

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';

import { Color } from '../enums/Color.js';

import { Service } from './Service.js';


/**
 * Implementation of the Collections service.
 */
class CollectionsService {

    #iface;

    /** */
    constructor() {
        this.#buildInterface();
        this.#connectToCollectionManager();
    }

    /**
     * Build the D-Bus interface.
     */
    #buildInterface() {
        let file = Gio.File.new_for_path(GLib.build_filenamev([pkg.datadir, 'dbus-1', 'interfaces', 'fr.romainvigier.zap.Collections.xml']));
        if (!file.query_exists(null)) {
            // Try source directory fallback for development
            file = Gio.File.new_for_path(GLib.build_filenamev([GLib.get_current_dir(), 'data', 'dbus', 'fr.romainvigier.zap.Collections.xml']));
        }
        const [ok, bytes] = file.load_contents(null);
        const ifaceXml = new TextDecoder().decode(bytes);
        this.#iface = Gio.DBusExportedObject.wrapJSObject(ifaceXml, this);
    }

    /**
     * Connect to the Collection Manager signals.
     */
    #connectToCollectionManager() {
        globalThis.collections.connect('collection-added', (manager, uuid) => this.emitCollectionAdded(uuid));
        globalThis.collections.connect('collection-removed', (manager, uuid) => this.emitCollectionRemoved(uuid));
        globalThis.collections.connect('collection-updated', (manager, uuid) => this.emitCollectionUpdated(uuid));
    }

    /**
     * Export the service to a connection.
     *
     * @param {Gio.DBusConnection} connection The D-Bus connection.
     */
    export(connection) {
        this.#iface.export(connection, '/fr/romainvigier/zap/Collections');
    }

    /**
     * Version property implementation.
     *
     * @returns {number} Interface version number.
     */
    get version() {
        return 2;
    }

    /**
     * GetCollections method implementation.
     *
     * @param {Array} params Parameters array.
     * @param {Gio.DBusMethodInvocation} invocation Method invocation.
     */
    GetCollectionsAsync([], invocation) { // eslint-disable-line no-empty-pattern
        const collections = [];
        for (let i = 0; i < globalThis.collections.get_n_items(); i++)
            collections.push(globalThis.collections.get_item(i).toVariant());
        invocation.return_value(new GLib.Variant('(aa{sv})', [collections]));
    }

    /**
     * GetCollection method implementation.
     *
     * @param {Array} params Parameters array.
     * @param {string} params.0 Collection UUID.
     * @param {Gio.DBusMethodInvocation} invocation Method invocation.
     */
    GetCollectionAsync([uuid], invocation) {
        try {
            const collection = globalThis.collections.find({ uuid });
            invocation.return_value(new GLib.Variant('(a{sv})', [collection.toVariant()]));
        } catch (e) {
            invocation.return_dbus_error(pkg.name, e.message);
        }
    }

    /**
     * AddCollection method implementation.
     *
     * @param {Array} params Parameters array.
     * @param {string} params.0 Collection name.
     * @param {Gio.DBusMethodInvocation} invocation Method invocation.
     */
    AddCollectionAsync([name], invocation) {
        try {
            const collection = globalThis.collections.add({ name });
            invocation.return_value(new GLib.Variant('(a{sv})', [collection.toVariant()]));
        } catch (e) {
            invocation.return_dbus_error(pkg.name, e.message);
        }
    }

    /**
     * RemoveCollection method implementation.
     *
     * @param {Array} params Parameters array.
     * @param {string} params.0 Collection UUID.
     * @param {Gio.DBusMethodInvocation} invocation Method invocation.
     */
    RemoveCollectionAsync([uuid], invocation) {
        try {
            const collection = globalThis.collections.find({ uuid });
            globalThis.collections.remove({ collection });
            invocation.return_value(null);
        } catch (e) {
            invocation.return_dbus_error(pkg.name, e.message);
        }
    }

    /**
     * @typedef {object} UpdateCollectionProperties
     * @property {GLib.Variant<string>} name New name.
     */
    /**
     * UpdateCollection method implementation.
     *
     * @param {Array} params Parameters array.
     * @param {string} params.0 Collection UUID.
     * @param {UpdateCollectionProperties} params.1 Properties object.
     * @param {Gio.DBusMethodInvocation} invocation Method invocation.
     */
    UpdateCollectionAsync([uuid, { name }], invocation) {
        try {
            const collection = globalThis.collections.find({ uuid });
            if (name)
                globalThis.collections.rename({ collection, name: name.unpack() });
            invocation.return_value(null);
        } catch (e) {
            invocation.return_dbus_error(pkg.name, e.message);
        }
    }

    /**
     * CollectionAdded signal implementation.
     *
     * @param {string} uuid Collection UUID.
     */
    emitCollectionAdded(uuid) {
        this.#iface.emit_signal('CollectionAdded', new GLib.Variant('(s)', [uuid]));
    }

    /**
     * CollectionRemoved signal implementation.
     *
     * @param {string} uuid Collection UUID.
     */
    emitCollectionRemoved(uuid) {
        this.#iface.emit_signal('CollectionRemoved', new GLib.Variant('(s)', [uuid]));
    }

    /**
     * CollectionUpdated signal implementation.
     *
     * @param {string} uuid Collection UUID.
     */
    emitCollectionUpdated(uuid) {
        this.#iface.emit_signal('CollectionUpdated', new GLib.Variant('(s)', [uuid]));
    }

}


/**
 * Implementation of the Zap service.
 */
class ZapService {

    #iface;

    /** */
    constructor() {
        let file = Gio.File.new_for_path(GLib.build_filenamev([pkg.datadir, 'dbus-1', 'interfaces', 'fr.romainvigier.zap.Zaps.xml']));
        if (!file.query_exists(null)) {
            // Try source directory fallback for development
            file = Gio.File.new_for_path(GLib.build_filenamev([GLib.get_current_dir(), 'data', 'dbus', 'fr.romainvigier.zap.Zaps.xml']));
        }
        const [ok, bytes] = file.load_contents(null);
        const ifaceXml = new TextDecoder().decode(bytes);
        this.#iface = Gio.DBusExportedObject.wrapJSObject(ifaceXml, this);
    }

    /**
     * Export the service to a connection.
     *
     * @param {Gio.DBusConnection} connection The D-Bus connection.
     */
    export(connection) {
        this.#iface.export(connection, '/fr/romainvigier/zap/Zaps');
    }

    /**
     * Version property implementation.
     *
     * @returns {number} Interface version number.
     */
    get version() {
        return 2;
    }

    /**
     * GetZaps method implementation.
     *
     * @param {Array} params Parameters array.
     * @param {Gio.DBusMethodInvocation} invocation Method invocation.
     */
    GetZapsAsync([], invocation) { // eslint-disable-line no-empty-pattern
        const zaps = [];
        for (let i = 0; i < globalThis.zaps.get_n_items(); i++)
            zaps.push(globalThis.zaps.get_item(i).toVariant());
        invocation.return_value(new GLib.Variant('(aa{sv})', [zaps]));
    }

    /**
     * GetZap method implementation.
     *
     * @param {Array} params Parameters array.
     * @param {string} params.0 Zap UUID.
     * @param {Gio.DBusMethodInvocation} invocation Method invocation.
     */
    GetZapAsync([uuid], invocation) {
        try {
            const zap = globalThis.zaps.find({ uuid });
            invocation.return_value(new GLib.Variant('(a{sv})', [zap.toVariant()]));
        } catch (e) {
            invocation.return_dbus_error(pkg.name, e.message);
        }
    }

    /**
     * @typedef {object} AddZapOptions
     * @property {GLib.Variant<string>} color Color.
     * @property {GLib.Variant<boolean>} loop Loop.
     * @property {GLib.Variant<number>} volume Volume.
     */
    /**
     * AddZap method implementation.
     *
     * @param {Array} params Parameters array.
     * @param {string} params.0 Zap UUID.
     * @param {string} params.1 Collection UUID.
     * @param {string} params.2 Audio file URI.
     * @param {AddZapOptions} params.3 Options object.
     * @param {Gio.DBusMethodInvocation} invocation Method invocation.
     */
    AddZapAsync([name, collectionUuid, uri, { color: colorVariant, loop: loopVariant, volume: volumeVariant }], invocation) {
        try {
            const collection = globalThis.collections.find({ uuid: collectionUuid });
            const color = Color.fromId(colorVariant ? colorVariant.unpack() : undefined);
            const loop = loopVariant ? loopVariant.unpack() : undefined;
            const volume = volumeVariant ? volumeVariant.unpack() : undefined;
            const zap = globalThis.zaps.add({ name, collection, uri, color, loop, volume });
            invocation.return_value(new GLib.Variant('(a{sv})', [zap.toVariant()]));
        } catch (e) {
            invocation.return_dbus_error(pkg.name, e.message);
        }
    }

    /**
     * RemoveZap method implementation.
     *
     * @param {Array} params Parameters array.
     * @param {string} params.0 Zap UUID.
     * @param {Gio.DBusMethodInvocation} invocation Method invocation.
     */
    RemoveZapAsync([uuid], invocation) {
        try {
            const zap = globalThis.zaps.find({ uuid });
            globalThis.zaps.remove({ zap });
            invocation.return_value(null);
        } catch (e) {
            invocation.return_dbus_error(pkg.name, e.message);
        }
    }

    /**
     * @typedef {object} UpdateZapProperties
     * @property {GLib.Variant<string>} name New name.
     * @property {GLib.Variant<string>} collectionUuid New collection UUID.
     * @property {GLib.Variant<string>} color New color.
     * @property {GLib.Variant<boolean>} loop New loop state.
     * @property {GLib.Variant<number>} volume New volume.
     * @property {GLib.Variant<number>} position New position.
     */
    /**
     * UpdateZap method implementation.
     *
     * @param {Array} params Parameters array.
     * @param {string} params.0 Zap UUID.
     * @param {UpdateZapProperties} params.1 Properties object.
     * @param {Gio.DBusMethodInvocation} invocation Method invocation.
     */
    UpdateZapAsync([uuid, { name, collectionUuid, color, loop, volume, position }], invocation) {
        try {
            const zap = globalThis.zaps.find({ uuid });
            if (name)
                globalThis.zaps.rename({ zap, name: name.unpack() });
            if (collectionUuid)
                globalThis.zaps.changeCollection({ zap, collection: globalThis.collections.find({ uuid: collectionUuid.unpack() }) });
            if (color)
                globalThis.zaps.changeColor({ zap, color: Color.fromId(color.unpack()) });
            if (loop)
                globalThis.zaps.loop({ zap, loop: loop.unpack() });
            if (volume)
                globalThis.zaps.changeVolume({ zap, volume: volume.unpack() });
            if (position)
                globalThis.zaps.changePosition({ zap, position: position.unpack() });
            invocation.return_value(null);
        } catch (e) {
            invocation.return_dbus_error(pkg.name, e.message);
        }
    }

    /**
     * PlayZap method implementation.
     *
     * @param {Array} params Parameters array.
     * @param {string} params.0 Zap UUID.
     * @param {Gio.DBusMethodInvocation} invocation Method invocation.
     */
    PlayZapAsync([uuid], invocation) {
        try {
            const zap = globalThis.zaps.find({ uuid });
            globalThis.player.play(zap);
            invocation.return_value(null);
        } catch (e) {
            invocation.return_dbus_error(pkg.name, e.message);
        }
    }

    /**
     * Stop method implementation.
     *
     * @param {Array} params Parameters array.
     * @param {Gio.DBusMethodInvocation} invocation Method invocation.
     */
    StopAsync([], invocation) { // eslint-disable-line no-empty-pattern
        globalThis.player.stop();
        invocation.return_value(null);
    }

    /**
     * FadeOut method implementation.
     *
     * @param {Array} params Parameters array.
     * @param {length} params.0 Length of the fade out.
     * @param {Gio.DBusMethodInvocation} invocation Method invocation.
     */
    FadeOutAsync([length], invocation) {
        globalThis.player.fadeOut(length);
        invocation.return_value(null);
    }

    /**
     * ZapAdded signal implementation.
     *
     * @param {string} uuid Zap UUID.
     */
    emitZapAdded(uuid) {
        this.#iface.emit_signal('ZapAdded', new GLib.Variant('(s)', [uuid]));
    }

    /**
     * ZapRemoved signal implementation.
     *
     * @param {string} uuid Zap UUID.
     */
    emitZapRemoved(uuid) {
        this.#iface.emit_signal('ZapRemoved', new GLib.Variant('(s)', [uuid]));
    }

    /**
     * ZapUpdated signal implementation.
     *
     * @param {string} uuid Zap UUID.
     */
    emitZapUpdated(uuid) {
        this.#iface.emit_signal('ZapUpdated', new GLib.Variant('(s)', [uuid]));
    }

}


/**
 * A service responsible for owning the D-Bus name and starting the D-Bus services.
 */
export class DBus extends Service {

    /** @type {number} */
    #ownerId;
    #collectionsService;
    #zapsService;

    static {
        GObject.registerClass({ GTypeName: 'ZapDBus' }, this);
    }

    /** */
    constructor() {
        super();
        this.#collectionsService = new CollectionsService();
        this.#zapsService = new ZapService();
    }

    /**
     * Start the service.
     */
    start() {
        this.#ownerId = Gio.bus_own_name(
            Gio.BusType.SESSION,
            'fr.romainvigier.zap',
            Gio.BusNameOwnerFlags.NONE,
            this.#onBusAcquired.bind(this),
            null,
            null
        );
    }

    /**
     * Exit the service.
     */
    exit() {
        Gio.bus_unown_name(this.#ownerId);
    }

    /**
     * Callback when the bus is acquired.
     *
     * @param {Gio.DBusConnection} connection D-Bus connection.
     * @param {string} name Owned name.
     */
    #onBusAcquired(connection, name) {
        this.#collectionsService.export(connection);
        this.#zapsService.export(connection);
    }

}
