// SPDX-FileCopyrightText: 2022 Romain Vigier <contact AT romainvigier.fr>
//
// SPDX-License-Identifier: GPL-3.0-or-later

import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

import { Color } from '../enums/Color.js';

import { ColorChooser } from '../widgets/ColorChooser.js';
import { FileChooserButton } from './FileChooserButton.js';


/**
 * Popup to add a Zap.
 */
export class AddZapPopup extends Gtk.Widget {

    /** @type {ColorChooser} */
    #colorChooser;
    /** @type {FileChooserButton} */
    #fileButton;
    /** @type {Gtk.Entry} */
    #nameEntry;
    /** @type {Gtk.Revealer} */
    #revealer;

    static {
        GObject.registerClass({
            GTypeName: 'ZapAddZapPopup',
            CssName: 'add-zap-popup',
            Template: 'resource:///fr/romainvigier/zap/ui/AddZapPopup.ui',
            InternalChildren: ['colorChooser', 'fileButton', 'nameEntry', 'revealer'],
        }, this);
    }

    /**
     * @param {object} params Parameter object.
     */
    constructor({ ...params } = {}) {
        super(params);

        this.#colorChooser = this._colorChooser;
        this.#fileButton = this._fileButton;
        this.#nameEntry = this._nameEntry;
        this.#revealer = this._revealer;

        this.#setupActions();
    }

    /**
     * Setup the widget's actions.
     */
    #setupActions() {
        const actionGroup = new Gio.SimpleActionGroup();
        this.insert_action_group('popup', actionGroup);
        [
            {
                name: 'close',
                parameterType: null,
                callback: (action, params) => {
                    this.close();
                },
            },
        ].forEach(({ name, parameterType, callback }) => {
            const action = new Gio.SimpleAction({ name, parameterType });
            action.connect('activate', callback);
            actionGroup.insert(action);
        });
    }

    /**
     * Open the popup.
     */
    open() {
        this.#revealer.revealChild = true;
        this.#revealer.grab_focus();
        this.add_css_class('open');
    }

    /**
     * Close the popup.
     */
    close() {
        this.#revealer.revealChild = false;
        this.remove_css_class('open');
    }

    /**
     * Populate the popup with the given values.
     *
     * @param {object} params Parameter object.
     * @param {Gio.File} params.file GFile.
     * @param {string} params.name Name.
     */
    populate({ file = null, name = '' }) {
        if (file)
            this.#fileButton.file = file;
        if (name)
            this.#nameEntry.text = name;
    }

    /**
     * Reset to default values.
     */
    reset() {
        this.#fileButton.file = null;
        this.#nameEntry.text = '';
        this.#colorChooser.color = Color.NONE;
    }

    /**
     * Callback when a file is selected.
     *
     * @param {FileChooserButton} button File chooser button.
     */
    onFileChanged(button) {
        if (!button.file)
            return;
        const name = button.file.get_basename()
            .replaceAll(/[-_]/g, ' ')
            .split('.')
            .slice(0, -1)
            .join(' ')
            .split(' ')
            .map(w => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ');
        this.populate({ name });
    }

    /**
     * Callback when the name entry is activated.
     *
     * @param {Gtk.Entry} entry Name entry.
     */
    onNameEntryActivated(entry) {
        if (!this.#fileButton.file || !this.#nameEntry.text)
            return;
        this.#add();
        this.close();
        this.reset();
    }

    /**
     * Callback when a click on an icon of the name entry is released.
     *
     * @param {Gtk.Entry} entry Name entry.
     * @param {Gtk.EntryIconPosition} position Icon position.
     */
    onNameEntryIconReleased(entry, position) {
        if (position === Gtk.EntryIconPosition.SECONDARY)
            this.#nameEntry.text = '';
    }

    /**
     * Callback when the add button is clicked.
     *
     * @param {Gtk.Button} button Add button.
     */
    onAddButtonClicked(button) {
        this.#add();
        this.close();
        this.reset();
    }

    /**
     * Add a new Zap with the current values.
     */
    #add() {
        globalThis.zaps.add({
            name: this.#nameEntry.text,
            collection: this.get_root().selectedCollection,
            uri: this.#fileButton.file.get_uri(),
            color: this.#colorChooser.color,
        });
    }

    /**
     * Validate if the add button can be enabled.
     *
     * @param {AddZapPopup} popup Popup.
     * @param {Gio.File} file GFile.
     * @param {string} name Name.
     * @returns {boolean} If all the required values are set.
     */
    validate(popup, file, name) {
        return !!file && !!name;
    }

}
