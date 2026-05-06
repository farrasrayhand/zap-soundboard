// SPDX-FileCopyrightText: 2022 Romain Vigier <contact AT romainvigier.fr>
// SPDX-FileCopyrightText: 2026 Farras Rayhand <farrasrayhand@gmail.com>
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { state } from './state.js';
import { db } from './db.js';
import { settings } from './settings.js';

const NS_PER_S = 1e9;

class ActivePlayback {
    constructor(zap, sourceNode, gainNode, buffer, startWallTime, startOffset) {
        this.zap = zap;
        this.sourceNode = sourceNode;
        this.gainNode = gainNode;
        this.buffer = buffer;
        this.startWallTime = startWallTime;
        this.startOffset = startOffset;
    }
}

export class Player {
    constructor() {
        this._ctx = null;
        this._masterGain = null;
        this._active = new Map(); // uuid -> ActivePlayback
        this._progressRAF = null;
        this._fadeTimeouts = new Map();
        this._nextTimeouts = new Map();
        this._gapIntervals = new Map();
        this._bufferCache = new Map(); // fileId -> AudioBuffer
        this._readyFiles = new Set(); // fileId -> boolean (sync check for UI)
        this._loadingPromises = new Map(); // fileId -> Promise<AudioBuffer>
        this._pendingPlays = new Set(); // uuid -> boolean
    }

    get audioContext() {
        return this._ctx;
    }

    async _ensureContext() {
        if (!this._ctx) {
            this._ctx = new (window.AudioContext || window.webkitAudioContext)();
            this._masterGain = this._ctx.createGain();
            this._masterGain.gain.value = 1.0;
            this._masterGain.connect(this._ctx.destination);
        }
        if (this._ctx.state === 'suspended') {
            await this._ctx.resume();
        }
    }

    _reconstructBuffer(record) {
        const buffer = this._ctx.createBuffer(record.numberOfChannels, record.length, record.sampleRate);
        for (let c = 0; c < record.numberOfChannels; c++)
            buffer.copyToChannel(record.channels[c], c);
        return buffer;
    }

    get isPlaying() {
        return this._active.size > 0;
    }

    getPlayingZapUuids() {
        return Array.from(this._active.keys());
    }

    async play(zap) {
        if (this._pendingPlays.has(zap.uuid)) return;
        this._pendingPlays.add(zap.uuid);

        try {
            await this._ensureContext();

            const safetyMode = settings.getBoolean('safetyMode');
            const enablePause = settings.getBoolean('enablePause');

            // 1. Handle clicking the SAME zap
            if (this._active.has(zap.uuid)) {
                if (enablePause && !safetyMode) {
                    // Individual pause/resume
                    if (!zap.paused) {
                        this._pausePlayback(zap.uuid);
                    } else {
                        this._resumePlayback(zap.uuid);
                    }
                    return;
                } else {
                    // Restart behavior: stop first (silently to avoid UI reset before immediate play)
                    this.stop(zap.uuid, true);
                }
            }

            // 2. Handle clicking a DIFFERENT zap while something is playing
            if (this._active.size > 0) {
                if (safetyMode) {
                    // Safety Mode: Block playback (should be blocked by UI buttons too)
                    return;
                } else {
                    // Safety Mode OFF: Stop current sounds before playing the new one
                    this.stopAll();
                }
            }

            // 3. Start playback
            let buffer = this._bufferCache.get(zap.fileId);
            
            if (!buffer && zap.fileId) {
                // Check if it is currently being preloaded
                const loadingPromise = this._loadingPromises.get(zap.fileId);
                if (loadingPromise) {
                    state.emit('play:loading', { uuid: zap.uuid });
                    try {
                        buffer = await loadingPromise;
                    } catch (e) {
                        console.error(`Playback wait for preload failed for "${zap.name}":`, e);
                    }
                }
            }

            if (buffer) {
                // Instant start from RAM
                this._startSource(zap, buffer);
            } else {
                // Any async work (DB fetch or Decoding) needs a loading spinner
                state.emit('play:loading', { uuid: zap.uuid });

                try {
                    // Try to get from decoded cache (chunked DB)
                    // Pass this._ctx to reconstruct directly into AudioBuffer
                    buffer = await this._loadAndCache(zap);

                    if (!buffer) {
                        console.warn(`Audio file not found or failed to load for zap "${zap.name}"`);
                        state.emit('play:stopped', { uuid: zap.uuid });
                        return;
                    }

                    this._startSource(zap, buffer);
                } catch (e) {
                    console.error(`Failed to prepare audio for "${zap.name}":`, e);
                    state.emit('error', { message: `Could not play "${zap.name}".` });
                    state.emit('play:stopped', { uuid: zap.uuid });
                }
            }
        } finally {
            this._pendingPlays.delete(zap.uuid);
        }
    }

