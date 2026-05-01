// SPDX-FileCopyrightText: 2022 Romain Vigier <contact AT romainvigier.fr>
//
// SPDX-License-Identifier: GPL-3.0-or-later

import Gdk from 'gi://Gdk';


/**
 * @typedef {object} ColorDetails
 * @property {string} id Identifier.
 * @property {string} name Localized name.
 * @property {object} rgba RGBA values.
 * @property {Gdk.RGBA} rgba.light RGBA values for light style.
 * @property {Gdk.RGBA} rgba.dark RGBA values for dark style.
 */
/**
 * Possible Zap colors.
 *
 * @enum {ColorDetails}
 */
export const Color = {
    GRAY: {
        id: 'gray',
        name: _('Gray'),
        rgba: {
            light: new Gdk.RGBA({ red: 0.700, green: 0.700, blue: 0.700, alpha: 1 }),
            dark: new Gdk.RGBA({ red: 0.400, green: 0.400, blue: 0.400, alpha: 1 }),
        },
    },
    RED: {
        id: 'red',
        name: _('Red'),
        rgba: {
            light: new Gdk.RGBA({ red: 0.929, green: 0.200, blue: 0.231, alpha: 1 }),
            dark: new Gdk.RGBA({ red: 0.929, green: 0.200, blue: 0.231, alpha: 1 }),
        },
    },
    ORANGE: {
        id: 'orange',
        name: _('Orange'),
        rgba: {
            light: new Gdk.RGBA({ red: 1.000, green: 0.639, blue: 0.282, alpha: 1 }),
            dark: new Gdk.RGBA({ red: 1.000, green: 0.639, blue: 0.282, alpha: 1 }),
        },
    },
    GREEN: {
        id: 'green',
        name: _('Green'),
        rgba: {
            light: new Gdk.RGBA({ red: 0.341, green: 0.890, blue: 0.537, alpha: 1 }),
            dark: new Gdk.RGBA({ red: 0.341, green: 0.890, blue: 0.537, alpha: 1 }),
        },
    },
    BLUE: {
        id: 'blue',
        name: _('Blue'),
        rgba: {
            light: new Gdk.RGBA({ red: 0.208, green: 0.518, blue: 0.894, alpha: 1 }),
            dark: new Gdk.RGBA({ red: 0.208, green: 0.518, blue: 0.894, alpha: 1 }),
        },
    },
    PURPLE: {
        id: 'purple',
        name: _('Purple'),
        rgba: {
            light: new Gdk.RGBA({ red: 0.753, green: 0.380, blue: 0.796, alpha: 1 }),
            dark: new Gdk.RGBA({ red: 0.753, green: 0.380, blue: 0.796, alpha: 1 }),
        },
    },
};

Object.defineProperties(Color, {
    fromId: {
        value: id => Object.values(Color).find(color => color.id === id) || Color.GRAY,
    },
    forEach: {
        value: (cb, thisArg) => Object.values(Color).forEach((...args) => cb(...args), thisArg),
    },
});
