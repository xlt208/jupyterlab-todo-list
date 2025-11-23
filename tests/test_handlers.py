from __future__ import annotations

import asyncio
import json
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

from jupyterlab_todo_list.handlers import TodoItemsHandler


def _write_items(path: Path, items: list[dict[str, object]]) -> None:
    payload = {"items": items}
    path.write_text(json.dumps(payload), encoding="utf-8")


def _build_handler(
    storage_path: Path, todo_cache: SimpleNamespace, include_arg: str | None
) -> TodoItemsHandler:
    handler = TodoItemsHandler.__new__(TodoItemsHandler)
    handler._storage_path = str(storage_path)
    handler._todo_cache = todo_cache
    handler.finish = MagicMock()
    logger = SimpleNamespace(
        warning=lambda *args, **kwargs: None,
        info=lambda *args, **kwargs: None,
    )
    handler.application = SimpleNamespace(log=logger, settings={})  # type: ignore[attr-defined]
    handler.request = SimpleNamespace()  # type: ignore[attr-defined]
    handler._jupyter_current_user = "tester"  # type: ignore[attr-defined]

    def get_query_argument(name, default=None, strip=True):
        if name == "include_notebook_todos":
            return default if include_arg is None else include_arg
        return default

    handler.get_query_argument = get_query_argument  # type: ignore[assignment]
    return handler


def test_get_includes_notebook_todos_by_default(tmp_path: Path) -> None:
    storage_path = tmp_path / "items.json"
    manual_items = [{"id": "1", "text": "manual"}]
    notebook_items = [{"id": "n1", "text": "nb", "source": "notebook"}]
    _write_items(storage_path, manual_items)

    todo_cache = SimpleNamespace()
    todo_cache.get_items = AsyncMock(return_value=notebook_items)

    handler = _build_handler(storage_path, todo_cache, include_arg=None)
    asyncio.run(TodoItemsHandler.get(handler))

    todo_cache.get_items.assert_awaited_once()
    handler.finish.assert_called_once()
    payload = handler.finish.call_args[0][0]
    assert payload["items"] == manual_items + notebook_items


def test_get_skips_notebook_todos_when_disabled(tmp_path: Path) -> None:
    storage_path = tmp_path / "items.json"
    manual_items = [{"id": "1", "text": "manual"}]
    notebook_items = [{"id": "n1", "text": "nb", "source": "notebook"}]
    _write_items(storage_path, manual_items)

    todo_cache = SimpleNamespace()
    todo_cache.get_items = AsyncMock(return_value=notebook_items)

    handler = _build_handler(storage_path, todo_cache, include_arg="0")
    asyncio.run(TodoItemsHandler.get(handler))

    todo_cache.get_items.assert_not_awaited()
    handler.finish.assert_called_once()
    payload = handler.finish.call_args[0][0]
    assert payload["items"] == manual_items
