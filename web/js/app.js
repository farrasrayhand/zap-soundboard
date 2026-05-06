// SPDX-FileCopyrightText: 2022 Romain Vigier <contact AT romainvigier.fr>
// SPDX-FileCopyrightText: 2026 Farras Rayhand <farrasrayhand@gmail.com>
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { state } from './state.js';
import { db } from './db.js';
import { settings } from './settings.js';
import { player } from './player.js';
import { collectionsService } from './services/CollectionsService.js';
import { zapsService } from './services/ZapsService.js';
import { init as initToast, show as showToast } from './ui/toast.js';
import * as toolbar from './ui/toolbar.js';
import * as soundboard from './ui/soundboard.js';
import * as addmodal from './ui/addmodal.js';
import * as editmodal from './ui/editmodal.js';
import * as settingspanel from './ui/settingspanel.js';
import * as importdialog from './ui/importdialog.js';
import { init as initTutorial } from './ui/tutorial.js';

async function init() {
    try {
        await db.open();
        await Promise.all([collectionsService.load(), zapsService.load()]);
        applyTheme();
        initToast();

        toolbar.init();
        soundboard.init();
        addmodal.init();
        editmodal.init();
        settingspanel.init();
        importdialog.init();
        initTutorial();

        const lastUuid = settings.getString('lastSelectedCollection');
        const collection = lastUuid
            ? collectionsService.find({ uuid: lastUuid })
            : collectionsService.items[0];
        if (collection)
            state.emit('collection:selected', { uuid: collection.uuid });

        player.setFindZap(uuid => zapsService.find({ uuid }));

        await seedDefaultSounds();

        setupHotkeys();
        setupDragDrop();
        setupShortcuts();

        // Preload audio with progress bar
        const preloadBar = document.getElementById('preload-bar');
        const preloadFill = document.getElementById('preload-fill');
        const preloadText = document.getElementById('preload-text');
        if (preloadBar && preloadFill && preloadText) {
            state.on('preload:start', () => preloadBar.classList.remove('hidden'));
            state.on('preload:progress', ({ loaded, total, pct, name }) => {
                preloadFill.style.width = pct + '%';
                preloadText.textContent = `${name}... ${loaded}/${total} (${pct}%)`;
            });
            state.on('preload:done', () => {
                preloadFill.style.width = '100%';
                preloadText.textContent = 'Ready!';
                setTimeout(() => preloadBar.classList.add('hidden'), 800);
            });
        }
        if (zapsService.count > 0)
            player.preloadAll(zapsService.zaps);

        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
            if (settings.get('theme') === 'system') applyTheme();
        });

        state.on('hotkey:stop', () => player.stopAll());
        state.on('hotkey:fadeout', () => player.fadeOut());
        state.on('hotkey:play', ({ uuid }) => {
            const zap = zapsService.find({ uuid });
            if (zap) player.play(zap);
        });
        state.on('zap:removed', () => player.clearCache());
        state.on('error', ({ message }) => showToast(message, 4000));
        state.on('shortcut:prune', async () => {
            const result = await pruneOrphanedFiles();
            player.clearCache();
            const msg = result.removed > 0
                ? `Cleared ${result.removed} cached file(s), ${(result.freed / 1024).toFixed(1)} KiB freed.`
                : 'Cache is empty.';
            showToast(msg, 3000);
        });

        state.on('shortcut:tutorial', () => state.emit('tutorial:show', {}));

        state.on('shortcut:reset', async () => {
            if (!confirm('Reset all data?\n\nThis will delete all sounds, collections, and cached audio. This cannot be undone.')) return;
            if (!confirm('Are you sure? All your sounds will be permanently removed.')) return;
            await db.clear('collections');
            await db.clear('zaps');
            await db.clear('groups');
            await db.clear('audioFiles');
            await db.clear('decodedAudio');
            player.clearCache();
            localStorage.clear();
            settings.set('showTutorial', true);
            showToast('All data cleared. Reloading...', 2000);
            setTimeout(() => location.reload(), 1500);
        });

        console.debug('Zap web app initialized.');
    } catch (e) {
        console.error('Failed to initialize:', e);
        document.body.innerHTML =
            `<div style="padding:48px;text-align:center;font-family:sans-serif;">` +
            `<h2 style="color:red;">Failed to initialize Zap</h2>` +
            `<p>${e.message}</p><pre style="font-size:12px;color:#666;">${e.stack}</pre></div>`;
    }
}

