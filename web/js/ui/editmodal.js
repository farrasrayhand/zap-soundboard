// SPDX-FileCopyrightText: 2026 Farras Rayhand <farrasrayhand@gmail.com>
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { state } from '../state.js';
import { collectionsService } from '../services/CollectionsService.js';
import { zapsService } from '../services/ZapsService.js';
import { createColorChooser, getColorChooserSelection, setColorChooserSelection } from './colorpicker.js';
import { formatTime } from './zapitem.js';

const NS_PER_S = 1e9;

let dialog, nameInput, hotkeyInput, groupSelect, startTimeInput, nextSoundSelect, gapInput;
let volumeInput, volumeLabel, loopToggle, colorChooser, collectionSelect;
let saveBtn, cancelBtn, deleteBtn;
let currentZapUuid = null;

export function init() {
    dialog = document.getElementById('edit-zap-dialog');
    nameInput = document.getElementById('edit-name');
    hotkeyInput = document.getElementById('edit-hotkey');
    groupSelect = document.getElementById('edit-group-select');
    startTimeInput = document.getElementById('edit-start-time');
    nextSoundSelect = document.getElementById('edit-next-sound');
    gapInput = document.getElementById('edit-gap');
    volumeInput = document.getElementById('edit-volume');
    volumeLabel = document.getElementById('edit-volume-label');
    loopToggle = document.getElementById('edit-loop');
    collectionSelect = document.getElementById('edit-collection');
    saveBtn = document.getElementById('edit-save');
    cancelBtn = document.getElementById('edit-cancel');
    deleteBtn = document.getElementById('edit-delete');

    const colorContainer = document.getElementById('edit-color-chooser');
    colorChooser = createColorChooser('gray');
    colorContainer.appendChild(colorChooser);

    volumeInput.addEventListener('input', () => {
        volumeLabel.textContent = volumeInput.value + '%';
    });

    // Hotkey capture
    hotkeyInput.addEventListener('keydown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.key === ' ') { hotkeyInput.value = 'Space'; return; }
        hotkeyInput.value = e.key;
    });

    cancelBtn.addEventListener('click', () => dialog.close());
    saveBtn.addEventListener('click', save);
    deleteBtn.addEventListener('click', remove);

    loopToggle.addEventListener('click', syncLoopUI);

    state.on('shortcut:edit-zap', ({ uuid }) => open(uuid));
    state.on('collection:selected', () => {
        if (dialog.open) populateDropdowns();
    });

    dialog.addEventListener('close', () => { currentZapUuid = null; });
}

function syncLoopUI() {
    if (currentZapUuid) {
        zapsService.updateProperty(currentZapUuid, 'loop', loopToggle.checked);
        if (loopToggle.checked) {
            zapsService.updateProperty(currentZapUuid, 'nextSoundUuid', '');
            zapsService.updateProperty(currentZapUuid, 'gap', 0);
        }
    }
    if (loopToggle.checked) {
        nextSoundSelect.value = '';
        nextSoundSelect.disabled = true;
        gapInput.value = '0';
        gapInput.disabled = true;
    } else {
        nextSoundSelect.disabled = false;
        gapInput.disabled = false;
    }
}

function open(uuid) {
    const zap = zapsService.find({ uuid });
    if (!zap) return;

    currentZapUuid = uuid;
    nameInput.value = zap.name;
    hotkeyInput.value = zap.hotkey || '';
    startTimeInput.value = formatTime(zap.startTime);
    gapInput.value = (zap.gap / NS_PER_S).toFixed(1);
    volumeInput.value = Math.round(zap.volume * 100);
    volumeLabel.textContent = Math.round(zap.volume * 100) + '%';
    loopToggle.checked = zap.loop;
    setColorChooserSelection(colorChooser, zap.color);

    populateDropdowns();
    groupSelect.value = zap.groupName || '';
    nextSoundSelect.value = zap.loop ? '' : (zap.nextSoundUuid || '');
    gapInput.value = zap.loop ? '0' : (zap.gap / NS_PER_S).toFixed(1);
    syncLoopUI();

    // Populate collection select
    collectionSelect.innerHTML = '';
    for (const col of collectionsService.items) {
        const opt = document.createElement('option');
        opt.value = col.uuid;
        opt.textContent = col.name;
        if (col.uuid === zap.collectionUuid) opt.selected = true;
        collectionSelect.appendChild(opt);
    }

    dialog.showModal();
}

