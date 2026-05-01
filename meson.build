# SPDX-FileCopyrightText: 2022 Romain Vigier <contact AT romainvigier.fr>
#
# SPDX-License-Identifier: GPL-3.0-or-later

# Define our project
project(
	'zap',
	version: '1.2.3',
	license: ['GPL-3.0-or-later'],
	meson_version: '>= 0.59.0'
)

APP_ID = 'fr.romainvigier.zap'

# Import the modules
gnome = import('gnome')
i18n = import('i18n')

# Load instructions from subdirectories
subdir('data')
subdir('po')
subdir('src')

gnome.post_install(
	glib_compile_schemas: true,
	gtk_update_icon_cache: true,
	update_desktop_database: true
)