    /**
     * Unified loading logic with synchronization
     */
    async _loadAndCache(zap) {
        if (!zap.fileId) return null;
        if (this._bufferCache.has(zap.fileId)) return this._bufferCache.get(zap.fileId);

        // Check if already loading
        if (this._loadingPromises.has(zap.fileId)) {
            return await this._loadingPromises.get(zap.fileId);
        }

        const promise = (async () => {
            try {
                state.emit('preload:loading', { uuid: zap.uuid });

                // 1. Try DB cache
                let buffer = await db.getDecodedAudio(zap.fileId, this._ctx);
                
                if (!buffer) {
                    // 2. Decode from original blob
                    const blob = await db.getAudioBlob(zap.fileId);
                    if (!blob) return null;

                    const arrayBuffer = await blob.arrayBuffer();
                    buffer = await this._ctx.decodeAudioData(arrayBuffer);
                    
                    // Store to DB for next time
                    db.storeDecodedAudio(zap.fileId, buffer).catch(err => {
                        console.warn(`Failed to store decoded audio for "${zap.name}":`, err);
                    });
                }

                this._bufferCache.set(zap.fileId, buffer);
                this._readyFiles.add(zap.fileId);
                return buffer;
            } finally {
                this._loadingPromises.delete(zap.fileId);
                state.emit('preload:zap-done', { uuid: zap.uuid });
            }
        })();

        this._loadingPromises.set(zap.fileId, promise);
        return await promise;
    }

    _startSource(zap, buffer) {
        const sourceNode = this._ctx.createBufferSource();
        sourceNode.buffer = buffer;

        const gainNode = this._ctx.createGain();
        gainNode.gain.value = zap.volume;

        const startTimeSeconds = zap.startTimeSeconds;

        if (zap.loop) {
            sourceNode.loop = true;
            if (startTimeSeconds > 0) {
                sourceNode.loopStart = startTimeSeconds;
                sourceNode.loopEnd = buffer.duration;
            }
        }

        sourceNode.connect(gainNode);
        gainNode.connect(this._masterGain);

        sourceNode.onended = () => this._onEnded(zap.uuid);

        const now = this._ctx.currentTime;
        sourceNode.start(0, startTimeSeconds);

        const playback = new ActivePlayback(zap, sourceNode, gainNode, buffer, now, startTimeSeconds);
        this._active.set(zap.uuid, playback);

        zap.playing = true;
        zap.paused = false;
        zap.durationTime = buffer.duration * NS_PER_S;
        zap.positionTime = startTimeSeconds * NS_PER_S;

        this._startProgressTracking();
        state.emit('play:started', { uuid: zap.uuid });
    }

    _pausePlayback(uuid) {
        const pb = this._active.get(uuid);
        if (!pb || pb.zap.paused) return;

        const elapsed = this._ctx.currentTime - pb.startWallTime;
        pb.startOffset += elapsed;

        try {
            pb.sourceNode.onended = null;
            pb.sourceNode.stop();
        } catch (e) {}

        pb.zap.playing = false;
        pb.zap.paused = true;
        state.emit('play:paused', { uuid });
    }

    _resumePlayback(uuid) {
        const pb = this._active.get(uuid);
        if (!pb || !pb.zap.paused) return;

        const sourceNode = this._ctx.createBufferSource();
        sourceNode.buffer = pb.buffer;
        
        const start = pb.zap.startTimeSeconds;
        const dur = pb.buffer.duration;

        if (pb.zap.loop) {
            sourceNode.loop = true;
            if (start > 0) {
                sourceNode.loopStart = start;
                sourceNode.loopEnd = dur;
            }
        }

        sourceNode.connect(pb.gainNode);
        sourceNode.onended = () => this._onEnded(uuid);

        // Calculate correct resume offset considering loops
        let offset;
        if (pb.zap.loop) {
            const loopLen = dur - start;
            offset = loopLen > 0 ? (start + ((pb.startOffset - start) % loopLen)) : (pb.startOffset % dur);
        } else {
            offset = Math.min(pb.startOffset, dur);
        }

        sourceNode.start(0, offset);

        pb.sourceNode = sourceNode;
        pb.startWallTime = this._ctx.currentTime;
        pb.zap.playing = true;
        pb.zap.paused = false;

        state.emit('play:resumed', { uuid });
        this._startProgressTracking();
    }

