// SPDX-FileCopyrightText: 2026 Farras Rayhand <farrasrayhand@gmail.com>
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { Color } from '../models/Color.js';

export function createColorChooser(selectedId = 'gray', onChange = null) {
    const container = document.createElement('div');
    container.className = 'color-chooser';

    Color.forEach(color => {
        const pill = document.createElement('button');
        pill.type = 'button';
        pill.className = 'color-pill';
        pill.dataset.color = color.id;
        pill.title = color.name;
        pill.style.backgroundColor = color.rgba.light;

        if (color.id === selectedId)
            pill.classList.add('selected');

        pill.addEventListener('click', () => {
            container.querySelectorAll('.color-pill').forEach(p => p.classList.remove('selected'));
            pill.classList.add('selected');
            if (onChange) onChange(color.id);
        });

        container.appendChild(pill);
    });

    return container;
}

export function setColorChooserSelection(container, colorId) {
    container.querySelectorAll('.color-pill').forEach(p => {
        p.classList.toggle('selected', p.dataset.color === colorId);
    });
}

export function getColorChooserSelection(container) {
    const selected = container.querySelector('.color-pill.selected');
    return selected ? selected.dataset.color : 'gray';
}
