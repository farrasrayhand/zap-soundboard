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
    YELLOW: {
        id: 'yellow',
        name: _('Yellow'),
        rgba: {
            light: new Gdk.RGBA({ red: 0.988, green: 0.914, blue: 0.310, alpha: 1 }),
            dark: new Gdk.RGBA({ red: 0.988, green: 0.914, blue: 0.310, alpha: 1 }),
        },
    },
    BROWN: {
        id: 'brown',
        name: _('Brown'),
        rgba: {
            light: new Gdk.RGBA({ red: 0.592, green: 0.353, blue: 0.169, alpha: 1 }),
            dark: new Gdk.RGBA({ red: 0.592, green: 0.353, blue: 0.169, alpha: 1 }),
        },
    },
    PINK: {
        id: 'pink',
        name: _('Pink'),
        rgba: {
            light: new Gdk.RGBA({ red: 1.000, green: 0.525, blue: 0.651, alpha: 1 }),
            dark: new Gdk.RGBA({ red: 1.000, green: 0.525, blue: 0.651, alpha: 1 }),
        },
    },
    TEAL: {
        id: 'teal',
        name: _('Teal'),
        rgba: {
            light: new Gdk.RGBA({ red: 0.200, green: 0.761, blue: 0.761, alpha: 1 }),
            dark: new Gdk.RGBA({ red: 0.200, green: 0.761, blue: 0.761, alpha: 1 }),
        },
    },
    LIME: {
        id: 'lime',
        name: _('Lime'),
        rgba: {
            light: new Gdk.RGBA({ red: 0.749, green: 0.914, blue: 0.200, alpha: 1 }),
            dark: new Gdk.RGBA({ red: 0.749, green: 0.914, blue: 0.200, alpha: 1 }),
        },
    },
    CYAN: {
        id: 'cyan',
        name: _('Cyan'),
        rgba: {
            light: new Gdk.RGBA({ red: 0.310, green: 0.988, blue: 0.988, alpha: 1 }),
            dark: new Gdk.RGBA({ red: 0.310, green: 0.988, blue: 0.988, alpha: 1 }),
        },
    },
    INDIGO: {
        id: 'indigo',
        name: _('Indigo'),
        rgba: {
            light: new Gdk.RGBA({ red: 0.294, green: 0.000, blue: 0.510, alpha: 1 }),
            dark: new Gdk.RGBA({ red: 0.294, green: 0.000, blue: 0.510, alpha: 1 }),
        },
    },
    MAGENTA: {
        id: 'magenta',
        name: _('Magenta'),
        rgba: {
            light: new Gdk.RGBA({ red: 1.000, green: 0.000, blue: 1.000, alpha: 1 }),
            dark: new Gdk.RGBA({ red: 1.000, green: 0.000, blue: 1.000, alpha: 1 }),
        },
    },
    GOLD: {
        id: 'gold',
        name: _('Gold'),
        rgba: {
            light: new Gdk.RGBA({ red: 1.000, green: 0.843, blue: 0.000, alpha: 1 }),
            dark: new Gdk.RGBA({ red: 1.000, green: 0.843, blue: 0.000, alpha: 1 }),
        },
    },
    SKY: {
        id: 'sky',
        name: _('Sky'),
        rgba: {
            light: new Gdk.RGBA({ red: 0.529, green: 0.808, blue: 0.922, alpha: 1 }),
            dark: new Gdk.RGBA({ red: 0.529, green: 0.808, blue: 0.922, alpha: 1 }),
        },
    },
    MINT: {
        id: 'mint',
        name: _('Mint'),
        rgba: {
            light: new Gdk.RGBA({ red: 0.600, green: 1.000, blue: 0.600, alpha: 1 }),
            dark: new Gdk.RGBA({ red: 0.600, green: 1.000, blue: 0.600, alpha: 1 }),
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
