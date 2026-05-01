<!--
SPDX-FileCopyrightText: 2022 Romain Vigier <contact AT romainvigier.fr>

SPDX-License-Identifier: CC-BY-SA-4.0
-->

# Releasing

Release checklist:

- Bump version number in [`meson.build`](./meson.build)
- Add entry in [`CHANGELOG.md`](./CHANGELOG.md)
- Add release notes to [the metainfo file](./application/data/fr.romainvigier.zap.metainfo.xml)

To make a release, create a new tag. The CI will automatically add release notes.
