"""Helpers for collecting ``# TODO:`` entries inside notebooks."""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any, Dict, Iterable, List, Optional

from logging import Logger

TODO_PATTERN = re.compile(r"#\s*TODO\s*:\s*(?P<text>.+)", re.IGNORECASE)


def _iter_notebooks(root_dir: str) -> Iterable[str]:
    """Yield every ``.ipynb`` file under ``root_dir``."""
    if not os.path.isdir(root_dir):
        return []
    for current_root, dirs, files in os.walk(root_dir):
        dirs[:] = [d for d in dirs if d != ".ipynb_checkpoints"]
        for filename in files:
            if filename.endswith(".ipynb"):
                yield os.path.join(current_root, filename)


def _normalize_source(cell_source: Any) -> List[str]:
    """Return the source of a cell as a list of lines."""
    if isinstance(cell_source, list):
        return [line.rstrip("\n") for line in cell_source]
    if isinstance(cell_source, str):
        return [line.rstrip("\n") for line in cell_source.splitlines()]
    return []


def _relative_path(path: str, root_dir: str) -> str:
    rel = os.path.relpath(path, root_dir) if root_dir else path
    return rel.replace(os.sep, "/")


def _todo_from_line(
    *,
    rel_path: str,
    cell_index: int,
    line_index: int,
    text: str
) -> Dict[str, Any]:
    return {
        "id": f"notebook:{rel_path}:{cell_index}:{line_index}",
        "text": text,
        "done": False,
        "source": "notebook",
        "originPath": rel_path,
        "originCell": cell_index,
        "originLine": line_index,
    }


def _extract_from_notebook(
    notebook_path: str, root_dir: str, logger: Optional[Logger]
) -> List[Dict[str, Any]]:
    try:
        with open(notebook_path, encoding="utf-8") as fp:
            notebook = json.load(fp)
    except Exception as err:  # pragma: no cover - defensive logging
        if logger:
            logger.warning("Failed to parse %s: %s", notebook_path, err)
        return []

    cells = notebook.get("cells")
    if not isinstance(cells, list):
        return []

    rel_path = _relative_path(notebook_path, root_dir)
    todos: List[Dict[str, Any]] = []
    for cell_index, cell in enumerate(cells):
        lines = _normalize_source(cell.get("source"))
        for line_index, line in enumerate(lines):
            match = TODO_PATTERN.search(line)
            if not match:
                continue
            text = match.group("text").strip()
            if not text:
                continue
            todos.append(
                _todo_from_line(
                    rel_path=rel_path,
                    cell_index=cell_index,
                    line_index=line_index,
                    text=text,
                )
            )
    return todos


def collect_notebook_todos(
    root_dir: str, logger: Optional[Logger] = None
) -> List[Dict[str, Any]]:
    """Return todo entries detected across notebooks inside ``root_dir``."""
    todos: List[Dict[str, Any]] = []
    for notebook_path in _iter_notebooks(root_dir):
        todos.extend(_extract_from_notebook(notebook_path, root_dir, logger))
    return todos


class NotebookTodoCache:
    """Async helper that caches notebook TODO scans for a short window."""

    def __init__(
        self,
        root_dir: str,
        logger: Optional[Logger] = None,
        *,
        ttl_seconds: float = 5.0,
    ) -> None:
        self._root_dir = root_dir
        self._logger = logger
        self._ttl = ttl_seconds
        self._cache: List[Dict[str, Any]] = []
        self._last_refresh = 0.0
        self._refresh_future: Optional[asyncio.Future[List[Dict[str, Any]]]] = None
        self._lock = asyncio.Lock()

    async def get_items(self) -> List[Dict[str, Any]]:
        """Return cached notebook TODOs, refreshing in a thread if needed."""

        async with self._lock:
            now = time.monotonic()
            if self._last_refresh and now - self._last_refresh < self._ttl:
                return list(self._cache)

            future = self._refresh_future
            if future is None:
                loop = asyncio.get_running_loop()
                future = asyncio.ensure_future(
                    loop.run_in_executor(
                        None, collect_notebook_todos, self._root_dir, self._logger
                    )
                )
                self._refresh_future = future

        result = await future

        async with self._lock:
            if self._refresh_future is future:
                self._cache = result
                self._last_refresh = time.monotonic()
                self._refresh_future = None
            return list(self._cache)
