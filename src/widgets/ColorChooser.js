// SPDX-FileCopyrightText: 2022 Romain Vigier <contact AT romainvigier.fr>
//
// SPDX-License-Identifier: GPL-3.0-or-later

import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

import { Color } from '../enums/Color.js';

import { ColorPill } from './ColorPill.js';


/**
 * Allows choosing a color from predefined choices.
 */
export class ColorChooser extends Gtk.Widget {

    /** @type {ColorPill[]} */
    #pills = [];

    static {
        GObject.registerClass({
            GTypeName: 'ZapColorChooser',
            CssName: 'colorchooser',
            Properties: {
                color: GObject.ParamSpec.jsobject('color', 'Color', 'Color', GObject.ParamFlags.READWRITE, Color.GRAY),
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
         * Selected color.
         *
         * @type {Color}
         */
        this.color = color;

        this.layoutManager = new Gtk.BoxLayout({ spacing: 3 });
        this.#setupPills();
        this.#syncCssClass();
        this.connect('notify::color', () => this.#syncCssClass());
    }

    /**
     * Setup the color pills.
     */
    #setupPills() {
        Color.forEach(color => {
            const pill = new ColorPill({ color, halign: Gtk.Align.CENTER, hexpand: true });
            pill.set_parent(this);
            pill.connect('clicked', () => {
                this.color = pill.color;
                this.#syncCssClass();
            });
            this.#pills.push(pill);
        });
    }

    /**
     * Synchronize CSS classes.
     */
    #syncCssClass() {
        this.#pills.forEach(pill => {
            if (pill.color === this.color)
                pill.add_css_class('selected');
            else
                pill.remove_css_class('selected');
        });
    }

}
