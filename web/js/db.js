// SPDX-FileCopyrightText: 2026 Farras Rayhand <farrasrayhand@gmail.com>
//
// SPDX-License-Identifier: GPL-3.0-or-later

const DB_NAME = 'zap';
const DB_VERSION = 2;

export class Database {
    constructor() {
        this._db = null;
    }

    async open() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                const oldVersion = event.oldVersion;

                if (oldVersion < 1) {
                    const collections = db.createObjectStore('collections', { keyPath: 'uuid' });
                    collections.createIndex('by-name', 'name', { unique: false });

                    const groups = db.createObjectStore('groups', { keyPath: 'uuid' });
                    groups.createIndex('by-collection', 'collectionUuid', { unique: false });

                    const zaps = db.createObjectStore('zaps', { keyPath: 'uuid' });
                    zaps.createIndex('by-collection', 'collectionUuid', { unique: false });
                    zaps.createIndex('by-hotkey', 'hotkey', { unique: false });
                    zaps.createIndex('by-next-sound', 'nextSoundUuid', { unique: false });

                    db.createObjectStore('audioFiles', { keyPath: 'id' });
                }

                if (oldVersion < 2) {
                    db.createObjectStore('decodedAudio', { keyPath: 'fileId' });
                }
            };
            request.onsuccess = (event) => {
                this._db = event.target.result;
                resolve(this._db);
            };
            request.onerror = (event) => {
                reject(event.target.error);
            };
        });
    }

    close() {
        if (this._db) {
            this._db.close();
            this._db = null;
        }
    }

    // Generic CRUD

    async getAll(storeName) {
        return new Promise((resolve, reject) => {
            const tx = this._db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async get(storeName, id) {
        return new Promise((resolve, reject) => {
            const tx = this._db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const request = store.get(id);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async put(storeName, object) {
        return new Promise((resolve, reject) => {
            const tx = this._db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const request = store.put(object);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async delete(storeName, id) {
        return new Promise((resolve, reject) => {
            const tx = this._db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const request = store.delete(id);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async clear(storeName) {
        return new Promise((resolve, reject) => {
            const tx = this._db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const request = store.clear();
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async count(storeName) {
        return new Promise((resolve, reject) => {
            const tx = this._db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const request = store.count();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getByIndex(storeName, indexName, value) {
        return new Promise((resolve, reject) => {
            const tx = this._db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const index = store.index(indexName);
            const request = index.getAll(value);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async batchPut(storeName, objects) {
        return new Promise((resolve, reject) => {
            const tx = this._db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            for (const obj of objects)
                store.put(obj);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    async batchDelete(storeName, ids) {
        return new Promise((resolve, reject) => {
            const tx = this._db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            for (const id of ids)
                store.delete(id);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    // Audio file helpers

    async storeAudioBlob(id, blob, filename, mimeType) {
        const record = {
            id,
            blob,
            filename,
            mimeType,
            size: blob.size,
            importedAt: Date.now(),
        };
        return this.put('audioFiles', record);
    }

    async getAudioBlob(id) {
        const record = await this.get('audioFiles', id);
        return record ? record.blob : null;
    }

    async deleteAudioBlob(id) {
        return this.delete('audioFiles', id);
    }

    async pruneOrphanedAudioFiles(usedFileIds) {
        const all = await this.getAll('audioFiles');
        const toDelete = all.filter(f => !usedFileIds.has(f.id)).map(f => f.id);
        let freed = 0;
        for (const f of all) {
            if (!usedFileIds.has(f.id))
                freed += f.size || 0;
        }
        if (toDelete.length > 0)
            await this.batchDelete('audioFiles', toDelete);
        return { removed: toDelete.length, freed };
    }

    // Decoded audio PCM cache (persistent)
    async storeDecodedAudio(fileId, audioBuffer) {
        const channels = [];
        for (let c = 0; c < audioBuffer.numberOfChannels; c++)
            channels.push(audioBuffer.getChannelData(c));
        await this.put('decodedAudio', {
            fileId,
            sampleRate: audioBuffer.sampleRate,
            numberOfChannels: audioBuffer.numberOfChannels,
            length: audioBuffer.length,
            channels,
        });
    }

    async getDecodedAudio(fileId) {
        return this.get('decodedAudio', fileId);
    }

    async deleteDecodedAudio(fileId) {
        return this.delete('decodedAudio', fileId);
    }

    async hasDecodedAudio(fileId) {
        const record = await this.get('decodedAudio', fileId);
        return !!record;
    }
}

export const db = new Database();
