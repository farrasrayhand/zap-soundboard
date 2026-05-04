// SPDX-FileCopyrightText: 2022 Romain Vigier <contact AT romainvigier.fr>
//
// SPDX-License-Identifier: GPL-3.0-or-later

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
    #groupEntry;
    /** @type {Gtk.Entry} */
    #hotkeyEntry;
    /** @type {Gtk.Popover} */
    #groupPopover;
    /** @type {Gtk.ListBox} */
    #groupListBox;

    static {
        GObject.registerClass({
            GTypeName: 'ZapEditZapPopover',
            Template: 'resource:///fr/romainvigier/zap/ui/EditZapPopover.ui',
            Properties: {
                zap: GObject.ParamSpec.object('zap', 'Zap', 'Zap', GObject.ParamFlags.READWRITE, Zap),
                collections: GObject.ParamSpec.object('collections', 'Collections', 'Collections', GObject.ParamFlags.READWRITE, Gio.ListModel),
            },
            InternalChildren: ['nameEntry', 'groupEntry', 'hotkeyEntry', 'groupMenuButton', 'groupListBox', 'groupPopover'],
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
        this.#groupEntry = this._groupEntry;
        this.#hotkeyEntry = this._hotkeyEntry;
        this.#groupPopover = this._groupPopover;
        this.#groupListBox = this._groupListBox;

        this._groupMenuButton.connect('notify::active', (button) => {
            if (button.active)
                this.#refreshGroupList();
        });

        this.#setupHotkeyEntry(this.#hotkeyEntry);
    }

    #refreshGroupList() {
        const collectionUuid = this.zap ? this.zap.collectionUuid : null;
        if (!collectionUuid) return;

        const names = globalThis.zaps.getGroupNames(collectionUuid);
        
        // Clear existing
        let child = this.#groupListBox.get_first_child();
        while (child) {
            this.#groupListBox.remove(child);
            child = this.#groupListBox.get_first_child();
        }

        names.forEach(name => {
            const label = new Gtk.Label({ label: name, xalign: 0, margin_start: 12, margin_end: 12, margin_top: 6, margin_bottom: 6 });
            const row = new Gtk.ListBoxRow({ child: label });
            row._groupName = name;
            this.#groupListBox.append(row);
        });
        
        if (names.length === 0) {
            const label = new Gtk.Label({ label: _('No existing groups'), margin: 12 });
            this.#groupListBox.append(new Gtk.ListBoxRow({ child: label, sensitive: false }));
        }
    }

    /**
     * Callback when a group row is activated.
     *
     * @param {Gtk.ListBox} listbox ListBox.
     * @param {Gtk.ListBoxRow} row Row.
     */
    onGroupRowActivated(listbox, row) {
        if (row._groupName !== undefined) {
            this.#groupEntry.text = row._groupName;
            this.#groupPopover.popdown();
        }
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
        this.#groupEntry.text = this.zap.groupName || '';
        this.#hotkeyEntry.text = this.zap.hotkey || '';
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
     * Callback when the group entry is activated.
     *
     * @param {Gtk.Entry} entry Group entry.
     */
    onGroupEntryActivated(entry) {
        if (!this.zap)
            return;
        globalThis.zaps.changeGroupName({
            zap: this.zap,
            groupName: entry.text,
        });
        this.popdown();
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

        globalThis.zaps.changeGroupName({
            zap: this.zap,
            groupName: this.#groupEntry.text,
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
        globalThis.zaps.changeCollection({
            zap: this.zap,
            collectionUuid: dropdown.selectedItem.uuid,
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
