// SPDX-FileCopyrightText: 2026 Farras Rayhand <farrasrayhand@gmail.com>
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { state } from '../state.js';
import { settings } from '../settings.js';

const TOTAL_STEPS = 3;

export function init() {
    const overlay = document.getElementById('tutorial-overlay');
    const dontShow = document.getElementById('tutorial-dont-show');
    const nextBtn = document.getElementById('tutorial-next');
    const prevBtn = document.getElementById('tutorial-prev');
    const closeBtn = document.getElementById('tutorial-close');
    const dots = document.getElementById('tutorial-dots');

    if (!overlay) return;

    // Build dots
    for (let i = 0; i < TOTAL_STEPS; i++) {
        const dot = document.createElement('span');
        dot.className = 'tutorial-dot' + (i === 0 ? ' active' : '');
        dots.appendChild(dot);
    }

    let step = 0;

    function showStep(s) {
        for (let i = 0; i < TOTAL_STEPS; i++) {
            const el = document.getElementById('tutorial-step-' + i);
            if (el) el.classList.toggle('hidden', i !== s);
            const dot = dots.children[i];
            if (dot) dot.classList.toggle('active', i === s);
        }
        prevBtn.disabled = s === 0;
        nextBtn.classList.toggle('hidden', s === TOTAL_STEPS - 1);
        closeBtn.classList.toggle('hidden', s !== TOTAL_STEPS - 1);
    }

    function close() {
        overlay.classList.add('hidden');
        if (dontShow.checked)
            settings.set('showTutorial', false);
    }

    nextBtn.addEventListener('click', () => {
        if (step < TOTAL_STEPS - 1) { step++; showStep(step); }
    });

    prevBtn.addEventListener('click', () => {
        if (step > 0) { step--; showStep(step); }
    });

    closeBtn.addEventListener('click', close);

    // Close on backdrop click
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) close();
    });

    // Show on first visit if not dismissed
    if (settings.get('showTutorial') !== false) {
        step = 0;
        showStep(0);
        overlay.classList.remove('hidden');
    }

    // Manual show via menu
    state.on('tutorial:show', () => {
        step = 0;
        showStep(0);
        overlay.classList.remove('hidden');
    });
}
