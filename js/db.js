// SPDX-FileCopyrightText: 2026 Farras Rayhand <farrasrayhand@gmail.com>
//
// SPDX-License-Identifier: GPL-3.0-or-later

const DB_NAME = 'zap';
const DB_VERSION = 3;

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

                if (oldVersion < 3) {
                    const chunks = db.createObjectStore('decodedChunks', { keyPath: 'id' });
                    chunks.createIndex('by-file', 'fileId', { unique: false });
                    chunks.createIndex('by-file-channel', ['fileId', 'channel'], { unique: false });
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

    async _withTransaction(storeNames, mode, callback) {
        if (!this._db) await this.open();
        
        try {
            const tx = this._db.transaction(storeNames, mode);
            return await callback(tx);
        } catch (e) {
            // Firefox specific: "A mutation operation was attempted on a database that did not allow mutations."
            // This can happen if the database connection was lost, disk is full, or in private browsing.
            if (e.message?.includes('mutation') || e.name === 'InvalidStateError' || e.name === 'TransactionInactiveError') {
                console.warn('DB: Mutation failed, attempting to re-open database...', e);
                try { this.close(); } catch (closeErr) {}
                await this.open();
                const tx = this._db.transaction(storeNames, mode);
                return await callback(tx);
            }
            throw e;
        }
    }

    async getAll(storeName) {
        return this._withTransaction(storeName, 'readonly', (tx) => {
            return new Promise((resolve, reject) => {
                const store = tx.objectStore(storeName);
                const request = store.getAll();
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        });
    }

    async get(storeName, id) {
        return this._withTransaction(storeName, 'readonly', (tx) => {
            return new Promise((resolve, reject) => {
                const store = tx.objectStore(storeName);
                const request = store.get(id);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        });
    }

    async put(storeName, object) {
        return this._withTransaction(storeName, 'readwrite', (tx) => {
            return new Promise((resolve, reject) => {
                const store = tx.objectStore(storeName);
                const request = store.put(object);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        });
    }

    async delete(storeName, id) {
        return this._withTransaction(storeName, 'readwrite', (tx) => {
            return new Promise((resolve, reject) => {
                const store = tx.objectStore(storeName);
                const request = store.delete(id);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        });
    }

    async clear(storeName) {
        return this._withTransaction(storeName, 'readwrite', (tx) => {
            return new Promise((resolve, reject) => {
                const store = tx.objectStore(storeName);
                const request = store.clear();
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        });
    }

    async count(storeName) {
        return this._withTransaction(storeName, 'readonly', (tx) => {
            return new Promise((resolve, reject) => {
                const store = tx.objectStore(storeName);
                const request = store.count();
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        });
    }

    async getByIndex(storeName, indexName, value) {
        return this._withTransaction(storeName, 'readonly', (tx) => {
            return new Promise((resolve, reject) => {
                const store = tx.objectStore(storeName);
                const index = store.index(indexName);
                const request = index.getAll(value);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        });
    }

    async batchPut(storeName, objects) {
        return this._withTransaction(storeName, 'readwrite', (tx) => {
            return new Promise((resolve, reject) => {
                const store = tx.objectStore(storeName);
                for (const obj of objects)
                    store.put(obj);
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            });
        });
    }

    async batchDelete(storeName, ids) {
        return this._withTransaction(storeName, 'readwrite', (tx) => {
            return new Promise((resolve, reject) => {
                const store = tx.objectStore(storeName);
                for (const id of ids)
                    store.delete(id);
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            });
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
        const CHUNK_SIZE = 1024 * 1024; // 1M elements (~4MB) per chunk for better compatibility
        const channels = [];
        for (let c = 0; c < audioBuffer.numberOfChannels; c++) {
            channels.push(audioBuffer.getChannelData(c));
        }

        const metadata = {
            fileId,
            sampleRate: audioBuffer.sampleRate,
            numberOfChannels: audioBuffer.numberOfChannels,
            length: audioBuffer.length,
            timestamp: Date.now()
        };

        return this._withTransaction(['decodedAudio', 'decodedChunks'], 'readwrite', (tx) => {
            const metadataStore = tx.objectStore('decodedAudio');
            metadataStore.put(metadata);

            const chunkStore = tx.objectStore('decodedChunks');
            
            // First, delete existing chunks for this file
            const index = chunkStore.index('by-file');
            const cursorRequest = index.openKeyCursor(IDBKeyRange.only(fileId));
            cursorRequest.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    chunkStore.delete(cursor.primaryKey);
                    cursor.continue();
                }
            };

            // While the delete is happening (or after), start putting new chunks
            // IDB will queue these operations in the same transaction.
            console.debug(`DB: Storing ${audioBuffer.numberOfChannels} channels for ${fileId} in chunks...`);

            for (let c = 0; c < audioBuffer.numberOfChannels; c++) {
                const data = channels[c];
                let chunkIdx = 0;
                for (let i = 0; i < data.length; i += CHUNK_SIZE) {
                    const chunk = data.slice(i, i + CHUNK_SIZE);
                    chunkStore.put({
                        id: `${fileId}_${c}_${chunkIdx.toString().padStart(5, '0')}`, // Pad for correct sorting if needed
                        fileId,
                        channel: c,
                        index: chunkIdx,
                        data: chunk
                    });
                    chunkIdx++;
                }
            }

            return new Promise((resolve, reject) => {
                tx.oncomplete = () => {
                    console.debug(`DB: Finished storing chunks for ${fileId}`);
                    resolve();
                };
                tx.onerror = () => reject(tx.error);
                tx.onabort = () => reject(new Error('Transaction aborted'));
            });
        });
    }

    async getDecodedAudio(fileId, audioContext = null) {
        const metadata = await this.get('decodedAudio', fileId);
        if (!metadata) return null;

        return this._withTransaction('decodedChunks', 'readonly', async (tx) => {
            try {
                const store = tx.objectStore('decodedChunks');
                const index = store.index('by-file-channel');

                const channelPromises = [];
                for (let c = 0; c < metadata.numberOfChannels; c++) {
                    channelPromises.push(new Promise((resolve, reject) => {
                        const request = index.getAll(IDBKeyRange.only([fileId, c]));
                        request.onsuccess = () => resolve(request.result);
                        request.onerror = () => reject(request.error);
                    }));
                }

                const allChannelChunks = await Promise.all(channelPromises);
                
                let result;
                if (audioContext) {
                    // Reconstruct directly into AudioBuffer to save memory and copies
                    result = audioContext.createBuffer(metadata.numberOfChannels, metadata.length, metadata.sampleRate);
                } else {
                    result = { ...metadata, channels: [] };
                }

                const CHUNK_SIZE = 1024 * 1024;
                const expectedChunksPerChannel = Math.ceil(metadata.length / CHUNK_SIZE);

                for (let c = 0; c < metadata.numberOfChannels; c++) {
                    const channelChunks = allChannelChunks[c];
                    
                    if (channelChunks.length < expectedChunksPerChannel) {
                        console.warn(`DB: Incomplete chunks for ${fileId} channel ${c}. Expected ${expectedChunksPerChannel}, got ${channelChunks.length}.`);
                        return null; // Fallback to re-decoding
                    }

                    channelChunks.sort((a, b) => a.index - b.index);
                    
                    if (audioContext) {
                        let offset = 0;
                        for (const chunk of channelChunks) {
                            result.copyToChannel(chunk.data, c, offset);
                            offset += chunk.data.length;
                        }
                    } else {
                        const fullChannel = new Float32Array(metadata.length);
                        let offset = 0;
                        for (const chunk of channelChunks) {
                            fullChannel.set(chunk.data, offset);
                            offset += chunk.data.length;
                        }
                        result.channels.push(fullChannel);
                    }
                }
                return result;
            } catch (e) {
                console.error('Failed to reconstruct chunked audio:', e);
                return null;
            }
        });
    }

    async deleteDecodedAudio(fileId) {
        await this.delete('decodedAudio', fileId);
        await this._deleteChunks(fileId);
    }

    async _deleteChunks(fileId) {
        const chunks = await this.getByIndex('decodedChunks', 'by-file', fileId);
        if (chunks.length > 0) {
            await this.batchDelete('decodedChunks', chunks.map(c => c.id));
        }
    }

    async hasDecodedAudio(fileId) {
        const record = await this.get('decodedAudio', fileId);
        return !!record;
    }

    async clearDecodedCache() {
        console.log('DB: Clearing all decoded audio cache to free up space...');
        await Promise.all([
            this.clear('decodedAudio'),
            this.clear('decodedChunks')
        ]);
    }

    /**
     * Request persistent storage from the browser to increase quota limits.
     */
    static async requestPersistence() {
        if (navigator.storage && navigator.storage.persist) {
            const isPersisted = await navigator.storage.persist();
            console.log(`DB: Storage persistence ${isPersisted ? 'granted' : 'denied'}`);
            return isPersisted;
        }
        return false;
    }
}

export const db = new Database();
