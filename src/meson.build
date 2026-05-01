# SPDX-FileCopyrightText: 2022 Romain Vigier <contact AT romainvigier.fr>
#
# SPDX-License-Identifier: GPL-3.0-or-later

gjs_exe = find_program('gjs', required: false)

if not gjs_exe.found()
	warning('Can\'t find GJS on the system', 'A default path will be used in the entrypoint script.')
endif

# Configure the entry point
configure_file(
	input : APP_ID + '.js',
	output : APP_ID,
	configuration: {
		'GJS': gjs_exe.found() ? gjs_exe.full_path() : '/bin/env gjs',
		'PACKAGE_NAME': APP_ID,
		'PACKAGE_VERSION': meson.project_version(),
		'PREFIX': get_option('prefix'),
		'LIBDIR': get_option('prefix') / get_option('libdir'),
		'DEVEL': get_option('devel') ? 'True' : 'False'
	},
	install_dir: get_option('bindir'),
	install_mode: 'rwxr-xr-x'
)

# Compile the resources
gnome.compile_resources(
	APP_ID + '.src',
	APP_ID + '.src.gresource.xml',
	gresource_bundle: true,
	install: true,
	install_dir : get_option('datadir') / APP_ID
)
