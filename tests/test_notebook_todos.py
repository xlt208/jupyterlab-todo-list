from __future__ import annotations

import json
import asyncio
from pathlib import Path

import pytest

import jupyterlab_todo_list.notebook_todos as notebook_todos
from jupyterlab_todo_list.notebook_todos import NotebookTodoCache, collect_notebook_todos


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


def test_cache_reuses_recent_scan(tmp_path: Path) -> None:
    nb_path = tmp_path / "Notebook.ipynb"

    async def scenario() -> None:
        _write_notebook(nb_path, ["# TODO: keep me\n"])
        cache = NotebookTodoCache(str(tmp_path), ttl_seconds=60)

        first = await cache.get_items()
        assert len(first) == 1

        _write_notebook(nb_path, ["print('done')\n"])
        second = await cache.get_items()

        assert second == first

    asyncio.run(scenario())


def test_cache_refreshes_after_ttl(tmp_path: Path) -> None:
    nb_path = tmp_path / "Notebook.ipynb"

    async def scenario() -> None:
        _write_notebook(nb_path, ["# TODO: first\n"])
        cache = NotebookTodoCache(str(tmp_path), ttl_seconds=0.05)

        await cache.get_items()

        _write_notebook(nb_path, ["# TODO: second\n"])
        await asyncio.sleep(0.06)

        refreshed = await cache.get_items()
        assert refreshed[0]["text"] == "second"

    asyncio.run(scenario())


def test_cache_reuses_empty_results(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    async def scenario() -> None:
        calls = {"count": 0}

        def fake_collect(root_dir: str, logger=None):
            calls["count"] += 1
            return []

        monkeypatch.setattr(
            notebook_todos, "collect_notebook_todos", fake_collect)

        cache = NotebookTodoCache(str(tmp_path), ttl_seconds=60)
        first = await cache.get_items()
        assert first == []
        second = await cache.get_items()
        assert second == []
        assert calls["count"] == 1

    asyncio.run(scenario())
