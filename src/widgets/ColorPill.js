// SPDX-FileCopyrightText: 2022 Romain Vigier <contact AT romainvigier.fr>
//
// SPDX-License-Identifier: GPL-3.0-or-later

import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

import { Color } from '../enums/Color.js';


/**
 * Pill representing a color.
 */
export class ColorPill extends Gtk.Widget {

    /** @type {Gtk.Button} */
    #button;
    /** @type {string} */
    #previousCssClass;

    static {
        GObject.registerClass({
            GTypeName: 'ZapColorPill',
            CssName: 'colorpill',
            Properties: {
                color: GObject.ParamSpec.jsobject('color', 'Color', 'Color', GObject.ParamFlags.READWRITE, Color.GRAY),
            },
            Signals: {
                clicked: {},
            },
        }, this);
    }

    /**
     * @param {object} params Parameter object.
     * @param {Color} params.color Color.
     */
    constructor({ color = Color.GRAY, ...params } = {}) {
        super(params);

        /**
         * Color represented by the pill.
         *
         * @type {Color}
         */
        this.color = color;

        this.#setupButton();
        this.#setupLayout();
        this.#syncCssClass();
        this.#syncTooltip();

        this.connect('notify::color', () => {
            this.#syncCssClass();
            this.#syncTooltip();
        });
    }

    /**
     * Setup the button.
     */
    #setupButton() {
        this.#button = new Gtk.Button();
        this.#button.connect('clicked', () => this.emit('clicked'));
        this.#button.set_parent(this);
    }

    /**
     * Setup the layout.
     */
    #setupLayout() {
        this.layoutManager = new Gtk.BinLayout();
        this.widthRequest = 32;
        this.heightRequest = 32;
    }

    /**
     * Synchronize the CSS class to the color ID.
     */
    #syncCssClass() {
        if (this.#previousCssClass)
            this.remove_css_class(this.#previousCssClass);
        this.#previousCssClass = this.color.id;
        this.add_css_class(this.#previousCssClass);
    }

    /** Synchronize the tooltip with the color. */
    #syncTooltip() {
        this.#button.tooltipText = this.color.name;
    }

}
