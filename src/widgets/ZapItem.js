// SPDX-FileCopyrightText: 2022 Romain Vigier <contact AT romainvigier.fr>
//
// SPDX-License-Identifier: GPL-3.0-or-later

import Gdk from 'gi://Gdk';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

import { Zap } from '../classes/Zap.js';

import { Color } from '../enums/Color.js';


/**
 * Widget displaying and allowing interaction with a Zap.
 */
export class ZapItem extends Gtk.Widget {

    /** @type {Gtk.Revealer} */
    #stopButtonRevealer;

    /** @type {?string} */
    #previousItemCssClass;

    static {
        GObject.registerClass({
            GTypeName: 'ZapZapItem',
            CssName: 'zap-item',
            Template: 'resource:///fr/romainvigier/zap/ui/ZapItem.ui',
            Properties: {
                zap: GObject.ParamSpec.object('zap', 'Zap', 'Zap', GObject.ParamFlags.READWRITE, Zap),
                playing: GObject.ParamSpec.boolean('playing', 'Playing', 'Playing', GObject.ParamFlags.READWRITE, false),
            },
            InternalChildren: ['stopButtonRevealer'],
        }, this);
    }

    /**
     * @param {object} params Parameter object.
     * @param {?Zap} params.zap Zap.
     * @param {Color} params.color Color.
     * @param {boolean} params.playing Playing state.
     */
    constructor({ zap = null, playing = false, ...params } = {}) {
        super(params);

        /** @type {?Zap} */
        this.zap = zap;
        /** @type {?boolean} */
        this.playing = playing;

        this.#stopButtonRevealer = this._stopButtonRevealer;

        this.#syncItemCssClass();
        this.#syncPlayingCssClass();

        this.connect('notify::zap', () => this.#syncItemCssClass());
        this.connect('notify::playing', () => this.#syncPlayingCssClass());
    }

    /**
     * Synchronize CSS class to the Zap's UUID.
     */
    #syncItemCssClass() {
        if (this.#previousItemCssClass)
            this.remove_css_class(this.#previousItemCssClass);
        if (!this.zap)
            return;
        this.#previousItemCssClass = `uuid-${this.zap.uuid}`;
        this.add_css_class(this.#previousItemCssClass);
    }

    /**
     * Synchronize CSS class to the Zap's playing state.
     */
    #syncPlayingCssClass() {
        if (this.#stopButtonRevealer.childRevealed || this.playing)
            this.add_css_class('playing');
        else
            this.remove_css_class('playing');
    }

    /**
     * Callback when the stop button revealer changes.
     *
     * @param {Gtk.Revealer} revealer Revealer.
     */
    onStopButtonRevealChanged(revealer) {
        this.#syncPlayingCssClass();
    }

    /**
     * Callback when the stop button is clicked.
     *
     * @param {Gtk.Button} button Stop button.
     */
    onStopButtonClicked(button) {
        globalThis.player.stop();
    }

    /**
     * Callback when the fade out button is clicked.
     *
     * @param {Gtk.Button} button Fade out button.
     */
    onFadeOutButtonClicked(button) {
        globalThis.player.fadeOut();
    }

    /**
     * Callback when the play button is clicked.
     *
     * @param {Gtk.Button} button Play button.
     */
    onPlayButtonClicked(button) {
        if (!this.zap.file.query_exists(null)) {
            console.error('File does not exists');
            return;
        }
        globalThis.player.play(this.zap);
    }

    /**
     * Callback when the loop button is clicked.
     *
     * @param {Gtk.Button} button Loop button.
     */
    onLoopButtonToggled(button) {
        globalThis.zaps.loop({
            zap: this.zap,
            loop: button.active,
        });
    }

    /**
     * Callback when the drag source needs to be prepared.
     *
     * @param {Gtk.DragSource} source Drag source.
     * @param {number} x X coordinate.
     * @param {number} y Y coordinate.
     * @returns {Gdk.ContentProvider} Content provider.
     */
    onDragPrepare(source, x, y) {
        source.set_icon(new Gtk.WidgetPaintable({ widget: this }), x, y);
        const value = new GObject.Value();
        value.init_from_instance(this.zap);
        return Gdk.ContentProvider.new_for_value(value);
    }

    /**
     * Callback when the value of the drop changes.
     *
     * @param {Gtk.DropTarget} target Drop target.
     */
    onDropValueChanged(target) {
        // FIXME: value is not preloaded
        if (!target.value)
            return;
        const droppedZap = target.value;
        if (droppedZap === this.zap)
            target.reject();
        if (droppedZap.collectionUuid !== this.zap.collectionUuid)
            target.reject();
    }

    /**
     * Callback when a Zap is dropped.
     *
     * @param {Gtk.DropTarget} target Drop target.
     * @param {Zap} value Dropped Zap.
     * @param {number} x X coordinate.
     * @param {number} y Y coordinate.
     * @returns {boolean} Whether the drop is handled.
     */
    onDrop(target, value, x, y) {
        if (value === this.zap)
            return false;
        if (value.collectionUuid !== this.zap.collectionUuid)
            return false;
        globalThis.zaps.changePosition({
            zap: value,
            position: this.zap.position,
        });
        return true;
    }

}
