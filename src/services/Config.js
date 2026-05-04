// SPDX-FileCopyrightText: 2022 Romain Vigier <contact AT romainvigier.fr>
// SPDX-FileCopyrightText: 2026 Farras Rayhand <farrasrayhand@gmail.com>
//
// SPDX-License-Identifier: GPL-3.0-or-later

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';

import { Color } from '../enums/Color.js';
import { Service } from './Service.js';

/**
 * Handles export and import of Zap configuration, groups and sounds.
 */
export class Config extends Service {

    static {
        GObject.registerClass({ GTypeName: 'ZapConfig' }, this);
    }

    /**
     * Export all collections, groups and zaps to a file.
     *
     * @param {Gio.File} file Destination file.
     */
    async export(file) {
        console.debug(`Exporting configuration to ${file.get_path()}...`);
        const tempDir = GLib.dir_make_tmp('zap-export-XXXXXX');
        const tempFile = Gio.File.new_for_path(tempDir);
        const soundsDir = tempFile.get_child('sounds');
        soundsDir.make_directory(null);

        const metadata = {
            version: 4,
            settings: {
                safetyMode: globalThis.settings.get_boolean('safety-mode'),
                hideStopButton: globalThis.settings.get_boolean('hide-stop-button'),
                enablePause: globalThis.settings.get_boolean('enable-pause'),
                fadeoutDuration: globalThis.settings.get_double('fadeout-duration'),
                stopHotkey: globalThis.settings.get_string('stop-hotkey'),
                fadeoutHotkey: globalThis.settings.get_string('fadeout-hotkey'),
                windowWidth: globalThis.settings.get_uint('window-width'),
                windowHeight: globalThis.settings.get_uint('window-height'),
                windowMaximized: globalThis.settings.get_boolean('window-maximized'),
                lastSelectedCollection: globalThis.settings.get_string('last-selected-collection'),
            },
            collections: [],
            groups: [],
            zaps: [],
        };

        // Export Collections
        for (let i = 0; i < globalThis.collections.get_n_items(); i++) {
            const col = globalThis.collections.get_item(i);
            metadata.collections.push({
                uuid: col.uuid,
                name: col.name,
            });
        }

        // Export Persistent Groups
        globalThis.zaps.groups.forEach(group => {
            metadata.groups.push({
                uuid: group.uuid,
                name: group.name,
                collectionUuid: group.collectionUuid,
                position: group.position,
            });
        });

        // Export Zaps
        for (let i = 0; i < globalThis.zaps.get_n_items(); i++) {
            const zap = globalThis.zaps.get_item(i);
            const filename = zap.file.get_basename();
            metadata.zaps.push({
                uuid: zap.uuid,
                name: zap.name,
                collectionUuid: zap.collectionUuid,
                filename,
                color: zap.color.id,
                loop: zap.loop,
                volume: zap.volume,
                position: zap.position,
                groupName: zap.groupName || '', // Include group assignment
                hotkey: zap.hotkey || '',
            });

            // Copy sound file
            const destSound = soundsDir.get_child(filename);
            try {
                zap.file.copy(destSound, Gio.FileCopyFlags.OVERWRITE, null, null);
            } catch (e) {
                console.warn(`Could not copy sound file ${filename}: ${e.message}`);
            }
        }

        const metadataFile = tempFile.get_child('metadata.json');
        metadataFile.replace_contents(
            new TextEncoder().encode(JSON.stringify(metadata, null, 2)),
            null,
            false,
            Gio.FileCreateFlags.NONE,
            null
        );

        // Tar it up
        try {
            const tarPath = file.get_path();
            await this.#runCommand(['tar', '-czf', tarPath, '-C', tempDir, '.']);
            console.debug('Configuration exported successfully.');
        } finally {
            this.#deleteRecursive(tempFile);
        }
    }

