// SPDX-FileCopyrightText: 2022 Romain Vigier <contact AT romainvigier.fr>
//
// SPDX-License-Identifier: GPL-3.0-or-later

import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import GObject from 'gi://GObject';
import Graphene from 'gi://Graphene';
import Gtk from 'gi://Gtk';


/**
 * Display a progress in the form of a bar occupying a fraction of the widget's width.
 *
 * The bar will use the current color, you can change it with CSS by changing the `progress-bar` element's `color` property.
 */
export class ProgressBar extends Gtk.Widget {

    #progress = 0.0;

    static {
        GObject.registerClass({
            GTypeName: 'ZapProgressBar',
            CssName: 'progress-bar',
            Properties: {
                progress: GObject.ParamSpec.double('progress', 'Progress', 'Progress', GObject.ParamFlags.READWRITE, 0.0, 1.0, 0.0),
            },
        }, this);
    }

    /**
     * Progress, between 0 and 1.
     *
     * @returns {number} Current progress.
     */
    get progress() {
        return this.#progress;
    }

    /**
     * Progress, between 0 and 1.
     */
    set progress(val) {
        this.#progress = val;
        this.notify('progress');
        this.queue_draw();
    }

    /**
     * Snapshot virtual method.
     *
     * @param {Gtk.Snapshot} snapshot Snapshot.
     */
    vfunc_snapshot(snapshot) {
        const styleContext = this.get_style_context();
        const color = styleContext.get_color();
        const allocation = this.get_allocation();
        const direction = this.get_direction();

        const barColor = color.copy();
        barColor.alpha = 0.25;
        const barWidth = Math.floor(allocation.width * this.progress);
        const barX = direction !== Gtk.TextDirection.RTL ? 0 : allocation.width - barWidth;
        const barRect = new Graphene.Rect({
            origin: new Graphene.Point({ x: barX, y: 0 }),
            size: new Graphene.Size({ width: barWidth, height: allocation.height }),
        });
        snapshot.append_color(barColor, barRect);

        // Antialias the end of the bar
        const antialiasFrac = allocation.width * this.progress % 1;
        const antialiasColor = barColor.copy();
        antialiasColor.alpha *= antialiasFrac;
        const antialiasRectWidth = Math.ceil(antialiasFrac);
        const antialiasRectX = direction !== Gtk.TextDirection.RTL ? barWidth : allocation.width - barWidth - antialiasRectWidth;
        const antialiasRect = new Graphene.Rect({
            origin: new Graphene.Point({ x: antialiasRectX, y: 0 }),
            size: new Graphene.Size({ width: antialiasRectWidth, height: allocation.height }),
        });
        snapshot.append_color(antialiasColor, antialiasRect);

        // Darken the end of the bar high contrast
        if (Adw.StyleManager.get_default().highContrast) {
            const hcColor = new Gdk.RGBA({ red: 0.5, green: 0.5, blue: 0.5, alpha: 1 });
            const hcRectWidth = 1;
            const hcRectX = direction !== Gtk.TextDirection.RTL ? barWidth : allocation.width - barWidth - hcRectWidth;
            const hcRect = new Graphene.Rect({
                origin: new Graphene.Point({ x: hcRectX, y: 0 }),
                size: new Graphene.Size({ width: hcRectWidth, height: allocation.height }),
            });
            snapshot.append_color(hcColor, hcRect);
        }
    }

}
