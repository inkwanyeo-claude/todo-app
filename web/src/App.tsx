import { useCallback, useMemo, useRef, useState } from 'react';
import { NewTodoForm } from './components/NewTodoForm.tsx';
import { TodoItem } from './components/TodoItem.tsx';
import { Toolbar, type Filter } from './components/Toolbar.tsx';
import { Toast, type ToastState } from './components/Toast.tsx';
import { useTodos, type Notify } from './useTodos.ts';
import { useTheme } from './useTheme.ts';

const FILTER_KEY = 'todo2.filter';

export default function App() {
  const [filter, setFilter] = useState<Filter>(readFilter);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastKey = useRef(0);

  const notify = useCallback<Notify>((message, undo) => {
    setToast({ key: ++toastKey.current, message, undo });
  }, []);

  const todos = useTodos(notify);
  const theme = useTheme();

  const changeFilter = (next: Filter) => {
    setFilter(next);
    localStorage.setItem(FILTER_KEY, next);
  };

  const visible = useMemo(() => {
    if (filter === 'active') return todos.todos.filter((t) => !t.done);
    if (filter === 'done') return todos.todos.filter((t) => t.done);
    return todos.todos;
  }, [todos.todos, filter]);

  const remaining = todos.todos.filter((t) => !t.done).length;
  const doneCount = todos.todos.length - remaining;

  /** 보이는 목록 기준으로 위/아래 이웃과 자리를 바꾼다. */
  const moveVisible = (id: string, direction: -1 | 1) => {
    const index = visible.findIndex((t) => t.id === id);
    const neighbor = visible[index + direction];
    if (!neighbor) return;
    todos.beginMove();
    todos.moveItem(id, neighbor.id);
    void todos.commitMove();
    setFocusId(id);
  };

  const stopEditing = (id: string) => {
    setEditingId(null);
    setFocusId(id);
  };

  return (
    <main className="app">
      <header className="app-header">
        <h1>할 일</h1>
        <button
          className="icon-btn"
          type="button"
          onClick={theme.toggle}
          aria-label="테마 전환"
          title="테마 전환"
        >
          <span aria-hidden="true">{theme.isDark ? '☀️' : '🌙'}</span>
        </button>
      </header>

      <NewTodoForm onAdd={todos.add} disabled={todos.status === 'error'} />

      <Toolbar
        filter={filter}
        onFilterChange={changeFilter}
        remaining={remaining}
        total={todos.todos.length}
        doneCount={doneCount}
        onToggleAll={() => todos.toggleAll(remaining > 0)}
        onClearCompleted={todos.clearCompleted}
      />

      {todos.status === 'error' ? (
        <div className="banner error">
          <span>{todos.error ?? '서버에 연결할 수 없습니다.'}</span>
          <button className="ghost-btn" type="button" onClick={() => void todos.refresh()}>
            다시 시도
          </button>
        </div>
      ) : todos.status === 'loading' ? (
        <p className="empty">불러오는 중…</p>
      ) : (
        <>
          {visible.length > 0 && (
            <ul className="list" aria-label="할 일 목록">
              {visible.map((todo) => (
                <TodoItem
                  key={todo.id}
                  todo={todo}
                  editing={editingId === todo.id}
                  dragging={draggingId === todo.id}
                  focused={focusId === todo.id}
                  onToggle={() => todos.toggle(todo.id)}
                  onStartEdit={() => setEditingId(todo.id)}
                  onCommitEdit={(title) => {
                    if (title.trim()) todos.rename(todo.id, title);
                    else todos.remove(todo.id);
                    stopEditing(todo.id);
                  }}
                  onCancelEdit={() => stopEditing(todo.id)}
                  onRemove={() => todos.remove(todo.id)}
                  onMove={(direction) => moveVisible(todo.id, direction)}
                  onDragStart={() => {
                    setDraggingId(todo.id);
                    todos.beginMove();
                  }}
                  onDragEnter={() => {
                    if (draggingId && draggingId !== todo.id) {
                      todos.moveItem(draggingId, todo.id);
                    }
                  }}
                  onDragEnd={() => {
                    setDraggingId(null);
                    void todos.commitMove();
                  }}
                />
              ))}
            </ul>
          )}

          {visible.length === 0 && <p className="empty">{emptyMessage(filter, todos.todos.length)}</p>}
        </>
      )}

      <footer className="hints">
        <span>
          <kbd>더블클릭</kbd> 수정
        </span>
        <span>
          <kbd>Alt</kbd>+<kbd>↑</kbd>/<kbd>↓</kbd> 순서 이동
        </span>
        <span>
          <kbd>드래그</kbd>로 정렬
        </span>
      </footer>

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </main>
  );
}

function readFilter(): Filter {
  const saved = localStorage.getItem(FILTER_KEY);
  return saved === 'active' || saved === 'done' ? saved : 'all';
}

function emptyMessage(filter: Filter, total: number): string {
  if (total === 0) return '아직 할 일이 없습니다. 위에 입력해서 추가해 보세요.';
  if (filter === 'active') return '진행 중인 할 일이 없습니다. 🎉';
  return '완료한 할 일이 없습니다.';
}
