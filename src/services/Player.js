// SPDX-FileCopyrightText: 2022 Romain Vigier <contact AT romainvigier.fr>
//
// SPDX-License-Identifier: GPL-3.0-or-later

import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gst from 'gi://Gst';
import GstAudio from 'gi://GstAudio';
import GstController from 'gi://GstController';

import { Service } from './Service.js';

import { Zap } from '../classes/Zap.js';


/**
 * The Player plays Zaps.
 *
 * Use the `play()` method to play a Zap.
 */
export class Player extends Service {

    /** @type {Gst.Bin} */
    #audioSink;
    /** @type {Gst.Element} */
    #playbin;
    /** @type {Gst.Element} */
    #volumeElement;
    /** @type {GstController.InterpolationControlSource} */
    #fadeControlSource;
    /** @type {Gst.Bus} */
    #bus;
    /** @type {?number} */
    #fadeTimeout = null;
    /** @type {?number} */
    #progressTimeout = null;
    /** @type {?number} */
    #pendingSeek = null;
    /** @type {?number} */
    #nextTimeout = null;
    /** @type {?number} */
    #gapStartTime = null;
    /** @type {?string} */
    #gapNextUuid = null;
    /** @type {number[]} */
    #connections = [];

    static {
        GObject.registerClass({
            GTypeName: 'ZapPlayer',
            Properties: {
                zap: GObject.ParamSpec.object('zap', 'Zap', 'Zap', GObject.ParamFlags.READWRITE, Zap),
            },
            Signals: {
                'play-started': { param_types: [GObject.TYPE_STRING] },
                'play-stopped': { param_types: [] },
            },
        }, this);
    }

    /**
     * @param {object} params Parameter object.
     * @param {Zap} params.zap The Zap to play.
     */
    constructor({ zap = null, ...params } = {}) {
        console.debug('Initializing Player...');
        super(params);

        /**
         * The currently handled Zap.
         *
         * @type {Zap}
         */
        this.zap = zap;

        this.#setupAudioSink();
        this.#setupPlayBin();
        this.#setupFadeControlSource();

        this.#bus = this.#playbin.get_bus();
        console.debug('Player initialized.');
    }

    /**
     * Setup the audio sink.
     */
    #setupAudioSink() {
        this.#audioSink = new Gst.Bin({ name: 'audio-sink' });
        this.#volumeElement = Gst.ElementFactory.make('volume', 'fadevolume');
        const audioConvert = Gst.ElementFactory.make('audioconvert', 'audioconvert');
        const autoAudioSink = Gst.ElementFactory.make('autoaudiosink', 'autoaudiosink');

        this.#audioSink.add(this.#volumeElement);
        this.#audioSink.add(audioConvert);
        this.#audioSink.add(autoAudioSink);

        this.#volumeElement.link(audioConvert);
        audioConvert.link(autoAudioSink);

        const ghostPad = Gst.GhostPad.new('sink', this.#volumeElement.get_static_pad('sink'));
        ghostPad.set_active(true);
        this.#audioSink.add_pad(ghostPad);
    }

    /**
     * Setup the play bin.
     */
    #setupPlayBin() {
        this.#playbin = Gst.ElementFactory.make('playbin', 'playbin');

