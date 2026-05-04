// SPDX-FileCopyrightText: 2022 Romain Vigier <contact AT romainvigier.fr>
//
// SPDX-License-Identifier: GPL-3.0-or-later

import Gdk from 'gi://Gdk';
import GLib from 'gi://GLib';
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

    /** @type {Gtk.Button} */
    #stopButton;

    /** @type {Gtk.Button} */
    #fadeOutButton;

    /** @type {Gtk.Button} */
    #playButton;

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
            InternalChildren: ['stopButtonRevealer', 'stopButton', 'fadeOutButton', 'playButton', 'playImage'],
        }, this);
    }

    /** @type {Gtk.Image} */
    #playImage;

    /** @type {number[]} */
    #playerConnections = [];
    /** @type {number[]} */
    #settingsConnections = [];
    /** @type {number[]} */
    #zapConnections = [];

    /** @type {?Zap} */
    #connectedZap = null;

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
        this.#stopButton = this._stopButton;
        this.#fadeOutButton = this._fadeOutButton;
        this.#playButton = this._playButton;
        this.#playImage = this._playImage;

        this.#syncItemCssClass();
        this.#syncPlayingCssClass();
        this.#syncSafetyMode();
        this.#syncStopButton();

        this.connect('notify::zap', () => {
            this.#syncItemCssClass();
            this.#syncSignals();
        });
        this.connect('notify::playing', () => {
            this.#syncPlayingCssClass();
            this.#syncSafetyMode();
        });

        this.#syncSignals();

        this.#settingsConnections.push(
            globalThis.settings.connect('changed::safety-mode', () => this.#syncSafetyMode()),
            globalThis.settings.connect('changed::enable-pause', () => this.#syncSafetyMode()),
            globalThis.settings.connect('changed::hide-stop-button', () => this.#syncStopButton())
        );
        this.#playerConnections.push(
            globalThis.player.connect('play-started', () => this.#syncSafetyMode()),
            globalThis.player.connect('play-stopped', () => this.#syncSafetyMode())
        );
    }

    /**
     * Synchronize signals.
     */
    #syncSignals() {
        if (this.#connectedZap === this.zap)
            return;

        if (this.#connectedZap) {
            this.#zapConnections.forEach(id => {
                if (GLib.signal_handler_is_connected(this.#connectedZap, id))
                    this.#connectedZap.disconnect(id);
            });
            this.#zapConnections = [];
        }

        this.#connectedZap = this.zap;

        if (this.#connectedZap) {
            this.#zapConnections.push(
                this.#connectedZap.connect('notify::paused', () => this.#syncPlayingCssClass())
            );
        }
    }

    /**
     * Synchronize Stop button visibility.
     */
    #syncStopButton() {
        if (!this.#stopButton || !this.#fadeOutButton)
            return;
        
        const hideStop = globalThis.settings.get_boolean('hide-stop-button');
        this.#stopButton.visible = !hideStop;
        
        // Make fade out button take full height if stop is hidden
        this.#fadeOutButton.vexpand = hideStop;
        this.#fadeOutButton.valign = hideStop ? Gtk.Align.FILL : Gtk.Align.CENTER;
    }

    /**
     * Dispose the widget.
     */
    vfunc_dispose() {
        this.#playerConnections.forEach(id => {
            if (GLib.signal_handler_is_connected(globalThis.player, id))
                globalThis.player.disconnect(id);
        });
        this.#playerConnections = [];
        this.#settingsConnections.forEach(id => {
            if (GLib.signal_handler_is_connected(globalThis.settings, id))
                globalThis.settings.disconnect(id);
        });
        this.#settingsConnections = [];

        if (this.#connectedZap) {
            this.#zapConnections.forEach(id => {
                if (GLib.signal_handler_is_connected(this.#connectedZap, id))
                    this.#connectedZap.disconnect(id);
            });
            this.#zapConnections = [];
            this.#connectedZap = null;
        }

        super.vfunc_dispose();
    }

    /**
     * Synchronize Play button sensitivity with Safety Mode.
     */
    #syncSafetyMode() {
        if (!this.#playButton || !this.#playImage)
            return;

        const safetyMode = globalThis.settings.get_boolean('safety-mode');
        const isPlaying = globalThis.player.playing;

        if (safetyMode && isPlaying) {
            // Safety Mode is ON and something is playing: 
            // Disable Play buttons of EVERYTHING (including the one playing)
            this.#playButton.sensitive = false;
        } else {
            // Either safety mode is OFF or nothing is playing:
            // Re-enable Play button
            this.#playButton.sensitive = true;
        }

        // Force icon refresh
        this.#playImage.icon_name = this.getPlayPauseIcon(this, this.playing, this.zap ? this.zap.paused : false);
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
        if (!this.#stopButtonRevealer)
            return;

        if (this.#stopButtonRevealer.childRevealed || this.playing) {
            this.add_css_class('playing');
            this.remove_css_class('paused');
        } else if (this.zap && this.zap.paused) {
            this.add_css_class('paused');
            this.remove_css_class('playing');
        } else {
            this.remove_css_class('playing');
            this.remove_css_class('paused');
        }
    }

    /**
     * Callback when the stop button revealer changes.
     *
     * @param {Gtk.Revealer} revealer Revealer.
     */
    onStopButtonRevealChanged(revealer) {
        if (!this.#stopButtonRevealer)
            return;
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

        // Change group if different
        if (value.groupName !== this.zap.groupName) {
            globalThis.zaps.changeGroupName({
                zap: value,
                groupName: this.zap.groupName,
            });
        }

        globalThis.zaps.changePosition({
            zap: value,
            position: this.zap.position,
        });
        return true;
    }

    /**
     * Helper to check if hotkey is not empty.
     *
     * @param {ZapItem} item Item.
     * @param {string} hotkey Hotkey.
     * @returns {boolean} True if not empty.
     */
    isHotkeyNotEmpty(item, hotkey) {
        return !!hotkey;
    }

    /**
     * Get the icon name for play/pause state.
     *
     * @param {ZapItem} item Item.
     * @param {boolean} playing Playing state.
     * @param {boolean} paused Paused state.
     * @returns {string} Icon name.
     */
    getPlayPauseIcon(item, playing, paused) {
        if (playing && globalThis.settings.get_boolean('enable-pause') && !globalThis.settings.get_boolean('safety-mode'))
            return 'media-playback-pause-symbolic';
        return 'fr.romainvigier.zap-play-symbolic';
    }

    /**
     * Format time for display.
     *
     * @param {ZapItem} item Item.
     * @param {number} position Position in nanoseconds.
     * @param {number} duration Duration in nanoseconds.
     * @returns {string} Formatted time.
     */
    getTimestamp(item, position, duration) {
        if (duration <= 0)
            return '';

        const format = time => {
            const totalSeconds = Math.floor(time / 1e9);
            const minutes = Math.floor(totalSeconds / 60);
            const seconds = totalSeconds % 60;
            return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        };

        return `${format(position)} / ${format(duration)}`;
    }

}
