// SPDX-FileCopyrightText: 2026 Farras Rayhand <farrasrayhand@gmail.com>
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { state } from '../state.js';
import { settings } from '../settings.js';
import { zapsService } from '../services/ZapsService.js';
import { player } from '../player.js';
import { Color } from '../models/Color.js';
import { ICONS } from './icons.js';

const NS_PER_S = 1e9;
const itemElements = new Map();

let editPopover, editingZapUuid = null;

export function initEditPopover() {
    editPopover = document.getElementById('edit-zap-popover');
    const menu = document.getElementById('edit-popover-menu');
    const colors = document.getElementById('edit-popover-colors');
    const colorGrid = document.getElementById('edit-popover-color-grid');

    editPopover.addEventListener('click', (e) => {
        const item = e.target.closest('[data-edit-action]');
        if (!item || !editingZapUuid) return;
        const action = item.dataset.editAction;

        const zap = zapsService.find({ uuid: editingZapUuid });
        if (!zap) return;

        switch (action) {
            case 'loop':
                editPopover.classList.add('hidden');
                zapsService.updateProperty(editingZapUuid, 'loop', !zap.loop);
                break;
            case 'color':
                fillColorGrid(zap);
                menu.classList.add('hidden');
                colors.classList.remove('hidden');
                break;
            case 'color-select':
                editPopover.classList.add('hidden');
                zapsService.updateProperty(editingZapUuid, 'color', item.dataset.color);
                break;
            case 'color-back':
                menu.classList.remove('hidden');
                colors.classList.add('hidden');
                updateMainMenu(zap);
                break;
            case 'edit':
                editPopover.classList.add('hidden');
                state.emit('shortcut:edit-zap', { uuid: editingZapUuid });
                break;
            case 'delete':
                editPopover.classList.add('hidden');
                if (confirm(`Delete "${zap.name}"?`))
                    zapsService.remove(editingZapUuid);
                break;
        }
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
        if (editPopover && !editPopover.classList.contains('hidden') && !editPopover.contains(e.target)) {
            editPopover.classList.add('hidden');
            menu.classList.remove('hidden');
            colors.classList.add('hidden');
        }
    });
}

function updateMainMenu(zap) {
    const loopItem = editPopover.querySelector('[data-edit-action="loop"]');
    if (loopItem) loopItem.textContent = zap?.loop ? 'Disable Loop' : 'Enable Loop';
}

function fillColorGrid(zap) {
    const colorGrid = document.getElementById('edit-popover-color-grid');
    const current = zap?.color || 'gray';
    colorGrid.innerHTML = '';
    Color.forEach(color => {
        const pill = document.createElement('div');
        pill.className = 'color-pill' + (color.id === current ? ' selected' : '');
        pill.dataset.editAction = 'color-select';
        pill.dataset.color = color.id;
        const rgba = document.documentElement.dataset.theme === 'dark' ? color.rgba.dark : color.rgba.light;
        pill.style.background = rgba;
        colorGrid.appendChild(pill);
    });
}

