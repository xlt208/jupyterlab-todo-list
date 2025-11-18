import * as React from 'react';
import { logDebug, logError } from './logging';

export type Todo = {
  id: string;
  text: string;
  done: boolean;
  completedAt?: number;
};

export interface ITodoAppProps {
  loadTodos: () => Promise<Todo[]>;
  saveTodos: (todos: Todo[]) => Promise<void>;
}

export function TodoApp({ loadTodos, saveTodos }: ITodoAppProps) {
  const [items, setItems] = React.useState<Todo[]>([]);
  const [text, setText] = React.useState('');
  const [initialized, setInitialized] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editText, setEditText] = React.useState('');

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

  const hasItems = items.length > 0;

  return (
    <div className="jp-TodoApp">
      <h3 className="jp-TodoApp-title">To-Do List</h3>
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
          {items.map(item => {
            const checkboxId = `todo-item-${item.id}`;
            const itemClass = `jp-TodoApp-item${item.done ? ' is-done' : ''}`;
            const labelClass = `jp-TodoApp-itemLabel${
              item.done ? ' is-done' : ''
            }`;
            const isEditing = editingId === item.id;
            return (
              <li key={item.id} className={itemClass}>
                <input
                  id={checkboxId}
                  type="checkbox"
                  checked={item.done}
                  disabled={isEditing}
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
                    <label htmlFor={checkboxId} className={labelClass}>
                      {item.text}
                    </label>
                    {!item.done && (
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
                <button
                  type="button"
                  onClick={() => remove(item.id)}
                  className="jp-Button jp-mod-warn"
                  aria-label={`Delete ${item.text}`}
                >
                  Delete
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