    stop(uuid, silent = false) {
        const pb = this._active.get(uuid);
        if (!pb) return;

        const fileId = pb.zap.fileId;

        // Clean up
        try { pb.sourceNode.onended = null; pb.sourceNode.stop(); } catch (e) { /* already stopped */ }
        pb.sourceNode.disconnect();
        pb.gainNode.disconnect();
        this._clearFade(uuid);
        this._clearGap(uuid);
        this._clearNextTimeout(uuid);
        this._active.delete(uuid);

        pb.zap.playing = false;
        pb.zap.paused = false;
        pb.zap.progress = 0;
        pb.zap.positionTime = 0;
        pb.zap.durationTime = 0;

        if (this._active.size === 0)
            this._stopProgressTracking();

        if (!silent) {
            state.emit('play:stopped', { uuid });
        }
    }

    stopAll() {
        const uuids = Array.from(this._active.keys());
        for (const uuid of uuids) {
            this.stop(uuid);
        }
        // Force clear in case of edge cases
        this._active.clear();
        this._stopProgressTracking();
    }

    fadeOut(uuid = null, duration = null) {
        if (duration === null)
            duration = settings.getDouble('fadeoutDuration');

        const uuids = uuid ? [uuid] : Array.from(this._active.keys());
        for (const id of uuids) {
            const pb = this._active.get(id);
            if (!pb) continue;

            const gainNode = pb.gainNode;
            const currentGain = gainNode.gain.value;
            gainNode.gain.cancelScheduledValues(this._ctx.currentTime);
            gainNode.gain.setValueAtTime(currentGain, this._ctx.currentTime);
            gainNode.gain.linearRampToValueAtTime(0, this._ctx.currentTime + duration);

            state.emit('play:fading', { uuid: id });

            // Schedule stop after fade completes
            const timeoutId = setTimeout(() => {
                this.stop(id);
                this._fadeTimeouts.delete(id);
            }, duration * 1000 + 100);

            this._fadeTimeouts.set(id, timeoutId);
        }
    }

    _onEnded(uuid) {
        const pb = this._active.get(uuid);
        if (!pb) return;

        const zap = pb.zap;

        // Loop is handled natively by sourceNode.loop, so this shouldn't fire for loops
        // But if loopStart/loopEnd is not supported, fallback:
        if (zap.loop) {
            // Manual loop restart
            pb.sourceNode.disconnect();
            pb.gainNode.disconnect();
            this._active.delete(uuid);
            this.play(zap);
            return;
        }

        // Next sound chaining
        const nextUuid = zap.nextSoundUuid;
        if (nextUuid) {
            this._clearNextTimeout(uuid);
            pb.sourceNode.disconnect();
            pb.gainNode.disconnect();
            this._active.delete(uuid);

            const gapNs = zap.gap || 0;
            if (gapNs > 0) {
                this._startGapCountdown(uuid, nextUuid, zap, gapNs);
            } else {
                zap.playing = false;
                zap.progress = 0;
                zap.positionTime = 0;
                zap.durationTime = 0;
                state.emit('play:stopped', { uuid });
                // Find next zap and play it
                const nextZap = this._findZap(nextUuid);
                if (nextZap)
                    this.play(nextZap);
            }
            return;
        }

        // Natural end
        this.stop(uuid);
    }

    _findZap(uuid) {
        // Look up in zapsService (imported dynamically to avoid circular deps)
        // Use state to request lookup
        return null; // Will be set by the service
    }

    _startGapCountdown(fromUuid, nextUuid, currentZap, gapNs) {
        const gapMs = Math.round(gapNs / 1e6);
        const endTime = performance.now() + gapMs;

        // Keep current zap in "playing" state to show countdown
        currentZap.playing = true;
        currentZap.durationTime = gapNs;
        currentZap.progress = 0;
        currentZap.positionTime = gapNs;

        state.emit('play:gap-countdown', { fromUuid, nextUuid, remaining: gapNs });

        const updateInterval = setInterval(() => {
            const remaining = Math.max(0, endTime - performance.now());
            currentZap.positionTime = remaining * 1e6;
            currentZap.progress = remaining > 0 ? 1 - (remaining / gapMs) : 1;

            state.emit('play:gap-countdown', { fromUuid, nextUuid, remaining: remaining * 1e6 });

            if (remaining <= 0) {
                clearInterval(updateInterval);
                this._gapIntervals.delete(fromUuid);

                currentZap.playing = false;
                currentZap.progress = 0;
                currentZap.positionTime = 0;
                currentZap.durationTime = 0;
                state.emit('play:stopped', { uuid: fromUuid });

                const nextZap = this._findZap(nextUuid);
                if (nextZap)
                    this.play(nextZap);
            }
        }, 100);

        this._gapIntervals.set(fromUuid, updateInterval);
    }

    _clearGap(uuid) {
        const interval = this._gapIntervals.get(uuid);
        if (interval) {
            clearInterval(interval);
            this._gapIntervals.delete(uuid);
        }
    }

    _clearFade(uuid) {
        const timeout = this._fadeTimeouts.get(uuid);
        if (timeout) {
            clearTimeout(timeout);
            this._fadeTimeouts.delete(uuid);
        }
    }