export function createZapItem(zap) {
    const color = Color.fromId(zap.color);
    const isDark = document.documentElement.dataset.theme === 'dark';
    const rgba = isDark ? color.rgba.dark : color.rgba.light;
    const bgAlpha = isDark ? 0.25 : 0.18;

    const el = document.createElement('div');
    el.className = 'zap-item';
    el.dataset.uuid = zap.uuid;

    itemElements.set(zap.uuid, el);

    // ── Progress bar (bottom) ──
    const progressBar = document.createElement('div');
    progressBar.className = 'progress-bar';
    const progressFill = document.createElement('div');
    progressFill.className = 'progress-fill';
    progressFill.style.backgroundColor = rgba;
    progressBar.appendChild(progressFill);
    el.appendChild(progressBar);

    // ── Main horizontal layout ──
    const row = document.createElement('div');
    row.className = 'zap-row';
    row.style.backgroundColor = rgbToRgba(rgba, bgAlpha);

    // LEFT: Stop / FadeOut (revealed when playing)
    const leftBox = document.createElement('div');
    leftBox.className = 'zap-left';

    if (!settings.getBoolean('hideStopButton')) {
        const stopBtn = document.createElement('button');
        stopBtn.className = 'zap-btn zap-stop-btn';
        stopBtn.innerHTML = ICONS.stop;
        stopBtn.title = 'Stop';
        stopBtn.addEventListener('click', (e) => { e.stopPropagation(); player.stop(zap.uuid); });
        leftBox.appendChild(stopBtn);
    }

    const fadeBtn = document.createElement('button');
    fadeBtn.className = 'zap-btn zap-fade-btn';
    fadeBtn.innerHTML = ICONS.fadeout;
    fadeBtn.title = 'Fade out';
    fadeBtn.addEventListener('click', (e) => { e.stopPropagation(); player.fadeOut(zap.uuid); });
    leftBox.appendChild(fadeBtn);

    row.appendChild(leftBox);

    // CENTER: Play button with icon + name + badges (single row)
    const playBtn = document.createElement('button');
    playBtn.className = 'zap-play-btn';

    const playIcon = document.createElement('span');
    playIcon.className = 'zap-play-icon';
    playIcon.innerHTML = ICONS.play;
    playBtn.appendChild(playIcon);

    const nameSpan = document.createElement('span');
    nameSpan.className = 'zap-name';
    nameSpan.textContent = zap.name;
    playBtn.appendChild(nameSpan);

    const badges = document.createElement('span');
    badges.className = 'zap-badges';

    if (zap.hotkey) {
        const hotkeyBadge = document.createElement('span');
        hotkeyBadge.className = 'zap-badge zap-hotkey-badge';
        hotkeyBadge.textContent = zap.hotkey;
        badges.appendChild(hotkeyBadge);
    }

    const timestamp = document.createElement('span');
    timestamp.className = 'zap-badge zap-timestamp';
    timestamp.style.display = 'none';
    badges.appendChild(timestamp);

    if (zap.nextSoundUuid) {
        const nextBadge = document.createElement('span');
        nextBadge.className = 'zap-badge zap-next-badge';
        const nextZap = zapsService.find({ uuid: zap.nextSoundUuid });
        const nextName = nextZap ? nextZap.name : '?';
        const gapStr = zap.gap > 0 ? ` (${(zap.gap / NS_PER_S).toFixed(1)}s)` : '';
        nextBadge.textContent = `→ ${nextName}${gapStr}`;
        badges.appendChild(nextBadge);
    }

    if (zap.startTime > 0) {
        const startBadge = document.createElement('span');
        startBadge.className = 'zap-badge';
        startBadge.textContent = '↗ ' + formatTime(zap.startTime);
        badges.appendChild(startBadge);
    }

    playBtn.appendChild(badges);

    // Initial state based on player
    const isPlaying = player.isActive(zap.uuid) && zap.playing && !zap.paused;
    const isPaused = player.isActive(zap.uuid) && zap.paused;
    const isPreloaded = player.isPreloaded(zap);

    const canPause = settings.getBoolean('enablePause') && !settings.getBoolean('safetyMode');

    if (isPlaying) {
        el.classList.add('playing');
        playIcon.innerHTML = canPause ? ICONS.pause : ICONS.play;
        leftBox.classList.add('visible');
    } else if (isPaused) {
        el.classList.add('paused');
        playIcon.innerHTML = ICONS.play;
    }

    if (!isPreloaded) {
        playBtn.disabled = true;
    }

    playBtn.addEventListener('click', () => player.play(zap));
    row.appendChild(playBtn);

    // RIGHT: Loop toggle + Edit menu
    const rightBox = document.createElement('div');
    rightBox.className = 'zap-right';

    const loopBtn = document.createElement('button');
    loopBtn.className = 'zap-btn zap-loop-btn';
    loopBtn.title = 'Loop';
    loopBtn.dataset.loop = zap.loop ? 'on' : 'off';
    loopBtn.innerHTML = zap.loop ? ICONS.repeat_crossed : ICONS.repeat;
    loopBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const newLoop = !zapsService.find({ uuid: zap.uuid })?.loop;
        zapsService.updateProperty(zap.uuid, 'loop', newLoop);
        if (newLoop) {
            zapsService.updateProperty(zap.uuid, 'nextSoundUuid', '');
            zapsService.updateProperty(zap.uuid, 'gap', 0);
            const badge = el.querySelector('.zap-next-badge');
            if (badge) badge.remove();
        }
        loopBtn.dataset.loop = newLoop ? 'on' : 'off';
        loopBtn.innerHTML = newLoop ? ICONS.repeat_crossed : ICONS.repeat;
    });
    rightBox.appendChild(loopBtn);

    const editBtn = document.createElement('button');
    editBtn.className = 'zap-btn zap-edit-btn';
    editBtn.innerHTML = ICONS.edit;
    editBtn.title = 'Edit';
    editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        document.getElementById('edit-popover-menu').classList.remove('hidden');
        document.getElementById('edit-popover-colors').classList.add('hidden');
        updateMainMenu(zap);
        const rect = editBtn.getBoundingClientRect();
        editPopover.style.position = 'fixed';
        editPopover.style.top = (rect.bottom + 4) + 'px';
        editPopover.style.right = (window.innerWidth - rect.right) + 'px';
        editPopover.style.left = 'auto';
        editPopover.classList.remove('hidden');
        editingZapUuid = zap.uuid;
    });
    rightBox.appendChild(editBtn);

    row.appendChild(rightBox);
    el.appendChild(row);

    // ── Drag and drop ──
    el.draggable = true;
    el.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', zap.uuid);
        e.dataTransfer.effectAllowed = 'move';
        el.style.opacity = '0.4';
    });
    el.addEventListener('dragend', () => { el.style.opacity = '1'; });
    el.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        el.classList.add('drag-over');
    });
    el.addEventListener('dragleave', () => el.classList.remove('drag-over'));
    el.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        el.classList.remove('drag-over');
        const draggedUuid = e.dataTransfer.getData('text/plain');
        if (draggedUuid && draggedUuid !== zap.uuid)
            state.emit('zap:reorder', { from: draggedUuid, to: zap.uuid });
    });

    return el;
}

