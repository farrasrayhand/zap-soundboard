// SPDX-FileCopyrightText: 2022 Romain Vigier <contact AT romainvigier.fr>
//
// SPDX-License-Identifier: GPL-3.0-or-later

import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

import { Color } from '../enums/Color.js';

import { Collections } from '../services/Collections.js';
import { Config } from '../services/Config.js';
import { Database } from '../services/Database.js';
import { DBus } from '../services/DBus.js';
import { Player } from '../services/Player.js';
import { Zaps } from '../services/Zaps.js';

import { Window } from '../widgets/Window.js';


/** @type {?Collections} */
globalThis.collections = null;
/** @type {?Config} */
globalThis.config = null;
/** @type {?Database} */
globalThis.database = null;
/** @type {?Player} */
globalThis.player = null;
/** @type {?Gio.Settings} */
globalThis.settings = null;
/** @type {?Zaps} */
globalThis.zaps = null;


/**
 * The application.
 */
export class Application extends Adw.Application {

    dBus;

    /** @type {Map<string, string>} */
    #cssTemplates = new Map();

    static {
        GObject.registerClass({
            GTypeName: 'ZapApplication',
        }, this);
    }

    /**
     * @param {object} params Parameter object.
     */
    constructor({ ...params } = {}) {
        console.debug('Initializing Application...');
        super({
            application_id: pkg.name,
            flags: Gio.ApplicationFlags.FLAGS_NONE,
            ...params,
        });
        // Translators: Application name, avoid translating it!
        GLib.set_application_name(_('Zap'));
        globalThis.settings = new Gio.Settings({ schemaId: this.applicationId });
        globalThis.player = new Player();
        globalThis.database = new Database();
        globalThis.config = new Config();
        globalThis.zaps = new Zaps();
        globalThis.collections = new Collections();
        this.dBus = new DBus();
        console.debug('Application initialized.');
    }

    /**
     * Startup virtual method.
     */
    vfunc_startup() {
        console.debug('Starting Application...');

        super.vfunc_startup();

        globalThis.player.start();
        globalThis.database.start();
        globalThis.zaps.start();
        globalThis.collections.start();
        this.dBus.start();

        this.#setupActions();
        this.#setupAccelerators();
        this.#loadCssTemplates();
        this.#updateCss();

        globalThis.zaps.connect('zap-added', () => this.#updateCss());
        globalThis.zaps.connect('zap-removed', () => this.#updateCss());
        globalThis.zaps.connect('zap-updated', () => this.#updateCss());
        Adw.StyleManager.get_default().connect('notify::dark', () => this.#updateCss());

        console.debug('Application started.');
    }

    /**
     * Activate virtual method.
     */
    vfunc_activate() {
        console.debug('Application has been activated.');
        this.newWindow();
    }

    /**
     * Shutdown virtual method.
     */
    vfunc_shutdown() {
        console.debug('Shutting down Application...');
        this.dBus.exit();
        globalThis.player.exit();
        globalThis.collections.exit();
        globalThis.zaps.exit();
        globalThis.database.exit();
        super.vfunc_shutdown();
    }

    /**
     * Open a new window.
     */
    newWindow() {
        console.debug('Opening a new window...');
        const window = new Window({ application: this });
        window.present();
    }

    /**
     * Setup the actions.
     */
    #setupActions() {
        console.debug('Setting up actions...');
        [
            {
                name: 'quit',
                parameterType: null,
                callback: (action, params) => {
                    this.quit();
                },
            },
            {
                name: 'new-window',
                parameterType: null,
                callback: (action, params) => {
                    this.newWindow();
                },
            },
        ].forEach(({ name, parameterType, callback }) => {
            const action = new Gio.SimpleAction({ name, parameterType });
            action.connect('activate', callback);
            this.add_action(action);
        });
        console.debug('Actions set up.');
    }

    /**
     * Setup the accelerators.
     */
    #setupAccelerators() {
        console.debug('Setting up accelerators...');
        this.set_accels_for_action('app.new-window', ['<Control>n']);
        this.set_accels_for_action('app.quit', ['<Control>q']);
        this.set_accels_for_action('win.open-add-zap-popup', ['F2']);
        this.set_accels_for_action('win.open-collections-popover', ['F3']);
        this.set_accels_for_action('window.close', ['<Control>w']);
        console.debug('Accelerators set up.');
    }

    /**
     * Preload the CSS templates from resources.
     */
    #loadCssTemplates() {
        const decoder = new TextDecoder();
        [
            'colorpill-color.template.css',
            'zap-item-color.template.css',
            'zap-item-color-dark.template.css',
        ].forEach(fileName => {
            const gfile = Gio.File.new_for_uri(`resource:///fr/romainvigier/zap/css/${fileName}`);
            const [ok, contents, etag] = gfile.load_contents(null);
            this.#cssTemplates.set(fileName, decoder.decode(contents));
        });
    }

    /**
     * Update the CSS rules from the templates.
     */
    #updateCss() {
        const rules = [];

        const { dark } = Adw.StyleManager.get_default();

        const colorTemplate = this.#cssTemplates.get('colorpill-color.template.css');
        Color.forEach(color => {
            const rule = colorTemplate
                .replaceAll('$color_id', color.id)
                .replaceAll('$color_value', dark ? color.rgba.dark.to_string() : color.rgba.light.to_string());
            rules.push(rule);
        });

        const zapItemTemplate = this.#cssTemplates.get(dark ? 'zap-item-color-dark.template.css' : 'zap-item-color.template.css');
        for (let i = 0; i < globalThis.zaps.get_n_items(); i++) {
            const zap = globalThis.zaps.get_item(i);
            const rule = zapItemTemplate
                .replaceAll('$uuid', zap.uuid)
                .replaceAll('$zap_color', dark ? zap.color.rgba.dark.to_string() : zap.color.rgba.light.to_string());
            rules.push(rule);
        }

        const provider = new Gtk.CssProvider();
        const cssData = rules.join('\n');
        // GTK 4.12+ deprecates load_from_data(string), use load_from_string instead
        if (provider.load_from_string) {
            provider.load_from_string(cssData);
        } else {
            // Fallback for older GTK4: pass as bytes
            provider.load_from_data(new TextEncoder().encode(cssData));
        }
        Gtk.StyleContext.add_provider_for_display(
            Gdk.Display.get_default(),
            provider,
            Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION
        );
    }

}
