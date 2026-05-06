// SPDX-FileCopyrightText: 2026 Farras Rayhand <farrasrayhand@gmail.com>
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { state } from '../state.js';
import { settings } from '../settings.js';
import { player } from '../player.js';

let dialog, safetyMode, hideStop, enablePause, fadeoutDuration, fadeoutValue;
let stopHotkey, fadeoutHotkey, themeSelect, perfSelect, saveBtn, cancelBtn, pruneBtn, clearCacheBtn;

export function init() {
    dialog = document.getElementById('preferences-dialog');
    safetyMode = document.getElementById('pref-safety-mode');
    hideStop = document.getElementById('pref-hide-stop');
    enablePause = document.getElementById('pref-enable-pause');
    fadeoutDuration = document.getElementById('pref-fadeout-duration');
    fadeoutValue = document.getElementById('pref-fadeout-value');
    stopHotkey = document.getElementById('pref-stop-hotkey');
    fadeoutHotkey = document.getElementById('pref-fadeout-hotkey');
    themeSelect = document.getElementById('pref-theme');
    perfSelect = document.getElementById('pref-performance');
    saveBtn = document.getElementById('pref-save');
    cancelBtn = document.getElementById('pref-cancel');
    pruneBtn = document.getElementById('pref-prune');
    clearCacheBtn = document.getElementById('pref-clear-cache');

    fadeoutDuration.addEventListener('input', () => {
        fadeoutValue.textContent = parseFloat(fadeoutDuration.value).toFixed(1) + 's';
    });

    // Hotkey capture
    [stopHotkey, fadeoutHotkey].forEach(input => {
        input.addEventListener('keydown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.key === ' ') { input.value = 'Space'; return; }
            input.value = e.key;
        });
    });

    cancelBtn.addEventListener('click', () => dialog.close());
    saveBtn.addEventListener('click', save);

    pruneBtn.addEventListener('click', () => {
        state.emit('shortcut:prune', {});
    });

    clearCacheBtn.addEventListener('click', async () => {
        if (confirm('Clear all decoded audio cache?\n\nThis will free up space, but sounds will need to be re-decoded the next time they are played.')) {
            state.emit('shortcut:clear-cache', {});
        }
    });

    safetyMode.addEventListener('click', () => {
        if (safetyMode.checked) {
            enablePause.checked = false;
            enablePause.disabled = true;
        } else {
            enablePause.disabled = false;
        }
    });

    state.on('shortcut:preferences', () => open());
}

function open() {
    safetyMode.checked = settings.getBoolean('safetyMode');
    hideStop.checked = settings.getBoolean('hideStopButton');
    const safetyOn = settings.getBoolean('safetyMode');
    enablePause.checked = safetyOn ? false : settings.getBoolean('enablePause');
    enablePause.disabled = safetyOn;
    fadeoutDuration.value = settings.getDouble('fadeoutDuration');
    fadeoutValue.textContent = settings.getDouble('fadeoutDuration').toFixed(1) + 's';
    stopHotkey.value = settings.getString('stopHotkey');
    fadeoutHotkey.value = settings.getString('fadeoutHotkey');
    themeSelect.value = settings.get('theme');
    perfSelect.value = settings.get('performanceMode');
    dialog.showModal();
}

function save() {
    const isSafetyEnabled = safetyMode.checked;
    const isPauseEnabled = enablePause.checked;

    settings.set('safetyMode', isSafetyEnabled);
    settings.set('hideStopButton', hideStop.checked);
    settings.set('enablePause', isSafetyEnabled ? false : isPauseEnabled);
    settings.set('fadeoutDuration', parseFloat(fadeoutDuration.value));
    settings.set('stopHotkey', stopHotkey.value);
    settings.set('fadeoutHotkey', fadeoutHotkey.value);
    settings.set('theme', themeSelect.value);
    settings.set('performanceMode', perfSelect.value);

    // Apply theme immediately
    const resolved = themeSelect.value === 'system'
        ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        : themeSelect.value;
    document.documentElement.dataset.theme = resolved;

    state.emit('settings:changed', {});
    dialog.close();
}
