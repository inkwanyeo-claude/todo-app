import type { Todo } from '../../shared/types.ts';
import { ApiError } from './apiError.ts';
import { localStore } from './localStore.ts';

export { ApiError };

const BASE = '/api';

async function request<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(BASE + path, {
      ...rest,
      headers: json === undefined ? rest.headers : { 'content-type': 'application/json' },
      body: json === undefined ? rest.body : JSON.stringify(json),
    });
  } catch {
    throw new ApiError('서버에 연결할 수 없습니다.', 0);
  }

  const text = await res.text();
  const body: unknown = text ? safeParse(text) : null;

  if (!res.ok) {
    const message =
      typeof body === 'object' && body !== null && 'error' in body
        ? String((body as { error: unknown }).error)
        : `요청이 실패했습니다 (${res.status})`;
    throw new ApiError(message, res.status);
  }
  return body as T;
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

const httpApi = {
  list: () => request<Todo[]>('/todos'),

  create: (title: string) => request<Todo>('/todos', { method: 'POST', json: { title } }),

  update: (id: string, patch: { title?: string; done?: boolean }) =>
    request<Todo>(`/todos/${encodeURIComponent(id)}`, { method: 'PATCH', json: patch }),

  remove: (id: string) =>
    request<Todo>(`/todos/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  restore: (todos: Todo[]) =>
    request<{ restored: Todo[] }>('/todos/restore', { method: 'POST', json: { todos } }),

  reorder: (ids: string[]) =>
    request<{ todos: Todo[] }>('/todos/order', { method: 'PUT', json: { ids } }),

  toggleAll: (done: boolean) =>
    request<{ todos: Todo[] }>('/todos/toggle-all', { method: 'POST', json: { done } }),

  clearCompleted: () =>
    request<{ removed: Todo[] }>('/todos/clear-completed', { method: 'POST' }),
};

/**
 * 기본은 API 서버(`/api`)를 쓴다. `VITE_STORAGE=local` 로 빌드하면 서버 없이
 * 브라우저 저장소만 사용한다 — 정적 호스팅(GitHub Pages) 배포용.
 */
export const isLocalStorageMode = import.meta.env.VITE_STORAGE === 'local';

export const api: typeof httpApi = isLocalStorageMode ? localStore : httpApi;
