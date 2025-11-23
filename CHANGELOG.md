# Changelog

<!-- <START NEW CHANGELOG ENTRY> -->

## 1.0.0

- Parse `# TODO:` markers from notebooks (excluding checkpoints) and show them in the panel with links back to their source.
- Added a refresh button to re-scan notebooks on demand while keeping manual tasks synced to disk.
- Added a "Show notebook TODOs" setting to let users enable or disable notebook imports.

<!-- <END NEW CHANGELOG ENTRY> -->

## 0.3.0

- Bundled a `jupyter_server_config.d` snippet so the REST handler is auto-registered after install—no manual server config step required.

## 0.2.0

- Added inline editing for pending tasks.
- Added support for automatically moving completed items to the bottom and applying strike-through styling
- Migrated the panel layout to flexbox and enabled wrapping for long task text to prevent overlap and ensure proper scrolling.
- Updated the panel title to “To-Do List” for improved clarity.

## 0.1.0

- First release providing a lightweight todo panel for JupyterLab.