function applyTheme() {
    const theme = settings.get('theme');
    const resolved = theme === 'system'
        ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        : theme;
    document.documentElement.dataset.theme = resolved;
}

function setupHotkeys() {
    document.addEventListener('keydown', (e) => {
        const tag = document.activeElement?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || document.activeElement?.isContentEditable)
            return;

        const key = e.key === ' ' ? 'Space' : e.key;

        const stopHotkey = settings.getString('stopHotkey');
        if (stopHotkey && key === stopHotkey && !settings.getBoolean('hideStopButton')) {
            e.preventDefault();
            player.stopAll();
            return;
        }

        const fadeoutHotkey = settings.getString('fadeoutHotkey');
        if (fadeoutHotkey && key === fadeoutHotkey) {
            e.preventDefault();
            player.fadeOut();
            return;
        }

        const selectedUuid = document.querySelector('#soundboard')?.dataset?.selectedCollection;
        if (selectedUuid) {
            const match = zapsService.zaps.find(z => z.collectionUuid === selectedUuid && z.hotkey === key);
            if (match) {
                e.preventDefault();
                player.play(match);
            }
        }
    });
}

function setupDragDrop() {
    const app = document.getElementById('app');
    app.addEventListener('dragover', (e) => { e.preventDefault(); app.classList.add('drop-zone-active'); });
    app.addEventListener('dragleave', () => app.classList.remove('drop-zone-active'));
    app.addEventListener('drop', (e) => {
        e.preventDefault();
        app.classList.remove('drop-zone-active');
        for (const file of Array.from(e.dataTransfer.files)) {
            if (file.name.endsWith('.zap')) {
                state.emit('import:file', { file }); return;
            }
            const audioExts = ['.ogg', '.mp3', '.wav', '.flac', '.m4a', '.opus', '.aac', '.wma'];
            if (file.type.startsWith('audio/') || audioExts.some(ext => file.name.toLowerCase().endsWith(ext))) {
                state.emit('addzap:file', { file }); return;
            }
        }
    });
}

function setupShortcuts() {
    document.addEventListener('keydown', (e) => {
        const tag = document.activeElement?.tagName;
        const editing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || document.activeElement?.isContentEditable;
        if (editing) return;

        if (e.key === 'F2') { e.preventDefault(); state.emit('shortcut:add-zap', {}); }
        if (e.key === 'F3') { e.preventDefault(); state.emit('shortcut:collections', {}); }
        if (e.ctrlKey && e.shiftKey && e.key === 'P') { e.preventDefault(); state.emit('shortcut:prune', {}); }
    });
}

async function seedDefaultSounds() {
    const defaultCol = collectionsService.items[0];
    if (!defaultCol) return;

    const existingZaps = zapsService.zaps.filter(z => z.collectionUuid === defaultCol.uuid);
    if (existingZaps.length > 0) return;

    const audioCount = await db.count('audioFiles');
    if (audioCount > 0) return;

    const defaults = [
        { name: 'Applause', file: 'sounds/applause.ogg', color: 'blue' },
        { name: 'Bark', file: 'sounds/bark.ogg', color: 'brown' },
        { name: '8-Bit Theme', file: 'sounds/theme-song-8bit-loop.ogg', color: 'green', loop: true },
    ];

    for (const s of defaults) {
        try {
            const resp = await fetch(s.file);
            if (!resp.ok) continue;
            const blob = await resp.blob();
            const f = new File([blob], s.file.split('/').pop(), { type: 'audio/ogg' });
            await zapsService.add({
                name: s.name, collection: defaultCol, file: f,
                color: s.color, loop: s.loop || false,
            });
        } catch (e) {
            console.warn(`Seed failed for "${s.name}":`, e);
        }
    }
}

async function pruneOrphanedFiles() {
    const used = new Set(zapsService.zaps.map(z => z.fileId).filter(Boolean));
    return db.pruneOrphanedAudioFiles(used);
}

if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', init);
else
    init();
