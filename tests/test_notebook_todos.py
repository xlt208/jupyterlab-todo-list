from __future__ import annotations

import json
from pathlib import Path

from jupyterlab_todo_list.notebook_todos import collect_notebook_todos


def _write_notebook(path: Path, lines: list[str]) -> None:
    payload = {
        "cells": [
            {
                "cell_type": "code",
                "execution_count": None,
                "id": "cell-1",
                "metadata": {},
                "outputs": [],
                "source": lines,
            }
        ],
        "metadata": {},
        "nbformat": 4,
        "nbformat_minor": 5,
    }
    path.write_text(json.dumps(payload), encoding="utf-8")


def test_collects_todos_from_notebooks(tmp_path: Path) -> None:
    nb_path = tmp_path / "Notebook.ipynb"
    _write_notebook(nb_path, ["x = 1\n", "# TODO: first thing\n"])

    todos = collect_notebook_todos(str(tmp_path))

    assert len(todos) == 1
    todo = todos[0]
    assert todo["text"] == "first thing"
    assert todo["originPath"] == "Notebook.ipynb"
    assert todo["source"] == "notebook"


def test_skips_checkpoints_and_non_matches(tmp_path: Path) -> None:
    checkpoint_dir = tmp_path / ".ipynb_checkpoints"
    checkpoint_dir.mkdir()
    _write_notebook(checkpoint_dir / "Notebook-checkpoint.ipynb",
                    ["# TODO: should be skipped\n"])
    other_nb = tmp_path / "Another.ipynb"
    _write_notebook(other_nb, ["print('hello')\n", "# TODO: keep me\n"])

    todos = collect_notebook_todos(str(tmp_path))

    assert len(todos) == 1
    assert todos[0]["originPath"] == "Another.ipynb"
