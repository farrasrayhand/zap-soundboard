<!--
SPDX-FileCopyrightText: 2022 Romain Vigier <contact AT romainvigier.fr>

SPDX-License-Identifier: CC-BY-SA-4.0
-->

# Contributing

## Translations

The translation files are in the `po` directory. Edit the translation you are interested in and open a merge request with your changes. The commit message must be in the form `Translations: Update {LANGUAGE} translation`.

If no translation already exists for your language, add its code to the `po/LINGUAS` file and open a merge request. The commit must be in the form `Translations: Add {LANGUAGE}`. The translation file will be created once the change is merged. Alternatively, you can open a new issue.

Don't forget to credit yourself in the `translator-credits` string.

If you want to be reminded before a release to update the translation, add yourself to the [Release issue template](./.gitlab/issue_templates/Release.md).

## Code

The code of the application is in the `src` directory.

Before writing any code, please open a new issue to discuss your intended changes.

### Coding style

To ensure consistent style, the project uses [ESLint](https://eslint.org/). It will automatically check your code after you open a new merge request.

To run it locally, you can install it using NPM:

```
npm install --save-dev
```

And run it:

```
npx eslint ./src/**/*.js
```

### Code documentation

Functions, classes and methods must be documented using [JSDoc](https://jsdoc.app/).

ESLint will check that nothing is missing, please refer to the ["Coding style"](#coding-style) section for instructions on how to run it.

### Localization

When you add a new file that may contain translatable strings (a JavaScript or UI file for instance), add it alphabetically to `po/POTFILES`.

When the changes are merged, the translation files will automatically be updated.

### Licenses and copyright notices

When you change or add files, add your copyright notice to the top of the file, or in a separate file (named `original-file.ext.license`), following the [SPDX specification](https://spdx.dev/).

The project uses [REUSE](https://reuse.software/) to check that everything is properly licensed. It will run automatically when you open a new merge request.

You can run it locally with this command:

```
reuse lint
```

### Commits

Make one commit per significant change.

The commit title must include which part of the code you worked on, for example:

```
Progress bar: Change default opacity
```

If the change needs more explanations, write them in the commit message.