    _clearNextTimeout(uuid) {
        const timeout = this._nextTimeouts.get(uuid);
        if (timeout) {
            clearTimeout(timeout);
            this._nextTimeouts.delete(uuid);
        }
    }

    _startProgressTracking() {
        if (this._progressRAF) return;

        const update = () => {
            let anyPlaying = false;
            for (const [uuid, pb] of this._active) {
                if (pb.zap.playing && !pb.zap.paused) {
                    anyPlaying = true;
                    const elapsed = this._ctx.currentTime - pb.startWallTime + pb.startOffset;
                    const dur = pb.buffer.duration;
                    const start = pb.zap.startTimeSeconds;
                    
                    let currentPos;
                    if (pb.sourceNode.loop) {
                        const loopLen = dur - start;
                        currentPos = loopLen > 0 ? (start + ((elapsed - start) % loopLen)) : (elapsed % dur);
                    } else {
                        currentPos = Math.min(elapsed, dur);
                    }
                    
                    pb.zap.positionTime = currentPos * NS_PER_S;
                    pb.zap.durationTime = dur * NS_PER_S;
                    pb.zap.progress = dur > 0 ? currentPos / dur : 0;
                    state.emit('play:progress', {
                        uuid,
                        position: pb.zap.positionTime,
                        duration: pb.zap.durationTime,
                        progress: pb.zap.progress,
                    });
                }
            }
            if (anyPlaying)
                this._progressRAF = requestAnimationFrame(update);
            else
                this._stopProgressTracking();
        };
        this._progressRAF = requestAnimationFrame(update);
    }

    _stopProgressTracking() {
        if (this._progressRAF) {
            cancelAnimationFrame(this._progressRAF);
            this._progressRAF = null;
        }
    }

    async preloadAll(zaps) {
        if (zaps.length === 0) return;
        console.log(`Player: Starting sequential preload for ${zaps.length} sounds`);

        // Initial sync of ready files from DB for UI responsiveness
        try {
            const allMetadata = await db.getAll('decodedAudio');
            for (const m of allMetadata) this._readyFiles.add(m.fileId);
        } catch (e) {
            console.warn('Player: Failed to sync ready files from DB', e);
        }

        const total = zaps.length;
        this._ensureContext();
        
        if (this._ctx.state === 'suspended') {
            this._ctx.resume().catch(() => {});
        }

        state.emit('preload:start', { total });
        let loaded = 0;

        for (const zap of zaps) {
            await this._preloadOne(zap);
            loaded++;
            const pct = Math.round((loaded / total) * 100);
            state.emit('preload:progress', { loaded, total, pct, name: zap.name });
        }
        
        state.emit('preload:done', { total });
    }

    async _preloadOne(zap) {
        if (!zap.fileId) {
            state.emit('preload:zap-done', { uuid: zap.uuid });
            return;
        }

        try {
            await this._loadAndCache(zap);
            state.emit('preload:zap-done', { uuid: zap.uuid });
        } catch (e) {
            console.error(`Preload failed for "${zap.name}":`, e);
            state.emit('preload:zap-done', { uuid: zap.uuid });
        }
    }

    isPreloaded(zap) {
        return this._bufferCache.has(zap.fileId);
    }

    // Synchronous check for UI (powered by _readyFiles set)
    isReady(zap) {
        return this._bufferCache.has(zap.fileId) || this._readyFiles.has(zap.fileId);
    }

    isActive(uuid) {
        return this._active.has(uuid);
    }

    // Called by app.js after zapsService is loaded
    setFindZap(fn) {
        this._findZap = fn;
    }

    clearCache(fileId) {
        if (fileId)
            this._bufferCache.delete(fileId);
        else
            this._bufferCache.clear();
    }

    /**
     * Check if the browser can decode a given audio blob.
     * Returns { ok: true, mimeType } or { ok: false, message }.
     */
    static async canDecode(blob) {
        try {
            const ctx = new AudioContext();
            const buf = await blob.arrayBuffer();
            await ctx.decodeAudioData(buf);
            ctx.close();
            return { ok: true, mimeType: blob.type };
        } catch (e) {
            const ext = blob.name?.split('.').pop()?.toLowerCase();
            const hints = {
                ogg: 'Ogg Vorbis is not supported in Safari. Try converting to MP3 or WAV.',
                opus: 'Opus is not supported in Safari. Try converting to MP3.',
                flac: 'FLAC is not supported in Safari. Try converting to WAV.',
                wma: 'WMA is not supported in most browsers. Try converting to MP3.',
            };
            return {
                ok: false,
                message: hints[ext] || `This browser cannot play "${blob.name || 'this file'}". Try converting to MP3 or WAV.`,
            };
        }
    }
}

export const player = new Player();
