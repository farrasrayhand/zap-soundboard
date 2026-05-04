// SPDX-FileCopyrightText: 2022 Romain Vigier <contact AT romainvigier.fr>
//
// SPDX-License-Identifier: GPL-3.0-or-later

import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

import { Collection } from '../classes/Collection.js';
import { Zap } from '../classes/Zap.js';

import { AddZapPopup } from './AddZapPopup.js';
import { CollectionsMenuButton } from './CollectionsMenuButton.js';
import { PreferencesWindow } from './PreferencesWindow.js';
import { ZapGroupSeparator } from './ZapGroupSeparator.js';
import { ZapItem } from './ZapItem.js';


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

    /** @type {number[]} */
    #zapsConnections = [];
    /** @type {number[]} */
    #collectionsConnections = [];

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
        this.#aboutWindow.version = (typeof pkg !== 'undefined') ? pkg.version : '1.2.3';
        this.#addZapPopup = this._addZapPopup;
        this.#addZapPopupOverlay = this._addZapPopupOverlay;
        this.#collectionsButton = this._collectionsButton;
        this.#zapsStack = this._zapsStack;
        this.#zapsBox = this._zapsBox;

        this.#setupCollections();
        this.#setupActions();

        this.#addZapPopupOverlay.set_clip_overlay(this.#addZapPopup, false);
        this.#addZapPopupOverlay.set_measure_overlay(this.#addZapPopup, true);

        this.connect('notify::selected-collection', () => {
            this.#refreshZaps();
            if (this.selectedCollection)
                globalThis.settings.set_string('last-selected-collection', this.selectedCollection.uuid);
        });

        this.#restoreSettings();

        this.#zapsConnections.push(
            globalThis.zaps.connect('items-changed', () => this.#refreshZaps()),
            globalThis.zaps.connect('groups-changed', () => this.#refreshZaps()),
            globalThis.zaps.connect('zap-updated', (zaps, zap, property) => {
                if (['groupName', 'position', 'collectionUuid'].includes(property))
                    this.#refreshZaps();
            })
        );

        this.connect('destroy', () => {
            if (this.#refreshZapsId) {
                GLib.source_remove(this.#refreshZapsId);
                this.#refreshZapsId = 0;
            }
            this.#zapsConnections.forEach(id => globalThis.zaps.disconnect(id));
            this.#zapsConnections = [];
            this.#collectionsConnections.forEach(id => globalThis.collections.disconnect(id));
            this.#collectionsConnections = [];
        });

        this.#refreshZaps();
        this.#setupHotkeys();

        if (globalThis.devel)
            this.add_css_class('devel');
    }

    /**
     * Setup hotkeys.
     */
    #setupHotkeys() {
        const controller = new Gtk.EventControllerKey();
        controller.connect('key-pressed', (c, keyval, keycode, state) => {
            // Do not trigger if an entry is focused
            const focus = this.get_focus();
            if (focus instanceof Gtk.Editable)
                return false;

            const key = Gdk.keyval_name(keyval);
            if (!key)
                return false;

            // Global Hotkeys (Stop and Fade Out)
            const stopHotkey = globalThis.settings.get_string('stop-hotkey');
            const fadeoutHotkey = globalThis.settings.get_string('fadeout-hotkey');
            const hideStopButton = globalThis.settings.get_boolean('hide-stop-button');

            if (key === stopHotkey && !hideStopButton) {
                globalThis.player.stop();
                return true;
            }

            if (key === fadeoutHotkey) {
                globalThis.player.fadeOut();
                return true;
            }

            // Search for a Zap with this hotkey in the current collection
            for (let i = 0; i < globalThis.zaps.get_n_items(); i++) {
                const zap = globalThis.zaps.get_item(i);
                if (zap.collectionUuid === this.selectedCollection.uuid && zap.hotkey === key) {
                    if (zap.file.query_exists(null)) {
                        globalThis.player.play(zap);
                        return true;
                    }
                }
            }
            return false;
        });
        this.add_controller(controller);
    }

    /**
     * Refresh the Zaps display.
     */
    /** @type {number} */
    #refreshZapsId = 0;

    /**
     * Refresh the Zaps layout.
     */
    #refreshZaps() {
        if (this.#refreshZapsId)
            return;

        this.#refreshZapsId = GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            this.#doRefreshZaps();
            this.#refreshZapsId = 0;
            return GLib.SOURCE_REMOVE;
        });
    }

    /**
     * Refresh the Zaps layout (internal).
     */
    #doRefreshZaps() {
        if (!this.#zapsBox || !this.#zapsStack)
            return;

        if (!this.selectedCollection) {
            this.#zapsStack.visible_child_name = 'no-zaps';
            return;
        }

        const collectionUuid = this.selectedCollection.uuid;

        try {
            // Clear current content
            let child = this.#zapsBox.get_first_child();
            while (child) {
                this.#zapsBox.remove(child);
                child = this.#zapsBox.get_first_child();
            }

            const filteredZaps = [];
            const nItems = globalThis.zaps.get_n_items();
            for (let i = 0; i < nItems; i++) {
                const zap = globalThis.zaps.get_item(i);
                if (zap && zap.collectionUuid === collectionUuid)
                    filteredZaps.push(zap);
            }

            const groups = globalThis.zaps.groups || [];
            const filteredGroups = groups.filter(g => g && g.collectionUuid === collectionUuid);

            if (filteredZaps.length === 0 && filteredGroups.length === 0) {
                this.#zapsStack.visible_child_name = 'no-zaps';
                return;
            }

            this.#zapsStack.visible_child_name = 'zaps';

            const displayedZapUuids = new Set();
            
            // Add Persistent Groups
            filteredGroups.sort((a, b) => a.position - b.position).forEach(group => {
                const groupZaps = filteredZaps.filter(z => z.groupName === group.name).sort((a, b) => a.position - b.position);
                this.#addGroupToLayout(group.name, groupZaps, group);
                groupZaps.forEach(z => displayedZapUuids.add(z.uuid));
            });

            // Add remaining Zaps (ungrouped or non-persistent groups)
            const remainingZaps = filteredZaps.filter(z => !displayedZapUuids.has(z.uuid)).sort((a, b) => a.position - b.position);
            if (remainingZaps.length > 0) {
                this.#addGroupToLayout('', remainingZaps);
            }
        } catch (e) {
            console.error(`Failed to refresh Zaps layout: ${e.message}`);
        }
    }

    /**
     * Helper to add a group and its Zaps to the layout.
     * 
     * @param {string} groupName Name.
     * @param {Zap[]} zaps Zaps.
     * @param {Group} group Persistent group object.
     */
    #addGroupToLayout(groupName, zaps, group = null) {
        const separator = new ZapGroupSeparator({ groupName, group });
        separator.margin_top = 12;
        separator.margin_bottom = 6;
        separator.margin_start = 12;
        separator.margin_end = 12;
        this.#zapsBox.append(separator);

        const flowBox = new Gtk.FlowBox({
            selection_mode: Gtk.SelectionMode.NONE,
            max_children_per_line: 24,
            min_children_per_line: 1,
            row_spacing: 12,
            column_spacing: 12,
            margin_start: 12,
            margin_end: 12,
            margin_bottom: 6,
        });

        zaps.forEach(zap => flowBox.append(new ZapItem({ zap })));
        this.#zapsBox.append(flowBox);
    }

    /**
     * Add a new group.
     */
    #addGroup() {
        if (!this.selectedCollection)
            return;

        const dialog = new Adw.MessageDialog({
            heading: _('New Group'),
            body: _('Enter a name for the new group.'),
            transient_for: this,
        });

        const entry = new Gtk.Entry({
            placeholder_text: _('Group Name'),
            margin_top: 12,
        });
        dialog.set_extra_child(entry);

        dialog.add_response('cancel', _('Cancel'));
        dialog.add_response('add', _('Add'));
        dialog.set_response_appearance('add', Adw.ResponseAppearance.SUGGESTED);
        
        dialog.connect('response', (d, response) => {
            if (response === 'add' && entry.text) {
                globalThis.zaps.addGroup({
                    name: entry.text,
                    collectionUuid: this.selectedCollection.uuid,
                });
            }
        });
        dialog.present();
    }

    /**
     * Close request virtual method.
     */
    vfunc_close_request() {
        this.#saveSettings();
        return super.vfunc_close_request();
    }

    /**
     * Setup collections.
     */
    #setupCollections() {
        this.#collectionsConnections.push(
            globalThis.collections.connect('collection-removed', (collections, uuid) => {
                if (this.selectedCollection && this.selectedCollection.uuid === uuid)
                    this.selectedCollection = collections.get_item(0);
            }),
            globalThis.collections.connect('collection-added', (collections, uuid) => {
                if (!this.selectedCollection)
                    this.selectedCollection = collections.get_item(0);
            })
        );
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
            {
                name: 'add-group',
                parameterType: null,
                callback: () => {
                    this.#addGroup();
                },
            },
            {
                name: 'show-preferences',
                parameterType: null,
                callback: () => {
                    console.debug('Action: show-preferences triggered');
                    try {
                        const prefs = new PreferencesWindow({ transient_for: this });
                        prefs.present();
                    } catch (e) {
                        console.error('Failed to open Preferences:', e.message);
                    }
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
            this.selectedCollection = globalThis.collections.find({ uuid: lastSelectedCollectionUuid }) || globalThis.collections.get_item(0);
        } catch (e) {
            this.selectedCollection = globalThis.collections.get_item(0);
        }
    }

    /**
     * Save settings.
     */
    #saveSettings() {
        try {
            const width = this.defaultWidth > 0 ? this.defaultWidth : 240;
            const height = this.defaultHeight > 0 ? this.defaultHeight : 360;
            globalThis.settings.set_uint('window-width', width);
            globalThis.settings.set_uint('window-height', height);
            globalThis.settings.set_boolean('window-maximized', this.maximized);
        } catch (e) {
            console.warn(`Failed to save window size settings: ${e.message}`);
        }

        if (this.selectedCollection) {
            try {
                globalThis.settings.set_string('last-selected-collection', this.selectedCollection.uuid);
            } catch (e) {
                console.warn(`Failed to save last selected collection: ${e.message}`);
            }
        }
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
                const file = d.get_file();
                try {
                    const metadata = await globalThis.config.getMetadata(file);
                    
                    // Check for name conflicts
                    const existingNames = [];
                    for (let i = 0; i < globalThis.collections.get_n_items(); i++) {
                        existingNames.push(globalThis.collections.get_item(i).name);
                    }

                    const conflicts = metadata.collections.filter(c => existingNames.includes(c.name));

                    if (conflicts.length > 0) {
                        const confirm = new Adw.MessageDialog({
                            heading: _('Conflicts Detected'),
                            body: _('Some collections being imported already exist. Would you like to replace them or keep both?'),
                            transient_for: this,
                        });
                        confirm.add_response('cancel', _('Cancel'));
                        confirm.add_response('keep', _('Keep Both'));
                        confirm.add_response('replace', _('Replace Existing'));
                        confirm.set_response_appearance('replace', Adw.ResponseAppearance.DESTRUCTIVE);

                        confirm.connect('response', async (c, res) => {
                            if (res === 'replace') {
                                await globalThis.config.import(file, true);
                            } else if (res === 'keep') {
                                await globalThis.config.import(file, false);
                            }
                        });
                        confirm.present();
                    } else {
                        await globalThis.config.import(file);
                    }
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
