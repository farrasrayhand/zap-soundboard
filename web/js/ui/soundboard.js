// SPDX-FileCopyrightText: 2026 Farras Rayhand <farrasrayhand@gmail.com>
//
// SPDX-License-Identifier: GPL-3.0-or-later

// Safari fallback for requestIdleCallback
if (typeof requestIdleCallback === 'undefined') {
    window.requestIdleCallback = (cb, opts) => {
        const delay = opts?.timeout || 1;
        return setTimeout(() => cb({ didTimeout: true, timeRemaining: () => 0 }), delay);
    };
    window.cancelIdleCallback = id => clearTimeout(id);
}

import { state } from '../state.js';
import { settings } from '../settings.js';
import { zapsService } from '../services/ZapsService.js';
import { player } from '../player.js';
import { createZapItem, updateZapItemState, initEditPopover } from './zapitem.js';
import { show as showToast } from './toast.js';

let zapsContainer, emptyState, soundboard;
let selectedCollectionUuid = null;
let refreshId = 0;

export function init() {
    zapsContainer = document.getElementById('zaps-container');
    emptyState = document.getElementById('empty-state');
    soundboard = document.getElementById('soundboard');

    initEditPopover();

    state.on('collection:selected', ({ uuid }) => {
        selectedCollectionUuid = uuid;
        soundboard.dataset.selectedCollection = uuid;
        refresh();
    });

    state.on('zap:added', () => refresh());
    state.on('zap:removed', () => refresh());
    state.on('zap:updated', ({ property }) => {
        if (['groupName', 'position', 'collectionUuid', 'nextSoundUuid', 'gap', 'loop'].includes(property))
            refresh();
    });
    state.on('groups-changed', () => refresh());
    state.on('zaps:loaded', () => refresh());
    state.on('groups:loaded', () => refresh());
    state.on('settings:changed', () => refresh());

    // Playback state for zap cards
    state.on('play:started', ({ uuid }) => updateZapItemState(uuid, 'playing', true));
    state.on('play:stopped', ({ uuid }) => updateZapItemState(uuid, 'playing', false));
    state.on('play:paused', ({ uuid }) => updateZapItemState(uuid, 'paused', true));
    state.on('play:resumed', ({ uuid }) => updateZapItemState(uuid, 'paused', false));

    state.on('shortcut:add-group', () => addGroup());
    state.on('zap:reorder', ({ from, to }) => handleReorder(from, to));

    state.on('play:blocked', ({ message }) => showToast(message, 3000));

    state.on('play:started', () => updateSafetyBlock());
    state.on('play:stopped', () => updateSafetyBlock());
    state.on('settings:changed', () => updateSafetyBlock());
}

function updateSafetyBlock() {
    const safety = settings.getBoolean('safetyMode');
    const playing = player.isPlaying;
    document.querySelectorAll('.zap-play-btn').forEach(btn => {
        btn.disabled = safety && playing;
    });
}

function refresh() {
    if (refreshId) {
        cancelIdleCallback(refreshId);
        refreshId = 0;
    }
    refreshId = requestIdleCallback(doRefresh, { timeout: 50 });
}

function doRefresh() {
    refreshId = 0;

    if (!selectedCollectionUuid) {
        emptyState.classList.remove('hidden');
        zapsContainer.classList.add('hidden');
        return;
    }

    const zaps = zapsService.zaps.filter(z => z.collectionUuid === selectedCollectionUuid);
    const groups = zapsService.groups.filter(g => g.collectionUuid === selectedCollectionUuid);

    if (zaps.length === 0 && groups.length === 0) {
        emptyState.classList.remove('hidden');
        zapsContainer.classList.add('hidden');
        return;
    }

    emptyState.classList.add('hidden');
    zapsContainer.classList.remove('hidden');
    zapsContainer.innerHTML = '';

    const displayedUuids = new Set();
    const sortedGroups = [...groups].sort((a, b) => a.position - b.position);

    sortedGroups.forEach(group => {
        const groupZaps = zaps.filter(z => z.groupName === group.name).sort((a, b) => a.position - b.position);
        addGroupToLayout(group.name, groupZaps, group);
        groupZaps.forEach(z => displayedUuids.add(z.uuid));
    });

    const remaining = zaps.filter(z => !displayedUuids.has(z.uuid)).sort((a, b) => a.position - b.position);
    if (remaining.length > 0)
        addGroupToLayout('', remaining, null);

    updateSafetyBlock();
}

