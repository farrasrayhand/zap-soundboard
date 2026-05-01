// SPDX-FileCopyrightText: 2022 Romain Vigier <contact AT romainvigier.fr>
//
// SPDX-License-Identifier: GPL-3.0-or-later

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Tracker from 'gi://Tracker';

import { Service } from './Service.js';


const DATABASE_PATH = Gio.File.new_for_path(GLib.build_filenamev([GLib.get_user_data_dir(), pkg.name, 'db']));
const ONTOLOGY_PATH = Gio.File.new_for_path(GLib.build_filenamev([pkg.pkgdatadir, 'ontology']));


/**
 * Handles the database connection and queries.
 */
export class Database extends Service {

    #connection = null;
    #cancellable;

    static {
        GObject.registerClass({ GTypeName: 'ZapDatabase' }, this);
    }

    /** */
    constructor() {
        console.debug('Initializing Database service...');
        super();
        this.#cancellable = new Gio.Cancellable();
        console.debug('Database service initialized.');
    }

    /**
     * Connect to the database.
     */
    start() {
        console.debug('Starting Database service...');
        this.#connection = Tracker.SparqlConnection.new(
            Tracker.SparqlConnectionFlags.NONE,
            DATABASE_PATH,
            ONTOLOGY_PATH,
            this.#cancellable
        );
        console.debug('Database service started.');
    }

    /**
     * Disconnect from the database.
     */
    exit() {
        console.debug('Exiting database service...');
        this.#cancellable.cancel();
        if (!this.#connection)
            return;
        this.#connection.close();
        this.#connection = null;
        console.debug('Database service exited.');
    }

    /**
     * Batch resources.
     *
     * @param {Tracker.Resource[]} resources Array of resources.
     */
    batch(resources = []) {
        const batch = this.#connection.create_batch();
        resources.forEach(resource => batch.add_resource(null, resource));
        batch.execute(this.#cancellable);
    }

    /**
     * Send a SPARQL query to the database.
     *
     * @param {string} sparql SPARQL query.
     * @returns {Tracker.SparqlCursor} The result cursor.
     */
    query(sparql) {
        return this.#connection.query_statement(sparql, this.#cancellable).execute(this.#cancellable);
    }

    /**
     * Send a SPARQL update query to the database.
     *
     * @param {string} sparql SPARQL update query.
     */
    update(sparql) {
        this.#connection.update(sparql, this.#cancellable);
    }

}