function populateDropdowns() {
    const selectedUuid = document.getElementById('soundboard')?.dataset?.selectedCollection;
    if (!selectedUuid) return;

    groupSelect.innerHTML = '<option value="">No group</option>';
    const names = zapsService.getGroupNames(selectedUuid);
    for (const name of names) {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        groupSelect.appendChild(opt);
    }

    nextSoundSelect.innerHTML = '<option value="">None</option>';
    const zaps = zapsService.zaps.filter(z => z.collectionUuid === selectedUuid && z.uuid !== currentZapUuid);
    for (const z of zaps) {
        const opt = document.createElement('option');
        opt.value = z.uuid;
        opt.textContent = z.name;
        nextSoundSelect.appendChild(opt);
    }
}

async function save() {
    if (!currentZapUuid) return;

    const updates = [];

    if (nameInput.value.trim())
        updates.push({ prop: 'name', value: nameInput.value.trim() });

    updates.push({ prop: 'hotkey', value: hotkeyInput.value });
    updates.push({ prop: 'loop', value: loopToggle.checked });

    const zap = zapsService.find({ uuid: currentZapUuid });
    if (zap && zap.groupName !== groupSelect.value)
        updates.push({ prop: 'groupName', value: groupSelect.value });

    const startNs = parseStartTime(startTimeInput.value);
    if (startNs !== null)
        updates.push({ prop: 'startTime', value: startNs });

    updates.push({ prop: 'nextSoundUuid', value: loopToggle.checked ? '' : nextSoundSelect.value });
    updates.push({ prop: 'gap', value: loopToggle.checked ? 0 : Math.round(parseFloat(gapInput.value || '0') * NS_PER_S) });
    updates.push({ prop: 'volume', value: parseInt(volumeInput.value) / 100 });
    updates.push({ prop: 'color', value: getColorChooserSelection(colorChooser) });

    const newCollUuid = collectionSelect.value;
    if (zap && newCollUuid !== zap.collectionUuid)
        updates.push({ prop: 'collectionUuid', value: newCollUuid });

    for (const u of updates) {
        try {
            await zapsService.updateProperty(currentZapUuid, u.prop, u.value);
        } catch (e) {
            console.error(`Failed to update ${u.prop}:`, e);
        }
    }

    dialog.close();
}

async function remove() {
    if (!currentZapUuid) return;
    const zap = zapsService.find({ uuid: currentZapUuid });
    if (confirm(`Delete "${zap?.name || 'sound'}"?`)) {
        await zapsService.remove(currentZapUuid);
        dialog.close();
    }
}

function parseStartTime(str) {
    if (!str || !str.trim()) return 0;
    const parts = str.trim().split(':');
    let minutes = 0, seconds = 0, ms = 0;
    if (parts.length === 2) {
        minutes = parseInt(parts[0]) || 0;
        const secParts = parts[1].split('.');
        seconds = parseInt(secParts[0]) || 0;
        ms = parseInt((secParts[1] || '0').padEnd(3, '0')) || 0;
    } else if (parts.length === 1) {
        const secParts = parts[0].split('.');
        seconds = parseInt(secParts[0]) || 0;
        ms = parseInt((secParts[1] || '0').padEnd(3, '0')) || 0;
    }
    return (minutes * 60 + seconds) * NS_PER_S + ms * 1e6;
}
