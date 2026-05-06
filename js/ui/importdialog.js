// SPDX-FileCopyrightText: 2026 Farras Rayhand <farrasrayhand@gmail.com>
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { state } from '../state.js';
import { db } from '../db.js';
import { settings } from '../settings.js';
import { collectionsService } from '../services/CollectionsService.js';
import { zapsService } from '../services/ZapsService.js';
import { player } from '../player.js';
import { Color } from '../models/Color.js';
import { extractZapFile, createZapFile, downloadBlob } from '../importexport.js';
import { show as showToast } from './toast.js';

let dialog, summary, conflictMsg, footerNormal, footerConflict;
let importFile = null;
let importData = null;
let progressBar, progressFill, progressText;

export function init() {
    dialog = document.getElementById('import-dialog');
    summary = document.getElementById('import-summary');
    conflictMsg = document.getElementById('import-conflict-msg');
    footerNormal = document.getElementById('import-footer-normal');
    footerConflict = document.getElementById('import-footer-conflict');
    progressBar = document.getElementById('global-progress');
    progressFill = document.getElementById('global-progress-fill');
    progressText = document.getElementById('global-progress-text');

    document.getElementById('import-cancel').addEventListener('click', () => dialog.close());
    document.getElementById('import-cancel2').addEventListener('click', () => dialog.close());
    document.getElementById('import-confirm').addEventListener('click', () => doImport(false));
    document.getElementById('import-keep-both').addEventListener('click', () => doImport(false));
    document.getElementById('import-replace').addEventListener('click', () => doImport(true));

    state.on('shortcut:import', () => pickFile());
    state.on('shortcut:export', () => doExport());
    state.on('import:file', ({ file }) => {
        importFile = file;
        processFile();
    });

    dialog.addEventListener('close', () => { importFile = null; importData = null; });
}

function pickFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.zap';
    input.addEventListener('change', async () => {
        if (input.files.length > 0) {
            importFile = input.files[0];
            await processFile();
        }
    });
    input.click();
}

async function processFile() {
    if (!importFile) return;

    try {
        const arrayBuffer = await importFile.arrayBuffer();
        importData = await extractZapFile(arrayBuffer);
        showPreview();
    } catch (e) {
        alert('Import failed: ' + e.message);
        importFile = null;
        importData = null;
    }
}

function showPreview() {
    if (!importData) return;

    const { metadata } = importData;
    const collections = metadata.collections || [];
    const zaps = metadata.zaps || [];
    const groups = metadata.groups || [];

    // Check for conflicts
    const existingNames = new Set(collectionsService.items.map(c => c.name));
    const conflicts = collections.filter(c => existingNames.has(c.name));

    summary.textContent = `${collections.length} collections, ${groups.length} groups, ${zaps.length} sounds`;

    if (conflicts.length > 0) {
        conflictMsg.style.display = 'block';
        conflictMsg.textContent = `Conflicts: ${conflicts.map(c => `"${c.name}"`).join(', ')} already exist(s).`;
        footerNormal.classList.add('hidden');
        footerConflict.classList.remove('hidden');
    } else {
        conflictMsg.style.display = 'none';
        footerNormal.classList.remove('hidden');
        footerConflict.classList.add('hidden');
    }

    dialog.showModal();
}

function showProgress(label, current, total) {
    const pct = total > 0 ? Math.round((current / total) * 100) : 0;
    if (progressBar && progressFill && progressText) {
        progressBar.classList.remove('hidden');
        progressFill.style.width = pct + '%';
        progressText.textContent = total > 0 ? `${label}... ${current}/${total} (${pct}%)` : label;
    }
}

function hideProgress() {
    if (progressBar) progressBar.classList.add('hidden');
}