// ── Global listeners for playback state (outside createZapItem to avoid leaks) ──

state.on('play:progress', ({ uuid, progress, position, duration }) => {
    const el = itemElements.get(uuid);
    if (el) {
        const progressFill = el.querySelector('.progress-fill');
        if (progressFill) progressFill.style.width = (progress * 100) + '%';
        
        const timestamp = el.querySelector('.zap-badge.zap-timestamp');
        if (timestamp) {
            timestamp.style.display = 'inline';
            timestamp.textContent = formatTime(position) + ' / ' + formatTime(duration);
        }
    }
});

state.on('play:gap-countdown', ({ fromUuid, remaining }) => {
    const el = itemElements.get(fromUuid);
    if (el) {
        const timestamp = el.querySelector('.zap-badge.zap-timestamp');
        if (timestamp) {
            timestamp.style.display = 'inline';
            timestamp.textContent = formatTime(remaining) + ' →';
        }
    }
});

export function updateAllPlayButtons() {
    const safety = settings.getBoolean('safetyMode');
    const isPlaying = player.isPlaying;
    
    for (const [uuid, el] of itemElements) {
        const zap = zapsService.find({ uuid });
        const btn = el.querySelector('.zap-play-btn');
        if (!btn || !zap) continue;

        const isPreloaded = player.isPreloaded(zap);
        if (!isPreloaded) {
            btn.disabled = true;
        } else if (safety && isPlaying) {
            btn.disabled = true;
        } else {
            btn.disabled = false;
        }
    }
}

