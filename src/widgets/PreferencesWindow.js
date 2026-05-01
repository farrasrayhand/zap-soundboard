// SPDX-FileCopyrightText: 2022 Romain Vigier <contact AT romainvigier.fr>
//
// SPDX-License-Identifier: GPL-3.0-or-later

import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';

/**
 * Preferences window.
 */
export class PreferencesWindow extends Adw.PreferencesWindow {

    static {
        GObject.registerClass({
            GTypeName: 'ZapPreferencesWindow',
            Template: 'resource:///fr/romainvigier/zap/ui/PreferencesWindow.ui',
            InternalChildren: ['safetyModeSwitch'],
        }, this);
    }

    constructor({ ...params } = {}) {
        super(params);

        globalThis.settings.bind(
            'safety-mode',
            this._safetyModeSwitch,
            'active',
            Gio.SettingsBindFlags.DEFAULT
        );
    }

}
