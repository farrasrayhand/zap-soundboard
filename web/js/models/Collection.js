// SPDX-FileCopyrightText: 2022 Romain Vigier <contact AT romainvigier.fr>
// SPDX-FileCopyrightText: 2026 Farras Rayhand <farrasrayhand@gmail.com>
//
// SPDX-License-Identifier: GPL-3.0-or-later

export class Collection {
    constructor({ uuid = '', name = '' } = {}) {
        this.uuid = uuid || crypto.randomUUID();
        this.name = name;
    }

    toJSON() {
        return { uuid: this.uuid, name: this.name };
    }

    static fromJSON(json) {
        return new Collection(json);
    }
}
