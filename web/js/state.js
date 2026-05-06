// SPDX-FileCopyrightText: 2026 Farras Rayhand <farrasrayhand@gmail.com>
//
// SPDX-License-Identifier: GPL-3.0-or-later

class State {
    constructor() {
        this._listeners = new Map();
    }

    on(event, callback) {
        if (!this._listeners.has(event))
            this._listeners.set(event, new Set());
        this._listeners.get(event).add(callback);
        return () => this._listeners.get(event)?.delete(callback);
    }

    off(event, callback) {
        this._listeners.get(event)?.delete(callback);
    }

    emit(event, data = {}) {
        const listeners = this._listeners.get(event);
        if (!listeners) return;
        for (const cb of listeners) {
            try { cb(data); } catch (e) { console.error(`State handler error [${event}]:`, e); }
        }
    }

    once(event, callback) {
        const off = this.on(event, data => {
            off();
            callback(data);
        });
    }
}

export const state = new State();
