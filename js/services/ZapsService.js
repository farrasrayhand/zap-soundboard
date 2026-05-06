// SPDX-FileCopyrightText: 2022 Romain Vigier <contact AT romainvigier.fr>
// SPDX-FileCopyrightText: 2026 Farras Rayhand <farrasrayhand@gmail.com>
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { state } from '../state.js';
import { db } from '../db.js';
import { Zap } from '../models/Zap.js';
import { Group } from '../models/Group.js';
import { Color } from '../models/Color.js';

class ZapsService {
    constructor() {
        this._zaps = [];
        this._groups = [];
    }

    async load() {
        const [rawZaps, rawGroups] = await Promise.all([
            db.getAll('zaps'),
            db.getAll('groups'),
        ]);
        this._zaps = rawZaps.map(r => Zap.fromJSON(r));
        this._groups = rawGroups.map(r => Group.fromJSON(r));
        if (this._zaps.length > 0 || this._groups.length > 0) {
            state.emit('zaps:loaded', {});
            state.emit('groups:loaded', {});
        }
    }

    get zaps() { return this._zaps; }
    get groups() { return this._groups; }

    get count() { return this._zaps.length; }

    find(query) {
        if (query.uuid !== undefined)
            return this._zaps.find(z => z.uuid === query.uuid);
        return null;
    }

    async add({
        name, collection, file = null, uri = null,
        color = 'gray', loop = false, startTime = 0,
        volume = 1.0, groupName = '', hotkey = '',
        nextSoundUuid = '', gap = 0, uuid = null,
        position = null, fileId = null, originalFilename = null,
    }) {
        const collectionUuid = typeof collection === 'string' ? collection : collection.uuid;
        let resolvedFileId = fileId || '';
        let resolvedFilename = originalFilename || '';

        if (file) {
            resolvedFileId = crypto.randomUUID();
            resolvedFilename = file.name;
            try {
                await db.storeAudioBlob(resolvedFileId, file, file.name, file.type || 'audio/ogg');
            } catch (e) {
                if (e.name === 'QuotaExceededError') {
                    state.emit('error', { message: 'Storage full. Please free up space or use Prune to remove unused files.' });
                    return null;
                }
                throw e;
            }
        }

        const pos = position !== null ? position : this._zaps.filter(z => z.collectionUuid === collectionUuid).length;
        const zap = new Zap({
            uuid: uuid || undefined,
            name,
            collectionUuid,
            fileId: resolvedFileId,
            originalFilename: resolvedFilename,
            color,
            loop,
            startTime,
            volume,
            position: pos,
            groupName,
            hotkey,
            nextSoundUuid,
            gap,
        });

        await db.put('zaps', zap.toJSON());
        this._zaps.push(zap);

        // Auto-create group if it doesn't exist
        if (groupName && !this._groups.find(g => g.name === groupName && g.collectionUuid === collectionUuid)) {
            await this.addGroup({ name: groupName, collectionUuid, position: this._groups.length });
        }

        state.emit('zap:added', { uuid: zap.uuid });
        return zap;
    }

    async remove(uuid) {
        const idx = this._zaps.findIndex(z => z.uuid === uuid);
        if (idx === -1) throw new Error('Zap not found');
        const zap = this._zaps[idx];
        this._zaps.splice(idx, 1);
        await db.delete('zaps', uuid);
        if (zap.fileId)
            await db.deleteAudioBlob(zap.fileId);
        state.emit('zap:removed', { uuid });
    }

    async updateProperty(uuid, property, value) {
        const zap = this.find({ uuid });
        if (!zap) throw new Error('Zap not found');

        switch (property) {
            case 'name': zap.name = value; break;
            case 'color': zap.color = value; break;
            case 'loop': zap.loop = value; break;
            case 'volume': zap.volume = value; break;
            case 'startTime': zap.startTime = value; break;
            case 'position': zap.position = value; break;
            case 'groupName': zap.groupName = value || ''; break;
            case 'hotkey': zap.hotkey = value || ''; break;
            case 'nextSoundUuid': zap.nextSoundUuid = value || ''; break;
            case 'gap': zap.gap = value; break;
            case 'collectionUuid': zap.collectionUuid = value; break;
            default: throw new Error(`Unknown property: ${property}`);
        }

        await db.put('zaps', zap.toJSON());
        state.emit('zap:updated', { uuid, property, value });
    }

