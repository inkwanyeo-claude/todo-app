import { useState } from 'react';
import { MAX_TITLE_LENGTH } from '../../../shared/types.ts';

interface Props {
  onAdd: (title: string) => void;
  disabled?: boolean;
}

export function NewTodoForm({ onAdd, disabled }: Props) {
  const [title, setTitle] = useState('');

  return (
    <form
      className="new-form"
      autoComplete="off"
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        onAdd(title);
        setTitle('');
      }}
    >
      <input
        className="new-input"
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="무엇을 해야 하나요?"
        aria-label="새 할 일"
        maxLength={MAX_TITLE_LENGTH}
        disabled={disabled}
        autoFocus
      />
      <button className="primary-btn" type="submit" disabled={disabled || !title.trim()}>
        추가
      </button>
    </form>
  );
}
