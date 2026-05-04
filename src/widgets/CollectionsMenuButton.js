// SPDX-FileCopyrightText: 2022 Romain Vigier <contact AT romainvigier.fr>
//
// SPDX-License-Identifier: GPL-3.0-or-later

import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

import { Collection } from '../classes/Collection.js';


/**
 * Menu button displaying the collections.
 */
export class CollectionsMenuButton extends Gtk.Widget {

    /** @type {Gtk.Entry} */
    #addCollectionNameEntry;
    /** @type {Gtk.MenuButton} */
    #button;

    static {
        GObject.registerClass({
            GTypeName: 'ZapCollectionsMenuButton',
            CssName: 'collections-menubutton',
            Template: 'resource:///fr/romainvigier/zap/ui/CollectionsMenuButton.ui',
            Properties: {
                selectedCollection: GObject.ParamSpec.object('selected-collection', 'Selected collection', 'Selected collection', GObject.ParamFlags.READWRITE, Collection),
                collections: GObject.ParamSpec.object('collections', 'Collections', 'Collections', GObject.ParamFlags.READWRITE, Gio.ListModel),
            },
            InternalChildren: ['addCollectionNameEntry', 'button'],
        }, this);
    }

    /**
     * @param {object} params Parameter object.
     * @param {?Collection} params.selectedCollection Selected collection.
     * @param {?Gio.ListModel<Collection>} params.collections Collections.
     */
    constructor({ selectedCollection = null, collections = null, ...params } = {}) {
        super(params);

        /** @type {?Collection} */
        this.selectedCollection = selectedCollection;
        /** @type {?Gio.ListModel<Collection>} */
        this.collections = collections;

        this.#addCollectionNameEntry = this._addCollectionNameEntry;
        this.#button = this._button;

        this.#setupActions();
    }

    /**
     * Setup the widget's actions.
     */
    #setupActions() {
        const actionGroup = new Gio.SimpleActionGroup();
        this.insert_action_group('menu', actionGroup);
        [
            {
                name: 'close',
                parameterType: null,
                callback: (action, params) => {
                    this.popdown();
                },
            },
        ].forEach(({ name, parameterType, callback }) => {
            const action = new Gio.SimpleAction({ name, parameterType });
            action.connect('activate', callback);
            actionGroup.insert(action);
        });
    }

    /**
     * Popup the menu.
     */
    popup() {
        this.#button.popup();
    }

    /**
     * Popdown the menu.
     */
    popdown() {
        this.#button.popdown();
    }

    /**
     * Callback when the add collection name entry is activated.
     *
     * @param {Gtk.Entry} entry Add collection name entry.
     */
    onAddCollectionNameEntryActivated(entry) {
        if (!entry.text)
            return;
        this.#addCollection();
    }

    /**
     * Callback when the add collection button is clicked.
     *
     * @param {Gtk.Button} button Add collection button.
     */
    onAddCollectionButtonClicked(button) {
        this.#addCollection();
    }

    /**
     * Validate if the add collection button is enabled.
     *
     * @param {Gtk.Button} button Add collection button.
     * @param {string} name Name.
     * @returns {boolean} Whether the values are valid.
     */
    validate(button, name) {
        return !!name;
    }

    /**
     * Add a new collection.
     */
    #addCollection() {
        const name = this.#addCollectionNameEntry.text;
        const collection = globalThis.collections.add({ name });
        const root = this.get_root();

        this.popdown();
        this.#addCollectionNameEntry.text = '';

        if (root)
            root.selectedCollection = collection;
    }

}
