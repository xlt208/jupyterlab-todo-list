"""Server-side handlers for the jupyterlab-todo-list extension."""

from __future__ import annotations

import json
import os
from typing import Any, Dict, List

from jupyter_server.base.handlers import APIHandler
from jupyter_server.utils import url_path_join
from tornado import web


class TodoItemsHandler(APIHandler):
    """REST handler that persists todo items to disk."""

    def initialize(self, storage_path: str) -> None:  # type: ignore[override]
        self._storage_path = storage_path

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

    @web.authenticated
    async def get(self) -> None:
        """Return the stored todo items."""
        self.finish({"items": self._read_items()})

    @web.authenticated
    async def put(self) -> None:
        """Persist todo items."""
        payload = self.get_json_body() or {}
        items = payload.get("items")
        if not isinstance(items, list):
            raise web.HTTPError(
                400, "Request body must include an 'items' array")

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

    route_pattern = url_path_join(base_url, "jlab-todo", "items")
    handlers = [(route_pattern, TodoItemsHandler,
                 {"storage_path": storage_path})]
    web_app.add_handlers(".*$", handlers)
    server_app.log.info(
        "Registered jupyterlab-todo-list handlers with storage at %s", storage_path
    )
