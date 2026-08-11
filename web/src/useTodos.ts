import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from './api.ts';
import type { Todo } from '../../shared/types.ts';

export type Status = 'loading' | 'ready' | 'error';

export interface Notify {
  (message: string, undo?: { label: string; run: () => void }): void;
}

/**
 * 서버가 진실의 원천이지만, 모든 변경은 먼저 화면에 반영하고(낙관적 업데이트)
 * 요청이 실패하면 직전 상태로 되돌린다.
 */
export function useTodos(notify: Notify) {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<string | null>(null);

  // 항상 최신 목록을 읽기 위한 미러. 롤백 스냅샷을 뜨거나, 상태 반영을 기다리지
  // 않고 곧바로 다음 동작(예: 순서 이동 직후 저장)을 이어갈 때 쓴다.
  const todosRef = useRef<Todo[]>(todos);

  /** 목록 갱신은 항상 이 함수를 통한다. ref와 state를 함께 움직여야 한다. */
  const apply = useCallback((update: Todo[] | ((prev: Todo[]) => Todo[])) => {
    const next = typeof update === 'function' ? update(todosRef.current) : update;
    todosRef.current = next;
    setTodos(next);
  }, []);

  const notifyRef = useRef(notify);
  notifyRef.current = notify;

  const refresh = useCallback(async () => {
    try {
      apply(await api.list());
      setStatus('ready');
      setError(null);
    } catch (err) {
      setStatus('error');
      setError(message(err));
    }
  }, [apply]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // 다른 탭·기기에서 바뀐 내용을 창을 다시 볼 때 맞춰준다.
  useEffect(() => {
    const sync = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    window.addEventListener('focus', sync);
    document.addEventListener('visibilitychange', sync);
    return () => {
      window.removeEventListener('focus', sync);
      document.removeEventListener('visibilitychange', sync);
    };
  }, [refresh]);

  /** 낙관적 업데이트 + 실패 시 롤백. */
  const run = useCallback(
    async (optimistic: (prev: Todo[]) => Todo[], call: () => Promise<Todo[] | void>) => {
      const snapshot = todosRef.current;
      apply(optimistic(snapshot));
      try {
        const settled = await call();
        if (settled) apply(settled);
        setError(null);
      } catch (err) {
        apply(snapshot);
        setError(message(err));
        notifyRef.current(message(err));
      }
    },
    [apply]
  );

  const add = useCallback(
    (rawTitle: string) => {
      const title = rawTitle.trim();
      if (!title) return;
      const tempId = `temp-${crypto.randomUUID()}`;
      const optimistic: Todo = {
        id: tempId,
        title,
        done: false,
        position: (todosRef.current[0]?.position ?? 0) - 1,
        createdAt: Date.now(),
      };

      void run(
        (prev) => [optimistic, ...prev],
        async () => {
          const created = await api.create(title);
          // 요청 중에 다른 변경이 있었을 수 있으므로 임시 항목만 교체한다.
          apply((prev) => prev.map((t) => (t.id === tempId ? created : t)));
        }
      );
    },
    [run, apply]
  );

  const toggle = useCallback(
    (id: string) => {
      const current = todosRef.current.find((t) => t.id === id);
      if (!current) return;
      const done = !current.done;
      void run(
        (prev) => prev.map((t) => (t.id === id ? { ...t, done } : t)),
        () => api.update(id, { done }).then(() => undefined)
      );
    },
    [run]
  );

  const rename = useCallback(
    (id: string, rawTitle: string) => {
      const title = rawTitle.trim();
      const current = todosRef.current.find((t) => t.id === id);
      if (!current || title === current.title) return;
      void run(
        (prev) => prev.map((t) => (t.id === id ? { ...t, title } : t)),
        () => api.update(id, { title }).then(() => undefined)
      );
    },
    [run]
  );

  const remove = useCallback(
    (id: string) => {
      const target = todosRef.current.find((t) => t.id === id);
      if (!target) return;

      void run(
        (prev) => prev.filter((t) => t.id !== id),
        async () => {
          const deleted = await api.remove(id);
          notifyRef.current(`"${truncate(deleted.title)}" 삭제됨`, {
            label: '실행 취소',
            run: () => void restore([deleted]),
          });
        }
      );
    },
    [run]
  );

  const restore = useCallback(
    async (removed: Todo[]) => {
      try {
        const { restored } = await api.restore(removed);
        apply((prev) => sortByPosition([...prev, ...restored]));
        setError(null);
      } catch (err) {
        setError(message(err));
        notifyRef.current(message(err));
      }
    },
    [apply]
  );

  const toggleAll = useCallback(
    (done: boolean) =>
      void run(
        (prev) => prev.map((t) => ({ ...t, done })),
        () => api.toggleAll(done).then((r) => r.todos)
      ),
    [run]
  );

  const clearCompleted = useCallback(
    () =>
      void run(
        (prev) => prev.filter((t) => !t.done),
        async () => {
          const { removed } = await api.clearCompleted();
          if (removed.length) {
            notifyRef.current(`${removed.length}개 삭제됨`, {
              label: '실행 취소',
              run: () => void restore(removed),
            });
          }
        }
      ),
    [run, restore]
  );

  // --- 순서 변경: 드래그·키보드 이동 중에는 화면만 바꾸고, 끝났을 때 한 번 저장한다.
  const moveSnapshot = useRef<Todo[] | null>(null);

  const beginMove = useCallback(() => {
    moveSnapshot.current = todosRef.current;
  }, []);

  const moveItem = useCallback(
    (fromId: string, toId: string) => {
      if (fromId === toId) return;
      apply((prev) => {
        const from = prev.findIndex((t) => t.id === fromId);
        const to = prev.findIndex((t) => t.id === toId);
        if (from === -1 || to === -1) return prev;
        const next = [...prev];
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved!);
        return next;
      });
    },
    [apply]
  );

  const commitMove = useCallback(async () => {
    const snapshot = moveSnapshot.current;
    moveSnapshot.current = null;
    const ids = todosRef.current.map((t) => t.id);
    if (!snapshot || sameOrder(snapshot, ids)) return;

    try {
      apply((await api.reorder(ids)).todos);
      setError(null);
    } catch (err) {
      apply(snapshot);
      setError(message(err));
      notifyRef.current(message(err));
    }
  }, [apply]);

  return {
    todos,
    status,
    error,
    refresh,
    add,
    toggle,
    rename,
    remove,
    toggleAll,
    clearCompleted,
    beginMove,
    moveItem,
    commitMove,
  };
}

const sortByPosition = (todos: Todo[]) => [...todos].sort((a, b) => a.position - b.position);

const sameOrder = (todos: Todo[], ids: string[]) =>
  todos.length === ids.length && todos.every((t, i) => t.id === ids[i]);

const truncate = (text: string, max = 24) =>
  text.length > max ? `${text.slice(0, max)}…` : text;

function message(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  return '알 수 없는 오류가 발생했습니다.';
}
