import { URLExt } from '@jupyterlab/coreutils';
import { ServerConnection } from '@jupyterlab/services';
import type { IStateDB } from '@jupyterlab/statedb';
import { LabIcon } from '@jupyterlab/ui-components';
import { Widget } from '@lumino/widgets';
import { createRoot, Root } from 'react-dom/client';
import { Todo, TodoApp } from './TodoApp';
import { logDebug, logError } from './logging';

/** Tiny checkbox icon  */
const todoSvg = `
<svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16" xmlns="http://www.w3.org/2000/svg">
  <path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/>
</svg>`;
export const todoIcon = new LabIcon({
  name: 'jlab-todo:icon',
  svgstr: todoSvg
});

export namespace TodoPanel {
  export interface IOptions {
    state: IStateDB;
    storageKey: string;
    serverSettings: ServerConnection.ISettings;
    showNotebookTodos: boolean;
  }
}

export class TodoPanel extends Widget {
  private _root: Root | null = null;
  private _state: IStateDB;
  private _storageKey: string;
  private _serverSettings: ServerConnection.ISettings;
  private _endpointMissing = false;
  private _showNotebookTodos: boolean;

  constructor(options: TodoPanel.IOptions) {
    super();
    this.id = 'jlab-todo-panel';
    this.title.label = 'To-Do List';
    this.title.icon = todoIcon;
    this.title.closable = true;
    this.addClass('jp-TodoPanel');
    this._state = options.state;
    this._storageKey = options.storageKey;
    this._serverSettings = options.serverSettings;
    this._showNotebookTodos = options.showNotebookTodos;
  }

  onAfterAttach(): void {
    this._root = createRoot(this.node);
    this._renderApp();
    logDebug('panel module attached');
  }

  onBeforeDetach(): void {
    this._root?.unmount();
    this._root = null;
  }

  private _loadTodos = async (): Promise<Todo[]> => {
    const serverItems = await this._loadFromServer();
    if (serverItems) {
      return serverItems;
    }
    return this._loadFromState();
  };

  private _saveTodos = async (todos: Todo[]): Promise<void> => {
    const manualTodos = this._filterManualTodos(todos);
    try {
      await this._state.save(this._storageKey, manualTodos);
    } catch (err) {
      logError('failed to save todos locally', err);
    }

    try {
      const response = await ServerConnection.makeRequest(
        this._apiUrl(),
        {
          method: 'PUT',
          body: JSON.stringify({ items: manualTodos }),
          headers: { 'Content-Type': 'application/json' }
        },
        this._serverSettings
      );
      if (!response.ok) {
        throw new ServerConnection.ResponseError(response);
      }
    } catch (err) {
      if (this._handleEndpointMissing(err)) {
        return;
      }
      logError('failed to save todos to server', err);
    }
  };

  private _loadFromState = async (): Promise<Todo[]> => {
    try {
      const stored = (await this._state.fetch(this._storageKey)) as
        | Todo[]
        | null;
      return Array.isArray(stored) ? stored : [];
    } catch (err) {
      logError('failed to load todos from local cache', err);
      return [];
    }
  };

  private _loadFromServer = async (): Promise<Todo[] | null> => {
    try {
      const queryParams = this._showNotebookTodos
        ? undefined
        : { include_notebook_todos: '0' };
      const response = await ServerConnection.makeRequest(
        this._apiUrl(queryParams),
        { method: 'GET' },
        this._serverSettings
      );
      if (!response.ok) {
        throw new ServerConnection.ResponseError(response);
      }
      const payload = (await response.json()) as { items?: Todo[] };
      if (Array.isArray(payload.items)) {
        const manualItems = this._filterManualTodos(payload.items);
        await this._state.save(this._storageKey, manualItems);
        return payload.items;
      }
      return [];
    } catch (err) {
      if (this._handleEndpointMissing(err)) {
        return null;
      }
      logError('failed to load todos from server', err);
      return null;
    }
  };

  private _apiUrl(params?: Record<string, string>): string {
    const base = URLExt.join(
      this._serverSettings.baseUrl,
      'jlab-todo',
      'items'
    );
    if (!params || Object.keys(params).length === 0) {
      return base;
    }
    const query = Object.entries(params)
      .map(
        ([key, value]) =>
          `${encodeURIComponent(key)}=${encodeURIComponent(value)}`
      )
      .join('&');
    return `${base}?${query}`;
  }

  private _handleEndpointMissing(err: unknown): boolean {
    if (
      err instanceof ServerConnection.ResponseError &&
      err.response?.status === 404
    ) {
      if (!this._endpointMissing) {
        logDebug('server endpoint not available, skipping remote sync');
        this._endpointMissing = true;
      }
      return true;
    }
    return false;
  }

  private _filterManualTodos(todos: Todo[]): Todo[] {
    return todos.filter(todo => todo.source !== 'notebook');
  }

  setShowNotebookTodos(showNotebookTodos: boolean): void {
    if (this._showNotebookTodos === showNotebookTodos) {
      return;
    }
    this._showNotebookTodos = showNotebookTodos;
    this._renderApp();
  }

  private _renderApp(): void {
    this._root?.render(
      <TodoApp
        loadTodos={this._loadTodos}
        saveTodos={this._saveTodos}
        showNotebookTodos={this._showNotebookTodos}
      />
    );
  }
}
