// SPDX-FileCopyrightText: 2022 Romain Vigier <contact AT romainvigier.fr>
// SPDX-FileCopyrightText: 2026 Farras Rayhand <farrasrayhand@gmail.com>
//
// SPDX-License-Identifier: GPL-3.0-or-later

import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

import { Group } from '../classes/Group.js';
import { Zap } from '../classes/Zap.js';

/**
 * Visual separator for groups.
 */
export class ZapGroupSeparator extends Gtk.Box {

    static {
        GObject.registerClass({
            GTypeName: 'ZapGroupSeparator',
            CssName: 'group-separator',
        }, this);
    }

    /**
     * @param {object} params Params.
     * @param {string} params.groupName Name of the group.
     * @param {Group} params.group Persistent group object if any.
     */
    constructor({ groupName = '', group = null, ...params } = {}) {
        super({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 12,
            ...params,
        });

        this.groupName = groupName;
        this.group = group;

        const label = new Gtk.Label({
            label: groupName || _('No Group'),
            xalign: 0,
        });
        label.add_css_class('title-4');
        label.add_css_class('dim-label');

        this.append(label);

        // Add edit button for persistent groups
        if (this.group) {
            const moveUpButton = new Gtk.Button({
                icon_name: 'go-up-symbolic',
                tooltip_text: _('Move Group Up'),
            });
            moveUpButton.add_css_class('flat');
            moveUpButton.add_css_class('circular');
            moveUpButton.connect('clicked', () => {
                globalThis.zaps.moveGroup({
                    group: this.group,
                    position: this.group.position - 1,
                });
            });
            this.append(moveUpButton);

            const moveDownButton = new Gtk.Button({
                icon_name: 'go-down-symbolic',
                tooltip_text: _('Move Group Down'),
            });
            moveDownButton.add_css_class('flat');
            moveDownButton.add_css_class('circular');
            moveDownButton.connect('clicked', () => {
                globalThis.zaps.moveGroup({
                    group: this.group,
                    position: this.group.position + 1,
                });
            });
            this.append(moveDownButton);

            const editButton = new Gtk.Button({
                icon_name: 'fr.romainvigier.zap-edit-symbolic',
                tooltip_text: _('Edit Group'),
            });
            editButton.add_css_class('flat');
            editButton.add_css_class('circular');
            editButton.connect('clicked', () => this.#onEditClicked());
            this.append(editButton);
        }

        const separator = new Gtk.Separator({
            orientation: Gtk.Orientation.HORIZONTAL,
            hexpand: true,
            valign: Gtk.Align.CENTER,
        });
        this.append(separator);

        const dropTarget = new Gtk.DropTarget({
            actions: Gdk.DragAction.MOVE,
        });
        dropTarget.set_gtypes([Zap.$gtype]);

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

    #onEditClicked() {
        const dialog = new Adw.MessageDialog({
            heading: _('Edit Group'),
            body: _('Change group name or remove it.'),
            transient_for: this.get_root(),
        });

        const entry = new Gtk.Entry({
            text: this.group.name,
            margin_top: 12,
        });
        dialog.set_extra_child(entry);

        dialog.add_response('cancel', _('Cancel'));
        dialog.add_response('remove', _('Remove'));
        dialog.add_response('save', _('Save'));
        
        dialog.set_response_appearance('save', Adw.ResponseAppearance.SUGGESTED);
        dialog.set_response_appearance('remove', Adw.ResponseAppearance.DESTRUCTIVE);
        
        dialog.connect('response', (d, response) => {
            if (response === 'save' && entry.text) {
                globalThis.zaps.renameGroup({
                    group: this.group,
                    name: entry.text,
                });
            } else if (response === 'remove') {
                globalThis.zaps.removeGroup({ group: this.group });
            }
        });
        dialog.present();
    }
}