async function doImport(replace) {
    if (!importData) return;

    console.log('Import: Starting import process', { replace });
    const { metadata, sounds } = importData;
    dialog.close();

    try {
        // Import settings
        showProgress('Importing settings', 0, 1);
        if (metadata.settings) {
            console.log('Import: Applying settings');
            const s = metadata.settings;
            if (s.safetyMode !== undefined) settings.set('safetyMode', s.safetyMode);
            if (s.hideStopButton !== undefined) settings.set('hideStopButton', s.hideStopButton);
            if (s.enablePause !== undefined) settings.set('enablePause', s.enablePause);
            if (s.fadeoutDuration !== undefined) settings.set('fadeoutDuration', s.fadeoutDuration);
            if (s.stopHotkey !== undefined) settings.set('stopHotkey', s.stopHotkey);
            if (s.fadeoutHotkey !== undefined) settings.set('fadeoutHotkey', s.fadeoutHotkey);
        }

        // Build name->collection lookup for existing collections
        const existingByName = new Map();
        for (const c of collectionsService.items)
            existingByName.set(c.name, c);

        const colMap = new Map(); // old UUID -> new Collection

        let importedCollections = 0;
        let importedGroups = 0;
        let importedZaps = 0;
        let skippedZaps = 0;

        const collectionsToImport = metadata.collections || [];
        console.log(`Import: Processing ${collectionsToImport.length} collections`);

        for (const colData of collectionsToImport) {
            let collection = null;
            const local = existingByName.get(colData.name);

            if (replace && local) {
                console.log(`Import: Replacing collection "${colData.name}"`);
                await zapsService.removeAllOfCollection(local.uuid);
                collection = local;
            } else if (!replace && local) {
                console.log(`Import: Keeping both, creating new collection for "${colData.name}"`);
                collection = await collectionsService.add({ name: colData.name, uuid: null });
            } else {
                console.log(`Import: Creating collection "${colData.name}"`);
                collection = await collectionsService.add({ name: colData.name, uuid: colData.uuid });
            }

            colMap.set(colData.uuid, collection);
            existingByName.set(collection.name, collection);
            importedCollections++;
        }

        // Import groups
        if (metadata.groups) {
            console.log(`Import: Processing ${metadata.groups.length} groups`);
            for (const groupData of metadata.groups) {
                const collection = colMap.get(groupData.collectionUuid);
                if (collection) {
                    try {
                        await zapsService.addGroup({
                            name: groupData.name,
                            collectionUuid: collection.uuid,
                            uuid: groupData.uuid,
                            position: groupData.position,
                        });
                        importedGroups++;
                    } catch (e) { 
                        console.warn(`Import: Group "${groupData.name}" already exists, skipping`);
                    }
                }
            }
        }

        // Import zaps
        if (metadata.zaps) {
            const totalZaps = metadata.zaps.length;
            console.log(`Import: Processing ${totalZaps} zaps`);
            for (let zi = 0; zi < totalZaps; zi++) {
                const zapData = metadata.zaps[zi];
                showProgress('Importing sounds', zi + 1, totalZaps);
                
                const existing = zapsService.find({ uuid: zapData.uuid });
                if (existing) {
                    const targetCol = colMap.get(zapData.collectionUuid);
                    if (existing.collectionUuid === targetCol?.uuid) {
                        skippedZaps++;
                        continue;
                    }
                    skippedZaps++;
                    continue;
                }

                const collection = colMap.get(zapData.collectionUuid);
                if (!collection) {
                    skippedZaps++;
                    continue;
                }

                const soundData = sounds[zapData.filename];
                if (!soundData) {
                    console.warn(`Import: Audio data missing for zap "${zapData.name}" (${zapData.filename})`);
                    skippedZaps++;
                    continue;
                }

                const fileId = crypto.randomUUID();
                const mimeType = zapData.filename.endsWith('.ogg') ? 'audio/ogg'
                    : zapData.filename.endsWith('.mp3') ? 'audio/mpeg'
                    : zapData.filename.endsWith('.wav') ? 'audio/wav'
                    : zapData.filename.endsWith('.flac') ? 'audio/flac'
                    : 'audio/ogg';

                const blob = new Blob([soundData], { type: mimeType });
                await db.storeAudioBlob(fileId, blob, zapData.filename, mimeType);

                try {
                    await zapsService.add({
                        name: zapData.name,
                        collection: collection.uuid,
                        color: zapData.color || 'gray',
                        loop: zapData.loop || false,
                        startTime: zapData.startTime || 0,
                        volume: zapData.volume ?? 1.0,
                        groupName: zapData.groupName || '',
                        hotkey: zapData.hotkey || '',
                        nextSoundUuid: zapData.nextSoundUuid || '',
                        gap: zapData.gap || 0,
                        uuid: zapData.uuid,
                        position: zapData.position || 0,
                        fileId,
                        originalFilename: zapData.filename,
                    });
                    importedZaps++;
                } catch (e) {
                    console.error(`Import: Failed to add zap "${zapData.name}":`, e);
                    skippedZaps++;
                }
            }
        }

        console.log('Import: Success, cleaning up');
        hideProgress();

        // Refresh UI
        state.emit('collections:loaded', { collections: collectionsService.items });
        console.log('Import: Reloading zaps from DB');
        await zapsService.load();
        
        const lastUuid = settings.getString('lastSelectedCollection');
        const col = lastUuid ? collectionsService.find({ uuid: lastUuid }) : (collectionsService.items.length > 0 ? collectionsService.items[0] : null);
        if (col) {
            console.log(`Import: Selecting collection "${col.name}"`);
            state.emit('collection:selected', { uuid: col.uuid });
        }

        // Auto preload all sounds immediately
        const zapsToPreload = zapsService.zaps;
        if (zapsToPreload.length > 0) {
            console.log(`Import: Triggering preload for ${zapsToPreload.length} zaps`);
            player.preloadAll(zapsToPreload);
        }

        let msg = `Imported: ${importedCollections} collections`;
        if (importedGroups > 0) msg += `, ${importedGroups} groups`;
        if (importedZaps > 0) msg += `, ${importedZaps} sounds`;
        if (skippedZaps > 0) msg += ` (${skippedZaps} skipped)`;
        showToast(msg);

    } catch (e) {
        hideProgress();
        console.error('Import: Fatal error:', e);
        alert('Import failed: ' + e.message);
    }
}

async function doExport() {
    try {
        const collections = collectionsService.items;
        const groups = zapsService.groups;
        const zaps = zapsService.zaps;
        const settingsObj = settings.getAll();

        const audioLoader = async (zap) => {
            try {
                const blob = await db.getAudioBlob(zap.fileId);
                if (!blob) return null;
                return await blob.arrayBuffer();
            } catch { return null; }
        };

        showProgress('Exporting', 0, zaps.length);
        const blob = await createZapFile(collections, groups, zaps, settingsObj, audioLoader,
            (current, total) => showProgress('Exporting', current, total));
        hideProgress();
        const count = zapsService.count;
        downloadBlob(blob, 'zaps.zap');
        showToast(`Exported ${collections.length} collections, ${zaps.length} sounds.`);
    } catch (e) {
        hideProgress();
        console.error('Export failed:', e);
        alert('Export failed: ' + e.message);
    }
}
