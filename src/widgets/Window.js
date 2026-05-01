// SPDX-FileCopyrightText: 2022 Romain Vigier <contact AT romainvigier.fr>
//
// SPDX-License-Identifier: GPL-3.0-or-later

import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

import { Collection } from '../classes/Collection.js';
import { Zap } from '../classes/Zap.js';

import { AddZapPopup } from './AddZapPopup.js';
import { CollectionsMenuButton } from './CollectionsMenuButton.js';


/**
 * Main application window.
 */
export class Window extends Adw.ApplicationWindow {

    player;

    /** @type {Adw.AboutWindow} */
    #aboutWindow;
    /** @type {AddZapPopup} */
    #addZapPopup;
    /** @type {Gtk.Overlay} */
    #addZapPopupOverlay;
    /** @type {CollectionsMenuButton} */
    #collectionsButton;
    /** @type {Gtk.Stack} */
    #zapsStack;
    /** @type {Gtk.Box} */
    #zapsBox;

    static {
        GObject.registerClass({
            GTypeName: 'ZapWindow',
            Template: 'resource:///fr/romainvigier/zap/ui/Window.ui',
            Properties: {
                selectedCollection: GObject.ParamSpec.object('selected-collection', 'Selected collection', 'Selected collection', GObject.ParamFlags.READWRITE, Collection),
                collections: GObject.ParamSpec.object('collections', 'Collections', 'Collections', GObject.ParamFlags.READWRITE, Gio.ListModel),
                zaps: GObject.ParamSpec.object('zaps', 'Zaps', 'Zaps', GObject.ParamFlags.READWRITE, Gio.ListModel),
            },
            InternalChildren: ['aboutWindow', 'addZapPopup', 'addZapPopupOverlay', 'collectionsButton', 'zapsStack', 'zapsBox'],
        }, this);
    }

    /**
     * @param {object} params Parameter object.
     * @param {?Collection} params.selectedCollection Selected collection.
     * @param {?Gio.ListModel<Collection>} params.collections Collections.
     * @param {?Gio.ListModel<Zap>} params.zaps Zaps.
     */
    constructor({ selectedCollection = null, collections = null, zaps = null, ...params } = {}) {
        super(params);

        /**
         * Currently selected collection.
         *
         * @type {?Collection}
         */
        this.selectedCollection = selectedCollection;
        /** @type {?Gio.ListModel<Collection>} */
        this.collections = collections || globalThis.collections;
        /** @type {?Gio.ListModel<Zap>} */
        this.zaps = zaps || globalThis.zaps;

        this.#aboutWindow = this._aboutWindow;
        this.#addZapPopup = this._addZapPopup;
        this.#addZapPopupOverlay = this._addZapPopupOverlay;
        this.#collectionsButton = this._collectionsButton;
        this.#zapsStack = this._zapsStack;
        this.#zapsBox = this._zapsBox;

        this.#setupCollections();
        this.#setupActions();
        this.#restoreSettings();

        this.#addZapPopupOverlay.set_clip_overlay(this.#addZapPopup, false);
        this.#addZapPopupOverlay.set_measure_overlay(this.#addZapPopup, true);

        this.connect('notify::selected-collection', () => this.#refreshZaps());
        globalThis.zaps.connect('items-changed', () => this.#refreshZaps());
        globalThis.zaps.connect('zap-updated', () => this.#refreshZaps());

        this.#refreshZaps();

        if (globalThis.devel)
            this.add_css_class('devel');
    }

    /**
     * Refresh the Zaps display.
     */
    #refreshZaps() {
        if (!this.#zapsBox || !this.selectedCollection)
            return;

        // Clear current content
        let child = this.#zapsBox.get_first_child();
        while (child) {
            this.#zapsBox.remove(child);
            child = this.#zapsBox.get_first_child();
        }

        const filteredZaps = [];
        for (let i = 0; i < globalThis.zaps.get_n_items(); i++) {
            const zap = globalThis.zaps.get_item(i);
            if (zap.collectionUuid === this.selectedCollection.uuid)
                filteredZaps.push(zap);
        }

        filteredZaps.sort((a, b) => a.position - b.position);

        if (filteredZaps.length === 0) {
            this.#zapsStack.visibleChildName = 'no-zaps';
            return;
        }

        this.#zapsStack.visibleChildName = 'zaps';

        // Group Zaps
        const groups = new Map();
        filteredZaps.forEach(zap => {
            const groupName = zap.groupName || '';
            if (!groups.has(groupName))
                groups.set(groupName, []);
            groups.get(groupName).push(zap);
        });

        groups.forEach((groupZaps, groupName) => {
            // Add group separator
            const separator = new ZapGroupSeparator({ groupName });
            separator.margin_top = 12;
            separator.margin_bottom = 6;
            separator.margin_start = 12;
            separator.margin_end = 12;
            this.#zapsBox.append(separator);

            // Add grid for Zaps in this group
            const grid = new Gtk.FlowBox({
                selection_mode: Gtk.SelectionMode.NONE,
                max_children_per_line: 24,
                min_children_per_line: 1,
                row_spacing: 12,
                column_spacing: 12,
                margin_start: 12,
                margin_end: 12,
                margin_bottom: 12,
            });

            groupZaps.forEach(zap => {
                const item = new ZapItem({ zap });
                grid.append(item);
            });

            this.#zapsBox.append(grid);
        });
    }

    /**
     * Close request virtual method.
     */
    vfunc_close_request() {
        super.vfunc_close_request();
        this.#saveSettings();
        this.run_dispose();
    }

    /**
     * Setup collections.
     */
    #setupCollections() {
        globalThis.collections.connect('collection-removed', (collections, uuid) => {
            if (this.selectedCollection.uuid === uuid)
                this.selectedCollection = collections.get_item(0);
        });
        globalThis.collections.connect('collection-added', (collections, uuid) => {
            if (!this.selectedCollection)
                this.selectedCollection = collections.get_item(0);
        });
    }

    /**
     * Setup actions.
     */
    #setupActions() {
        [
            {
                name: 'about',
                parameterType: null,
                callback: (action, params) => {
                    this.#aboutWindow.present();
                },
            },
            {
                name: 'open-add-zap-popup',
                parameterType: null,
                callback: (action, params) => {
                    this.#addZapPopup.open();
                },
            },
            {
                name: 'open-collections-popover',
                parameterType: null,
                callback: (action, params) => {
                    this.#collectionsButton.popup();
                },
            },
            {
                name: 'export',
                parameterType: null,
                callback: () => {
                    this.#export();
                },
            },
            {
                name: 'import',
                parameterType: null,
                callback: () => {
                    this.#import();
                },
            },
        ].forEach(({ name, parameterType, callback }) => {
            const action = new Gio.SimpleAction({ name, parameterType });
            action.connect('activate', callback);
            this.add_action(action);
        });
    }

    /**
     * Restore settings.
     */
    #restoreSettings() {
        this.defaultWidth = globalThis.settings.get_uint('window-width');
        this.defaultHeight = globalThis.settings.get_uint('window-height');
        this.maximized = globalThis.settings.get_boolean('window-maximized');

        try {
            const lastSelectedCollectionUuid = globalThis.settings.get_string('last-selected-collection');
            this.selectedCollection = globalThis.collections.find({ uuid: lastSelectedCollectionUuid });
        } catch (e) {
            this.selectedCollection = globalThis.collections.get_item(0);
        }
    }