state.on('play:started', ({ uuid }) => {
    updateZapItemState(uuid, 'playing', true);
    updateAllPlayButtons();
});
state.on('play:stopped', ({ uuid }) => {
    updateZapItemState(uuid, 'playing', false);
    updateAllPlayButtons();
});
state.on('play:paused', ({ uuid }) => {
    updateZapItemState(uuid, 'paused', true);
    updateAllPlayButtons();
});
state.on('play:resumed', ({ uuid }) => {
    updateZapItemState(uuid, 'paused', false);
    updateAllPlayButtons();
});

state.on('play:loading', ({ uuid }) => {
    const el = itemElements.get(uuid);
    if (el) {
        const playBtn = el.querySelector('.zap-play-btn');
        const playIcon = el.querySelector('.zap-play-icon');
        if (playBtn) playBtn.disabled = true;
        if (playIcon) playIcon.innerHTML = '<span class="spinner"></span>';
    }
});

state.on('preload:zap-done', ({ uuid }) => {
    updateAllPlayButtons();
});

state.on('zap:updated', ({ uuid, property }) => {
    const el = itemElements.get(uuid);
    if (!el) return;
    if (['loop', 'color', 'nextSoundUuid', 'gap'].includes(property)) {
        const updatedZap = zapsService.find({ uuid });
        if (updatedZap) {
            const c = Color.fromId(updatedZap.color);
            const dark = document.documentElement.dataset.theme === 'dark';
            const r = dark ? c.rgba.dark : c.rgba.light;
            const row = el.querySelector('.zap-row');
            const progressFill = el.querySelector('.progress-fill');
            const loopBtn = el.querySelector('.zap-loop-btn');
            if (row) row.style.backgroundColor = rgbToRgba(r, dark ? 0.25 : 0.18);
            if (progressFill) {
                progressFill.style.backgroundColor = r;
            }
            if (loopBtn) {
                loopBtn.dataset.loop = updatedZap.loop ? 'on' : 'off';
                loopBtn.innerHTML = updatedZap.loop ? ICONS.repeat_crossed : ICONS.repeat;
            }
        }
    }
    if (property === 'nextSoundUuid' || property === 'gap') {
        const badge = el.querySelector('.zap-badge.zap-next-badge');
        if (badge) badge.remove();
    }
});

export function updateZapItemState(uuid, stateType, value) {
    const el = itemElements.get(uuid);
    if (!el) return;

    const icon = el.querySelector('.zap-play-icon');
    const left = el.querySelector('.zap-left');
    const canPause = settings.getBoolean('enablePause') && !settings.getBoolean('safetyMode');

    if (stateType === 'playing') {
        el.classList.toggle('playing', value);
        if (value) {
            el.classList.remove('paused');
            if (icon) icon.innerHTML = canPause ? ICONS.pause : ICONS.play;
            if (left) left.classList.add('visible');
        } else {
            if (icon) icon.innerHTML = ICONS.play;
            if (left) left.classList.remove('visible');
            const progressFill = el.querySelector('.progress-fill');
            if (progressFill) progressFill.style.width = '0%';
            const timestamp = el.querySelector('.zap-badge.zap-timestamp');
            if (timestamp) timestamp.style.display = 'none';
        }
    }
    
    if (stateType === 'paused') {
        el.classList.toggle('paused', value);
        if (value) {
            el.classList.remove('playing');
            if (icon) icon.innerHTML = ICONS.play;
            if (left) left.classList.remove('visible');
        } else {
            // Resumed
            el.classList.add('playing');
            if (icon) icon.innerHTML = canPause ? ICONS.pause : ICONS.play;
            if (left) left.classList.add('visible');
        }
    }
}

function rgbToRgba(rgbaStr, alpha) {
    return rgbaStr.replace(/[\d.]+\)$/, alpha + ')');
}

function formatTime(ns) {
    if (!ns || ns <= 0) return '0:00.0';
    const totalSeconds = ns / NS_PER_S;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const tenths = Math.floor((totalSeconds % 1) * 10);
    return `${minutes}:${String(seconds).padStart(2, '0')}.${tenths}`;
}

export { formatTime, itemElements };
