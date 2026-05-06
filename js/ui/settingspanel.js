// SPDX-FileCopyrightText: 2026 Farras Rayhand <farrasrayhand@gmail.com>
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { state } from '../state.js';
import { settings } from '../settings.js';
import { player } from '../player.js';

let dialog, safetyMode, hideStop, enablePause, fadeoutDuration, fadeoutValue;
let stopHotkey, fadeoutHotkey, themeSelect, saveBtn, cancelBtn;

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
    saveBtn = document.getElementById('pref-save');
    cancelBtn = document.getElementById('pref-cancel');

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
    dialog.showModal();
}

function save() {
    const isSafetyEnabled = safetyMode.checked;
    settings.set('safetyMode', isSafetyEnabled);
    settings.set('hideStopButton', hideStop.checked);
    settings.set('enablePause', isSafetyEnabled ? false : enablePause.checked);
    settings.set('fadeoutDuration', parseFloat(fadeoutDuration.value));
    settings.set('stopHotkey', stopHotkey.value);
    settings.set('fadeoutHotkey', fadeoutHotkey.value);
    settings.set('theme', themeSelect.value);

    // If safety mode is turned on, stop everything to avoid "paused state" deadlock
    if (isSafetyEnabled) {
        player.stopAll();
    }

    // Apply theme immediately
    const resolved = themeSelect.value === 'system'
        ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        : themeSelect.value;
    document.documentElement.dataset.theme = resolved;

    state.emit('settings:changed', {});
    dialog.close();
}