    /**
     * Save settings.
     */
    #saveSettings() {
        globalThis.settings.set_uint('window-width', this.defaultWidth);
        globalThis.settings.set_uint('window-height', this.defaultHeight);
        globalThis.settings.set_boolean('window-maximized', this.maximized);
        globalThis.settings.set_string('last-selected-collection', this.selectedCollection.uuid);
    }

    /**
     * Get the package version.
     *
     * @param {Window} window Window.
     * @returns {string} Package version.
     */
    getPackageVersion(window) {
        return pkg.version;
    }

    /**
     * Callback when items change in the Zaps model.
     *
     * @param {Gio.ListModel} model List model.
     */
    onZapsModelItemsChanged(model) {
        if (!this.#zapsStack)
            return;
        this.#zapsStack.visibleChildName = model.get_n_items() === 0 ? 'no-zaps' : 'zaps';
    }

    /**
     * Callback when the value of a drop changes.
     *
     * @param {Gtk.DropTarget} target Drop target.
     */
    onFileDropValueChanged(target) {
        if (!target.value)
            return;
        const file = target.value;
        if (!file.query_exists(null))
            target.reject();
        const [contentType] = Gio.content_type_guess(file.get_path(), null);
        if (!Gio.content_type_is_mime_type(contentType, 'audio/*'))
            target.reject();
    }

    /**
     * Callback when a file is dropped.
     *
     * @param {Gtk.DropTarget} target Drop target.
     * @param {Gio.File} file GFile.
     * @param {number} x X coordinate.
     * @param {number} y Y coordinate.
     * @returns {boolean} Whether the drop is handled.
     */
    onFileDropped(target, file, x, y) {
        this.#addZapPopup.populate({ file });
        this.#addZapPopup.open();
        return true;
    }

    /**
     * Export Zaps.
     */
    #export() {
        const dialog = new Gtk.FileChooserNative({
            title: _('Export Zaps'),
            action: Gtk.FileChooserAction.SAVE,
            accept_label: _('Export'),
            cancel_label: _('Cancel'),
            transient_for: this,
        });

        const filter = new Gtk.FileFilter();
        filter.set_name(_('Zap Archive (*.zap)'));
        filter.add_pattern('*.zap');
        dialog.add_filter(filter);

        dialog.set_current_name('zaps.zap');
        dialog.connect('response', async (d, response) => {
            if (response === Gtk.ResponseType.ACCEPT) {
                try {
                    await globalThis.config.export(d.get_file());
                } catch (e) {
                    this.#showError(_('Export failed'), e.message);
                }
            }
            d.destroy();
        });
        dialog.show();
    }

    /**
     * Import Zaps.
     */
    #import() {
        const dialog = new Gtk.FileChooserNative({
            title: _('Import Zaps'),
            action: Gtk.FileChooserAction.OPEN,
            accept_label: _('Import'),
            cancel_label: _('Cancel'),
            transient_for: this,
        });

        const filter = new Gtk.FileFilter();
        filter.set_name(_('Zap Archive (*.zap)'));
        filter.add_pattern('*.zap');
        dialog.add_filter(filter);

        dialog.connect('response', async (d, response) => {
            if (response === Gtk.ResponseType.ACCEPT) {
                try {
                    await globalThis.config.import(d.get_file());
                } catch (e) {
                    this.#showError(_('Import failed'), e.message);
                }
            }
            d.destroy();
        });
        dialog.show();
    }

    /**
     * Show an error dialog.
     *
     * @param {string} title Title.
     * @param {string} message Message.
     */
    #showError(title, message) {
        const dialog = new Adw.MessageDialog({
            heading: title,
            body: message,
            transient_for: this,
        });
        dialog.add_response('ok', _('OK'));
        dialog.present();
    }

}