        this.#playbin.audioSink = this.#audioSink;
        this.#playbin.textSink = Gst.ElementFactory.make('fakesink', 'text-sink');
        this.#playbin.videoSink = Gst.ElementFactory.make('fakesink', 'video-sink');
    }

    /**
     * Setup the fade control source.
     */
    #setupFadeControlSource() {
        this.#fadeControlSource = new GstController.InterpolationControlSource({
            mode: GstController.InterpolationMode.LINEAR,
        });
        const fadeControlBinding = new GstController.DirectControlBinding({
            object: this.#volumeElement,
            name: 'volume',
            absolute: true,
            controlSource: this.#fadeControlSource,
        });
        this.#volumeElement.add_control_binding(fadeControlBinding);
    }

    /**
     * If the player is playing.
     *
     * @returns {boolean} Playing state.
     */
    get playing() {
        return this.zap ? this.zap.playing : false;
    }

    /**
     * Start the player.
     */
    start() {
        console.debug('Starting Player...');

        this.#bus.add_signal_watch();
        this.#bus.connect('message::eos', () => this.#onPlayEnded());
        this.#bus.connect('message::async-done', () => this.#onAsyncDone());
        this.#bus.connect('message::warning', (bus, message) => console.warn(message.parse_warning()[0].toString()));
        this.#bus.connect('message::error', (bus, message) => console.error(message.parse_error().toString()));

        this.#playbin.set_state(Gst.State.READY);

        console.debug('Player started.');
    }

    /**
     * Exit the player.
     */
    exit() {
        console.debug('Exiting Player...');
        this.#stopUpdatingProgress();
        this.#bus.remove_signal_watch();
        this.#playbin.set_state(Gst.State.NULL);
        console.debug('Player exited.');
    }

    /**
     * Play the given Zap.
     *
     * If the Zap is already playing, play it again from the beginning.
     *
     * @param {Zap} zap The Zap to play.
     */
    play(zap) {
        // Toggle pause if it's the same zap and enable-pause is on
        const safetyMode = globalThis.settings.get_boolean('safety-mode');
        if (globalThis.settings.get_boolean('enable-pause') && zap === this.zap && !safetyMode) {
            if (this.playing) {
                this.#playbin.set_state(Gst.State.PAUSED);
                this.zap.paused = true;
                this.zap.playing = false;
                this.#stopUpdatingProgress();
                return;
            } else if (zap.paused) {
                this.#playbin.set_state(Gst.State.PLAYING);
                this.zap.paused = false;
                this.zap.playing = true;
                this.#updateProgress();
                return;
            }
        }

        if (globalThis.settings.get_boolean('safety-mode') && this.playing) {
            console.debug('Safety Mode: Playback blocked because a sound is already playing.');
            return;
        }

        console.debug(`Playing Zap "${zap.name}".`);

        if (zap === this.zap && zap.playing) {
            this.#playbin.seek_simple(Gst.Format.TIME, Gst.SeekFlags.FLUSH, zap.startTime || 0);
            return;
        }

        this.stop();

        this.zap = zap;
        this.#connectToZap();
        this.#syncVolume();
        this.zap.playing = true;
        this.zap.paused = false;
        this.#playbin.uri = zap.file.get_uri();
        this.#playbin.set_state(Gst.State.PLAYING);

        if (zap.startTime > 0)
            this.#pendingSeek = zap.startTime;

        this.#updateProgress();
        this.emit('play-started', zap.uuid);
    }

    /**
     * Stop playing the currently playing Zap, if any.
     */
    stop() {
        if (!this.zap)
            return;

        console.debug(`Stop playing Zap "${this.zap.name}".`);

        this.#stopUpdatingProgress();
        this.#playbin.set_state(Gst.State.READY);
        this.#fadeControlSource.unset_all();
        this.#volumeElement.volume = 1;
        this.#pendingSeek = null;
        this.#clearNextTimeout();
        this.#clearGap();

        if (this.#fadeTimeout) {
            GLib.source_remove(this.#fadeTimeout);
            this.#fadeTimeout = null;
        }

        this.#disconnectFromZap();
        this.zap.playing = false;
        this.zap.paused = false;
        this.zap.progress = 0;
        this.zap.positionTime = 0;
        this.zap.durationTime = 0;
        this.zap = null;
        this.emit('play-stopped');
    }

    /**
     * Fade out and stop the currently playing zap, if any.
     *
     * @param {number} length Length of the fade out, in seconds.
     */
    fadeOut(length = null) {
        if (!this.zap)
            return;

        if (length === null)
            length = globalThis.settings.get_double('fadeout-duration');

        console.debug(`Start fading out (${length}s)...`);

        const [positionOk, position] = this.#playbin.query_position(Gst.Format.TIME);
        const [durationOk, duration] = this.#playbin.query_duration(Gst.Format.TIME);
        const endPosition = Math.min(position + length * Gst.SECOND, duration);
        const clampedLength = (endPosition - position) / Gst.SECOND;

        this.#fadeControlSource.set(position, this.#volumeElement.volume);
        this.#fadeControlSource.set(endPosition, 0.0);

        this.#fadeTimeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, clampedLength * 1000, () => {
            console.debug('Done fading out.');
            this.stop();
            this.#fadeTimeout = null;
            return GLib.SOURCE_REMOVE;
        });
    }

    /**
     * Connect to the zap signals.
     */
    #connectToZap() {
        this.#connections.push(this.zap.connect('notify::volume', zap => {
            this.#syncVolume();
        }));
    }

    /**
     * Disconnect from the zap signals.
     */
    #disconnectFromZap() {
        this.#connections.forEach(connection => this.zap.disconnect(connection));
        this.#connections = [];
    }

    /**
     * Start regularly updating the zap's progress.
     */
    #updateProgress() {
        this.#progressTimeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 10, () => {
            const [positionOk, position] = this.#playbin.query_position(Gst.Format.TIME);
            const [durationOk, duration] = this.#playbin.query_duration(Gst.Format.TIME);
            if (positionOk && durationOk) {
                this.zap.progress = position / duration;
                this.zap.positionTime = position;
                this.zap.durationTime = duration;
            }
            return GLib.SOURCE_CONTINUE;
        });
    }

    /**
     * Stop updating the zap's progress.
     */
    #stopUpdatingProgress() {
        if (this.#progressTimeout) {
            GLib.source_remove(this.#progressTimeout);
            this.#progressTimeout = null;
        }
    }

    /**
     * Sync the volume element to the zap's volume.
     */
    #syncVolume() {
        const linearVolume = GstAudio.StreamVolume.convert_volume(GstAudio.StreamVolumeFormat.CUBIC, GstAudio.StreamVolumeFormat.LINEAR, this.zap.volume);
        this.#volumeElement.volume = linearVolume;
    }

    /**
     * Callback function when the Zap finishes playing.
     */
    #onPlayEnded() {
        if (this.zap.loop) {
            this.#playbin.seek_simple(Gst.Format.TIME, Gst.SeekFlags.FLUSH, this.zap.startTime || 0);
            return;
        }

        const nextUuid = this.zap.nextSoundUuid;
        const gap = this.zap.gap || 0;

        if (nextUuid)
            this.#transitionToNext(nextUuid, gap);
        else
            this.stop();
    }

    /**
     * Transition to the next sound after the configured gap.
     *
     * @param {string} nextUuid UUID of the next zap to play.
     * @param {number} gapNs Gap in nanoseconds.
     */
    #transitionToNext(nextUuid, gapNs) {
        this.#stopUpdatingProgress();

        let nextZap;
        try {
            nextZap = globalThis.zaps.find({ uuid: nextUuid });
        } catch (e) {
            console.warn('Next sound not found, stopping.');
            this.stop();
            return;
        }

        this.#playbin.set_state(Gst.State.READY);
        this.#disconnectFromZap();

        const gapMs = Math.round(gapNs / 1e6);
        if (gapMs > 0) {
            this.#gapStartTime = Date.now();
            this.#gapNextUuid = nextUuid;
            this.zap.progress = 0;
            this.zap.positionTime = gapMs * 1e6;
            this.zap.durationTime = gapMs * 1e6;
            this.zap.playing = true;
            this.#updateGapCountdown();
        } else {
            this.#playbin.set_state(Gst.State.READY);
            this.zap.playing = false;
            this.zap.progress = 0;
            this.zap.positionTime = 0;
            this.zap.durationTime = 0;
            this.emit('play-stopped');
            this.zap = null;
            GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
                this.play(nextZap);
                return GLib.SOURCE_REMOVE;
            });
        }
    }

    /**
     * Update the gap countdown progress.
     */
    #updateGapCountdown() {
        if (this.#gapStartTime === null)
            return;
        const elapsed = Date.now() - this.#gapStartTime;
        const gapMs = Math.round((this.zap ? this.zap.durationTime : 0) / 1e6);
        const remaining = Math.max(0, gapMs - elapsed);
        if (this.zap) {
            this.zap.positionTime = remaining * 1e6;
            this.zap.progress = elapsed / (gapMs || 1);
        }
        if (remaining > 0 && this.zap) {
            this.#nextTimeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => {
                this.#nextTimeout = null;
                this.#updateGapCountdown();
                return GLib.SOURCE_REMOVE;
            });
        } else {
            const pendingUuid = this.#gapNextUuid;
            this.#clearGap();
            this.zap.playing = false;
            this.zap.progress = 0;
            this.zap.positionTime = 0;
            this.zap.durationTime = 0;
            this.emit('play-stopped');
            this.zap = null;
            GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
                try {
                    const nextZap = globalThis.zaps.find({ uuid: pendingUuid });
                    this.play(nextZap);
                } catch (e) {
                    console.warn('Next sound not found.');
                }
                return GLib.SOURCE_REMOVE;
            });
        }
    }

    /**
     * Clear the gap countdown if active.
     */
    #clearGap() {
        this.#gapStartTime = null;
        this.#gapNextUuid = null;
    }

    /**
     * Clear the next sound timeout if active.
     */
    #clearNextTimeout() {
        if (this.#nextTimeout) {
            GLib.source_remove(this.#nextTimeout);
            this.#nextTimeout = null;
        }
    }

    /**
     * Callback function when a state change completes.
     * Used to perform a pending seek after the pipeline is ready.
     */
    #onAsyncDone() {
        if (this.#pendingSeek !== null) {
            this.#playbin.seek_simple(Gst.Format.TIME, Gst.SeekFlags.FLUSH, this.#pendingSeek);
            this.#pendingSeek = null;
        }
    }

}
