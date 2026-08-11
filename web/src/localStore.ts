import { MAX_TITLE_LENGTH } from '../../shared/types.ts';
import type { Todo } from '../../shared/types.ts';
import { ApiError } from './apiError.ts';

/**
 * 서버 없이 동작해야 하는 배포(예: GitHub Pages)에서 쓰는 저장소.
 * server/src/todos.ts 와 같은 규칙을 그대로 따르므로 화면 동작이 동일하다.
 */

const STORAGE_KEY = 'todo2.local.v1';

function read(): Todo[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data.filter(isTodo).sort(byPosition);
  } catch {
    return [];
  }
}

function write(todos: Todo[]): Todo[] {
  const sorted = [...todos].sort(byPosition);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sorted));
  } catch {
    throw new ApiError('브라우저 저장 공간이 부족합니다.', 0);
  }
  return sorted;
}

const byPosition = (a: Todo, b: Todo) => a.position - b.position || b.createdAt - a.createdAt;

function isTodo(value: unknown): value is Todo {
  const t = value as Todo | null;
  return (
    typeof t === 'object' &&
    t !== null &&
    typeof t.id === 'string' &&
    typeof t.title === 'string' &&
    typeof t.done === 'boolean' &&
    typeof t.position === 'number' &&
    typeof t.createdAt === 'number'
  );
}

function parseTitle(value: string): string {
  const title = value.trim();
  if (!title || title.length > MAX_TITLE_LENGTH) {
    throw new ApiError('제목은 1~200자여야 합니다.', 400);
  }
  return title;
}

function find(todos: Todo[], id: string): Todo {
  const todo = todos.find((t) => t.id === id);
  if (!todo) throw new ApiError('항목을 찾을 수 없습니다.', 404);
  return todo;
}

export const localStore = {
  list: async (): Promise<Todo[]> => read(),

  create: async (rawTitle: string): Promise<Todo> => {
    const todos = read();
    const created: Todo = {
      id: crypto.randomUUID(),
      title: parseTitle(rawTitle),
      done: false,
      position: (todos[0]?.position ?? 0) - 1,
      createdAt: Date.now(),
    };
    write([created, ...todos]);
    return created;
  },

  update: async (id: string, patch: { title?: string; done?: boolean }): Promise<Todo> => {
    const todos = read();
    const current = find(todos, id);
    const next: Todo = {
      ...current,
      title: patch.title === undefined ? current.title : parseTitle(patch.title),
      done: patch.done ?? current.done,
    };
    write(todos.map((t) => (t.id === id ? next : t)));
    return next;
  },

  remove: async (id: string): Promise<Todo> => {
    const todos = read();
    const removed = find(todos, id);
    write(todos.filter((t) => t.id !== id));
    return removed;
  },

  restore: async (removed: Todo[]): Promise<{ restored: Todo[] }> => {
    const todos = read();
    const taken = new Set(todos.map((t) => t.position));
    const restored: Todo[] = [];

    for (const todo of removed) {
      if (todos.some((t) => t.id === todo.id)) continue;
      let position = todo.position;
      while (taken.has(position)) position -= 1e-6;
      taken.add(position);

      const item = { ...todo, position };
      todos.push(item);
      restored.push(item);
    }
    write(todos);
    return { restored };
  },

  reorder: async (ids: string[]): Promise<{ todos: Todo[] }> => {
    const todos = read();
    const known = new Set(todos.map((t) => t.id));
    const moving = [...new Set(ids)].filter((id) => known.has(id));
    const movingSet = new Set(moving);

    // 이동 대상이 원래 차지하던 자리만 다시 나눠 갖는다 → 숨겨진 항목은 그대로.
    const slots = todos.filter((t) => movingSet.has(t.id)).map((t) => t.position);
    const byId = new Map(todos.map((t) => [t.id, t]));

    moving.forEach((id, i) => {
      const todo = byId.get(id);
      if (todo) todo.position = slots[i]!;
    });
    return { todos: write(todos) };
  },

  toggleAll: async (done: boolean): Promise<{ todos: Todo[] }> => ({
    todos: write(read().map((t) => ({ ...t, done }))),
  }),

  clearCompleted: async (): Promise<{ removed: Todo[] }> => {
    const todos = read();
    const removed = todos.filter((t) => t.done);
    write(todos.filter((t) => !t.done));
    return { removed };
  },
};
