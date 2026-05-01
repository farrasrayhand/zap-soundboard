// SPDX-FileCopyrightText: 2022 Romain Vigier <contact AT romainvigier.fr>
//
// SPDX-License-Identifier: GPL-3.0-or-later

import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';


/**
 * Button opening a file chooser, allowing to choose an audio file.
 */
export class FileChooserButton extends Gtk.Widget {

    /** @type {Gtk.FileChooserNative} */
    #dialog;
    /** @type {Gtk.FileFilter} */
    #filter;

    static {
        GObject.registerClass({
            GTypeName: 'ZapFileChooserButton',
            CssName: 'filechooserbutton',
            Template: 'resource:///fr/romainvigier/zap/ui/FileChooserButton.ui',
            Properties: {
                file: GObject.ParamSpec.object('file', 'File', 'File', GObject.ParamFlags.READWRITE, Gio.File),
            },
            InternalChildren: ['dialog', 'filter'],
        }, this);
    }

    /**
     * @param {object} params Parameter object.
     * @param {?Gio.File} params.file GFile.
     */
    constructor({ file = null, ...params } = {}) {
        super(params);

        /**
         * Selected file.
         *
         * @type {?Gio.File}
         */
        this.file = file;

        this.#dialog = this._dialog;
        this.#filter = this._filter;

        this.#dialog.add_filter(this.#filter);
    }

    /**
     * Callback when the button is clicked.
     *
     * @param {Gtk.Button} button Button.
     */
    onButtonClicked(button) {
        this.#dialog.show();
    }

    /**
     * Callback when the dialog is closed.
     *
     * @param {Gtk.FileChooserNative} dialog File chooser dialog.
     * @param {Gtk.ResponseType} response Response.
     */
    onDialogResponse(dialog, response) {
        if (response !== Gtk.ResponseType.ACCEPT)
            return;
        this.file = dialog.get_file();
    }

    /**
     * Get the stack visible page name, depending on if a file is selected.
     *
     * @param {FileChooserButton} button Button.
     * @param {?Gio.File} file GFile.
     * @returns {string} Page name.
     */
    getVisibleChildName(button, file) {
        return file ? 'file' : 'no-file';
    }

    /**
     * Get the icon representing the given file.
     *
     * @param {FileChooserButton} button Button.
     * @param {?Gio.File} file GFile.
     * @returns {Gio.Icon} GIcon.
     */
    getFileIcon(button, file) {
        if (!file)
            return Gio.Icon.new_for_string('audio-x-generic-symbolic');
        return Gio.content_type_get_symbolic_icon(Gio.content_type_guess(file.get_path(), null)[0]);
    }

    /**
     * Get the file name.
     *
     * @param {FileChooserButton} button Button.
     * @param {?Gio.File} file GFile.
     * @returns {string} File name.
     */
    getFileName(button, file) {
        return file ? file.get_basename() : '';
    }

}
