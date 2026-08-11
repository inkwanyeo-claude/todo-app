import { useEffect, useRef, useState } from 'react';
import { MAX_TITLE_LENGTH } from '../../../shared/types.ts';
import type { Todo } from '../../../shared/types.ts';

interface Props {
  todo: Todo;
  editing: boolean;
  dragging: boolean;
  focused: boolean;
  onToggle: () => void;
  onStartEdit: () => void;
  onCommitEdit: (title: string) => void;
  onCancelEdit: () => void;
  onRemove: () => void;
  onMove: (direction: -1 | 1) => void;
  onDragStart: () => void;
  onDragEnter: () => void;
  onDragEnd: () => void;
}

export function TodoItem({
  todo,
  editing,
  dragging,
  focused,
  onToggle,
  onStartEdit,
  onCommitEdit,
  onCancelEdit,
  onRemove,
  onMove,
  onDragStart,
  onDragEnter,
  onDragEnd,
}: Props) {
  const itemRef = useRef<HTMLLIElement>(null);
  const [draft, setDraft] = useState(todo.title);
  // Escape로 취소했을 때 blur 저장이 겹치지 않게 하는 플래그
  const cancelled = useRef(false);

  useEffect(() => {
    if (editing) {
      setDraft(todo.title);
      cancelled.current = false;
    }
  }, [editing, todo.title]);

  useEffect(() => {
    if (focused && !editing) itemRef.current?.focus();
  }, [focused, editing]);

  return (
    <li
      ref={itemRef}
      className={`item${todo.done ? ' done' : ''}${dragging ? ' dragging' : ''}`}
      tabIndex={0}
      draggable={!editing}
      onDragStart={onDragStart}
      onDragEnter={onDragEnter}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => e.preventDefault()}
      onDragEnd={onDragEnd}
      onKeyDown={(e) => {
        if (editing) return;
        if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
          e.preventDefault();
          onMove(e.key === 'ArrowUp' ? -1 : 1);
        } else if (e.target === itemRef.current) {
          if (e.key === 'Enter') {
            e.preventDefault();
            onStartEdit();
          } else if (e.key === 'Delete' || e.key === 'Backspace') {
            e.preventDefault();
            onRemove();
          }
        }
      }}
    >
      <span className="grip" aria-hidden="true">
        ⠿
      </span>

      <input
        type="checkbox"
        className="check"
        checked={todo.done}
        onChange={onToggle}
        aria-label={`${todo.title} 완료 표시`}
      />

      {editing ? (
        <input
          className="edit-input"
          type="text"
          value={draft}
          maxLength={MAX_TITLE_LENGTH}
          aria-label="할 일 수정"
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
          onFocus={(e) => e.target.setSelectionRange(draft.length, draft.length)}
          onBlur={() => {
            if (!cancelled.current) onCommitEdit(draft);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onCommitEdit(draft);
            } else if (e.key === 'Escape') {
              e.preventDefault();
              cancelled.current = true;
              onCancelEdit();
            }
          }}
        />
      ) : (
        <>
          <span className="title" onDoubleClick={onStartEdit}>
            {todo.title}
          </span>
          <div className="item-actions">
            <button
              type="button"
              className="mini-btn edit"
              title="수정"
              aria-label="수정"
              onClick={onStartEdit}
            >
              ✎
            </button>
            <button
              type="button"
              className="mini-btn remove"
              title="삭제"
              aria-label="삭제"
              onClick={onRemove}
            >
              ✕
            </button>
          </div>
        </>
      )}
    </li>
  );
}
