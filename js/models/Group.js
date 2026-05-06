// SPDX-FileCopyrightText: 2022 Romain Vigier <contact AT romainvigier.fr>
// SPDX-FileCopyrightText: 2026 Farras Rayhand <farrasrayhand@gmail.com>
//
// SPDX-License-Identifier: GPL-3.0-or-later

export class Group {
    constructor({ uuid = '', name = '', collectionUuid = '', position = 0 } = {}) {
        this.uuid = uuid || crypto.randomUUID();
        this.name = name;
        this.collectionUuid = collectionUuid;
        this.position = position;
    }

    toJSON() {
        return {
            uuid: this.uuid,
            name: this.name,
            collectionUuid: this.collectionUuid,
            position: this.position,
        };
    }

    static fromJSON(json) {
        return new Group(json);
    }
}