    async moveToCollection(uuid, newCollectionUuid) {
        const zap = this.find({ uuid });
        if (!zap) throw new Error('Zap not found');
        zap.collectionUuid = newCollectionUuid;
        await db.put('zaps', zap.toJSON());
        state.emit('zap:updated', { uuid, property: 'collectionUuid', value: newCollectionUuid });
    }

    async removeAllOfCollection(collectionUuid) {
        const toRemove = this._zaps.filter(z => z.collectionUuid === collectionUuid);
        const toRemoveGroups = this._groups.filter(g => g.collectionUuid === collectionUuid);

        for (const zap of toRemove) {
            await db.delete('zaps', zap.uuid);
            if (zap.fileId)
                await db.deleteAudioBlob(zap.fileId);
        }
        this._zaps = this._zaps.filter(z => z.collectionUuid !== collectionUuid);

        if (toRemoveGroups.length > 0) {
            const groupUuids = toRemoveGroups.map(g => g.uuid);
            await db.batchDelete('groups', groupUuids);
            this._groups = this._groups.filter(g => g.collectionUuid !== collectionUuid);
        }

        state.emit('zaps:loaded', {});
        state.emit('groups:loaded', {});
    }

    // Group methods

    async addGroup({ name, collectionUuid, uuid = null, position = null }) {
        const group = new Group({
            uuid: uuid || undefined,
            name,
            collectionUuid,
            position: position !== null ? position : this._groups.filter(g => g.collectionUuid === collectionUuid).length,
        });
        await db.put('groups', group.toJSON());
        this._groups.push(group);
        state.emit('group:added', { uuid: group.uuid });
        state.emit('groups-changed', {});
        return group;
    }

    async renameGroup(uuid, newName) {
        const group = this._groups.find(g => g.uuid === uuid);
        if (!group) throw new Error('Group not found');
        const oldName = group.name;
        group.name = newName;
        await db.put('groups', group.toJSON());

        // Update all zaps in this group
        const groupZaps = this._zaps.filter(z => z.groupName === oldName && z.collectionUuid === group.collectionUuid);
        for (const zap of groupZaps) {
            zap.groupName = newName;
            await db.put('zaps', zap.toJSON());
        }

        state.emit('group:updated', { uuid });
        state.emit('groups-changed', {});
    }

    async removeGroup(uuid) {
        const group = this._groups.find(g => g.uuid === uuid);
        if (!group) throw new Error('Group not found');

        // Move zaps out of this group
        const groupZaps = this._zaps.filter(z => z.groupName === group.name && z.collectionUuid === group.collectionUuid);
        for (const zap of groupZaps) {
            zap.groupName = '';
            await db.put('zaps', zap.toJSON());
        }

        this._groups = this._groups.filter(g => g.uuid !== uuid);
        await db.delete('groups', uuid);
        state.emit('group:removed', { uuid });
        state.emit('groups-changed', {});
    }

    async moveGroup(uuid, direction) {
        const idx = this._groups.findIndex(g => g.uuid === uuid);
        if (idx === -1) return;

        const group = this._groups[idx];
        const sameColl = this._groups.filter(g => g.collectionUuid === group.collectionUuid).sort((a, b) => a.position - b.position);

        const localIdx = sameColl.findIndex(g => g.uuid === uuid);
        const targetIdx = localIdx + direction;
        if (targetIdx < 0 || targetIdx >= sameColl.length) return;

        [sameColl[localIdx], sameColl[targetIdx]] = [sameColl[targetIdx], sameColl[localIdx]];
        for (let i = 0; i < sameColl.length; i++) {
            sameColl[i].position = i;
            await db.put('groups', sameColl[i].toJSON());
        }

        state.emit('groups-changed', {});
    }

    getGroupNames(collectionUuid) {
        return this._groups
            .filter(g => g.collectionUuid === collectionUuid)
            .sort((a, b) => a.position - b.position)
            .map(g => g.name);
    }
}

export const zapsService = new ZapsService();
