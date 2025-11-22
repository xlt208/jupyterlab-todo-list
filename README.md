# jupyterlab_todo_list

[![Build Status](https://github.com/xlt208/jupyterlab-todo-list/actions/workflows/build.yml/badge.svg)](https://github.com/xlt208/jupyterlab-todo-list/actions/workflows/build.yml)

Keep lightweight to-dos inside JupyterLab. This extension adds a persistent side panel that lets you add, check off, and delete tasks while working in notebooks. Items are cached locally and synced to a small REST endpoint so they follow you between sessions.

https://github.com/user-attachments/assets/79b642f0-dd4c-4cae-82bf-9d56c32b3cc6

## Requirements

- JupyterLab >= 4.0.0

## Install

```bash
pip install jupyterlab_todo_list
```

The Python package is published on PyPI, and the labextension bundle is on npm as `@xlt208/jupyterlab-todo-list` for anyone integrating it into custom builds. A normal `pip install` brings in the Python backend plus the bundled frontend automatically—no extra npm step required.

## Use

1. Launch JupyterLab.
2. Open the command palette or launcher and run **Open To-Do List**.
3. Add tasks in the left side panel. Items are saved automatically.

The panel reopens on the next Lab session and restores your last task list.

## Uninstall

```bash
pip uninstall jupyterlab_todo_list
```

## Contributing

### Development install

The `jlpm` command is JupyterLab's pinned version of [Yarn](https://yarnpkg.com/) and is already bundled with Lab. NodeJS (>=18) must be available on your PATH.

```bash
git clone https://github.com/xlt208/jupyterlab-todo-list.git
cd jupyterlab_todo_list

python -m venv .venv
source .venv/bin/activate
pip install --editable ".[test]"

jlpm install
jlpm build
jupyter labextension develop . --overwrite
```

During development you can keep the TS build and Lab running in watch mode:

```bash
jlpm watch   # terminal 1
jupyter lab  # terminal 2
```

To undo the editable install run `pip uninstall jupyterlab_todo_list` and remove the `jupyterlab-todo-list` symlink reported by `jupyter labextension list`.

### Testing the extension

```bash
jlpm test          # Jest unit tests
jlpm lint:check    # prettier + eslint + stylelint
jlpm playwright test # UI tests (see ui-tests/README.md for setup)
```

### Packaging the extension

See [RELEASE](RELEASE.md)
