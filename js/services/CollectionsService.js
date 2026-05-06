// SPDX-FileCopyrightText: 2022 Romain Vigier <contact AT romainvigier.fr>
// SPDX-FileCopyrightText: 2026 Farras Rayhand <farrasrayhand@gmail.com>
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { state } from '../state.js';
import { db } from '../db.js';
import { Collection } from '../models/Collection.js';

class CollectionsService {
    constructor() {
        this._items = [];
    }

    async load() {
        const raw = await db.getAll('collections');
        this._items = raw.map(r => Collection.fromJSON(r));
        if (this._items.length === 0) {
            await this.add({ name: 'Zaps' });
        } else {
            state.emit('collections:loaded', { collections: this._items });
        }
    }

    get items() {
        return this._items;
    }

    get count() {
        return this._items.length;
    }

    find(query) {
        if (query.uuid)
            return this._items.find(c => c.uuid === query.uuid);
        if (query.name)
            return this._items.find(c => c.name === query.name);
        return null;
    }

    findAll(query) {
        if (query.name)
            return this._items.filter(c => c.name === query.name);
        return [...this._items];
    }

    async add({ name, uuid = null }) {
        const collection = new Collection({ name, uuid: uuid || undefined });
        await db.put('collections', collection.toJSON());
        this._items.push(collection);
        state.emit('collection:added', { uuid: collection.uuid, name: collection.name });
        return collection;
    }

    async rename(uuid, newName) {
        const collection = this.find({ uuid });
        if (!collection) throw new Error('Collection not found');
        collection.name = newName;
        await db.put('collections', collection.toJSON());
        state.emit('collection:updated', { uuid, name: newName });
    }

    async remove(uuid) {
        const idx = this._items.findIndex(c => c.uuid === uuid);
        if (idx === -1) throw new Error('Collection not found');
        this._items.splice(idx, 1);
        await db.delete('collections', uuid);
        state.emit('collection:removed', { uuid });
    }

    getItem(index) {
        return this._items[index] || null;
    }

    get_n_items() {
        return this._items.length;
    }
}

export const collectionsService = new CollectionsService();
