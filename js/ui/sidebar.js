// SPDX-FileCopyrightText: 2026 Farras Rayhand <farrasrayhand@gmail.com>
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { state } from '../state.js';
import { settings } from '../settings.js';
import { collectionsService } from '../services/CollectionsService.js';
import { zapsService } from '../services/ZapsService.js';

let collectionsButton, collectionName, sidebar, collectionList, btnAddCollection;
let selectedUuid = null;

export function init() {
    collectionsButton = document.getElementById('collections-toggle');
    collectionName = document.getElementById('collection-name');
    sidebar = document.getElementById('sidebar');
    collectionList = document.getElementById('collection-list');
    btnAddCollection = document.getElementById('btn-add-collection');

    collectionsButton.addEventListener('click', () => {
        sidebar.classList.toggle('hidden');
    });

    btnAddCollection.addEventListener('click', addCollection);

    // Listen for events
    state.on('collection:added', () => render());
    state.on('collection:updated', () => render());
    state.on('collection:removed', () => render());
    state.on('collection:selected', ({ uuid }) => {
        selectedUuid = uuid;
        render();
    });
    state.on('collections:loaded', () => render());
    state.on('shortcut:collections', () => {
        sidebar.classList.toggle('hidden');
    });
}

function render() {
    collectionList.innerHTML = '';
    for (const col of collectionsService.items) {
        const item = document.createElement('div');
        item.className = 'collection-item';
        if (col.uuid === selectedUuid)
            item.classList.add('selected');

        const nameSpan = document.createElement('span');
        nameSpan.textContent = col.name;
        nameSpan.style.flex = '1';
        item.appendChild(nameSpan);

        // Actions
        const actions = document.createElement('div');
        actions.className = 'collection-actions';

        const renameBtn = document.createElement('button');
        renameBtn.textContent = '✎';
        renameBtn.title = 'Rename';
        renameBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            startRename(col, nameSpan);
        });
        actions.appendChild(renameBtn);

        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = '✕';
        deleteBtn.className = 'destructive';
        deleteBtn.title = 'Delete';
        deleteBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (collectionsService.count > 1 && confirm(`Delete collection "${col.name}" and all its sounds?`)) {
                await zapsService.removeAllOfCollection(col.uuid);
                collectionsService.remove(col.uuid);
            }
        });
        actions.appendChild(deleteBtn);

        item.appendChild(actions);

        item.addEventListener('click', () => {
            selectedUuid = col.uuid;
            settings.set('lastSelectedCollection', col.uuid);
            state.emit('collection:selected', { uuid: col.uuid });
            collectionName.textContent = col.name;
            sidebar.classList.add('hidden');
        });

        collectionList.appendChild(item);
    }
}

function startRename(col, nameSpan) {
    const input = document.createElement('input');
    input.type = 'text';
    input.value = col.name;
    input.className = 'inline-rename';
    nameSpan.replaceWith(input);
    input.focus();
    input.select();

    const finish = () => {
        const newName = input.value.trim();
        if (newName && newName !== col.name)
            collectionsService.rename(col.uuid, newName);
        input.replaceWith(nameSpan);
        nameSpan.textContent = newName || col.name;
    };

    input.addEventListener('blur', finish);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') finish();
        if (e.key === 'Escape') {
            input.value = col.name;
            finish();
        }
    });
}

async function addCollection() {
    const name = prompt('Collection name:');
    if (name && name.trim()) {
        const col = await collectionsService.add({ name: name.trim() });
        selectedUuid = col.uuid;
        settings.set('lastSelectedCollection', col.uuid);
        state.emit('collection:selected', { uuid: col.uuid });
        collectionName.textContent = col.name;
        sidebar.classList.add('hidden');
    }
}
