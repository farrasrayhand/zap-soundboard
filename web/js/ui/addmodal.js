// SPDX-FileCopyrightText: 2026 Farras Rayhand <farrasrayhand@gmail.com>
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { state } from '../state.js';
import { collectionsService } from '../services/CollectionsService.js';
import { zapsService } from '../services/ZapsService.js';
import { Player } from '../player.js';
import { createColorChooser, getColorChooserSelection } from './colorpicker.js';
import { show as showToast } from './toast.js';

let dialog, fileInput, fileName, fileBtn, nameInput, groupSelect, colorChooser, confirmBtn, cancelBtn;
let pendingFile = null;

export function init() {
    dialog = document.getElementById('add-zap-dialog');
    fileInput = document.getElementById('add-file-input');
    fileName = document.getElementById('add-file-name');
    fileBtn = document.getElementById('add-file-btn');
    nameInput = document.getElementById('add-name');
    groupSelect = document.getElementById('add-group');
    confirmBtn = document.getElementById('add-confirm');
    cancelBtn = document.getElementById('add-cancel');

    const colorContainer = document.getElementById('add-color-chooser');
    colorChooser = createColorChooser('gray');
    colorContainer.appendChild(colorChooser);

    fileBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
        if (fileInput.files.length > 0) {
            pendingFile = fileInput.files[0];
            fileName.textContent = pendingFile.name;
            if (!nameInput.value)
                nameInput.value = pendingFile.name.replace(/\.[^.]+$/, '');
            updateConfirmState();
        }
    });

    nameInput.addEventListener('input', updateConfirmState);

    cancelBtn.addEventListener('click', () => dialog.close());
    confirmBtn.addEventListener('click', addZap);

    state.on('shortcut:add-zap', () => open());
    state.on('addzap:file', ({ file }) => {
        pendingFile = file;
        fileName.textContent = file.name;
        if (!nameInput.value)
            nameInput.value = file.name.replace(/\.[^.]+$/, '');
        updateConfirmState();
        open();
    });

    state.on('collection:selected', () => populateGroups());

    dialog.addEventListener('close', reset);
}

function open() {
    populateGroups();
    dialog.showModal();
}

function populateGroups() {
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
}

function updateConfirmState() {
    confirmBtn.disabled = !pendingFile || !nameInput.value.trim();
}

async function addZap() {
    if (!pendingFile || !nameInput.value.trim()) return;

    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Checking...';

    const ctx = new AudioContext();
    let audioBuffer;
    try {
        const buf = await pendingFile.arrayBuffer();
        audioBuffer = await ctx.decodeAudioData(buf);
    } catch (e) {
        showToast(`Format not supported: ${pendingFile.name}`, 5000);
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Add';
        ctx.close();
        return;
    }
    ctx.close();

    // Encode as WAV for universal compatibility
    confirmBtn.textContent = 'Converting...';
    const wavBlob = audioBufferToWav(audioBuffer);

    const selectedUuid = document.getElementById('soundboard')?.dataset?.selectedCollection;
    if (!selectedUuid) {
        const col = collectionsService.items[0];
        if (!col) return;
        state.emit('collection:selected', { uuid: col.uuid });
    }

    const collUuid = document.getElementById('soundboard')?.dataset?.selectedCollection;

    try {
        confirmBtn.textContent = 'Adding...';
        await zapsService.add({
            name: nameInput.value.trim(),
            collection: collUuid,
            file: new File([wavBlob], (pendingFile.name.replace(/\.[^.]+$/, '') + '.wav'), { type: 'audio/wav' }),
            color: getColorChooserSelection(colorChooser),
            groupName: groupSelect.value,
        });
        dialog.close();
    } catch (e) {
        alert('Failed to add sound: ' + e.message);
    }
    confirmBtn.disabled = false;
    confirmBtn.textContent = 'Add';
}

function audioBufferToWav(buffer) {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const length = buffer.length;
    const bitsPerSample = 16;
    const byteRate = sampleRate * numChannels * bitsPerSample / 8;
    const blockAlign = numChannels * bitsPerSample / 8;
    const dataSize = length * numChannels * bitsPerSample / 8;

    // Interleave channels
    const pcmData = new Int16Array(length * numChannels);
    for (let c = 0; c < numChannels; c++) {
        const channel = buffer.getChannelData(c);
        for (let i = 0; i < length; i++) {
            const sample = Math.max(-1, Math.min(1, channel[i]));
            pcmData[i * numChannels + c] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
        }
    }

    const header = new ArrayBuffer(44);
    const view = new DataView(header);
    const write = (off, str) => { for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i)); };
    write(0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    write(8, 'WAVE');
    write(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    write(36, 'data');
    view.setUint32(40, dataSize, true);

    return new Blob([header, pcmData.buffer], { type: 'audio/wav' });
}

function reset() {
    pendingFile = null;
    fileInput.value = '';
    fileName.textContent = 'No file selected';
    nameInput.value = '';
    groupSelect.value = '';
    confirmBtn.disabled = true;
}
