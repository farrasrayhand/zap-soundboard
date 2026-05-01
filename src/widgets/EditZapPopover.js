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

    static {
        GObject.registerClass({
            GTypeName: 'ZapEditZapPopover',
            Template: 'resource:///fr/romainvigier/zap/ui/EditZapPopover.ui',
            Properties: {
                zap: GObject.ParamSpec.object('zap', 'Zap', 'Zap', GObject.ParamFlags.READWRITE, Zap),
                collections: GObject.ParamSpec.object('collections', 'Collections', 'Collections', GObject.ParamFlags.READWRITE, Gio.ListModel),
            },
            InternalChildren: ['nameEntry', 'groupEntry'],
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
        if (this.zap.playing)
            globalThis.player.stop();
        globalThis.zaps.remove({ zap: this.zap });
        this.popdown();
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
