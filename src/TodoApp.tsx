import * as React from 'react';
import { logDebug, logError } from './logging';

export type Todo = { id: string; text: string; done: boolean };

export interface ITodoAppProps {
  loadTodos: () => Promise<Todo[]>;
  saveTodos: (todos: Todo[]) => Promise<void>;
}

export function TodoApp({ loadTodos, saveTodos }: ITodoAppProps) {
  const [items, setItems] = React.useState<Todo[]>([]);
  const [text, setText] = React.useState('');
  const [initialized, setInitialized] = React.useState(false);

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
    setItems(prev =>
      prev.map(item => (item.id === id ? { ...item, done: !item.done } : item))
    );
  }, []);

  const remove = React.useCallback((id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  }, []);

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
      <h3 className="jp-TodoApp-title">To-Do</h3>
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
            const labelClass = `jp-TodoApp-itemLabel${
              item.done ? ' is-done' : ''
            }`;
            return (
              <li key={item.id} className="jp-TodoApp-item">
                <input
                  id={checkboxId}
                  type="checkbox"
                  checked={item.done}
                  onChange={() => toggle(item.id)}
                />
                <label htmlFor={checkboxId} className={labelClass}>
                  {item.text}
                </label>
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