function addGroupToLayout(groupName, zaps, groupObj) {
    const sep = document.createElement('div');
    sep.className = 'group-separator';

    const nameSpan = document.createElement('span');
    nameSpan.className = 'group-name';
    nameSpan.textContent = groupName || 'Ungrouped';
    sep.appendChild(nameSpan);

    if (groupObj) {
        const actions = document.createElement('div');
        actions.className = 'group-actions';

        const upBtn = document.createElement('button');
        upBtn.textContent = '↑';
        upBtn.title = 'Move Up';
        upBtn.addEventListener('click', () => zapsService.moveGroup(groupObj.uuid, -1));
        actions.appendChild(upBtn);

        const downBtn = document.createElement('button');
        downBtn.textContent = '↓';
        downBtn.title = 'Move Down';
        downBtn.addEventListener('click', () => zapsService.moveGroup(groupObj.uuid, 1));
        actions.appendChild(downBtn);

        const renameBtn = document.createElement('button');
        renameBtn.textContent = '✎';
        renameBtn.title = 'Rename';
        renameBtn.addEventListener('click', () => renameGroup(groupObj, nameSpan));
        actions.appendChild(renameBtn);

        const delBtn = document.createElement('button');
        delBtn.textContent = '✕';
        delBtn.className = 'destructive';
        delBtn.title = 'Remove Group';
        delBtn.addEventListener('click', () => {
            if (confirm(`Remove group "${groupObj.name}"? Sounds become ungrouped.`))
                zapsService.removeGroup(groupObj.uuid);
        });
        actions.appendChild(delBtn);

        sep.appendChild(actions);
    }

    const hr = document.createElement('hr');
    sep.appendChild(hr);

    zapsContainer.appendChild(sep);

    const grid = document.createElement('div');
    grid.className = 'zaps-grid';
    zaps.forEach(zap => grid.appendChild(createZapItem(zap)));
    zapsContainer.appendChild(grid);
}

function renameGroup(group, nameSpan) {
    const input = document.createElement('input');
    input.type = 'text';
    input.value = group.name;
    input.className = 'inline-rename';
    nameSpan.replaceWith(input);
    input.focus();
    input.select();

    const finish = () => {
        const newName = input.value.trim();
        if (newName && newName !== group.name)
            zapsService.renameGroup(group.uuid, newName);
        input.replaceWith(nameSpan);
    };

    input.addEventListener('blur', finish);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') finish();
        if (e.key === 'Escape') { input.value = group.name; finish(); }
    });
}

async function addGroup() {
    if (!selectedCollectionUuid) return;
    const name = prompt('Group name:');
    if (name && name.trim())
        await zapsService.addGroup({ name: name.trim(), collectionUuid: selectedCollectionUuid });
}

async function handleReorder(fromUuid, toUuid) {
    const fromZap = zapsService.find({ uuid: fromUuid });
    const toZap = zapsService.find({ uuid: toUuid });
    if (!fromZap || !toZap || fromZap.collectionUuid !== toZap.collectionUuid) return;

    const fromPos = fromZap.position;
    const fromGroup = fromZap.groupName;
    const toPos = toZap.position;
    const toGroup = toZap.groupName;

    if (fromGroup !== toGroup)
        await zapsService.updateProperty(fromUuid, 'groupName', toGroup);

    await zapsService.updateProperty(fromUuid, 'position', toPos);
    await zapsService.updateProperty(toUuid, 'position', fromPos);
}
