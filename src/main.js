// SPDX-FileCopyrightText: 2022 Romain Vigier <contact AT romainvigier.fr>
//
// SPDX-License-Identifier: GPL-3.0-or-later

import 'gi://Adw?version=1';
import 'gi://Gdk?version=4.0';
import 'gi://Gtk?version=4.0';

import GObject from 'gi://GObject';
import Gst from 'gi://Gst';

import { Application } from './classes/Application.js';
import { Collection } from './classes/Collection.js';
import { Zap } from './classes/Zap.js';

import { Collections } from './services/Collections.js';
import { Config } from './services/Config.js';
import { Database } from './services/Database.js';
import { DBus } from './services/DBus.js';
import { Player } from './services/Player.js';
import { Service } from './services/Service.js';
import { Zaps } from './services/Zaps.js';

import { AddZapPopup } from './widgets/AddZapPopup.js';
import { CollectionItem } from './widgets/CollectionItem.js';
import { CollectionsMenuButton } from './widgets/CollectionsMenuButton.js';
import { ColorChooser } from './widgets/ColorChooser.js';
import { ColorPill } from './widgets/ColorPill.js';
import { EditZapPopover } from './widgets/EditZapPopover.js';
import { FileChooserButton } from './widgets/FileChooserButton.js';
import { ProgressBar } from './widgets/ProgressBar.js';
import { Window } from './widgets/Window.js';
import { ZapGroupSeparator } from './widgets/ZapGroupSeparator.js';
import { ZapItem } from './widgets/ZapItem.js';


/**
 * Register GObjects.
 */
function registerGObjects() {
    GObject.type_ensure(AddZapPopup);
    GObject.type_ensure(Application);
    GObject.type_ensure(Collection);
    GObject.type_ensure(CollectionItem);
    GObject.type_ensure(Collections);
    GObject.type_ensure(Config);
    GObject.type_ensure(CollectionsMenuButton);
    GObject.type_ensure(ColorChooser);
    GObject.type_ensure(ColorPill);
    GObject.type_ensure(Database);
    GObject.type_ensure(DBus);
    GObject.type_ensure(EditZapPopover);
    GObject.type_ensure(FileChooserButton);
    GObject.type_ensure(Player);
    GObject.type_ensure(ProgressBar);
    GObject.type_ensure(Service);
    GObject.type_ensure(Window);
    GObject.type_ensure(Zap);
    GObject.type_ensure(ZapGroupSeparator);
    GObject.type_ensure(ZapItem);
    GObject.type_ensure(Zaps);
}

/**
 * Main function.
 *
 * @param {string[]} argv An array of file names.
 * @returns {number} Exit code.
 */
export function main(argv) {
    Gst.init(null);
    registerGObjects();
    return new Application({ 'application-id': pkg.name }).run(argv);
}
