// SPDX-FileCopyrightText: 2022 Romain Vigier <contact AT romainvigier.fr>
//
// SPDX-License-Identifier: GPL-3.0-or-later

import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

import { Collection } from '../classes/Collection.js';
import { Zap } from '../classes/Zap.js';

import { ColorChooser } from '../widgets/ColorChooser.js';


/**
 * Popover to edit a Zap.
 */
export class EditZapPopover extends Gtk.Popover {

    /** @type {Gtk.Entry} */
    #nameEntry;
    /** @type {Gtk.Entry} */
    #hotkeyEntry;
    /** @type {Gtk.DropDown} */
    #groupDropDown;

    static {
        GObject.registerClass({
            GTypeName: 'ZapEditZapPopover',
            Template: 'resource:///fr/romainvigier/zap/ui/EditZapPopover.ui',
            Properties: {
                zap: GObject.ParamSpec.object('zap', 'Zap', 'Zap', GObject.ParamFlags.READWRITE, Zap),
                collections: GObject.ParamSpec.object('collections', 'Collections', 'Collections', GObject.ParamFlags.READWRITE, Gio.ListModel),
            },
            InternalChildren: ['nameEntry', 'hotkeyEntry', 'groupDropDown'],
        }, this);
    }

    /**
     * @param {object} params Parameter object.
     * @param {?Zap} params.zap Zap.
     * @param {?Gio.ListModel<Collection>} params.collections Collections.
     */
    constructor({ zap = null, collections = null, ...params } = {}) {
        super(params);

        /** @type {?Zap} */
        this.zap = zap;
        /** @type {?Gio.ListModel<Collection>} */
        this.collections = collections;

        this.#nameEntry = this._nameEntry;
        this.#hotkeyEntry = this._hotkeyEntry;
        this.#groupDropDown = this._groupDropDown;

        this.#setupHotkeyEntry(this.#hotkeyEntry);
    }

    #refreshGroupDropdown() {
        const collectionUuid = this.zap ? this.zap.collectionUuid : null;
        if (!collectionUuid) return;

        const names = globalThis.zaps.getGroupNames(collectionUuid);
        const currentGroup = this.zap ? (this.zap.groupName || '') : '';

        const model = new Gtk.StringList();
        model.append('No group');
        let selectedPos = 0;

        names.forEach((name, i) => {
            model.append(name);
            if (name === currentGroup)
                selectedPos = i + 1;
        });

