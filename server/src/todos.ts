import { randomUUID } from 'node:crypto';
import { db } from './db.ts';
import type { Todo } from '../../shared/types.ts';

interface Row {
  id: string;
  title: string;
  done: number;
  position: number;
  created_at: number;
}

const toTodo = (row: Row): Todo => ({
  id: row.id,
  title: row.title,
  done: row.done === 1,
  position: row.position,
  createdAt: row.created_at,
});

const selectAll = db.prepare('SELECT * FROM todos ORDER BY position, created_at DESC');
const selectOne = db.prepare('SELECT * FROM todos WHERE id = ?');
const insert = db.prepare(
  'INSERT INTO todos (id, title, done, position, created_at) VALUES (?, ?, ?, ?, ?)'
);
const deleteOne = db.prepare('DELETE FROM todos WHERE id = ?');
const minPosition = db.prepare('SELECT MIN(position) AS min FROM todos');
const setPosition = db.prepare('UPDATE todos SET position = ? WHERE id = ?');
const positionTaken = db.prepare('SELECT 1 FROM todos WHERE position = ?');

export function list(): Todo[] {
  return (selectAll.all() as unknown as Row[]).map(toTodo);
}

export function get(id: string): Todo | undefined {
  const row = selectOne.get(id) as unknown as Row | undefined;
  return row && toTodo(row);
}

/** 새 항목은 항상 목록 맨 위에 들어간다. */
export function create(title: string): Todo {
  const top = (minPosition.get() as unknown as { min: number | null }).min ?? 0;
  const todo: Todo = {
    id: randomUUID(),
    title,
    done: false,
    position: top - 1,
    createdAt: Date.now(),
  };
  insert.run(todo.id, todo.title, 0, todo.position, todo.createdAt);
  return todo;
}

/** 실행 취소용. 삭제된 항목을 id·순서까지 그대로 되살린다. */
export function restore(todos: Todo[]): Todo[] {
  const restored: Todo[] = [];
  for (const todo of todos) {
    if (get(todo.id)) continue;
    // 자리를 비운 사이 다른 항목이 같은 위치를 차지했을 수 있다. 아주 조금
    // 위로 밀어 순서 값이 겹치지 않게 한다(이웃 관계는 그대로 유지).
    let position = todo.position;
    while (positionTaken.get(position) !== undefined) position -= 1e-6;

    insert.run(todo.id, todo.title, todo.done ? 1 : 0, position, todo.createdAt);
    restored.push({ ...todo, position });
  }
  return restored;
}

export function update(
  id: string,
  patch: { title?: string; done?: boolean }
): Todo | undefined {
  const current = get(id);
  if (!current) return undefined;

  const next: Todo = {
    ...current,
    title: patch.title ?? current.title,
    done: patch.done ?? current.done,
  };
  db.prepare('UPDATE todos SET title = ?, done = ? WHERE id = ?').run(
    next.title,
    next.done ? 1 : 0,
    id
  );
  return next;
}

export function remove(id: string): Todo | undefined {
  const current = get(id);
  if (!current) return undefined;
  deleteOne.run(id);
  return current;
}

/**
 * 주어진 id 순서대로 자리를 다시 매긴다.
 * 필터로 숨겨진 항목이 있어도 그 항목들이 차지하던 자리는 그대로 유지된다.
 */
export function reorder(ids: string[]): Todo[] {
  const all = list();
  const known = new Set(all.map((t) => t.id));
  const moving = [...new Set(ids)].filter((id) => known.has(id));
  const movingSet = new Set(moving);

  // 이동 대상들이 원래 차지하고 있던 슬롯(위치 값)을 순서대로 모은다.
  const slots = all.filter((t) => movingSet.has(t.id)).map((t) => t.position);

  db.exec('BEGIN');
  try {
    moving.forEach((id, i) => setPosition.run(slots[i], id));
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  return list();
}

export function toggleAll(done: boolean): Todo[] {
  db.prepare('UPDATE todos SET done = ?').run(done ? 1 : 0);
  return list();
}

/** 삭제된 항목을 돌려줘서 클라이언트가 실행 취소를 제안할 수 있게 한다. */
export function clearCompleted(): Todo[] {
  const removed = list().filter((t) => t.done);
  db.prepare('DELETE FROM todos WHERE done = 1').run();
  return removed;
}
