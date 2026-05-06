// SPDX-FileCopyrightText: 2026 Farras Rayhand <farrasrayhand@gmail.com>
//
// SPDX-License-Identifier: GPL-3.0-or-later

// fflate exposes global: fflate.gunzipSync, fflate.gzipSync

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const BLOCK = 512;

function padBlock(data) {
    const remainder = data.length % BLOCK;
    if (remainder === 0) return data;
    const padded = new Uint8Array(data.length + BLOCK - remainder);
    padded.set(data);
    return padded;
}

function tarSync(entries) {
    // entries: Record<string, Uint8Array>
    const blocks = [];

    for (const [name, data] of Object.entries(entries)) {
        const header = new Uint8Array(BLOCK);
        const nameBytes = encoder.encode(name);

        // name (100)
        header.set(nameBytes.slice(0, 100), 0);
        // mode (8) - 0644
        header.set(encoder.encode('000644 '), 100);
        // uid (8)
        header.set(encoder.encode('000000 '), 108);
        // gid (8)
        header.set(encoder.encode('000000 '), 116);
        // size (12) - octal
        const sizeOctal = data.length.toString(8).padStart(11, '0') + ' ';
        header.set(encoder.encode(sizeOctal), 124);
        // mtime (12)
        header.set(encoder.encode('00000000000 '), 136);
        // chksum (8) - filled with spaces initially for checksum calculation
        header.set(encoder.encode('        '), 148);
        // typeflag (1) - '0' for regular file
        header[156] = 48;
        // magic (6) - "ustar "
        header.set(encoder.encode('ustar '), 257);
        header[263] = 0; // version

        // Calculate checksum: sum of all bytes in header, treating chksum field as spaces
        let sum = 0;
        for (let i = 0; i < BLOCK; i++) {
            sum += (i >= 148 && i < 156) ? 32 : header[i]; // space (32) for chksum bytes
        }
        const chksumOctal = sum.toString(8).padStart(6, '0') + '\0 ';
        header.set(encoder.encode(chksumOctal), 148);

        blocks.push(header);
        blocks.push(padBlock(data));
    }

    // End marker: two zero blocks
    const endMarker = new Uint8Array(BLOCK * 2);
    blocks.push(endMarker);

    // Concatenate
    const totalSize = blocks.reduce((s, b) => s + b.length, 0);
    const result = new Uint8Array(totalSize);
    let offset = 0;
    for (const block of blocks) {
        result.set(block, offset);
        offset += block.length;
    }
    return result;
}

function untarSync(data) {
    const files = [];
    let offset = 0;

    while (offset < data.length) {
        const header = data.slice(offset, offset + BLOCK);

        // Check for end marker (all zeros in first two blocks)
        let allZero = true;
        for (let i = 0; i < 16; i++) {
            if (header[i] !== 0) { allZero = false; break; }
        }
        if (allZero) break;

        // Parse name
        let nameEnd = 0;
        while (nameEnd < 100 && header[nameEnd] !== 0) nameEnd++;
        const name = decoder.decode(header.slice(0, nameEnd));

        // Parse size (octal at bytes 124-135)
        let sizeEnd = 124;
        while (sizeEnd < 136 && header[sizeEnd] !== 0 && header[sizeEnd] !== 32) sizeEnd++;
        const sizeStr = decoder.decode(header.slice(124, sizeEnd));
        const size = parseInt(sizeStr, 8) || 0;

        offset += BLOCK;

        if (size > 0) {
            files.push({
                name,
                data: data.slice(offset, offset + size),
            });
            offset += Math.ceil(size / BLOCK) * BLOCK;
        } else {
            offset += 0;
        }
    }
    return files;
}

export async function extractZapFile(arrayBuffer) {
    const compressed = new Uint8Array(arrayBuffer);
    let tarData;
    try {
        tarData = fflate.gunzipSync(compressed);
    } catch (e) {
        throw new Error('Failed to decompress .zap file. The file may be corrupted or not a valid .zap archive.');
    }

    let files;
    try {
        files = untarSync(tarData);
    } catch (e) {
        throw new Error('Failed to extract .zap archive. ' + e.message);
    }

    // Build a map from filename to data, normalizing paths
    const fileMap = {};
    for (const file of files) {
        // Strip leading ./ if present (tar -C . produces ./metadata.json etc.)
        const name = file.name.replace(/^\.\//, '');
        fileMap[name] = file.data;
    }

    if (!fileMap['metadata.json'])
        throw new Error('Invalid .zap file: metadata.json missing.');

    const metadata = JSON.parse(decoder.decode(fileMap['metadata.json']));

    const SUPPORTED_VERSIONS = [1, 2, 3, 4, 5, 6];
    if (metadata.version && !SUPPORTED_VERSIONS.includes(metadata.version))
        throw new Error(`Unsupported export version: ${metadata.version}.`);

    // Separate sound files from metadata
    const sounds = {};
    for (const [name, data] of Object.entries(fileMap)) {
        const match = name.match(/^(?:\.\/)?sounds\/(.+)/);
        if (match) {
            sounds[match[1]] = data;
        }
    }

    return { metadata, sounds };
}

export async function createZapFile(collections, groups, zaps, settingsObj, audioLoader, onProgress) {
    const metadata = {
        version: 6,
        settings: {
            safetyMode: settingsObj.safetyMode ?? false,
            hideStopButton: settingsObj.hideStopButton ?? false,
            enablePause: settingsObj.enablePause ?? false,
            fadeoutDuration: settingsObj.fadeoutDuration ?? 1.0,
            stopHotkey: settingsObj.stopHotkey ?? '',
            fadeoutHotkey: settingsObj.fadeoutHotkey ?? '',
        },
        collections: collections.map(c => ({ uuid: c.uuid, name: c.name })),
        groups: groups.map(g => ({ uuid: g.uuid, name: g.name, collectionUuid: g.collectionUuid, position: g.position })),
        zaps: zaps.map(z => ({
            uuid: z.uuid,
            name: z.name,
            collectionUuid: z.collectionUuid,
            filename: z.originalFilename || `${z.uuid}.audio`,
            color: z.color,
            loop: z.loop,
            startTime: z.startTime || 0,
            volume: z.volume,
            position: z.position,
            groupName: z.groupName || '',
            hotkey: z.hotkey || '',
            nextSoundUuid: z.nextSoundUuid || '',
            gap: z.gap || 0,
        })),
    };

    const tarEntries = {};

    tarEntries['metadata.json'] = encoder.encode(JSON.stringify(metadata, null, 2));

    // Load audio blobs
    const total = zaps.length;
    for (let i = 0; i < total; i++) {
        const zap = zaps[i];
        if (onProgress) onProgress(i + 1, total);
        const audio = await audioLoader(zap);
        if (audio) {
            const filename = `sounds/${zap.originalFilename || `${zap.uuid}.audio`}`;
            tarEntries[filename] = new Uint8Array(audio);
        }
    }

    const tarData = tarSync(tarEntries);
    const gzipped = fflate.gzipSync(tarData);
    return new Blob([gzipped], { type: 'application/gzip' });
}

export function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
