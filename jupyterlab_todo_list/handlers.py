"""Server-side handlers for the jupyterlab-todo-list extension."""

from __future__ import annotations

import json
import os
from typing import Any, Dict, List

from jupyter_server.base.handlers import APIHandler
from jupyter_server.utils import url_path_join
from tornado import web

from .notebook_todos import collect_notebook_todos

class TodoItemsHandler(APIHandler):
    """REST handler that persists todo items to disk."""

    def initialize(  # type: ignore[override]
        self, storage_path: str, root_dir: str
    ) -> None:
        self._storage_path = storage_path
        self._root_dir = root_dir

    def _ensure_storage_dir(self) -> None:
        directory = os.path.dirname(self._storage_path)
        if directory:
            os.makedirs(directory, exist_ok=True)

    def _read_items(self) -> List[Dict[str, Any]]:
        if not os.path.exists(self._storage_path):
            return []
        try:
            with open(self._storage_path, encoding="utf-8") as fp:
                data = json.load(fp)
        except Exception as err:  # pragma: no cover - defensive logging
            self.log.warning("Failed to read %s: %s", self._storage_path, err)
            return []
        items = data.get("items") if isinstance(data, dict) else data
        if isinstance(items, list):
            return items
        return []

    def _filter_manual(self, items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        return [item for item in items if item.get("source") != "notebook"]

    @web.authenticated
    async def get(self) -> None:
        """Return the stored todo items."""
        manual_items = self._filter_manual(self._read_items())
        notebook_items = collect_notebook_todos(self._root_dir, self.log)
        items = manual_items + notebook_items
        self.finish({"items": items})

    @web.authenticated
    async def put(self) -> None:
        """Persist todo items."""
        payload = self.get_json_body() or {}
        items = payload.get("items")
        if not isinstance(items, list):
            raise web.HTTPError(
                400, "Request body must include an 'items' array")

        items = self._filter_manual(items)
        self._ensure_storage_dir()
        tmp_path = f"{self._storage_path}.tmp"
        try:
            with open(tmp_path, "w", encoding="utf-8") as fp:
                json.dump({"items": items}, fp)
            os.replace(tmp_path, self._storage_path)
        finally:
            if os.path.exists(tmp_path):
                try:
                    os.remove(tmp_path)
                except OSError:
                    pass
        self.set_status(204)


def setup_handlers(server_app) -> None:
    """Register the REST API handlers."""
    web_app = server_app.web_app
    base_url = web_app.settings.get("base_url", "/")

    storage_dir = os.path.join(server_app.data_dir, "jlab-todo-list")
    storage_path = os.path.join(storage_dir, "items.json")

    root_dir = server_app.contents_manager.root_dir  # type: ignore[attr-defined]
    route_pattern = url_path_join(base_url, "jlab-todo", "items")
    handlers = [(route_pattern, TodoItemsHandler,
                 {"storage_path": storage_path, "root_dir": root_dir})]
    web_app.add_handlers(".*$", handlers)
    server_app.log.info(
        "Registered jupyterlab-todo-list handlers with storage at %s", storage_path
    )