    /**
     * Get metadata from an export file without importing everything.
     *
     * @param {Gio.File} file Source file.
     * @returns {Promise<object>} Metadata.
     */
    async getMetadata(file) {
        const tempDir = GLib.dir_make_tmp('zap-preview-XXXXXX');
        const tempFile = Gio.File.new_for_path(tempDir);

        try {
            const tarPath = file.get_path();
            // Only extract metadata.json
            await this.#runCommand(['tar', '-xzf', tarPath, '-C', tempDir, './metadata.json']);

            const metadataFile = tempFile.get_child('metadata.json');
            const [ok, contents] = metadataFile.load_contents(null);
            return JSON.parse(new TextDecoder().decode(contents));
        } finally {
            this.#deleteRecursive(tempFile);
        }
    }

    /**
     * Import collections, groups and zaps from a file.
     *
     * @param {Gio.File} file Source file.
     * @param {boolean} replace Whether to replace collections with same name.
     */
    async import(file, replace = false) {
        console.debug(`Importing configuration from ${file.get_path()}... (replace: ${replace})`);
        const tempDir = GLib.dir_make_tmp('zap-import-XXXXXX');
        const tempFile = Gio.File.new_for_path(tempDir);

        try {
            const tarPath = file.get_path();
            await this.#runCommand(['tar', '-xzf', tarPath, '-C', tempDir]);

            const metadataFile = tempFile.get_child('metadata.json');
            if (!metadataFile.query_exists(null))
                throw new Error('Invalid export file: metadata.json missing.');

            const [ok, contents] = metadataFile.load_contents(null);
            const metadata = JSON.parse(new TextDecoder().decode(contents));

            const SUPPORTED_VERSIONS = [1, 2, 3, 4];
            if (metadata.version && !SUPPORTED_VERSIONS.includes(metadata.version))
                throw new Error(`Unsupported export version: ${metadata.version}. Please update the app.`);

            // Import Application Settings
            if (metadata.settings) {
                if (metadata.settings.safetyMode !== undefined) {
                    globalThis.settings.set_boolean('safety-mode', metadata.settings.safetyMode);
                }
                if (metadata.settings.hideStopButton !== undefined) {
                    globalThis.settings.set_boolean('hide-stop-button', metadata.settings.hideStopButton);
                }
                if (metadata.settings.enablePause !== undefined) {
                    globalThis.settings.set_boolean('enable-pause', metadata.settings.enablePause);
                }
                if (metadata.settings.fadeoutDuration !== undefined) {
                    globalThis.settings.set_double('fadeout-duration', metadata.settings.fadeoutDuration);
                }
                if (metadata.settings.stopHotkey !== undefined) {
                    globalThis.settings.set_string('stop-hotkey', metadata.settings.stopHotkey);
                }
                if (metadata.settings.fadeoutHotkey !== undefined) {
                    globalThis.settings.set_string('fadeout-hotkey', metadata.settings.fadeoutHotkey);
                }
                if (metadata.settings.windowWidth !== undefined) {
                    globalThis.settings.set_uint('window-width', metadata.settings.windowWidth);
                }
                if (metadata.settings.windowHeight !== undefined) {
                    globalThis.settings.set_uint('window-height', metadata.settings.windowHeight);
                }
                if (metadata.settings.windowMaximized !== undefined) {
                    globalThis.settings.set_boolean('window-maximized', metadata.settings.windowMaximized);
                }
                if (metadata.settings.lastSelectedCollection !== undefined) {
                    globalThis.settings.set_string('last-selected-collection', metadata.settings.lastSelectedCollection);
                }
            }

            const colMap = new Map(); // Old Collection UUID -> New Collection Object

            for (const colData of metadata.collections) {
                let collection = null;

                // Handle replacement
                if (replace) {
                    for (let i = 0; i < globalThis.collections.get_n_items(); i++) {
                        const existing = globalThis.collections.get_item(i);
                        if (existing.name === colData.name) {
                            // Clear existing content instead of removing the collection
                            // This prevents auto-recreation of default collection
                            globalThis.zaps.removeAllOfCollection({ collection: existing, deleteFiles: false });
                            collection = existing;
                            break;
                        }
                    }
                }

                if (!collection) {
                    collection = globalThis.collections.add({
                        name: colData.name,
                        uuid: colData.uuid,
                    });
                }
                colMap.set(colData.uuid, collection);
            }

            // Import Groups if present (version 2+)
            if (metadata.groups) {
                for (const groupData of metadata.groups) {
                    const collection = colMap.get(groupData.collectionUuid);
                    if (collection) {
                        globalThis.zaps.addGroup({
                            name: groupData.name,
                            collectionUuid: collection.uuid,
                            uuid: groupData.uuid,
                            position: groupData.position,
                        });
                    }
                }
            }

            const soundsDir = tempFile.get_child('sounds');
            for (const zapData of metadata.zaps) {
                // Check if zap already exists locally to avoid unintended movements/duplicates
                let existingZap = null;
                try {
                    existingZap = globalThis.zaps.find({ uuid: zapData.uuid });
                } catch (e) {
                    // Zap not found, this is fine
                }

                if (existingZap) {
                    const collection = colMap.get(zapData.collectionUuid);
                    if (existingZap.collectionUuid === collection?.uuid) {
                        console.debug(`Zap "${zapData.name}" already exists in the same collection, skipping.`);
                        continue;
                    }
                    console.debug(`Zap "${zapData.name}" (UUID: ${zapData.uuid}) already exists in another collection ("${existingZap.collectionUuid}"), skipping to avoid movement.`);
                    continue;
                }

                const soundFile = soundsDir.get_child(zapData.filename);
                if (soundFile.query_exists(null)) {
                    const collection = colMap.get(zapData.collectionUuid);
                    if (collection) {
                        globalThis.zaps.add({
                            name: zapData.name,
                            collection,
                            uri: soundFile.get_uri(),
                            color: Color.fromId(zapData.color),
                            loop: zapData.loop,
                            volume: zapData.volume,
                            groupName: zapData.groupName || '',
                            hotkey: zapData.hotkey || '',
                            uuid: zapData.uuid,
                            position: zapData.position,
                        });
                    }
                }
            }
            console.debug('Configuration imported successfully.');
        } finally {
            this.#deleteRecursive(tempFile);
        }
    }

