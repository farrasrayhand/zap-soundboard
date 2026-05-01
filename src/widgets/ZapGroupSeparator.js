// SPDX-FileCopyrightText: 2022 Romain Vigier <contact AT romainvigier.fr>
//
// SPDX-License-Identifier: GPL-3.0-or-later

import Gdk from 'gi://Gdk';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

import { Zap } from '../classes/Zap.js';

/**
 * Visual separator for groups.
 */
export class ZapGroupSeparator extends Gtk.Widget {

    static {
        GObject.registerClass({
            GTypeName: 'ZapGroupSeparator',
            CssName: 'group-separator',
        }, this);
    }

    constructor({ groupName = '', ...params } = {}) {
        super(params);

        this.groupName = groupName;

        const box = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 12,
        });

        const label = new Gtk.Label({
            label: groupName || _('No Group'),
            xalign: 0,
        });
        label.add_css_class('title-4');
        label.add_css_class('dim-label');

        const separator = new Gtk.Separator({
            orientation: Gtk.Orientation.HORIZONTAL,
            hexpand: true,
            valign: Gtk.Align.CENTER,
        });

        box.append(label);
        box.append(separator);

        this.set_child(box);
        this.set_layout_manager(new Gtk.BinLayout());

        const dropTarget = new Gtk.DropTarget({
            actions: Gdk.DragAction.MOVE,
            formats: Gdk.ContentFormats.new_for_gtype(Zap),
        });
        dropTarget.connect('drop', (target, value, x, y) => {
            if (value instanceof Zap) {
                globalThis.zaps.changeGroupName({
                    zap: value,
                    groupName: this.groupName,
                });
                return true;
            }
            return false;
        });
        this.add_controller(dropTarget);
    }
}
