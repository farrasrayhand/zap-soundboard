// SPDX-FileCopyrightText: 2022 Romain Vigier <contact AT romainvigier.fr>
// SPDX-FileCopyrightText: 2026 Farras Rayhand <farrasrayhand@gmail.com>
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { Color } from './Color.js';

const NS_PER_S = 1e9;

export class Zap {
    /**
     * @param {object} params
     */
    constructor({
        uuid = '',
        name = '',
        collectionUuid = '',
        fileId = '',
        originalFilename = '',
        color = 'gray',
        loop = false,
        volume = 1.0,
        startTime = 0,
        position = 0,
        groupName = '',
        hotkey = '',
        nextSoundUuid = '',
        gap = 0,
    } = {}) {
        this.uuid = uuid || crypto.randomUUID();
        this.name = name;
        this.collectionUuid = collectionUuid;
        this.fileId = fileId;
        this.originalFilename = originalFilename;
        this.color = color;
        this.loop = loop;
        this.volume = volume;
        this.startTime = startTime;
        this.position = position;
        this.groupName = groupName || '';
        this.hotkey = hotkey || '';
        this.nextSoundUuid = nextSoundUuid || '';
        this.gap = gap;

        // Runtime state (not persisted)
        this.playing = false;
        this.paused = false;
        this.progress = 0;
        this.positionTime = 0;
        this.durationTime = 0;
    }

    get colorObj() {
        return Color.fromId(this.color);
    }

    get startTimeSeconds() {
        return this.startTime / NS_PER_S;
    }

    get gapSeconds() {
        return this.gap / NS_PER_S;
    }

    get positionTimeSeconds() {
        return this.positionTime / NS_PER_S;
    }

    get durationTimeSeconds() {
        return this.durationTime / NS_PER_S;
    }

    toJSON() {
        return {
            uuid: this.uuid,
            name: this.name,
            collectionUuid: this.collectionUuid,
            fileId: this.fileId,
            originalFilename: this.originalFilename,
            color: this.color,
            loop: this.loop,
            volume: this.volume,
            startTime: this.startTime,
            position: this.position,
            groupName: this.groupName,
            hotkey: this.hotkey,
            nextSoundUuid: this.nextSoundUuid,
            gap: this.gap,
        };
    }

    static fromJSON(json) {
        return new Zap(json);
    }
}