    /**
     * Run a subprocess and wait for it to finish.
     *
     * @param {string[]} argv Arguments.
     * @returns {Promise<string>} Stdout.
     */
    #runCommand(argv) {
        const proc = new Gio.Subprocess({
            argv,
            flags: Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE,
        });
        proc.init(null);
        return new Promise((resolve, reject) => {
            proc.communicate_utf8_async(null, null, (p, res) => {
                try {
                    const [ok, stdout, stderr] = p.communicate_utf8_finish(res);
                    if (p.get_if_exited() && p.get_exit_status() === 0)
                        resolve(stdout);
                    else
                        reject(new Error(stderr || 'Command failed'));
                } catch (e) {
                    reject(e);
                }
            });
        });
    }

    /**
     * Recursively delete a file or directory.
     *
     * @param {Gio.File} file File or directory to delete.
     */
    #deleteRecursive(file) {
        try {
            const info = file.query_info('standard::type', Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS, null);
            if (info.get_file_type() === Gio.FileType.DIRECTORY) {
                const enumerator = file.enumerate_children('standard::name', Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS, null);
                let childInfo;
                while ((childInfo = enumerator.next_file(null)) !== null) {
                    const child = file.get_child(childInfo.get_name());
                    this.#deleteRecursive(child);
                }
            }
            file.delete(null);
        } catch (e) {
            console.warn(`Failed to delete ${file.get_path()}: ${e.message}`);
        }
    }

}
