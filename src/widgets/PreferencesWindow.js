// SPDX-FileCopyrightText: 2022 Romain Vigier <contact AT romainvigier.fr>
// SPDX-FileCopyrightText: 2026 Farras Rayhand <farrasrayhand@gmail.com>
//
// SPDX-License-Identifier: GPL-3.0-or-later

import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

/**
 * Preferences window.
 */
export class PreferencesWindow extends Adw.Window {

    static {
        GObject.registerClass({
            GTypeName: 'ZapPreferencesWindow',
            Template: 'resource:///fr/romainvigier/zap/ui/PreferencesWindow.ui',
            InternalChildren: [
                'safetyModeSwitch',
                'hideStopButtonSwitch',
                'enablePauseRow',
                'enablePauseSwitch',
                'fadeoutDurationSpinButton',
                'stopHotkeyEntry',
                'fadeoutHotkeyEntry',
            ],
        }, this);
    }

    constructor({ ...params } = {}) {
        super(params);

        this.#loadSettings();
        this.#syncPauseSensitivity();
        this.#syncStopHotkeySensitivity();

        this._safetyModeSwitch.connect('notify::active', () => this.#syncPauseSensitivity());
        this._hideStopButtonSwitch.connect('notify::active', () => this.#syncStopHotkeySensitivity());

        this.#setupHotkeyEntry(this._stopHotkeyEntry);
        this.#setupHotkeyEntry(this._fadeoutHotkeyEntry);
    }

    /**
     * Synchronize the sensitivity of the Stop Hotkey option based on Hide Stop Button.
     */
    #syncStopHotkeySensitivity() {
        this._stopHotkeyEntry.sensitive = !this._hideStopButtonSwitch.active;
    }

    /**
     * Synchronize the sensitivity of the Pause option based on Safety Mode.
     */
    #syncPauseSensitivity() {
        const safetyActive = this._safetyModeSwitch.active;
        this._enablePauseRow.sensitive = !safetyActive;
        
        // If Safety Mode is active, force Pause to be disabled
        if (safetyActive) {
            this._enablePauseSwitch.active = false;
        }
    }

    /**
     * Load current settings into the UI.
     */
    #loadSettings() {
        this._safetyModeSwitch.active = globalThis.settings.get_boolean('safety-mode');
        this._hideStopButtonSwitch.active = globalThis.settings.get_boolean('hide-stop-button');
        this._enablePauseSwitch.active = globalThis.settings.get_boolean('enable-pause');
        this._fadeoutDurationSpinButton.value = globalThis.settings.get_double('fadeout-duration');
        this._stopHotkeyEntry.text = globalThis.settings.get_string('stop-hotkey');
        this._fadeoutHotkeyEntry.text = globalThis.settings.get_string('fadeout-hotkey');
    }

    /**
     * Save UI values back to settings.
     */
    onSaveButtonClicked() {
        globalThis.settings.set_boolean('safety-mode', this._safetyModeSwitch.active);
        globalThis.settings.set_boolean('hide-stop-button', this._hideStopButtonSwitch.active);
        globalThis.settings.set_boolean('enable-pause', this._enablePauseSwitch.active);
        globalThis.settings.set_double('fadeout-duration', this._fadeoutDurationSpinButton.value);
        globalThis.settings.set_string('stop-hotkey', this._stopHotkeyEntry.text);
        globalThis.settings.set_string('fadeout-hotkey', this._fadeoutHotkeyEntry.text);
        this.close();
    }

    /**
     * Close the window without saving.
     */
    onCancelButtonClicked() {
        this.close();
    }

    /**
     * Reset UI values to defaults.
     */
    onResetButtonClicked() {
        // We use the default values from the schema
        this._safetyModeSwitch.active = globalThis.settings.get_default_value('safety-mode').get_boolean();
        this._hideStopButtonSwitch.active = globalThis.settings.get_default_value('hide-stop-button').get_boolean();
        this._enablePauseSwitch.active = globalThis.settings.get_default_value('enable-pause').get_boolean();
        this._fadeoutDurationSpinButton.value = globalThis.settings.get_default_value('fadeout-duration').get_double();
        this._stopHotkeyEntry.text = globalThis.settings.get_default_value('stop-hotkey').get_string()[0];
        this._fadeoutHotkeyEntry.text = globalThis.settings.get_default_value('fadeout-hotkey').get_string()[0];
        
        this.#syncPauseSensitivity();
    }

    /**
     * Callback when the hotkey entry icon is released (clicked).
     *
     * @param {Gtk.Entry} entry Entry.
     * @param {Gtk.EntryIconPosition} iconPosition Position.
     */
    onHotkeyEntryIconReleased(entry, iconPosition) {
        if (iconPosition === Gtk.EntryIconPosition.SECONDARY)
            entry.text = '';
    }

    /**
     * Setup a hotkey entry to capture key presses.
     *
     * @param {Gtk.Entry} entry The entry to setup.
     */
    #setupHotkeyEntry(entry) {
        const controller = new Gtk.EventControllerKey();
        controller.set_propagation_phase(Gtk.PropagationPhase.CAPTURE);
        controller.connect('key-pressed', (c, keyval, keycode, state) => {
            const keyName = Gdk.keyval_name(keyval);
            if (keyName) {
                entry.text = keyName;
                // Return true/EVENT_STOP to prevent default actions (like Enter activating or Arrows moving focus)
                return true;
            }
            return false;
        });
        entry.add_controller(controller);
    }

}
