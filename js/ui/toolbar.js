// SPDX-FileCopyrightText: 2026 Farras Rayhand <farrasrayhand@gmail.com>
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { state } from '../state.js';
import { settings } from '../settings.js';
import { collectionsService } from '../services/CollectionsService.js';
import { zapsService } from '../services/ZapsService.js';

let collectionName, mainMenuPopover, collectionsPopover, collectionsPopoverList;
let btnMenu, collectionsToggle, btnAddGroup, btnAddZap;

export function init() {
    collectionName = document.getElementById('collection-name');
    mainMenuPopover = document.getElementById('main-menu-popover');
    collectionsPopover = document.getElementById('collections-popover');
    collectionsPopoverList = document.getElementById('collections-popover-list');
    btnMenu = document.getElementById('btn-menu');
    collectionsToggle = document.getElementById('collections-toggle');
    btnAddGroup = document.getElementById('btn-add-group');
    btnAddZap = document.getElementById('btn-add-zap');

    // Toggle main menu
    btnMenu.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = !mainMenuPopover.classList.contains('hidden');
        mainMenuPopover.classList.toggle('hidden');
        collectionsPopover.classList.add('hidden');
        if (!isOpen)
            positionPopover(mainMenuPopover, btnMenu);
    });

    // Close menus on outside click
    document.addEventListener('click', (e) => {
        if (!mainMenuPopover.classList.contains('hidden') && !mainMenuPopover.contains(e.target) && e.target !== btnMenu)
            mainMenuPopover.classList.add('hidden');
        if (!collectionsPopover.classList.contains('hidden') && !collectionsPopover.contains(e.target) && e.target !== collectionsToggle)
            collectionsPopover.classList.add('hidden');
    });

    // Main menu actions
    mainMenuPopover.addEventListener('click', (e) => {
        const item = e.target.closest('[data-action]');
        if (!item) return;
        const action = item.dataset.action;
        mainMenuPopover.classList.add('hidden');
        handleMenuAction(action);
    });

    // Collection selector popover
    collectionsToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = !collectionsPopover.classList.contains('hidden');
        collectionsPopover.classList.toggle('hidden');
        mainMenuPopover.classList.add('hidden');
        if (!isOpen) {
            renderCollectionsPopover();
            positionPopover(collectionsPopover, collectionsToggle);
        }
    });

    btnAddGroup.addEventListener('click', () => state.emit('shortcut:add-group', {}));
    btnAddZap.addEventListener('click', () => state.emit('shortcut:add-zap', {}));

    // Listen for collection selection to update title
    state.on('collection:selected', ({ uuid }) => {
        const col = collectionsService.find({ uuid });
        if (col)
            collectionName.textContent = col.name;
    });

    state.on('collections:loaded', () => {
        const col = collectionsService.items[0];
        if (col) {
            collectionName.textContent = col.name;
            state.emit('collection:selected', { uuid: col.uuid });
        }
    });
}

function positionPopover(popover, anchor) {
    const rect = anchor.getBoundingClientRect();
    popover.style.position = 'fixed';
    popover.style.top = (rect.bottom + 4) + 'px';
    popover.style.right = (window.innerWidth - rect.right) + 'px';
    popover.style.left = 'auto';
    popover.style.bottom = 'auto';
}

function handleMenuAction(action) {
    switch (action) {
        case 'import':
            state.emit('shortcut:import', {});
            break;
        case 'export':
            state.emit('shortcut:export', {});
            break;
        case 'preferences':
            state.emit('shortcut:preferences', {});
            break;
        case 'prune':
            state.emit('shortcut:prune', {});
            break;
        case 'about':
            alert('Zap Soundboard\nWeb version\n\nA soundboard app for streamers and videocasters.\nOriginally by Romain Vigier.\nWeb remaster by Farras Rayhand.');
            break;
    }
}

function renderCollectionsPopover() {
    collectionsPopoverList.innerHTML = '';
    for (const col of collectionsService.items) {
        const item = document.createElement('div');
        item.className = 'popover-item';
        item.textContent = col.name;
        item.addEventListener('click', () => {
            settings.set('lastSelectedCollection', col.uuid);
            state.emit('collection:selected', { uuid: col.uuid });
            collectionName.textContent = col.name;
            collectionsPopover.classList.add('hidden');
        });
        collectionsPopoverList.appendChild(item);
    }

    const sep = document.createElement('div');
    sep.className = 'popover-separator';
    collectionsPopoverList.appendChild(sep);

    const newItem = document.createElement('div');
    newItem.className = 'popover-item';
    newItem.textContent = '+ New Collection';
    newItem.addEventListener('click', async () => {
        const name = prompt('Collection name:');
        if (name && name.trim()) {
            const col = await collectionsService.add({ name: name.trim() });
            settings.set('lastSelectedCollection', col.uuid);
            state.emit('collection:selected', { uuid: col.uuid });
            collectionName.textContent = col.name;
            collectionsPopover.classList.add('hidden');
        }
    });
    collectionsPopoverList.appendChild(newItem);
}
