// SPDX-FileCopyrightText: 2022 Romain Vigier <contact AT romainvigier.fr>
//
// SPDX-License-Identifier: GPL-3.0-or-later

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';

import { Color } from '../enums/Color.js';
import { Service } from './Service.js';

/**
 * Handles export and import of Zap configuration and sounds.
 */
export class Config extends Service {

    static {
        GObject.registerClass({ GTypeName: 'ZapConfig' }, this);
    }

    /**
     * Export all collections and zaps to a file.
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
            version: 1,
            collections: [],
            zaps: [],
        };

        for (let i = 0; i < globalThis.collections.get_n_items(); i++) {
            const col = globalThis.collections.get_item(i);
            metadata.collections.push({
                uuid: col.uuid,
                name: col.name,
            });
        }

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
            JSON.stringify(metadata, null, 2),
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
     * Import collections and zaps from a file.
     *
     * @param {Gio.File} file Source file.
     */
    async import(file) {
        console.debug(`Importing configuration from ${file.get_path()}...`);
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

            const colMap = new Map(); // Old UUID -> New Collection
            for (const colData of metadata.collections) {
                const collection = globalThis.collections.add({ name: colData.name });
                colMap.set(colData.uuid, collection);
            }

            const soundsDir = tempFile.get_child('sounds');
            for (const zapData of metadata.zaps) {
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