        this.#groupDropDown.model = model;
        this.#groupDropDown.selected = selectedPos;
    }

    /**
     * Callback when the group dropdown selection changes.
     *
     * @param {Gtk.DropDown} dropdown The dropdown.
     */
    onGroupDropDownSelectedItemChanged(dropdown) {
        if (!this.zap)
            return;
        if (!this.is_visible())
            return;
        const item = dropdown.selectedItem;
        if (!item)
            return;
        const name = item.string;
        const groupName = name === 'No group' ? '' : name;
        if (groupName === this.zap.groupName)
            return;
        globalThis.zaps.changeGroupName({
            zap: this.zap,
            groupName,
        });
        this.popdown();
    }

    /**
     * Setup a hotkey entry to capture key presses.
     *
     * @param {Gtk.Entry} entry The entry to setup.
     */
    #setupHotkeyEntry(entry) {
        const controller = new Gtk.EventControllerKey();
        controller.set_propagation_phase(Gtk.PropagationPhase.CAPTURE);
        controller.connect('key-pressed', (c, keyval, keycode, state) => {
            const keyName = Gdk.keyval_name(keyval);
            if (keyName) {
                entry.text = keyName;
                return true;
            }
            return false;
        });
        entry.add_controller(controller);
    }

    /**
     * Callback when the Zap changes.
     *
     * @param {EditZapPopover} popover Popover.
     */
    onZapChanged(popover) {
        if (!this.zap)
            return;
        this.#nameEntry.text = this.zap.name;
        this.#hotkeyEntry.text = this.zap.hotkey || '';
        this.#refreshGroupDropdown();
    }

    /**
     * Callback when the name entry changes.
     *
     * @param {Gtk.Entry} entry Name entry.
     */
    onNameEntryChanged(entry) {
        if (!this.zap)
            return;
        if (!entry.text) {
            entry.add_css_class('error');
            return;
        }
        entry.remove_css_class('error');
        globalThis.zaps.rename({
            zap: this.zap,
            name: entry.text,
        });
    }

    /**
     * Callback when the hotkey entry is activated.
     *
     * @param {Gtk.Entry} entry Hotkey entry.
     */
    onHotkeyEntryActivated(entry) {
        if (!this.zap)
            return;
        globalThis.zaps.changeHotkey({
            zap: this.zap,
            hotkey: entry.text,
        });
        this.popdown();
    }

    /**
     * Callback when the save button is clicked.
     *
     * @param {Gtk.Button} button Save button.
     */
    onSaveButtonClicked(button) {
        if (!this.zap)
            return;

        if (this.#nameEntry.text) {
            globalThis.zaps.rename({
                zap: this.zap,
                name: this.#nameEntry.text,
            });
        }

        const item = this.#groupDropDown.selectedItem;
        const groupName = item ? item.string : '';
        globalThis.zaps.changeGroupName({
            zap: this.zap,
            groupName: groupName === 'No group' ? '' : groupName,
        });

        globalThis.zaps.changeHotkey({
            zap: this.zap,
            hotkey: this.#hotkeyEntry.text,
        });

        this.popdown();
    }

    /**
     * Callback when the hotkey entry icon is released (clicked).
     *
     * @param {Gtk.Entry} entry Entry.
     * @param {Gtk.EntryIconPosition} iconPosition Position.
     */
    onHotkeyEntryIconReleased(entry, iconPosition) {
        if (iconPosition === Gtk.EntryIconPosition.SECONDARY)
            entry.text = '';
    }

    /**
     * Callback when the name entry is activated.
     *
     * @param {Gtk.Entry} entry Name entry.
     */
    onNameEntryActivated(entry) {
        if (!entry.text)
            return;
        this.popdown();
    }

    /**
     * Callback when the selected item of the collection drop down changes.
     *
     * @param {Gtk.DropDown} dropdown Collection drop down.
     */
    onCollectionDropDownSelectedItemChanged(dropdown) {
        if (!this.zap)
            return;
        // Only process user-initiated changes when the popover is actually visible
        if (!this.is_visible())
            return;
        const collection = dropdown.selectedItem;
        if (!collection || collection.uuid === this.zap.collectionUuid)
            return;
        globalThis.zaps.changeCollection({
            zap: this.zap,
            collectionUuid: collection.uuid,
        });
        this.popdown();
    }

    /**
     * Callback when the chosen color changes.
     *
     * @param {ColorChooser} chooser Color chooser.
     */
    onColorChanged(chooser) {
        globalThis.zaps.changeColor({
            zap: this.zap,
            color: chooser.color,
        });
    }

    /**
     * Callback when the volume changes.
     *
     * @param {Gtk.Scale} scale Volume scale.
     */
    onVolumeChanged(scale) {
        globalThis.zaps.changeVolume({
            zap: this.zap,
            volume: scale.adjustment.value,
        });
    }

    /**
     * Callback when the remove button is clicked.
     *
     * @param {Gtk.Button} button Remove button.
     */
    onRemoveButtonClicked(button) {
        const zap = this.zap;
        this.popdown();
        if (zap.playing)
            globalThis.player.stop();
        globalThis.zaps.remove({ zap });
    }

    /**
     * Get the position of the Zap's collection in the dropdown model, so that it can be marked as selected.
     *
     * @param {EditZapPopover} popover Popover.
     * @param {Gtk.DropDown} dropdown Collection drop down.
     * @param {Zap} zap Zap.
     * @returns {number} Position of the collection in the model.
     */
    getZapCollection(popover, dropdown, zap) {
        if (!zap)
            return -1;
        const collection = globalThis.collections.find({ uuid: zap.collectionUuid });
        for (let i = 0; i < dropdown.model.get_n_items(); i++) {
            if (dropdown.model.get_item(i) === collection)
                return i;
        }
        return -1;
    }

    /**
     * Get the icon name for the given volume.
     *
     * @param {EditZapPopover} popover Popover.
     * @param {number} volume Volume.
     * @returns {string} Icon name.
     */
    getVolumeIcon(popover, volume) {
        if (volume === 0)
            return 'fr.romainvigier.zap-volume-mute-symbolic';
        else if (volume < 0.33)
            return 'fr.romainvigier.zap-volume-low-symbolic';
        else if (volume < 0.67)
            return 'fr.romainvigier.zap-volume-medium-symbolic';
        else
            return 'fr.romainvigier.zap-volume-high-symbolic';
    }

}
