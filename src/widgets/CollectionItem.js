// SPDX-FileCopyrightText: 2022 Romain Vigier <contact AT romainvigier.fr>
//
// SPDX-License-Identifier: GPL-3.0-or-later

import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

import { Collection } from '../classes/Collection.js';
import { Zap } from '../classes/Zap.js';


/**
 * Widget displaying a collection, for use in the collections menu.
 */
export class CollectionItem extends Gtk.Widget {

    /** @type {Gtk.Entry} */
    #nameEntry;
    /** @type {Gtk.Stack} */
    #stack;

    static {
        GObject.registerClass({
            GTypeName: 'ZapCollectionItem',
            CssName: 'collection-item',
            Template: 'resource:///fr/romainvigier/zap/ui/CollectionItem.ui',
            Properties: {
                collection: GObject.ParamSpec.object('collection', 'Collection', 'Collection', GObject.ParamFlags.READWRITE, Collection),
                selectedCollection: GObject.ParamSpec.object('selected-collection', 'Selected collection', 'Selected collection', GObject.ParamFlags.READWRITE, Collection),
                playingZap: GObject.ParamSpec.object('playing-zap', 'Playing zap', 'Playing zap', GObject.ParamFlags.READWRITE, Zap),
            },
            InternalChildren: ['nameEntry', 'stack'],
        }, this);
    }

    /**
     *
     * @param {object} params Parameter object.
     * @param {?Collection} params.collection Collection.
     * @param {?Collection} params.selectedCollection Selected collection.
     * @param {?Zap} params.playingZap Playing Zap.
     */
    constructor({ collection = null, selectedCollection = null, playingZap = null, ...params } = {}) {
        super(params);

        /** @type {?Collection} */
        this.collection = collection;
        /** @type {?Collection} */
        this.selectedCollection = selectedCollection;
        /** @type {?Zap} */
        this.playingZap = playingZap;

        this.#nameEntry = this._nameEntry;
        this.#stack = this._stack;

        globalThis.player.bind_property('zap', this, 'playing-zap', GObject.BindingFlags.SYNC_CREATE);
        this.connect('notify::selected-collection', () => this.#syncCss());
    }

    /**
     * Save changes made to the collection.
     */
    save() {
        this.#stack.visibleChildName = 'view';
        globalThis.collections.rename({
            collection: this.collection,
            name: this.#nameEntry.text,
        });
    }

    /**
     * Validate that the save button can be enabled.
     *
     * @param {CollectionItem} item Item.
     * @param {string} name New name.
     * @returns {boolean} If the values are valid.
     */
    validate(item, name) {
        return !!name;
    }

    /**
     * Get the name of the page that should be visible, depending on if the collection has a Zap playing inside.
     *
     * @param {CollectionItem} item Item.
     * @param {?Collection} collection Collection.
     * @param {?Zap} playingZap Playing Zap.
     * @param {boolean} playing Playing state.
     * @returns {string} The page name.
     */
    getPlayingStackVisiblePageName(item, collection, playingZap, playing) {
        if (!collection || !playingZap)
            return 'not-playing';
        return playingZap.collectionUuid === collection.uuid && playing ? 'playing' : 'not-playing';
    }

    /**
     * Callback when the widget is hidden.
     *
     * @param {CollectionItem} widget Current widget.
     */
    onHide(widget) {
        this.#switchToDefaultView();
    }

    /**
     * Callback when the name button is clicked.
     *
     * @param {Gtk.Button} button Name button.
     */
    onNameButtonClicked(button) {
        this.#makeSelectedCollection();
    }

    /**
     * Callback when the edit button is clicked.
     *
     * @param {Gtk.Button} button Edit button.
     */
    onEditButtonClicked(button) {
        this.#switchToEditView();
    }

    /**
     * Callback when the remove button is clicked.
     *
     * @param {Gtk.Button} button Remove button.
     */
    onRemoveButtonClicked(button) {
        this.#removeCollection();
    }

    /**
     * Callback when the name entry is activated.
     *
     * @param {Gtk.Entry} entry Name entry.
     */
    onNameEntryActivated(entry) {
        if (!entry.text)
            return;
        this.save();
    }

    /**
     * Callback when the save button is clicked.
     *
     * @param {Gtk.Button} button Done button.
     */
    onDoneButtonClicked(button) {
        this.save();
    }

    /**
     * Switch to the default view.
     */
    #switchToDefaultView() {
        this.#stack.visibleChildName = 'view';
    }

    /**
     * Switch to the edit view.
     */
    #switchToEditView() {
        this.#stack.visibleChildName = 'edit';
        this.#nameEntry.text = this.collection.name;
        this.#nameEntry.grab_focus();
    }

    /**
     * Make the collection the selected collection.
     */
    #makeSelectedCollection() {
        this.get_root().selectedCollection = this.collection;
        this.activate_action('menu.close', null);
    }

    /**
     * Remove the collection.
     */
    #removeCollection() {
        globalThis.collections.remove({ collection: this.collection });
    }

    /**
     * Synchronize CSS class names.
     */
    #syncCss() {
        if (this.collection === this.selectedCollection)
            this.add_css_class('selected');
        else
            this.remove_css_class('selected');
    }

}
