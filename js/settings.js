// SPDX-FileCopyrightText: 2026 Farras Rayhand <farrasrayhand@gmail.com>
//
// SPDX-License-Identifier: GPL-3.0-or-later

const DEFAULTS = {
    safetyMode: false,
    hideStopButton: false,
    enablePause: false,
    fadeoutDuration: 1.0,
    stopHotkey: '',
    fadeoutHotkey: '',
    lastSelectedCollection: '',
    theme: 'system',
};

const PREFIX = 'zap.';

export const settings = {
    get(key) {
        const raw = localStorage.getItem(PREFIX + key);
        if (raw === null || raw === undefined)
            return DEFAULTS[key];
        try { return JSON.parse(raw); } catch { return raw; }
    },

    set(key, value) {
        localStorage.setItem(PREFIX + key, JSON.stringify(value));
    },

    getBoolean(key) {
        const val = this.get(key);
        return typeof val === 'boolean' ? val : !!val;
    },

    getDouble(key) {
        const val = this.get(key);
        return typeof val === 'number' ? val : parseFloat(val) || DEFAULTS[key] || 0;
    },

    getString(key) {
        const val = this.get(key);
        return typeof val === 'string' ? val : String(val ?? DEFAULTS[key] ?? '');
    },

    getUint(key) {
        const val = this.get(key);
        return typeof val === 'number' ? Math.max(0, Math.floor(val)) : (parseInt(val) || DEFAULTS[key] || 0);
    },

    getAll() {
        const result = {};
        for (const key of Object.keys(DEFAULTS))
            result[key] = this.get(key);
        return result;
    },

    reset(key) {
        localStorage.removeItem(PREFIX + key);
    },
};
