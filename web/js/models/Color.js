// SPDX-FileCopyrightText: 2022 Romain Vigier <contact AT romainvigier.fr>
// SPDX-FileCopyrightText: 2026 Farras Rayhand <farrasrayhand@gmail.com>
//
// SPDX-License-Identifier: GPL-3.0-or-later

export const Color = {
    GRAY: {
        id: 'gray',
        name: 'Gray',
        rgba: {
            light: 'rgba(191,191,191,1)',
            dark: 'rgba(191,191,191,1)',
        },
    },
    RED: {
        id: 'red',
        name: 'Red',
        rgba: {
            light: 'rgba(237,51,59,1)',
            dark: 'rgba(255,77,89,1)',
        },
    },
    ORANGE: {
        id: 'orange',
        name: 'Orange',
        rgba: {
            light: 'rgba(255,163,72,1)',
            dark: 'rgba(255,179,77,1)',
        },
    },
    GREEN: {
        id: 'green',
        name: 'Green',
        rgba: {
            light: 'rgba(87,227,137,1)',
            dark: 'rgba(89,255,140,1)',
        },
    },
    BLUE: {
        id: 'blue',
        name: 'Blue',
        rgba: {
            light: 'rgba(53,132,228,1)',
            dark: 'rgba(64,166,255,1)',
        },
    },
    PURPLE: {
        id: 'purple',
        name: 'Purple',
        rgba: {
            light: 'rgba(192,97,203,1)',
            dark: 'rgba(217,115,230,1)',
        },
    },
    YELLOW: {
        id: 'yellow',
        name: 'Yellow',
        rgba: {
            light: 'rgba(252,233,79,1)',
            dark: 'rgba(255,242,89,1)',
        },
    },
    BROWN: {
        id: 'brown',
        name: 'Brown',
        rgba: {
            light: 'rgba(151,90,43,1)',
            dark: 'rgba(217,140,64,1)',
        },
    },
    PINK: {
        id: 'pink',
        name: 'Pink',
        rgba: {
            light: 'rgba(255,134,166,1)',
            dark: 'rgba(255,140,179,1)',
        },
    },
    TEAL: {
        id: 'teal',
        name: 'Teal',
        rgba: {
            light: 'rgba(51,194,194,1)',
            dark: 'rgba(51,230,230,1)',
        },
    },
    LIME: {
        id: 'lime',
        name: 'Lime',
        rgba: {
            light: 'rgba(191,233,51,1)',
            dark: 'rgba(204,242,64,1)',
        },
    },
    CYAN: {
        id: 'cyan',
        name: 'Cyan',
        rgba: {
            light: 'rgba(79,252,252,1)',
            dark: 'rgba(77,255,255,1)',
        },
    },
    INDIGO: {
        id: 'indigo',
        name: 'Indigo',
        rgba: {
            light: 'rgba(75,0,130,1)',
            dark: 'rgba(153,89,255,1)',
        },
    },
    MAGENTA: {
        id: 'magenta',
        name: 'Magenta',
        rgba: {
            light: 'rgba(255,0,255,1)',
            dark: 'rgba(255,64,255,1)',
        },
    },
    GOLD: {
        id: 'gold',
        name: 'Gold',
        rgba: {
            light: 'rgba(255,215,0,1)',
            dark: 'rgba(255,224,26,1)',
        },
    },
    SKY: {
        id: 'sky',
        name: 'Sky',
        rgba: {
            light: 'rgba(135,206,235,1)',
            dark: 'rgba(140,217,255,1)',
        },
    },
    MINT: {
        id: 'mint',
        name: 'Mint',
        rgba: {
            light: 'rgba(153,255,153,1)',
            dark: 'rgba(153,255,166,1)',
        },
    },
};

Object.defineProperties(Color, {
    fromId: {
        value: id => Object.values(Color).find(color => color.id === id) || Color.GRAY,
    },
    forEach: {
        value: cb => Object.values(Color).forEach(cb),
    },
});
