import * as React from 'react';
import { refreshIcon } from '@jupyterlab/ui-components';
import { logDebug, logError } from './logging';

const RefreshIcon = refreshIcon.bindprops({ tag: 'span' }).react;

export type TodoSource = 'manual' | 'notebook';

export type Todo = {
  id: string;
  text: string;
  done: boolean;
  completedAt?: number;
  source?: TodoSource;
  originPath?: string;
  originCell?: number;
  originLine?: number;
};

export interface ITodoAppProps {
  loadTodos: () => Promise<Todo[]>;
  saveTodos: (todos: Todo[]) => Promise<void>;
  showNotebookTodos: boolean;
  openTodoOrigin?: (todo: Todo) => Promise<void> | void;
}

export function TodoApp({
  loadTodos,
  saveTodos,
  showNotebookTodos,
  openTodoOrigin
}: ITodoAppProps) {
  const [items, setItems] = React.useState<Todo[]>([]);
  const [text, setText] = React.useState('');
  const [initialized, setInitialized] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editText, setEditText] = React.useState('');
  const [refreshState, setRefreshState] = React.useState<
    'idle' | 'refreshing' | 'completed'
  >('idle');
  const refreshCompletionTimeout = React.useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const handleOpenOrigin = React.useCallback(
    (todo: Todo) => {
      if (!openTodoOrigin) {
        return;
      }
      void openTodoOrigin(todo);
    },
    [openTodoOrigin]
  );

  React.useEffect(() => {
    let cancelled = false;
    const bootstrap = async () => {
      try {
        const stored = await loadTodos();
        if (!cancelled) {
          setItems(stored);
          logDebug(`loaded ${stored.length} todos`);
        }
      } catch (err) {
        logError('failed to bootstrap todos', err);
      } finally {
        if (!cancelled) {
          setInitialized(true);
        }
      }
    };

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [loadTodos]);

  React.useEffect(() => {
    if (!initialized) {
      return;
    }
    void saveTodos(items);
  }, [items, initialized, saveTodos]);

  React.useEffect(() => {
    return () => {
      if (refreshCompletionTimeout.current) {
        clearTimeout(refreshCompletionTimeout.current);
        refreshCompletionTimeout.current = null;
      }
    };
  }, []);

  const add = React.useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) {
      return;
    }
    setItems(prev => [
      { id: crypto.randomUUID(), text: trimmed, done: false },
      ...prev
    ]);
    setText('');
  }, [text]);

  const toggle = React.useCallback((id: string) => {
    setItems(prev => {
      const next = prev.map(item => {
        if (item.id !== id) {
          return item;
        }
        const done = !item.done;
        return {
          ...item,
          done,
          completedAt: done ? Date.now() : undefined
        };
      });
      const pending = next.filter(item => !item.done);
      const completed = next
        .filter(item => item.done)
        .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));
      return [...pending, ...completed];
    });
  }, []);

  const remove = React.useCallback((id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  }, []);
  const confirmAndRemove = React.useCallback(
    (todo: Todo) => {
      const message = `Delete "${todo.text}"? This cannot be undone.`;
      if (typeof window !== 'undefined') {
        const confirmed = window.confirm(message);
        if (!confirmed) {
          return;
        }
      }
      remove(todo.id);
    },
    [remove]
  );

  const startEdit = React.useCallback((todo: Todo) => {
    if (todo.done) {
      return;
    }
    setEditingId(todo.id);
    setEditText(todo.text);
  }, []);

  const cancelEdit = React.useCallback(() => {
    setEditingId(null);
    setEditText('');
  }, []);

  const handleEditChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setEditText(event.target.value);
    },
    []
  );

  const submitEdit = React.useCallback(() => {
    if (!editingId) {
      return;
    }
    const trimmed = editText.trim();
    if (!trimmed) {
      cancelEdit();
      return;
    }
    setItems(prev =>
      prev.map(item =>
        item.id === editingId ? { ...item, text: trimmed } : item
      )
    );
    cancelEdit();
  }, [cancelEdit, editText, editingId]);

  const handleEditKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        cancelEdit();
      }
    },
    [cancelEdit]
  );

  const handleEditSubmit = React.useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      submitEdit();
    },
    [submitEdit]
  );

  const handleSubmit = React.useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      add();
    },
    [add]
  );

  const refresh = React.useCallback(async () => {
    if (refreshCompletionTimeout.current) {
      clearTimeout(refreshCompletionTimeout.current);
      refreshCompletionTimeout.current = null;
    }
    setRefreshState('refreshing');
    let succeeded = false;
    try {
      const next = await loadTodos();
      setItems(next);
      logDebug(`refreshed with ${next.length} todos`);
      succeeded = true;
    } catch (err) {
      logError('failed to refresh todos', err);
    } finally {
      if (succeeded) {
        setRefreshState('completed');
        refreshCompletionTimeout.current = setTimeout(() => {
          setRefreshState('idle');
          refreshCompletionTimeout.current = null;
        }, 1200);
      } else {
        setRefreshState('idle');
      }
    }
  }, [loadTodos]);

  const visibleItems = React.useMemo(
    () =>
      showNotebookTodos
        ? items
        : items.filter(item => item.source !== 'notebook'),
    [items, showNotebookTodos]
  );

  const hasItems = visibleItems.length > 0;
  const isRefreshing = refreshState === 'refreshing';
  const refreshCompleted = refreshState === 'completed';

  return (
    <div className="jp-TodoApp">
      <div className="jp-TodoApp-header">
        <h3 className="jp-TodoApp-title">To-Do List</h3>
        <button
          type="button"
          className="jp-Button jp-mod-minimal jp-TodoApp-refreshButton"
          onClick={refresh}
          disabled={showNotebookTodos ? isRefreshing : true}
          aria-label="Refresh"
          title="refresh"
          aria-hidden={showNotebookTodos ? undefined : true}
          tabIndex={showNotebookTodos ? 0 : -1}
          style={{ visibility: showNotebookTodos ? 'visible' : 'hidden' }}
        >
          {isRefreshing ? (
            <span className="jp-TodoApp-refreshSpinner" aria-hidden="true" />
          ) : refreshCompleted ? (
            <span className="jp-TodoApp-refreshSuccess" aria-hidden="true">
              ✓
            </span>
          ) : (
            <RefreshIcon />
          )}
        </button>
      </div>
      <form className="jp-TodoApp-inputRow" onSubmit={handleSubmit}>
        <input
          aria-label="New task"
          value={text}
          onChange={event => setText(event.target.value)}
          placeholder="Add a task..."
          className="jp-TodoApp-input jp-mod-styled"
        />
        <button type="submit" className="jp-Button jp-mod-accept">
          Add
        </button>
      </form>
      {!hasItems ? (
        <p className="jp-TodoApp-empty" aria-live="polite">
          No tasks yet. Add one above to get started.
        </p>
      ) : (
        <ul className="jp-TodoApp-list">
          {visibleItems.map(item => {
            const checkboxId = `todo-item-${item.id}`;
            const isNotebookTodo = item.source === 'notebook';
            const itemClass = `jp-TodoApp-item${item.done ? ' is-done' : ''}${
              isNotebookTodo ? ' is-readonly' : ''
            }`;
            const labelClass = `jp-TodoApp-itemLabel${
              item.done ? ' is-done' : ''
            }`;
            const isEditing = editingId === item.id;
            const disableInteractions = isNotebookTodo || isEditing;
            const showEditButton = !item.done && !isNotebookTodo;
            return (
              <li key={item.id} className={itemClass}>
                <input
                  id={checkboxId}
                  type="checkbox"
                  checked={item.done}
                  disabled={disableInteractions}
                  onChange={() => toggle(item.id)}
                />
                {isEditing ? (
                  <form
                    className="jp-TodoApp-editForm"
                    onSubmit={handleEditSubmit}
                  >
                    <input
                      value={editText}
                      onChange={handleEditChange}
                      onKeyDown={handleEditKeyDown}
                      autoFocus
                      aria-label={`Rename ${item.text}`}
                      className="jp-TodoApp-input jp-TodoApp-editInput"
                    />
                    <button type="submit" className="jp-Button jp-mod-accept">
                      Save
                    </button>
                    <button
                      type="button"
                      className="jp-Button"
                      onClick={cancelEdit}
                    >
                      Cancel
                    </button>
                  </form>
                ) : (
                  <>
                    <div className="jp-TodoApp-itemContent">
                      <label htmlFor={checkboxId} className={labelClass}>
                        {item.text}
                      </label>
                      {item.originPath && (
                        <div className="jp-TodoApp-originRow">
                          <span
                            className="jp-TodoApp-originPath"
                            title={item.originPath}
                          >
                            Notebook: {item.originPath}
                          </span>
                        </div>
                      )}
                    </div>
                    {showEditButton && (
                      <button
                        type="button"
                        className="jp-Button jp-mod-minimal"
                        onClick={() => startEdit(item)}
                      >
                        Edit
                      </button>
                    )}
                  </>
                )}
                {isNotebookTodo ? (
                  openTodoOrigin && (
                    <button
                      type="button"
                      className="jp-Button jp-TodoApp-actionButton"
                      onClick={() => handleOpenOrigin(item)}
                      aria-label={
                        item.originPath
                          ? `Open ${item.originPath}`
                          : `Open ${item.text}`
                      }
                    >
                      Open
                    </button>
                  )
                ) : (
                  <button
                    type="button"
                    onClick={() => confirmAndRemove(item)}
                    className="jp-Button jp-TodoApp-actionButton jp-mod-warn"
                    aria-label={`Delete ${item.text}`}
                  >
                    Delete
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
